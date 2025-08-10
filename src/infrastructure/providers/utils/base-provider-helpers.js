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

// Provider utility functions
function isHubProvider(providerName) {
  const config = MODEL_CONFIGS[providerName]
  return config && config.isHub === true
}

function selectHubModel(providerName, complexity = 'standard', availableModels = []) {
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
    getModelRecommendation(commitDetails) {
      // Get available models for hub providers
      const availableModels = this.getAvailableModels ? this.getAvailableModels() : []
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

    async selectOptimalModel(commitDetails) {
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

      return this.getModelRecommendation(commitDetails)
    },

    async selectModelForCapabilities(requiredCapabilities = []) {
      const availableModels = this.getAvailableModels ? this.getAvailableModels() : []
      return getBestModelForCapabilities(
        providerName,
        requiredCapabilities,
        this.config,
        availableModels
      )
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
    async testConnection() {
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
    async validateModelAvailability(modelName) {
      if (!this.isAvailable()) {
        return createProviderErrorResponse(
          providerName,
          'model_validation',
          `${providerName} provider is not configured`,
          [`Configure ${providerName.toUpperCase()}_API_KEY`]
        )
      }

      const normalizedModel = normalizeModelName(providerName, modelName)
      const availableModels = this.getAvailableModels ? this.getAvailableModels() : []
      const fallbacks = getSuggestedModels(providerName, normalizedModel, availableModels)

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
    getCapabilities(modelName) {
      const availableModels = this.getAvailableModels ? this.getAvailableModels() : []
      const modelConfig = getProviderModelConfig(providerName, this.config, availableModels)

      const model =
        modelName ||
        this.config.AI_MODEL ||
        this.config[`${providerName.toUpperCase()}_MODEL`] ||
        modelConfig.standardModel

      const normalizedModel = normalizeModelName(providerName, model)
      const capabilities = getModelCapabilities(normalizedModel)

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
    async testCapabilities(options = {}) {
      const results = {
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
              results.performance.tokensGenerated = testResponse.tokens || 0
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
    async quickHealthCheck() {
      const health = {
        status: 'unknown',
        available: false,
        configured: false,
        timestamp: new Date().toISOString(),
      }

      try {
        health.available = this.isAvailable()
        health.configured = this.getName && this.config

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

    getSimilarModels(modelName, providedAvailableModels = []) {
      // Use provider's available models if not provided
      const availableModels =
        providedAvailableModels.length > 0
          ? providedAvailableModels
          : this.getAvailableModels
            ? this.getAvailableModels()
            : []

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
      return getSuggestedModels(providerName, modelName, availableModels)
    },
  }
}

/**
 * Mixin that provides standard configuration handling
 * @param {string} providerName - Name of the provider
 * @param {Object} defaults - Default configuration values
 * @returns {Object} Mixin methods
 */
export function ConfigurationMixin(providerName, defaults = {}) {
  return {
    getProviderConfig() {
      return extractProviderConfig(this.config, providerName.toUpperCase(), defaults)
    },

    getProviderModelConfig() {
      const availableModels = this.getAvailableModels ? this.getAvailableModels() : []
      return getProviderModelConfig(providerName, this.config, availableModels)
    },

    buildClientOptions(extraDefaults = {}) {
      const providerConfig = this.getProviderConfig()
      return buildClientOptions(providerConfig, { ...defaults, ...extraDefaults })
    },

    getProviderInfo() {
      const providerConfig = this.getProviderConfig()
      const availableModels = this.getAvailableModels ? this.getAvailableModels() : []
      const modelConfig = getProviderModelConfig(providerName, this.config, availableModels)

      const info = {
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
  /**
   * Execute provider operation with standardized error handling and availability checking
   * @param {Object} provider - Provider instance
   * @param {string} operation - Operation name (e.g., 'generate_completion')
   * @param {Function} operationFn - Function to execute the operation
   * @param {Object} context - Additional context for error handling
   * @returns {Promise<Object>} Standardized response
   */
  static async executeWithErrorHandling(provider, operation, operationFn, context = {}) {
    // Check availability first
    if (!provider.isAvailable()) {
      return ProviderResponseHandler.createUnavailableResponse(provider.getName(), operation)
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
  static createUnavailableResponse(providerName, operation) {
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
  static async executeMultiple(provider, operations) {
    const results = []
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
    handleProviderError(error, operation, context = {}) {
      // Common error patterns and their standardized responses
      if (error.message.includes('API key') || error.message.includes('401')) {
        return createProviderErrorResponse(providerName, operation, 'Invalid or missing API key', [
          `Check ${providerName.toUpperCase()}_API_KEY configuration`,
        ])
      }

      if (error.message.includes('model') && error.message.includes('not found')) {
        const availableModels = this.getAvailableModels ? this.getAvailableModels() : []
        const _modelConfig = getProviderModelConfig(providerName, this.config, availableModels)
        const fallbacks = getSuggestedModels(providerName, context.model, availableModels)

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
 * Apply multiple mixins to a provider class
 * @param {Function} ProviderClass - The provider class to enhance
 * @param {string} providerName - Name of the provider
 * @param {Array<Function>} mixins - Array of mixin functions to apply
 * @returns {Function} Enhanced provider class
 */
export function applyMixins(ProviderClass, providerName, mixins = []) {
  const defaultMixins = [
    ConfigurationMixin,
    ModelRecommendationMixin,
    ConnectionTestMixin,
    ModelValidationMixin,
    CapabilitiesMixin,
    ErrorHandlingMixin,
  ]

  const allMixins = [...defaultMixins, ...mixins]

  // Apply each mixin to the prototype
  allMixins.forEach((mixinFn) => {
    const methods = mixinFn(providerName)
    Object.assign(ProviderClass.prototype, methods)
  })

  return ProviderClass
}

/**
 * Create a standardized provider class with all common functionality
 * @param {string} providerName - Name of the provider
 * @param {Object} options - Provider-specific options
 * @returns {Function} Base provider class with mixins applied
 */
export function createEnhancedProvider(providerName, options = {}) {
  const { mixins = [] } = options

  class EnhancedProvider {
    constructor(config) {
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
