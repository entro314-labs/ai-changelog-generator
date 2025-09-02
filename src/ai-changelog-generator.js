#!/usr/bin/env node

import { ApplicationService } from './application/services/application.service.js'
import colors from './shared/constants/colors.js'

/**
 * AI Changelog Generator - Main Facade Class
 *
 * Provides the primary interface for changelog generation functionality
 * by delegating to domain services through the ApplicationService layer.
 *
 * Features:
 * - Automatic changelog generation from git commits
 * - Working directory change analysis
 * - Multiple AI provider support
 * - Interactive and batch modes
 */
export class AIChangelogGenerator {
  constructor(options = {}) {
    this.options = options
    this.appService = new ApplicationService(options)

    // Simple configuration
    this.analysisMode = options.analysisMode || 'standard'
    this.modelOverride = options.modelOverride || null
    this.dryRun = options.dryRun
    this.silent = options.silent

    if (!this.silent) {
      console.log(colors.successMessage('🚀 AI Changelog Generator initialized'))
    }
  }

  // Main changelog generation - delegates to service layer
  async generateChangelog(version = null, since = null) {
    try {
      if (this.dryRun && !this.silent) {
        console.log(colors.infoMessage('DRY RUN MODE - No files will be written'))
      }

      return await this.appService.generateChangelog({ version, since })
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Changelog generation failed:'), error.message)
      }
      throw error
    }
  }

  // Repository analysis - delegates to analysis engine
  async analyzeRepository(config = {}) {
    try {
      return await this.appService.analyzeRepository(config)
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Repository analysis failed:'), error.message)
      }
      throw error
    }
  }

  // Current changes analysis
  async analyzeCurrentChanges() {
    try {
      return await this.appService.analyzeCurrentChanges()
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Changes analysis failed:'), error.message)
      }
      throw error
    }
  }

  // Recent commits analysis
  async analyzeRecentCommits(limit = 10) {
    try {
      return await this.appService.analyzeRecentCommits(limit)
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Commits analysis failed:'), error.message)
      }
      throw error
    }
  }

  // Branches analysis - delegates to analysis engine
  async analyzeBranches(config = {}) {
    try {
      return await this.appService.analyzeRepository({ ...config, type: 'branches' })
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Branches analysis failed:'), error.message)
      }
      throw error
    }
  }

  // Comprehensive analysis - delegates to analysis engine
  async analyzeComprehensive(config = {}) {
    try {
      return await this.appService.analyzeRepository({ ...config, type: 'comprehensive' })
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Comprehensive analysis failed:'), error.message)
      }
      throw error
    }
  }

  // Untracked files analysis - delegates to analysis engine
  async analyzeUntrackedFiles(config = {}) {
    try {
      return await this.appService.analyzeRepository({ ...config, type: 'untracked' })
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Untracked files analysis failed:'), error.message)
      }
      throw error
    }
  }

  // Repository health assessment
  async assessRepositoryHealth(config = {}) {
    try {
      return await this.appService.assessHealth(config)
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Health assessment failed:'), error.message)
      }
      throw error
    }
  }

  // Working directory changelog
  async generateChangelogFromChanges(version = null) {
    try {
      return await this.appService.generateChangelogFromChanges(version)
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Working directory changelog failed:'), error.message)
      }
      throw error
    }
  }

  // Interactive mode
  async runInteractive() {
    try {
      return await this.appService.runInteractive()
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Interactive mode failed:'), error.message)
      }
      throw error
    }
  }

  // Health check
  async healthCheck() {
    try {
      return await this.appService.healthCheck()
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Health check failed:'), error.message)
      }
      throw error
    }
  }

  // Configuration methods - simple delegation
  setAnalysisMode(mode) {
    this.analysisMode = mode
    this.appService.setAnalysisMode(mode)
  }

  setModelOverride(model) {
    this.modelOverride = model
    this.appService.setModelOverride(model)
  }

  // Provider management - delegates to service layer
  async listProviders() {
    return await this.appService.listProviders()
  }

  async switchProvider(providerName) {
    return await this.appService.switchProvider(providerName)
  }

  // Metrics - delegates to orchestrator
  getMetrics() {
    return this.appService.getMetrics()
  }

  resetMetrics() {
    this.appService.resetMetrics()
  }

  // Configuration validation
  async validateConfiguration() {
    return await this.appService.validateConfiguration()
  }

  // Utility methods for backward compatibility
  get hasAI() {
    try {
      return this.appService?.orchestrator?.aiProvider?.isAvailable()
    } catch (error) {
      return false
    }
  }

  get gitExists() {
    try {
      const isGitRepo = this.appService?.orchestrator?.gitManager?.isGitRepo
      return Boolean(isGitRepo)
    } catch (error) {
      return false
    }
  }

  // Simple logging method
  log(message, type = 'info') {
    if (this.silent) {
      return
    }

    switch (type) {
      case 'error':
        console.error(colors.errorMessage(message))
        break
      case 'warning':
        console.warn(colors.warningMessage(message))
        break
      case 'success':
        console.log(colors.successMessage(message))
        break
      default:
        console.log(colors.infoMessage(message))
    }
  }
}

// Export for backwards compatibility
export default AIChangelogGenerator

// CLI integration point (would be moved to separate CLI file)
export async function createGenerator(options = {}) {
  try {
    const generator = new AIChangelogGenerator(options)

    // Perform health check on initialization
    const health = await generator.healthCheck()

    if (health.status === 'unhealthy') {
      console.warn(colors.warningMessage('⚠️ Health check failed:'))
      Object.entries(health.checks).forEach(([check, result]) => {
        if (result.status === 'error') {
          console.warn(colors.errorMessage(`  ❌ ${check}: ${result.message}`))
        }
      })
    }

    return generator
  } catch (error) {
    console.error(colors.errorMessage('Failed to create generator:'), error.message)
    throw error
  }
}
