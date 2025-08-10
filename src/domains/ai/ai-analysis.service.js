import colors from '../../shared/constants/colors.js'
import {
  buildEnhancedPrompt,
  parseAIResponse,
  summarizeFileChanges,
} from '../../shared/utils/utils.js'

export class AIAnalysisService {
  constructor(aiProvider, promptEngine, tagger, analysisMode = 'standard') {
    this.aiProvider = aiProvider
    this.promptEngine = promptEngine
    this.tagger = tagger
    this.analysisMode = analysisMode
    this.hasAI = aiProvider?.isAvailable()
    this.metrics = {
      apiCalls: 0,
      ruleBasedFallbacks: 0,
      totalTokens: 0,
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

      if (optimalModel?.model) {
        if (optimalModel.capabilities?.reasoning) {
          console.log(colors.aiMessage('Using reasoning model for complex analysis'))
        }
        return optimalModel.model
      }
    } catch (_error) {
      console.warn(colors.warningMessage('Model selection failed, using default'))
    }

    return null
  }

  async generateAISummary(commitAnalysis, preSelectedModel = null) {
    if (!this.hasAI) {
      return this.generateRuleBasedSummary(commitAnalysis)
    }

    const selectedModel = preSelectedModel || (await this.selectOptimalModel(commitAnalysis))

    try {
      const modelToUse = selectedModel || this.aiProvider?.modelConfig?.default || 'unknown'
      const filesCount = commitAnalysis.files?.length || 0
      const linesChanged =
        (commitAnalysis.diffStats?.insertions || 0) + (commitAnalysis.diffStats?.deletions || 0)

      console.log(
        colors.infoMessage(
          `Selected model: ${colors.highlight(modelToUse)} for commit (${colors.number(filesCount)} files, ${colors.number(linesChanged)} lines)`
        )
      )

      // Skip model validation for now to avoid token limit issues
      // const modelCheck = await this.aiProvider.validateModelAvailability(modelToUse);
      // if (!modelCheck.available) {
      //   console.warn(colors.warningMessage(`⚠️  Selected model '${modelToUse}' not available, falling back to rule-based analysis`));
      //   console.warn(colors.warningMessage(`   Error: ${modelCheck.error || 'Model validation failed'}`));
      //
      //   if (modelCheck.alternatives && modelCheck.alternatives.length > 0) {
      //     console.warn(colors.infoMessage(`   💡 Available alternatives: ${modelCheck.alternatives.join(', ')}`));
      //   }
      //
      //   this.metrics.ruleBasedFallbacks++;
      //   return this.generateRuleBasedSummary(commitAnalysis);
      // }

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

      const response = await this.aiProvider.generateCompletion(messages, {
        model: modelToUse,
        max_tokens: maxTokens,
        temperature: 0.3,
      })

      if (response?.usage) {
        this.metrics.totalTokens +=
          (response.usage.prompt_tokens || 0) + (response.usage.completion_tokens || 0)
      }

      const parsedResponse = parseAIResponse(response.content || response.text, commitAnalysis)
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

      const response = await this.aiProvider.generateText(messages)
      return {
        summary: response.text,
        category: this.extractCategory(response.text),
        impact: this.extractImpact(response.text),
        userFacing: this.extractUserFacing(response.text),
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
    const categories = {}
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

      const response = await this.aiProvider.generateCompletion(
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

      const response = await this.aiProvider.generateCompletion(
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
${Object.entries(categories)
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

      const response = await this.aiProvider.generateCompletion(
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
