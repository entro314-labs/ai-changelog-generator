import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity'
import { AzureOpenAI } from 'openai'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins, ProviderResponseHandler } from '../utils/base-provider-helpers.js'

class AzureOpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.azureClient = null
    this._cachedDeployments = null
    this._deploymentsCacheTime = 0
    // Only initialize if properly configured
    if (this.isAvailable()) {
      try {
        this.initializeClient()
      } catch (error) {
        // Don't throw during construction, just log
        console.warn(`Azure provider initialization warning: ${error.message}`)
      }
    }
  }

  initializeClient() {
    // Check if using API key or Azure AD authentication
    if (this.config.AZURE_USE_AD_AUTH === 'true') {
      try {
        const credential = new DefaultAzureCredential()
        const azureADTokenProvider = getBearerTokenProvider(
          credential,
          'https://cognitiveservices.azure.com/.default'
        )

        this.azureClient = new AzureOpenAI({
          azureADTokenProvider,
          apiVersion: this.config.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
          endpoint: this.config.AZURE_OPENAI_ENDPOINT,
          timeout: 30000, // Reduced timeout for individual requests
          maxRetries: 2, // Add retry logic
          defaultQuery: { 'api-version': '2025-04-01-preview' },
        })
      } catch (error) {
        console.error('Failed to initialize Azure AD authentication:', error.message)
        // Fallback to API key if AD auth fails
        this.initializeWithApiKey()
      }
    } else {
      this.initializeWithApiKey()
    }
  }

  initializeWithApiKey() {
    this.azureClient = new AzureOpenAI({
      apiKey: this.config.AZURE_OPENAI_KEY,
      apiVersion: this.config.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
      endpoint: this.config.AZURE_OPENAI_ENDPOINT,
      timeout: 30000, // Reduced timeout for individual requests
      maxRetries: 2, // Add retry logic
      defaultQuery: { 'api-version': '2025-04-01-preview' },
    })
  }

  getName() {
    return 'azure'
  }

  isAvailable() {
    const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_USE_AD_AUTH } = this.config
    // Must have endpoint, and either API key or AD auth enabled
    const hasEndpoint = AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_ENDPOINT.trim() !== ''
    const hasAuth =
      (AZURE_OPENAI_KEY && AZURE_OPENAI_KEY.trim() !== '') || AZURE_USE_AD_AUTH === 'true'
    return hasEndpoint && hasAuth
  }

  async generateCompletion(messages, options = {}) {
    return ProviderResponseHandler.executeWithErrorHandling(
      this,
      'generate_completion',
      async () => {
        const modelConfig = this.getProviderModelConfig()

        // In Azure, the model is the deployment name.
        const deploymentName =
          options.model || this.config.AZURE_OPENAI_DEPLOYMENT_NAME || modelConfig.standardModel
        if (!deploymentName) {
          throw new Error(
            'Azure deployment name is not configured. Please set AZURE_OPENAI_DEPLOYMENT_NAME or pass a model (deployment name) in the options'
          )
        }

        const params = {
          model: deploymentName,
          messages,
          max_tokens: options.max_tokens || 2000, // Reduced for faster responses
          temperature: options.temperature || 0.3,
          user: options.user || this.config.AZURE_USER_ID,
        }

        // Add tool calling if provided
        if (options.tools) {
          params.tools = options.tools
          params.tool_choice = options.tool_choice || 'auto'
        }

        // Add data sources for Azure-specific features like "On Your Data"
        if (options.dataSources) {
          params.data_sources = options.dataSources
        }

        // Add streaming if requested
        if (options.stream) {
          params.stream = true
          const stream = await this.azureClient.chat.completions.create(params)
          return { stream, model: deploymentName }
        }

        // Add additional timeout wrapper for better control
        const completion = await Promise.race([
          this.azureClient.chat.completions.create(params),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout after 25 seconds')), 25000)
          ),
        ])

        if (!(completion.choices?.length > 0 && completion.choices[0]?.message?.content)) {
          const finishReason = completion.choices?.[0]?.finish_reason
          const errorMsg =
            finishReason === 'length'
              ? `Response truncated due to token limit (max_tokens: ${params.max_tokens}). Consider increasing max_tokens or reducing prompt size.`
              : 'Empty response from Azure API'
          throw new Error(errorMsg)
        }

        const content = completion.choices[0].message.content
        const finishReason = completion.choices[0].finish_reason

        // Warn if response was truncated but still return the partial content
        if (finishReason === 'length') {
          console.warn(
            `⚠️  Azure response truncated due to token limit (${params.max_tokens}). Response may be incomplete.`
          )
        }

        // Extract Azure-specific content filter results if present
        let contentFilters = null
        if (completion.choices[0].content_filter_results) {
          contentFilters = completion.choices[0].content_filter_results
        }

        return {
          content,
          model: completion.model,
          tokens: completion.usage.total_tokens,
          usage: {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          },
          finish_reason: finishReason,
          tool_calls: completion.choices[0].message.tool_calls,
          content_filters: contentFilters,
        }
      },
      { model: options.model }
    )
  }

  // Azure-specific helper methods
  getDeploymentName() {
    return this.config.AZURE_OPENAI_DEPLOYMENT_NAME || this.getProviderModelConfig().standardModel
  }

  getModelContextWindow(modelName) {
    const contextWindows = {
      // Latest 2025 models (Azure exclusive)
      o4: 500000,
      'o4-mini': 200000,
      o3: 300000,
      'o3-mini': 150000,
      // Standard 2025 models
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      o1: 200000,
      'o1-mini': 128000,
      'gpt-4.1': 200000,
      'gpt-4.1-mini': 200000,
      'gpt-4.1-nano': 200000,
      // Legacy models
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo': 128000,
      'gpt-35-turbo': 4096,
      'gpt-35-turbo-16k': 16384,
    }
    return contextWindows[modelName] || 128000
  }

  getModelCapabilities(modelName) {
    return {
      reasoning:
        modelName.includes('o1') ||
        modelName.includes('o3') ||
        modelName.includes('o4') ||
        modelName.includes('gpt-4'),
      function_calling: !(
        modelName.includes('o1') ||
        modelName.includes('o3') ||
        modelName.includes('o4')
      ), // o-series models don't support function calling
      json_mode: true,
      multimodal: modelName.includes('gpt-4o') || modelName.includes('gpt-4.1'),
      largeContext:
        modelName.includes('4.1') ||
        modelName.includes('o1') ||
        modelName.includes('o3') ||
        modelName.includes('o4') ||
        modelName.includes('4o'),
      promptCaching: modelName.includes('4.1'),
      advancedReasoning: modelName.includes('o3') || modelName.includes('o4'),
      azureExclusive: modelName.includes('o3') || modelName.includes('o4'),
    }
  }

  // Azure-specific method for testing deployment availability
  async testDeployment(deploymentName) {
    try {
      const response = await this.azureClient.chat.completions.create({
        model: deploymentName,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
      })

      return {
        success: true,
        deployment: deploymentName,
        model: response.model,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        deployment: deploymentName,
      }
    }
  }

  // Get available deployments by testing common model names
  async getAvailableModels() {
    if (!this.isAvailable()) {
      return []
    }

    // Cache the result to avoid repeated API calls
    if (this._cachedDeployments && Date.now() - this._deploymentsCacheTime < 300000) {
      // 5 min cache
      return this._cachedDeployments
    }

    // Get base config directly to avoid recursion
    const baseConfig = {
      commonDeployments: ['o4', 'o3', 'gpt-4.1', 'gpt-4o', 'gpt-35-turbo', 'o1'],
      fallbacks: ['gpt-4.1', 'gpt-4o', 'o1', 'gpt-35-turbo'],
    }

    const potentialDeployments = [
      // User configured deployment
      this.config.AZURE_OPENAI_DEPLOYMENT_NAME,
      // Common deployment names
      ...baseConfig.commonDeployments,
      // Fallback models
      ...baseConfig.fallbacks,
    ]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates

    const availableDeployments = []

    // Test each potential deployment in parallel (but limit concurrency)
    const testPromises = potentialDeployments.slice(0, 8).map(async (deployment) => {
      const result = await this.testDeployment(deployment)
      if (result.success) {
        availableDeployments.push(deployment)
      }
      return result
    })

    try {
      await Promise.allSettled(testPromises)

      // Cache the result
      this._cachedDeployments = availableDeployments
      this._deploymentsCacheTime = Date.now()

      if (availableDeployments.length === 0) {
        console.warn('⚠️  No Azure deployments found. Using configured deployment name as fallback.')
        // Fallback to configured deployment even if untested, preferring latest models
        const fallback = this.config.AZURE_OPENAI_DEPLOYMENT_NAME || 'o4' || 'gpt-4.1'
        return [fallback]
      }

      return availableDeployments
    } catch (error) {
      console.warn('⚠️  Failed to detect Azure deployments:', error.message)
      // Return common deployments as fallback
      return baseConfig.commonDeployments
    }
  }

  // Force refresh of available deployments
  async refreshAvailableModels() {
    this._cachedDeployments = null
    this._deploymentsCacheTime = 0
    return await this.getAvailableModels()
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins(AzureOpenAIProvider, 'azure')
