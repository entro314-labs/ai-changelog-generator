/**
 * Config File Storage Backend
 *
 * Stores credentials in encrypted JSON file at:
 * ~/.config/ai-changelog/credentials.json
 *
 * Features:
 * - AES-256-GCM encryption
 * - Device-specific key derivation
 * - Metadata storage (auth type, created date, etc.)
 */

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BaseStorage } from './base-storage.js'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const SALT_LENGTH = 32
const TAG_LENGTH = 16
const ITERATIONS = 100000

export class ConfigStorage extends BaseStorage {
  constructor(options = {}) {
    super(options)
    this.configDir = options.configDir || path.join(os.homedir(), '.config', 'ai-changelog')
    this.configFile = path.join(this.configDir, 'credentials.json')
    this.keyFile = path.join(this.configDir, '.key')
    this.masterKey = null
  }

  /**
   * Ensure config directory exists
   * @private
   */
  _ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 })
    }
  }

  /**
   * Get or create master key
   * @private
   * @returns {Buffer}
   */
  _getMasterKey() {
    if (this.masterKey) {
      return this.masterKey
    }

    this._ensureConfigDir()

    // Try to load existing key
    if (fs.existsSync(this.keyFile)) {
      try {
        const keyData = fs.readFileSync(this.keyFile, 'utf8')
        this.masterKey = Buffer.from(keyData, 'hex')
        return this.masterKey
      } catch (error) {
        console.warn('Failed to read key file, generating new key:', error.message)
      }
    }

    // Generate new key
    this.masterKey = randomBytes(KEY_LENGTH)
    fs.writeFileSync(this.keyFile, this.masterKey.toString('hex'), {
      mode: 0o600,
      encoding: 'utf8',
    })

    return this.masterKey
  }

  /**
   * Derive encryption key from master key and salt
   * @private
   * @param {Buffer} salt - Salt for key derivation
   * @returns {Buffer}
   */
  _deriveKey(salt) {
    const masterKey = this._getMasterKey()
    return pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256')
  }

  /**
   * Encrypt data
   * @private
   * @param {string} data - Data to encrypt
   * @returns {Object} { encrypted: string, salt: string, iv: string, tag: string }
   */
  _encrypt(data) {
    const salt = randomBytes(SALT_LENGTH)
    const key = this._deriveKey(salt)
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    }
  }

  /**
   * Decrypt data
   * @private
   * @param {Object} encryptedData - { encrypted, salt, iv, tag }
   * @returns {string}
   */
  _decrypt(encryptedData) {
    const salt = Buffer.from(encryptedData.salt, 'hex')
    const key = this._deriveKey(salt)
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const tag = Buffer.from(encryptedData.tag, 'hex')

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * Load credentials from file
   * @private
   * @returns {Object}
   */
  _loadCredentials() {
    if (!fs.existsSync(this.configFile)) {
      return {}
    }

    try {
      const content = fs.readFileSync(this.configFile, 'utf8')
      const data = JSON.parse(content)

      // Decrypt credentials
      const credentials = {}
      for (const [provider, encryptedCred] of Object.entries(data.credentials || {})) {
        try {
          const decrypted = this._decrypt(encryptedCred.encrypted)
          credentials[provider] = {
            value: decrypted,
            metadata: encryptedCred.metadata,
          }
        } catch (error) {
          console.warn(`Failed to decrypt credential for ${provider}:`, error.message)
        }
      }

      return credentials
    } catch (error) {
      console.warn('Failed to load credentials file:', error.message)
      return {}
    }
  }

  /**
   * Save credentials to file
   * @private
   * @param {Object} credentials - Credentials object
   */
  _saveCredentials(credentials) {
    this._ensureConfigDir()

    // Encrypt credentials
    const encryptedData = {
      version: '1.0',
      credentials: {},
    }

    for (const [provider, cred] of Object.entries(credentials)) {
      encryptedData.credentials[provider] = {
        encrypted: this._encrypt(cred.value),
        metadata: cred.metadata,
      }
    }

    fs.writeFileSync(this.configFile, JSON.stringify(encryptedData, null, 2), {
      mode: 0o600,
      encoding: 'utf8',
    })
  }

  /**
   * Get credential for a provider
   * @param {string} provider - Provider name
   * @returns {Promise<string|null>}
   */
  async get(provider) {
    const credentials = this._loadCredentials()
    return credentials[provider]?.value || null
  }

  /**
   * Set credential for a provider
   * @param {string} provider - Provider name
   * @param {string} credential - Credential value
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async set(provider, credential, metadata = {}) {
    const credentials = this._loadCredentials()

    credentials[provider] = {
      value: credential,
      metadata: {
        ...metadata,
        updatedAt: new Date().toISOString(),
        createdAt: credentials[provider]?.metadata?.createdAt || new Date().toISOString(),
      },
    }

    this._saveCredentials(credentials)
  }

  /**
   * Delete credential for a provider
   * @param {string} provider - Provider name
   * @returns {Promise<boolean>}
   */
  async delete(provider) {
    const credentials = this._loadCredentials()

    if (!credentials[provider]) {
      return false
    }

    delete credentials[provider]
    this._saveCredentials(credentials)

    return true
  }

  /**
   * List all providers with credentials
   * @returns {Promise<string[]>}
   */
  async list() {
    const credentials = this._loadCredentials()
    return Object.keys(credentials)
  }

  /**
   * Get metadata for a credential
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>}
   */
  async getMetadata(provider) {
    const credentials = this._loadCredentials()
    return credentials[provider]?.metadata || null
  }

  /**
   * Check if storage is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      this._ensureConfigDir()
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get storage type identifier
   * @returns {string}
   */
  getType() {
    return 'config'
  }

  /**
   * Get human-readable storage name
   * @returns {string}
   */
  getName() {
    return 'Config File'
  }

  /**
   * Get priority for this storage type
   * @returns {number}
   */
  getPriority() {
    return 10 // High priority (user explicitly configured)
  }

  /**
   * Get config file path
   * @returns {string}
   */
  getConfigPath() {
    return this.configFile
  }
}

export default ConfigStorage
