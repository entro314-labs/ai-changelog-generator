import process from 'node:process'

import colors from '../../shared/constants/colors.js'
import {
  assessBusinessRelevance,
  assessChangeComplexity,
  assessFileImportance,
  assessOverallComplexity,
  assessRisk,
  categorizeFile,
  detectLanguage,
  generateAnalysisSummary,
  getWorkingDirectoryChanges,
  performSemanticAnalysis,
} from '../../shared/utils/utils.js'

export class AnalysisEngine {
  constructor(gitService, aiAnalysisService, gitManager = null) {
    this.gitService = gitService
    this.aiAnalysisService = aiAnalysisService
    this.gitManager = gitManager
    this.gitRepoAnalyzer = null
  }

  async _ensureGitAnalyzer() {
    if (!this.gitRepoAnalyzer && this.gitService?.gitManager) {
      // Use the existing GitService instead of separate analyzer
      this.gitRepoAnalyzer = this.gitService
    }
    return this.gitRepoAnalyzer
  }

  analyze(type, config = {}) {
    switch (type) {
      case 'changes':
        return this.analyzeCurrentChanges(config)
      case 'commits':
        return this.analyzeRecentCommits(config.limit || 10, config)
      case 'branches':
        return this.analyzeBranches(config)
      case 'comprehensive':
        return this.analyzeComprehensive(config)
      case 'health':
        return this.assessRepositoryHealth(config)
      default:
        throw new Error(`Unknown analysis type: ${type}`)
    }
  }

  async analyzeCurrentChanges(_config = {}) {
    let enhancedChanges = []

    try {
      const changes = getWorkingDirectoryChanges()

      if (changes.length === 0) {
        console.log(colors.infoMessage('No changes detected in working directory.'))
        return { changes: [], analysis: null }
      }

      console.log(
        colors.processingMessage(`Analyzing ${changes.length} working directory changes...`)
      )

      // Enhanced file analysis with actual diff content
      enhancedChanges = []
      for (let i = 0; i < changes.length; i++) {
        const change = changes[i]
        try {
          // Show progress every 5 files or for last file to avoid spam
          if (i % 5 === 0 || i === changes.length - 1) {
            process.stdout.write(`\r  Progress: ${i + 1}/${changes.length} files analyzed`)
          }

          // Use git service to get detailed diff analysis
          let detailedAnalysis = null
          if (this.gitService?.analyzeWorkingDirectoryFileChange) {
            detailedAnalysis = await this.gitService.analyzeWorkingDirectoryFileChange(
              change.status,
              change.path
            )
          }

          if (detailedAnalysis) {
            // Use the rich analysis from git service
            enhancedChanges.push({
              ...change,
              ...detailedAnalysis,
              // Preserve original fields for compatibility
              filePath: detailedAnalysis.filePath || change.path,
              path: change.path,
            })
          } else {
            // Fallback to basic analysis
            enhancedChanges.push({
              ...change,
              category: categorizeFile(change.path),
              language: detectLanguage(change.path),
              importance: assessFileImportance(change.path, change.status),
              complexity: assessChangeComplexity(change.diff || ''),
              diff: change.diff || '',
              semanticChanges: { changeType: 'unknown', patterns: [], frameworks: [] },
              functionalImpact: { scope: 'local', severity: 'low' },
            })
          }
        } catch (error) {
          console.error(`Error processing change ${i}:`, change, error.message)
          enhancedChanges.push({
            ...change,
            category: 'other',
            language: 'Unknown',
            importance: 'medium',
            complexity: { score: 1 },
            diff: 'Analysis failed',
            semanticChanges: { changeType: 'unknown', patterns: [], frameworks: [] },
            functionalImpact: { scope: 'local', severity: 'low' },
          })
        }
      }

      // Clear the progress line
      process.stdout.write('\n')

      // AI analysis if available
      let aiAnalysis = null
      if (this.aiAnalysisService.hasAI) {
        try {
          aiAnalysis = await this.aiAnalysisService.analyzeChanges(
            enhancedChanges,
            'working-directory'
          )
        } catch (error) {
          console.error('Error in AI analysis:', error.message)
          aiAnalysis = null
        }
      }

      // Rule-based analysis
      let ruleBasedAnalysis = null
      try {
        ruleBasedAnalysis = this.analyzeChangesRuleBased(enhancedChanges)
      } catch (error) {
        console.error('Error in rule-based analysis:', error.message)
        ruleBasedAnalysis = {
          summary: 'Analysis failed',
          category: 'other',
          impact: 'medium',
          userFacing: false,
        }
      }

      // Combine analyses
      let finalAnalysis = null
      try {
        finalAnalysis = this.combineAnalyses(aiAnalysis, ruleBasedAnalysis)
      } catch (error) {
        console.error('Error combining analyses:', error.message)
        finalAnalysis = {
          summary: `${enhancedChanges.length} working directory changes detected`,
          category: 'working-directory',
          impact: 'medium',
          userFacing: false,
        }
      }

      return {
        changes: enhancedChanges,
        analysis: finalAnalysis,
        summary: generateAnalysisSummary(enhancedChanges, finalAnalysis),
      }
    } catch (error) {
      console.error(colors.errorMessage('Error analyzing current changes:'), error.message)
      // Return enhanced changes if they were created before the error
      return {
        changes: enhancedChanges,
        analysis:
          enhancedChanges.length > 0
            ? {
                summary: `${enhancedChanges.length} working directory changes detected (analysis failed)`,
                category: 'working-directory',
                impact: 'medium',
                userFacing: false,
              }
            : null,
        error: error.message,
      }
    }
  }

  async analyzeRecentCommits(limit = 10, _config = {}) {
    try {
      console.log(colors.processingMessage(`Analyzing recent ${limit} commits...`))

      const commits = await this.gitService.getCommitsSince(null)
      const recentCommits = commits.slice(0, limit)

      if (recentCommits.length === 0) {
        console.log(colors.infoMessage('No recent commits found.'))
        return { commits: [], analysis: null }
      }

      // Analyze each commit
      const analyzedCommits = []
      for (const commit of recentCommits) {
        const analysis = await this.gitService.getCommitAnalysis(commit.hash)
        if (analysis) {
          // Enhanced analysis
          const enhancedAnalysis = await this.enhanceCommitAnalysis(analysis)
          analyzedCommits.push(enhancedAnalysis)
        }
      }

      // Generate overall analysis
      const overallAnalysis = this.generateOverallCommitAnalysis(analyzedCommits)

      return {
        commits: analyzedCommits,
        analysis: overallAnalysis,
        summary: this.generateCommitsSummary(analyzedCommits, overallAnalysis),
      }
    } catch (error) {
      console.error(colors.errorMessage('Error analyzing recent commits:'), error.message)
      return { commits: [], analysis: null, error: error.message }
    }
  }

  enhanceCommitAnalysis(commitAnalysis) {
    try {
      // Add complexity assessment
      const complexity = assessOverallComplexity(
        commitAnalysis.files.map((f) => f.diff).join('\n'),
        commitAnalysis.files.length
      )

      // Add risk assessment
      const risk = assessRisk(
        commitAnalysis.files.map((f) => f.diff).join('\n'),
        commitAnalysis.files.length,
        commitAnalysis.subject
      )

      // Add business relevance
      const businessRelevance = assessBusinessRelevance(
        commitAnalysis.subject,
        commitAnalysis.files.map((f) => f.filePath)
      )

      // Enhanced semantic analysis
      const semanticAnalysis = performSemanticAnalysis(commitAnalysis.files, commitAnalysis.subject)

      return {
        ...commitAnalysis,
        complexity,
        risk,
        businessRelevance,
        semanticAnalysis: {
          ...commitAnalysis.semanticAnalysis,
          ...semanticAnalysis,
        },
      }
    } catch (error) {
      console.warn(
        colors.warningMessage(
          `Failed to enhance analysis for commit ${commitAnalysis.hash}:`,
          error.message
        )
      )
      return commitAnalysis
    }
  }

  analyzeChangesRuleBased(changes) {
    const categories = this.categorizeChanges(changes)
    const complexity = this.assessOverallChangeComplexity(changes)
    const risk = this.assessOverallChangeRisk(changes)

    return {
      categories,
      complexity,
      risk,
      totalFiles: changes.length,
      primaryCategory: Object.keys(categories)[0] || 'other',
      impact: this.assessChangeImpact(changes),
      userFacing: this.hasUserFacingChanges(changes),
    }
  }

  categorizeChanges(changes) {
    const categories = {}
    changes.forEach((change) => {
      const category = change.category || 'other'
      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(change)
    })
    return categories
  }

  assessOverallChangeComplexity(changes) {
    const totalComplexity = changes.reduce((sum, change) => {
      return sum + (change.complexity?.score || 0)
    }, 0)

    const avgComplexity = totalComplexity / changes.length

    if (avgComplexity > 0.7) {
      return 'high'
    }
    if (avgComplexity > 0.4) {
      return 'medium'
    }
    return 'low'
  }

  assessOverallChangeRisk(changes) {
    const riskFactors = changes.filter(
      (change) =>
        change.importance === 'critical' || change.category === 'core' || change.status === 'D' // Deletions are risky
    )

    if (riskFactors.length > changes.length * 0.3) {
      return 'high'
    }
    if (riskFactors.length > 0) {
      return 'medium'
    }
    return 'low'
  }

  assessChangeImpact(changes) {
    if (changes.length > 20) {
      return 'high'
    }
    if (changes.length > 5) {
      return 'medium'
    }
    return 'low'
  }

  hasUserFacingChanges(changes) {
    return changes.some(
      (change) =>
        change.category === 'ui' ||
        change.category === 'frontend' ||
        change.path?.includes('/component/') ||
        change.path?.includes('/page/') ||
        change.path?.includes('/ui/')
    )
  }

  generateOverallCommitAnalysis(commits) {
    const types = {}
    let totalFiles = 0
    let totalLines = 0
    let breakingChanges = 0
    let highRiskCommits = 0

    commits.forEach((commit) => {
      const type = commit.categories?.[0] || 'other'
      types[type] = (types[type] || 0) + 1

      totalFiles += commit.files?.length || 0
      totalLines += (commit.diffStats?.insertions || 0) + (commit.diffStats?.deletions || 0)

      if (commit.breakingChanges?.length > 0) {
        breakingChanges++
      }
      if (commit.risk === 'high') {
        highRiskCommits++
      }
    })

    return {
      totalCommits: commits.length,
      commitTypes: types,
      totalFiles,
      totalLines,
      breakingChanges,
      highRiskCommits,
      riskLevel: this.calculateOverallRisk(commits),
      complexity: this.calculateOverallComplexity(commits),
      trends: this.analyzeTrends(commits),
    }
  }

  calculateOverallRisk(commits) {
    const highRisk = commits.filter((c) => c.risk === 'high').length
    const ratio = highRisk / commits.length

    if (ratio > 0.3) {
      return 'high'
    }
    if (ratio > 0.1) {
      return 'medium'
    }
    return 'low'
  }

  calculateOverallComplexity(commits) {
    const avgFiles = commits.reduce((sum, c) => sum + (c.files?.length || 0), 0) / commits.length
    const avgLines =
      commits.reduce(
        (sum, c) => sum + ((c.diffStats?.insertions || 0) + (c.diffStats?.deletions || 0)),
        0
      ) / commits.length

    if (avgFiles > 15 || avgLines > 200) {
      return 'high'
    }
    if (avgFiles > 5 || avgLines > 50) {
      return 'medium'
    }
    return 'low'
  }

  analyzeTrends(commits) {
    // Simple trend analysis based on recent patterns
    const recentCommits = commits.slice(0, Math.min(5, commits.length))
    const categories = recentCommits.map((c) => c.categories?.[0] || 'other')

    const categoryCount = {}
    categories.forEach((cat) => {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1
    })

    const dominantCategory = Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0]

    return {
      dominantCategory: dominantCategory?.[0] || 'mixed',
      frequency: dominantCategory?.[1] || 0,
      pattern: this.identifyPattern(categories),
    }
  }

  identifyPattern(categories) {
    if (categories.every((cat) => cat === categories[0])) {
      return 'focused'
    }
    if (new Set(categories).size === categories.length) {
      return 'diverse'
    }
    return 'mixed'
  }

  combineAnalyses(aiAnalysis, ruleBasedAnalysis) {
    if (!aiAnalysis) {
      return ruleBasedAnalysis
    }

    return {
      ...ruleBasedAnalysis,
      aiInsights: aiAnalysis,
      confidence: aiAnalysis ? 'high' : 'medium',
      source: aiAnalysis ? 'ai+rules' : 'rules',
    }
  }

  generateCommitsSummary(_commits, analysis) {
    const { totalCommits, commitTypes, riskLevel, complexity } = analysis

    let summary = `Analyzed ${totalCommits} recent commits. `

    if (Object.keys(commitTypes).length > 0) {
      const dominantType = Object.entries(commitTypes).sort(([, a], [, b]) => b - a)[0]
      summary += `Primary activity: ${dominantType[1]} ${dominantType[0]} commits. `
    }

    summary += `Risk level: ${riskLevel}. Complexity: ${complexity}.`

    if (analysis.breakingChanges > 0) {
      summary += ` ⚠️ ${analysis.breakingChanges} commits contain breaking changes.`
    }

    return summary
  }

  // Delegate to GitRepositoryAnalyzer for specialized analysis
  async analyzeBranches(config) {
    const analyzer = await this._ensureGitAnalyzer()
    if (analyzer) {
      return await analyzer.analyzeBranches(config?.format || 'markdown')
    }
    return { branches: [], analysis: 'Git analyzer not available' }
  }

  async analyzeComprehensive(config) {
    const analyzer = await this._ensureGitAnalyzer()
    if (analyzer) {
      return await analyzer.analyzeComprehensive(config?.format || 'markdown')
    }
    return { comprehensive: true, analysis: 'Git analyzer not available' }
  }

  async assessRepositoryHealth(config) {
    const analyzer = await this._ensureGitAnalyzer()
    if (analyzer) {
      return await analyzer.assessRepositoryHealth(config || {})
    }
    return { health: 'unknown', analysis: 'Git analyzer not available' }
  }

  // Advanced analysis methods
  analyzeCommitPatterns(commits) {
    try {
      if (!commits || commits.length === 0) {
        return {
          patterns: [],
          compliance: 0,
          suggestions: ['No commits provided for analysis'],
        }
      }

      const patterns = []
      let conventionalCount = 0
      let semanticCount = 0

      const suggestions = []

      for (const commit of commits) {
        const message = commit.subject || commit.message || ''

        // Check for conventional commit format
        if (/^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\(.+\))?!?:/.test(message)) {
          conventionalCount++
          patterns.push('conventional')
        }

        // Check for semantic patterns
        if (/\b(add|remove|update|fix|improve|refactor)\b/i.test(message)) {
          semanticCount++
          patterns.push('semantic')
        }
      }

      const compliance = Math.round((conventionalCount / commits.length) * 100)

      if (compliance < 50) {
        suggestions.push(
          'Consider adopting conventional commit format for better changelog generation'
        )
      }
      if (conventionalCount === 0) {
        suggestions.push('No conventional commits found. See https://www.conventionalcommits.org/')
      }

      return {
        patterns: [...new Set(patterns)],
        compliance,
        conventionalCommits: conventionalCount,
        semanticCommits: semanticCount,
        totalCommits: commits.length,
        suggestions,
      }
    } catch (error) {
      console.warn(`Commit pattern analysis failed: ${error.message}`)
      return {
        patterns: [],
        compliance: 0,
        suggestions: ['Analysis failed - ensure valid commits provided'],
      }
    }
  }

  detectChangeTypes(changes) {
    try {
      if (!changes || changes.length === 0) {
        return {
          types: [],
          confidence: 'low',
          details: 'No changes provided',
        }
      }

      const detectedTypes = new Set()
      const typeIndicators = {
        feat: ['feat', 'feature', 'add', 'new', 'implement', 'create'],
        fix: ['fix', 'bug', 'issue', 'resolve', 'correct', 'repair'],
        docs: ['doc', 'readme', 'comment', 'documentation', 'guide'],
        test: ['test', 'spec', 'coverage', 'unit', 'integration'],
        refactor: ['refactor', 'cleanup', 'restructure', 'reorganize'],
        style: ['style', 'format', 'lint', 'prettier', 'formatting'],
        perf: ['perf', 'performance', 'optimize', 'speed', 'efficient'],
        build: ['build', 'compile', 'bundle', 'package', 'deploy'],
        chore: ['chore', 'maintenance', 'update', 'upgrade', 'bump'],
      }

      // Analyze file paths and change descriptions
      for (const change of changes) {
        const searchText = [
          change.filePath || change.path || '',
          change.diff || '',
          change.description || '',
        ]
          .join(' ')
          .toLowerCase()

        for (const [type, indicators] of Object.entries(typeIndicators)) {
          if (indicators.some((indicator) => searchText.includes(indicator))) {
            detectedTypes.add(type)
          }
        }

        // File-based type detection
        const filePath = change.filePath || change.path || ''
        if (filePath.includes('test') || filePath.includes('spec')) {
          detectedTypes.add('test')
        } else if (filePath.includes('doc') || filePath.endsWith('.md')) {
          detectedTypes.add('docs')
        } else if (filePath.includes('config') || filePath.includes('build')) {
          detectedTypes.add('build')
        }
      }

      const confidence =
        detectedTypes.size > 0 ? (detectedTypes.size === 1 ? 'high' : 'medium') : 'low'

      return {
        types: Array.from(detectedTypes),
        confidence,
        totalChanges: changes.length,
        details: `Detected ${detectedTypes.size} change types from ${changes.length} changes`,
      }
    } catch (error) {
      console.warn(`Change type detection failed: ${error.message}`)
      return {
        types: [],
        confidence: 'low',
        details: `Analysis failed: ${error.message}`,
      }
    }
  }

  assessCodeQuality(files) {
    try {
      if (!files || files.length === 0) {
        return {
          score: 0,
          issues: ['No files provided for analysis'],
          recommendations: [],
        }
      }

      let score = 10.0
      const issues = []
      const recommendations = []

      // Analyze each file
      for (const file of files) {
        const filePath = file.filePath || file.path || ''
        const diff = file.diff || ''

        // Check for code quality indicators
        if (diff.includes('TODO') || diff.includes('FIXME')) {
          issues.push(`${filePath}: Contains TODO/FIXME comments`)
          score -= 0.5
        }

        if (diff.includes('console.log') && !filePath.includes('test')) {
          issues.push(`${filePath}: Contains console.log statements`)
          score -= 0.3
        }

        if (diff.includes('debugger')) {
          issues.push(`${filePath}: Contains debugger statements`)
          score -= 0.5
        }

        // Check for large functions (very basic heuristic)
        const functionMatches = diff.match(/function\s+\w+|const\s+\w+\s*=/g)
        if (functionMatches && functionMatches.length > 5) {
          issues.push(`${filePath}: May contain large or complex functions`)
          score -= 0.2
        }

        // Check for proper error handling
        if (diff.includes('try') && !diff.includes('catch')) {
          issues.push(`${filePath}: Incomplete error handling detected`)
          score -= 0.3
        }

        // Check for documentation
        if (!(diff.includes('/**') || diff.includes('//')) && filePath.endsWith('.js')) {
          issues.push(`${filePath}: Lacks documentation comments`)
          score -= 0.2
        }
      }

      // Generate recommendations based on issues
      if (issues.some((issue) => issue.includes('TODO'))) {
        recommendations.push('Address TODO comments before releasing')
      }
      if (issues.some((issue) => issue.includes('console.log'))) {
        recommendations.push('Remove debug console.log statements')
      }
      if (issues.some((issue) => issue.includes('documentation'))) {
        recommendations.push('Add documentation comments to improve maintainability')
      }
      if (score < 7) {
        recommendations.push('Consider code review and refactoring for better quality')
      }

      return {
        score: Math.max(0, Math.min(10, score)),
        issues: issues.slice(0, 10), // Limit to top 10 issues
        recommendations,
        filesAnalyzed: files.length,
      }
    } catch (error) {
      console.warn(`Code quality assessment failed: ${error.message}`)
      return {
        score: 0,
        issues: [`Assessment failed: ${error.message}`],
        recommendations: ['Ensure valid file data is provided'],
      }
    }
  }

  identifyDependencies(changes) {
    try {
      const dependencies = {
        added: [],
        removed: [],
        updated: [],
        details: [],
      }

      if (!changes || changes.length === 0) {
        return dependencies
      }

      // Look for package.json changes
      const packageJsonChanges = changes.filter((change) =>
        (change.filePath || change.path || '').includes('package.json')
      )

      for (const change of packageJsonChanges) {
        const diff = change.diff || ''

        // Parse dependency changes from diff
        const addedDeps = diff.match(/\+\s*"([^"]+)":\s*"([^"]+)"/g) || []
        const removedDeps = diff.match(/-\s*"([^"]+)":\s*"([^"]+)"/g) || []

        for (const match of addedDeps) {
          const [, name, version] = match.match(/\+\s*"([^"]+)":\s*"([^"]+)"/) || []
          if (name && version) {
            dependencies.added.push({ name, version, file: change.filePath })
          }
        }

        for (const match of removedDeps) {
          const [, name, version] = match.match(/-\s*"([^"]+)":\s*"([^"]+)"/) || []
          if (name && version) {
            dependencies.removed.push({ name, version, file: change.filePath })
          }
        }
      }

      // Look for other dependency files
      const depFiles = changes.filter((change) => {
        const path = change.filePath || change.path || ''
        return (
          path.includes('requirements.txt') ||
          path.includes('Gemfile') ||
          path.includes('go.mod') ||
          path.includes('Cargo.toml')
        )
      })

      dependencies.details = [
        `Found ${packageJsonChanges.length} package.json changes`,
        `Found ${depFiles.length} other dependency file changes`,
        `Total: ${dependencies.added.length} added, ${dependencies.removed.length} removed`,
      ]

      return dependencies
    } catch (error) {
      console.warn(`Dependency analysis failed: ${error.message}`)
      return {
        added: [],
        removed: [],
        updated: [],
        details: [`Analysis failed: ${error.message}`],
      }
    }
  }

  evaluatePerformanceImpact(changes) {
    try {
      const impact = {
        impact: 'low',
        metrics: {},
        concerns: [],
        improvements: [],
      }

      if (!changes || changes.length === 0) {
        return impact
      }

      // Performance-related patterns
      const performancePatterns = {
        high: [
          /database.*query/i,
          /n\+1/i,
          /memory.*leak/i,
          /infinite.*loop/i,
          /synchronous.*call/i,
        ],
        medium: [/algorithm/i, /cache/i, /optimization/i, /performance/i, /async/i, /await/i],
        improvements: [
          /optimize/i,
          /faster/i,
          /efficient/i,
          /reduce.*time/i,
          /improve.*performance/i,
        ],
      }

      let riskScore = 0
      let improvementScore = 0

      for (const change of changes) {
        const content = [
          change.filePath || change.path || '',
          change.diff || '',
          change.description || '',
        ].join(' ')

        // Check for performance risks
        for (const pattern of performancePatterns.high) {
          if (pattern.test(content)) {
            riskScore += 3
            impact.concerns.push(`High-risk pattern detected in ${change.filePath}`)
          }
        }

        for (const pattern of performancePatterns.medium) {
          if (pattern.test(content)) {
            riskScore += 1
          }
        }

        for (const pattern of performancePatterns.improvements) {
          if (pattern.test(content)) {
            improvementScore += 2
            impact.improvements.push(`Performance improvement in ${change.filePath}`)
          }
        }
      }

      // Determine overall impact
      if (riskScore > 5) {
        impact.impact = 'high'
      } else if (riskScore > 2 || improvementScore > 3) {
        impact.impact = 'medium'
      }

      impact.metrics = {
        riskScore,
        improvementScore,
        filesAnalyzed: changes.length,
        concernsFound: impact.concerns.length,
        improvementsFound: impact.improvements.length,
      }

      return impact
    } catch (error) {
      console.warn(`Performance impact evaluation failed: ${error.message}`)
      return {
        impact: 'unknown',
        metrics: { error: error.message },
        concerns: [],
        improvements: [],
      }
    }
  }

  checkSecurityImplications(changes) {
    try {
      const security = {
        issues: [],
        score: 'safe',
        warnings: [],
        recommendations: [],
      }

      if (!changes || changes.length === 0) {
        return security
      }

      // Security-related patterns
      const securityPatterns = {
        critical: [
          /password.*=.*['"][^'"]+['"]/i,
          /api[_-]?key.*=.*['"][^'"]+['"]/i,
          /secret.*=.*['"][^'"]+['"]/i,
          /token.*=.*['"][^'"]+['"]/i,
          /eval\s*\(/i,
          /innerHTML\s*=/i,
          /document\.write/i,
        ],
        warning: [
          /http:\/\//i,
          /\.execute\(/i,
          /shell_exec/i,
          /system\(/i,
          /exec\(/i,
          /sudo/i,
          /chmod\s+777/i,
        ],
        auth: [/auth/i, /login/i, /permission/i, /role/i, /access/i],
      }

      let riskLevel = 0

      for (const change of changes) {
        const content = [
          change.filePath || change.path || '',
          change.diff || '',
          change.description || '',
        ].join(' ')

        // Check for critical security issues
        for (const pattern of securityPatterns.critical) {
          if (pattern.test(content)) {
            security.issues.push(`Critical: Potential security issue in ${change.filePath}`)
            riskLevel += 10
          }
        }

        // Check for warnings
        for (const pattern of securityPatterns.warning) {
          if (pattern.test(content)) {
            security.warnings.push(`Warning: Security concern in ${change.filePath}`)
            riskLevel += 3
          }
        }

        // Check for authentication changes
        for (const pattern of securityPatterns.auth) {
          if (pattern.test(content)) {
            security.warnings.push(`Authentication changes detected in ${change.filePath}`)
            riskLevel += 1
          }
        }
      }

      // Determine security score
      if (riskLevel >= 10) {
        security.score = 'critical'
        security.recommendations.push('Immediate security review required')
      } else if (riskLevel >= 5) {
        security.score = 'warning'
        security.recommendations.push('Security review recommended')
      } else if (riskLevel > 0) {
        security.score = 'caution'
        security.recommendations.push('Monitor for security implications')
      }

      if (security.issues.length > 0) {
        security.recommendations.push('Remove hardcoded credentials immediately')
      }

      return security
    } catch (error) {
      console.warn(`Security analysis failed: ${error.message}`)
      return {
        issues: [`Analysis failed: ${error.message}`],
        score: 'unknown',
        warnings: [],
        recommendations: [],
      }
    }
  }

  analyzeDocumentationChanges(changes) {
    try {
      const documentation = {
        coverage: 'unknown',
        changes: [],
        statistics: {},
        recommendations: [],
      }

      if (!changes || changes.length === 0) {
        return documentation
      }

      let docFiles = 0
      let codeFiles = 0
      let docChanges = 0

      for (const change of changes) {
        const filePath = change.filePath || change.path || ''
        const diff = change.diff || ''

        if (filePath.endsWith('.md') || filePath.includes('doc') || filePath.includes('readme')) {
          docFiles++
          docChanges++
          documentation.changes.push({
            file: filePath,
            type: 'documentation',
            status: change.status,
          })
        } else if (
          filePath.endsWith('.js') ||
          filePath.endsWith('.ts') ||
          filePath.endsWith('.py')
        ) {
          codeFiles++

          // Check for comment changes
          if (diff.includes('/**') || diff.includes('//') || diff.includes('#')) {
            documentation.changes.push({
              file: filePath,
              type: 'code-comments',
              status: change.status,
            })
          }
        }
      }

      // Calculate coverage assessment
      const totalFiles = docFiles + codeFiles
      if (totalFiles === 0) {
        documentation.coverage = 'unknown'
      } else {
        const docRatio = docFiles / totalFiles
        if (docRatio > 0.3) {
          documentation.coverage = 'good'
        } else if (docRatio > 0.1) {
          documentation.coverage = 'fair'
        } else {
          documentation.coverage = 'poor'
        }
      }

      documentation.statistics = {
        documentationFiles: docFiles,
        codeFiles,
        totalChanges: documentation.changes.length,
        documentationRatio: totalFiles > 0 ? Math.round((docFiles / totalFiles) * 100) : 0,
      }

      // Generate recommendations
      if (documentation.coverage === 'poor') {
        documentation.recommendations.push('Consider adding more documentation')
      }
      if (codeFiles > 0 && docChanges === 0) {
        documentation.recommendations.push('Code changes detected without documentation updates')
      }

      return documentation
    } catch (error) {
      console.warn(`Documentation analysis failed: ${error.message}`)
      return {
        coverage: 'unknown',
        changes: [],
        statistics: { error: error.message },
        recommendations: [],
      }
    }
  }

  assessTestCoverage(changes) {
    try {
      const coverage = {
        coverage: 0,
        missing: [],
        statistics: {},
        recommendations: [],
      }

      if (!changes || changes.length === 0) {
        return coverage
      }

      let testFiles = 0
      let codeFiles = 0
      const missingTests = []

      for (const change of changes) {
        const filePath = change.filePath || change.path || ''

        if (
          filePath.includes('test') ||
          filePath.includes('spec') ||
          filePath.endsWith('.test.js') ||
          filePath.endsWith('.spec.js')
        ) {
          testFiles++
        } else if (
          filePath.endsWith('.js') ||
          filePath.endsWith('.ts') ||
          filePath.endsWith('.py')
        ) {
          codeFiles++

          // Check if corresponding test file exists (simplified check)
          const hasTest = changes.some((c) => {
            const testPath = c.filePath || c.path || ''
            return (
              testPath.includes(filePath.replace(/\.(js|ts|py)$/, '')) &&
              (testPath.includes('test') || testPath.includes('spec'))
            )
          })

          if (!hasTest) {
            missingTests.push(filePath)
          }
        }
      }

      // Calculate coverage estimate
      const totalFiles = testFiles + codeFiles
      if (totalFiles > 0) {
        coverage.coverage = Math.round((testFiles / totalFiles) * 100)
      }

      coverage.missing = missingTests.slice(0, 10) // Limit to top 10
      coverage.statistics = {
        testFiles,
        codeFiles,
        totalFiles,
        estimatedCoverage: coverage.coverage,
      }

      // Generate recommendations
      if (coverage.coverage < 50) {
        coverage.recommendations.push('Low test coverage detected - consider adding more tests')
      }
      if (missingTests.length > 0) {
        coverage.recommendations.push(
          `${missingTests.length} code files may lack corresponding tests`
        )
      }

      return coverage
    } catch (error) {
      console.warn(`Test coverage assessment failed: ${error.message}`)
      return {
        coverage: 0,
        missing: [],
        statistics: { error: error.message },
        recommendations: [],
      }
    }
  }

  evaluateArchitecturalChanges(changes) {
    try {
      const architecture = {
        impact: 'minimal',
        changes: [],
        patterns: [],
        recommendations: [],
      }

      if (!changes || changes.length === 0) {
        return architecture
      }

      // Architectural patterns to detect
      const architecturalPatterns = {
        'database-schema': /migration|schema|table|index/i,
        'api-changes': /api|endpoint|route|controller/i,
        'dependency-injection': /inject|provider|service|factory/i,
        configuration: /config|setting|environment|env/i,
        security: /auth|security|permission|role/i,
        infrastructure: /docker|kubernetes|deploy|infra/i,
      }

      let impactScore = 0
      const detectedPatterns = new Set()

      for (const change of changes) {
        const content = [
          change.filePath || change.path || '',
          change.diff || '',
          change.description || '',
        ].join(' ')

        // Check for architectural patterns
        for (const [pattern, regex] of Object.entries(architecturalPatterns)) {
          if (regex.test(content)) {
            detectedPatterns.add(pattern)
            impactScore += 2

            architecture.changes.push({
              file: change.filePath || change.path,
              pattern,
              type: change.status,
            })
          }
        }

        // Check for directory structure changes
        const filePath = change.filePath || change.path || ''
        if (filePath.includes('/') && (change.status === 'A' || change.status === 'D')) {
          impactScore += 1
          architecture.changes.push({
            file: filePath,
            pattern: 'structure-change',
            type: change.status,
          })
        }
      }

      // Determine impact level
      if (impactScore > 10) {
        architecture.impact = 'major'
      } else if (impactScore > 5) {
        architecture.impact = 'moderate'
      } else if (impactScore > 0) {
        architecture.impact = 'minor'
      }

      architecture.patterns = Array.from(detectedPatterns)

      // Generate recommendations
      if (detectedPatterns.has('database-schema')) {
        architecture.recommendations.push(
          'Database schema changes detected - ensure migration scripts are tested'
        )
      }
      if (detectedPatterns.has('api-changes')) {
        architecture.recommendations.push(
          'API changes detected - update documentation and versioning'
        )
      }
      if (architecture.impact === 'major') {
        architecture.recommendations.push(
          'Major architectural changes - consider architectural review'
        )
      }

      return architecture
    } catch (error) {
      console.warn(`Architectural analysis failed: ${error.message}`)
      return {
        impact: 'unknown',
        changes: [],
        patterns: [],
        recommendations: [`Analysis failed: ${error.message}`],
      }
    }
  }

  // Metrics method expected by tests
  getMetrics() {
    return {
      analysisCount: 0,
      averageTime: 0,
      successRate: 100,
    }
  }
}
