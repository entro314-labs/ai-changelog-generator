/**
 * Unified Credential Manager
 *
 * Single source of truth for all credential operations.
 * Manages storage backends, priority system, user preferences, and audit logging.
 *
 * Priority System:
 * 1. User Preference (if explicitly set)
 * 2. Primary Storage (env, config, keychain) - user-configured
 * 3. Discovered Storage (gemini-cli, claude-code, etc.) - user opted-in
 *
 * Within same priority level:
 * - OAuth tokens > API keys
 * - Newer credentials > Older credentials
 */

import { ConfigStorage } from './storage/config-storage.js'
import { EnvStorage } from './storage/env-storage.js'
import { KeychainStorage } from './storage/keychain-storage.js'

/**
 * Storage type enum
 */
export const StorageType = {
  ENV: 'env',
  CONFIG: 'config',
  KEYCHAIN: 'keychain',
  DISCOVERED: 'discovered',
}

/**
 * Auth type enum
 */
export const AuthType = {
  API_KEY: 'api_key',
  OAUTH_TOKEN: 'oauth_token',
  SERVICE_ACCOUNT: 'service_account',
}

export class UnifiedCredentialManager {
  constructor(options = {}) {
    this.options = options

    // Initialize storage backends
    this.storageBackends = new Map()
    this.storageBackends.set(StorageType.ENV, new EnvStorage(options))
    this.storageBackends.set(StorageType.CONFIG, new ConfigStorage(options))
    this.storageBackends.set(StorageType.KEYCHAIN, new KeychainStorage(options))

    // User preferences for providers (which storage to use)
    this.userPreferences = new Map()

    // Discovered credentials (from CLI tools, etc.)
    this.discoveredCredentials = new Map()

    // Audit log
    this.auditLog = []
    this.maxAuditLogSize = options.maxAuditLogSize || 1000
  }

  /**
   * Get credential for a provider
   * Returns the active credential based on priority system
   *
   * @param {string} provider - Provider name (openai, anthropic, etc.)
   * @returns {Promise<string|null>} Credential value or null
   */
  async getCredential(provider) {
    const activeCredential = await this.getActiveCredential(provider)
    return activeCredential?.value || null
  }

  /**
   * Get active credential with full metadata
   *
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>} { value, source, priority, authType, metadata }
   */
  async getActiveCredential(provider) {
    // Check user preference first (highest priority)
    const preferredSource = this.userPreferences.get(provider)
    if (preferredSource) {
      const credential = await this._getFromSource(provider, preferredSource)
      if (credential) {
        return {
          provider,
          value: credential.value,
          displayValue: this._redactValue(credential.value),
          source: preferredSource,
          sourceLabel: this._getSourceLabel(preferredSource),
          priority: 1, // User preference
          authType: credential.authType || AuthType.API_KEY,
          metadata: credential.metadata,
        }
      }
    }

    // Collect all available credentials
    const availableCredentials = await this._getAllCredentialsForProvider(provider)

    if (availableCredentials.length === 0) {
      return null
    }

    // Sort by priority
    availableCredentials.sort((a, b) => {
      // Compare priority level
      if (a.priority !== b.priority) {
        return a.priority - b.priority // Lower number = higher priority
      }

      // Same priority level: OAuth > Service Account > API Key
      const authPriority = {
        [AuthType.OAUTH_TOKEN]: 1,
        [AuthType.SERVICE_ACCOUNT]: 2,
        [AuthType.API_KEY]: 3,
      }

      const aAuthPriority = authPriority[a.authType] || 999
      const bAuthPriority = authPriority[b.authType] || 999

      if (aAuthPriority !== bAuthPriority) {
        return aAuthPriority - bAuthPriority
      }

      // Same auth type: newer > older
      const aTime = new Date(a.metadata?.updatedAt || a.metadata?.createdAt || 0).getTime()
      const bTime = new Date(b.metadata?.updatedAt || b.metadata?.createdAt || 0).getTime()

      return bTime - aTime // Newer first
    })

    return availableCredentials[0]
  }

  /**
   * Get all available credentials for a provider (for UI display)
   *
   * @param {string} provider - Provider name
   * @returns {Promise<Array>} Array of credential info objects
   */
  async getAllCredentialsForProvider(provider) {
    return await this._getAllCredentialsForProvider(provider)
  }

  /**
   * Internal: Get all credentials for a provider
   * @private
   */
  async _getAllCredentialsForProvider(provider) {
    const credentials = []

    // Check primary storage backends
    for (const [storageType, backend] of this.storageBackends) {
      try {
        const value = await backend.get(provider)
        if (value) {
          const metadata = await backend.getMetadata(provider)
          credentials.push({
            provider,
            value,
            displayValue: this._redactValue(value),
            source: storageType,
            sourceLabel: backend.getName(),
            priority: 2, // Primary storage
            authType: metadata?.authType || AuthType.API_KEY,
            metadata,
          })
        }
      } catch (error) {
        console.warn(`Failed to get credential from ${storageType}:`, error.message)
      }
    }

    // Check discovered credentials
    const discovered = this.discoveredCredentials.get(provider)
    if (discovered) {
      for (const cred of discovered) {
        credentials.push({
          provider,
          value: cred.value,
          displayValue: this._redactValue(cred.value),
          source: StorageType.DISCOVERED,
          sourceLabel: `Discovered (${cred.discoverySource})`,
          priority: 3, // Discovered storage (lowest)
          authType: cred.authType || AuthType.API_KEY,
          metadata: cred.metadata,
          discoverySource: cred.discoverySource,
        })
      }
    }

    return credentials
  }

  /**
   * Get credential from specific source
   * @private
   */
  async _getFromSource(provider, source) {
    if (source === StorageType.DISCOVERED) {
      const discovered = this.discoveredCredentials.get(provider)
      return discovered?.[0] || null
    }

    const backend = this.storageBackends.get(source)
    if (!backend) {
      return null
    }

    const value = await backend.get(provider)
    if (!value) {
      return null
    }

    const metadata = await backend.getMetadata(provider)

    return {
      value,
      authType: metadata?.authType || AuthType.API_KEY,
      metadata,
    }
  }

  /**
   * Set credential for a provider
   *
   * @param {string} provider - Provider name
   * @param {string} credential - Credential value
   * @param {string} storageType - Where to store (env, config, keychain)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async setCredential(provider, credential, storageType, metadata = {}) {
    const backend = this.storageBackends.get(storageType)
    if (!backend) {
      throw new Error(`Unknown storage type: ${storageType}`)
    }

    // Check if backend is available (e.g., keychain might not be available)
    if (backend.isAvailable && !(await backend.isAvailable())) {
      throw new Error(`Storage backend ${storageType} is not available`)
    }

    await backend.set(provider, credential, metadata)

    // Log the operation
    this._logAudit({
      action: 'set_credential',
      provider,
      storageType,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Delete credential for a provider
   *
   * @param {string} provider - Provider name
   * @param {string} storageType - Which storage to delete from (optional, deletes from all if not specified)
   * @returns {Promise<boolean>}
   */
  async deleteCredential(provider, storageType = null) {
    let deleted = false

    if (storageType) {
      // Delete from specific storage
      const backend = this.storageBackends.get(storageType)
      if (backend) {
        deleted = await backend.delete(provider)
      }
    } else {
      // Delete from all storages
      for (const [type, backend] of this.storageBackends) {
        const result = await backend.delete(provider)
        deleted = deleted || result
      }

      // Also remove from discovered
      this.discoveredCredentials.delete(provider)

      // Remove user preference
      this.userPreferences.delete(provider)
    }

    if (deleted) {
      this._logAudit({
        action: 'delete_credential',
        provider,
        storageType: storageType || 'all',
        timestamp: new Date().toISOString(),
      })
    }

    return deleted
  }

  /**
   * List all providers with credentials
   *
   * @returns {Promise<string[]>}
   */
  async listProviders() {
    const providers = new Set()

    // Get from all storage backends
    for (const backend of this.storageBackends.values()) {
      try {
        const backendProviders = await backend.list()
        for (const provider of backendProviders) {
          providers.add(provider)
        }
      } catch (error) {
        console.warn(`Failed to list from backend:`, error.message)
      }
    }

    // Get from discovered
    for (const provider of this.discoveredCredentials.keys()) {
      providers.add(provider)
    }

    return Array.from(providers)
  }

  /**
   * Set user preference for provider storage
   *
   * @param {string} provider - Provider name
   * @param {string} storageType - Preferred storage type
   */
  setPreferredSource(provider, storageType) {
    this.userPreferences.set(provider, storageType)

    this._logAudit({
      action: 'set_preference',
      provider,
      storageType,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Get user preference for provider storage
   *
   * @param {string} provider - Provider name
   * @returns {string|null}
   */
  getPreferredSource(provider) {
    return this.userPreferences.get(provider) || null
  }

  /**
   * Add discovered credential (from CLI tools, etc.)
   *
   * @param {string} provider - Provider name
   * @param {Object} credential - Credential info
   */
  addDiscoveredCredential(provider, credential) {
    if (!this.discoveredCredentials.has(provider)) {
      this.discoveredCredentials.set(provider, [])
    }

    this.discoveredCredentials.get(provider).push({
      value: credential.value,
      authType: credential.authType || AuthType.API_KEY,
      discoverySource: credential.source || 'unknown',
      metadata: credential.metadata || {},
      discoveredAt: new Date().toISOString(),
    })
  }

  /**
   * Import discovered credential to primary storage
   *
   * @param {string} provider - Provider name
   * @param {number} discoveryIndex - Which discovered credential to import (default 0)
   * @param {string} targetStorage - Where to import to (default 'config')
   * @returns {Promise<boolean>}
   */
  async importDiscoveredCredential(provider, discoveryIndex = 0, targetStorage = StorageType.CONFIG) {
    const discovered = this.discoveredCredentials.get(provider)
    if (!discovered || !discovered[discoveryIndex]) {
      return false
    }

    const credential = discovered[discoveryIndex]

    await this.setCredential(provider, credential.value, targetStorage, {
      ...credential.metadata,
      importedFrom: credential.discoverySource,
      importedAt: new Date().toISOString(),
    })

    this._logAudit({
      action: 'import_discovered',
      provider,
      discoverySource: credential.discoverySource,
      targetStorage,
      timestamp: new Date().toISOString(),
    })

    return true
  }

  /**
   * Get credential status for all providers (for UI)
   *
   * @returns {Promise<Array>}
   */
  async getCredentialStatus() {
    const providers = await this.listProviders()
    const status = []

    for (const provider of providers) {
      const activeCredential = await this.getActiveCredential(provider)
      const allCredentials = await this.getAllCredentialsForProvider(provider)

      status.push({
        provider,
        hasCredential: !!activeCredential,
        source: activeCredential?.source,
        sourceLabel: activeCredential?.sourceLabel,
        isActive: true,
        authType: activeCredential?.authType,
        availableCount: allCredentials.length,
        hasDiscovered: this.discoveredCredentials.has(provider),
        userPreference: this.userPreferences.get(provider),
      })
    }

    return status
  }

  /**
   * Log credential usage for audit
   *
   * @param {string} provider - Provider name
   * @param {boolean} success - Whether the operation succeeded
   * @param {string} error - Error message if failed
   */
  logCredentialUsage(provider, success, error = null) {
    this._logAudit({
      action: 'use_credential',
      provider,
      success,
      error,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Get audit log
   *
   * @param {Object} filter - Filter options
   * @returns {Array}
   */
  getAuditLog(filter = {}) {
    let log = [...this.auditLog]

    if (filter.provider) {
      log = log.filter((entry) => entry.provider === filter.provider)
    }

    if (filter.action) {
      log = log.filter((entry) => entry.action === filter.action)
    }

    if (filter.since) {
      const sinceTime = new Date(filter.since).getTime()
      log = log.filter((entry) => new Date(entry.timestamp).getTime() >= sinceTime)
    }

    if (filter.limit) {
      log = log.slice(-filter.limit)
    }

    return log
  }

  /**
   * Internal: Add entry to audit log
   * @private
   */
  _logAudit(entry) {
    this.auditLog.push(entry)

    // Trim log if too large
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditLogSize)
    }
  }

  /**
   * Redact credential value for display
   * @private
   */
  _redactValue(value) {
    if (!value || value.length < 12) {
      return '***'
    }
    return `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
  }

  /**
   * Get human-readable source label
   * @private
   */
  _getSourceLabel(source) {
    const backend = this.storageBackends.get(source)
    if (backend) {
      return backend.getName()
    }

    if (source === StorageType.DISCOVERED) {
      return 'Discovered'
    }

    return source
  }

  /**
   * Get diagnostics information
   *
   * @returns {Promise<Object>}
   */
  async getDiagnostics() {
    const diagnostics = {
      storageBackends: {},
      providers: await this.listProviders(),
      userPreferences: Object.fromEntries(this.userPreferences),
      discoveredCount: this.discoveredCredentials.size,
      auditLogSize: this.auditLog.length,
    }

    // Get backend diagnostics
    for (const [type, backend] of this.storageBackends) {
      const available = backend.isAvailable ? await backend.isAvailable() : true
      const providers = await backend.list()

      diagnostics.storageBackends[type] = {
        name: backend.getName(),
        type: backend.getType(),
        priority: backend.getPriority(),
        available,
        providerCount: providers.length,
        providers,
      }
    }

    return diagnostics
  }
}

export default UnifiedCredentialManager
