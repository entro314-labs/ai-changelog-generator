/**
 * Azure OpenAI Provider for AI Changelog Generator
 * Supports both v1 unified API (August 2025+) and legacy API
 *
 * Authentication methods (in priority order):
 *
 * 1. v1 API with API Key (Recommended):
 *    OPENAI_API_KEY=your-key
 *    OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/v1/
 *    Uses standard OpenAI client - same code works for OpenAI and Azure
 *
 * 2. OAuth Token (from OAuth flow or external auth):
 *    AZURE_OAUTH_TOKEN=your-bearer-token
 *    Uses bearer token authentication
 *
 * 3. Azure AD Authentication (Managed Identity, Service Principal):
 *    AZURE_USE_AD_AUTH=true
 *    Uses DefaultAzureCredential for automatic token acquisition
 *
 * 4. Legacy API with API Key:
 *    AZURE_OPENAI_KEY=your-key
 *    AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
 *    AZURE_OPENAI_API_VERSION=2025-04-01-preview
 *    AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
 *    Uses AzureOpenAI client with api-version
 */

import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity'
import { AzureOpenAI, OpenAI } from 'openai'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins, ProviderResponseHandler } from '../utils/base-provider-helpers.js'
import { getProviderModelConfig } from '../utils/model-config.js'

/**
 * Authentication types for Azure provider
 */
const AzureAuthType = {
  API_KEY: 'api_key',
  API_KEY_V1: 'api_key_v1',
  OAUTH_TOKEN: 'oauth_token',
  AZURE_AD: 'azure_ad',
}

class AzureOpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.azureClient = null
    this._cachedDeployments = null
    this._deploymentsCacheTime = 0
    this._useV1Api = false
    this._authType = null
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

  /**
   * Get the current authentication type
   * @returns {string|null}
   */
  getAuthType() {
    return this._authType
  }

  /**
   * Get authentication info for display
   * @returns {Object}
   */
  getAuthInfo() {
    return {
      type: this._authType,
      v1Api: this._useV1Api,
      endpoint: this.config.AZURE_OPENAI_ENDPOINT || this.config.OPENAI_BASE_URL,
      valid: this.isAvailable(),
    }
  }

  /**
   * Get provider information including auth details
   * @returns {string}
   */
  getProviderInfo() {
    const authInfo = this.getAuthInfo()
    const authDetails = authInfo.type
      ? `auth: ${authInfo.type}${authInfo.v1Api ? ' (v1 API)' : ''}`
      : 'not configured'
    return `Azure OpenAI Provider (${authDetails})`
  }

  /**
   * Set OAuth token manually (for external OAuth flows)
   * @param {string} token - Bearer token
   */
  setOAuthToken(token) {
    this.config.AZURE_OAUTH_TOKEN = token
    this._cachedDeployments = null
    this.initializeClient()
  }

  /**
   * Detect if using v1 unified API
   * v1 API uses OPENAI_BASE_URL with /openai/v1/ suffix
   */
  isUsingV1Api() {
    const baseUrl = this.config.OPENAI_BASE_URL || ''
    return (
      baseUrl.includes('/openai/v1') ||
      baseUrl.includes('.openai.azure.com/openai/v1') ||
      baseUrl.includes('.services.ai.azure.com/openai/v1') ||
      this.config.AZURE_USE_V1_API === 'true'
    )
  }

  initializeClient() {
    this._useV1Api = this.isUsingV1Api()

    // Priority 1: v1 Unified API with API key
    if (this._useV1Api && this.config.OPENAI_BASE_URL && this.config.OPENAI_API_KEY) {
      this.initializeV1Client()
      this._authType = AzureAuthType.API_KEY_V1
      return
    }

    // Priority 2: OAuth token (from OAuth flow or credential detection)
    if (this.config.AZURE_OAUTH_TOKEN) {
      this.initializeWithOAuthToken()
      this._authType = AzureAuthType.OAUTH_TOKEN
      return
    }

    // Priority 3: Azure AD authentication (Managed Identity, Service Principal)
    if (this.config.AZURE_USE_AD_AUTH === 'true') {
      this.initializeWithAzureAD()
      this._authType = AzureAuthType.AZURE_AD
      return
    }

    // Priority 4: Legacy API with API key
    if (this.config.AZURE_OPENAI_KEY) {
      this.initializeWithApiKey()
      this._authType = AzureAuthType.API_KEY
      return
    }
  }

  /**
   * Initialize with OAuth token (bearer token)
   */
  initializeWithOAuthToken() {
    const token = this.config.AZURE_OAUTH_TOKEN

    // For v1 API with OAuth token
    if (this._useV1Api && this.config.OPENAI_BASE_URL) {
      this.azureClient = new OpenAI({
        apiKey: token, // OpenAI client uses apiKey field for bearer token
        baseURL: this.config.OPENAI_BASE_URL,
        timeout: 30000,
        maxRetries: 2,
        defaultHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
      return
    }

    // For legacy API with OAuth token
    // Create a custom token provider that returns the static token
    const staticTokenProvider = async () => token

    this.azureClient = new AzureOpenAI({
      azureADTokenProvider: staticTokenProvider,
      apiVersion: this.config.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
      endpoint: this.config.AZURE_OPENAI_ENDPOINT,
      timeout: 30000,
      maxRetries: 2,
    })
  }

  /**
   * Initialize with v1 unified API (August 2025+)
   * Uses standard OpenAI client with baseURL
   */
  initializeV1Client() {
    const apiKey = this.config.OPENAI_API_KEY || this.config.AZURE_OPENAI_KEY
    const baseURL = this.config.OPENAI_BASE_URL

    this.azureClient = new OpenAI({
      apiKey,
      baseURL,
      timeout: 30000,
      maxRetries: 2,
    })
  }

  /**
   * Initialize with Azure AD authentication
   */
  initializeWithAzureAD() {
    try {
      const credential = new DefaultAzureCredential()
      const azureADTokenProvider = getBearerTokenProvider(
        credential,
        'https://cognitiveservices.azure.com/.default'
      )

      // Check if v1 API with token auth
      if (this._useV1Api && this.config.OPENAI_BASE_URL) {
        this.azureClient = new OpenAI({
          baseURL: this.config.OPENAI_BASE_URL,
          apiKey: azureADTokenProvider,
          timeout: 30000,
          maxRetries: 2,
        })
        return
      }

      // Legacy API with Azure AD
      this.azureClient = new AzureOpenAI({
        azureADTokenProvider,
        apiVersion: this.config.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
        endpoint: this.config.AZURE_OPENAI_ENDPOINT,
        timeout: 30000,
        maxRetries: 2,
      })
    } catch (error) {
      console.error('Failed to initialize Azure AD authentication:', error.message)
      // Fallback to API key if AD auth fails
      this.initializeWithApiKey()
    }
  }

  /**
   * Initialize with API key (legacy API)
   */
  initializeWithApiKey() {
    this.azureClient = new AzureOpenAI({
      apiKey: this.config.AZURE_OPENAI_KEY,
      apiVersion: this.config.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
      endpoint: this.config.AZURE_OPENAI_ENDPOINT,
      timeout: 30000,
      maxRetries: 2,
    })
  }

  getName() {
    return 'azure'
  }

  isAvailable() {
    // v1 API: OPENAI_BASE_URL with Azure endpoint + OPENAI_API_KEY
    const baseUrl = this.config.OPENAI_BASE_URL || ''
    const isAzureV1 =
      (baseUrl.includes('.openai.azure.com') || baseUrl.includes('.services.ai.azure.com')) &&
      (this.config.OPENAI_API_KEY || this.config.AZURE_OAUTH_TOKEN)

    if (isAzureV1) {
      return true
    }

    // OAuth token with endpoint
    const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_USE_AD_AUTH, AZURE_OAUTH_TOKEN } =
      this.config
    const hasEndpoint = AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_ENDPOINT.trim() !== ''

    // Auth options: API key, AD auth, or OAuth token
    const hasAuth =
      (AZURE_OPENAI_KEY && AZURE_OPENAI_KEY.trim() !== '') ||
      AZURE_USE_AD_AUTH === 'true' ||
      (AZURE_OAUTH_TOKEN && AZURE_OAUTH_TOKEN.trim() !== '')

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
    const modelConfig = this.getProviderModelConfig()
    return this.config.AZURE_OPENAI_DEPLOYMENT_NAME || modelConfig.standardModel
  }

  // Model capabilities now handled by centralized CapabilitiesMixin

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

    // Get model config from centralized system (avoiding circular dependency)
    const modelConfig = getProviderModelConfig('azure', this.config)

    const potentialDeployments = [
      // User configured deployment
      this.config.AZURE_OPENAI_DEPLOYMENT_NAME,
      // Models from config
      modelConfig.complexModel,
      modelConfig.standardModel,
      modelConfig.mediumModel,
      modelConfig.smallModel,
      // Fallback models
      ...modelConfig.fallbacks,
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
        // Fallback to configured deployment even if untested
        const fallback = this.config.AZURE_OPENAI_DEPLOYMENT_NAME || modelConfig.standardModel
        return [fallback]
      }

      return availableDeployments
    } catch (error) {
      console.warn('⚠️  Failed to detect Azure deployments:', error.message)
      // Return fallback models from config
      return modelConfig.fallbacks
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
