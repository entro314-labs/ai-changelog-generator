/**
 * Keychain Storage Backend
 *
 * Uses OS-native secure storage via keytar:
 * - macOS: Keychain
 * - Windows: Credential Vault
 * - Linux: Secret Service API / libsecret
 *
 * Note: Requires keytar dependency. Gracefully degrades if not available.
 */

import { BaseStorage } from './base-storage.js'

const SERVICE_NAME = 'ai-changelog-generator'

export class KeychainStorage extends BaseStorage {
  [key: string]: any
  constructor(options: Record<string, any> = {}) {
    super(options)
    this.serviceName = options.serviceName || SERVICE_NAME
    this.keytar = null
    this._initPromise = null
  }

  /**
   * Initialize keytar (lazy load)
   * @private
   * @returns {Promise<boolean>}
   */
  async _init() {
    if (this._initPromise) {
      return this._initPromise
    }

    this._initPromise = (async () => {
      try {
        // Try to import keytar
        const keytarModule = await import('keytar')
        this.keytar = keytarModule.default || keytarModule
        return true
      } catch (error) {
        console.warn('keytar not available, keychain storage disabled:', error.message)
        return false
      }
    })()

    return this._initPromise
  }

  /**
   * Get account name for provider
   * @private
   * @param {string} provider - Provider name
   * @returns {string}
   */
  _getAccountName(provider) {
    return `${provider}-api-key`
  }

  /**
   * Check if keychain storage is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return await this._init()
  }

  /**
   * Get credential for a provider
   * @param {string} provider - Provider name
   * @returns {Promise<string|null>}
   */
  async get(provider) {
    const available = await this._init()
    if (!available) {
      return null
    }

    try {
      const account = this._getAccountName(provider)
      const credential = await this.keytar.getPassword(this.serviceName, account)
      return credential
    } catch (error) {
      console.warn(`Failed to get credential from keychain for ${provider}:`, error.message)
      return null
    }
  }

  /**
   * Set credential for a provider
   * @param {string} provider - Provider name
   * @param {string} credential - Credential value
   * @param {Object} metadata - Additional metadata (stored separately)
   * @returns {Promise<void>}
   */
  async set(provider, credential, metadata: Record<string, any> = {}) {
    const available = await this._init()
    if (!available) {
      throw new Error('Keychain storage not available')
    }

    try {
      const account = this._getAccountName(provider)
      await this.keytar.setPassword(this.serviceName, account, credential)

      // Store metadata separately if provided
      if (Object.keys(metadata).length > 0) {
        const metadataAccount = `${account}-metadata`
        await this.keytar.setPassword(this.serviceName, metadataAccount, JSON.stringify(metadata))
      }
    } catch (error) {
      throw new Error(`Failed to save credential to keychain: ${error.message}`, { cause: error })
    }
  }

  /**
   * Delete credential for a provider
   * @param {string} provider - Provider name
   * @returns {Promise<boolean>}
   */
  async delete(provider) {
    const available = await this._init()
    if (!available) {
      return false
    }

    try {
      const account = this._getAccountName(provider)
      const deleted = await this.keytar.deletePassword(this.serviceName, account)

      // Also delete metadata if exists
      const metadataAccount = `${account}-metadata`
      await this.keytar.deletePassword(this.serviceName, metadataAccount)

      return deleted
    } catch (error) {
      console.warn(`Failed to delete credential from keychain for ${provider}:`, error.message)
      return false
    }
  }

  /**
   * List all providers with credentials
   * @returns {Promise<string[]>}
   */
  async list() {
    const available = await this._init()
    if (!available) {
      return []
    }

    try {
      const credentials = await this.keytar.findCredentials(this.serviceName)
      const providers: any[] = []

      for (const cred of credentials) {
        // Skip metadata entries
        if (cred.account.endsWith('-metadata')) {
          continue
        }

        // Extract provider name from account
        const provider = cred.account.replace('-api-key', '')
        providers.push(provider)
      }

      return providers
    } catch (error) {
      console.warn('Failed to list keychain credentials:', error.message)
      return []
    }
  }

  /**
   * Get metadata for a credential
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>}
   */
  async getMetadata(provider) {
    const available = await this._init()
    if (!available) {
      return null
    }

    try {
      const account = this._getAccountName(provider)
      const metadataAccount = `${account}-metadata`
      const metadataJson = await this.keytar.getPassword(this.serviceName, metadataAccount)

      if (!metadataJson) {
        return null
      }

      return JSON.parse(metadataJson)
    } catch {
      return null
    }
  }

  /**
   * Get storage type identifier
   * @returns {string}
   */
  getType() {
    return 'keychain'
  }

  /**
   * Get human-readable storage name
   * @returns {string}
   */
  getName() {
    // Platform-specific names
    if (process.platform === 'darwin') {
      return 'macOS Keychain'
    } else if (process.platform === 'win32') {
      return 'Windows Credential Vault'
    } else if (process.platform === 'linux') {
      return 'Linux Secret Service'
    } else {
      return 'System Keychain'
    }
  }

  /**
   * Get priority for this storage type
   * @returns {number}
   */
  getPriority() {
    return 10 // High priority (user explicitly configured)
  }

  /**
   * Get diagnostic information
   * @returns {Promise<Object>}
   */
  async getDiagnostics() {
    const available = await this.isAvailable()

    return {
      available,
      platform: process.platform,
      serviceName: this.serviceName,
      storageName: this.getName(),
    }
  }
}

export default KeychainStorage
