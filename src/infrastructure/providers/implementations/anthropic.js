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

        // Claude 4.5 "effort" parameter (Opus 4.5 only) - controls reasoning depth
        // Valid values: 'low', 'medium', 'high'
        if (options.effort && this.isOpus45Model(params.model)) {
          params.effort = options.effort
        }

        // Add tool calling if provided
        if (options.tools) {
          params.tools = options.tools
          params.tool_choice = options.tool_choice || 'auto'
        }

        // Tool search beta (advanced-tool-use-2025-11-20) for Claude 4.5 models
        // Enables working with hundreds/thousands of tools
        if (options.tool_search && this.is45Model(params.model)) {
          params.betas = params.betas || []
          params.betas.push('advanced-tool-use-2025-11-20')
        }

        // Extended context (1M tokens beta) for Claude 4.5 models
        if (options.extended_context && this.is45Model(params.model)) {
          params.betas = params.betas || []
          params.betas.push('extended-context-2025-09-29')
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

  // Check if model is a Claude 4.5 model (supports new features)
  is45Model(modelName) {
    return modelName && (modelName.includes('4-5') || modelName.includes('4.5'))
  }

  // Check if model is Opus 4.5 (supports effort parameter)
  isOpus45Model(modelName) {
    return modelName && modelName.includes('opus-4-5')
  }

  async generateText(messages, model = null) {
    const response = await this.generateCompletion(messages, { model })
    return response
  }

  async getAvailableModels() {
    // Anthropic doesn't provide a models endpoint, return known models
    // Claude 4.5 series (November 2025) - hybrid reasoning models
    return [
      {
        name: 'claude-opus-4-5-20251124',
        id: 'claude-opus-4-5-20251124',
        description: 'Claude Opus 4.5 - Most intelligent model with effort parameter (Nov 2025)',
        features: [
          'hybrid_reasoning',
          'extended_thinking',
          'effort_parameter',
          'tool_search',
          '200k_context',
          '1M_context_beta',
        ],
      },
      {
        name: 'claude-sonnet-4-5-20250929',
        id: 'claude-sonnet-4-5-20250929',
        description: 'Claude Sonnet 4.5 - Best for coding, agents, and computer use (Sep 2025)',
        features: [
          'hybrid_reasoning',
          'extended_thinking',
          'agentic_coding',
          'computer_use',
          '200k_context',
          '1M_context_beta',
        ],
      },
      {
        name: 'claude-haiku-4-5-20251001',
        id: 'claude-haiku-4-5-20251001',
        description: 'Claude Haiku 4.5 - Fast hybrid reasoning model (Oct 2025)',
        features: [
          'hybrid_reasoning',
          'extended_thinking',
          'fast',
          'cost_effective',
          '200k_context',
        ],
      },
      {
        name: 'claude-sonnet-4-20250514',
        id: 'claude-sonnet-4-20250514',
        description: 'Claude Sonnet 4 - Balanced performance (May 2025)',
        features: ['coding_optimized', 'balanced', '200k_context'],
      },
      {
        name: 'claude-opus-4-20250514',
        id: 'claude-opus-4-20250514',
        description: 'Claude Opus 4 - Previous flagship model (May 2025)',
        features: ['extended_thinking', 'parallel_tools', '200k_context'],
      },
      {
        name: 'claude-3-5-haiku-20241022',
        id: 'claude-3-5-haiku-20241022',
        description: 'Claude 3.5 Haiku - Fast and efficient',
        features: ['fast', 'cost_effective'],
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
        sdk_version: '0.71.2',
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
