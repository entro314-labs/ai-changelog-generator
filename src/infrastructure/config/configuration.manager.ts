import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// js-yaml 5 dropped the default export in favour of named exports.
import { load as loadYaml } from 'js-yaml'

import colors from '../../shared/constants/colors.js'
import {
  AuthType,
  CredentialDetectionService,
  CredentialSource,
} from '../credentials/credential-detection.service.js'
import { UnifiedCredentialManager } from '../credentials/unified-credential-manager.js'
import { MODEL_CONFIGS } from '../providers/utils/model-config.js'
import { decodeBedrockCredential } from '../providers/utils/provider-utils.js'

function normalizeAzureOpenAIBaseUrl(rawValue: unknown): string | undefined {
  if (typeof rawValue !== 'string') {
    return undefined
  }

  const trimmed = rawValue.trim().replace(/\/+$/, '')
  if (!trimmed) {
    return undefined
  }

  if (trimmed.includes('/openai/v1')) {
    return trimmed.endsWith('/openai/v1') ? `${trimmed}/` : trimmed
  }

  return `${trimmed}/openai/v1/`
}

/**
 * Literal default runtime configuration (the lowest precedence layer).
 * Intentionally free of process.env reads so that the precedence chain
 * (explicit options > process.env > .ai-changelog.json > YAML > defaults)
 * can be composed deterministically in loadConfig().
 */
function buildBaseRuntimeConfig(): Record<string, any> {
  return {
    // AI Provider Settings
    AI_PROVIDER: 'auto',
    OPENAI_API_KEY: undefined,
    ANTHROPIC_API_KEY: undefined,
    GOOGLE_API_KEY: undefined,
    GOOGLE_OAUTH_TOKEN: undefined,
    GEMINI_API_KEY: undefined,
    HUGGINGFACE_API_KEY: undefined,
    GITHUB_COPILOT_TOKEN: undefined,
    OLLAMA_HOST: 'http://localhost:11434',
    OLLAMA_MODEL: 'llama3.3',

    // Azure OpenAI Settings
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_KEY: undefined,
    AZURE_OAUTH_TOKEN: undefined,
    AZURE_USE_AD_AUTH: undefined,
    AZURE_OPENAI_DEPLOYMENT_NAME: 'gpt-5-pro',
    AZURE_OPENAI_API_VERSION: undefined,
    OPENAI_BASE_URL: undefined,

    // Default model override (mapped to provider-specific model selection)
    AI_MODEL: undefined,

    // Vertex AI Settings
    VERTEX_PROJECT_ID: undefined,
    VERTEX_LOCATION: 'us-central1',
    GOOGLE_APPLICATION_CREDENTIALS: undefined,

    // LM Studio Settings
    LMSTUDIO_BASE_URL: 'http://localhost:1234/v1',

    // Bedrock / AWS Settings
    AWS_REGION: undefined,
    AWS_DEFAULT_REGION: undefined,
    AWS_ACCESS_KEY_ID: undefined,
    AWS_SECRET_ACCESS_KEY: undefined,
    AWS_SESSION_TOKEN: undefined,
    AWS_PROFILE: undefined,

    // General Settings
    GIT_PATH: process.cwd(),
    DEFAULT_ANALYSIS_MODE: 'standard',
    RATE_LIMIT_DELAY: 1000,
    MAX_RETRIES: 3,

    // Output Settings
    OUTPUT_FORMAT: 'markdown',
    INCLUDE_ATTRIBUTION: true,

    // Debug Settings
    DEBUG: false,
    VERBOSE: false,
  }
}

/**
 * Resolve the runtime config values that originate from process.env.
 * Only keys that are actually present in the environment are returned so
 * that this layer overrides lower layers (defaults, YAML, .ai-changelog.json)
 * without clobbering them with undefined.
 */
function buildEnvRuntimeOverlay(): Record<string, any> {
  const overlay: Record<string, any> = {}

  const passthroughKeys = [
    'AI_PROVIDER',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_API_KEY',
    'GOOGLE_OAUTH_TOKEN',
    'GEMINI_API_KEY',
    'HUGGINGFACE_API_KEY',
    'GITHUB_COPILOT_TOKEN',
    'OLLAMA_HOST',
    'OLLAMA_MODEL',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_KEY',
    'AZURE_OAUTH_TOKEN',
    'AZURE_USE_AD_AUTH',
    'AZURE_OPENAI_DEPLOYMENT_NAME',
    'AZURE_OPENAI_API_VERSION',
    'OPENAI_BASE_URL',
    'AI_MODEL',
    'AI_TEMPERATURE',
    'AI_GATEWAY_API_KEY',
    'AI_GATEWAY_BASE_URL',
    'AI_GATEWAY_MODEL',
    'VERCEL_OIDC_TOKEN',
    'VERTEX_PROJECT_ID',
    'VERTEX_LOCATION',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'LMSTUDIO_BASE_URL',
    'AWS_REGION',
    'AWS_DEFAULT_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'AWS_PROFILE',
    'GIT_PATH',
    'DEFAULT_ANALYSIS_MODE',
    'OUTPUT_FORMAT',
  ]

  for (const key of passthroughKeys) {
    if (process.env[key] !== undefined) {
      overlay[key] = process.env[key]
    }
  }

  // AWS region aliasing (either variable satisfies both runtime keys)
  if (process.env.AWS_REGION !== undefined || process.env.AWS_DEFAULT_REGION !== undefined) {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
    overlay.AWS_REGION = region
    overlay.AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION
  }

  // Numeric coercions
  if (process.env.RATE_LIMIT_DELAY !== undefined) {
    overlay.RATE_LIMIT_DELAY = Number.parseInt(process.env.RATE_LIMIT_DELAY, 10)
  }
  if (process.env.MAX_RETRIES !== undefined) {
    overlay.MAX_RETRIES = Number.parseInt(process.env.MAX_RETRIES, 10)
  }

  // Boolean coercions
  if (process.env.INCLUDE_ATTRIBUTION !== undefined) {
    overlay.INCLUDE_ATTRIBUTION = process.env.INCLUDE_ATTRIBUTION !== 'false'
  }
  if (process.env.DEBUG !== undefined) {
    overlay.DEBUG = process.env.DEBUG === 'true'
  }
  if (process.env.VERBOSE !== undefined) {
    overlay.VERBOSE = process.env.VERBOSE === 'true'
  }

  return overlay
}

/**
 * The runtime config the rest of the system consumes is fully derived from
 * the literal defaults plus the process.env overlay. This preserves the
 * historical "defaults already include env" behaviour for callers that inject
 * a `config` object (so explicit `undefined` values still clear env-derived
 * values) while keeping the layered precedence available for file loading.
 */
function buildDefaultRuntimeConfig(): Record<string, any> {
  const config = { ...buildBaseRuntimeConfig(), ...buildEnvRuntimeOverlay() }
  config.OPENAI_BASE_URL = normalizeAzureOpenAIBaseUrl(
    config.OPENAI_BASE_URL || config.AZURE_OPENAI_ENDPOINT
  )
  return config
}

/**
 * Map the documented `.ai-changelog.json` schema onto the flat runtime config
 * keys consumed by the provider manager and orchestrator. Only keys that carry
 * a meaningful value are emitted so this layer never clobbers lower layers with
 * empty strings or undefined.
 */
function mapJsonConfigToRuntime(jsonConfig: Record<string, any>): Record<string, any> {
  const overlay: Record<string, any> = {}

  const assign = (key: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      overlay[key] = value
    }
  }

  assign('AI_PROVIDER', jsonConfig.provider)
  assign('DEFAULT_ANALYSIS_MODE', jsonConfig.analysisMode)
  assign('OUTPUT_FORMAT', jsonConfig.outputFormat)
  if (typeof jsonConfig.includeAttribution === 'boolean') {
    overlay.INCLUDE_ATTRIBUTION = jsonConfig.includeAttribution
  }
  assign('AI_MODEL', jsonConfig.model)

  const azure = jsonConfig.azure
  if (azure && typeof azure === 'object') {
    assign('AZURE_OPENAI_ENDPOINT', azure.endpoint)
    assign('AZURE_OPENAI_DEPLOYMENT_NAME', azure.deploymentName)
    assign('AZURE_OPENAI_API_VERSION', azure.apiVersion)
    assign('OPENAI_BASE_URL', azure.baseUrl)
  }

  const vertex = jsonConfig.vertex
  if (vertex && typeof vertex === 'object') {
    assign('VERTEX_PROJECT_ID', vertex.projectId)
    assign('VERTEX_LOCATION', vertex.location)
  }

  const ollama = jsonConfig.ollama
  if (ollama && typeof ollama === 'object') {
    assign('OLLAMA_HOST', ollama.host)
    assign('OLLAMA_MODEL', ollama.model)
  }

  const lmstudio = jsonConfig.lmstudio
  if (lmstudio && typeof lmstudio === 'object') {
    assign('LMSTUDIO_BASE_URL', lmstudio.baseUrl)
  }

  return overlay
}

/**
 * Map the YAML changelog config onto the runtime config. The YAML file is
 * primarily a changelog-formatting document, but a handful of keys influence
 * runtime behaviour (analysis defaults) and sit at the lowest file precedence.
 */
function mapYamlConfigToRuntime(yamlConfig: Record<string, any>): Record<string, any> {
  const overlay: Record<string, any> = {}

  if (!yamlConfig || typeof yamlConfig !== 'object') {
    return overlay
  }

  const runtime = yamlConfig.runtime
  if (runtime && typeof runtime === 'object') {
    if (typeof runtime.provider === 'string' && runtime.provider) {
      overlay.AI_PROVIDER = runtime.provider
    }
    if (typeof runtime.analysisMode === 'string' && runtime.analysisMode) {
      overlay.DEFAULT_ANALYSIS_MODE = runtime.analysisMode
    }
    if (typeof runtime.outputFormat === 'string' && runtime.outputFormat) {
      overlay.OUTPUT_FORMAT = runtime.outputFormat
    }
    if (typeof runtime.includeAttribution === 'boolean') {
      overlay.INCLUDE_ATTRIBUTION = runtime.includeAttribution
    }
    if (typeof runtime.model === 'string' && runtime.model) {
      overlay.AI_MODEL = runtime.model
    }
  }

  return overlay
}

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
  [key: string]: any
  constructor(
    configPath: any = null,
    changelogConfigPath: any = null,
    options: Record<string, any> = {}
  ) {
    this.options = {
      // CLI-tool credential discovery is opt-in. Explicit environment variables,
      // workspace env files, encrypted config, and keychain entries are still
      // resolved as primary storage sources.
      autoDetectCredentials: false,
      includeRawCredentials: true,
      ...options,
    }

    // Discover the JSON settings file (.ai-changelog.json) and YAML config up
    // front so both the runtime config and changelog config can consume them.
    this.jsonConfigPath = options.jsonConfigPath || this.findJsonConfigFile()
    this.changelogConfigPath = changelogConfigPath || this.findChangelogConfigFile()
    this.jsonConfig = this.loadJsonConfig()
    this.changelogConfig = this.loadChangelogConfig()

    // Support direct config object injection (for VSCode extension).
    // Injected config is treated as explicit/CLI options: it sits at the top of
    // the precedence chain and its explicit `undefined` values clear lower
    // layers (preserving historical behaviour relied upon by callers/tests).
    if (options.config && typeof options.config === 'object') {
      this.config = { ...this.composeRuntimeConfig(), ...options.config }
      this.configPath = null // No file path when using injected config
    } else {
      this.configPath = configPath || this.findConfigFile()
      this.config = this.loadConfig()
    }

    this.modelConfigs = MODEL_CONFIGS
    this.detectedCredentials = []
    this.credentialSources = {}
    this.credentialInitializationPromise = null
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

  /**
   * Locate the `.ai-changelog.json` settings file. Searches the current working
   * directory first, then walks up parent directories so the file is
   * discoverable from anywhere inside a project. The walk is bounded to the
   * project: it stops after inspecting the first directory that looks like a
   * project/repository root (contains `.git` or `package.json`) so discovery
   * never escapes into unrelated parent directories such as the user's home.
   * @returns {string|null} Absolute path to the file, or null when not found.
   */
  findJsonConfigFile() {
    const fileName = '.ai-changelog.json'
    let current = process.cwd()

    while (true) {
      const candidate = path.join(current, fileName)
      if (fs.existsSync(candidate)) {
        return candidate
      }

      // Stop once we have inspected a project/repository root.
      const atProjectRoot =
        fs.existsSync(path.join(current, '.git')) ||
        fs.existsSync(path.join(current, 'package.json'))

      const parent = path.dirname(current)
      if (atProjectRoot || parent === current) {
        break
      }
      current = parent
    }

    return null // No JSON settings file found
  }

  /**
   * Load and parse the `.ai-changelog.json` settings file.
   * @returns {Record<string, any>} Parsed JSON object, or an empty object when
   *   the file is absent or cannot be parsed.
   */
  loadJsonConfig(): Record<string, any> {
    if (!this.jsonConfigPath || !fs.existsSync(this.jsonConfigPath)) {
      return {}
    }

    try {
      const content = fs.readFileSync(this.jsonConfigPath, 'utf8')
      const parsed = JSON.parse(content)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        colors.warningMessage(
          `Warning: Could not load config from ${this.jsonConfigPath}: ${message}`
        )
      )
      return {}
    }
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
    return buildDefaultRuntimeConfig()
  }

  /**
   * Read the `.env.local` (or alternate env) file into a flat key/value map.
   * This file sits at the same precedence tier as `.ai-changelog.json` — below
   * `process.env` and above the YAML config — so it must NOT override real
   * environment variables.
   * @returns {Record<string, any>} Parsed env-file variables (empty if absent).
   */
  loadEnvFileOverlay(): Record<string, any> {
    if (!this.configPath || !fs.existsSync(this.configPath)) {
      return {}
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf8')
      return this.parseEnvFile(content)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        colors.warningMessage(`Warning: Could not load config from ${this.configPath}: ${message}`)
      )
      return {}
    }
  }

  /**
   * Compose the runtime configuration following the documented precedence:
   *   CLI/explicit options > process.env > .ai-changelog.json > .env.local
   *     > ai-changelog.config.yaml > literal defaults.
   *
   * Note: explicit/CLI options are applied by the caller (constructor) on top of
   * this result so their explicit `undefined` values can clear lower layers.
   * @returns {Record<string, any>} The fully composed runtime config.
   */
  composeRuntimeConfig(): Record<string, any> {
    const config: Record<string, any> = buildBaseRuntimeConfig()

    // Layer (lowest first): YAML runtime keys
    Object.assign(config, mapYamlConfigToRuntime(this.rawChangelogConfig || {}))

    // Layer: .env.local file (file tier, below process.env)
    Object.assign(config, this.loadEnvFileOverlay())

    // Layer: .ai-changelog.json (file tier, above .env.local)
    Object.assign(config, mapJsonConfigToRuntime(this.jsonConfig || {}))

    // Layer (highest before explicit options): process.env
    Object.assign(config, buildEnvRuntimeOverlay())

    // Derive Azure base URL after all sources have been applied
    config.OPENAI_BASE_URL = normalizeAzureOpenAIBaseUrl(
      config.OPENAI_BASE_URL || config.AZURE_OPENAI_ENDPOINT
    )

    return config
  }

  loadConfig() {
    return this.composeRuntimeConfig()
  }

  /**
   * Initialize credential detection (async operation)
   * Call this after construction for automatic credential detection
   * @returns {Promise<void>}
   */
  async initializeCredentialDetection() {
    if (this.credentialInitializationPromise) {
      return await this.credentialInitializationPromise
    }

    this.credentialInitializationPromise = this._initializeCredentialDetection()
    return await this.credentialInitializationPromise
  }

  async _initializeCredentialDetection() {
    // Auto-detection (env scan + CLI-tool discovery) is gated by the user preference.
    if (this.options.autoDetectCredentials) {
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
        console.warn(
          colors.warningMessage(`Warning: Credential detection failed: ${error.message}`)
        )
      }
    }

    // Credentials the user EXPLICITLY stored (OS keychain, encrypted config file) are not
    // "auto-detection", so resolve them through the UnifiedCredentialManager regardless of
    // the autoDetectCredentials preference. This makes the keychain + encrypted-config
    // storage backends authoritative at runtime (previously they were never consulted),
    // while env/.env values already present in this.config keep their higher precedence.
    try {
      await this.resolveStoredCredentials()
    } catch (error) {
      console.warn(
        colors.warningMessage(`Warning: Stored credential resolution failed: ${error.message}`)
      )
    }
  }

  /**
   * Lazily construct the single UnifiedCredentialManager instance. It is the source of
   * truth for credential storage operations (keychain, encrypted config, env) and is also
   * consumed by the VS Code extension adapter.
   * @returns {UnifiedCredentialManager}
   */
  getCredentialManager() {
    if (!this.credentialManager) {
      this.credentialManager = new UnifiedCredentialManager(this.options)
    }
    return this.credentialManager
  }

  /**
   * Resolve credentials held in the unified storage backends (keychain + encrypted config)
   * and inject any that are not already populated from env/.env. Applies the documented
   * priority cascade (user preference > primary storage > discovered; OAuth > API key;
   * newer > older) via UnifiedCredentialManager. Env-configured providers are skipped so
   * process.env keeps its precedence.
   * @returns {Promise<void>}
   */
  async resolveStoredCredentials() {
    const manager = this.getCredentialManager()

    // Feed user-opted-in CLI-tool discoveries to the manager as DISCOVERED credentials
    // (lowest priority, never auto-imported to primary storage) so its priority resolution
    // and status/diagnostics reflect them.
    for (const cred of this.detectedCredentials || []) {
      if (cred.source === CredentialSource.ENV_VAR || cred.source === CredentialSource.ENV_FILE) {
        continue // env is already a primary backend; do not double-count as discovered
      }
      const value = cred.rawValue || cred.value
      if (!value || value.includes('***')) {
        continue
      }
      manager.addDiscoveredCredential(cred.provider, {
        value,
        authType: cred.authType,
        source: cred.source,
        metadata: { path: cred.path, expiresAt: cred.expiresAt },
      })
    }

    const providerKeyMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_API_KEY',
      huggingface: 'HUGGINGFACE_API_KEY',
      bedrock: 'AWS_ACCESS_KEY_ID',
      'github-copilot': 'GITHUB_COPILOT_TOKEN',
    }

    // Only resolve providers that actually have a credential in some backend, so the common
    // env-only path never triggers needless keychain probes.
    const storedProviders = await manager.listProviders()
    for (const provider of storedProviders) {
      if (provider === 'bedrock') {
        if (this.config.AWS_ACCESS_KEY_ID && this.config.AWS_SECRET_ACCESS_KEY) {
          continue
        }
        const active = await manager.getActiveCredential(provider)
        if (!active?.value) {
          continue
        }
        const bundle = decodeBedrockCredential(active.value)
        this.config.AWS_ACCESS_KEY_ID = bundle.accessKeyId
        this.config.AWS_SECRET_ACCESS_KEY = bundle.secretAccessKey
        this.config.AWS_SESSION_TOKEN = bundle.sessionToken
        this.config.AWS_REGION = bundle.region || this.config.AWS_REGION
        this.credentialSources[provider] = {
          source: active.source,
          authType: active.authType,
        }
        continue
      }

      const configKey = providerKeyMap[provider]
      if (!configKey || this.config[configKey]) {
        continue // unknown provider, or env/.env already supplied a higher-precedence value
      }

      const active = await manager.getActiveCredential(provider)
      if (!active?.value) {
        continue
      }

      if (active.authType === AuthType.OAUTH_TOKEN) {
        const authTypeKey = `${provider.toUpperCase().replace('-', '_')}_AUTH_TYPE`
        if (!this.config[authTypeKey]) {
          this.config[authTypeKey] = 'oauth'
        }
        if (provider === 'google' && !this.config.GOOGLE_OAUTH_TOKEN) {
          this.config.GOOGLE_OAUTH_TOKEN = active.value
          continue
        }
        if (provider === 'azure' && !this.config.AZURE_OAUTH_TOKEN) {
          this.config.AZURE_OAUTH_TOKEN = active.value
          continue
        }
      }

      this.config[configKey] = active.value
      this.credentialSources[provider] = this.credentialSources[provider] || {
        source: active.source,
        authType: active.authType,
      }
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

      const value = cred.rawValue || cred.value
      if (!value || value.includes('***')) {
        continue
      }

      const authTypeKey = `${cred.provider.toUpperCase().replace('-', '_')}_AUTH_TYPE`
      if (cred.authType === AuthType.OAUTH_TOKEN && !this.config[authTypeKey]) {
        this.config[authTypeKey] = 'oauth'
      }

      if (cred.provider === 'google') {
        if (cred.authType === AuthType.OAUTH_TOKEN) {
          if (!this.config.GOOGLE_OAUTH_TOKEN) {
            this.config.GOOGLE_OAUTH_TOKEN = value
          }
        } else if (!this.config.GOOGLE_API_KEY) {
          this.config.GOOGLE_API_KEY = value
        }
        continue
      }

      if (cred.provider === 'azure') {
        if (cred.authType === AuthType.OAUTH_TOKEN) {
          if (!this.config.AZURE_OAUTH_TOKEN) {
            this.config.AZURE_OAUTH_TOKEN = value
          }
        } else if (!this.config.AZURE_OPENAI_KEY) {
          this.config.AZURE_OPENAI_KEY = value
        }
        continue
      }

      if (cred.provider === 'anthropic' && cred.authType === AuthType.OAUTH_TOKEN) {
        continue
      }

      const keyMappings = {
        openai: 'OPENAI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        huggingface: 'HUGGINGFACE_API_KEY',
        bedrock: 'AWS_ACCESS_KEY_ID',
        'github-copilot': 'GITHUB_COPILOT_TOKEN',
      }

      const configKey = keyMappings[cred.provider]
      if (configKey && !this.config[configKey]) {
        this.config[configKey] = value
      }
    }
  }

  /**
   * Log summary of detected credentials
   */
  logDetectedCredentials() {
    const bySource: Record<string, any> = {}
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
    this.credentialInitializationPromise = null
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
        commitIgnoreRegexPattern: '^WIP |^wip:',
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
      this.rawChangelogConfig = {}
      return defaultConfig
    }

    try {
      const content = fs.readFileSync(this.changelogConfigPath, 'utf8')
      // js-yaml 5 throws on empty input where v4 returned undefined, so an empty
      // or whitespace-only config file must short-circuit to the defaults rather
      // than surface as a parse warning.
      const yamlConfig = content.trim().length > 0 ? loadYaml(content) : undefined

      // Retain the raw parsed YAML so runtime-influencing keys can be mapped
      // into the runtime config without re-reading the file.
      this.rawChangelogConfig =
        yamlConfig && typeof yamlConfig === 'object' ? (yamlConfig as Record<string, any>) : {}

      // Deep merge with defaults
      return this.deepMergeConfig(defaultConfig, yamlConfig)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        colors.warningMessage(
          `Warning: Could not load changelog config from ${this.changelogConfigPath}: ${message}, using defaults`
        )
      )
      this.rawChangelogConfig = {}
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
    const envVars: Record<string, any> = {}
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
    const issues: any[] = []
    const recommendations: any[] = []

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
      recommendations.push('Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY (or OPENAI_BASE_URL)')
    }

    if (this.config.AI_PROVIDER === 'vertex' && !this.hasVertexAI()) {
      issues.push('Vertex AI selected but not properly configured')
      recommendations.push('Set VERTEX_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS')
    }

    this.validationResult = { issues, recommendations }

    return issues.length === 0
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
    const baseUrl = normalizeAzureOpenAIBaseUrl(
      this.config.OPENAI_BASE_URL || this.config.AZURE_OPENAI_ENDPOINT
    )

    return !!(
      baseUrl &&
      (this.config.AZURE_OPENAI_KEY ||
        this.config.OPENAI_API_KEY ||
        this.config.AZURE_OAUTH_TOKEN ||
        this.config.AZURE_USE_AD_AUTH === 'true')
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

  hasBedrock() {
    return !!(
      (this.config.AWS_ACCESS_KEY_ID && this.config.AWS_SECRET_ACCESS_KEY) ||
      this.config.AWS_REGION ||
      this.config.AWS_DEFAULT_REGION ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      this.config.AWS_PROFILE ||
      process.env.AWS_PROFILE
    )
  }

  /**
   * Resolve whether a real AI provider credential is available.
   * Returns true only when at least one provider's credentials resolve, so
   * callers can gate AI features without instantiating providers.
   * @returns {boolean}
   */
  isAIAvailable(): boolean {
    return this.getActiveProvider() !== 'none'
  }

  /**
   * Build the optimal model configuration for the active provider.
   *
   * This is the single source of model selection for the AI layer (matching
   * the ConfigManager contract in types/index.d.ts). Returns the full tier map
   * so callers can pick a model for any analysis mode, honoring any explicit
   * `AI_MODEL` override from the runtime config.
   * @returns {{provider: string, models: Record<string, string>, features: Record<string, any>} | null}
   */
  getOptimalModelConfig() {
    const provider = this.getActiveProvider()
    const providerConfig = this.modelConfigs[provider]

    if (!provider || provider === 'none' || !providerConfig) {
      return null
    }

    const override = this.config.AI_MODEL

    const models: Record<string, string> = {
      default: override || providerConfig.standardModel,
      simple: override || providerConfig.smallModel || providerConfig.standardModel,
      medium: override || providerConfig.mediumModel || providerConfig.standardModel,
      complex: override || providerConfig.complexModel || providerConfig.standardModel,
    }

    if (providerConfig.reasoningModel) {
      models.reasoning = providerConfig.reasoningModel
    }
    if (providerConfig.codingModel) {
      models.coding = providerConfig.codingModel
    }

    const features: Record<string, any> = {
      reasoning: !!providerConfig.reasoningModel,
      largeContext: (providerConfig.contextWindow || 0) >= 128000,
      promptCaching: !!providerConfig.supportsEffortParameter,
      tools: true,
      contextWindow: providerConfig.contextWindow,
      maxOutputTokens: providerConfig.maxOutputTokens,
    }

    return { provider, models, features }
  }

  /**
   * Recommend a model based on commit complexity. Single source consumed by the
   * AI layer (matching the ConfigManager contract in types/index.d.ts).
   * @param {{files?: number, lines?: number, breaking?: boolean, complex?: boolean}} [commitInfo]
   * @returns {{model: string, reason: string, features: string[]} | null}
   */
  getModelRecommendation(commitInfo: Record<string, any> = {}) {
    const optimal = this.getOptimalModelConfig()
    if (!optimal) {
      return null
    }

    const { files = 0, lines = 0, breaking = false, complex = false } = commitInfo

    let tier: 'simple' | 'medium' | 'complex'
    let reason: string

    if (breaking || complex || files > 20 || lines > 500) {
      tier = 'complex'
      reason = breaking
        ? 'Breaking changes require the most capable model'
        : 'High complexity changes require the most capable model'
    } else if (files > 5 || lines > 100) {
      tier = 'medium'
      reason = 'Moderate changes benefit from a balanced model'
    } else {
      tier = 'simple'
      reason = 'Simple changes can use an efficient model'
    }

    const model = optimal.models[tier] || optimal.models.default

    const features: string[] = []
    if (optimal.features.reasoning) {
      features.push('reasoning')
    }
    if (optimal.features.largeContext) {
      features.push('largeContext')
    }
    if (optimal.features.promptCaching) {
      features.push('promptCaching')
    }
    if (optimal.features.tools) {
      features.push('tools')
    }

    return { model, reason, features }
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
    if (this.hasBedrock()) {
      return 'bedrock'
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
        apiKey: this.config.AZURE_OPENAI_KEY || this.config.OPENAI_API_KEY,
        oauthToken: this.config.AZURE_OAUTH_TOKEN,
        endpoint: this.config.AZURE_OPENAI_ENDPOINT,
        deploymentName: this.config.AZURE_OPENAI_DEPLOYMENT_NAME,
        useAdAuth: this.config.AZURE_USE_AD_AUTH,
        baseURL: normalizeAzureOpenAIBaseUrl(
          this.config.OPENAI_BASE_URL || this.config.AZURE_OPENAI_ENDPOINT
        ),
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
      bedrock: {
        region: this.config.AWS_REGION || this.config.AWS_DEFAULT_REGION,
        accessKeyId: this.config.AWS_ACCESS_KEY_ID,
        secretAccessKey: this.config.AWS_SECRET_ACCESS_KEY,
        sessionToken: this.config.AWS_SESSION_TOKEN,
        profile: this.config.AWS_PROFILE,
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
      bedrock: [],
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
    return pattern ? new RegExp(pattern) : /^WIP |^wip:/
  }

  // Runtime configuration getters (single source for previously-dead config)
  getDefaultAnalysisMode() {
    return this.config.DEFAULT_ANALYSIS_MODE || 'standard'
  }

  getDefaultOutputFormat() {
    return this.config.OUTPUT_FORMAT || 'markdown'
  }

  getIncludeAttribution() {
    return this.config.INCLUDE_ATTRIBUTION !== false
  }

  getRateLimitDelay() {
    const value = Number(this.config.RATE_LIMIT_DELAY)
    return Number.isFinite(value) ? value : 1000
  }

  getMaxRetries() {
    const value = Number(this.config.MAX_RETRIES)
    return Number.isFinite(value) ? value : 3
  }

  /**
   * Get the complete configuration object
   * @returns {Object} Configuration object
   */
  getConfig() {
    return this.config || {}
  }

  /**
   * Resolve the path used to read/write the `.ai-changelog.json` settings file.
   * Falls back to the current working directory when no file has been
   * discovered yet (so writes create the file in the repo/cwd root).
   * @returns {string}
   */
  resolveJsonConfigPath(): string {
    return this.jsonConfigPath || path.join(process.cwd(), '.ai-changelog.json')
  }

  /**
   * Persist the `.ai-changelog.json` settings file with pretty-printed JSON,
   * merging the provided patch onto any existing on-disk settings.
   * @param {Record<string, any>} patch - Keys to merge into the file.
   * @returns {Record<string, any>} The merged object written to disk.
   */
  persistJsonConfig(patch: Record<string, any>): Record<string, any> {
    const targetPath = this.resolveJsonConfigPath()

    let existing: Record<string, any> = {}
    if (fs.existsSync(targetPath)) {
      try {
        const content = fs.readFileSync(targetPath, 'utf8')
        const parsed = JSON.parse(content)
        if (parsed && typeof parsed === 'object') {
          existing = parsed
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(
          colors.warningMessage(`Warning: Could not read ${targetPath} before saving: ${message}`)
        )
      }
    }

    const merged = { version: '1.0.0', ...existing, ...patch }

    fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')

    // Keep in-memory state aligned with what was persisted.
    this.jsonConfigPath = targetPath
    this.jsonConfig = merged

    return merged
  }

  /**
   * Persist the active provider selection to `.ai-changelog.json` and apply it
   * to the live runtime config. Consumed by the providers switch flow.
   * @param {string} name - Provider identifier (e.g. "openai", "azure").
   * @returns {void}
   */
  setActiveProvider(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('setActiveProvider requires a non-empty provider name')
    }

    this.config.AI_PROVIDER = name
    this.persistJsonConfig({ provider: name })
    this.validate()
  }

  /**
   * Write a sample `.ai-changelog.json` to the current working directory so
   * users have a documented starting point. Never overwrites an existing file.
   * @returns {void}
   */
  createSampleConfig(): void {
    const targetPath = path.join(process.cwd(), '.ai-changelog.json')

    if (fs.existsSync(targetPath)) {
      console.log(
        colors.warningMessage(`Configuration already exists at ${targetPath}; not overwriting.`)
      )
      return
    }

    const sample = {
      version: '1.0.0',
      provider: 'auto',
      analysisMode: 'standard',
      outputFormat: 'markdown',
      includeAttribution: true,
      model: '',
      azure: {
        endpoint: '',
        deploymentName: '',
        apiVersion: '',
        baseUrl: '',
      },
      vertex: {
        projectId: '',
        location: 'us-central1',
      },
      ollama: {
        host: 'http://localhost:11434',
        model: 'llama3.3',
      },
      lmstudio: {
        baseUrl: 'http://localhost:1234/v1',
      },
    }

    fs.writeFileSync(targetPath, `${JSON.stringify(sample, null, 2)}\n`, 'utf8')
    console.log(colors.successMessage(`✅ Sample configuration written to ${targetPath}`))
  }
}
