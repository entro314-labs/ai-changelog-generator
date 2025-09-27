import Anthropic from '@anthropic-ai/sdk'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins, ProviderResponseHandler } from '../utils/base-provider-helpers.js'

export class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.anthropic = null
    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  initializeClient() {
    const clientOptions = this.buildClientOptions({
      timeout: 60000,
      maxRetries: 2,
      defaultHeaders: {
        'X-Client-Name': 'ai-changelog-generator',
        'X-Client-Version': '1.0.0',
      },
    })

    this.anthropic = new Anthropic({
      apiKey: clientOptions.ANTHROPIC_API_KEY,
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
    const modelConfig = this.getProviderModelConfig()
    return modelConfig.standardModel
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
    // Use direct model names to avoid circular dependency with mixins
    return [
      {
        name: 'claude-opus-4-20250514',
        id: 'claude-opus-4-20250514',
        description: 'Claude Opus 4 - Most capable model for complex tasks (2025)',
      },
      {
        name: 'claude-sonnet-4-20250514',
        id: 'claude-sonnet-4-20250514',
        description: 'Claude Sonnet 4 - Latest balanced model (2025)',
      },
      {
        name: 'claude-3.7-sonnet-20250219',
        id: 'claude-3.7-sonnet-20250219',
        description: 'Claude 3.7 Sonnet - Enhanced reasoning capabilities',
      },
      {
        name: 'claude-3-5-haiku-20241022',
        id: 'claude-3-5-haiku-20241022',
        description: 'Claude 3.5 Haiku - Fast and efficient',
      },
    ]
  }

  // testConnection() and validateModelAvailability() now provided by mixins

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

  // All common methods now provided by mixins:
  // - getCapabilities() from CapabilitiesMixin
  // - getModelRecommendation() from ModelRecommendationMixin
  // - selectOptimalModel() from ModelRecommendationMixin
  // - getProviderModelConfig() from ConfigurationMixin
}

// Apply mixins to add standard provider functionality
export default applyMixins ? applyMixins(AnthropicProvider, 'anthropic') : AnthropicProvider
