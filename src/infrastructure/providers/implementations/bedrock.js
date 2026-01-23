/**
 * Amazon Bedrock Provider for AI Changelog Generator
 * Uses AWS SDK v3 for Bedrock Runtime
 * Supports Claude 4.5, Llama 4, and other Bedrock models (January 2026)
 */

import process from 'node:process'

import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins, ProviderResponseHandler } from '../utils/base-provider-helpers.js'
import { buildClientOptions } from '../utils/provider-utils.js'

export class BedrockProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.bedrockClient = null
    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  initializeClient() {
    const clientOptions = buildClientOptions(this.getProviderConfig(), {
      region: 'us-east-1',
      timeout: 60000,
      maxRetries: 2,
    })

    this.bedrockClient = new BedrockRuntimeClient({
      region: clientOptions.region || this.config.AWS_REGION || 'us-east-1',
      credentials: this.config.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: this.config.AWS_ACCESS_KEY_ID,
            secretAccessKey: this.config.AWS_SECRET_ACCESS_KEY,
            sessionToken: this.config.AWS_SESSION_TOKEN,
          }
        : undefined, // Use default credential chain if not provided
      maxAttempts: clientOptions.maxRetries,
      requestTimeout: clientOptions.timeout,
    })
  }

  getName() {
    return 'bedrock'
  }

  isAvailable() {
    // Can use default AWS credential chain or explicit credentials
    return !!(
      // Explicit credentials
      (
        (this.config.AWS_ACCESS_KEY_ID && this.config.AWS_SECRET_ACCESS_KEY) ||
        // Or AWS profile/role-based auth (detected at runtime)
        this.config.AWS_REGION ||
        // Or default region
        process.env.AWS_REGION ||
        process.env.AWS_DEFAULT_REGION
      )
    )
  }

  getRequiredEnvVars() {
    return [] // Can work with default AWS credential chain
  }

  getDefaultModel() {
    return 'anthropic.claude-sonnet-4-5-v1:0'
  }

  async generateCompletion(messages, options = {}) {
    return ProviderResponseHandler.executeWithErrorHandling(
      this,
      'generate_completion',
      async () => {
        const modelConfig = this.getProviderModelConfig()
        const modelId = options.model || modelConfig.standardModel || this.getDefaultModel()

        // Use Converse API for modern interface
        if (this.supportsConverseAPI(modelId)) {
          return await this.generateWithConverseAPI(messages, options, modelId)
        }
        return await this.generateWithInvokeModel(messages, options, modelId)
      },
      { model: options.model }
    )
  }

  supportsConverseAPI(modelId) {
    // Converse API supports Claude, Llama, and other modern models
    return modelId.includes('claude') || modelId.includes('llama') || modelId.includes('titan')
  }

  async generateWithConverseAPI(messages, options, modelId) {
    const systemMessage = messages.find((m) => m.role === 'system')
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: [{ text: m.content }],
      }))

    const converseParams = {
      modelId,
      messages: conversationMessages,
      inferenceConfig: {
        maxTokens: options.max_tokens || 2000,
        temperature: options.temperature || 0.3,
        topP: options.top_p || 0.9,
      },
    }

    if (systemMessage) {
      converseParams.system = [{ text: systemMessage.content }]
    }

    if (options.tools && options.tools.length > 0) {
      converseParams.toolConfig = {
        tools: options.tools.map((tool) => ({
          toolSpec: {
            name: tool.function.name,
            description: tool.function.description,
            inputSchema: {
              json: tool.function.parameters,
            },
          },
        })),
      }
    }

    const command = new ConverseCommand(converseParams)
    const response = await this.bedrockClient.send(command)

    return {
      content: response.output.message.content[0].text,
      model: modelId,
      usage: {
        prompt_tokens: response.usage.inputTokens,
        completion_tokens: response.usage.outputTokens,
        total_tokens: response.usage.inputTokens + response.usage.outputTokens,
      },
      finish_reason: response.stopReason,
      tool_calls: response.output.message.content
        .filter((c) => c.toolUse)
        .map((c) => ({
          id: c.toolUse.toolUseId,
          type: 'function',
          function: {
            name: c.toolUse.name,
            arguments: JSON.stringify(c.toolUse.input),
          },
        })),
    }
  }

  async generateWithInvokeModel(messages, options, modelId) {
    // Format for specific model types
    let body

    if (modelId.includes('claude')) {
      // Anthropic Claude format
      const systemMessage = messages.find((m) => m.role === 'system')?.content
      const conversationMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options.max_tokens || 2000,
        temperature: options.temperature || 0.3,
        system: systemMessage,
        messages: conversationMessages,
      })
    } else if (modelId.includes('llama')) {
      // Meta Llama format
      const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n')
      body = JSON.stringify({
        prompt,
        max_gen_len: options.max_tokens || 2000,
        temperature: options.temperature || 0.3,
        top_p: options.top_p || 0.9,
      })
    } else {
      throw new Error(`Unsupported model format: ${modelId}`)
    }

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body,
    })

    const response = await this.bedrockClient.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    if (modelId.includes('claude')) {
      return {
        content: responseBody.content[0].text,
        model: modelId,
        usage: {
          prompt_tokens: responseBody.usage.input_tokens,
          completion_tokens: responseBody.usage.output_tokens,
          total_tokens: responseBody.usage.input_tokens + responseBody.usage.output_tokens,
        },
        finish_reason: responseBody.stop_reason,
      }
    }
    if (modelId.includes('llama')) {
      return {
        content: responseBody.generation,
        model: modelId,
        usage: {
          prompt_tokens: responseBody.prompt_token_count,
          completion_tokens: responseBody.generation_token_count,
          total_tokens: responseBody.prompt_token_count + responseBody.generation_token_count,
        },
        finish_reason: responseBody.stop_reason,
      }
    }
  }

  async getAvailableModels() {
    return [
      // Claude 4.5 models (November 2025) - Latest with hybrid reasoning
      {
        name: 'anthropic.claude-opus-4-5-v1:0',
        id: 'anthropic.claude-opus-4-5-v1:0',
        description: 'Claude Opus 4.5 - Most intelligent with effort parameter (Nov 2025)',
        contextWindow: 200000,
        extendedContext: 1000000, // 1M tokens in preview
        capabilities: {
          reasoning: true,
          hybrid_reasoning: true,
          extended_thinking: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
          effort_parameter: true,
        },
      },
      {
        name: 'anthropic.claude-sonnet-4-5-v1:0',
        id: 'anthropic.claude-sonnet-4-5-v1:0',
        description: 'Claude Sonnet 4.5 - Best for coding and agents (Sep 2025)',
        contextWindow: 200000,
        extendedContext: 1000000, // 1M tokens in preview
        capabilities: {
          reasoning: true,
          hybrid_reasoning: true,
          extended_thinking: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
          agentic_coding: true,
          computer_use: true,
        },
      },
      {
        name: 'anthropic.claude-haiku-4-5-v1:0',
        id: 'anthropic.claude-haiku-4-5-v1:0',
        description: 'Claude Haiku 4.5 - Fast hybrid reasoning (Oct 2025)',
        contextWindow: 200000,
        capabilities: {
          reasoning: true,
          hybrid_reasoning: true,
          extended_thinking: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
          fast: true,
        },
      },
      // Claude 4 models (previous generation)
      {
        name: 'anthropic.claude-opus-4-v1:0',
        id: 'anthropic.claude-opus-4-v1:0',
        description: 'Claude Opus 4 - Previous flagship (May 2025)',
        contextWindow: 200000,
        capabilities: {
          reasoning: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
          advancedReasoning: true,
        },
      },
      {
        name: 'anthropic.claude-sonnet-4-v1:0',
        id: 'anthropic.claude-sonnet-4-v1:0',
        description: 'Claude Sonnet 4 - Balanced performance (May 2025)',
        contextWindow: 200000,
        capabilities: {
          reasoning: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
        },
      },
      // Meta Llama 4 models (latest)
      {
        name: 'meta.llama4-scout-v1:0',
        id: 'meta.llama4-scout-v1:0',
        description: 'Llama 4 Scout - Latest multimodal Llama (2025)',
        contextWindow: 128000,
        capabilities: {
          reasoning: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
          open_source: true,
        },
      },
      {
        name: 'meta.llama4-maverick-v1:0',
        id: 'meta.llama4-maverick-v1:0',
        description: 'Llama 4 Maverick - Advanced multimodal (2025)',
        contextWindow: 128000,
        capabilities: {
          reasoning: true,
          function_calling: true,
          json_mode: true,
          multimodal: true,
          open_source: true,
        },
      },
      // Meta Llama 3.x models (previous generation)
      {
        name: 'meta.llama3-3-70b-instruct-v1:0',
        id: 'meta.llama3-3-70b-instruct-v1:0',
        description: 'Llama 3.3 70B - Large instruction-tuned model',
        contextWindow: 128000,
        capabilities: {
          reasoning: true,
          function_calling: false,
          json_mode: true,
          multimodal: false,
        },
      },
      {
        name: 'meta.llama3-2-90b-instruct-v1:0',
        id: 'meta.llama3-2-90b-instruct-v1:0',
        description: 'Llama 3.2 90B - Very large multimodal model',
        contextWindow: 128000,
        capabilities: {
          reasoning: true,
          function_calling: false,
          json_mode: true,
          multimodal: true,
        },
      },
      // Amazon Titan models
      {
        name: 'amazon.titan-text-premier-v1:0',
        id: 'amazon.titan-text-premier-v1:0',
        description: 'Amazon Titan Text Premier - High-performance text model',
        contextWindow: 32000,
        capabilities: {
          reasoning: true,
          function_calling: false,
          json_mode: true,
          multimodal: false,
        },
      },
    ]
  }

  getProviderModelConfig() {
    return {
      smallModel: 'anthropic.claude-haiku-4-5-v1:0',
      mediumModel: 'anthropic.claude-sonnet-4-v1:0',
      standardModel: 'anthropic.claude-sonnet-4-5-v1:0',
      complexModel: 'anthropic.claude-opus-4-5-v1:0',
      reasoningModel: 'anthropic.claude-opus-4-5-v1:0',
      default: 'anthropic.claude-sonnet-4-5-v1:0',
      temperature: 0.3,
      maxTokens: 2000,
    }
  }

  getModelCapabilities(modelName) {
    const isClaude45 = modelName.includes('4-5') || modelName.includes('4.5')
    const isLlama4 = modelName.includes('llama4')
    return {
      reasoning:
        modelName.includes('claude') || modelName.includes('llama') || modelName.includes('titan'),
      hybrid_reasoning: isClaude45,
      extended_thinking: isClaude45,
      function_calling: modelName.includes('claude') || isLlama4,
      json_mode: true,
      multimodal: modelName.includes('claude') || modelName.includes('llama3-2') || isLlama4,
      largeContext: modelName.includes('claude') || modelName.includes('llama'),
      advancedReasoning: modelName.includes('opus') || isClaude45,
      effort_parameter: modelName.includes('opus-4-5'),
      awsManaged: true,
    }
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
        error: `Model '${modelName}' not available in Bedrock`,
        alternatives: availableModels.slice(0, 5),
      }
    } catch (error) {
      return {
        available: false,
        error: error.message,
        alternatives: [
          'anthropic.claude-sonnet-4-20250514-v1:0',
          'anthropic.claude-opus-4-20250514-v1:0',
          'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
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
        message: 'Bedrock connection successful',
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  getCapabilities(modelName) {
    return {
      completion: true,
      streaming: false, // Bedrock streaming support varies by model
      function_calling: modelName ? modelName.includes('claude') : true,
      json_mode: true,
      reasoning: true,
      multimodal: modelName ? modelName.includes('claude') || modelName.includes('llama3-2') : true,
      awsManaged: true,
    }
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins ? applyMixins(BedrockProvider, 'bedrock') : BedrockProvider
