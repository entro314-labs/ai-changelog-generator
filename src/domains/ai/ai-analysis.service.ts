import colors from '../../shared/constants/colors.js'
import {
  getModelForAnalysisMode,
  getSuggestedModels,
  MODEL_CAPABILITIES,
} from '../../infrastructure/providers/utils/model-config.js'
import {
  buildEnhancedPrompt,
  parseAIResponse,
  summarizeFileChanges,
} from '../../shared/utils/utils.js'

export class AIAnalysisService {
  [key: string]: any
  constructor(
    aiProvider,
    promptEngine,
    tagger,
    analysisMode = 'standard',
    configManager: any = null
  ) {
    this.aiProvider = aiProvider
    this.promptEngine = promptEngine
    this.tagger = tagger
    this.analysisMode = analysisMode
    this.configManager = configManager
    this.hasAI = aiProvider?.isAvailable()
    this.metrics = {
      apiCalls: 0,
      ruleBasedFallbacks: 0,
      totalTokens: 0,
    }
  }

  async generateCompletion(messages, options: Record<string, any> = {}) {
    const provider = this.aiProvider?.getName?.() || 'unknown'
    const credentialManager = this.configManager?.getCredentialManager?.()
    try {
      const response = await this.aiProvider.generateCompletion(messages, options)
      const success = !response?.error
      credentialManager?.logCredentialUsage(provider, success, response?.error || null)
      return response
    } catch (error) {
      credentialManager?.logCredentialUsage(provider, false, error.message)
      throw error
    }
  }

  async selectOptimalModel(commitAnalysis) {
    if (!this.hasAI) {
      return null
    }

    // Check for model override first
    if (this.modelOverride) {
      console.log(`🎯 Using model override: ${this.modelOverride}`)
      return this.modelOverride
    }

    const { files, diffStats, breaking, semanticAnalysis } = commitAnalysis
    const filesCount = files?.length || 0
    const linesChanged = (diffStats?.insertions || 0) + (diffStats?.deletions || 0)

    // Detect complex patterns
    const hasArchitecturalChanges =
      semanticAnalysis?.patterns?.includes('refactor') ||
      semanticAnalysis?.patterns?.includes('architecture') ||
      semanticAnalysis?.frameworks?.length > 2

    // Resolve the configured optimal-model tiers (default/medium/complex/...) so we can
    // escalate by analysis mode independently of the per-commit complexity heuristic.
    const optimalModels = this.getOptimalModels()

    try {
      const commitInfo = {
        files: filesCount,
        lines: linesChanged,
        additions: diffStats?.insertions || 0,
        deletions: diffStats?.deletions || 0,
        message: commitAnalysis.subject,
        breaking,
        complex: hasArchitecturalChanges,
      }

      const optimalModel = await this.aiProvider.selectOptimalModel(commitInfo)

      // Complexity-driven candidate (keys off commit size / patterns above).
      const complexityModel = optimalModel?.model || null

      // Analysis-mode-driven candidate: "detailed"/"enterprise" escalate to the
      // medium/complex tier even for small commits.
      const modeModel = getModelForAnalysisMode(this.analysisMode, optimalModels)

      // Take the HIGHER tier of the two so large commits still escalate while
      // detailed/enterprise modes never regress below their baseline.
      const selected = this.pickHigherTierModel(complexityModel, modeModel, optimalModels)

      if (selected) {
        if (optimalModel?.capabilities?.reasoning) {
          console.log(colors.aiMessage('Using reasoning model for complex analysis'))
        }
        if (modeModel && selected === modeModel && selected !== complexityModel) {
          console.log(
            colors.aiMessage(`Escalating model for ${this.analysisMode} analysis: ${selected}`)
          )
        }
        return selected
      }

      // Provider returned nothing usable but the mode still implies a tier.
      if (modeModel) {
        return modeModel
      }
    } catch {
      console.warn(colors.warningMessage('Model selection failed, using default'))
    }

    // Even on failure, honor the analysis-mode tier if it is configured.
    return getModelForAnalysisMode(this.analysisMode, optimalModels) || null
  }

  /**
   * Resolve the optimal-model tier map (default/medium/complex/...).
   *
   * Prefers the ConfigurationManager.getOptimalModelConfig() models when a config
   * manager is wired in; otherwise derives the tiers from the active provider's
   * model configuration so analysis-mode escalation still works standalone.
   * @returns {Record<string, any>} Tier->model map
   */
  getOptimalModels(): Record<string, any> {
    const fromConfig = this.configManager?.getOptimalModelConfig?.()
    if (fromConfig?.models && typeof fromConfig.models === 'object') {
      return fromConfig.models
    }

    // Fall back to the active provider's resolved model configuration so
    // analysis-mode escalation still works without a ConfigurationManager.
    const providerModelConfig =
      typeof this.aiProvider?.getProviderModelConfig === 'function'
        ? this.aiProvider.getProviderModelConfig()
        : this.aiProvider?.modelConfig

    if (providerModelConfig && typeof providerModelConfig === 'object') {
      // Map provider tier names onto the contract keys consumed by
      // getModelForAnalysisMode (default/medium/complex).
      return {
        small: providerModelConfig.smallModel,
        default:
          providerModelConfig.default ??
          providerModelConfig.standardModel ??
          providerModelConfig.smallModel,
        medium: providerModelConfig.mediumModel,
        complex: providerModelConfig.complexModel,
      }
    }

    return {}
  }

  /**
   * Pick the higher-priority model between two candidates using the configured
   * tier ordering (small < default < medium < complex). Falls back gracefully when
   * a candidate is not part of the tier map.
   * @param {string | null} a - First candidate model
   * @param {string | null} b - Second candidate model
   * @param {Record<string, any>} optimalModels - Tier->model map
   * @returns {string | null} The higher-tier model name (or whichever is defined)
   */
  pickHigherTierModel(
    a: string | null,
    b: string | null,
    optimalModels: Record<string, any>
  ): string | null {
    if (!a) {
      return b
    }
    if (!b) {
      return a
    }
    if (a === b) {
      return a
    }

    // Lowest -> highest tier. Unknown models rank below the lowest known tier so an
    // explicit tier always wins when escalation is requested.
    const tierOrder = ['small', 'default', 'medium', 'complex']
    const rankOf = (model: string): number => {
      let rank = -1
      tierOrder.forEach((tier, index) => {
        if (optimalModels[tier] === model && index > rank) {
          rank = index
        }
      })
      return rank
    }

    const rankA = rankOf(a)
    const rankB = rankOf(b)

    if (rankA === rankB) {
      return a
    }
    return rankB > rankA ? b : a
  }

  /**
   * Resolve a safe, valid default model for the active provider.
   *
   * Prefers the provider's configured default model, then the optimal-model default
   * tier, then the model implied by the current analysis mode.
   * @returns {string | null} A model name believed to be valid, or null if none can be determined
   */
  getSafeDefaultModel(): string | null {
    const optimalModels = this.getOptimalModels()
    const candidates = [
      this.aiProvider?.modelConfig?.default,
      optimalModels.default,
      getModelForAnalysisMode(this.analysisMode, optimalModels),
    ]

    for (const candidate of candidates) {
      if (candidate && candidate !== 'unknown') {
        return candidate
      }
    }

    return null
  }

  /**
   * Best-effort lookup of the model ids the active provider exposes.
   * Normalizes string / { id } / { name } descriptor shapes.
   * @returns {Promise<string[]>} Available model identifiers (empty when unknown)
   */
  async getAvailableModelIds(): Promise<string[]> {
    if (!this.aiProvider?.getAvailableModels) {
      return []
    }

    const models = await this.aiProvider.getAvailableModels()
    if (!Array.isArray(models)) {
      return []
    }

    return models
      .map((model: unknown): string | null => {
        if (typeof model === 'string') {
          return model
        }
        if (model && typeof model === 'object') {
          const descriptor = model as Record<string, unknown>
          if (typeof descriptor.id === 'string') {
            return descriptor.id
          }
          if (typeof descriptor.name === 'string') {
            return descriptor.name
          }
        }
        return null
      })
      .filter((id): id is string => typeof id === 'string')
  }

  /**
   * Validate a resolved model and, if it is unknown/unavailable, warn (naming the
   * model + concrete alternatives) and substitute a valid default model. We never
   * silently dispatch an unknown model to the provider.
   * @param {string} model - The model the selection logic resolved
   * @returns {Promise<string>} A model name to actually send to the provider
   */
  async ensureValidModel(model: string): Promise<string> {
    // Nothing concrete to validate (e.g. provider exposed no default) — fall back
    // to whatever safe default we can derive.
    if (!model || model === 'unknown') {
      const fallback = this.getSafeDefaultModel()
      if (fallback) {
        console.warn(
          colors.warningMessage(`⚠️  No concrete model resolved; using default model '${fallback}'`)
        )
        return fallback
      }
      return model
    }

    const providerName = this.aiProvider?.getName ? this.aiProvider.getName() : 'unknown'

    const warnAndFallback = (reason: string, alternatives: string[]): string => {
      const fallback = this.getSafeDefaultModel()
      const suggested =
        alternatives && alternatives.length > 0
          ? alternatives
          : getSuggestedModels(providerName, model)

      console.warn(
        colors.warningMessage(`⚠️  Model '${model}' is not available${reason ? `: ${reason}` : ''}`)
      )
      if (suggested.length > 0) {
        console.warn(colors.infoMessage(`💡 Available alternatives: ${suggested.join(', ')}`))
      }

      if (fallback && fallback !== model) {
        console.warn(colors.infoMessage(`↪️  Falling back to default model '${fallback}'`))
        return fallback
      }

      // No safer default than the requested model itself — surface this honestly.
      const firstSuggested = suggested[0]
      if (firstSuggested && firstSuggested !== model) {
        console.warn(
          colors.infoMessage(`↪️  Falling back to alternative model '${firstSuggested}'`)
        )
        return firstSuggested
      }

      return model
    }

    // Preferred path: ask the provider to validate the model.
    if (typeof this.aiProvider?.validateModelAvailability === 'function') {
      try {
        const modelCheck = await this.aiProvider.validateModelAvailability(model)
        if (modelCheck?.available) {
          return modelCheck.model || model
        }
        return warnAndFallback(modelCheck?.error || '', modelCheck?.alternatives || [])
      } catch (error) {
        // Do NOT swallow: surface the validation failure, then proceed with a
        // known-good default rather than dispatching an unverified model.
        const message = error instanceof Error ? error.message : String(error)
        return warnAndFallback(`validation failed (${message})`, [])
      }
    }

    // Fallback path: no provider-level validation available. Cross-check against the
    // provider's advertised model list and the capabilities database.
    const availableModels = await this.getAvailableModelIds()
    if (availableModels.length > 0 && !availableModels.includes(model)) {
      return warnAndFallback('not in provider model list', availableModels)
    }

    // If the provider exposes no model list, fall back to the capabilities database:
    // a model matching no known pattern is treated as unrecognized.
    if (
      availableModels.length === 0 &&
      !Object.keys(MODEL_CAPABILITIES).some((pattern) => model.includes(pattern))
    ) {
      return warnAndFallback('unrecognized model', [])
    }

    return model
  }

  async generateAISummary(commitAnalysis, preSelectedModel: any = null) {
    if (!this.hasAI) {
      return this.generateRuleBasedSummary(commitAnalysis)
    }

    const selectedModel = preSelectedModel || (await this.selectOptimalModel(commitAnalysis))

    try {
      let modelToUse = selectedModel || this.aiProvider?.modelConfig?.default || 'unknown'
      const filesCount = commitAnalysis.files?.length || 0
      const linesChanged =
        (commitAnalysis.diffStats?.insertions || 0) + (commitAnalysis.diffStats?.deletions || 0)

      console.log(
        colors.infoMessage(
          `Selected model: ${colors.highlight(modelToUse)} for commit (${colors.number(filesCount)} files, ${colors.number(linesChanged)} lines)`
        )
      )

      // Validate the resolved model BEFORE spending an API call on it. We never
      // silently dispatch an unknown/unavailable model: if validation fails we warn
      // (naming the model + concrete alternatives) and fall back to a valid default
      // model so the request still goes to a real, supported model.
      modelToUse = await this.ensureValidModel(modelToUse)

      const prompt = buildEnhancedPrompt(commitAnalysis, this.analysisMode)
      const systemPrompt = this.promptEngine.systemPrompts.master
      const modeSpecificPrompt =
        this.promptEngine.systemPrompts[this.analysisMode] ||
        this.promptEngine.systemPrompts.standard

      const optimizedPrompt = this.promptEngine.optimizeForProvider(
        prompt,
        this.aiProvider.getName ? this.aiProvider.getName() : 'unknown',
        this.aiProvider.getCapabilities ? this.aiProvider.getCapabilities() : {}
      )

      const messages = [
        {
          role: 'system',
          content: `${systemPrompt}\n\n${modeSpecificPrompt}`,
        },
        {
          role: 'user',
          content: optimizedPrompt,
        },
      ]

      this.metrics.apiCalls++

      // Set token limits based on analysis mode and commit complexity
      let maxTokens = 2000 // Default
      if (this.analysisMode === 'enterprise') {
        maxTokens = 4000
      } else if (this.analysisMode === 'detailed') {
        maxTokens = 3000
      }

      // Increase token limit for very large commits
      if (filesCount > 50 || linesChanged > 10000) {
        maxTokens = Math.min(maxTokens + 2000, 8000)
      }

      const response = await this.generateCompletion(messages, {
        model: modelToUse,
        max_tokens: maxTokens,
        temperature: 0.3,
      })

      // Debug logging removed

      if (response?.usage) {
        this.metrics.totalTokens +=
          (response.usage.prompt_tokens || 0) + (response.usage.completion_tokens || 0)
      }

      const content = response?.content || response?.text
      if (response?.error || !content || String(content).trim() === '') {
        // The provider returned an error-shaped object (handleProviderError) or empty
        // content WITHOUT throwing. Treat this as a genuine AI failure and degrade
        // transparently to rule-based analysis instead of emitting a fabricated
        // "chore/low" placeholder mislabelled as AI output (this is the no-credentials /
        // unreachable-provider path, and silently faking AI output violates the core promise).
        this.metrics.ruleBasedFallbacks++
        console.warn(
          colors.warningMessage(
            `⚠️  AI provider returned no usable content${response?.error ? `: ${response.error}` : ''}; using pattern-based analysis`
          )
        )
        return this.generateRuleBasedSummary(commitAnalysis)
      }

      const parsedResponse = parseAIResponse(content, commitAnalysis)
      return parsedResponse
    } catch (error) {
      // Provide helpful error messages and guidance
      const errorContext = this.getErrorContext(error)

      if (errorContext.isConnectionError) {
        console.warn(
          colors.warningMessage(`⚠️  AI provider connection failed: ${errorContext.message}`)
        )
        if (errorContext.suggestions.length > 0) {
          console.warn(colors.infoMessage(`💡 Suggestions: ${errorContext.suggestions.join(', ')}`))
        }
      } else if (errorContext.isConfigurationError) {
        console.warn(colors.warningMessage(`⚠️  Configuration issue: ${errorContext.message}`))
        if (errorContext.suggestions.length > 0) {
          console.warn(colors.infoMessage(`💡 Try: ${errorContext.suggestions.join(', ')}`))
        }
      } else {
        console.warn(colors.warningMessage(`⚠️  AI analysis failed: ${error.message}`))
        console.warn(colors.infoMessage('💡 Falling back to pattern-based analysis'))
      }

      this.metrics.ruleBasedFallbacks++
      return this.generateRuleBasedSummary(commitAnalysis)
    }
  }

  async analyzeChanges(changes, type, _outputMode = 'console') {
    try {
      const changesSummary = summarizeFileChanges(changes)

      const _changesData = {
        changeType: type,
        totalFiles: changes.length,
        categories: changesSummary.categories,
        changesByCategory: Object.entries(changesSummary.categories).map(([cat, files]) => ({
          category: cat,
          files: files.map((f) => ({ status: f.status, path: f.path })),
        })),
      }

      const basePrompt = `Analyze these git changes and provide a summary suitable for a changelog entry.
**CHANGE TYPE:** ${type}
**FILES:** ${changes.length} files changed
**CATEGORIES:** ${Object.keys(changesSummary.categories).join(', ')}
**CHANGES BY CATEGORY:**
${Object.entries(changesSummary.categories)
  .map(([cat, files]) => `${cat}: ${files.map((f) => `${f.status} ${f.path}`).join(', ')}`)
  .join('\n')}
**ANALYSIS REQUIREMENTS:**
1. What is the primary purpose of these changes?
2. What category do they fall into (feature, fix, improvement, etc.)?
3. How would you describe the impact (critical, high, medium, low)?
4. Are these user-facing changes?`

      if (!this.hasAI) {
        return this.analyzeChangesRuleBased(changes, type)
      }

      const messages = [
        {
          role: 'system',
          content:
            this.promptEngine.systemPrompts.changesAnalysis ||
            'You are an expert at analyzing code changes.',
        },
        {
          role: 'user',
          content: basePrompt,
        },
      ]

      const response = await this.generateCompletion(messages)
      const responseText = response.content || response.text || ''

      return {
        summary: responseText,
        category: this.extractCategory(responseText),
        impact: this.extractImpact(responseText),
        userFacing: this.extractUserFacing(responseText),
      }
    } catch (error) {
      console.error(colors.errorMessage('Changes analysis failed:'), error.message)
      return this.analyzeChangesRuleBased(changes, type)
    }
  }

  generateRuleBasedSummary(commitAnalysis) {
    const { subject, files, diffStats, importance } = commitAnalysis

    // Use intelligent tagging for better rule-based analysis
    const analysis = this.tagger.analyzeCommit({
      message: subject,
      files: files.map((f) => ({ path: f.filePath })),
      stats: diffStats,
    })

    return {
      summary: `${subject} (${files.length} files changed)`,
      category: analysis.categories[0] || 'other',
      impact: importance || 'medium',
      tags: analysis.tags || [],
      userFacing: analysis.tags.includes('ui') || analysis.tags.includes('feature'),
    }
  }

  analyzeChangesRuleBased(changes, type) {
    const categories = this.categorizeChanges(changes)
    const primaryCategory = Object.keys(categories)[0] || 'other'

    return {
      summary: `${type}: ${changes.length} files modified in ${primaryCategory}`,
      category: primaryCategory,
      impact: this.assessImpact(changes),
      userFacing: this.isUserFacing(changes),
    }
  }

  categorizeChanges(changes) {
    const categories: Record<string, any> = {}
    changes.forEach((change) => {
      const category = this.getFileCategory(change.path)
      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(change)
    })
    return categories
  }

  getFileCategory(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return 'other'
    }
    if (filePath.includes('/test/') || filePath.endsWith('.test.js')) {
      return 'tests'
    }
    if (filePath.includes('/doc/') || filePath.endsWith('.md')) {
      return 'documentation'
    }
    if (filePath.includes('/config/') || filePath.endsWith('.json')) {
      return 'configuration'
    }
    if (filePath.includes('/src/') || filePath.endsWith('.js')) {
      return 'source'
    }
    return 'other'
  }

  assessImpact(changes) {
    if (changes.length > 20) {
      return 'high'
    }
    if (changes.length > 5) {
      return 'medium'
    }
    return 'low'
  }

  isUserFacing(changes) {
    return changes.some(
      (change) =>
        change.path &&
        typeof change.path === 'string' &&
        (change.path.includes('/ui/') ||
          change.path.includes('/component/') ||
          change.path.includes('/page/'))
    )
  }

  extractCategory(text) {
    if (!text || typeof text !== 'string') {
      return 'other'
    }
    const categories = ['feature', 'fix', 'improvement', 'refactor', 'docs', 'test']
    const lowerText = text.toLowerCase()
    for (const category of categories) {
      if (lowerText.includes(category)) {
        return category
      }
    }
    return 'other'
  }

  extractImpact(text) {
    if (!text || typeof text !== 'string') {
      return 'medium'
    }
    const impacts = ['critical', 'high', 'medium', 'low']
    const lowerText = text.toLowerCase()
    for (const impact of impacts) {
      if (lowerText.includes(impact)) {
        return impact
      }
    }
    return 'medium'
  }

  extractUserFacing(text) {
    if (!text || typeof text !== 'string') {
      return false
    }
    const lowerText = text.toLowerCase()
    return lowerText.includes('user') || lowerText.includes('ui')
  }

  // Missing AI analysis methods from original class
  async getBranchesAIAnalysis(branches, unmergedCommits, danglingCommits) {
    try {
      // Use enhanced branch analysis prompt
      const _branchData = { branches, unmergedCommits, danglingCommits }

      const basePrompt = this.promptEngine.buildRepositoryHealthPrompt(
        {
          branches,
          unmerged: unmergedCommits,
          danglingCommits,
          analysisType: 'branches',
        },
        this.analysisMode
      )

      const systemPrompt = this.promptEngine.systemPrompts.master
      const modeSpecificPrompt =
        this.promptEngine.systemPrompts[this.analysisMode] ||
        this.promptEngine.systemPrompts.standard

      const optimizedPrompt = this.promptEngine.optimizeForProvider(
        basePrompt,
        this.aiProvider.getName ? this.aiProvider.getName() : 'unknown',
        this.aiProvider.getCapabilities ? this.aiProvider.getCapabilities() : {}
      )

      const response = await this.generateCompletion(
        [
          { role: 'system', content: `${systemPrompt}\n\n${modeSpecificPrompt}` },
          { role: 'user', content: optimizedPrompt },
        ],
        { max_tokens: 400 }
      )

      this.metrics.apiCalls++
      return response.content
    } catch (error) {
      this.metrics.errors++
      return `AI analysis failed: ${error.message}`
    }
  }

  async getRepositoryAIAnalysis(comprehensiveData) {
    try {
      // Use enhanced repository health analysis prompt
      const healthData = {
        statistics: comprehensiveData.statistics,
        branches: comprehensiveData.branches,
        workingDirectory: comprehensiveData.workingDirectory,
        unmergedCommits: comprehensiveData.unmergedCommits,
        danglingCommits: comprehensiveData.danglingCommits,
        commitQuality: comprehensiveData.commitQuality || {},
        security: comprehensiveData.security || {},
      }

      const basePrompt = this.promptEngine.buildRepositoryHealthPrompt(
        healthData,
        this.analysisMode
      )

      const systemPrompt = this.promptEngine.systemPrompts.master
      const modeSpecificPrompt =
        this.promptEngine.systemPrompts[this.analysisMode] ||
        this.promptEngine.systemPrompts.standard

      const optimizedPrompt = this.promptEngine.optimizeForProvider(
        basePrompt,
        this.aiProvider.getName ? this.aiProvider.getName() : 'unknown',
        this.aiProvider.getCapabilities ? this.aiProvider.getCapabilities() : {}
      )

      const response = await this.generateCompletion(
        [
          { role: 'system', content: `${systemPrompt}\n\n${modeSpecificPrompt}` },
          { role: 'user', content: optimizedPrompt },
        ],
        { max_tokens: 500 }
      )

      this.metrics.apiCalls++
      return response.content
    } catch (error) {
      this.metrics.errors++
      return `AI analysis failed: ${error.message}`
    }
  }

  async getUntrackedFilesAIAnalysis(categories) {
    try {
      const prompt = `Analyze these untracked files and provide recommendations:

Files by category:
${Object.entries(categories as Record<string, string[]>)
  .map(
    ([cat, files]) =>
      `${cat}: ${files.length} files (${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''})`
  )
  .join('\n')}

Provide analysis on:
1. Which files should be tracked in git?
2. Which files should be added to .gitignore?
3. Any security concerns (config files, secrets)?
4. Organizational recommendations?

Be concise and actionable.`

      const response = await this.generateCompletion(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        { max_tokens: 400 }
      )

      this.metrics.apiCalls++
      return response.content
    } catch (error) {
      this.metrics.errors++
      return `AI analysis failed: ${error.message}`
    }
  }

  getErrorContext(error) {
    const errorMessage = error.message.toLowerCase()

    // Connection errors
    if (
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('connection refused') ||
      errorMessage.includes('unreachable') ||
      errorMessage.includes('timeout')
    ) {
      return {
        isConnectionError: true,
        message: 'Cannot connect to AI provider',
        suggestions: [
          'Check internet connection',
          'Verify provider service is running',
          'Check firewall settings',
        ],
      }
    }

    // Authentication errors
    if (
      errorMessage.includes('api key') ||
      errorMessage.includes('401') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid key')
    ) {
      return {
        isConfigurationError: true,
        message: 'Invalid or missing API key',
        suggestions: [
          'Check API key configuration in .env.local',
          'Verify API key is valid and active',
          'Run `ai-changelog init` to reconfigure',
        ],
      }
    }

    // Model availability errors
    if (
      errorMessage.includes('model') &&
      (errorMessage.includes('not found') || errorMessage.includes('unavailable'))
    ) {
      return {
        isConfigurationError: true,
        message: 'Model not available',
        suggestions: ['Try a different model', 'Check provider model list', 'Update configuration'],
      }
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return {
        isConnectionError: true,
        message: 'Rate limit exceeded',
        suggestions: ['Wait before retrying', 'Upgrade API plan', 'Use a different provider'],
      }
    }

    // Generic error
    return {
      isConnectionError: false,
      isConfigurationError: false,
      message: error.message,
      suggestions: ['Check provider configuration', 'Try again later'],
    }
  }

  setModelOverride(model) {
    this.modelOverride = model
  }

  getMetrics() {
    return this.metrics
  }

  resetMetrics() {
    this.metrics = {
      apiCalls: 0,
      ruleBasedFallbacks: 0,
      totalTokens: 0,
    }
  }
}
