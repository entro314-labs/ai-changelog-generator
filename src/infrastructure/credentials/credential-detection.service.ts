/**
 * Credential Detection Service
 * Detects existing AI provider credentials from various sources on the machine
 *
 * Supported sources:
 * - Environment variables
 * - Gemini CLI (~/.gemini/oauth_creds.json, ~/.gemini/settings.json)
 * - Claude Code (macOS Keychain, ~/.claude/.credentials.json)
 * - GitHub Copilot (~/.config/github-copilot/hosts.json)
 * - .env files (workspace and global)
 */

import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Credential source types
 */
export const CredentialSource = {
  ENV_VAR: 'environment_variable',
  ENV_FILE: 'env_file',
  GEMINI_CLI: 'gemini_cli',
  CLAUDE_CODE: 'claude_code',
  GITHUB_COPILOT: 'github_copilot',
  MACOS_KEYCHAIN: 'macos_keychain',
}

/**
 * Authentication types
 */
export const AuthType = {
  API_KEY: 'api_key',
  OAUTH_TOKEN: 'oauth_token',
  SERVICE_ACCOUNT: 'service_account',
}

/**
 * Detected credential structure
 * @typedef {Object} DetectedCredential
 * @property {string} provider - Provider name (openai, anthropic, google, etc.)
 * @property {string} source - Source of the credential (env_var, gemini_cli, etc.)
 * @property {string} authType - Type of authentication (api_key, oauth_token, etc.)
 * @property {string} value - The credential value (may be redacted for display)
 * @property {string} [rawValue] - The actual credential value (only in secure contexts)
 * @property {string} [path] - Path to the credential file if applicable
 * @property {Date} [expiresAt] - Expiration time for OAuth tokens
 * @property {boolean} [isValid] - Whether the credential appears valid
 * @property {Object} [metadata] - Additional metadata
 */

export class CredentialDetectionService {
  [key: string]: any
  constructor(options: Record<string, any> = {}) {
    this.homeDir = os.homedir()
    this.platform = process.platform
    this.options = {
      includeRawValues: false,
      detectEnvVars: true,
      detectEnvFiles: true,
      detectGeminiCli: true,
      detectClaudeCode: true,
      detectGitHubCopilot: true,
      ...options,
    }
  }

  /**
   * Detect all available credentials from all sources
   * @returns {Promise<DetectedCredential[]>}
   */
  async detectAll() {
    const credentials: any[] = []

    if (this.options.detectEnvVars) {
      credentials.push(...this.detectFromEnvironmentVariables())
    }

    if (this.options.detectEnvFiles) {
      credentials.push(...this.detectFromEnvFiles())
    }

    if (this.options.detectGeminiCli) {
      credentials.push(...(await this.detectFromGeminiCli()))
    }

    if (this.options.detectClaudeCode) {
      credentials.push(...(await this.detectFromClaudeCode()))
    }

    if (this.options.detectGitHubCopilot) {
      credentials.push(...(await this.detectFromGitHubCopilot()))
    }

    // Deduplicate credentials, preferring OAuth over API keys
    return this.deduplicateCredentials(credentials)
  }

  /**
   * Detect credentials for a specific provider
   * @param {string} provider - Provider name
   * @returns {Promise<DetectedCredential[]>}
   */
  async detectForProvider(provider) {
    const allCredentials = await this.detectAll()
    return allCredentials.filter((c) => c.provider === provider)
  }

  /**
   * Detect credentials from environment variables
   * @returns {DetectedCredential[]}
   */
  detectFromEnvironmentVariables() {
    const credentials: any[] = []

    const envMappings = [
      { env: 'OPENAI_API_KEY', provider: 'openai' },
      { env: 'ANTHROPIC_API_KEY', provider: 'anthropic' },
      { env: 'GOOGLE_API_KEY', provider: 'google' },
      { env: 'GEMINI_API_KEY', provider: 'google' },
      { env: 'AZURE_OPENAI_KEY', provider: 'azure' },
      { env: 'HUGGINGFACE_API_KEY', provider: 'huggingface' },
      { env: 'AWS_ACCESS_KEY_ID', provider: 'bedrock' },
      { env: 'AI_GATEWAY_API_KEY', provider: 'vercel-gateway' },
    ]

    for (const mapping of envMappings) {
      const value = process.env[mapping.env]
      if (value && value.trim()) {
        credentials.push({
          provider: mapping.provider,
          source: CredentialSource.ENV_VAR,
          authType: AuthType.API_KEY,
          value: this.redactValue(value),
          rawValue: this.options.includeRawValues ? value : undefined,
          isValid: this.validateApiKeyFormat(value, mapping.provider),
          metadata: {
            envVar: mapping.env,
          },
        })
      }
    }

    return credentials
  }

  /**
   * Detect credentials from .env files
   * @returns {DetectedCredential[]}
   */
  detectFromEnvFiles() {
    const credentials: any[] = []

    const envFilePaths = [
      // Workspace paths
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env'),
      // Global paths
      path.join(this.homeDir, '.env'),
      path.join(this.homeDir, '.config', 'ai-changelog', '.env'),
      path.join(this.homeDir, '.config', 'ai-changelog', '.env.local'),
    ]

    const keyMappings = {
      OPENAI_API_KEY: 'openai',
      ANTHROPIC_API_KEY: 'anthropic',
      GOOGLE_API_KEY: 'google',
      GEMINI_API_KEY: 'google',
      AZURE_OPENAI_KEY: 'azure',
      HUGGINGFACE_API_KEY: 'huggingface',
      AWS_ACCESS_KEY_ID: 'bedrock',
      AI_GATEWAY_API_KEY: 'vercel-gateway',
    }

    for (const envFilePath of envFilePaths) {
      if (!fs.existsSync(envFilePath)) continue

      try {
        const content = fs.readFileSync(envFilePath, 'utf8')
        const vars = this.parseEnvFile(content)

        for (const [key, value] of Object.entries(vars)) {
          const provider = keyMappings[key]
          if (provider && value) {
            credentials.push({
              provider,
              source: CredentialSource.ENV_FILE,
              authType: AuthType.API_KEY,
              value: this.redactValue(value),
              rawValue: this.options.includeRawValues ? value : undefined,
              path: envFilePath,
              isValid: this.validateApiKeyFormat(value, provider),
              metadata: {
                envVar: key,
                filePath: envFilePath,
              },
            })
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    return credentials
  }

  /**
   * Detect credentials from Gemini CLI
   * @returns {Promise<DetectedCredential[]>}
   */
  async detectFromGeminiCli() {
    const credentials: any[] = []

    // Check for OAuth credentials
    const oauthCredsPath = path.join(this.homeDir, '.gemini', 'oauth_creds.json')
    if (fs.existsSync(oauthCredsPath)) {
      try {
        const content = fs.readFileSync(oauthCredsPath, 'utf8')
        const oauthCreds = JSON.parse(content)

        if (oauthCreds.access_token) {
          const expiresAt = oauthCreds.expiry_date
            ? new Date(oauthCreds.expiry_date)
            : oauthCreds.expires_in
              ? new Date(Date.now() + oauthCreds.expires_in * 1000)
              : undefined

          credentials.push({
            provider: 'google',
            source: CredentialSource.GEMINI_CLI,
            authType: AuthType.OAUTH_TOKEN,
            value: this.redactValue(oauthCreds.access_token),
            rawValue: this.options.includeRawValues ? oauthCreds.access_token : undefined,
            path: oauthCredsPath,
            expiresAt,
            isValid: !expiresAt || expiresAt > new Date(),
            metadata: {
              refreshToken: !!oauthCreds.refresh_token,
              scope: oauthCreds.scope,
              tokenType: oauthCreds.token_type,
            },
          })
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check for API key in .gemini/.env
    const geminiEnvPath = path.join(this.homeDir, '.gemini', '.env')
    if (fs.existsSync(geminiEnvPath)) {
      try {
        const content = fs.readFileSync(geminiEnvPath, 'utf8')
        const vars = this.parseEnvFile(content)

        if (vars.GEMINI_API_KEY || vars.GOOGLE_API_KEY) {
          const apiKey = vars.GEMINI_API_KEY || vars.GOOGLE_API_KEY
          credentials.push({
            provider: 'google',
            source: CredentialSource.GEMINI_CLI,
            authType: AuthType.API_KEY,
            value: this.redactValue(apiKey),
            rawValue: this.options.includeRawValues ? apiKey : undefined,
            path: geminiEnvPath,
            isValid: this.validateApiKeyFormat(apiKey, 'google'),
            metadata: {
              envVar: vars.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 'GOOGLE_API_KEY',
            },
          })
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check settings.json for authentication method
    const settingsPath = path.join(this.homeDir, '.gemini', 'settings.json')
    if (fs.existsSync(settingsPath)) {
      try {
        const content = fs.readFileSync(settingsPath, 'utf8')
        const settings = JSON.parse(content)

        // If settings indicate service account auth
        if (settings.auth_type === 'service_account' || settings.google_application_credentials) {
          const credPath =
            settings.google_application_credentials || process.env.GOOGLE_APPLICATION_CREDENTIALS

          if (credPath && fs.existsSync(credPath)) {
            credentials.push({
              provider: 'google',
              source: CredentialSource.GEMINI_CLI,
              authType: AuthType.SERVICE_ACCOUNT,
              value: `Service Account: ${path.basename(credPath)}`,
              path: credPath,
              isValid: true,
              metadata: {
                credentialsPath: credPath,
              },
            })
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return credentials
  }

  /**
   * Detect credentials from Claude Code
   * @returns {Promise<DetectedCredential[]>}
   */
  async detectFromClaudeCode() {
    const credentials: any[] = []

    // macOS: Check Keychain
    if (this.platform === 'darwin') {
      try {
        const { stdout } = await execAsync(
          'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null'
        )

        if (stdout && stdout.trim()) {
          try {
            const keychainCreds = JSON.parse(stdout.trim())

            if (keychainCreds.claudeAiOauth?.accessToken) {
              credentials.push({
                provider: 'anthropic',
                source: CredentialSource.MACOS_KEYCHAIN,
                authType: AuthType.OAUTH_TOKEN,
                value: this.redactValue(keychainCreds.claudeAiOauth.accessToken),
                rawValue: this.options.includeRawValues
                  ? keychainCreds.claudeAiOauth.accessToken
                  : undefined,
                expiresAt: keychainCreds.claudeAiOauth.expiresAt
                  ? new Date(keychainCreds.claudeAiOauth.expiresAt)
                  : undefined,
                isValid: true,
                metadata: {
                  keychainService: 'Claude Code-credentials',
                  hasRefreshToken: !!keychainCreds.claudeAiOauth.refreshToken,
                },
              })
            }
          } catch {
            // Raw token string, not JSON
            credentials.push({
              provider: 'anthropic',
              source: CredentialSource.MACOS_KEYCHAIN,
              authType: AuthType.OAUTH_TOKEN,
              value: this.redactValue(stdout.trim()),
              rawValue: this.options.includeRawValues ? stdout.trim() : undefined,
              isValid: true,
              metadata: {
                keychainService: 'Claude Code-credentials',
              },
            })
          }
        }
      } catch {
        // Keychain access failed or item not found
      }
    }

    // Linux/Other: Check ~/.claude/.credentials.json
    const claudeCredsPath = path.join(this.homeDir, '.claude', '.credentials.json')
    if (fs.existsSync(claudeCredsPath)) {
      try {
        const content = fs.readFileSync(claudeCredsPath, 'utf8')
        const claudeCreds = JSON.parse(content)

        if (claudeCreds.claudeAiOauth?.accessToken) {
          credentials.push({
            provider: 'anthropic',
            source: CredentialSource.CLAUDE_CODE,
            authType: AuthType.OAUTH_TOKEN,
            value: this.redactValue(claudeCreds.claudeAiOauth.accessToken),
            rawValue: this.options.includeRawValues
              ? claudeCreds.claudeAiOauth.accessToken
              : undefined,
            path: claudeCredsPath,
            expiresAt: claudeCreds.claudeAiOauth.expiresAt
              ? new Date(claudeCreds.claudeAiOauth.expiresAt)
              : undefined,
            isValid: true,
            metadata: {
              hasRefreshToken: !!claudeCreds.claudeAiOauth.refreshToken,
            },
          })
        }

        // Check for API key in credentials
        if (claudeCreds.apiKey) {
          credentials.push({
            provider: 'anthropic',
            source: CredentialSource.CLAUDE_CODE,
            authType: AuthType.API_KEY,
            value: this.redactValue(claudeCreds.apiKey),
            rawValue: this.options.includeRawValues ? claudeCreds.apiKey : undefined,
            path: claudeCredsPath,
            isValid: this.validateApiKeyFormat(claudeCreds.apiKey, 'anthropic'),
          })
        }
      } catch {
        // Ignore parse errors
      }
    }

    return credentials
  }

  /**
   * Detect credentials from GitHub Copilot
   * @returns {Promise<DetectedCredential[]>}
   */
  async detectFromGitHubCopilot() {
    const credentials: any[] = []

    // Check hosts.json
    const hostsPath = path.join(this.homeDir, '.config', 'github-copilot', 'hosts.json')
    if (fs.existsSync(hostsPath)) {
      try {
        const content = fs.readFileSync(hostsPath, 'utf8')
        const hosts = JSON.parse(content) as Record<string, { oauth_token?: string; user?: string }>

        // Check for github.com credentials
        const githubCreds = hosts['github.com']
        if (githubCreds?.oauth_token) {
          credentials.push({
            provider: 'github-copilot',
            source: CredentialSource.GITHUB_COPILOT,
            authType: AuthType.OAUTH_TOKEN,
            value: this.redactValue(githubCreds.oauth_token),
            rawValue: this.options.includeRawValues ? githubCreds.oauth_token : undefined,
            path: hostsPath,
            isValid: githubCreds.oauth_token.startsWith('ghu_'),
            metadata: {
              user: githubCreds.user,
              host: 'github.com',
            },
          })
        }

        // Check for GitHub Enterprise credentials
        for (const [host, creds] of Object.entries(hosts)) {
          if (host !== 'github.com' && creds?.oauth_token) {
            credentials.push({
              provider: 'github-copilot',
              source: CredentialSource.GITHUB_COPILOT,
              authType: AuthType.OAUTH_TOKEN,
              value: this.redactValue(creds.oauth_token),
              rawValue: this.options.includeRawValues ? creds.oauth_token : undefined,
              path: hostsPath,
              isValid: true,
              metadata: {
                user: creds.user,
                host,
                enterprise: true,
              },
            })
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check for GitHub CLI authentication (can be used for Copilot)
    const ghHostsPath = path.join(this.homeDir, '.config', 'gh', 'hosts.yml')
    if (fs.existsSync(ghHostsPath)) {
      try {
        const content = fs.readFileSync(ghHostsPath, 'utf8')
        // Simple YAML parsing for oauth_token
        const tokenMatch = content.match(/oauth_token:\s*(.+)/)
        const userMatch = content.match(/user:\s*(.+)/)

        if (tokenMatch && tokenMatch[1]) {
          const token = tokenMatch[1].trim()
          credentials.push({
            provider: 'github-copilot',
            source: CredentialSource.GITHUB_COPILOT,
            authType: AuthType.OAUTH_TOKEN,
            value: this.redactValue(token),
            rawValue: this.options.includeRawValues ? token : undefined,
            path: ghHostsPath,
            isValid: true,
            metadata: {
              user: userMatch ? userMatch[1].trim() : undefined,
              host: 'github.com',
              fromGhCli: true,
            },
          })
        }
      } catch {
        // Ignore parse errors
      }
    }

    return credentials
  }

  /**
   * Parse .env file content
   * @param {string} content
   * @returns {Object<string, string>}
   */
  parseEnvFile(content) {
    const vars: Record<string, any> = {}
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
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
   * Redact a credential value for display
   * @param {string} value
   * @returns {string}
   */
  redactValue(value) {
    if (!value || value.length < 12) {
      return '***'
    }
    return `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
  }

  /**
   * Validate API key format
   * @param {string} value
   * @param {string} provider
   * @returns {boolean}
   */
  validateApiKeyFormat(value, provider) {
    if (!value || typeof value !== 'string') {
      return false
    }

    const patterns = {
      openai: /^sk-[a-zA-Z0-9-_]{20,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9-_]{20,}$/,
      google: /^AIza[a-zA-Z0-9-_]{35,}$/,
      azure: /^[a-f0-9]{32}$/i,
      huggingface: /^hf_[a-zA-Z0-9]{34,}$/,
      bedrock: /^AKI[A-Z0-9]{17}$/,
      // Gateway keys are opaque and not documented as a fixed shape, so only a
      // conservative minimum length is enforced.
      'vercel-gateway': /^.{20,}$/,
    }

    const pattern = patterns[provider]
    if (!pattern) {
      return value.length >= 20 // Generic validation
    }

    return pattern.test(value)
  }

  /**
   * Deduplicate credentials, preferring OAuth over API keys and newer sources
   * @param {DetectedCredential[]} credentials
   * @returns {DetectedCredential[]}
   */
  deduplicateCredentials(credentials) {
    const byProvider = new Map<any, any>()

    // Priority order: OAuth > Service Account > API Key
    // Source priority: CLI tools > env files > env vars
    const authPriority = {
      [AuthType.OAUTH_TOKEN]: 3,
      [AuthType.SERVICE_ACCOUNT]: 2,
      [AuthType.API_KEY]: 1,
    }

    const sourcePriority = {
      [CredentialSource.GEMINI_CLI]: 5,
      [CredentialSource.CLAUDE_CODE]: 5,
      [CredentialSource.MACOS_KEYCHAIN]: 5,
      [CredentialSource.GITHUB_COPILOT]: 5,
      [CredentialSource.ENV_FILE]: 2,
      [CredentialSource.ENV_VAR]: 1,
    }

    for (const cred of credentials) {
      const existing = byProvider.get(cred.provider)

      if (!existing) {
        byProvider.set(cred.provider, cred)
        continue
      }

      // Compare by auth type priority first
      const existingAuthPriority = authPriority[existing.authType] || 0
      const newAuthPriority = authPriority[cred.authType] || 0

      if (newAuthPriority > existingAuthPriority) {
        byProvider.set(cred.provider, cred)
        continue
      }

      if (newAuthPriority === existingAuthPriority) {
        // Compare by source priority
        const existingSourcePriority = sourcePriority[existing.source] || 0
        const newSourcePriority = sourcePriority[cred.source] || 0

        if (newSourcePriority > existingSourcePriority) {
          byProvider.set(cred.provider, cred)
        }
      }
    }

    return Array.from(byProvider.values())
  }

  /**
   * Get a summary of detected credentials
   * @returns {Promise<Object>}
   */
  async getSummary() {
    const credentials = await this.detectAll()

    return {
      total: credentials.length,
      byProvider: credentials.reduce((acc, cred) => {
        acc[cred.provider] = cred
        return acc
      }, {}),
      bySource: credentials.reduce((acc, cred) => {
        if (!acc[cred.source]) acc[cred.source] = []
        acc[cred.source].push(cred.provider)
        return acc
      }, {}),
      providers: credentials.map((c) => c.provider),
      sources: [...new Set(credentials.map((c) => c.source))],
    }
  }

  /**
   * Get the best credential for a provider
   * @param {string} provider
   * @returns {Promise<DetectedCredential|null>}
   */
  async getBestCredential(provider) {
    const credentials = await this.detectForProvider(provider)

    if (credentials.length === 0) {
      return null
    }

    // Credentials are already sorted by priority from deduplication
    return credentials[0]
  }

  /**
   * Convert detected credential to config format
   * @param {DetectedCredential} credential
   * @returns {Object}
   */
  toConfigFormat(credential) {
    const keyMappings = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_API_KEY',
      azure: 'AZURE_OPENAI_KEY',
      huggingface: 'HUGGINGFACE_API_KEY',
      bedrock: 'AWS_ACCESS_KEY_ID',
      'github-copilot': 'GITHUB_COPILOT_TOKEN',
      'vercel-gateway': 'AI_GATEWAY_API_KEY',
    }

    const configKey =
      keyMappings[credential.provider] || `${credential.provider.toUpperCase()}_API_KEY`

    return {
      [configKey]: credential.rawValue || credential.value,
      [`${credential.provider.toUpperCase()}_AUTH_TYPE`]: credential.authType,
      [`${credential.provider.toUpperCase()}_AUTH_SOURCE`]: credential.source,
    }
  }
}

export default CredentialDetectionService
