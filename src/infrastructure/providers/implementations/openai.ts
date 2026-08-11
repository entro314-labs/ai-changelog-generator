import { OpenAI } from 'openai'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins, ProviderResponseHandler } from '../utils/base-provider-helpers.js'

interface OpenAICompletionParams {
  model: string
  messages: any[]
  max_tokens: number
  temperature: number
  tools?: any[]
  tool_choice?: string
  stream?: boolean
}

export class OpenAIProvider extends BaseProvider {
  [key: string]: any
  constructor(config) {
    super(config)
    this.openai = null
    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  initializeClient() {
    const clientOptions = this.buildClientOptions({
      timeout: 60000,
      maxRetries: 2,
    })

    this.openai = new OpenAI({
      apiKey: clientOptions.OPENAI_API_KEY,
      organization: clientOptions.OPENAI_ORGANIZATION,
      project: clientOptions.OPENAI_PROJECT,
      timeout: clientOptions.timeout,
      maxRetries: clientOptions.maxRetries,
    })
  }

  getName() {
    return 'openai'
  }

  isAvailable() {
    const apiKey = this.config.OPENAI_API_KEY
    return apiKey && apiKey.trim() !== '' && apiKey.startsWith('sk-')
  }

  getRequiredEnvVars() {
    return ['OPENAI_API_KEY']
  }

  async generateCompletion(messages, options: Record<string, any> = {}) {
    return ProviderResponseHandler.executeWithErrorHandling(
      this,
      'generate_completion',
      async () => {
        const modelConfig = this.getProviderModelConfig()
        const params: OpenAICompletionParams = {
          model: options.model || modelConfig.standardModel || this.getDefaultModel(),
          messages,
          max_tokens: options.max_tokens || 1000,
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
          const stream = await this.openai.chat.completions.create(params)
          return { stream, model: params.model }
        }

        const completion = await this.openai.chat.completions.create(params)

        return {
          text: completion.choices[0].message.content,
          content: completion.choices[0].message.content,
          model: completion.model,
          usage: completion.usage,
          tokens: completion.usage.total_tokens,
          finish_reason: completion.choices[0].finish_reason,
          tool_calls: completion.choices[0].message.tool_calls,
        }
      },
      { model: options.model }
    )
  }

  async getAvailableModels() {
    try {
      const models = await this.openai.models.list()
      return models.data
        .filter((m) => m.id.includes('gpt') || /^o\d/.test(m.id))
        .map((m) => ({
          name: m.id,
          id: m.id,
          description: `OpenAI ${m.id}`,
        }))
    } catch {
      // Offline fallback catalogue: current GPT-5.6 family plus the nearest
      // still-available tiers. Live `models.list()` is preferred whenever the
      // API is reachable.
      return [
        {
          id: 'gpt-5.6-terra',
          name: 'gpt-5.6-terra',
          description: 'GPT-5.6 Terra - balanced intelligence and cost',
          contextWindow: 1050000,
          maxOutput: 128000,
        },
        {
          id: 'gpt-5.6-sol',
          name: 'gpt-5.6-sol',
          description: 'GPT-5.6 Sol - flagship tier for complex reasoning and coding',
          contextWindow: 1050000,
          maxOutput: 128000,
          features: ['advanced_reasoning', 'agentic_coding'],
        },
        {
          id: 'gpt-5.6-luna',
          name: 'gpt-5.6-luna',
          description: 'GPT-5.6 Luna - high-volume, cost-sensitive workloads',
          contextWindow: 1050000,
          maxOutput: 128000,
        },
        {
          id: 'gpt-5.3-codex',
          name: 'gpt-5.3-codex',
          description: 'GPT-5.3 Codex - agentic coding model',
          features: ['agentic_coding'],
        },
        {
          id: 'gpt-5.5',
          name: 'gpt-5.5',
          description: 'GPT-5.5 - previous flagship generation',
          contextWindow: 400000,
        },
        {
          id: 'gpt-5.4-nano',
          name: 'gpt-5.4-nano',
          description: 'GPT-5.4 Nano - lightweight tier for simple tasks',
        },
      ]
    }
  }

  // All common methods now provided by mixins:
  // - validateModelAvailability() from ModelValidationMixin
  // - testConnection() from ConnectionTestMixin
  // - getCapabilities() from CapabilitiesMixin
  // - getModelRecommendation() from ModelRecommendationMixin
  // - selectOptimalModel() from ModelRecommendationMixin
  // - getProviderModelConfig() from ConfigurationMixin
}

// Apply mixins to add standard provider functionality
export default applyMixins ? applyMixins(OpenAIProvider, 'openai') : OpenAIProvider
