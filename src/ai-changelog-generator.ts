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
  [key: string]: any
  constructor(options: Record<string, any> = {}) {
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

  // Main changelog generation - delegates to service layer.
  // `options` carries format/template/attribution/analysisMode/outputFile; without
  // it, embedders (the VS Code extension) had no way to reach those controls at all.
  async generateChangelog(
    version: any = null,
    since: any = null,
    options: Record<string, any> = {}
  ) {
    try {
      if (this.dryRun && !this.silent) {
        console.log(colors.infoMessage('DRY RUN MODE - No files will be written'))
      }

      return await this.appService.generateChangelog({
        analysisMode: this.analysisMode,
        ...options,
        version,
        since,
        ...(this.dryRun !== undefined ? { dryRun: this.dryRun } : {}),
        ...(this.silent !== undefined ? { silent: this.silent } : {}),
      })
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Changelog generation failed:'), error.message)
      }
      throw error
    }
  }

  // Repository analysis - delegates to analysis engine
  async analyzeRepository(config: Record<string, any> = {}) {
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
  async analyzeRecentCommits(limit = 10, config: Record<string, any> = {}) {
    try {
      return await this.appService.analyzeRecentCommits(limit, config)
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Commits analysis failed:'), error.message)
      }
      throw error
    }
  }

  // Branches analysis - delegates to analysis engine
  async analyzeBranches(config: Record<string, any> = {}) {
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
  async analyzeComprehensive(config: Record<string, any> = {}) {
    try {
      return await this.appService.analyzeRepository({ ...config, type: 'comprehensive' })
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Comprehensive analysis failed:'), error.message)
      }
      throw error
    }
  }

  // Repository health assessment
  async assessRepositoryHealth(config: Record<string, any> = {}) {
    try {
      return await this.appService.assessHealth(config)
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Health assessment failed:'), error.message)
      }
      throw error
    }
  }

  // Working directory changelog. Mirrors generateChangelog: without `options` an
  // embedder cannot reach analysisMode/format/attribution/output at all.
  async generateChangelogFromChanges(version: any = null, options: Record<string, any> = {}) {
    try {
      return await this.appService.generateChangelogFromChanges(version, {
        analysisMode: this.analysisMode,
        ...options,
      })
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

  // Commit message generation with AI and validation
  async generateCommitMessage(options: Record<string, any> = {}) {
    try {
      return await this.appService.generateCommitMessage(options)
    } catch (error) {
      if (!this.silent) {
        console.error(colors.errorMessage('Commit message generation failed:'), error.message)
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

  async validateProvider(providerName) {
    return await this.appService.validateProvider(providerName)
  }

  async validateAllProviders() {
    return await this.appService.validateAllProviders()
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

export default AIChangelogGenerator

// CLI integration point (would be moved to separate CLI file)
export async function createGenerator(options: Record<string, any> = {}) {
  try {
    const generator = new AIChangelogGenerator(options)

    // Perform health check on initialization
    const health = await generator.healthCheck()

    if (health.status === 'unhealthy') {
      console.warn(colors.warningMessage('⚠️ Health check failed:'))
      Object.entries(health.checks as Record<string, { status: string; message?: string }>).forEach(
        ([check, result]) => {
          if (result.status === 'error') {
            console.warn(colors.errorMessage(`  ❌ ${check}: ${result.message}`))
          }
        }
      )
    }

    return generator
  } catch (error) {
    console.error(colors.errorMessage('Failed to create generator:'), error.message)
    throw error
  }
}
