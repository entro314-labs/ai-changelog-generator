import process from 'node:process'

import { AIAnalysisService } from '../../domains/ai/ai-analysis.service.js'
import { AnalysisEngine } from '../../domains/analysis/analysis.engine.js'
import { ChangelogService } from '../../domains/changelog/changelog.service.js'
import { GitService } from '../../domains/git/git.service.js'
import { InteractiveStagingService } from '../../infrastructure/interactive/interactive-staging.service.js'
import { InteractiveWorkflowService } from '../../infrastructure/interactive/interactive-workflow.service.js'
import { ProviderManagerService } from '../../infrastructure/providers/provider-manager.service.js'
import { CommitMessageValidationService } from '../../infrastructure/validation/commit-message-validation.service.js'
import colors from '../../shared/constants/colors.js'

export class ChangelogOrchestrator {
  constructor(configManager, options = {}) {
    this.configManager = configManager
    this.options = options
    this.analysisMode = options.analysisMode || 'standard'
    this.metrics = {
      startTime: Date.now(),
      commitsProcessed: 0,
      apiCalls: 0,
      errors: 0,
      batchesProcessed: 0,
      totalTokens: 0,
      ruleBasedFallbacks: 0,
      cacheHits: 0,
    }

    this.initialized = false
    this.initializationPromise = null

    // Cache frequently used imports for performance
    this._importCache = new Map()

    // Start initialization
    this.initializationPromise = this.initializeServices()
  }

  // Cached import helper to avoid repeated dynamic imports
  async _getCachedImport(moduleName) {
    if (!this._importCache.has(moduleName)) {
      this._importCache.set(moduleName, await import(moduleName))
    }
    return this._importCache.get(moduleName)
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializationPromise
    }
  }

  async initializeServices() {
    try {
      // Initialize AI provider
      this.providerManager = new ProviderManagerService(this.configManager.getAll(), {
        errorHandler: { logToConsole: true },
      })
      this.aiProvider = this.providerManager.getActiveProvider()

      // Create lightweight implementations for missing dependencies
      this.gitManager = await this.createGitManager()
      this.tagger = await this.createTagger()
      this.promptEngine = await this.createPromptEngine()

      // Initialize domain services with proper dependencies
      this.gitService = new GitService(this.gitManager, this.tagger)
      this.aiAnalysisService = new AIAnalysisService(
        this.aiProvider,
        this.promptEngine,
        this.tagger,
        this.analysisMode
      )
      this.analysisEngine = new AnalysisEngine(this.gitService, this.aiAnalysisService)
      this.changelogService = new ChangelogService(
        this.gitService,
        this.aiAnalysisService,
        this.analysisEngine,
        this.configManager
      )
      this.interactiveService = new InteractiveWorkflowService(
        this.gitService,
        this.aiAnalysisService,
        this.changelogService
      )
      this.stagingService = new InteractiveStagingService(this.gitManager)
      this.validationService = new CommitMessageValidationService(this.configManager)

      // Only log if not in MCP server mode
      if (!process.env.MCP_SERVER_MODE) {
        console.log(colors.successMessage('⚙️  Services initialized'))
      }
      this.initialized = true
    } catch (error) {
      // Enhanced error handling with recovery suggestions
      let errorMessage = 'Failed to initialize services: '
      const suggestions = []

      if (error.message.includes('not a git repository')) {
        errorMessage += 'Not in a git repository'
        suggestions.push('Run this command from within a git repository')
        suggestions.push('Initialize a git repository with: git init')
      } else if (error.message.includes('API key') || error.message.includes('provider')) {
        errorMessage += 'AI provider configuration issue'
        suggestions.push('Check your .env.local file for API keys')
        suggestions.push('Run: ai-changelog providers list')
      } else {
        errorMessage += error.message
        suggestions.push('Try running with --debug for more information')
      }

      console.error(colors.errorMessage(errorMessage))
      if (suggestions.length > 0) {
        console.error(colors.infoMessage('Suggestions:'))
        suggestions.forEach((suggestion) => {
          console.error(colors.dim(`  • ${suggestion}`))
        })
      }

      throw error
    }
  }

  async createGitManager() {
    const { execSync } = await this._getCachedImport('child_process')

    return {
      isGitRepo: (() => {
        try {
          execSync('git rev-parse --git-dir', { stdio: 'ignore' })
          return true
        } catch {
          return false
        }
      })(),

      execGit(command) {
        try {
          return execSync(command, { encoding: 'utf8', stdio: 'pipe' })
        } catch (error) {
          // Enhanced error handling with more specific messages
          if (error.code === 128) {
            throw new Error(
              `Git repository error: ${error.message.includes('not a git repository') ? 'Not in a git repository' : error.message}`
            )
          }
          if (error.code === 129) {
            throw new Error(`Git command syntax error: ${command}`)
          }
          throw new Error(`Git command failed (${command}): ${error.message}`)
        }
      },

      execGitSafe(command) {
        try {
          return execSync(command, { encoding: 'utf8', stdio: 'pipe' })
        } catch {
          return ''
        }
      },

      execGitShow(command) {
        try {
          return execSync(command, { encoding: 'utf8', stdio: 'pipe' })
        } catch (_error) {
          // console.warn(`Git command failed: ${command}`);
          // console.warn(`Error: ${error.message}`);
          return null
        }
      },

      validateCommitHash(hash) {
        try {
          execSync(`git cat-file -e ${hash}`, { stdio: 'ignore' })
          return true
        } catch {
          return false
        }
      },

      getAllBranches() {
        try {
          const output = execSync('git branch -a', { encoding: 'utf8' })
          return output
            .split('\n')
            .filter(Boolean)
            .map((branch) => branch.trim().replace(/^\*\s*/, ''))
        } catch {
          return []
        }
      },

      getUnmergedCommits() {
        try {
          const output = execSync('git log --oneline --no-merges HEAD ^origin/main', {
            encoding: 'utf8',
          })
          return output.split('\n').filter(Boolean)
        } catch {
          return []
        }
      },

      getDanglingCommits() {
        try {
          const output = execSync('git fsck --no-reflog | grep "dangling commit"', {
            encoding: 'utf8',
          })
          return output.split('\n').filter(Boolean)
        } catch {
          return []
        }
      },

      getUntrackedFiles() {
        try {
          const output = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' })
          return output.split('\n').filter(Boolean)
        } catch {
          return []
        }
      },

      getRecentCommits(limit = 10) {
        try {
          const output = execSync(`git log --oneline -${limit}`, { encoding: 'utf8' })
          return output.split('\n').filter(Boolean)
        } catch {
          return []
        }
      },

      getComprehensiveAnalysis() {
        return {
          totalCommits: this.getRecentCommits(1000).length,
          branches: this.getAllBranches(),
          untrackedFiles: this.getUntrackedFiles(),
        }
      },

      hasFile(filename) {
        try {
          execSync(`test -f ${filename}`, { stdio: 'ignore' })
          return true
        } catch {
          return false
        }
      },
    }
  }

  async createTagger() {
    const { analyzeSemanticChanges, analyzeFunctionalImpact } = await import(
      '../../shared/utils/utils.js'
    )

    return {
      analyzeCommit(commit) {
        const semanticChanges = []
        const breakingChanges = []
        const categories = []
        const tags = []

        // Basic analysis based on commit message
        const message = commit.message.toLowerCase()

        if (message.includes('breaking') || message.includes('!:')) {
          breakingChanges.push('Breaking change detected in commit message')
          categories.push('breaking')
          tags.push('breaking')
        }

        if (message.startsWith('feat')) {
          categories.push('feature')
          tags.push('feature')
        } else if (message.startsWith('fix')) {
          categories.push('fix')
          tags.push('bugfix')
        } else if (message.startsWith('docs')) {
          categories.push('docs')
          tags.push('documentation')
        }

        // Analyze files if available
        if (commit.files && commit.files.length > 0) {
          commit.files.forEach((file) => {
            const semantic = analyzeSemanticChanges('', file.path)
            if (semantic.frameworks) {
              semanticChanges.push(...semantic.frameworks)
            }
          })
        }

        // Determine importance
        let importance = 'medium'
        if (breakingChanges.length > 0 || commit.files?.length > 10) {
          importance = 'high'
        } else if (categories.includes('docs') || commit.files?.length < 3) {
          importance = 'low'
        }

        return {
          semanticChanges,
          breakingChanges,
          categories,
          importance,
          tags,
        }
      },
    }
  }

  async createPromptEngine() {
    const { buildEnhancedPrompt } = await import('../../shared/utils/utils.js')

    return {
      systemPrompts: {
        master:
          'You are an expert software analyst specializing in code change analysis and changelog generation.',
        standard: 'Provide clear, concise analysis focusing on the practical impact of changes.',
        detailed:
          'Provide comprehensive technical analysis with detailed explanations and implications.',
        enterprise:
          'Provide enterprise-grade analysis suitable for stakeholder communication and decision-making.',
        changesAnalysis: 'You are an expert at analyzing code changes and their business impact.',
      },

      optimizeForProvider(prompt, providerName, _capabilities = {}) {
        // Simple optimization - could be enhanced based on provider capabilities
        if (providerName?.toLowerCase().includes('claude')) {
          return `Please analyze this carefully and provide structured output:\n\n${prompt}`
        }
        if (providerName?.toLowerCase().includes('gpt')) {
          return `${prompt}\n\nPlease respond in JSON format as requested.`
        }
        return prompt
      },

      buildRepositoryHealthPrompt(healthData, _analysisMode) {
        return `Analyze the health of this repository based on the following data:\n\n${JSON.stringify(healthData, null, 2)}\n\nProvide assessment and recommendations.`
      },
    }
  }

  async generateChangelog(version, since) {
    try {
      await this.ensureInitialized()

      this.metrics.startTime = Date.now()

      console.log(`\n${colors.processingMessage('🚀 Starting changelog generation...')}`)

      // Validate git repository
      if (!this.gitManager.isGitRepo) {
        throw new Error('Not a git repository')
      }

      // Generate changelog using the service
      const result = await this.changelogService.generateChangelog(version, since)

      if (!result) {
        console.log(colors.warningMessage('No changelog generated'))
        return null
      }

      // Update metrics
      this.updateMetrics(result)

      // Display results
      this.displayResults(result, version)

      return result
    } catch (error) {
      this.metrics.errors++
      console.error(colors.errorMessage('Changelog generation failed:'), error.message)
      throw error
    }
  }

  async analyzeRepository(options = {}) {
    try {
      await this.ensureInitialized()

      console.log(colors.processingMessage('🔍 Starting repository analysis...'))

      const analysisType = options.type || 'changes'
      const result = await this.analysisEngine.analyze(analysisType, options)

      this.displayAnalysisResults(result, analysisType)

      return result
    } catch (error) {
      this.metrics.errors++
      console.error(colors.errorMessage('Repository analysis failed:'), error.message)
      throw error
    }
  }

  async runInteractive() {
    await this.ensureInitialized()

    const { runInteractiveMode, selectSpecificCommits } = await import(
      '../../shared/utils/utils.js'
    )
    const { confirm } = await this._getCachedImport('@clack/prompts')

    console.log(colors.processingMessage('🎮 Starting interactive mode...'))

    let continueSession = true

    while (continueSession) {
      try {
        const result = await runInteractiveMode()

        if (result.action === 'exit') {
          console.log(colors.successMessage('👋 Goodbye!'))
          break
        }

        await this.handleInteractiveAction(result.action)

        // Ask if user wants to continue
        const continueChoice = await confirm({
          message: 'Would you like to perform another action?',
          initialValue: true,
        })

        continueSession = continueChoice
      } catch (error) {
        console.error(colors.errorMessage(`Interactive mode error: ${error.message}`))

        const retryChoice = await confirm({
          message: 'Would you like to try again?',
          initialValue: true,
        })

        continueSession = retryChoice
      }
    }

    return { interactive: true, status: 'completed' }
  }

  async handleInteractiveAction(action) {
    switch (action) {
      case 'changelog-recent':
        await this.handleRecentChangelogGeneration()
        break

      case 'changelog-specific':
        await this.handleSpecificChangelogGeneration()
        break

      case 'analyze-workdir':
        await this.generateChangelogFromChanges()
        break

      case 'analyze-repo':
        await this.analyzeRepository({ type: 'comprehensive' })
        break

      case 'commit-message':
        await this.handleCommitMessageGeneration()
        break

      case 'configure-providers':
        await this.handleProviderConfiguration()
        break

      case 'validate-config':
        await this.validateConfiguration()
        break

      default:
        console.log(colors.warningMessage(`Unknown action: ${action}`))
    }
  }

  async handleRecentChangelogGeneration() {
    const { text } = await import('@clack/prompts')

    const commitCountInput = await text({
      message: 'How many recent commits to include?',
      placeholder: '10',
      validate: (value) => {
        const num = Number.parseInt(value, 10)
        if (Number.isNaN(num) || num <= 0 || num > 100) {
          return 'Please enter a number between 1 and 100'
        }
      },
    })

    const commitCount = Number.parseInt(commitCountInput, 10) || 10

    console.log(
      colors.processingMessage(`📝 Generating changelog for ${commitCount} recent commits...`)
    )

    const result = await this.generateChangelog({
      version: `Recent-${commitCount}-commits`,
      maxCommits: commitCount,
    })

    if (result?.changelog) {
      console.log(colors.successMessage('✅ Changelog generated successfully!'))
    }
  }

  async handleSpecificChangelogGeneration() {
    const { selectSpecificCommits } = await import('../../shared/utils/utils.js')

    console.log(colors.infoMessage('📋 Select specific commits for changelog generation:'))

    const selectedCommits = await selectSpecificCommits(30)

    if (selectedCommits.length === 0) {
      console.log(colors.warningMessage('No commits selected.'))
      return
    }

    console.log(
      colors.processingMessage(
        `📝 Generating changelog for ${selectedCommits.length} selected commits...`
      )
    )

    const result = await this.generateChangelogFromCommits(selectedCommits)

    if (result?.changelog) {
      console.log(colors.successMessage('✅ Changelog generated successfully!'))
    }
  }

  async handleCommitMessageGeneration() {
    console.log(
      colors.processingMessage('🤖 Analyzing current changes for commit message suggestions...')
    )

    // Use shared utility for getting working directory changes
    const { getWorkingDirectoryChanges } = await import('../../shared/utils/utils.js')
    const changes = getWorkingDirectoryChanges()

    if (!changes || changes.length === 0) {
      console.log(colors.warningMessage('No uncommitted changes found.'))
      return
    }

    const analysis = await this.interactiveService.generateCommitSuggestion()

    if (analysis.success && analysis.suggestions.length > 0) {
      const { select } = await this._getCachedImport('@clack/prompts')

      const choices = [
        ...analysis.suggestions.map((msg, index) => ({
          value: msg,
          label: `${index + 1}. ${msg}`,
        })),
        {
          value: 'CUSTOM',
          label: '✏️  Write custom message',
        },
      ]

      const selectedMessage = await select({
        message: 'Choose a commit message:',
        options: choices,
      })

      if (selectedMessage === 'CUSTOM') {
        const { text } = await this._getCachedImport('@clack/prompts')

        const customMessage = await text({
          message: 'Enter your commit message:',
          validate: (input) => {
            if (!input || input.trim().length === 0) {
              return 'Commit message cannot be empty'
            }
          },
        })

        console.log(colors.successMessage(`📝 Custom message: ${customMessage}`))
      } else {
        console.log(colors.successMessage(`📝 Selected: ${selectedMessage}`))
      }
    } else {
      console.log(colors.warningMessage('Could not generate commit message suggestions.'))
    }
  }

  async handleProviderConfiguration() {
    const { select } = await this._getCachedImport('@clack/prompts')

    const availableProviders = this.providerManager.getAllProviders()

    const choices = availableProviders.map((p) => ({
      value: p.name,
      label: `${p.name} ${p.available ? '✅' : '⚠️ (needs configuration)'}`,
    }))

    const selectedProvider = await select({
      message: 'Select provider to configure:',
      options: choices,
    })

    console.log(colors.infoMessage(`🔧 Configuring ${selectedProvider}...`))
    console.log(
      colors.infoMessage('Please edit your .env.local file to add the required API keys.')
    )
    console.log(colors.highlight(`Example for ${selectedProvider.toUpperCase()}:`))

    switch (selectedProvider) {
      case 'openai':
        console.log(colors.code('OPENAI_API_KEY=your_api_key_here'))
        break
      case 'anthropic':
        console.log(colors.code('ANTHROPIC_API_KEY=your_api_key_here'))
        break
      case 'azure':
        console.log(colors.code('AZURE_OPENAI_API_KEY=your_api_key_here'))
        console.log(colors.code('AZURE_OPENAI_ENDPOINT=your_endpoint_here'))
        break
      case 'google':
        console.log(colors.code('GOOGLE_API_KEY=your_api_key_here'))
        break
      default:
        console.log(colors.code(`${selectedProvider.toUpperCase()}_API_KEY=your_api_key_here`))
    }
  }

  async generateChangelogFromChanges(version) {
    try {
      await this.ensureInitialized()

      console.log(
        colors.processingMessage('📝 Generating changelog from working directory changes...')
      )

      const result = await this.changelogService.generateChangelogFromChanges(version)

      if (result) {
        console.log(colors.successMessage('✅ Working directory changelog generated'))
        console.log(result.changelog)
      }

      return result
    } catch (error) {
      this.metrics.errors++
      console.error(
        colors.errorMessage('Working directory changelog generation failed:'),
        error.message
      )
      throw error
    }
  }

  updateMetrics(result) {
    if (result.analyzedCommits) {
      this.metrics.commitsProcessed += result.analyzedCommits.length
    }

    // Get metrics from AI service
    const aiMetrics = this.aiAnalysisService.getMetrics()
    this.metrics.apiCalls += aiMetrics.apiCalls
    this.metrics.totalTokens += aiMetrics.totalTokens
    this.metrics.ruleBasedFallbacks += aiMetrics.ruleBasedFallbacks
  }

  displayResults(result, _version) {
    const { changelog, insights, analyzedCommits } = result

    console.log(`\n${colors.successMessage('✅ Changelog Generation Complete')}`)

    if (insights) {
      // Create a clean insights summary
      const insightLines = [
        `${colors.label('Total commits')}: ${colors.number(insights.totalCommits)}`,
        `${colors.label('Complexity')}: ${this.getComplexityColor(insights.complexity)(insights.complexity)}`,
        `${colors.label('Risk level')}: ${this.getRiskColor(insights.riskLevel)(insights.riskLevel)}`,
      ]

      if (insights.breaking) {
        insightLines.push('')
        insightLines.push(colors.warningMessage('⚠️  Contains breaking changes'))
      }

      if (Object.keys(insights.commitTypes).length > 0) {
        insightLines.push('')
        insightLines.push(colors.dim('Commit types:'))
        Object.entries(insights.commitTypes).forEach(([type, count]) => {
          insightLines.push(`  ${colors.commitType(type)}: ${colors.number(count)}`)
        })
      }

      console.log(colors.box('📊 Release Insights', insightLines.join('\n')))
    }

    // Don't show changelog content in terminal - it's saved to file

    this.displayMetrics()
  }

  getComplexityColor(complexity) {
    const level = complexity?.toLowerCase()
    switch (level) {
      case 'low':
        return colors.success
      case 'medium':
        return colors.warning
      case 'high':
        return colors.error
      default:
        return colors.highlight
    }
  }

  getRiskColor(risk) {
    const level = risk?.toLowerCase()
    switch (level) {
      case 'low':
        return colors.riskLow
      case 'medium':
        return colors.riskMedium
      case 'high':
        return colors.riskHigh
      case 'critical':
        return colors.riskCritical
      default:
        return colors.highlight
    }
  }

  displayAnalysisResults(result, type) {
    console.log(
      colors.successMessage(
        `\n✅ ${type.charAt(0).toUpperCase() + type.slice(1)} Analysis Complete`
      )
    )
    console.log(colors.separator())

    if (result.summary) {
      console.log(colors.sectionHeader('📋 Summary'))
      console.log(result.summary)
      console.log('')
    }

    if (result.analysis) {
      console.log(colors.sectionHeader('🔍 Analysis Details'))
      if (typeof result.analysis === 'object') {
        Object.entries(result.analysis).forEach(([key, value]) => {
          if (typeof value === 'object') {
            console.log(`${key}: ${JSON.stringify(value, null, 2)}`)
          } else {
            console.log(`${key}: ${colors.highlight(value)}`)
          }
        })
      } else {
        console.log(result.analysis)
      }
    }

    this.displayMetrics()
  }

  displayMetrics() {
    const duration = Date.now() - this.metrics.startTime

    const metricLines = [
      `${colors.label('Duration')}: ${colors.number(this.formatDuration(duration))}`,
      `${colors.label('Commits processed')}: ${colors.number(this.metrics.commitsProcessed)}`,
      `${colors.label('API calls')}: ${colors.number(this.metrics.apiCalls)}`,
      `${colors.label('Total tokens')}: ${colors.number(this.metrics.totalTokens.toLocaleString())}`,
    ]

    if (this.metrics.ruleBasedFallbacks > 0) {
      metricLines.push('')
      metricLines.push(
        colors.warning(`⚠️  Rule-based fallbacks: ${this.metrics.ruleBasedFallbacks}`)
      )
    }

    if (this.metrics.errors > 0) {
      metricLines.push('')
      metricLines.push(colors.error(`❌ Errors: ${this.metrics.errors}`))
    }

    console.log(colors.box('📈 Performance Metrics', metricLines.join('\n')))
  }

  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`
    }
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  // Configuration methods
  setAnalysisMode(mode) {
    this.analysisMode = mode
    if (this.aiAnalysisService) {
      this.aiAnalysisService.analysisMode = mode
    }
  }

  setModelOverride(model) {
    if (this.aiAnalysisService) {
      this.aiAnalysisService.setModelOverride(model)
    }
  }

  // Metrics methods
  getMetrics() {
    return {
      ...this.metrics,
      aiMetrics: this.aiAnalysisService?.getMetrics() || {},
    }
  }

  resetMetrics() {
    this.metrics = {
      startTime: Date.now(),
      commitsProcessed: 0,
      apiCalls: 0,
      errors: 0,
      batchesProcessed: 0,
      totalTokens: 0,
      ruleBasedFallbacks: 0,
      cacheHits: 0,
    }

    if (this.aiAnalysisService) {
      this.aiAnalysisService.resetMetrics()
    }
  }

  // Interactive commit workflow
  async executeCommitWorkflow(options = {}) {
    await this.ensureInitialized()

    console.log(colors.header('🚀 Interactive Commit Workflow'))

    try {
      // Step 1: Show current git status
      const statusResult = await this.stagingService.showGitStatus()

      // Check if we have any changes at all
      const totalChanges =
        statusResult.staged.length + statusResult.unstaged.length + statusResult.untracked.length
      if (totalChanges === 0) {
        console.log(colors.infoMessage('✨ Working directory clean - no changes to commit.'))
        return { success: false, message: 'No changes to commit' }
      }

      // Step 2: Handle staging based on options
      let stagedFiles = []

      if (options.stageAll) {
        // Auto-stage all changes
        console.log(colors.processingMessage('📦 Staging all changes...'))
        await this.stagingService.stageAllChanges()
        stagedFiles = [...statusResult.unstaged, ...statusResult.untracked]
      } else if (
        options.interactive &&
        (statusResult.unstaged.length > 0 || statusResult.untracked.length > 0)
      ) {
        // Interactive staging
        console.log(colors.infoMessage('\n🎯 Interactive staging mode'))
        stagedFiles = await this.stagingService.selectFilesToStage()

        if (stagedFiles.length === 0 && statusResult.staged.length === 0) {
          console.log(colors.warningMessage('No files staged for commit.'))
          return { success: false, message: 'No files staged' }
        }
      }

      // Step 3: Verify we have staged changes
      if (!this.stagingService.hasStagedChanges()) {
        console.log(colors.warningMessage('No staged changes found for commit.'))

        if (statusResult.unstaged.length > 0 || statusResult.untracked.length > 0) {
          console.log(
            colors.infoMessage(
              '💡 Use --all flag to stage all changes, or run interactively to select files.'
            )
          )
        }

        return { success: false, message: 'No staged changes' }
      }

      // Step 4: Get final staged changes for analysis
      const finalStatus = this.stagingService.getDetailedStatus()
      console.log(
        colors.successMessage(`\n✅ Ready to commit ${finalStatus.staged.length} staged file(s)`)
      )

      // Step 5: Branch Intelligence Analysis
      const { analyzeBranchIntelligence, getSuggestedCommitType, generateCommitContextFromBranch } =
        await import('../../shared/utils/utils.js')

      const branchAnalysis = analyzeBranchIntelligence()
      const suggestedType = getSuggestedCommitType(branchAnalysis, finalStatus.staged)
      const _branchContext = generateCommitContextFromBranch(branchAnalysis, finalStatus.staged)

      // Display branch intelligence findings
      if (branchAnalysis.confidence > 20) {
        console.log(colors.infoMessage('\n🧠 Branch Intelligence:'))
        console.log(colors.secondary(`  Branch: ${branchAnalysis.branch}`))

        if (branchAnalysis.type) {
          console.log(
            colors.success(
              `  🏷️  Detected type: ${branchAnalysis.type} (${branchAnalysis.confidence}% confidence)`
            )
          )
        }

        if (branchAnalysis.ticket) {
          console.log(colors.highlight(`  🎫 Related ticket: ${branchAnalysis.ticket}`))
        }

        if (branchAnalysis.description) {
          console.log(colors.dim(`  📝 Description: ${branchAnalysis.description}`))
        }

        console.log(colors.dim(`  🔍 Patterns: ${branchAnalysis.patterns.join(', ')}`))
      }

      // Display suggested commit type
      console.log(
        colors.infoMessage(
          `\n💡 Suggested commit type: ${colors.highlight(suggestedType.type)} (from ${suggestedType.source}, ${suggestedType.confidence}% confidence)`
        )
      )

      // Step 6: Generate enhanced commit message
      let commitMessage

      if (options.customMessage) {
        commitMessage = options.customMessage
      } else {
        // Generate AI-enhanced commit message with branch context
        console.log(colors.processingMessage('🤖 Generating AI-powered commit message...'))

        try {
          commitMessage = await this.generateAICommitMessage(
            branchAnalysis,
            suggestedType,
            finalStatus.staged
          )
        } catch (_error) {
          console.log(colors.warningMessage('⚠️  AI generation failed, using rule-based fallback'))
          commitMessage = this.generateBranchAwareCommitMessage(
            branchAnalysis,
            suggestedType,
            finalStatus.staged
          )
        }
      }

      // Step 7: Validate commit message
      console.log(colors.processingMessage('\n🔍 Validating commit message...'))

      const validationContext = {
        branchAnalysis,
        stagedFiles: finalStatus.staged,
        suggestedType,
      }

      const validationResult = await this.validationService.validateCommitMessage(
        commitMessage,
        validationContext
      )

      // Display validation results
      const isValid = this.validationService.displayValidationResults(validationResult)

      // Step 8: Interactive improvement if needed
      if (!isValid || validationResult.warnings.length > 0) {
        const { confirm } = await this._getCachedImport('@clack/prompts')

        const shouldImprove = await confirm({
          message: 'Would you like to improve the commit message?',
          initialValue: !isValid,
        })

        if (shouldImprove) {
          commitMessage = await this.handleCommitMessageImprovement(
            commitMessage,
            validationResult,
            validationContext
          )
        }
      }

      if (options.dryRun) {
        console.log(colors.infoMessage('\n📋 Dry-run mode - showing what would be committed:'))
        console.log(colors.highlight(`Commit message:\n${commitMessage}`))
        return {
          success: true,
          commitMessage,
          stagedFiles: finalStatus.staged.length,
          dryRun: true,
        }
      }

      // Step 6: Execute the actual commit
      console.log(colors.processingMessage('\n💾 Executing commit...'))

      try {
        // Secure commit execution using git commit with stdin to avoid command injection
        const { execSync } = await this._getCachedImport('child_process')
        const commitHash = execSync('git commit --file=-', {
          input: commitMessage,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()

        console.log(colors.successMessage('✅ Commit executed successfully!'))
        console.log(colors.highlight(`📝 Commit hash: ${commitHash.trim()}`))
        console.log(colors.dim(`📝 Message: ${commitMessage.split('\n')[0]}`))

        return {
          success: true,
          commitHash: commitHash.trim(),
          commitMessage,
          stagedFiles: finalStatus.staged.length,
        }
      } catch (error) {
        console.error(colors.errorMessage(`❌ Failed to execute commit: ${error.message}`))
        console.log(colors.infoMessage('\n💡 Files remain staged. You can manually commit with:'))
        console.log(colors.code('git commit --file=- # (and paste your commit message)'))

        return {
          success: false,
          error: error.message,
          commitMessage,
          stagedFiles: finalStatus.staged.length,
          filesStaged: true,
        }
      }

      return {
        success: true,
        commitMessage,
        stagedFiles: finalStatus.staged.length,
        phase: 'staging-complete',
      }
    } catch (error) {
      console.error(colors.errorMessage(`Commit workflow error: ${error.message}`))
      throw error
    }
  }

  /**
   * Generate AI-powered commit message using branch intelligence and file changes
   */
  async generateAICommitMessage(branchAnalysis, suggestedType, stagedFiles) {
    if (!this.aiAnalysisService?.aiProvider?.isAvailable()) {
      throw new Error('AI provider not available')
    }

    // Build context for AI
    const branchInfo =
      branchAnalysis?.confidence > 30
        ? `Branch: ${branchAnalysis.branch} (${branchAnalysis.type || 'unknown'} type, ${branchAnalysis.confidence}% confidence)`
        : `Branch: ${branchAnalysis?.branch || 'unknown'}`

    const fileChanges = stagedFiles.map((f) => `${f.status} ${f.path}`).join('\n')

    // Build detailed context about the changes
    const changesSummary = {
      added: stagedFiles.filter((f) => f.status === 'A').length,
      modified: stagedFiles.filter((f) => f.status === 'M').length,
      deleted: stagedFiles.filter((f) => f.status === 'D').length,
    }

    const prompt = `Generate a high-quality conventional commit message for the following staged changes:

${branchInfo}
${branchAnalysis?.ticket ? `Related ticket: ${branchAnalysis.ticket}` : ''}

File changes (${stagedFiles.length} files):
${fileChanges}

Change summary: ${changesSummary.added} added, ${changesSummary.modified} modified, ${changesSummary.deleted} deleted

Suggested commit type: ${suggestedType.type} (${suggestedType.confidence}% confidence from ${suggestedType.source})

Requirements:
- Use conventional commit format: type(scope): description
- Keep subject line under 72 characters
- Use imperative mood ("add", not "added")
- Be specific and descriptive about what changed
- Include a body if the changes are complex
- Use the suggested type unless the changes clearly indicate otherwise

Generate only the commit message, no explanation.`

    try {
      const response = await this.aiAnalysisService.aiProvider.generateCompletion(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          max_tokens: 200,
          temperature: 0.3,
        }
      )

      const aiCommitMessage = response.content.trim()

      // Validate the AI response has the basic structure
      if (!aiCommitMessage.includes(':') || aiCommitMessage.length < 10) {
        throw new Error('AI generated invalid commit message format')
      }

      return aiCommitMessage
    } catch (error) {
      throw new Error(`AI commit generation failed: ${error.message}`)
    }
  }

  /**
   * Generate branch-aware commit message using rules and branch intelligence (fallback)
   */
  generateBranchAwareCommitMessage(branchAnalysis, suggestedType, stagedFiles) {
    const type = suggestedType.type

    // Build description based on branch intelligence
    let description = 'implement changes'

    if (branchAnalysis.description && branchAnalysis.confidence > 40) {
      description = branchAnalysis.description
    } else {
      // Generate description from file changes
      const fileTypes = new Set()
      stagedFiles.forEach((file) => {
        const path = file.path
        if (path.includes('service')) {
          fileTypes.add('services')
        }
        if (path.includes('component')) {
          fileTypes.add('components')
        }
        if (path.includes('utils')) {
          fileTypes.add('utilities')
        }
        if (path.includes('config')) {
          fileTypes.add('configuration')
        }
        if (path.includes('test')) {
          fileTypes.add('tests')
        }
        if (path.includes('doc')) {
          fileTypes.add('documentation')
        }
      })

      if (fileTypes.size > 0) {
        description = `update ${Array.from(fileTypes).join(', ')}`
      }
    }

    // Build commit message
    let commitMessage = `${type}: ${description}`

    // Add body with details
    const bodyLines = []

    if (branchAnalysis.ticket) {
      bodyLines.push(`Related to: ${branchAnalysis.ticket}`)
    }

    // Add file summary
    const addedFiles = stagedFiles.filter((f) => f.status === 'A').length
    const modifiedFiles = stagedFiles.filter((f) => f.status === 'M').length
    const deletedFiles = stagedFiles.filter((f) => f.status === 'D').length

    const changes = []
    if (addedFiles > 0) {
      changes.push(`${addedFiles} added`)
    }
    if (modifiedFiles > 0) {
      changes.push(`${modifiedFiles} modified`)
    }
    if (deletedFiles > 0) {
      changes.push(`${deletedFiles} deleted`)
    }

    if (changes.length > 0) {
      bodyLines.push(`Files: ${changes.join(', ')}`)
    }

    // Add branch context
    if (branchAnalysis.confidence > 60) {
      bodyLines.push(`Branch: ${branchAnalysis.branch} (${branchAnalysis.confidence}% confidence)`)
    }

    if (bodyLines.length > 0) {
      commitMessage += `\n\n${bodyLines.join('\n')}`
    }

    return commitMessage
  }

  /**
   * Handle interactive commit message improvement
   */
  async handleCommitMessageImprovement(originalMessage, validationResult, context) {
    const { select, text, confirm } = await import('@clack/prompts')

    console.log(colors.infoMessage('\n🔧 Commit Message Improvement'))

    // Try automatic improvement first
    const improvementResult = await this.validationService.improveCommitMessage(
      originalMessage,
      context
    )

    const options = [
      {
        value: 'auto',
        label: '🤖 Use automatically improved version',
        hint: improvementResult.improved
          ? 'AI-suggested improvements applied'
          : 'Minor fixes applied',
      },
      {
        value: 'manual',
        label: '✏️  Edit manually',
        hint: 'Customize the commit message yourself',
      },
    ]

    // Add AI suggestions if available
    if (this.aiAnalysisService.hasAI) {
      options.unshift({
        value: 'ai',
        label: '🧠 Generate AI suggestions',
        hint: 'Get AI-powered commit message alternatives',
      })
    }

    const choice = await select({
      message: 'How would you like to improve the commit message?',
      options,
    })

    switch (choice) {
      case 'ai':
        return await this.generateAICommitSuggestions(originalMessage, context, validationResult)

      case 'auto':
        console.log(colors.successMessage('\n✅ Using improved message:'))
        console.log(colors.highlight(improvementResult.message))
        return improvementResult.message

      case 'manual':
        return await this.handleManualCommitEdit(originalMessage, validationResult)

      default:
        return originalMessage
    }
  }

  /**
   * Generate AI-powered commit message suggestions
   */
  async generateAICommitSuggestions(originalMessage, context, validationResult) {
    if (!this.aiAnalysisService?.aiProvider?.isAvailable()) {
      throw new Error('AI provider not available for suggestions')
    }
    
    const { select } = await this._getCachedImport('@clack/prompts')

    console.log(colors.processingMessage('🤖 Generating AI suggestions...'))

    try {
      // Build comprehensive context for AI
      const branchInfo =
        context.branchAnalysis?.confidence > 30
          ? `Branch: ${context.branchAnalysis.branch} (${context.branchAnalysis.type || 'unknown'} type)`
          : ''

      const fileChanges = context.stagedFiles.map((f) => `${f.status} ${f.path}`).join('\n')

      const validationIssues = [...validationResult.errors, ...validationResult.warnings].join('\n')

      const prompt = `Improve this commit message based on the validation feedback and context:

Original message: "${originalMessage}"

Validation issues:
${validationIssues}

File changes:
${fileChanges}

${branchInfo}

Requirements:
- Follow conventional commit format
- Address all validation issues
- Keep subject under 72 characters
- Use imperative mood
- Be specific and descriptive

Provide 3 improved alternatives.`

      const response = await this.aiAnalysisService.aiProvider.generateCompletion(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        { max_tokens: 300 }
      )

      const suggestions = this.parseAICommitSuggestions(response.content)

      if (suggestions.length === 0) {
        console.log(
          colors.warningMessage('No AI suggestions generated, falling back to manual edit.')
        )
        return await this.handleManualCommitEdit(originalMessage, validationResult)
      }

      // Present suggestions to user
      const choices = suggestions.map((suggestion, index) => ({
        value: suggestion,
        label: `${index + 1}. ${suggestion.split('\n')[0]}`, // First line only
        hint: suggestion.includes('\n') ? 'Has body content' : 'Subject only',
      }))

      choices.push({
        value: 'MANUAL',
        label: '✏️  Edit manually instead',
        hint: 'Write your own commit message',
      })

      const selectedMessage = await select({
        message: 'Choose an AI-generated commit message:',
        options: choices,
      })

      if (selectedMessage === 'MANUAL') {
        return await this.handleManualCommitEdit(originalMessage, validationResult)
      }

      console.log(colors.successMessage('\n✅ Selected AI suggestion:'))
      console.log(colors.highlight(selectedMessage))
      return selectedMessage
    } catch (error) {
      console.error(colors.errorMessage(`AI suggestion failed: ${error.message}`))
      return await this.handleManualCommitEdit(originalMessage, validationResult)
    }
  }

  /**
   * Handle manual commit message editing
   */
  async handleManualCommitEdit(originalMessage, validationResult) {
    const { text, confirm } = await import('@clack/prompts')

    console.log(colors.infoMessage('\n✏️  Manual Edit Mode'))
    console.log(colors.dim('Validation issues to address:'))

    validationResult.errors.forEach((error) => {
      console.log(colors.error(`  • ${error}`))
    })

    validationResult.warnings.forEach((warning) => {
      console.log(colors.warning(`  • ${warning}`))
    })

    if (validationResult.suggestions.length > 0) {
      console.log(colors.dim('\nSuggestions:'))
      validationResult.suggestions.forEach((suggestion) => {
        console.log(colors.dim(`  • ${suggestion}`))
      })
    }

    let improvedMessage
    let isValid = false
    let attempts = 0
    const maxAttempts = 3

    while (!isValid && attempts < maxAttempts) {
      improvedMessage = await text({
        message: 'Enter improved commit message:',
        placeholder: originalMessage,
        defaultValue: attempts === 0 ? originalMessage : undefined,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Commit message cannot be empty'
          }
        },
      })

      // Validate the improved message
      const newValidation = await this.validationService.validateCommitMessage(improvedMessage, {
        branchAnalysis: validationResult.parsed?.branchAnalysis,
      })

      if (newValidation.valid) {
        isValid = true
        console.log(colors.successMessage('✅ Validation passed!'))
      } else {
        attempts++
        console.log(
          colors.warningMessage(`\n⚠️  Validation failed (attempt ${attempts}/${maxAttempts}):`)
        )
        this.validationService.displayValidationResults(newValidation)

        if (attempts < maxAttempts) {
          const tryAgain = await confirm({
            message: 'Try again with improvements?',
            initialValue: true,
          })

          if (!tryAgain) {
            break
          }
        }
      }
    }

    return improvedMessage || originalMessage
  }

  /**
   * Parse AI-generated commit suggestions
   */
  parseAICommitSuggestions(content) {
    const suggestions = []
    const lines = content.split('\n').filter((line) => line.trim())

    let currentSuggestion = ''
    for (const line of lines) {
      const trimmed = line.trim()

      // Check if it's a new suggestion (starts with number, bullet, or looks like commit format)
      if (
        trimmed.match(
          /^(\d+[.)]|\*|-|•)|^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.*?\))?:/
        )
      ) {
        if (currentSuggestion) {
          suggestions.push(currentSuggestion.trim())
        }
        // Clean up the line (remove numbering/bullets)
        currentSuggestion = trimmed.replace(/^(\d+[.)]|\*|-|•)\s*/, '')
      } else if (currentSuggestion && trimmed.length > 0) {
        // Add to current suggestion (body content)
        currentSuggestion += `\n${trimmed}`
      }
    }

    // Add the last suggestion
    if (currentSuggestion) {
      suggestions.push(currentSuggestion.trim())
    }

    // Filter valid suggestions
    return suggestions.filter((s) => s.length > 10 && s.includes(':')).slice(0, 3) // Limit to 3 suggestions
  }
}
