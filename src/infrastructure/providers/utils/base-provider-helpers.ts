/**
 * Helper functions that can be mixed into provider classes
 * Reduces code duplication by providing common implementations
 */

import {
  analyzeCommitComplexity,
  getBestModelForCapabilities,
  getModelCapabilities,
  getProviderModelConfig,
  getSuggestedModels,
  MODEL_CONFIGS,
  normalizeModelName,
  type ResolvedProviderModelConfig,
} from './model-config.js'
import {
  buildClientOptions,
  createProviderErrorResponse,
  createProviderSuccessResponse,
  extractProviderConfig,
  selectModelByComplexity,
  standardConnectionTest,
  validateModelWithFallbacks,
} from './provider-utils.js'
import type {
  ProviderConfig,
  ProviderModelDescriptor,
  ProviderResult,
} from '../core/base-provider.js'

interface ProviderCapabilities extends Record<string, boolean | number | string | undefined> {
  isHubProvider?: boolean
  availableInHub?: boolean
}

interface ProviderHelperHost {
  config: ProviderConfig
  isAvailable(): boolean
  generateCompletion(...args: any[]): Promise<ProviderResult>
  getAvailableModels?(): ProviderModelDescriptor[] | Promise<ProviderModelDescriptor[]>
  refreshAvailableModels?(): Promise<void>
  getModelRecommendation?(commitDetails: any): any
  getProviderInfo?(): string | Record<string, any>
  getCapabilities(modelName?: string): ProviderCapabilities
  getName?(): string
  testConnection?(): Promise<ProviderResult>
  testModel?(modelName: string): Promise<ProviderResult>
  getProviderConfig?(): Record<string, any>
  getProviderModelConfig?(): ResolvedProviderModelConfig | Record<string, any>
  buildClientOptions?(extraDefaults?: Record<string, any>): Record<string, any>
  handleProviderError(
    error: Error,
    operation: string,
    context?: Record<string, any>
  ): ProviderResult
  initializeClient?(): void | Promise<boolean | ProviderResult>
}

function getSyncAvailableModels(host: ProviderHelperHost): ProviderModelDescriptor[] {
  if (!host.getAvailableModels) {
    return []
  }

  const availableModels = host.getAvailableModels()
  return Array.isArray(availableModels) ? availableModels : []
}

async function getAvailableModels(host: ProviderHelperHost): Promise<ProviderModelDescriptor[]> {
  if (!host.getAvailableModels) {
    return []
  }

  const availableModels = await host.getAvailableModels()
  return Array.isArray(availableModels) ? availableModels : []
}

function getModelIds(models: ProviderModelDescriptor[]): string[] {
  return models
    .map((model) => {
      if (typeof model === 'string') {
        return model
      }
      if (typeof model.id === 'string') {
        return model.id
      }
      if (typeof model.name === 'string') {
        return model.name
      }
      return null
    })
    .filter((modelId): modelId is string => typeof modelId === 'string')
}

// Provider utility functions
function isHubProvider(providerName) {
  const config = MODEL_CONFIGS[providerName]
  return config && config.isHub === true
}

function selectHubModel(providerName, complexity = 'standard', availableModels: any[] = []) {
  const modelConfig = getProviderModelConfig(providerName)
  if (!modelConfig) {
    return null
  }

  const modelKey =
    {
      simple: 'smallModel',
      standard: 'standardModel',
      medium: 'mediumModel',
      complex: 'complexModel',
    }[complexity] || 'standardModel'

  const preferredModel = modelConfig[modelKey]

  // If we have available models list, check if preferred model exists
  if (Array.isArray(availableModels) && availableModels.length > 0) {
    if (availableModels.includes(preferredModel)) {
      return preferredModel
    }

    // Try fallbacks
    for (const fallback of modelConfig.fallbacks || []) {
      if (availableModels.includes(fallback)) {
        return fallback
      }
    }

    // Return first available model if nothing else matches
    return availableModels[0]
  }

  return preferredModel
}

/**
 * Mixin that provides enhanced model recommendation logic with hub support
 * @param {string} providerName - Name of the provider
 * @returns {Object} Mixin methods
 */
export function ModelRecommendationMixin(providerName) {
  return {
    getModelRecommendation(this: ProviderHelperHost, commitDetails) {
      // Get available models for hub providers
      const availableModels = getModelIds(getSyncAvailableModels(this))
      const modelConfig = getProviderModelConfig(providerName, this.config, availableModels)

      // Use enhanced complexity analysis
      const complexityAnalysis = analyzeCommitComplexity(commitDetails, providerName)

      // For hub providers, use specialized selection logic
      if (isHubProvider(providerName)) {
        const selectedModel = selectHubModel(
          providerName,
          complexityAnalysis.complexity,
          availableModels
        )
        return {
          model: selectedModel,
          complexity: complexityAnalysis.complexity,
          reasoning: complexityAnalysis.reasoning,
          isHubProvider: true,
          availableModels: availableModels.length,
        }
      }

      // Standard provider logic
      return selectModelByComplexity(commitDetails, modelConfig)
    },

    async selectOptimalModel(this: ProviderHelperHost, commitDetails) {
      // Enhanced async version with hub awareness
      if (isHubProvider(providerName)) {
        // Try to refresh available models for hub providers
        if (this.refreshAvailableModels) {
          try {
            await this.refreshAvailableModels()
          } catch (error) {
            // Continue with cached models if refresh fails
            console.warn(`Failed to refresh models for ${providerName}:`, error.message)
          }
        }
      }

      return this.getModelRecommendation?.(commitDetails) ?? null
    },

    async selectModelForCapabilities(this: ProviderHelperHost, requiredCapabilities: any[] = []) {
      return getBestModelForCapabilities(providerName, requiredCapabilities, this.config)
    },
  }
}

/**
 * Mixin that provides standard connection testing
 * @param {string} providerName - Name of the provider
 * @returns {Object} Mixin methods
 */
export function ConnectionTestMixin(providerName) {
  return {
    async testConnection(this: ProviderHelperHost) {
      if (!this.isAvailable()) {
        return createProviderErrorResponse(
          providerName,
          'connection_test',
          `${providerName} provider is not configured`,
          [`Configure ${providerName.toUpperCase()}_API_KEY`]
        )
      }

      const modelConfig = getProviderModelConfig(providerName, this.config)
      const defaultModel = normalizeModelName(providerName, modelConfig.standardModel)

      const result = await standardConnectionTest(this.generateCompletion.bind(this), defaultModel)

      if (result.success) {
        return createProviderSuccessResponse(providerName, {
          response: result.response,
          model: result.model,
          provider_info: this.getProviderInfo ? this.getProviderInfo() : {},
        })
      }
      return createProviderErrorResponse(
        providerName,
        'connection_test',
        result.error,
        modelConfig.fallbacks
      )
    },
  }
}

/**
 * Mixin that provides standard model validation
 * @param {string} providerName - Name of the provider
 * @returns {Object} Mixin methods
 */
export function ModelValidationMixin(providerName) {
  return {
    async validateModelAvailability(this: ProviderHelperHost, modelName) {
      if (!this.isAvailable()) {
        return createProviderErrorResponse(
          providerName,
          'model_validation',
          `${providerName} provider is not configured`,
          [`Configure ${providerName.toUpperCase()}_API_KEY`]
        )
      }

      const normalizedModel = normalizeModelName(providerName, modelName)
      const availableModels = getModelIds(await getAvailableModels(this))
      const fallbacks = getSuggestedModels(providerName, normalizedModel)

      // For hub providers, check if model is in available list first
      if (
        isHubProvider(providerName) &&
        Array.isArray(availableModels) &&
        availableModels.length > 0 &&
        !availableModels.includes(normalizedModel)
      ) {
        return createProviderErrorResponse(
          providerName,
          'model_validation',
          `Model '${normalizedModel}' not found in available deployments`,
          fallbacks
        )
      }

      // Use provider-specific model testing if available
      if (this.testModel) {
        return validateModelWithFallbacks(this.testModel.bind(this), normalizedModel, fallbacks)
      }

      // Fallback to basic connection test with the model
      try {
        const result = await standardConnectionTest(
          this.generateCompletion.bind(this),
          normalizedModel
        )

        if (result.success) {
          return createProviderSuccessResponse(providerName, {
            model: normalizedModel,
            capabilities: this.getCapabilities(normalizedModel),
            isHubProvider: isHubProvider(providerName),
            availableModels: availableModels.length,
          })
        }
        return createProviderErrorResponse(
          providerName,
          'model_validation',
          result.error,
          fallbacks
        )
      } catch (error) {
        return createProviderErrorResponse(
          providerName,
          'model_validation',
          error.message,
          fallbacks
        )
      }
    },
  }
}

/**
 * Mixin that provides standard capabilities lookup
 * @param {string} providerName - Name of the provider
 * @returns {Object} Mixin methods
 */
export function CapabilitiesMixin(providerName) {
  return {
    getCapabilities(this: ProviderHelperHost, modelName): ProviderCapabilities {
      const availableModels = getModelIds(getSyncAvailableModels(this))
      const modelConfig = getProviderModelConfig(providerName, this.config, availableModels)

      const model =
        modelName ||
        this.config.AI_MODEL ||
        this.config[`${providerName.toUpperCase()}_MODEL`] ||
        modelConfig.standardModel

      const normalizedModel = normalizeModelName(providerName, model)
      const capabilities = {
        ...getModelCapabilities(normalizedModel),
      } as ProviderCapabilities

      // Add provider-specific metadata
      if (isHubProvider(providerName)) {
        capabilities.isHubProvider = true
        capabilities.availableInHub =
          !Array.isArray(availableModels) ||
          availableModels.length === 0 ||
          availableModels.includes(normalizedModel)
      }

      return capabilities
    },

    /**
     * Enhanced capability testing - tests actual provider functionality
     * @param {Object} options - Test options
     * @returns {Promise<Object>} Detailed capability test results
     */
    async testCapabilities(this: ProviderHelperHost, options: Record<string, any> = {}) {
      const results: {
        available: boolean
        connection: boolean
        modelAccess: boolean
        capabilities: Record<string, any>
        errors: string[]
        performance: {
          connectionTime?: number
          modelResponseTime?: number
          tokensGenerated?: number
        }
        tested_at: string
      } = {
        available: false,
        connection: false,
        modelAccess: false,
        capabilities: {},
        errors: [],
        performance: {},
        tested_at: new Date().toISOString(),
      }

      try {
        // Test 1: Basic availability
        results.available = this.isAvailable()
        if (!results.available) {
          results.errors.push('Provider not available - check configuration')
          return results
        }

        // Test 2: Connection test
        if (this.testConnection) {
          const startTime = Date.now()
          try {
            await this.testConnection()
            results.connection = true
            results.performance.connectionTime = Date.now() - startTime
          } catch (error) {
            results.errors.push(`Connection test failed: ${error.message}`)
          }
        }

        // Test 3: Model access test
        if (options.testModel !== false) {
          try {
            const testStartTime = Date.now()
            const testResponse = await ProviderResponseHandler.executeWithErrorHandling(
              this,
              'test_model_access',
              async () => {
                return await this.generateCompletion(
                  [{ role: 'user', content: 'Test message - respond with "OK"' }],
                  { max_tokens: 10 }
                )
              }
            )

            if (testResponse && !testResponse.error) {
              results.modelAccess = true
              results.performance.modelResponseTime = Date.now() - testStartTime
              results.performance.tokensGenerated =
                'tokens' in testResponse && typeof testResponse.tokens === 'number'
                  ? testResponse.tokens
                  : 0
            } else {
              results.errors.push(`Model test failed: ${testResponse.error || 'Unknown error'}`)
            }
          } catch (error) {
            results.errors.push(`Model access test failed: ${error.message}`)
          }
        }

        // Test 4: Get detailed capabilities
        try {
          results.capabilities = this.getCapabilities(options.model)
        } catch (error) {
          results.errors.push(`Capabilities detection failed: ${error.message}`)
        }
      } catch (error) {
        results.errors.push(`Capability testing failed: ${error.message}`)
      }

      return results
    },

    /**
     * Quick health check - lightweight version of testCapabilities
     * @returns {Promise<Object>} Basic health status
     */
    async quickHealthCheck(this: ProviderHelperHost) {
      const health: {
        status: string
        available: boolean
        configured: boolean
        timestamp: string
        error?: string
      } = {
        status: 'unknown',
        available: false,
        configured: false,
        timestamp: new Date().toISOString(),
      }

      try {
        health.available = this.isAvailable()
        health.configured = Boolean(this.getName && this.config)

        if (health.available && health.configured) {
          health.status = 'healthy'
        } else if (health.configured) {
          health.status = 'configured_but_unavailable'
        } else {
          health.status = 'not_configured'
        }
      } catch (error) {
        health.status = 'error'
        health.error = error.message
      }

      return health
    },

    getSimilarModels(this: ProviderHelperHost, modelName, providedAvailableModels: any[] = []) {
      // Use provider's available models if not provided
      const availableModels =
        providedAvailableModels.length > 0
          ? providedAvailableModels
          : getModelIds(getSyncAvailableModels(this))

      // Enhanced similarity matching for hub providers
      if (
        isHubProvider(providerName) &&
        Array.isArray(availableModels) &&
        availableModels.length > 0
      ) {
        const modelFamily = modelName.split('-')[0] || modelName.split('.')[0] // e.g., 'gpt', 'claude', 'gemini', 'anthropic'
        const familyModels = availableModels
          .filter((m) => m.includes(modelFamily) && m !== modelName)
          .slice(0, 3)

        // If no family matches, get models from the same capability tier
        if (familyModels.length === 0) {
          const modelCapabilities = getModelCapabilities(modelName)
          const similarCapabilityModels = availableModels
            .filter((m) => {
              const caps = getModelCapabilities(m)
              return (
                caps.reasoning === modelCapabilities.reasoning &&
                caps.large_context === modelCapabilities.large_context
              )
            })
            .slice(0, 3)
          return similarCapabilityModels
        }

        return familyModels
      }

      // Standard provider logic with enhanced suggestions
      return getSuggestedModels(providerName, modelName)
    },
  }
}

/**
 * Mixin that provides standard configuration handling
 * @param {string} providerName - Name of the provider
 * @param {Object} defaults - Default configuration values
 * @returns {Object} Mixin methods
 */
export function ConfigurationMixin(providerName, defaults: Record<string, any> = {}) {
  return {
    getProviderConfig(this: ProviderHelperHost) {
      return extractProviderConfig(this.config, providerName.toUpperCase(), defaults)
    },

    getProviderModelConfig(this: ProviderHelperHost) {
      const availableModels = getModelIds(getSyncAvailableModels(this))
      return getProviderModelConfig(providerName, this.config, availableModels)
    },

    buildClientOptions(this: ProviderHelperHost, extraDefaults: Record<string, any> = {}) {
      const providerConfig = this.getProviderConfig?.() || {}
      return buildClientOptions(providerConfig, { ...defaults, ...extraDefaults })
    },

    getRequiredEnvVars() {
      // Fallback for providers that authenticate with a plain <PROVIDER>_API_KEY.
      // Providers with a different credential shape (Ollama's OLLAMA_HOST, Copilot's
      // GITHUB_COPILOT_TOKEN, Bedrock's AWS chain, the gateway's AI_GATEWAY_API_KEY)
      // declare their own; applyMixins keeps those.
      const baseKey = `${providerName.toUpperCase()}_API_KEY`
      return [baseKey]
    },

    getDefaultModel(this: ProviderHelperHost) {
      const modelConfig =
        this.getProviderModelConfig?.() || getProviderModelConfig(providerName, this.config)
      return modelConfig.standardModel || 'unknown'
    },

    getProviderInfo(this: ProviderHelperHost) {
      const providerConfig = this.getProviderConfig?.() || {}
      const availableModels = getModelIds(getSyncAvailableModels(this))
      const modelConfig = getProviderModelConfig(providerName, this.config, availableModels)

      const info: {
        name: string
        configured: boolean
        config_keys: string[]
        default_model: string
        isHub: boolean
        hubInfo?: {
          availableModels: number
          supportedProviders: string[]
          defaultProvider?: string
          canDetectDeployments: boolean
          sampleModels?: string[]
        }
      } = {
        name: providerName,
        configured: this.isAvailable(),
        config_keys: Object.keys(providerConfig).filter((k) => providerConfig[k]),
        default_model: modelConfig.standardModel || 'unknown',
        isHub: isHubProvider(providerName),
      }

      // Add hub-specific information
      if (isHubProvider(providerName)) {
        info.hubInfo = {
          availableModels: availableModels.length,
          supportedProviders: modelConfig.hubInfo?.supportedProviders || [],
          defaultProvider: modelConfig.hubInfo?.defaultProvider,
          canDetectDeployments: !!(this.getAvailableModels || this.refreshAvailableModels),
        }

        if (availableModels.length > 0) {
          info.hubInfo.sampleModels = availableModels.slice(0, 3)
        }
      }

      return info
    },
  }
}

/**
 * Unified Provider Response Handler
 * Centralizes common patterns across all providers for consistency and maintainability
 */
export class ProviderResponseHandler {
  [key: string]: any
  /**
   * Execute provider operation with standardized error handling and availability checking
   * @param {Object} provider - Provider instance
   * @param {string} operation - Operation name (e.g., 'generate_completion')
   * @param {Function} operationFn - Function to execute the operation
   * @param {Object} context - Additional context for error handling
   * @returns {Promise<Object>} Standardized response
   */
  static async executeWithErrorHandling(
    provider: ProviderHelperHost,
    operation: string,
    operationFn: () => Promise<Record<string, any>>,
    context: Record<string, any> = {}
  ) {
    // Check availability first
    if (!provider.isAvailable()) {
      return ProviderResponseHandler.createUnavailableResponse(
        provider.getName?.() || 'provider',
        operation
      )
    }

    try {
      return await operationFn()
    } catch (error) {
      return provider.handleProviderError(error, operation, context)
    }
  }

  /**
   * Create standardized unavailable response
   * @param {string} providerName - Name of the provider
   * @param {string} operation - Operation that was attempted
   * @returns {Object} Error response
   */
  static createUnavailableResponse(providerName: string, operation: string) {
    return createProviderErrorResponse(
      providerName,
      operation,
      `${providerName} provider is not configured`,
      [`Configure ${providerName.toUpperCase()}_API_KEY and other required settings`]
    )
  }

  /**
   * Execute multiple provider operations in sequence with unified error handling
   * @param {Object} provider - Provider instance
   * @param {Array} operations - Array of {name, fn, context} operations
   * @returns {Promise<Array>} Array of results
   */
  static async executeMultiple(
    provider: ProviderHelperHost,
    operations: Array<{
      name: string
      fn: () => Promise<Record<string, any>>
      context?: Record<string, any>
    }>
  ) {
    const results: any[] = []
    for (const op of operations) {
      const result = await ProviderResponseHandler.executeWithErrorHandling(
        provider,
        op.name,
        op.fn,
        op.context
      )
      results.push(result)
      // Stop on first error if any operation fails
      if (result.error) {
        break
      }
    }
    return results
  }
}

/**
 * Mixin that provides standard error handling for providers
 * @param {string} providerName - Name of the provider
 * @returns {Object} Mixin methods
 */
export function ErrorHandlingMixin(providerName) {
  return {
    handleProviderError(
      this: ProviderHelperHost,
      error,
      operation,
      context: Record<string, any> = {}
    ) {
      // Common error patterns and their standardized responses
      if (error.message.includes('API key') || error.message.includes('401')) {
        return createProviderErrorResponse(providerName, operation, 'Invalid or missing API key', [
          `Check ${providerName.toUpperCase()}_API_KEY configuration`,
        ])
      }

      if (error.message.includes('model') && error.message.includes('not found')) {
        const availableModels = getModelIds(getSyncAvailableModels(this))
        const _modelConfig = getProviderModelConfig(providerName, this.config, availableModels)
        const fallbacks = getSuggestedModels(providerName, context.model)

        let errorMessage = `Model not available: ${context.model}`
        if (
          isHubProvider(providerName) &&
          Array.isArray(availableModels) &&
          availableModels.length > 0
        ) {
          errorMessage += ` (Available models: ${availableModels.length})`
        }

        return createProviderErrorResponse(providerName, operation, errorMessage, fallbacks)
      }

      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return createProviderErrorResponse(providerName, operation, 'Rate limit exceeded', [
          'Wait before retrying',
          'Consider upgrading API plan',
        ])
      }

      if (error.message.includes('timeout')) {
        return createProviderErrorResponse(providerName, operation, 'Request timeout', [
          'Increase timeout setting',
          'Try again later',
        ])
      }

      // Generic error response
      return createProviderErrorResponse(providerName, operation, error.message, [
        'Check provider configuration',
        'Verify network connectivity',
      ])
    },
  }
}

/**
 * Apply multiple mixins to a provider class.
 *
 * Mixins fill in behaviour a provider has NOT defined; they never replace it.
 * A plain `Object.assign` onto the prototype would overwrite the class body,
 * which silently disabled every provider-specific `getRequiredEnvVars`,
 * `getDefaultModel`, `getCapabilities`, `getProviderModelConfig`,
 * `getProviderInfo`, `testConnection` and `validateModelAvailability` in the
 * codebase — the opposite of what "providers should override if needed" implies.
 *
 * Own properties of the class prototype therefore win. Later mixins still fill
 * gaps left by earlier ones, so mixin ordering is unchanged for anything a
 * provider does not implement itself.
 *
 * @param {Function} ProviderClass - The provider class to enhance
 * @param {string} providerName - Name of the provider
 * @param {Array<Function>} mixins - Array of mixin functions to apply
 * @returns {Function} Enhanced provider class
 */
export function applyMixins(ProviderClass, providerName, mixins: any[] = []) {
  const defaultMixins = [
    ConfigurationMixin,
    ModelRecommendationMixin,
    ConnectionTestMixin,
    ModelValidationMixin,
    CapabilitiesMixin,
    ErrorHandlingMixin,
  ]

  const allMixins = [...defaultMixins, ...mixins]
  const prototype = ProviderClass.prototype

  for (const mixinFn of allMixins) {
    const methods = mixinFn(providerName)

    for (const [name, implementation] of Object.entries(
      Object.getOwnPropertyDescriptors(methods)
    )) {
      // Skip anything the provider (or an earlier mixin) already supplies.
      if (Object.hasOwn(prototype, name)) {
        continue
      }
      Object.defineProperty(prototype, name, implementation)
    }
  }

  return ProviderClass
}

/**
 * Create a standardized provider class with all common functionality
 * @param {string} providerName - Name of the provider
 * @param {Object} options - Provider-specific options
 * @returns {Function} Base provider class with mixins applied
 */
export function createEnhancedProvider(providerName, options: Record<string, any> = {}) {
  const { mixins = [] } = options

  class EnhancedProvider {
    [key: string]: any
    constructor(config: Record<string, any>) {
      this.config = config
      this.providerName = providerName

      // Initialize provider-specific client if available method exists
      if (this.initializeClient && this.isAvailable()) {
        this.initializeClient()
      }
    }

    getName() {
      return providerName
    }

    // These methods should be implemented by the specific provider
    isAvailable() {
      throw new Error('isAvailable() must be implemented by the provider')
    }

    async generateCompletion() {
      throw new Error('generateCompletion() must be implemented by the provider')
    }
  }

  // Apply all mixins
  return applyMixins(EnhancedProvider, providerName, mixins)
}
