import { ProviderManagerService } from './provider-manager.service.js'

/**
 * ProviderManagementService - Alias for ProviderManagerService
 *
 * This service manages AI provider lifecycle, configuration, and operations
 * including registration, activation, validation, and testing of providers.
 */
export class ProviderManagementService extends ProviderManagerService {
  constructor(config = {}, options = {}) {
    super(config, options)
  }

  /**
   * Initialize the provider management service
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.loadProviders()
    await this.validateConfiguration()
  }

  /**
   * Get all available providers
   * @returns {Array} Array of provider instances
   */
  getAllProviders() {
    return this.providers
  }

  /**
   * Get provider by name
   * @param {string} name - Provider name
   * @returns {Object|null} Provider instance or null
   */
  getProviderByName(name) {
    return this.findProviderByName(name)
  }

  /**
   * Register a new provider
   * @param {string} name - Provider name
   * @param {Object} providerInstance - Provider instance
   * @returns {boolean} Success status
   */
  registerProvider(name, providerInstance) {
    try {
      this.providers.push({
        name,
        instance: providerInstance,
        available: true,
      })
      return true
    } catch (error) {
      console.error(`Failed to register provider ${name}:`, error.message)
      return false
    }
  }

  /**
   * Activate a provider by name
   * @param {string} name - Provider name to activate
   * @returns {Promise<boolean>} Success status
   */
  async activateProvider(name) {
    try {
      const provider = this.findProviderByName(name)
      if (!provider) {
        throw new Error(`Provider '${name}' not found`)
      }

      this.activeProvider = provider.instance
      return true
    } catch (error) {
      console.error(`Failed to activate provider ${name}:`, error.message)
      return false
    }
  }

  /**
   * Deactivate current provider
   * @returns {boolean} Success status
   */
  deactivateProvider() {
    try {
      this.activeProvider = null
      return true
    } catch (error) {
      console.error('Failed to deactivate provider:', error.message)
      return false
    }
  }

  /**
   * Get provider lifecycle status
   * @param {string} name - Provider name
   * @returns {Object} Lifecycle status information
   */
  getProviderLifecycle(name) {
    const provider = this.findProviderByName(name)
    return {
      name,
      exists: !!provider,
      available: provider?.available,
      active: this.activeProvider === provider?.instance,
      initialized: provider?.instance?.isInitialized?.(),
    }
  }

  /**
   * Get provider registry information
   * @returns {Object} Registry information
   */
  getProviderRegistry() {
    return {
      total: this.providers.length,
      active: this.activeProvider ? this.activeProvider.constructor.name : null,
      available: this.providers.filter((p) => p.available).length,
      providers: this.providers.map((p) => ({
        name: p.name,
        available: p.available,
        type: p.instance.constructor.name,
      })),
    }
  }

  /**
   * Validate all provider configurations
   * @returns {Promise<Object>} Validation results
   */
  async validateConfiguration() {
    const results = {
      valid: 0,
      invalid: 0,
      errors: [],
    }

    for (const provider of this.providers) {
      try {
        const isValid = await provider.instance.isAvailable?.()
        if (isValid) {
          results.valid++
        } else {
          results.invalid++
          results.errors.push(`${provider.name}: Not available`)
        }
      } catch (error) {
        results.invalid++
        results.errors.push(`${provider.name}: ${error.message}`)
      }
    }

    return results
  }

  /**
   * Clean up provider resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.activeProvider = null
    this.providers = []
  }
}

// Export as default for compatibility
export default ProviderManagementService
