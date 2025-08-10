import Anthropic from '@anthropic-ai/sdk'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins, ProviderResponseHandler } from '../utils/base-provider-helpers.js'
import { buildClientOptions } from '../utils/provider-utils.js'

export class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.anthropic = null
    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  initializeClient() {
    const clientOptions = buildClientOptions(this.getProviderConfig(), {
      timeout: 60000,
      maxRetries: 2,
      defaultHeaders: {
        'X-Client-Name': 'ai-changelog-generator',
        'X-Client-Version': '1.0.0',
      },
    })

    this.anthropic = new Anthropic({
      apiKey: clientOptions.apiKey,
      baseURL: clientOptions.baseURL,
      timeout: clientOptions.timeout,
      maxRetries: clientOptions.maxRetries,
      defaultHeaders: clientOptions.defaultHeaders,
    })
  }

  getName() {
    return 'anthropic'
  }

  isAvailable() {
    return !!this.config.ANTHROPIC_API_KEY
  }

  getRequiredEnvVars() {
    return ['ANTHROPIC_API_KEY']
  }

  getDefaultModel() {
    return 'claude-sonnet-4-20250514'
  }

  async generateCompletion(messages, options = {}) {
    return ProviderResponseHandler.executeWithErrorHandling(
      this,
      'generate_completion',
      async () => {
        const modelConfig = this.getProviderModelConfig()

        // Anthropic API uses a slightly different message format
        const systemMessage = messages.find((m) => m.role === 'system')
        const userMessages = messages.filter((m) => m.role !== 'system')

        const params = {
          model: options.model || modelConfig.standardModel || this.getDefaultModel(),
          system: systemMessage ? systemMessage.content : undefined,
          messages: userMessages,
          max_tokens: options.max_tokens || 4096,
          temperature: options.temperature || 0.3,
        }

        // Add tool calling if provided
        if (options.tools) {
          params.tools = options.tools
          params.tool_choice = options.tool_choice || 'auto'
        }

        // Add streaming if requested
        if (options.stream) {
          params.stream = true
          const stream = await this.anthropic.messages.create(params)
          return { stream, model: params.model }
        }

        const response = await this.anthropic.messages.create(params)

        // Check if there are tool calls in the response
        const toolCalls = response.content.some((c) => c.type === 'tool_use')
          ? response.content.filter((c) => c.type === 'tool_use').map((c) => c.tool_use)
          : null

        // Get the text content
        const textContent = response.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n')

        return {
          text: textContent,
          content: textContent,
          model: response.model,
          usage: response.usage,
          tokens: response.usage.input_tokens + response.usage.output_tokens,
          tool_calls: toolCalls,
          stop_reason: response.stop_reason,
          stop_sequence: response.stop_sequence,
        }
      },
      { model: options.model }
    )
  }

  async generateText(messages, model = null) {
    const response = await this.generateCompletion(messages, { model })
    return response
  }

  async getAvailableModels() {
    // Anthropic doesn't provide a models endpoint, return known models
    return [
      {
        name: 'claude-sonnet-4-20250514',
        id: 'claude-sonnet-4-20250514',
        description: 'Claude Sonnet 4 - Latest balanced model (2025)',
        contextWindow: 200000,
        capabilities: {
          reasoning: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
          largeContext: true,
          toolUse: true,
        },
      },
      {
        name: 'claude-opus-4-20250514',
        id: 'claude-opus-4-20250514',
        description: 'Claude Opus 4 - Most capable model for complex tasks (2025)',
        contextWindow: 200000,
        capabilities: {
          reasoning: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
          largeContext: true,
          toolUse: true,
          advancedReasoning: true,
        },
      },
      {
        name: 'claude-3.7-sonnet-20250219',
        id: 'claude-3.7-sonnet-20250219',
        description: 'Claude 3.7 Sonnet - Enhanced reasoning capabilities',
        contextWindow: 200000,
        capabilities: {
          reasoning: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
          largeContext: true,
          toolUse: true,
        },
      },
      {
        name: 'claude-3-5-sonnet-20241022',
        id: 'claude-3-5-sonnet-20241022',
        description: 'Claude 3.5 Sonnet - Previous generation',
        contextWindow: 200000,
        capabilities: {
          reasoning: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
        },
      },
      {
        name: 'claude-3-5-haiku-20241022',
        id: 'claude-3-5-haiku-20241022',
        description: 'Claude 3.5 Haiku - Fast and efficient',
        contextWindow: 200000,
        capabilities: {
          reasoning: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
        },
      },
    ]
  }

  async validateModelAvailability(modelName) {
    try {
      const models = await this.getAvailableModels()
      const model = models.find((m) => m.name === modelName)

      if (model) {
        return {
          available: true,
          model: modelName,
          capabilities: model.capabilities,
          contextWindow: model.contextWindow,
        }
      }
      const availableModels = models.map((m) => m.name)
      return {
        available: false,
        error: `Model '${modelName}' not available`,
        alternatives: availableModels.slice(0, 5),
      }
    } catch (error) {
      return {
        available: false,
        error: error.message,
        alternatives: [
          'claude-sonnet-4-20250514',
          'claude-opus-4-20250514',
          'claude-3.7-sonnet-20250219',
        ],
      }
    }
  }

  async testConnection() {
    try {
      const response = await this.generateCompletion([{ role: 'user', content: 'Hello' }], {
        max_tokens: 5,
      })

      return {
        success: true,
        model: response.model,
        message: 'Connection successful',
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  async testModel(modelName) {
    try {
      const response = await this.anthropic.messages.create({
        model: modelName,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
      })

      return {
        success: true,
        model: response.model,
        sdk_version: '0.56.0',
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  getCapabilities(_modelName) {
    return {
      completion: true,
      streaming: true,
      function_calling: true,
      json_mode: true,
      reasoning: true,
      multimodal: true,
      large_context: true,
    }
  }

  getModelRecommendation(commitDetails) {
    const { files = 0, lines = 0, breaking = false, complex = false } = commitDetails

    // Use the most capable model for complex or breaking changes
    if (breaking || complex || files > 20 || lines > 1000) {
      return {
        model: 'claude-3-5-sonnet-20241022',
        reason: 'Complex or breaking change requiring advanced reasoning',
      }
    }

    // Use standard model for medium changes
    if (files > 5 || lines > 200) {
      return {
        model: 'claude-3-sonnet-20240229',
        reason: 'Medium-sized change requiring good analysis',
      }
    }

    // Use efficient model for small changes
    return {
      model: 'claude-3-haiku-20240307',
      reason: 'Small change, optimized for efficiency',
    }
  }

  async selectOptimalModel(commitInfo) {
    const recommendation = this.getModelRecommendation(commitInfo)
    const validation = await this.validateModelAvailability(recommendation.model)

    if (validation.available) {
      return {
        model: recommendation.model,
        reason: recommendation.reason,
        capabilities: validation.capabilities,
      }
    }
    return {
      model: this.getDefaultModel(),
      reason: 'Fallback to default model',
      capabilities: this.getCapabilities(this.getDefaultModel()),
    }
  }

  getProviderModelConfig() {
    return {
      smallModel: 'claude-3-5-haiku-20241022',
      mediumModel: 'claude-3.7-sonnet-20250219',
      standardModel: 'claude-sonnet-4-20250514',
      complexModel: 'claude-opus-4-20250514',
      default: 'claude-sonnet-4-20250514',
      temperature: 0.3,
      maxTokens: 4096,
    }
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins ? applyMixins(AnthropicProvider, 'anthropic') : AnthropicProvider
