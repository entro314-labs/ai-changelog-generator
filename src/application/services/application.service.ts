import process from 'node:process'

import { ConfigurationManager } from '../../infrastructure/config/configuration.manager.js'
import colors from '../../shared/constants/colors.js'
import { ChangelogOrchestrator } from '../orchestrators/changelog.orchestrator.js'

interface ValidationResult {
  valid: boolean
  issues: string[]
  recommendations: string[]
}

interface HealthCheckResult {
  status: 'ok' | 'warning' | 'error'
  message: string
}

interface ApplicationHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, HealthCheckResult>
  timestamp: string
  error?: string
}

export class ApplicationService {
  [key: string]: any
  constructor(options: Record<string, any> = {}) {
    this.options = options

    // Normalize repositoryPath option (can be cwd or repositoryPath)
    const repositoryPath = options.repositoryPath || options.cwd
    if (repositoryPath) {
      this.options.repositoryPath = repositoryPath
      this.options.cwd = repositoryPath
    }

    // Pass full options to ConfigurationManager so it can receive config object from extension
    this.configManager = new ConfigurationManager(options.configPath, null, options)
    this.orchestrator = new ChangelogOrchestrator(this.configManager, this.options)
    this.initialized = false
    this.initializationError = null

    // Apply options
    if (options.noColor || process.env.NO_COLOR) {
      colors.disable()
    }

    // Start initialization (don't await here to keep constructor sync)
    this.initializationPromise = this.initializeAsync()
  }

  async initializeAsync() {
    try {
      // Wait for orchestrator services to be ready with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Initialization timeout after 10 seconds')), 10000)
      )

      await Promise.race([this.orchestrator.ensureInitialized(), timeoutPromise])

      this.initialized = true
    } catch (error) {
      this.initializationError = error
      console.error(
        colors.errorMessage('Application service initialization failed:'),
        error.message
      )
      // Don't throw - allow graceful degradation
    }
  }

  async ensureInitialized() {
    if (this.initialized) {
      return
    }

    if (this.initializationError) {
      throw new Error(`Service not initialized: ${this.initializationError.message}`)
    }

    // Wait for initialization to complete
    await this.initializationPromise

    if (this.initializationError) {
      throw new Error(`Service initialization failed: ${this.initializationError.message}`)
    }
  }

  async analyzeRepository(options: Record<string, any> = {}) {
    try {
      return await this.orchestrator.analyzeRepository(options)
    } catch (error) {
      console.error(colors.errorMessage('Repository analysis error:'), error.message)
      throw error
    }
  }

  async generateChangelog(options: Record<string, any> = {}) {
    try {
      const {
        version,
        since,
        author,
        tagRange,
        format,
        output,
        outputFile,
        dryRun,
        includeWorkingDirectoryChanges,
        silent,
        analysisMode,
        includeAttribution,
        template,
        includeAIAnalysis,
      } = options
      return await this.orchestrator.generateChangelog(version, since, {
        author,
        tagRange,
        format,
        outputFile: outputFile || output,
        dryRun,
        includeWorkingDirectoryChanges,
        silent: silent ?? this.options.silent,
        // Thread the remaining changelog-option contract so per-invocation settings
        // (analysis mode, attribution, template, AI toggle) reach the orchestrator
        // rather than only the constructor-level this.options defaults.
        analysisMode,
        includeAttribution,
        template,
        includeAIAnalysis,
      })
    } catch (error) {
      console.error(colors.errorMessage('Changelog generation error:'), error.message)
      throw error
    }
  }

  async analyzeCurrentChanges(config: Record<string, any> = {}) {
    try {
      await this.ensureInitialized()
      // Forward the CLI/MCP filters + AI toggle so the engine honors --no-ai and scoping.
      return await this.orchestrator.analyzeRepository({
        type: 'changes',
        includeAIAnalysis: config.includeAIAnalysis,
        since: config.since,
        author: config.author,
        tagRange: config.tagRange,
      })
    } catch (error) {
      console.error(colors.errorMessage('Changes analysis error:'), error.message)
      throw error
    }
  }

  async analyzeRecentCommits(limit = 10, config: Record<string, any> = {}) {
    try {
      return await this.orchestrator.analyzeRepository({
        type: 'commits',
        limit,
        includeAIAnalysis: config.includeAIAnalysis,
        since: config.since,
        author: config.author,
        tagRange: config.tagRange,
      })
    } catch (error) {
      console.error(colors.errorMessage('Commits analysis error:'), error.message)
      throw error
    }
  }

  async assessHealth(options: Record<string, any> = {}) {
    try {
      return await this.orchestrator.analyzeRepository({
        type: 'health',
        ...options,
      })
    } catch (error) {
      console.error(colors.errorMessage('Health assessment error:'), error.message)
      throw error
    }
  }

  async generateChangelogFromChanges(version, options: Record<string, any> = {}) {
    try {
      await this.ensureInitialized()
      // Thread the working-dir options through to the orchestrator (C-5). Previously
      // only `version` was forwarded, so --format/--output/--dry-run/analysis-mode were
      // silently dropped for the working-directory changelog.
      return await this.orchestrator.generateChangelogFromChanges(version, {
        analysisMode: options.analysisMode,
        includeAttribution: options.includeAttribution,
        format: options.format,
        outputFile: options.outputFile ?? options.output,
        dryRun: options.dryRun ?? this.options.dryRun,
      })
    } catch (error) {
      console.error(colors.errorMessage('Working directory changelog error:'), error.message)
      throw error
    }
  }

  async runInteractive() {
    try {
      return await this.orchestrator.runInteractive()
    } catch (error) {
      console.error(colors.errorMessage('Interactive mode error:'), error.message)
      throw error
    }
  }

  // Configuration delegation
  setAnalysisMode(mode) {
    this.orchestrator.setAnalysisMode(mode)
  }

  setModelOverride(model) {
    this.orchestrator.setModelOverride(model)
  }

  // Metrics delegation
  getMetrics() {
    return this.orchestrator.getMetrics()
  }

  resetMetrics() {
    this.orchestrator.resetMetrics()
  }

  // Provider management
  async listProviders() {
    try {
      return await this.orchestrator.providerManager.listProviders()
    } catch (error) {
      console.error(colors.errorMessage('Provider listing error:'), error.message)
      throw error
    }
  }

  async switchProvider(providerName) {
    try {
      const result = this.orchestrator.providerManager.switchProvider(providerName)
      if (result.success) {
        // Await the rebuild so the newly-selected provider is the active one before the
        // next generation/analysis call (initializeServices is async).
        await this.orchestrator.initializeServices()
        console.log(colors.successMessage(`✅ Switched to provider: ${providerName}`))
      }
      return result
    } catch (error) {
      console.error(colors.errorMessage('Provider switch error:'), error.message)
      return { success: false, error: error.message }
    }
  }

  // Real available models for a provider (used by `providers models`). Delegates to the
  // provider instance's getAvailableModels() via the manager — no hardcoded model list.
  async getProviderModels(providerName) {
    try {
      await this.ensureInitialized()
      return await this.orchestrator.providerManager.getProviderModels(providerName)
    } catch (error) {
      console.error(colors.errorMessage('Provider models error:'), error.message)
      throw error
    }
  }

  // Securely store a provider credential via the UnifiedCredentialManager (OS keychain or
  // encrypted config file), so `providers configure` can persist secrets instead of only
  // printing .env instructions. Degrades with a clear error when the backend is unavailable
  // (e.g. keytar not installed for "keychain").
  async storeCredential(
    providerName,
    value,
    storageType = 'keychain',
    metadata: Record<string, any> = {}
  ) {
    try {
      const manager = this.configManager.getCredentialManager()
      await manager.setCredential(providerName, value, storageType, metadata)
      return { success: true, storageType }
    } catch (error) {
      console.error(colors.errorMessage('Credential storage error:'), error.message)
      return { success: false, error: error.message }
    }
  }

  // Validation methods
  validateConfiguration(): ValidationResult {
    try {
      const issues: string[] = []

      // Validate we are operating on a real git repository. The previous guard
      // `config.GIT_PATH || process.cwd()` could never be falsy (process.cwd() always
      // returns a truthy string), so it never actually validated anything.
      if (!this.orchestrator.gitManager?.isGitRepo) {
        issues.push('Not a git repository')
      }

      // Truthfully report AI availability: the active provider must exist, be available,
      // and not be the rule-based "dummy" fallback. Reporting "valid" with no usable
      // provider would contradict the tool's core "AI-analyzed" promise.
      const aiProvider = this.orchestrator.aiProvider
      const providerName = aiProvider?.getName?.()
      if (!aiProvider || providerName === 'dummy' || !aiProvider.isAvailable?.()) {
        issues.push(
          'No usable AI provider configured (changelogs will fall back to pattern-based analysis)'
        )
      }

      return {
        valid: issues.length === 0,
        issues,
        recommendations: this.generateRecommendations(issues),
      }
    } catch (error) {
      console.error(colors.errorMessage('Configuration validation error:'), error.message)
      return {
        valid: false,
        issues: [error.message],
        recommendations: [],
      }
    }
  }

  generateRecommendations(issues: string[]): string[] {
    const recommendations: string[] = []

    issues.forEach((issue) => {
      if (issue.includes('git reposit')) {
        recommendations.push(
          'Run the command from within a git repository (or set the repository path).'
        )
      }
      if (issue.includes('AI provider')) {
        recommendations.push(
          'Configure an AI provider credential (e.g. OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local) or run `ai-changelog providers configure`.'
        )
      }
    })

    return recommendations
  }

  // Health check
  async healthCheck(): Promise<ApplicationHealth> {
    try {
      const health: ApplicationHealth = {
        status: 'healthy',
        checks: {},
        timestamp: new Date().toISOString(),
      }

      // Git check
      try {
        health.checks.git = {
          status: this.orchestrator.gitManager.isGitRepo ? 'ok' : 'error',
          message: this.orchestrator.gitManager.isGitRepo
            ? 'Git repository detected'
            : 'Not a git repository',
        }
      } catch (error) {
        health.checks.git = { status: 'error', message: error.message }
      }

      // AI provider check — the rule-based "dummy" fallback is always "available" but is
      // NOT a usable AI provider, so report it truthfully as a warning rather than "ok".
      try {
        const aiProvider = this.orchestrator.aiProvider
        const aiUsable =
          !!aiProvider && aiProvider.getName?.() !== 'dummy' && aiProvider.isAvailable?.()
        health.checks.ai = {
          status: aiUsable ? 'ok' : 'warning',
          message: aiUsable
            ? 'AI provider available'
            : 'No usable AI provider (changelogs use pattern-based fallback)',
        }
      } catch (error) {
        health.checks.ai = { status: 'error', message: error.message }
      }

      // Configuration check
      try {
        const configValidation = await this.validateConfiguration()
        health.checks.config = {
          status: configValidation.valid ? 'ok' : 'warning',
          message: configValidation.valid
            ? 'Configuration valid'
            : `${configValidation.issues.length} issues found`,
        }
      } catch (error) {
        health.checks.config = { status: 'error', message: error.message }
      }

      // Overall status
      const hasErrors = Object.values(health.checks).some((check) => check.status === 'error')
      const hasWarnings = Object.values(health.checks).some((check) => check.status === 'warning')

      if (hasErrors) {
        health.status = 'unhealthy'
      } else if (hasWarnings) {
        health.status = 'degraded'
      }

      return health
    } catch (error) {
      return {
        status: 'unhealthy',
        checks: {},
        error: error.message,
        timestamp: new Date().toISOString(),
      }
    }
  }

  // Commit message generation with AI and validation
  async generateCommitMessage(options: Record<string, any> = {}) {
    try {
      await this.ensureInitialized()

      // Get current staged files and branch context
      const { analyzeBranchIntelligence, getSuggestedCommitType, getStagedChanges } =
        await import('../../shared/utils/utils.js')

      const cwd = this.options.cwd || this.options.repositoryPath
      const branchAnalysis = analyzeBranchIntelligence(null, cwd)

      const stagedChanges = getStagedChanges(cwd)

      if (!stagedChanges || stagedChanges.length === 0) {
        throw new Error('No staged changes detected')
      }

      const stagedFiles: any[] = []
      for (const change of stagedChanges) {
        const fileWithDiff = await this.orchestrator.gitService.analyzeStagedFileChange(
          change.status,
          change.filePath
        )
        stagedFiles.push({
          status: change.status,
          path: change.filePath,
          filePath: change.filePath,
          diff: fileWithDiff?.diff || '',
          additions: fileWithDiff?.additions || 0,
          deletions: fileWithDiff?.deletions || 0,
        })
      }

      const suggestedType = getSuggestedCommitType(branchAnalysis, stagedFiles)

      let commitMessage
      try {
        commitMessage = await this.orchestrator.generateAICommitMessage(
          branchAnalysis,
          suggestedType,
          stagedFiles
        )
      } catch {
        commitMessage = this.orchestrator.generateBranchAwareCommitMessage(
          branchAnalysis,
          suggestedType,
          stagedFiles
        )
      }

      if (!commitMessage) {
        throw new Error('Failed to generate commit message')
      }

      const validationContext = { branchAnalysis, stagedFiles, suggestedType }

      let validationResult = await this.orchestrator.validationService.validateCommitMessage(
        commitMessage,
        validationContext
      )

      let improvedMessage = commitMessage
      if (options.enableValidation && !validationResult.valid) {
        const improvementResult = await this.orchestrator.validationService.improveCommitMessage(
          commitMessage,
          validationContext
        )
        if (improvementResult.improved) {
          improvedMessage = improvementResult.message
          // Re-validate: the returned validation must describe the message we are
          // actually handing back, otherwise the UI shows errors belonging to a
          // message the user never sees.
          validationResult = await this.orchestrator.validationService.validateCommitMessage(
            improvedMessage,
            validationContext
          )
        }
      }

      // Strict mode means "reject invalid conventional commit messages". Surface
      // that decision so callers can block insertion instead of offering a
      // message their own setting says should be rejected.
      const blocked = options.strictValidation === true && !validationResult.valid

      return {
        message: improvedMessage,
        validation: validationResult,
        blocked,
        blockedReason: blocked
          ? 'Strict conventional-commit validation failed for this message.'
          : undefined,
        branchAnalysis,
        suggestedType,
        stagedFiles,
      }
    } catch (error) {
      console.error(colors.errorMessage('Commit message generation error:'), error.message)
      throw error
    }
  }

  // Validate commit message
  async validateCommitMessage(message, context: Record<string, any> = {}) {
    try {
      await this.ensureInitialized()
      return await this.orchestrator.validationService.validateCommitMessage(message, context)
    } catch (error) {
      console.error(colors.errorMessage('Commit validation error:'), error.message)
      throw error
    }
  }

  // Provider validation methods
  async validateProvider(providerName) {
    try {
      await this.ensureInitialized()
      return await this.orchestrator.providerManager.testProvider(providerName)
    } catch (error) {
      console.error(colors.errorMessage('Provider validation error:'), error.message)
      throw error
    }
  }

  async validateAllProviders() {
    try {
      await this.ensureInitialized()
      return await this.orchestrator.providerManager.validateAll()
    } catch (error) {
      console.error(colors.errorMessage('All providers validation error:'), error.message)
      throw error
    }
  }

  // Additional helper methods
  async generateChangelogFromCommits(commitHashes, options: Record<string, any> = {}) {
    try {
      return await this.orchestrator.interactiveService.generateChangelogForCommits(
        commitHashes,
        options
      )
    } catch (error) {
      console.error(colors.errorMessage('Changelog from commits error:'), error.message)
      throw error
    }
  }

  // Interactive commit workflow
  async executeCommitWorkflow(options: Record<string, any> = {}) {
    try {
      await this.ensureInitialized()

      // Delegate to orchestrator for the commit workflow
      return await this.orchestrator.executeCommitWorkflow(options)
    } catch (error) {
      console.error(colors.errorMessage('Commit workflow error:'), error.message)
      throw error
    }
  }
}
