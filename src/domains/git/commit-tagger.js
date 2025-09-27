import {
  analyzeSemanticChanges,
  assessBusinessRelevance,
  assessFileImportance,
  categorizeFile,
  detectLanguage,
} from '../../shared/utils/utils.js'

/**
 * CommitTagger - Intelligent commit analysis and categorization
 *
 * This class provides sophisticated commit analysis including:
 * - Conventional commit parsing
 * - Semantic change detection
 * - Breaking change identification
 * - Impact assessment
 * - Tag generation for categorization
 */
export class CommitTagger {
  constructor(options = {}) {
    this.options = {
      strictConventionalCommits: false,
      enableSemanticAnalysis: true,
      includeFileAnalysis: true,
      ...options,
    }

    // Conventional commit types with their properties
    this.commitTypes = {
      feat: {
        category: 'feature',
        impact: 'minor',
        userFacing: true,
        description: 'New features',
      },
      fix: {
        category: 'bugfix',
        impact: 'patch',
        userFacing: true,
        description: 'Bug fixes',
      },
      docs: {
        category: 'documentation',
        impact: 'patch',
        userFacing: false,
        description: 'Documentation changes',
      },
      style: {
        category: 'style',
        impact: 'patch',
        userFacing: false,
        description: 'Code style changes',
      },
      refactor: {
        category: 'refactor',
        impact: 'patch',
        userFacing: false,
        description: 'Code refactoring',
      },
      perf: {
        category: 'performance',
        impact: 'minor',
        userFacing: true,
        description: 'Performance improvements',
      },
      test: {
        category: 'test',
        impact: 'patch',
        userFacing: false,
        description: 'Test changes',
      },
      build: {
        category: 'build',
        impact: 'patch',
        userFacing: false,
        description: 'Build system changes',
      },
      ci: {
        category: 'ci',
        impact: 'patch',
        userFacing: false,
        description: 'CI/CD changes',
      },
      chore: {
        category: 'chore',
        impact: 'patch',
        userFacing: false,
        description: 'Maintenance tasks',
      },
      revert: {
        category: 'revert',
        impact: 'patch',
        userFacing: true,
        description: 'Reverts',
      },
      merge: {
        category: 'merge',
        impact: 'patch',
        userFacing: false,
        description: 'Merge commits',
      },
    }

    // Breaking change indicators
    this.breakingChangePatterns = [
      /BREAKING\s*CHANGE/i,
      /!:/,
      /breaking/i,
      /incompatible/i,
      /remove.*api/i,
      /drop.*support/i,
      /major.*change/i,
    ]

    // High-impact file patterns
    this.criticalFilePatterns = [
      /package\.json$/,
      /\.env/,
      /docker/i,
      /migration/i,
      /schema/i,
      /config/i,
      /security/i,
      /auth/i,
    ]
  }

  /**
   * Analyze a commit and generate comprehensive tagging information
   * @param {Object} commit - Commit object with message, files, and stats
   * @returns {Object} Analysis results with tags, categories, and metadata
   */
  analyzeCommit(commit) {
    const analysis = {
      semanticChanges: [],
      breakingChanges: [],
      categories: [],
      tags: [],
      importance: 'medium',
      impact: 'patch',
      userFacing: false,
      scope: null,
      type: null,
      conventional: false,
    }

    // Parse conventional commit structure
    const conventionalParsing = this.parseConventionalCommit(commit.message)
    if (conventionalParsing.isConventional) {
      analysis.conventional = true
      analysis.type = conventionalParsing.type
      analysis.scope = conventionalParsing.scope
      analysis.categories.push(this.commitTypes[conventionalParsing.type]?.category || 'other')
      analysis.impact = this.commitTypes[conventionalParsing.type]?.impact || 'patch'
      analysis.userFacing = this.commitTypes[conventionalParsing.type]?.userFacing
    }

    // Detect breaking changes
    analysis.breakingChanges = this.detectBreakingChanges(commit.message, commit.files)
    if (analysis.breakingChanges.length > 0) {
      analysis.categories.push('breaking')
      analysis.tags.push('breaking')
      analysis.impact = 'major'
      analysis.importance = 'critical'
    }

    // Analyze file changes if available
    if (this.options.includeFileAnalysis && commit.files) {
      const fileAnalysis = this.analyzeFileChanges(commit.files)
      analysis.semanticChanges.push(...fileAnalysis.semanticChanges)
      analysis.categories.push(...fileAnalysis.categories)
      analysis.tags.push(...fileAnalysis.tags)

      // Upgrade importance based on file analysis
      if (fileAnalysis.hasCriticalFiles) {
        analysis.importance = analysis.importance === 'critical' ? 'critical' : 'high'
      }
    }

    // Semantic analysis of commit message
    if (this.options.enableSemanticAnalysis) {
      const semanticAnalysis = this.performSemanticAnalysis(commit.message)
      analysis.semanticChanges.push(...semanticAnalysis.changes)
      analysis.tags.push(...semanticAnalysis.tags)
    }

    // Business relevance assessment
    const businessRelevance = assessBusinessRelevance(
      commit.message,
      commit.files?.map((f) => f.path) || []
    )
    if (businessRelevance.isBusinessCritical) {
      analysis.importance = 'critical'
      analysis.tags.push('business-critical')
    }

    // Size-based analysis
    if (commit.stats) {
      const sizeAnalysis = this.analyzeSizeImpact(commit.stats)
      if (sizeAnalysis.isLarge) {
        analysis.tags.push('large-change')
        analysis.importance = analysis.importance === 'low' ? 'medium' : analysis.importance
      }
    }

    // Clean up and deduplicate
    analysis.categories = [...new Set(analysis.categories)].filter(Boolean)
    analysis.tags = [...new Set(analysis.tags)].filter(Boolean)

    // Fallback categorization if no categories found
    if (analysis.categories.length === 0) {
      analysis.categories.push(this.inferCategoryFromMessage(commit.message))
    }

    return analysis
  }

  /**
   * Parse conventional commit message format
   * @param {string} message - Commit message
   * @returns {Object} Parsed commit information
   */
  parseConventionalCommit(message) {
    // Conventional commit regex: type(scope): description
    const conventionalRegex = /^(\w+)(\(([^)]+)\))?(!)?:\s*(.+)$/

    const match = message.match(conventionalRegex)
    if (!match) {
      return { isConventional: false }
    }

    const [, type, , scope, breaking, description] = match

    return {
      isConventional: true,
      type: type.toLowerCase(),
      scope: scope || null,
      hasBreaking: Boolean(breaking),
      description: description.trim(),
      isValidType: type.toLowerCase() in this.commitTypes,
    }
  }

  /**
   * Detect breaking changes in commit message and files
   * @param {string} message - Commit message
   * @param {Array} files - Changed files
   * @returns {Array} Array of breaking change descriptions
   */
  detectBreakingChanges(message, files = []) {
    const breakingChanges = []

    // Check commit message for breaking change indicators
    for (const pattern of this.breakingChangePatterns) {
      if (pattern.test(message)) {
        breakingChanges.push(
          `Breaking change detected in commit message: "${message.match(pattern)[0]}"`
        )
        break
      }
    }

    // Check for API/interface changes in files
    if (files) {
      const apiFiles = files.filter(
        (file) =>
          file.path &&
          (file.path.includes('api') ||
            file.path.includes('interface') ||
            file.path.includes('types') ||
            file.path.includes('schema'))
      )

      if (apiFiles.length > 0) {
        const deletions = apiFiles.filter((f) => f.status === 'D')
        const majorModifications = apiFiles.filter(
          (f) => f.diff && (f.diff.includes('- export') || f.diff.includes('- function'))
        )

        if (deletions.length > 0) {
          breakingChanges.push(`API files deleted: ${deletions.map((f) => f.path).join(', ')}`)
        }

        if (majorModifications.length > 0) {
          breakingChanges.push(
            `Potential API changes in: ${majorModifications.map((f) => f.path).join(', ')}`
          )
        }
      }
    }

    return breakingChanges
  }

  /**
   * Analyze file changes for semantic patterns
   * @param {Array} files - Array of file change objects
   * @returns {Object} File analysis results
   */
  analyzeFileChanges(files) {
    const analysis = {
      semanticChanges: [],
      categories: [],
      tags: [],
      hasCriticalFiles: false,
    }

    const categoryCounts = {}
    let hasDatabaseChanges = false
    let hasConfigChanges = false
    let hasTestChanges = false

    for (const file of files) {
      if (!file.path) continue

      // Categorize file
      const category = categorizeFile(file.path)
      categoryCounts[category] = (categoryCounts[category] || 0) + 1

      // Detect file importance
      const importance = assessFileImportance(file.path, file.status)
      if (importance === 'critical') {
        analysis.hasCriticalFiles = true
      }

      // Check for critical file patterns
      for (const pattern of this.criticalFilePatterns) {
        if (pattern.test(file.path)) {
          analysis.hasCriticalFiles = true
          break
        }
      }

      // Specific pattern detection
      if (file.path.includes('migration') || file.path.includes('schema')) {
        hasDatabaseChanges = true
      }

      if (file.path.includes('config') || file.path.includes('.env')) {
        hasConfigChanges = true
      }

      if (file.path.includes('test') || file.path.includes('spec')) {
        hasTestChanges = true
      }

      // Language-specific analysis
      const language = detectLanguage(file.path)
      if (file.diff && this.options.enableSemanticAnalysis) {
        const semanticChanges = analyzeSemanticChanges(file.diff, file.path)
        if (semanticChanges.patterns.length > 0) {
          analysis.semanticChanges.push(...semanticChanges.patterns)
        }
      }
    }

    // Determine primary categories
    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([category]) => category)

    analysis.categories = sortedCategories.slice(0, 2) // Top 2 categories

    // Add specific tags based on detected patterns
    if (hasDatabaseChanges) {
      analysis.tags.push('database-changes')
    }
    if (hasConfigChanges) {
      analysis.tags.push('configuration')
    }
    if (hasTestChanges) {
      analysis.tags.push('tests')
    }
    if (analysis.hasCriticalFiles) {
      analysis.tags.push('critical-files')
    }

    return analysis
  }

  /**
   * Perform semantic analysis on commit message
   * @param {string} message - Commit message
   * @returns {Object} Semantic analysis results
   */
  performSemanticAnalysis(message) {
    const analysis = {
      changes: [],
      tags: [],
    }

    const lowerMessage = message.toLowerCase()

    // Action-based detection
    const actionPatterns = {
      add: /\b(add|added|adding|new|create|created|creating)\b/,
      remove: /\b(remove|removed|removing|delete|deleted|deleting)\b/,
      update: /\b(update|updated|updating|modify|modified|modifying|change|changed|changing)\b/,
      fix: /\b(fix|fixed|fixing|resolve|resolved|resolving|solve|solved|solving)\b/,
      improve:
        /\b(improve|improved|improving|enhance|enhanced|enhancing|optimize|optimized|optimizing)\b/,
      refactor: /\b(refactor|refactored|refactoring|restructure|restructured|restructuring)\b/,
    }

    for (const [action, pattern] of Object.entries(actionPatterns)) {
      if (pattern.test(lowerMessage)) {
        analysis.changes.push(action)
        analysis.tags.push(action)
      }
    }

    // Technology/framework detection
    const techPatterns = {
      react: /\breact\b/i,
      vue: /\bvue\b/i,
      angular: /\bangular\b/i,
      node: /\bnode\b/i,
      typescript: /\btypescript\b/i,
      javascript: /\bjavascript\b/i,
      database: /\b(database|db|sql|mysql|postgres|mongodb)\b/i,
      api: /\b(api|rest|graphql|endpoint)\b/i,
      docker: /\bdocker\b/i,
      kubernetes: /\bkubernetes\b/i,
    }

    for (const [tech, pattern] of Object.entries(techPatterns)) {
      if (pattern.test(message)) {
        analysis.tags.push(tech)
      }
    }

    return analysis
  }

  /**
   * Analyze size impact of commit based on statistics
   * @param {Object} stats - Commit statistics (files, insertions, deletions)
   * @returns {Object} Size analysis results
   */
  analyzeSizeImpact(stats) {
    const totalLines = (stats.insertions || 0) + (stats.deletions || 0)
    const filesCount = stats.files || 0

    return {
      isLarge: totalLines > 500 || filesCount > 20,
      isSmall: totalLines < 10 && filesCount <= 2,
      totalLines,
      filesCount,
      magnitude:
        totalLines > 1000
          ? 'huge'
          : totalLines > 500
            ? 'large'
            : totalLines > 100
              ? 'medium'
              : totalLines > 10
                ? 'small'
                : 'tiny',
    }
  }

  /**
   * Infer category from commit message when conventional commit parsing fails
   * @param {string} message - Commit message
   * @returns {string} Inferred category
   */
  inferCategoryFromMessage(message) {
    const lowerMessage = message.toLowerCase()

    // Keyword-based category inference
    const categoryKeywords = {
      feature: ['feature', 'add', 'new', 'implement', 'create'],
      bugfix: ['fix', 'bug', 'issue', 'problem', 'error', 'resolve'],
      documentation: ['doc', 'readme', 'comment', 'guide', 'manual'],
      test: ['test', 'spec', 'coverage', 'unit', 'integration'],
      refactor: ['refactor', 'cleanup', 'restructure', 'reorganize'],
      performance: ['performance', 'optimize', 'speed', 'fast', 'efficient'],
      security: ['security', 'auth', 'permission', 'vulnerability'],
      build: ['build', 'compile', 'bundle', 'package', 'deploy'],
      style: ['style', 'format', 'lint', 'prettier', 'whitespace'],
    }

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        return category
      }
    }

    return 'other'
  }

  /**
   * Get supported commit types
   * @returns {Object} Commit types configuration
   */
  getCommitTypes() {
    return this.commitTypes
  }

  /**
   * Validate commit message format
   * @param {string} message - Commit message to validate
   * @returns {Object} Validation results
   */
  validateCommitMessage(message) {
    const parsed = this.parseConventionalCommit(message)

    return {
      isValid: parsed.isConventional && parsed.isValidType,
      isConventional: parsed.isConventional,
      hasValidType: parsed.isValidType,
      type: parsed.type,
      scope: parsed.scope,
      suggestions: this.generateCommitSuggestions(message, parsed),
    }
  }

  /**
   * Generate suggestions for improving commit messages
   * @param {string} message - Original commit message
   * @param {Object} parsed - Parsed commit information
   * @returns {Array} Array of suggestion strings
   */
  generateCommitSuggestions(message, parsed) {
    const suggestions = []

    if (!parsed.isConventional) {
      const inferredCategory = this.inferCategoryFromMessage(message)
      const suggestedType =
        Object.entries(this.commitTypes).find(
          ([, config]) => config.category === inferredCategory
        )?.[0] || 'feat'

      suggestions.push(`Consider using conventional format: "${suggestedType}: ${message}"`)
    } else if (!parsed.isValidType) {
      const validTypes = Object.keys(this.commitTypes).join(', ')
      suggestions.push(`"${parsed.type}" is not a recognized type. Valid types: ${validTypes}`)
    }

    if (message.length > 72) {
      suggestions.push(
        'Consider shortening the commit message (72 characters or less is recommended)'
      )
    }

    if (message.length < 10) {
      suggestions.push('Consider adding more descriptive information to the commit message')
    }

    return suggestions
  }
}
