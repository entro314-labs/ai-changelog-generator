import process from 'node:process'

import colors from '../../shared/constants/colors.js'
// Import all providers from new location
import { AnthropicProvider } from './implementations/anthropic.js'
import { BedrockProvider } from './implementations/bedrock.js'
import AzureOpenAIProvider from './implementations/azure.js'
import DummyProvider from './implementations/dummy.js'
import GitHubCopilotProvider from './implementations/github-copilot.js'
import GoogleProvider from './implementations/google.js'
import HuggingFaceProvider from './implementations/huggingface.js'
import LMStudioProvider from './implementations/lmstudio.js'
import MockProvider from './implementations/mock.js'
import OllamaProvider from './implementations/ollama.js'
import { OpenAIProvider } from './implementations/openai.js'
import VercelGatewayProvider from './implementations/vercel-gateway.js'
import VertexAIProvider from './implementations/vertex.js'

/**
 * ProviderManager Service
 *
 * Manages AI provider loading, selection, and fallback logic
 * Supports:
 * - Traditional API key authentication
 * - OAuth tokens (Google, Azure)
 * - GitHub Copilot (via GitHub authentication)
 * - Auto-detected credentials from CLI tools
 */
// Development-only providers that must never be presented as real, healthy,
// production providers. They are kept for tests and the no-credential fallback,
// but are labeled truthfully wherever providers are surfaced.
const DEVELOPMENT_PROVIDERS = ['dummy', 'mock']

function isDevelopmentProviderName(name: string): boolean {
  return DEVELOPMENT_PROVIDERS.includes(name)
}

export class ProviderManagerService {
  [key: string]: any
  constructor(config: Record<string, any> = {}, options: Record<string, any> = {}) {
    this.config = config
    this.providers = []
    this.activeProvider = null
    this.isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
    this.options = {
      fallbackToDefault: true,
      defaultProviderName: 'openai',
      ...options,
    }

    // Keep a reference to the ConfigurationManager (if provided) so a provider
    // switch can be persisted and re-resolved by the generation flow. The
    // orchestrator constructs this service with the plain config object plus an
    // options bag that may carry { configManager }.
    this.configManager = options.configManager || null

    // Static provider mapping with all supported providers
    this.providerClasses = {
      anthropic: AnthropicProvider,
      bedrock: BedrockProvider,
      azure: AzureOpenAIProvider,
      dummy: DummyProvider,
      'github-copilot': GitHubCopilotProvider,
      google: GoogleProvider,
      huggingface: HuggingFaceProvider,
      lmstudio: LMStudioProvider,
      mock: MockProvider,
      ollama: OllamaProvider,
      openai: OpenAIProvider,
      'vercel-gateway': VercelGatewayProvider,
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
      const providerEntries = (
        this.isTestEnvironment
          ? Object.entries(this.providerClasses).filter(([name]) =>
              ['dummy', 'mock'].includes(name)
            )
          : Object.entries(this.providerClasses)
      ) as Array<[string, new (config: Record<string, any>) => any]>

      for (const [name, ProviderClass] of providerEntries) {
        try {
          const provider = new ProviderClass(this.config)
          this.providers.push({
            name: provider.getName(),
            instance: provider,
            available: provider.isAvailable(),
            capabilities: provider.getCapabilities ? provider.getCapabilities() : {},
            isDevelopmentProvider: isDevelopmentProviderName(name),
          })

          // Collect provider status for summary instead of individual messages
        } catch (error) {
          console.error(colors.errorMessage(`Failed to load provider ${name}: ${error.message}`))
        }
      }

      if (!process.env.MCP_SERVER_MODE) {
        const productionProviders = this.providers.filter((p) => !p.isDevelopmentProvider)
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

    if (this.isTestEnvironment) {
      const dummyProvider = this.findProviderByName('dummy')
      if (dummyProvider) {
        this.activeProvider = dummyProvider.instance
        if (!process.env.MCP_SERVER_MODE) {
          console.log(colors.infoMessage('🧪 Using dummy provider in test environment'))
        }
        return
      }
    }

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
      'github-copilot',
      'bedrock',
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
   * Switch to a different provider.
   *
   * On success the selection is made durable so the generation flow actually
   * uses it: the resolved provider name is written back to `this.config`
   * (so any subsequent reload re-resolves to it) and, when a
   * ConfigurationManager is available, persisted to `.ai-changelog.json` via
   * `setActiveProvider`.
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

    // Resolve the canonical provider name from the instance so persistence and
    // reload re-resolution use the exact registered identifier.
    const resolvedName = provider.instance.getName ? provider.instance.getName() : provider.name

    this.activeProvider = provider.instance

    // Update the live runtime config so a reload()/determineActiveProvider()
    // re-resolves to the switched provider instead of the previous default.
    this.config.AI_PROVIDER = resolvedName

    // Persist the selection when a ConfigurationManager is wired in so the
    // choice survives across processes and the generation flow consumes it.
    if (this.configManager && typeof this.configManager.setActiveProvider === 'function') {
      try {
        this.configManager.setActiveProvider(resolvedName)
      } catch (error) {
        return {
          success: false,
          error: `Switched in memory but failed to persist provider '${resolvedName}': ${error.message}`,
        }
      }
    }

    return {
      success: true,
      provider: resolvedName,
    }
  }

  /**
   * List all providers with their status.
   *
   * Development providers (dummy/mock) are surfaced with `development: true`
   * so callers never present them as real providers. This is synchronous; the
   * provider's ACTUAL available models are fetched separately via the async
   * `getProviderModels(name)` (used by the `providers models` command).
   */
  listProviders() {
    return this.providers.map((p) => {
      const defaultModel =
        p.instance.getDefaultModel && typeof p.instance.getDefaultModel === 'function'
          ? this.safeGetDefaultModel(p.instance)
          : undefined

      return {
        name: p.name,
        available: p.available,
        active: this.activeProvider?.getName() === p.name,
        development: Boolean(p.isDevelopmentProvider),
        capabilities: p.capabilities,
        configuration: p.instance.getConfiguration ? p.instance.getConfiguration() : {},
        defaultModel,
      }
    })
  }

  /**
   * Resolve a provider instance's actual available models, tolerating both sync
   * and async `getAvailableModels()` implementations and surfacing failures as
   * an empty list rather than throwing.
   */
  async resolveProviderModels(instance) {
    if (!instance || typeof instance.getAvailableModels !== 'function') {
      return []
    }

    try {
      const models = await instance.getAvailableModels()
      return Array.isArray(models) ? models : []
    } catch {
      return []
    }
  }

  /**
   * Read a provider's default model without letting an abstract/unimplemented
   * method break the listing.
   */
  safeGetDefaultModel(instance) {
    try {
      return instance.getDefaultModel()
    } catch {
      return undefined
    }
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
      const result = await provider.instance.testConnection()
      this.configManager
        ?.getCredentialManager?.()
        ?.logCredentialUsage(providerName, !!result?.success, result?.error || null)
      return result
    } catch (error) {
      this.configManager
        ?.getCredentialManager?.()
        ?.logCredentialUsage(providerName, false, error.message)
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
    const results: Record<string, any> = {}

    for (const provider of this.providers) {
      if (provider.isDevelopmentProvider) {
        // Development providers are not real providers: report them as such
        // instead of claiming a healthy connection.
        results[provider.name] = {
          success: false,
          development: true,
          error: 'Development provider (not a real AI provider)',
        }
        continue
      }

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
   * Get provider statistics.
   *
   * `available`/`configured` reflect only real production providers so
   * development providers (dummy/mock) never inflate the "ready" counts.
   * `development` exposes how many development providers are loaded, and each
   * provider entry is flagged truthfully.
   */
  getStats() {
    const total = this.providers.length
    const productionProviders = this.providers.filter((p) => !p.isDevelopmentProvider)
    const developmentProviders = this.providers.filter((p) => p.isDevelopmentProvider)
    const available = productionProviders.filter((p) => p.available).length
    const configured = available

    return {
      total,
      available,
      configured,
      development: developmentProviders.length,
      active: this.activeProvider?.getName() || null,
      providers: this.providers.map((p) => ({
        name: p.name,
        available: p.available,
        active: this.activeProvider?.getName() === p.name,
        development: Boolean(p.isDevelopmentProvider),
      })),
    }
  }

  /**
   * Reload providers (useful for configuration changes)
   */
  reload(newConfig: any = null) {
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
   * Get a provider's ACTUAL available models by delegating to the provider
   * instance's `getAvailableModels()`. Returns the real descriptor list so the
   * `providers models` command no longer renders a hardcoded list. Returns
   * `null` when the provider is unknown so callers can surface a clear error.
   */
  async getProviderModels(name) {
    const provider = this.findProviderByName(name)

    if (!provider) {
      return null
    }

    return this.resolveProviderModels(provider.instance)
  }

  /**
   * Get configured provider priority order
   */
  getProviderPriority() {
    return [
      'openai',
      'anthropic',
      'azure',
      'google',
      'github-copilot',
      'bedrock',
      'vertex',
      'huggingface',
      'ollama',
      'lmstudio',
    ]
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

export default ProviderManagerService
