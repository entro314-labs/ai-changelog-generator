import process from 'node:process'

import colors from '../../shared/constants/colors.js'
// Import all providers from new location
import { AnthropicProvider } from './implementations/anthropic.js'
import AzureOpenAIProvider from './implementations/azure.js'
import DummyProvider from './implementations/dummy.js'
import GoogleProvider from './implementations/google.js'
import HuggingFaceProvider from './implementations/huggingface.js'
import LMStudioProvider from './implementations/lmstudio.js'
import MockProvider from './implementations/mock.js'
import OllamaProvider from './implementations/ollama.js'
import { OpenAIProvider } from './implementations/openai.js'
import VertexAIProvider from './implementations/vertex.js'

/**
 * ProviderManager Service
 *
 * Manages AI provider loading, selection, and fallback logic
 */
export class ProviderManagerService {
  constructor(config = {}, options = {}) {
    this.config = config
    this.providers = []
    this.activeProvider = null
    this.options = {
      fallbackToDefault: true,
      defaultProviderName: 'openai',
      ...options,
    }

    // Static provider mapping with new classes
    this.providerClasses = {
      anthropic: AnthropicProvider,
      azure: AzureOpenAIProvider,
      dummy: DummyProvider,
      google: GoogleProvider,
      huggingface: HuggingFaceProvider,
      lmstudio: LMStudioProvider,
      mock: MockProvider,
      ollama: OllamaProvider,
      openai: OpenAIProvider,
      vertex: VertexAIProvider,
    }

    this.loadProviders()
    this.determineActiveProvider()
  }

  /**
   * Load all provider implementations
   */
  loadProviders() {
    try {
      for (const [name, ProviderClass] of Object.entries(this.providerClasses)) {
        try {
          const provider = new ProviderClass(this.config)
          this.providers.push({
            name: provider.getName(),
            instance: provider,
            available: provider.isAvailable(),
            capabilities: provider.getCapabilities ? provider.getCapabilities() : {},
          })

          // Collect provider status for summary instead of individual messages
        } catch (error) {
          console.error(colors.errorMessage(`Failed to load provider ${name}: ${error.message}`))
        }
      }

      if (!process.env.MCP_SERVER_MODE) {
        const _available = this.providers.filter((p) => p.available).length
        const isDevelopmentProvider = (name) => ['dummy', 'mock'].includes(name)
        const productionProviders = this.providers.filter((p) => !isDevelopmentProvider(p.name))
        const availableProduction = productionProviders.filter((p) => p.available)

        if (availableProduction.length > 0) {
          console.log(
            colors.infoMessage(
              `✅ ${availableProduction.length} provider${availableProduction.length > 1 ? 's' : ''} ready: ${availableProduction.map((p) => p.name).join(', ')}`
            )
          )
        }
      }
    } catch (error) {
      console.error(colors.errorMessage(`Failed to load providers: ${error.message}`))
      this.providers = []
    }
  }

  /**
   * Determine the active provider based on configuration and availability
   */
  determineActiveProvider() {
    const { AI_PROVIDER: requestedProvider } = this.config

    // Handle explicit provider request
    if (requestedProvider && requestedProvider.toLowerCase() !== 'auto') {
      const provider = this.findProviderByName(requestedProvider)

      if (provider?.instance.isAvailable()) {
        this.activeProvider = provider.instance
        if (!process.env.MCP_SERVER_MODE) {
          console.log(colors.successMessage(`🎯 Using provider: ${provider.instance.getName()}`))
        }
        return
      }
      if (provider) {
        console.log(
          colors.warningMessage(
            `Requested provider ${requestedProvider} is not available, auto-selecting...`
          )
        )
      } else {
        console.log(
          colors.warningMessage(
            `Requested provider ${requestedProvider} not found, auto-selecting...`
          )
        )
      }
    }

    // Auto-select the first available provider
    const availableProviders = this.providers.filter((p) => p.available)

    if (availableProviders.length === 0) {
      console.log(colors.warningMessage('⚠️  No AI providers configured'))
      console.log(colors.infoMessage('💡 To enable AI-powered analysis:'))
      console.log(colors.infoMessage('   1. Run: ai-changelog init'))
      console.log(colors.infoMessage('   2. Or set API keys in .env.local'))
      console.log(colors.infoMessage('   3. Supported providers: OpenAI, Anthropic, Azure, Google'))
      console.log(colors.dim('   Using pattern-based analysis for now...'))
      this.activeProvider = null
      return
    }

    // Priority order for auto-selection
    const priorityOrder = [
      'openai',
      'anthropic',
      'azure',
      'google',
      'vertex',
      'huggingface',
      'ollama',
      'lmstudio',
    ]

    for (const providerName of priorityOrder) {
      const provider = availableProviders.find((p) => p.name === providerName)
      if (provider) {
        this.activeProvider = provider.instance
        console.log(colors.successMessage(`Auto-selected provider: ${provider.instance.getName()}`))
        return
      }
    }

    // Fallback to first available
    this.activeProvider = availableProviders[0].instance
    if (!process.env.MCP_SERVER_MODE) {
      console.log(
        colors.successMessage(`Using first available provider: ${this.activeProvider.getName()}`)
      )
    }
  }

  /**
   * Get the active provider instance
   */
  getActiveProvider() {
    return this.activeProvider
  }

  /**
   * Get all loaded providers
   */
  getAllProviders() {
    return this.providers
  }

  /**
   * Find provider by name
   */
  findProviderByName(name) {
    return this.providers.find((p) => p.name.toLowerCase() === name.toLowerCase())
  }

  /**
   * Switch to a different provider
   */
  switchProvider(providerName) {
    const provider = this.findProviderByName(providerName)

    if (!provider) {
      return {
        success: false,
        error: `Provider '${providerName}' not found`,
      }
    }

    if (!provider.instance.isAvailable()) {
      return {
        success: false,
        error: `Provider '${providerName}' is not properly configured`,
      }
    }

    this.activeProvider = provider.instance
    return {
      success: true,
      provider: providerName,
    }
  }

  /**
   * List all providers with their status
   */
  listProviders() {
    return this.providers.map((p) => ({
      name: p.name,
      available: p.available,
      active: this.activeProvider?.getName() === p.name,
      capabilities: p.capabilities,
      configuration: p.instance.getConfiguration ? p.instance.getConfiguration() : {},
    }))
  }

  /**
   * Test connection to a specific provider
   */
  async testProvider(providerName) {
    const provider = this.findProviderByName(providerName)

    if (!provider) {
      return {
        success: false,
        error: `Provider '${providerName}' not found`,
      }
    }

    if (!provider.instance.isAvailable()) {
      return {
        success: false,
        error: `Provider '${providerName}' is not properly configured`,
      }
    }

    try {
      return await provider.instance.testConnection()
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(providerName) {
    const provider = this.findProviderByName(providerName)

    if (!provider) {
      return null
    }

    return provider.instance.getCapabilities ? provider.instance.getCapabilities() : {}
  }

  /**
   * Validate all providers
   */
  async validateAll() {
    const results = {}

    for (const provider of this.providers) {
      if (provider.available) {
        try {
          results[provider.name] = await provider.instance.testConnection()
        } catch (error) {
          results[provider.name] = {
            success: false,
            error: error.message,
          }
        }
      } else {
        results[provider.name] = {
          success: false,
          error: 'Provider not configured',
        }
      }
    }

    return results
  }

  /**
   * Get provider statistics
   */
  getStats() {
    const total = this.providers.length
    const available = this.providers.filter((p) => p.available).length
    const configured = available

    return {
      total,
      available,
      configured,
      active: this.activeProvider?.getName() || null,
      providers: this.providers.map((p) => ({
        name: p.name,
        available: p.available,
        active: this.activeProvider?.getName() === p.name,
      })),
    }
  }

  /**
   * Reload providers (useful for configuration changes)
   */
  reload(newConfig = null) {
    if (newConfig) {
      this.config = { ...this.config, ...newConfig }
    }

    this.providers = []
    this.activeProvider = null
    this.loadProviders()
    this.determineActiveProvider()
  }

  /**
   * Check if any provider is available
   */
  hasAvailableProvider() {
    return this.activeProvider !== null
  }

  /**
   * Get available providers with full details
   */
  getAvailableProviders() {
    return this.providers
      .filter((p) => p.available)
      .map((p) => ({
        name: p.name,
        instance: p.instance,
        capabilities: p.capabilities,
      }))
  }

  /**
   * Get simple list of available provider names
   */
  getAvailableProviderNames() {
    return this.providers.filter((p) => p.available).map((p) => p.name)
  }

  /**
   * Get configured provider priority order
   */
  getProviderPriority() {
    return ['openai', 'anthropic', 'azure', 'google', 'vertex', 'huggingface', 'ollama', 'lmstudio']
  }

  /**
   * Validate if provider name exists in available providers
   */
  validateProviderName(name) {
    return Object.keys(this.providerClasses).includes(name.toLowerCase())
  }

  /**
   * Get the default fallback provider
   */
  getDefaultProvider() {
    return this.findProviderByName(this.options.defaultProviderName)
  }
}

// Backward compatibility export
export default ProviderManagerService
