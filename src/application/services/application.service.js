import process from 'node:process'

import { ConfigurationManager } from '../../infrastructure/config/configuration.manager.js'
import colors from '../../shared/constants/colors.js'
import { ChangelogOrchestrator } from '../orchestrators/changelog.orchestrator.js'

export class ApplicationService {
  constructor(options = {}) {
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
      console.error(colors.errorMessage('Application service error:'), error.message)
      throw error
    }
  }

  async analyzeRepository(options = {}) {
    try {
      return await this.orchestrator.analyzeRepository(options)
    } catch (error) {
      console.error(colors.errorMessage('Repository analysis error:'), error.message)
      throw error
    }
  }

  async generateChangelog(options = {}) {
    try {
      const { version, since, author, tagRange, format, output, dryRun } = options
      return await this.orchestrator.generateChangelog(version, since, {
        author,
        tagRange,
        format,
        output,
        dryRun,
      })
    } catch (error) {
      console.error(colors.errorMessage('Changelog generation error:'), error.message)
      throw error
    }
  }

  async analyzeCurrentChanges() {
    try {
      await this.ensureInitialized()
      return await this.orchestrator.analyzeRepository({ type: 'changes' })
    } catch (error) {
      console.error(colors.errorMessage('Changes analysis error:'), error.message)
      throw error
    }
  }

  async analyzeRecentCommits(limit = 10) {
    try {
      return await this.orchestrator.analyzeRepository({
        type: 'commits',
        limit,
      })
    } catch (error) {
      console.error(colors.errorMessage('Commits analysis error:'), error.message)
      throw error
    }
  }

  async assessHealth(options = {}) {
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

  async generateChangelogFromChanges(version) {
    try {
      return await this.orchestrator.generateChangelogFromChanges(version)
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

  switchProvider(providerName) {
    try {
      const result = this.orchestrator.providerManager.switchProvider(providerName)
      if (result.success) {
        // Reinitialize services with new provider
        this.orchestrator.initializeServices()
        console.log(colors.successMessage(`✅ Switched to provider: ${providerName}`))
      }
      return result
    } catch (error) {
      console.error(colors.errorMessage('Provider switch error:'), error.message)
      return { success: false, error: error.message }
    }
  }

  // Validation methods
  validateConfiguration() {
    try {
      // Basic validation
      const config = this.configManager.getAll()
      const issues = []

      if (!(config.GIT_PATH || process.cwd())) {
        issues.push('No git path configured')
      }

      // Validate AI provider if available
      if (this.orchestrator.aiProvider) {
        const isAvailable = this.orchestrator.aiProvider.isAvailable()
        if (!isAvailable) {
          issues.push('AI provider not properly configured')
        }
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

  generateRecommendations(issues) {
    const recommendations = []

    issues.forEach((issue) => {
      if (issue.includes('git path')) {
        recommendations.push('Set GIT_PATH environment variable or run from git repository')
      }
      if (issue.includes('AI provider')) {
        recommendations.push('Configure AI provider credentials in .env.local file')
      }
    })

    return recommendations
  }

  // Health check
  async healthCheck() {
    try {
      const health = {
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

      // AI provider check
      try {
        health.checks.ai = {
          status: this.orchestrator.aiProvider?.isAvailable() ? 'ok' : 'warning',
          message: this.orchestrator.aiProvider?.isAvailable()
            ? 'AI provider available'
            : 'AI provider not configured',
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
        error: error.message,
        timestamp: new Date().toISOString(),
      }
    }
  }

  // Commit message generation with AI and validation
  async generateCommitMessage(options = {}) {
    try {
      await this.ensureInitialized()

      // Get current staged files and branch context
      const { analyzeBranchIntelligence, getSuggestedCommitType, getWorkingDirectoryChanges } =
        await import('../../shared/utils/utils.js')

      // Get working directory changes (don't rely on staging service which expects interactive mode)
      const cwd = this.options.cwd || this.options.repositoryPath

      const branchAnalysis = analyzeBranchIntelligence(null, cwd)
      console.log('[generateCommitMessage] Branch analysis:', branchAnalysis)
      console.log('[generateCommitMessage] Getting working directory changes from:', cwd)

      const workingChanges = getWorkingDirectoryChanges(cwd)
      console.log('[generateCommitMessage] Found', workingChanges.length, 'working changes')

      if (!workingChanges || workingChanges.length === 0) {
        throw new Error('No changes detected in working directory')
      }

      // Get detailed file changes with diffs using GitService
      const stagedFiles = []
      for (const change of workingChanges) {
        const fileWithDiff = await this.orchestrator.gitService.analyzeWorkingDirectoryFileChange(
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
      console.log('[generateCommitMessage] Enriched', stagedFiles.length, 'files with diffs')

      const suggestedType = getSuggestedCommitType(branchAnalysis, stagedFiles)
      console.log('[generateCommitMessage] Suggested type:', suggestedType)

      // Generate AI commit message with branch intelligence
      let commitMessage
      try {
        console.log('[generateCommitMessage] Attempting AI generation...')
        commitMessage = await this.orchestrator.generateAICommitMessage(
          branchAnalysis,
          suggestedType,
          stagedFiles
        )
        console.log('[generateCommitMessage] AI generated:', commitMessage)
      } catch (error) {
        console.log('[generateCommitMessage] AI generation failed, using fallback:', error.message)
        // Fallback to rule-based generation
        commitMessage = this.orchestrator.generateBranchAwareCommitMessage(
          branchAnalysis,
          suggestedType,
          stagedFiles
        )
        console.log('[generateCommitMessage] Fallback generated:', commitMessage)
      }

      if (!commitMessage) {
        throw new Error('Failed to generate commit message')
      }

      // Validate the generated message
      console.log('[generateCommitMessage] Validating message...')
      const validationResult = await this.orchestrator.validationService.validateCommitMessage(
        commitMessage,
        { branchAnalysis, stagedFiles, suggestedType }
      )
      console.log('[generateCommitMessage] Validation result:', validationResult)

      // Improve if needed (only if validation enabled)
      let improvedMessage = commitMessage
      if (options.enableValidation && !validationResult.valid) {
        console.log('[generateCommitMessage] Attempting to improve message...')
        const improvementResult = await this.orchestrator.validationService.improveCommitMessage(
          commitMessage,
          { branchAnalysis, stagedFiles, suggestedType }
        )
        if (improvementResult.improved) {
          improvedMessage = improvementResult.message
          console.log('[generateCommitMessage] Improved to:', improvedMessage)
        }
      }

      const result = {
        message: improvedMessage,
        validation: validationResult,
        branchAnalysis,
        suggestedType,
      }
      console.log('[generateCommitMessage] Returning result:', result)
      return result
    } catch (error) {
      console.error(colors.errorMessage('Commit message generation error:'), error.message)
      console.error('[generateCommitMessage] Full error:', error)
      throw error
    }
  }

  // Validate commit message
  async validateCommitMessage(message, context = {}) {
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
      return await this.orchestrator.providerManager.testProvider(providerName)
    } catch (error) {
      console.error(colors.errorMessage('Provider validation error:'), error.message)
      throw error
    }
  }

  async validateAllProviders() {
    try {
      return await this.orchestrator.providerManager.validateAll()
    } catch (error) {
      console.error(colors.errorMessage('All providers validation error:'), error.message)
      throw error
    }
  }

  // Additional helper methods
  async generateChangelogFromCommits(commitHashes) {
    try {
      return await this.orchestrator.interactiveService.generateChangelogForCommits(commitHashes)
    } catch (error) {
      console.error(colors.errorMessage('Changelog from commits error:'), error.message)
      throw error
    }
  }

  // Interactive commit workflow
  async executeCommitWorkflow(options = {}) {
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
