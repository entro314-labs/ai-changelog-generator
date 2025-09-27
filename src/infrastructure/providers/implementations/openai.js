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
        .filter((m) => m.id.includes('gpt') || m.id.includes('o1'))
        .map((m) => ({
          name: m.id,
          id: m.id,
          description: `OpenAI ${m.id}`,
        }))
    } catch (_error) {
      return []
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
