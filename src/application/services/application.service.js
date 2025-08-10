import process from 'node:process'

import { ConfigurationManager } from '../../infrastructure/config/configuration.manager.js'
import colors from '../../shared/constants/colors.js'
import { ChangelogOrchestrator } from '../orchestrators/changelog.orchestrator.js'

export class ApplicationService {
  constructor(options = {}) {
    this.options = options
    this.configManager = new ConfigurationManager()
    this.orchestrator = new ChangelogOrchestrator(this.configManager, options)
    this.initialized = false

    // Apply options
    if (options.noColor || process.env.NO_COLOR) {
      colors.disable()
    }

    // Wait for orchestrator to initialize
    this.initializeAsync()
  }

  async initializeAsync() {
    try {
      // Wait for orchestrator services to be ready
      await this.orchestrator.ensureInitialized()
      this.initialized = true
    } catch (error) {
      console.error(
        colors.errorMessage('Application service initialization failed:'),
        error.message
      )
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeAsync()
    }
  }

  async generateChangelog(options = {}) {
    try {
      const { version, since } = options
      return await this.orchestrator.generateChangelog(version, since)
    } catch (error) {
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

  // Commit message generation
  async generateCommitMessage() {
    try {
      await this.ensureInitialized()
      return await this.orchestrator.interactiveService.generateCommitSuggestion()
    } catch (error) {
      console.error(colors.errorMessage('Commit message generation error:'), error.message)
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
