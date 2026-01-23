import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import yaml from 'js-yaml'

import colors from '../../shared/constants/colors.js'
import {
  AuthType,
  CredentialDetectionService,
  CredentialSource,
} from '../credentials/credential-detection.service.js'
import { MODEL_CONFIGS } from '../providers/utils/model-config.js'

/**
 * Unified Configuration Manager
 * Consolidates config.js, model-config.js, and interactive-config.js logic
 * Enhanced with YAML changelog configuration support
 * Now supports automatic credential detection from various sources
 *
 * Responsibilities:
 * - Environment configuration loading
 * - Model configuration management
 * - Provider configuration
 * - Changelog configuration (YAML)
 * - Automatic credential detection (Gemini CLI, Claude Code, GitHub Copilot)
 * - OAuth token management
 * - Validation and recommendations
 */
export class ConfigurationManager {
  constructor(configPath = null, changelogConfigPath = null, options = {}) {
    this.options = {
      autoDetectCredentials: true,
      includeRawCredentials: true,
      ...options,
    }

    // Support direct config object injection (for VSCode extension)
    if (options.config && typeof options.config === 'object') {
      this.config = { ...this.loadDefaultConfig(), ...options.config }
      this.configPath = null // No file path when using injected config
    } else {
      this.configPath = configPath || this.findConfigFile()
      this.config = this.loadConfig()
    }

    this.changelogConfigPath = changelogConfigPath || this.findChangelogConfigFile()
    this.changelogConfig = this.loadChangelogConfig()
    this.modelConfigs = MODEL_CONFIGS
    this.detectedCredentials = []
    this.credentialSources = {}
    this.validate()
  }

  findConfigFile() {
    const possiblePaths = [
      '.env.local',
      '.changelog.config.js',
      'changelog.config.json',
      path.join(process.cwd(), '.env.local'),
    ]

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        return configPath
      }
    }

    return '.env.local' // Default
  }

  findChangelogConfigFile() {
    const possiblePaths = [
      'ai-changelog.config.yaml',
      'ai-changelog.config.yml',
      '.ai-changelog.yaml',
      '.ai-changelog.yml',
      'changelog.config.yaml',
      'changelog.config.yml',
    ]

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        return configPath
      }
    }

    return null // No changelog config found
  }

  loadDefaultConfig() {
    return {
      // AI Provider Settings
      AI_PROVIDER: process.env.AI_PROVIDER || 'auto',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
      OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3',

      // Azure OpenAI Settings
      AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
      AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
      AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o',
      AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',

      // Vertex AI Settings
      VERTEX_PROJECT_ID: process.env.VERTEX_PROJECT_ID,
      VERTEX_LOCATION: process.env.VERTEX_LOCATION || 'us-central1',
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,

      // LM Studio Settings
      LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',

      // General Settings
      GIT_PATH: process.env.GIT_PATH || process.cwd(),
      DEFAULT_ANALYSIS_MODE: process.env.DEFAULT_ANALYSIS_MODE || 'standard',
      RATE_LIMIT_DELAY: Number.parseInt(process.env.RATE_LIMIT_DELAY || '1000', 10),
      MAX_RETRIES: Number.parseInt(process.env.MAX_RETRIES || '3', 10),

      // Output Settings
      OUTPUT_FORMAT: process.env.OUTPUT_FORMAT || 'markdown',
      INCLUDE_ATTRIBUTION: process.env.INCLUDE_ATTRIBUTION !== 'false',

      // Debug Settings
      DEBUG: process.env.DEBUG === 'true',
      VERBOSE: process.env.VERBOSE === 'true',
    }
  }

  loadConfig() {
    const defaults = {
      // AI Provider Settings
      AI_PROVIDER: process.env.AI_PROVIDER || 'auto',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
      OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://localhost:11434',
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3',

      // Azure OpenAI Settings
      AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
      AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
      AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o',
      AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',

      // Vertex AI Settings
      VERTEX_PROJECT_ID: process.env.VERTEX_PROJECT_ID,
      VERTEX_LOCATION: process.env.VERTEX_LOCATION || 'us-central1',
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,

      // LM Studio Settings
      LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',

      // General Settings
      GIT_PATH: process.env.GIT_PATH || process.cwd(),
      DEFAULT_ANALYSIS_MODE: process.env.DEFAULT_ANALYSIS_MODE || 'standard',
      RATE_LIMIT_DELAY: Number.parseInt(process.env.RATE_LIMIT_DELAY || '1000', 10),
      MAX_RETRIES: Number.parseInt(process.env.MAX_RETRIES || '3', 10),

      // Output Settings
      OUTPUT_FORMAT: process.env.OUTPUT_FORMAT || 'markdown',
      INCLUDE_ATTRIBUTION: process.env.INCLUDE_ATTRIBUTION !== 'false',

      // Debug Settings
      DEBUG: process.env.DEBUG === 'true',
      VERBOSE: process.env.VERBOSE === 'true',
    }

    // Load from .env.local if it exists
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf8')
        const envVars = this.parseEnvFile(content)
        Object.assign(defaults, envVars)
      } catch (error) {
        console.warn(
          colors.warningMessage(
            `Warning: Could not load config from ${this.configPath}: ${error.message}`
          )
        )
      }
    }

    return defaults
  }

  /**
   * Initialize credential detection (async operation)
   * Call this after construction for automatic credential detection
   * @returns {Promise<void>}
   */
  async initializeCredentialDetection() {
    if (!this.options.autoDetectCredentials) {
      return
    }

    try {
      const detectionService = new CredentialDetectionService({
        includeRawValues: this.options.includeRawCredentials,
      })

      this.detectedCredentials = await detectionService.detectAll()

      // Merge detected credentials into config (without overwriting existing)
      this.mergeDetectedCredentials()

      // Log detected credentials summary
      if (!process.env.MCP_SERVER_MODE && this.detectedCredentials.length > 0) {
        this.logDetectedCredentials()
      }
    } catch (error) {
      console.warn(colors.warningMessage(`Warning: Credential detection failed: ${error.message}`))
    }
  }

  /**
   * Merge detected credentials into configuration
   * Does not overwrite existing config values
   */
  mergeDetectedCredentials() {
    for (const cred of this.detectedCredentials) {
      this.credentialSources[cred.provider] = {
        source: cred.source,
        authType: cred.authType,
        path: cred.path,
        expiresAt: cred.expiresAt,
      }

      // Map provider to config key
      const keyMappings = {
        openai: 'OPENAI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        google: 'GOOGLE_API_KEY',
        azure: 'AZURE_OPENAI_KEY',
        huggingface: 'HUGGINGFACE_API_KEY',
        bedrock: 'AWS_ACCESS_KEY_ID',
        'github-copilot': 'GITHUB_COPILOT_TOKEN',
      }

      const configKey = keyMappings[cred.provider]
      if (!configKey) continue

      // Only set if not already configured (don't overwrite explicit config)
      if (!this.config[configKey]) {
        const value = cred.rawValue || cred.value
        if (value && !value.includes('***')) {
          this.config[configKey] = value

          // Set auth type indicator
          if (cred.authType === AuthType.OAUTH_TOKEN) {
            this.config[`${cred.provider.toUpperCase().replace('-', '_')}_AUTH_TYPE`] = 'oauth'
          }
        }
      }

      // Special handling for Google OAuth tokens from Gemini CLI
      if (cred.provider === 'google' && cred.authType === AuthType.OAUTH_TOKEN) {
        if (!this.config.GOOGLE_OAUTH_TOKEN && cred.rawValue) {
          this.config.GOOGLE_OAUTH_TOKEN = cred.rawValue
        }
      }

      // Special handling for Azure OAuth tokens
      if (cred.provider === 'azure' && cred.authType === AuthType.OAUTH_TOKEN) {
        if (!this.config.AZURE_OAUTH_TOKEN && cred.rawValue) {
          this.config.AZURE_OAUTH_TOKEN = cred.rawValue
        }
      }
    }
  }

  /**
   * Log summary of detected credentials
   */
  logDetectedCredentials() {
    const bySource = {}
    for (const cred of this.detectedCredentials) {
      const sourceName = this.getSourceDisplayName(cred.source)
      if (!bySource[sourceName]) bySource[sourceName] = []
      bySource[sourceName].push(cred.provider)
    }

    console.log(colors.infoMessage('🔍 Auto-detected credentials:'))
    for (const [source, providers] of Object.entries(bySource)) {
      console.log(colors.dim(`   ${source}: ${providers.join(', ')}`))
    }
  }

  /**
   * Get human-readable source name
   * @param {string} source
   * @returns {string}
   */
  getSourceDisplayName(source) {
    const names = {
      [CredentialSource.ENV_VAR]: 'Environment Variables',
      [CredentialSource.ENV_FILE]: '.env File',
      [CredentialSource.GEMINI_CLI]: 'Gemini CLI',
      [CredentialSource.CLAUDE_CODE]: 'Claude Code',
      [CredentialSource.GITHUB_COPILOT]: 'GitHub Copilot',
      [CredentialSource.MACOS_KEYCHAIN]: 'macOS Keychain',
    }
    return names[source] || source
  }

  /**
   * Get credential source information for a provider
   * @param {string} provider
   * @returns {Object|null}
   */
  getCredentialSource(provider) {
    return this.credentialSources[provider] || null
  }

  /**
   * Check if a credential is from auto-detection
   * @param {string} provider
   * @returns {boolean}
   */
  isAutoDetectedCredential(provider) {
    return !!this.credentialSources[provider]
  }

  /**
   * Get all detected credentials
   * @returns {Array}
   */
  getDetectedCredentials() {
    return this.detectedCredentials
  }

  /**
   * Refresh detected credentials
   * @returns {Promise<void>}
   */
  async refreshCredentials() {
    this.detectedCredentials = []
    this.credentialSources = {}
    await this.initializeCredentialDetection()
    this.validate()
  }

  loadChangelogConfig() {
    // Default changelog configuration based on git-conventional-commits
    const defaultConfig = {
      convention: {
        commitTypes: [
          'feat', // Features
          'fix', // Bug fixes
          'docs', // Documentation
          'style', // Code style (formatting, missing semicolons, etc)
          'refactor', // Code refactoring
          'perf', // Performance improvements
          'test', // Tests
          'build', // Build system or external dependencies
          'ci', // CI/CD changes
          'chore', // Maintenance tasks
          'revert', // Reverting commits
          'merge', // Merge commits
        ],
        commitScopes: [],
        releaseTagGlobPattern: 'v[0-9]*.[0-9]*.[0-9]*',
      },
      changelog: {
        commitTypes: ['feat', 'fix', 'perf', 'refactor', 'docs', 'merge'],
        includeInvalidCommits: true,
        commitIgnoreRegexPattern: '^WIP ',
        headlines: {
          feat: '🚀 Features',
          fix: '🐛 Bug Fixes',
          perf: '⚡ Performance Improvements',
          refactor: '♻️ Refactoring',
          docs: '📚 Documentation',
          test: '🧪 Tests',
          build: '🔧 Build System',
          ci: '⚙️ CI/CD',
          chore: '🔧 Maintenance',
          style: '💄 Code Style',
          revert: '⏪ Reverts',
          merge: '🔀 Merges',
          breakingChange: '🚨 BREAKING CHANGES',
        },
        // Link generation support
        commitUrl: null,
        commitRangeUrl: null,
        issueUrl: null,
        issueRegexPattern: '#[0-9]+',
      },
    }

    if (!this.changelogConfigPath) {
      return defaultConfig
    }

    try {
      const content = fs.readFileSync(this.changelogConfigPath, 'utf8')
      const yamlConfig = yaml.load(content)

      // Deep merge with defaults
      return this.deepMergeConfig(defaultConfig, yamlConfig)
    } catch (error) {
      console.warn(
        colors.warningMessage(
          `Warning: Could not load changelog config from ${this.changelogConfigPath}: ${error.message}, using defaults`
        )
      )
      return defaultConfig
    }
  }

  deepMergeConfig(defaults, override) {
    const result = JSON.parse(JSON.stringify(defaults))

    if (!override || typeof override !== 'object') {
      return result
    }

    for (const key in override) {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.deepMergeConfig(result[key] || {}, override[key])
      } else {
        result[key] = override[key]
      }
    }

    return result
  }

  parseEnvFile(content) {
    const envVars = {}
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          envVars[key.trim()] = value
        }
      }
    }

    return envVars
  }

  validate() {
    const issues = []
    const recommendations = []

    // Check for AI provider configuration
    const hasAnyProvider =
      this.hasOpenAI() ||
      this.hasAnthropic() ||
      this.hasGoogle() ||
      this.hasHuggingFace() ||
      this.hasOllama() ||
      this.hasAzureOpenAI() ||
      this.hasVertexAI() ||
      this.hasLMStudio() ||
      this.hasGitHubCopilot()

    if (!hasAnyProvider) {
      issues.push('No AI provider configured')
      recommendations.push(
        'Configure at least one AI provider (OpenAI, Anthropic, Google, GitHub Copilot, etc.)'
      )
    }

    // Git path validation
    if (!fs.existsSync(this.config.GIT_PATH)) {
      issues.push('Git path does not exist')
      recommendations.push('Set GIT_PATH to a valid git repository')
    }

    // Provider-specific validations
    if (this.config.AI_PROVIDER === 'azure' && !this.hasAzureOpenAI()) {
      issues.push('Azure OpenAI selected but not properly configured')
      recommendations.push('Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY')
    }

    if (this.config.AI_PROVIDER === 'vertex' && !this.hasVertexAI()) {
      issues.push('Vertex AI selected but not properly configured')
      recommendations.push('Set VERTEX_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS')
    }

    this.validationResult = { issues, recommendations }
  }

  // Provider availability checks
  hasOpenAI() {
    return !!this.config.OPENAI_API_KEY
  }

  hasAnthropic() {
    return !!this.config.ANTHROPIC_API_KEY
  }

  hasGoogle() {
    // Check for API key or OAuth token (from Gemini CLI)
    return !!(this.config.GOOGLE_API_KEY || this.config.GOOGLE_OAUTH_TOKEN)
  }

  hasHuggingFace() {
    return !!this.config.HUGGINGFACE_API_KEY
  }

  hasOllama() {
    return !!this.config.OLLAMA_HOST
  }

  hasAzureOpenAI() {
    // Check for API key, OAuth token, or Azure AD auth
    return !!(
      (this.config.AZURE_OPENAI_ENDPOINT && this.config.AZURE_OPENAI_KEY) ||
      (this.config.AZURE_OPENAI_ENDPOINT && this.config.AZURE_OAUTH_TOKEN) ||
      (this.config.AZURE_OPENAI_ENDPOINT && this.config.AZURE_USE_AD_AUTH === 'true') ||
      (this.config.OPENAI_BASE_URL?.includes('.azure.com') && this.config.OPENAI_API_KEY)
    )
  }

  hasVertexAI() {
    return !!(this.config.VERTEX_PROJECT_ID && this.config.GOOGLE_APPLICATION_CREDENTIALS)
  }

  hasLMStudio() {
    return !!this.config.LMSTUDIO_BASE_URL
  }

  hasGitHubCopilot() {
    return !!this.config.GITHUB_COPILOT_TOKEN
  }

  // Model configuration methods
  getOptimalModelConfig(analysisMode = 'standard', _complexity = 'medium') {
    const modes = {
      simple: 'simple',
      standard: 'standard',
      detailed: 'complex',
      enterprise: 'complex',
    }

    const modelType = modes[analysisMode] || 'standard'

    // Return configuration for the active provider
    const provider = this.getActiveProvider()
    const providerConfig = this.modelConfigs[provider]

    if (!providerConfig) {
      return { model: 'auto', capabilities: {} }
    }

    const modelKey = `${modelType}Model`
    const model = providerConfig[modelKey] || providerConfig.standardModel

    return {
      model,
      capabilities: providerConfig.capabilities || {},
      contextWindow: providerConfig.contextWindow || 8192,
      maxTokens: providerConfig.maxTokens || 4096,
    }
  }

  getModelRecommendation(commitInfo) {
    const { files = 0, lines = 0, breaking = false, complex = false } = commitInfo

    // Determine complexity
    let analysisMode = 'standard'

    if (breaking || complex || files > 20 || lines > 500) {
      analysisMode = 'detailed'
    } else if (files > 5 || lines > 100) {
      analysisMode = 'standard'
    } else {
      analysisMode = 'simple'
    }

    return this.getOptimalModelConfig(analysisMode)
  }

  getActiveProvider() {
    if (this.config.AI_PROVIDER !== 'auto') {
      return this.config.AI_PROVIDER
    }

    // Auto-detect available provider (priority order)
    if (this.hasOpenAI()) {
      return 'openai'
    }
    if (this.hasAnthropic()) {
      return 'anthropic'
    }
    if (this.hasGoogle()) {
      return 'google'
    }
    if (this.hasAzureOpenAI()) {
      return 'azure'
    }
    if (this.hasGitHubCopilot()) {
      return 'github-copilot'
    }
    if (this.hasVertexAI()) {
      return 'vertex'
    }
    if (this.hasOllama()) {
      return 'ollama'
    }
    if (this.hasHuggingFace()) {
      return 'huggingface'
    }
    if (this.hasLMStudio()) {
      return 'lmstudio'
    }

    return 'none'
  }

  // Configuration getters
  get(key) {
    return this.config[key]
  }

  getAll() {
    return { ...this.config }
  }

  set(key, value) {
    this.config[key] = value
  }

  // Provider configuration
  getProviderConfig(providerName) {
    const configs = {
      openai: {
        apiKey: this.config.OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
      },
      anthropic: {
        apiKey: this.config.ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1',
      },
      google: {
        apiKey: this.config.GOOGLE_API_KEY,
        oauthToken: this.config.GOOGLE_OAUTH_TOKEN,
        baseURL: 'https://generativelanguage.googleapis.com/v1',
        authType: this.config.GOOGLE_OAUTH_TOKEN ? 'oauth' : 'api_key',
      },
      azure: {
        apiKey: this.config.AZURE_OPENAI_KEY,
        oauthToken: this.config.AZURE_OAUTH_TOKEN,
        endpoint: this.config.AZURE_OPENAI_ENDPOINT,
        deploymentName: this.config.AZURE_OPENAI_DEPLOYMENT_NAME,
        apiVersion: this.config.AZURE_OPENAI_API_VERSION,
        useAdAuth: this.config.AZURE_USE_AD_AUTH,
        baseURL: this.config.OPENAI_BASE_URL,
      },
      vertex: {
        projectId: this.config.VERTEX_PROJECT_ID,
        location: this.config.VERTEX_LOCATION,
        credentials: this.config.GOOGLE_APPLICATION_CREDENTIALS,
      },
      ollama: {
        host: this.config.OLLAMA_HOST,
        model: this.config.OLLAMA_MODEL,
      },
      huggingface: {
        apiKey: this.config.HUGGINGFACE_API_KEY,
        baseURL: 'https://api-inference.huggingface.co',
      },
      lmstudio: {
        baseURL: this.config.LMSTUDIO_BASE_URL,
      },
      'github-copilot': {
        token: this.config.GITHUB_COPILOT_TOKEN,
        authType: 'oauth',
      },
    }

    return configs[providerName] || {}
  }

  // Environment setup helpers
  getRequiredEnvVars(provider) {
    const requirements = {
      openai: ['OPENAI_API_KEY'],
      anthropic: ['ANTHROPIC_API_KEY'],
      google: ['GOOGLE_API_KEY'], // Or GOOGLE_OAUTH_TOKEN
      azure: ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_KEY'], // Or AZURE_OAUTH_TOKEN
      vertex: ['VERTEX_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'],
      huggingface: ['HUGGINGFACE_API_KEY'],
      ollama: ['OLLAMA_HOST'],
      lmstudio: ['LMSTUDIO_BASE_URL'],
      'github-copilot': ['GITHUB_COPILOT_TOKEN'],
    }

    return requirements[provider] || []
  }

  validateProvider(providerName) {
    const required = this.getRequiredEnvVars(providerName)
    const missing = required.filter((key) => !this.config[key])

    return {
      valid: missing.length === 0,
      missing,
      configured: required.filter((key) => !!this.config[key]),
    }
  }

  // Configuration update methods
  async updateConfig(updates) {
    Object.assign(this.config, updates)
    await this.saveConfig()
    this.validate()
  }

  async saveConfig() {
    try {
      const envContent = Object.entries(this.config)
        .map(([key, value]) => `${key}=${value || ''}`)
        .join('\n')

      await fs.promises.writeFile(this.configPath, envContent, 'utf8')
      console.log(colors.successMessage(`✅ Configuration saved to ${this.configPath}`))
    } catch (error) {
      console.error(colors.errorMessage(`Failed to save configuration: ${error.message}`))
      throw error
    }
  }

  // Validation results
  getValidationResult() {
    return this.validationResult
  }

  isValid() {
    return this.validationResult.issues.length === 0
  }

  // Debug and logging
  logConfiguration() {
    if (!this.config.DEBUG) {
      return
    }

    console.log(colors.header('🔧 Configuration Debug:'))
    console.log(`Config path: ${colors.file(this.configPath)}`)
    console.log(`Changelog config path: ${colors.file(this.changelogConfigPath || 'default')}`)
    console.log(`Active provider: ${colors.highlight(this.getActiveProvider())}`)
    console.log(`Git path: ${colors.file(this.config.GIT_PATH)}`)

    if (this.validationResult.issues.length > 0) {
      console.log(colors.warningMessage('Issues:'))
      this.validationResult.issues.forEach((issue) => {
        console.log(`  - ${issue}`)
      })
    }
  }

  // Changelog configuration getters
  getChangelogConfig() {
    return this.changelogConfig
  }

  getConventionConfig() {
    return this.changelogConfig?.convention || {}
  }

  getCommitTypes() {
    return (
      this.changelogConfig?.convention?.commitTypes || [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ]
    )
  }

  getChangelogCommitTypes() {
    return this.changelogConfig?.changelog?.commitTypes || this.getCommitTypes()
  }

  getHeadlines() {
    return this.changelogConfig.changelog.headlines
  }

  getCommitUrl() {
    return this.changelogConfig.changelog.commitUrl
  }

  getCommitRangeUrl() {
    return this.changelogConfig.changelog.commitRangeUrl
  }

  getIssueUrl() {
    return this.changelogConfig.changelog.issueUrl
  }

  getIssueRegexPattern() {
    const pattern = this.changelogConfig.changelog.issueRegexPattern
    return pattern ? new RegExp(pattern, 'g') : /#[0-9]+/g
  }

  shouldIncludeInvalidCommits() {
    return this.changelogConfig.changelog.includeInvalidCommits
  }

  getCommitIgnoreRegex() {
    const pattern = this.changelogConfig.changelog.commitIgnoreRegexPattern
    return pattern ? new RegExp(pattern) : /^WIP /
  }

  /**
   * Get the complete configuration object
   * @returns {Object} Configuration object
   */
  getConfig() {
    return this.config || {}
  }
}
