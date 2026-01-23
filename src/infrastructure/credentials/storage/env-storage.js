/**
 * Environment Variable Storage Backend
 *
 * Handles credentials from:
 * 1. Workspace .env files (highest priority)
 * 2. Global .env files (medium priority)
 * 3. System environment variables (lowest priority)
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { BaseStorage } from './base-storage.js'

/**
 * Provider to environment variable key mapping
 */
const PROVIDER_KEY_MAP = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  azure: 'AZURE_OPENAI_KEY',
  bedrock: 'AWS_ACCESS_KEY_ID',
  huggingface: 'HUGGINGFACE_API_KEY',
  ollama: 'OLLAMA_HOST',
  lmstudio: 'LMSTUDIO_BASE_URL',
}

/**
 * Additional Azure configuration keys
 */
const AZURE_CONFIG_KEYS = [
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_DEPLOYMENT_NAME',
  'AZURE_OPENAI_API_VERSION',
  'AZURE_OPENAI_USE_V1_API',
  'AZURE_USE_AD_AUTH',
]

/**
 * Vertex AI configuration keys
 */
const VERTEX_CONFIG_KEYS = ['VERTEX_PROJECT_ID', 'VERTEX_LOCATION', 'GOOGLE_APPLICATION_CREDENTIALS']

export class EnvStorage extends BaseStorage {
  constructor(options = {}) {
    super(options)
    this.workspaceRoot = options.workspaceRoot || process.cwd()
    this.homeDir = os.homedir()
    this.cache = new Map()
    this.cacheTimestamp = null
    this.cacheTTL = 5000 // 5 seconds
  }

  /**
   * Get all .env file paths in priority order
   * @private
   * @returns {string[]}
   */
  _getEnvFilePaths() {
    const paths = []

    // Workspace .env files (highest priority)
    paths.push(path.join(this.workspaceRoot, '.env.local'), path.join(this.workspaceRoot, '.env'))

    // Global .env files (medium priority)
    if (process.platform === 'darwin' || process.platform === 'linux') {
      paths.push(
        path.join(this.homeDir, '.config', 'ai-changelog', '.env'),
        path.join(this.homeDir, '.config', 'ai-changelog', '.env.local'),
        path.join(this.homeDir, '.env'),
        path.join(this.homeDir, '.ai-changelog.env')
      )
    } else if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(this.homeDir, 'AppData', 'Roaming')
      paths.push(
        path.join(appData, 'ai-changelog', '.env'),
        path.join(appData, 'ai-changelog', '.env.local'),
        path.join(this.homeDir, '.env'),
        path.join(this.homeDir, '.ai-changelog.env')
      )
    }

    return paths
  }

  /**
   * Parse .env file content
   * @private
   * @param {string} content - File content
   * @returns {Object<string, string>}
   */
  _parseEnvFile(content) {
    const vars = {}
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip comments and empty lines
      if (trimmed.startsWith('#') || !trimmed || !trimmed.includes('=')) {
        continue
      }

      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=').trim()
      const cleanValue = value.replace(/^["']|["']$/g, '')

      if (key && cleanValue) {
        vars[key.trim()] = cleanValue
      }
    }

    return vars
  }

  /**
   * Load all environment variables from all sources
   * @private
   * @returns {Object<string, {value: string, source: string}>}
   */
  _loadAllEnvVars() {
    // Check cache
    if (this.cache.size > 0 && this.cacheTimestamp && Date.now() - this.cacheTimestamp < this.cacheTTL) {
      return this.cache
    }

    const envVars = new Map()

    // 1. System environment variables (lowest priority)
    for (const [key, value] of Object.entries(process.env)) {
      if (value && value.trim()) {
        envVars.set(key, {
          value: value.trim(),
          source: 'system_env',
        })
      }
    }

    // 2. Global and workspace .env files (higher priority)
    const envFilePaths = this._getEnvFilePaths()

    for (const envFilePath of envFilePaths) {
      if (!fs.existsSync(envFilePath)) continue

      try {
        const content = fs.readFileSync(envFilePath, 'utf8')
        const vars = this._parseEnvFile(content)

        for (const [key, value] of Object.entries(vars)) {
          const isWorkspace = envFilePath.startsWith(this.workspaceRoot)
          const source = isWorkspace ? 'workspace_env' : 'global_env'

          // Higher priority sources override lower ones
          envVars.set(key, {
            value,
            source,
            filePath: envFilePath,
          })
        }
      } catch (error) {
        // Ignore read errors
        console.warn(`Failed to read env file ${envFilePath}:`, error.message)
      }
    }

    // Cache results
    this.cache = envVars
    this.cacheTimestamp = Date.now()

    return envVars
  }

  /**
   * Invalidate cache (call after writing .env files)
   * @private
   */
  _invalidateCache() {
    this.cache.clear()
    this.cacheTimestamp = null
  }

  /**
   * Get credential for a provider
   * @param {string} provider - Provider name
   * @returns {Promise<string|null>}
   */
  async get(provider) {
    const envKey = PROVIDER_KEY_MAP[provider]
    if (!envKey) {
      return null
    }

    const envVars = this._loadAllEnvVars()
    const envVar = envVars.get(envKey)

    return envVar ? envVar.value : null
  }

  /**
   * Set credential for a provider (writes to workspace .env.local)
   * @param {string} provider - Provider name
   * @param {string} credential - Credential value
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async set(provider, credential, metadata = {}) {
    const envKey = PROVIDER_KEY_MAP[provider]
    if (!envKey) {
      throw new Error(`Unknown provider: ${provider}`)
    }

    // Write to workspace .env.local
    const envFilePath = path.join(this.workspaceRoot, '.env.local')
    let content = ''
    let keyExists = false

    // Read existing content
    if (fs.existsSync(envFilePath)) {
      content = fs.readFileSync(envFilePath, 'utf8')
      const lines = content.split('\n')
      const updatedLines = []

      for (const line of lines) {
        if (line.trim().startsWith(`${envKey}=`)) {
          updatedLines.push(`${envKey}="${credential}"`)
          keyExists = true
        } else {
          updatedLines.push(line)
        }
      }

      content = updatedLines.join('\n')
    }

    // Add key if it doesn't exist
    if (!keyExists) {
      if (content && !content.endsWith('\n')) {
        content += '\n'
      }
      content += `${envKey}="${credential}"\n`
    }

    // Write to file
    fs.writeFileSync(envFilePath, content, 'utf8')

    // Invalidate cache
    this._invalidateCache()
  }

  /**
   * Delete credential for a provider (removes from workspace .env.local)
   * @param {string} provider - Provider name
   * @returns {Promise<boolean>}
   */
  async delete(provider) {
    const envKey = PROVIDER_KEY_MAP[provider]
    if (!envKey) {
      return false
    }

    const envFilePath = path.join(this.workspaceRoot, '.env.local')
    if (!fs.existsSync(envFilePath)) {
      return false
    }

    const content = fs.readFileSync(envFilePath, 'utf8')
    const lines = content.split('\n')
    const updatedLines = lines.filter((line) => !line.trim().startsWith(`${envKey}=`))

    if (lines.length === updatedLines.length) {
      return false // Key not found
    }

    fs.writeFileSync(envFilePath, updatedLines.join('\n'), 'utf8')

    // Invalidate cache
    this._invalidateCache()

    return true
  }

  /**
   * List all providers with credentials
   * @returns {Promise<string[]>}
   */
  async list() {
    const envVars = this._loadAllEnvVars()
    const providers = []

    for (const [provider, envKey] of Object.entries(PROVIDER_KEY_MAP)) {
      if (envVars.has(envKey)) {
        providers.push(provider)
      }
    }

    return providers
  }

  /**
   * Get metadata for a credential
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>}
   */
  async getMetadata(provider) {
    const envKey = PROVIDER_KEY_MAP[provider]
    if (!envKey) {
      return null
    }

    const envVars = this._loadAllEnvVars()
    const envVar = envVars.get(envKey)

    if (!envVar) {
      return null
    }

    return {
      source: envVar.source,
      filePath: envVar.filePath,
      envKey,
    }
  }

  /**
   * Get all configuration for a provider (including additional config keys)
   * @param {string} provider - Provider name
   * @returns {Promise<Object>}
   */
  async getConfig(provider) {
    const config = {}
    const envVars = this._loadAllEnvVars()

    // Get main credential
    const envKey = PROVIDER_KEY_MAP[provider]
    if (envKey && envVars.has(envKey)) {
      config[envKey] = envVars.get(envKey).value
    }

    // Get additional config for Azure
    if (provider === 'azure') {
      for (const key of AZURE_CONFIG_KEYS) {
        if (envVars.has(key)) {
          config[key] = envVars.get(key).value
        }
      }
    }

    // Get additional config for Vertex
    if (provider === 'google' || provider === 'vertex') {
      for (const key of VERTEX_CONFIG_KEYS) {
        if (envVars.has(key)) {
          config[key] = envVars.get(key).value
        }
      }
    }

    return config
  }

  /**
   * Get storage type identifier
   * @returns {string}
   */
  getType() {
    return 'env'
  }

  /**
   * Get human-readable storage name
   * @returns {string}
   */
  getName() {
    return 'Environment Variables'
  }

  /**
   * Get priority for this storage type
   * @returns {number}
   */
  getPriority() {
    return 10 // High priority (user explicitly configured)
  }
}

export default EnvStorage
