import { OpenAI } from 'openai'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins, ProviderResponseHandler } from '../utils/base-provider-helpers.js'

export class OpenAIProvider extends BaseProvider {
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
        const params = {
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

  async generateText(messages, model = null) {
    const response = await this.generateCompletion(messages, { model })
    return response
  }

  async getAvailableModels() {
    try {
      const models = await this.openai.models.list()
      return models.data
        .filter(
          (m) =>
            m.id.includes('gpt') ||
            m.id.includes('o1') ||
            m.id.includes('o3') ||
            m.id.includes('o4')
        )
        .map((m) => ({
          name: m.id,
          id: m.id,
          description: `OpenAI ${m.id}`,
        }))
    } catch (_error) {
      // Return known models as fallback (GPT-5.x series, December 2025)
      return [
        {
          id: 'gpt-5.2',
          name: 'gpt-5.2',
          description: 'GPT-5.2 - Flagship model for coding and agentic tasks (Dec 2025)',
          contextWindow: 400000,
          maxOutput: 128000,
        },
        {
          id: 'gpt-5.2-codex',
          name: 'gpt-5.2-codex',
          description: 'GPT-5.2-Codex - Most advanced agentic coding model',
          features: ['agentic_coding', 'context_compaction', 'cybersecurity'],
        },
        {
          id: 'gpt-5',
          name: 'gpt-5',
          description: 'GPT-5 - General purpose flagship model',
          contextWindow: 272000,
        },
        {
          id: 'gpt-5-mini',
          name: 'gpt-5-mini',
          description: 'GPT-5 Mini - Smaller, faster GPT-5 variant',
        },
        {
          id: 'gpt-5-nano',
          name: 'gpt-5-nano',
          description: 'GPT-5 Nano - Lightweight for high-volume tasks',
        },
        {
          id: 'o4',
          name: 'o4',
          description: 'o4 - Latest reasoning model',
          features: ['advanced_reasoning'],
        },
        {
          id: 'o4-mini',
          name: 'o4-mini',
          description: 'o4-mini - Cost-effective reasoning model',
          features: ['advanced_reasoning', 'cost_effective'],
        },
        {
          id: 'gpt-4.1',
          name: 'gpt-4.1',
          description: 'GPT-4.1 - Previous generation with 1M context',
          contextWindow: 1000000,
          features: ['prompt_caching', 'cost_reduction'],
        },
        {
          id: 'gpt-4o',
          name: 'gpt-4o',
          description: 'GPT-4o - Multimodal previous generation',
          features: ['vision', 'multimodal'],
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
