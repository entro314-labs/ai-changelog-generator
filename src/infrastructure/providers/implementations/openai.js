import { OpenAI } from 'openai';
import { BaseProvider } from '../core/base-provider.js';
import { ProviderError } from '../../../shared/utils/consolidated-utils.js';
import { applyMixins, ProviderResponseHandler } from '../utils/base-provider-helpers.js';
import { buildClientOptions } from '../utils/provider-utils.js';

export class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.openai = null;
    if (this.isAvailable()) {
      this.initializeClient();
    }
  }

  initializeClient() {
    const clientOptions = buildClientOptions(this.getProviderConfig(), {
      timeout: 60000,
      maxRetries: 2
    });
    
    this.openai = new OpenAI({
      apiKey: clientOptions.apiKey,
      organization: clientOptions.organization,
      project: clientOptions.project,
      timeout: clientOptions.timeout,
      maxRetries: clientOptions.maxRetries
    });
  }

  getName() {
    return 'openai';
  }

  isAvailable() {
    const apiKey = this.config.OPENAI_API_KEY;
    return apiKey && apiKey.trim() !== '' && apiKey.startsWith('sk-');
  }

  getRequiredEnvVars() {
    return ['OPENAI_API_KEY'];
  }

  getDefaultModel() {
    return 'gpt-4o';
  }

  async generateCompletion(messages, options = {}) {
    return ProviderResponseHandler.executeWithErrorHandling(
      this,
      'generate_completion',
      async () => {
        const modelConfig = this.getProviderModelConfig();
        const params = {
          model: options.model || modelConfig.standardModel || this.getDefaultModel(),
          messages,
          max_tokens: options.max_tokens || 1000,
          temperature: options.temperature || 0.3,
        };

        // Add tool calling if provided
        if (options.tools) {
          params.tools = options.tools;
          params.tool_choice = options.tool_choice || 'auto';
        }

        // Add streaming if requested
        if (options.stream) {
          params.stream = true;
          const stream = await this.openai.chat.completions.create(params);
          return { stream, model: params.model };
        }

        const completion = await this.openai.chat.completions.create(params);

        return {
          text: completion.choices[0].message.content,
          content: completion.choices[0].message.content,
          model: completion.model,
          usage: completion.usage,
          tokens: completion.usage.total_tokens,
          finish_reason: completion.choices[0].finish_reason,
          tool_calls: completion.choices[0].message.tool_calls
        };
      },
      { model: options.model }
    );
  }

  async generateText(messages, model = null) {
    const response = await this.generateCompletion(messages, { model });
    return response;
  }

  async getAvailableModels() {
    try {
      const models = await this.openai.models.list();
      return models.data
        .filter(m => m.id.includes('gpt') || m.id.includes('o1'))
        .map(m => ({
          name: m.id,
          id: m.id,
          description: `OpenAI ${m.id}`,
          contextWindow: this.getModelContextWindow(m.id),
          capabilities: this.getModelCapabilities(m.id)
        }));
    } catch (error) {
      return [];
    }
  }

  getModelContextWindow(modelName) {
    const contextWindows = {
      // Latest 2025 models
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'o1': 200000,
      'o1-mini': 128000,
      'gpt-4.1-nano': 200000,
      'gpt-4.1-mini': 200000,
      'gpt-4.1': 200000,
      // Note: o3/o4 are Azure-only models
      // Legacy models
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384
    };
    return contextWindows[modelName] || 128000;
  }

  getModelCapabilities(modelName) {
    return {
      reasoning: modelName.includes('o1') || modelName.includes('gpt-4'),
      function_calling: !modelName.includes('o1'), // o1 models don't support function calling
      json_mode: true,
      multimodal: modelName.includes('gpt-4o') || modelName.includes('gpt-4.1'),
      largeContext: modelName.includes('4.1') || modelName.includes('o1') || modelName.includes('4o'),
      promptCaching: modelName.includes('4.1')
    };
  }

  async validateModelAvailability(modelName) {
    try {
      const models = await this.getAvailableModels();
      const model = models.find(m => m.name === modelName);
      
      if (model) {
        return {
          available: true,
          model: modelName,
          capabilities: model.capabilities,
          contextWindow: model.contextWindow
        };
      } else {
        const availableModels = models.map(m => m.name);
        return {
          available: false,
          error: `Model '${modelName}' not available`,
          alternatives: availableModels.slice(0, 5)
        };
      }
    } catch (error) {
      return {
        available: false,
        error: error.message,
        alternatives: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o1', 'gpt-4']
      };
    }
  }

  async testConnection() {
    try {
      const response = await this.generateCompletion([
        { role: 'user', content: 'Hello' }
      ], { max_tokens: 5 });
      
      return {
        success: true,
        model: response.model,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getCapabilities(modelName) {
    return {
      completion: true,
      streaming: true,
      function_calling: true,
      json_mode: true,
      reasoning: modelName ? modelName.includes('gpt-4') : true,
      multimodal: false
    };
  }

  getModelRecommendation(commitDetails) {
    const { files = 0, lines = 0, breaking = false, complex = false } = commitDetails;
    
    // Use o1 for highly complex reasoning tasks
    if (breaking || complex || files > 50 || lines > 5000) {
      return {
        model: 'o1-mini',
        reason: 'Highly complex change requiring advanced reasoning'
      };
    }
    
    // Use GPT-4o for complex changes
    if (files > 20 || lines > 1000) {
      return {
        model: 'gpt-4o',
        reason: 'Complex change requiring advanced analysis'
      };
    }
    
    // Use GPT-4o mini for medium changes
    if (files > 5 || lines > 200) {
      return {
        model: 'gpt-4o-mini',
        reason: 'Medium-sized change requiring good analysis'
      };
    }
    
    // Use GPT-4o mini for small changes (more capable than 3.5-turbo)
    return {
      model: 'gpt-4o-mini',
      reason: 'Small change, using efficient modern model'
    };
  }

  async selectOptimalModel(commitInfo) {
    const recommendation = this.getModelRecommendation(commitInfo);
    const validation = await this.validateModelAvailability(recommendation.model);
    
    if (validation.available) {
      return {
        model: recommendation.model,
        reason: recommendation.reason,
        capabilities: validation.capabilities
      };
    } else {
      // Fallback to default model
      return {
        model: this.getDefaultModel(),
        reason: 'Fallback to default model',
        capabilities: this.getCapabilities(this.getDefaultModel())
      };
    }
  }

  getProviderModelConfig() {
    return {
      smallModel: 'gpt-4o-mini',
      mediumModel: 'gpt-4o',
      standardModel: 'gpt-4o',
      complexModel: 'o1-mini',
      reasoningModel: 'o1',
      default: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 1000
    };
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins ? applyMixins(OpenAIProvider, 'openai') : OpenAIProvider;