import process from 'node:process'

import { AIAnalysisService } from '../../domains/ai/ai-analysis.service.js'
import { AnalysisEngine } from '../../domains/analysis/analysis.engine.js'
import { ChangelogService } from '../../domains/changelog/changelog.service.js'
import { CommitTagger } from '../../domains/git/commit-tagger.js'
import { GitService } from '../../domains/git/git.service.js'
import { GitManager } from '../../domains/git/git-manager.js'
import { InteractiveStagingService } from '../../infrastructure/interactive/interactive-staging.service.js'
import { InteractiveWorkflowService } from '../../infrastructure/interactive/interactive-workflow.service.js'
import { ProviderManagerService } from '../../infrastructure/providers/provider-manager.service.js'
import { CommitMessageValidationService } from '../../infrastructure/validation/commit-message-validation.service.js'
import colors from '../../shared/constants/colors.js'

export class ChangelogOrchestrator {
  [key: string]: any
  constructor(configManager, options: Record<string, any> = {}) {
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
    this._importCache = new Map<any, any>()

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
      // Resolve user-managed credentials before selecting a provider. Without
      // this boundary, `providers configure` can persist a key successfully but
      // the next process still initializes the rule-based fallback.
      if (typeof this.configManager.initializeCredentialDetection === 'function') {
        await this.configManager.initializeCredentialDetection()
      }

      // Initialize AI provider. Pass the configManager so `providers switch`
      // can persist the active provider to .ai-changelog.json (setActiveProvider).
      this.providerManager = new ProviderManagerService(this.configManager.getAll(), {
        errorHandler: { logToConsole: true },
        configManager: this.configManager,
      })
      this.aiProvider = this.providerManager.getActiveProvider()

      // Create proper implementations using the new classes
      // Pass cwd/repositoryPath to GitManager so it runs commands in correct directory
      const gitOptions: Record<string, any> = {}
      if (this.options.cwd || this.options.repositoryPath) {
        gitOptions.cwd = this.options.cwd || this.options.repositoryPath
      }
      this.gitManager = new GitManager(gitOptions)
      this.tagger = new CommitTagger()
      this.promptEngine = await this.createPromptEngine()

      // Initialize domain services with proper dependencies
      this.gitService = new GitService(this.gitManager, this.tagger)
      // Pass configManager (5th arg) so analysis-mode model escalation can consult
      // getOptimalModelConfig() when selecting the model tier.
      this.aiAnalysisService = new AIAnalysisService(
        this.aiProvider,
        this.promptEngine,
        this.tagger,
        this.analysisMode,
        this.configManager
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
      const suggestions: any[] = []

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

  async createPromptEngine() {
    return {
      systemPrompts: {
        master:
          'You are an expert software analyst specializing in code change analysis and changelog generation. Analyze code changes with precision and provide definitive, factual assessments. Never use uncertain language like "likely", "probably", "appears to", "seems to", or "possibly". Base your analysis solely on the actual changes shown in the code diffs.',
        standard:
          'Provide clear, concise analysis focusing on the practical impact of changes. Be definitive and factual in your descriptions.',
        detailed:
          'Provide comprehensive technical analysis with detailed explanations and implications. Use precise, confident language backed by evidence from the code changes.',
        enterprise:
          'Provide enterprise-grade analysis suitable for stakeholder communication and decision-making. Use authoritative, factual language that conveys confidence and accuracy.',
        changesAnalysis: 'You are an expert at analyzing code changes and their business impact.',
      },

      optimizeForProvider(prompt, providerName, _capabilities: Record<string, any> = {}) {
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

  async generateChangelog(version, since, extraOptions: Record<string, any> = {}) {
    try {
      await this.ensureInitialized()

      this.metrics.startTime = Date.now()

      console.log(`\n${colors.processingMessage('🚀 Starting changelog generation...')}`)

      // Validate git repository
      if (!this.gitManager.isGitRepo) {
        throw new Error('Not a git repository')
      }

      // Handle tag range option (e.g., v1.0.0..v2.0.0)
      let effectiveSince = since
      let effectiveUntil = 'HEAD'
      let fromTag: string | undefined
      let toTag: string | undefined
      if (extraOptions.tagRange) {
        ;[fromTag, toTag] = extraOptions.tagRange.split('..')
        if (fromTag) {
          effectiveSince = fromTag
        }
        if (toTag) {
          effectiveUntil = toTag
        }
        console.log(
          colors.infoMessage(
            `📦 Generating changelog between tags: ${fromTag} → ${toTag || 'HEAD'}`
          )
        )
      }

      // Display author filter if specified
      if (extraOptions.author) {
        console.log(colors.infoMessage(`👤 Filtering commits by author: ${extraOptions.author}`))
      }

      // Explicit tag range (C-12): resolve the range through gitService.getCommitsBetween,
      // which validates BOTH refs (throwing "Unknown git ref: <ref>") instead of the
      // getCommitsSince date heuristic that misroutes non-version tags (e.g. "stable",
      // "release-1") to a --since date and silently widens the range. Author filtering is
      // preserved via the options passed to getCommitsBetween.
      if (extraOptions.tagRange && fromTag) {
        const result = await this.generateChangelogForTagRange(version, fromTag, toTag || 'HEAD', {
          author: extraOptions.author,
          format: extraOptions.format,
          outputFile: extraOptions.outputFile,
          dryRun: extraOptions.dryRun ?? this.options.dryRun,
          silent: extraOptions.silent ?? this.options.silent,
          analysisMode: extraOptions.analysisMode ?? this.options.analysisMode,
          includeAttribution: extraOptions.includeAttribution ?? this.options.includeAttribution,
          template: extraOptions.template ?? this.options.template,
        })

        if (!result) {
          console.log(colors.warningMessage('No changelog generated'))
          return null
        }

        this.updateMetrics(result)
        this.displayResults(result, version)
        return result
      }

      // Merge options. The output/format/dry-run/silent settings arrive per-invocation
      // via extraOptions (from ApplicationService.generateChangelog); they MUST be
      // threaded into the service call, otherwise --output/--format are silently dropped
      // and the changelog is never written (and never printed when --output is set).
      const mergedOptions = {
        ...this.options,
        author: extraOptions.author,
        until: effectiveUntil,
        format: extraOptions.format,
        outputFile: extraOptions.outputFile,
        dryRun: extraOptions.dryRun ?? this.options.dryRun,
        silent: extraOptions.silent ?? this.options.silent,
        // Forward the rest of the changelog-option contract so the service can honor
        // per-invocation analysis mode, attribution, template, and AI toggle.
        analysisMode: extraOptions.analysisMode ?? this.options.analysisMode,
        includeAttribution: extraOptions.includeAttribution ?? this.options.includeAttribution,
        template: extraOptions.template ?? this.options.template,
        includeAIAnalysis: extraOptions.includeAIAnalysis ?? this.options.includeAIAnalysis,
      }

      // Generate changelog using the service
      const result = await this.changelogService.generateChangelog(
        version,
        effectiveSince,
        mergedOptions
      )

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

  /**
   * Generate a changelog for an explicit tag/ref range (C-12).
   *
   * The range is fetched through gitService.getCommitsBetween, which validates
   * both refs (throwing "Unknown git ref: <ref>") so a typo'd or non-version tag
   * surfaces a clear error instead of the misrouted/silently-empty range produced
   * by the getCommitsSince date heuristic. The analyzed commits are then run
   * through the same changelog-service building blocks used by the default flow
   * (processCommitsSequentially/generateChangelogBatch -> generateReleaseInsights
   * -> buildChangelog) so the output shape matches.
   *
   * @param {string} version - Release version label
   * @param {string} fromRef - Exclusive lower bound (validated)
   * @param {string} toRef - Inclusive upper bound (validated, default HEAD)
   * @param {Record<string, any>} options - { author, format, outputFile, dryRun, silent, analysisMode, includeAttribution, template }
   */
  async generateChangelogForTagRange(
    version,
    fromRef,
    toRef = 'HEAD',
    options: Record<string, any> = {}
  ) {
    const silent = options.silent === true || process.env.MCP_SERVER_MODE === 'true'

    // Validates both refs and applies the author filter at the git level.
    const commits = await this.gitService.getCommitsBetween(fromRef, toRef, {
      author: options.author,
    })

    if (!commits || commits.length === 0) {
      if (!silent) {
        console.log(colors.infoMessage(`No commits found between ${fromRef} and ${toRef}.`))
      }
      return null
    }

    if (!silent) {
      console.log(
        colors.processingMessage(
          `Analyzing ${colors.number(commits.length)} commits in range ${fromRef}..${toRef}...`
        )
      )
    }

    const commitHashes = commits.map((c) => c.hash)

    // Mirror the default flow's batch threshold so behaviour stays consistent.
    // `options` carries includeAIAnalysis, so --no-ai is honored here too.
    const analyzedCommits =
      commitHashes.length > 20
        ? await this.changelogService.generateChangelogBatch(commitHashes, options)
        : await this.changelogService.processCommitsSequentially(commitHashes, options)

    if (analyzedCommits.length === 0) {
      if (!silent) {
        console.log(colors.warningMessage('No valid commits to analyze.'))
      }
      return null
    }

    const insights = await this.changelogService.generateReleaseInsights(analyzedCommits, version)
    const changelog = await this.changelogService.buildChangelog(
      analyzedCommits,
      insights,
      version,
      null,
      {
        includeAttribution: options.includeAttribution,
        template: options.template,
      }
    )

    if (options.outputFile) {
      const { handleUnifiedOutput } = await import('../../shared/utils/utils.js')
      handleUnifiedOutput(changelog, {
        format: options.format || 'markdown',
        outputFile: options.outputFile,
        silent,
        dryRun: options.dryRun,
        version,
      })
    }

    return {
      changelog,
      insights,
      analyzedCommits,
      workingDirAnalysis: null,
    }
  }

  async analyzeRepository(options: Record<string, any> = {}) {
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

    // Check for interactive environment
    if (!(process.stdin.isTTY || process.env.CI)) {
      console.log(colors.warningMessage('Interactive mode requires a TTY terminal.'))
      return { interactive: false, status: 'skipped' }
    }

    const { runInteractiveMode } = await import('../../shared/utils/utils.js')
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
        await this.generateChangelogFromChanges(null)
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
        if (typeof value !== 'string' || value.trim() === '') {
          return 'Please enter a number between 1 and 100'
        }
        const num = Number.parseInt(value, 10)
        if (Number.isNaN(num) || num <= 0 || num > 100) {
          return 'Please enter a number between 1 and 100'
        }
      },
    })

    if (typeof commitCountInput !== 'string') {
      console.log(colors.warningMessage('Commit selection cancelled.'))
      return
    }

    const commitCount = Number.parseInt(commitCountInput, 10) || 10

    console.log(
      colors.processingMessage(`📝 Generating changelog for ${commitCount} recent commits...`)
    )

    const result = await this.generateChangelog(`Recent-${commitCount}-commits`, null, {
      maxCommits: commitCount,
    })

    if (result?.changelog) {
      console.log(colors.successMessage('✅ Changelog generated successfully!'))
    }
  }

  async handleSpecificChangelogGeneration() {
    const { selectSpecificCommits } = await import('../../shared/utils/utils.js')

    console.log(colors.infoMessage('📋 Select specific commits for changelog generation:'))

    const selectedCommitsResult = await selectSpecificCommits(30)
    const selectedCommits = Array.isArray(selectedCommitsResult) ? selectedCommitsResult : []

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
    const changes = getWorkingDirectoryChanges(this.options.cwd || this.options.repositoryPath)

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

      if (typeof selectedMessage !== 'string') {
        console.log(colors.warningMessage('Commit message selection cancelled.'))
        return
      }

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

        if (typeof customMessage !== 'string') {
          console.log(colors.warningMessage('Custom commit message entry cancelled.'))
          return
        }

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
        console.log(colors.code('AZURE_OPENAI_KEY=your_api_key_here'))
        console.log(colors.code('AZURE_OPENAI_ENDPOINT=your_endpoint_here'))
        break
      case 'google':
        console.log(colors.code('GOOGLE_API_KEY=your_api_key_here'))
        break
      default:
        console.log(colors.code(`${selectedProvider.toUpperCase()}_API_KEY=your_api_key_here`))
    }
  }

  async generateChangelogFromChanges(version, options: Record<string, any> = {}) {
    try {
      await this.ensureInitialized()

      console.log(
        colors.processingMessage('📝 Generating changelog from working directory changes...')
      )

      // Forward the working-dir options end-to-end (C-5). The old default-command path
      // dropped these, so --format/--output/--dry-run/--detailed never reached the
      // working-directory changelog. Thread the agreed subset through to the service.
      const result = await this.changelogService.generateChangelogFromChanges(version, {
        analysisMode: options.analysisMode ?? this.options.analysisMode,
        includeAttribution: options.includeAttribution ?? this.options.includeAttribution,
        format: options.format,
        outputFile: options.outputFile,
        dryRun: options.dryRun ?? this.options.dryRun,
      })

      if (result) {
        console.log(colors.successMessage('✅ Working directory changelog generated'))
        // The service routes file / json / html output through handleUnifiedOutput; only
        // echo the raw markdown here for the plain console case to avoid double-printing.
        const handledByWriter =
          Boolean(options.outputFile) || (options.format && options.format !== 'markdown')
        if (!handledByWriter) {
          console.log(result.changelog)
        }
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
    const { insights } = result

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

  /**
   * Resolve the working directory the commit workflow should operate in.
   * Honors an explicitly configured repository path instead of always assuming
   * process.cwd(), so the workflow targets the same repo the rest of the
   * orchestrator (and GitManager) is configured for.
   */
  getWorkflowCwd() {
    return (
      this.gitManager?.options?.cwd || this.options.cwd || this.options.repositoryPath || undefined
    )
  }

  /**
   * Open the commit message in the user's editor for review/editing.
   * Writes the message to a temp file, launches $GIT_EDITOR/$EDITOR (falling back
   * to a sensible default), then rereads the file. Lines starting with `#` are
   * treated as comments (git convention) and stripped.
   */
  async openCommitMessageInEditor(initialMessage) {
    const os = await import('node:os')
    const path = await import('node:path')
    const fs = await import('node:fs')
    const { spawnSync } = await import('node:child_process')

    const editor =
      process.env.GIT_EDITOR ||
      process.env.VISUAL ||
      process.env.EDITOR ||
      (process.platform === 'win32' ? 'notepad' : 'vi')

    const tmpFile = path.join(
      os.tmpdir(),
      `ai-changelog-COMMIT_EDITMSG-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    )

    const template = `${initialMessage}\n\n# Please enter the commit message for your changes. Lines starting\n# with '#' will be ignored, and an empty message aborts the commit.\n`

    try {
      fs.writeFileSync(tmpFile, template, 'utf8')

      // Split the editor command so args embedded in $EDITOR (e.g. "code --wait")
      // are honored rather than treated as part of the binary name.
      const [editorBin, ...editorArgs] = editor.split(' ').filter(Boolean)
      const result = spawnSync(editorBin, [...editorArgs, tmpFile], {
        stdio: 'inherit',
        cwd: this.getWorkflowCwd(),
      })

      if (result.error) {
        throw result.error
      }
      if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`Editor exited with status ${result.status}`)
      }

      const edited = fs.readFileSync(tmpFile, 'utf8')
      const cleaned = edited
        .split('\n')
        .filter((line) => !line.startsWith('#'))
        .join('\n')
        .trim()

      return cleaned
    } finally {
      try {
        fs.unlinkSync(tmpFile)
      } catch {
        // Best-effort cleanup; ignore if the temp file is already gone.
      }
    }
  }

  // Interactive commit workflow
  async executeCommitWorkflow(options: Record<string, any> = {}) {
    await this.ensureInitialized()

    console.log(colors.header('🚀 Interactive Commit Workflow'))

    // Normalize option aliases. The CLI currently sends stageAll/customMessage/useEditor,
    // while the cross-agent contract uses all/message/editor — accept both.
    const stageAll = options.stageAll ?? options.all ?? false
    const customMessage = options.customMessage ?? options.message
    const useEditor = options.editor ?? options.useEditor ?? false
    const isDryRun = options.dryRun === true
    // verify === false means "skip the conventional-commit gate" (CLI --no-verify).
    const skipVerify = options.verify === false

    const cwd = this.getWorkflowCwd()
    const gitExecOptions: Record<string, any> = {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
    if (cwd) {
      gitExecOptions.cwd = cwd
    }

    try {
      // Step 1: Show current git status (read-only)
      const statusResult = await this.stagingService.showGitStatus()

      // Check if we have any changes at all
      const totalChanges =
        statusResult.staged.length + statusResult.unstaged.length + statusResult.untracked.length
      if (totalChanges === 0) {
        console.log(colors.infoMessage('✨ Working directory clean - no changes to commit.'))
        return { success: false, message: 'No changes to commit' }
      }

      const { analyzeBranchIntelligence, getSuggestedCommitType, generateCommitContextFromBranch } =
        await import('../../shared/utils/utils.js')

      // ----------------------------------------------------------------------
      // DRY-RUN (C-8a): must NOT mutate the index. Compute the set of files that
      // WOULD be staged/committed without running `git add`, generate + validate
      // the message, print everything, and return.
      // ----------------------------------------------------------------------
      if (isDryRun) {
        let wouldStage: any[]
        if (stageAll) {
          wouldStage = [...statusResult.staged, ...statusResult.unstaged, ...statusResult.untracked]
        } else {
          // Without --all we would only commit what is already staged; in
          // interactive mode the user would additionally pick from unstaged/untracked,
          // but a dry-run must not prompt-and-stage, so surface the candidates instead.
          wouldStage = [...statusResult.staged]
        }

        const branchAnalysis = analyzeBranchIntelligence(null, cwd)
        const suggestedType = getSuggestedCommitType(branchAnalysis, wouldStage)

        let commitMessage = customMessage
        if (!commitMessage) {
          console.log(colors.processingMessage('🤖 Generating AI-powered commit message...'))
          try {
            commitMessage = await this.generateAICommitMessage(
              branchAnalysis,
              suggestedType,
              wouldStage
            )
          } catch {
            console.log(
              colors.warningMessage('⚠️  AI generation failed, using rule-based fallback')
            )
            commitMessage = this.generateBranchAwareCommitMessage(
              branchAnalysis,
              suggestedType,
              wouldStage
            )
          }
        }

        // Validate (read-only) and report the gate decision without committing.
        const validationResult = await this.validationService.validateCommitMessage(commitMessage, {
          branchAnalysis,
          stagedFiles: wouldStage,
          suggestedType,
        })
        const isValid = this.validationService.displayValidationResults(validationResult)

        console.log(colors.infoMessage('\n📋 Dry-run mode - nothing was staged or committed.'))
        if (stageAll) {
          console.log(colors.dim(`Would stage ${wouldStage.length} file(s) (all changes).`))
        } else if (statusResult.unstaged.length > 0 || statusResult.untracked.length > 0) {
          console.log(
            colors.dim(
              `Would commit ${wouldStage.length} already-staged file(s). Unstaged/untracked files require --all or interactive selection.`
            )
          )
        } else {
          console.log(colors.dim(`Would commit ${wouldStage.length} staged file(s).`))
        }
        console.log(colors.highlight(`Commit message:\n${commitMessage}`))

        if (!isValid && !skipVerify) {
          console.log(
            colors.warningMessage(
              'Validation failed: this commit would be blocked. Re-run with --no-verify to bypass the conventional-commit gate.'
            )
          )
        }

        return {
          success: true,
          commitMessage,
          stagedFiles: wouldStage.length,
          wouldStage: wouldStage.map((f) => f.path),
          valid: isValid,
          dryRun: true,
        }
      }

      // ----------------------------------------------------------------------
      // REAL COMMIT PATH. Snapshot the index as a tree object BEFORE we mutate
      // it, so a failed commit can restore the pre-run index byte-for-byte
      // (C-8d). A path-based `git reset HEAD -- <paths>` cannot do this: a file
      // that was partially staged (`git add -p`) before the run appears in both
      // `staged` and `unstaged`, so resetting its path would also discard the
      // hunks the user had staged earlier. `git read-tree` restores the exact
      // index — partial stages, renames and mode bits included — and never
      // touches the working tree.
      // ----------------------------------------------------------------------
      const indexSnapshot = await this.captureIndexSnapshot(gitExecOptions)
      let stagedByThisRun: string[] = []

      if (stageAll) {
        console.log(colors.processingMessage('📦 Staging all changes...'))
        await this.stagingService.stageAllChanges()
        stagedByThisRun = [...statusResult.unstaged, ...statusResult.untracked].map((f) => f.path)
      } else if (
        options.interactive &&
        (statusResult.unstaged.length > 0 || statusResult.untracked.length > 0)
      ) {
        console.log(colors.infoMessage('\n🎯 Interactive staging mode'))
        const selected = await this.stagingService.selectFilesToStage()
        stagedByThisRun = Array.isArray(selected) ? selected : []

        if (stagedByThisRun.length === 0 && statusResult.staged.length === 0) {
          console.log(colors.warningMessage('No files staged for commit.'))
          return { success: false, message: 'No files staged' }
        }
      }

      // Verify we actually have staged changes before proceeding.
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

      // Get final staged changes for analysis.
      const finalStatus = this.stagingService.getDetailedStatus()
      console.log(
        colors.successMessage(`\n✅ Ready to commit ${finalStatus.staged.length} staged file(s)`)
      )

      // Branch Intelligence Analysis
      const branchAnalysis = analyzeBranchIntelligence(null, cwd)
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

      // Generate enhanced commit message
      let commitMessage

      if (customMessage) {
        commitMessage = customMessage
      } else {
        console.log(colors.processingMessage('🤖 Generating AI-powered commit message...'))

        try {
          commitMessage = await this.generateAICommitMessage(
            branchAnalysis,
            suggestedType,
            finalStatus.staged
          )
        } catch {
          console.log(colors.warningMessage('⚠️  AI generation failed, using rule-based fallback'))
          commitMessage = this.generateBranchAwareCommitMessage(
            branchAnalysis,
            suggestedType,
            finalStatus.staged
          )
        }
      }

      // Validate commit message
      console.log(colors.processingMessage('\n🔍 Validating commit message...'))

      const validationContext = {
        branchAnalysis,
        stagedFiles: finalStatus.staged,
        suggestedType,
      }

      let validationResult = await this.validationService.validateCommitMessage(
        commitMessage,
        validationContext
      )

      // Display validation results
      let isValid = this.validationService.displayValidationResults(validationResult)

      // Interactive improvement if needed (only when running interactively).
      if (options.interactive && (!isValid || validationResult.warnings.length > 0)) {
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
          // Re-validate after improvement so the gate below reflects the final message.
          validationResult = await this.validationService.validateCommitMessage(
            commitMessage,
            validationContext
          )
          isValid = validationResult.valid
        }
      }

      // Step (C-8e): honor editor request — open the message for review/edit before committing.
      if (useEditor) {
        console.log(colors.processingMessage('\n📝 Opening commit message in editor...'))
        try {
          const editedMessage = await this.openCommitMessageInEditor(commitMessage)
          if (!editedMessage || editedMessage.trim().length === 0) {
            console.log(colors.warningMessage('Empty commit message - aborting commit.'))
            await this.restoreIndexSnapshot(indexSnapshot, gitExecOptions)
            return {
              success: false,
              message: 'Aborted: empty commit message from editor',
              commitMessage,
            }
          }
          commitMessage = editedMessage
          // Re-validate the edited message so the gate below is accurate.
          validationResult = await this.validationService.validateCommitMessage(
            commitMessage,
            validationContext
          )
          isValid = validationResult.valid
        } catch (error) {
          console.error(colors.errorMessage(`Failed to open editor: ${error.message}`))
          await this.restoreIndexSnapshot(indexSnapshot, gitExecOptions)
          return {
            success: false,
            error: error.message,
            commitMessage,
            filesStaged: stagedByThisRun.length > 0,
          }
        }
      }

      // Gate on validation (C-8b): abort without committing when invalid unless --no-verify.
      if (!isValid && !skipVerify) {
        console.error(
          colors.errorMessage(
            '\n❌ Commit aborted: the message failed conventional-commit validation.'
          )
        )
        console.log(
          colors.infoMessage(
            '💡 Fix the issues above, or re-run with --no-verify to bypass the gate.'
          )
        )
        // Undo any staging this run performed so the repo is not left partially staged.
        await this.restoreIndexSnapshot(indexSnapshot, gitExecOptions)

        return {
          success: false,
          aborted: true,
          reason: 'validation-failed',
          commitMessage,
          validation: validationResult,
        }
      }

      if (skipVerify && !isValid) {
        console.log(
          colors.warningMessage('⚠️  --no-verify set: committing despite validation warnings.')
        )
      }

      // Execute the actual commit.
      console.log(colors.processingMessage('\n💾 Executing commit...'))

      try {
        // Secure commit execution using git commit with stdin to avoid command injection.
        const { execSync } = await this._getCachedImport('child_process')
        execSync('git commit --file=-', {
          ...gitExecOptions,
          input: commitMessage,
        })

        // Report the REAL commit SHA (C-8c): `git commit` stdout is a human summary,
        // not the hash. Resolve HEAD instead.
        const commitHash = execSync('git rev-parse HEAD', gitExecOptions).toString().trim()

        console.log(colors.successMessage('✅ Commit executed successfully!'))
        console.log(colors.highlight(`📝 Commit hash: ${commitHash}`))
        console.log(colors.dim(`📝 Message: ${commitMessage.split('\n')[0]}`))

        return {
          success: true,
          commitHash,
          commitMessage,
          stagedFiles: finalStatus.staged.length,
        }
      } catch (error) {
        console.error(colors.errorMessage(`❌ Failed to execute commit: ${error.message}`))

        // Rollback (C-8d): restore the index to the exact pre-run snapshot, so the
        // repo is not left partially staged and anything the user had staged
        // beforehand — including partially staged files — survives untouched.
        const rolledBack = await this.restoreIndexSnapshot(indexSnapshot, gitExecOptions)
        if (rolledBack) {
          console.log(
            colors.infoMessage(
              `↩️  Restored the index to its pre-run state (${stagedByThisRun.length} file(s) this run had staged).`
            )
          )
        } else {
          console.log(colors.infoMessage('\n💡 Files remain staged. You can manually commit with:'))
          console.log(colors.code('git commit --file=- # (and paste your commit message)'))
        }

        return {
          success: false,
          error: error.message,
          commitMessage,
          stagedFiles: finalStatus.staged.length,
          filesStaged: !rolledBack && stagedByThisRun.length > 0,
          rolledBack,
        }
      }
    } catch (error) {
      console.error(colors.errorMessage(`Commit workflow error: ${error.message}`))
      throw error
    }
  }

  /**
   * Record the current index as a tree object (`git write-tree`) so it can be
   * restored verbatim later. Returns the tree SHA, or null when the index
   * cannot be snapshotted — most commonly during an unresolved merge, where
   * write-tree refuses to build a tree from conflicted entries.
   *
   * Callers must treat null as "rollback unavailable" and leave the index alone
   * rather than falling back to a lossy path-based reset.
   */
  async captureIndexSnapshot(gitExecOptions: Record<string, any> = {}) {
    try {
      const { spawnSync } = await this._getCachedImport('child_process')
      const result = spawnSync('git', ['write-tree'], {
        encoding: 'utf8',
        stdio: 'pipe',
        ...(gitExecOptions.cwd ? { cwd: gitExecOptions.cwd } : {}),
      })
      if (result.status !== 0) {
        return null
      }
      const tree = (result.stdout || '').trim()
      return tree.length > 0 ? tree : null
    } catch {
      return null
    }
  }

  /**
   * Restore the index to a previously captured tree (`git read-tree`), undoing
   * every staging change this run made while leaving the working tree — and any
   * hunks the user had staged before the run — exactly as they were.
   * Returns true when the index was restored.
   */
  async restoreIndexSnapshot(treeSha, gitExecOptions: Record<string, any> = {}) {
    if (typeof treeSha !== 'string' || treeSha.length === 0) {
      return false
    }
    try {
      const { spawnSync } = await this._getCachedImport('child_process')
      const result = spawnSync('git', ['read-tree', treeSha], {
        encoding: 'utf8',
        stdio: 'pipe',
        ...(gitExecOptions.cwd ? { cwd: gitExecOptions.cwd } : {}),
      })
      if (result.status !== 0) {
        console.error(
          colors.errorMessage(`Failed to restore the index: ${result.stderr || result.status}`)
        )
        return false
      }
      return true
    } catch (error) {
      console.error(colors.errorMessage(`Failed to restore the index: ${error.message}`))
      return false
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

    // Build detailed file changes with content preview
    const fileChangesWithContent = stagedFiles
      .map((f) => {
        let entry = `${f.status} ${f.path}`
        if (f.diff && f.diff.length > 0) {
          // Include a preview of the diff (first 500 chars to stay within token limits)
          const diffPreview = f.diff.substring(0, 500)
          entry += `\n${diffPreview}${f.diff.length > 500 ? '...' : ''}`
        }
        return entry
      })
      .join('\n\n')

    // Build detailed context about the changes
    const changesSummary = {
      added: stagedFiles.filter((f) => f.status === 'A' || f.status === '??').length,
      modified: stagedFiles.filter((f) => f.status === 'M').length,
      deleted: stagedFiles.filter((f) => f.status === 'D').length,
    }

    const prompt = `Generate a high-quality conventional commit message for the following changes:

${branchInfo}
${branchAnalysis?.ticket ? `Related ticket: ${branchAnalysis.ticket}` : ''}

Change summary: ${changesSummary.added} added, ${changesSummary.modified} modified, ${changesSummary.deleted} deleted
Suggested commit type: ${suggestedType.type} (${suggestedType.confidence}% confidence from ${suggestedType.source})

File changes with content (${stagedFiles.length} files):
${fileChangesWithContent}

Requirements:
- Use conventional commit format: type(scope): description
- Keep subject line under 72 characters
- Use imperative mood ("add", not "added")
- Be specific and descriptive about what's actually being added/changed based on the file content shown above
- For new projects with many files, describe the overall purpose/functionality being added
- Use the suggested type unless the changes clearly indicate otherwise

Generate only the commit message, no explanation.`

    try {
      const response = await this.aiAnalysisService.generateCompletion(
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
      throw new Error(`AI commit generation failed: ${error.message}`, { cause: error })
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
      const fileTypes = new Set<any>()
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
    const bodyLines: any[] = []

    if (branchAnalysis.ticket) {
      bodyLines.push(`Related to: ${branchAnalysis.ticket}`)
    }

    // Add file summary
    const addedFiles = stagedFiles.filter((f) => f.status === 'A').length
    const modifiedFiles = stagedFiles.filter((f) => f.status === 'M').length
    const deletedFiles = stagedFiles.filter((f) => f.status === 'D').length

    const changes: any[] = []
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
    const { select } = await import('@clack/prompts')

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

      const response = await this.aiAnalysisService.generateCompletion(
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
    const suggestions: any[] = []
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
