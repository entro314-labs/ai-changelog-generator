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
      const { GitRepositoryAnalyzer } = await import('../git/git-repository.analyzer.js')
      this.gitRepoAnalyzer = new GitRepositoryAnalyzer(
        this.gitService.gitManager,
        this.aiAnalysisService
      )
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
}
