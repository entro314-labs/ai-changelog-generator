import { execSync } from 'node:child_process'
import process from 'node:process'

import colors from '../../shared/constants/colors.js'
import { EnhancedConsole, SimpleSpinner } from '../../shared/utils/cli-ui.js'
import { runInteractiveMode, selectSpecificCommits } from '../../shared/utils/utils.js'

/**
 * Interactive Workflow Service
 *
 * Interactive workflow management and commit message utilities
 * Provides user interaction features including:
 * - Interactive mode for guided changelog generation
 * - Commit message validation and suggestions
 * - Commit selection interfaces
 * - Change analysis for commit message generation
 */
export class InteractiveWorkflowService {
  constructor(gitService, aiAnalysisService, changelogService) {
    this.gitService = gitService
    this.aiAnalysisService = aiAnalysisService
    this.changelogService = changelogService
  }

  async runInteractiveMode() {
    return await runInteractiveMode()
  }

  async validateCommitMessage(message) {
    if (!message || message.trim().length === 0) {
      return {
        valid: false,
        issues: ['Commit message is empty'],
        suggestions: ['Provide a descriptive commit message'],
      }
    }

    const issues = []
    const suggestions = []

    // Length validation
    if (message.length < 10) {
      issues.push('Commit message is too short (minimum 10 characters)')
      suggestions.push('Add more detail about what was changed')
    }

    if (message.length > 72) {
      issues.push('Commit message first line is too long (maximum 72 characters)')
      suggestions.push('Keep the first line concise, add details in the body')
    }

    // Format validation
    const lines = message.split('\n')
    const firstLine = lines[0]

    // Check for conventional commit format
    const conventionalPattern =
      /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .+/
    if (!conventionalPattern.test(firstLine)) {
      suggestions.push('Consider using conventional commit format: type(scope): description')
    }

    // Check for imperative mood
    const imperativeWords = ['add', 'fix', 'update', 'remove', 'create', 'implement', 'refactor']
    const firstWord = firstLine
      .split(' ')[0]
      .toLowerCase()
      .replace(/[^a-z]/g, '')

    if (!imperativeWords.some((word) => firstWord.startsWith(word))) {
      suggestions.push('Use imperative mood (e.g., "Add feature" not "Added feature")')
    }

    // Check for body separation
    if (lines.length > 1 && lines[1].trim() !== '') {
      issues.push('Missing blank line between subject and body')
      suggestions.push('Add a blank line after the first line if including a body')
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions,
      score: Math.max(0, 100 - issues.length * 20 - suggestions.length * 10),
    }
  }

  async generateCommitSuggestion(message = null) {
    try {
      // If no message provided, analyze current changes
      let analysisContext = ''

      if (!message) {
        // Use the shared utility function for getting working directory changes
        const { getWorkingDirectoryChanges } = await import('../../shared/utils/utils.js')
        const changes = getWorkingDirectoryChanges()
        if (changes && changes.length > 0) {
          analysisContext = this.analyzeChangesForCommitMessage(changes, true)
        }
      }

      // Use AI to suggest better commit message
      if (this.aiAnalysisService.hasAI) {
        const prompt = message
          ? `Improve this commit message following conventional commit format.

Original: "${message}"

Provide EXACTLY 3 alternative commit messages, one per line, numbered 1-3.
Do NOT include any other text, explanations, or conversational phrases.

Requirements:
- Use conventional commit format: type(scope): description
- Keep first line under 72 characters
- Use imperative mood
- Be specific and descriptive

Example output format:
1. feat(auth): add OAuth2 authentication support
2. fix(api): resolve timeout in user endpoint
3. refactor(db): optimize query performance`
          : `Generate commit messages for these changes:

${analysisContext}

Provide EXACTLY 3 commit message suggestions, one per line, numbered 1-3.
Do NOT include any other text, explanations, or conversational phrases.

Requirements:
- Use conventional commit format: type(scope): description
- Keep first line under 72 characters
- Use imperative mood
- Be specific and descriptive

Example output format:
1. feat(auth): add OAuth2 authentication support
2. fix(api): resolve timeout in user endpoint
3. refactor(db): optimize query performance`

        const response = await this.aiAnalysisService.aiProvider.generateCompletion(
          [
            {
              role: 'user',
              content: prompt,
            },
          ],
          { max_tokens: 200 }
        )

        return {
          success: true,
          original: message,
          suggestions: this.parseCommitSuggestions(response.content),
          context: analysisContext,
        }
      }
      // Rule-based suggestions
      return this.generateRuleBasedCommitSuggestion(message, analysisContext)
    } catch (error) {
      EnhancedConsole.error(`Error generating commit suggestion: ${error.message}`)
      return {
        success: false,
        error: error.message,
        fallback: this.generateRuleBasedCommitSuggestion(message),
      }
    }
  }

  analyzeChangesForCommitMessage(changes, includeScope = false) {
    if (!changes || changes.length === 0) {
      return 'No changes detected'
    }

    const categories = this.categorizeChanges(changes)
    const primaryCategory = Object.keys(categories)[0]
    const fileCount = changes.length

    let summary = `${fileCount} file${fileCount === 1 ? '' : 's'} changed`

    if (primaryCategory) {
      summary += ` in ${primaryCategory}`
    }

    if (includeScope) {
      const scopes = this.extractScopes(changes)
      if (scopes.length > 0) {
        summary += ` (scope: ${scopes.join(', ')})`
      }
    }

    // Add change details
    const additions = changes.filter((c) => c.status === 'A').length
    const modifications = changes.filter((c) => c.status === 'M').length
    const deletions = changes.filter((c) => c.status === 'D').length

    const details = []
    if (additions > 0) {
      details.push(`${additions} added`)
    }
    if (modifications > 0) {
      details.push(`${modifications} modified`)
    }
    if (deletions > 0) {
      details.push(`${deletions} deleted`)
    }

    if (details.length > 0) {
      summary += ` (${details.join(', ')})`
    }

    // Add actual change summaries from git diff for better context
    summary += '\n\nKey changes:\n'

    try {
      // Get a concise summary of actual changes, limiting to top 10 files
      const filesToAnalyze = changes.slice(0, 10)

      filesToAnalyze.forEach((change) => {
        const filePath = change.filePath || change.path
        const status = change.status

        try {
          if (status === 'M' || status === 'MM') {
            // For modified files, get a brief diff stat
            const diffStat = execSync(`git diff HEAD -- "${filePath}" | head -50`, {
              encoding: 'utf8',
              maxBuffer: 1024 * 100,
            })

            if (diffStat) {
              // Extract some meaningful info from diff
              const addedLines = (diffStat.match(/^\+(?!\+)/gm) || []).length
              const removedLines = (diffStat.match(/^-(?!-)/gm) || []).length

              // Try to extract function/class names or key changes
              const meaningfulLines = diffStat
                .split('\n')
                .filter(
                  (line) =>
                    line.startsWith('+') &&
                    (line.includes('function') ||
                      line.includes('class') ||
                      line.includes('const') ||
                      line.includes('export') ||
                      line.includes('import') ||
                      line.includes('async') ||
                      line.includes('//'))
                )
                .slice(0, 2)
                .map((line) => line.substring(1).trim())

              if (meaningfulLines.length > 0) {
                summary += `- ${filePath}: +${addedLines}/-${removedLines} lines (${meaningfulLines[0].substring(0, 60)}...)\n`
              } else {
                summary += `- ${filePath}: +${addedLines}/-${removedLines} lines\n`
              }
            }
          } else if (status === 'A' || status === '??') {
            summary += `- ${filePath}: New file\n`
          } else if (status === 'D') {
            summary += `- ${filePath}: Deleted\n`
          }
        } catch (fileError) {
          // Skip files that can't be diffed
        }
      })

      if (changes.length > 10) {
        summary += `... and ${changes.length - 10} more files\n`
      }
    } catch (error) {
      // If diff analysis fails, fall back to basic summary
      console.warn('Could not analyze diffs:', error.message)
    }

    return summary
  }

  async generateChangelogForCommitHashes(commitHashes) {
    return await this.generateChangelogForCommits(commitHashes)
  }

  async selectSpecificCommits() {
    return await selectSpecificCommits()
  }

  async generateChangelogForRecentCommits(count = 10) {
    try {
      const spinner = new SimpleSpinner(`Generating changelog for recent ${count} commits...`)
      spinner.start()

      const commits =
        (await this.gitService.getCommitsSince?.(null)) ||
        (await this.gitService.getCommitAnalysis?.()) ||
        []
      const recentCommits = commits.slice(0, count)

      if (recentCommits.length === 0) {
        spinner.stop()
        EnhancedConsole.info('No recent commits found.')
        return null
      }

      const result = await this.changelogService.generateChangelogBatch(
        recentCommits.map((c) => c.hash)
      )

      spinner.succeed(`Generated changelog for ${recentCommits.length} commits`)
      return result
    } catch (error) {
      if (typeof spinner !== 'undefined') {
        spinner.fail('Failed to generate changelog')
      }
      EnhancedConsole.error(`Error generating changelog for recent commits: ${error.message}`)
      throw error
    }
  }

  async generateChangelogForCommits(commitHashes) {
    if (!commitHashes || commitHashes.length === 0) {
      EnhancedConsole.warn('No commit hashes provided')
      return null
    }

    try {
      const spinner = new SimpleSpinner(
        `Generating changelog for ${commitHashes.length} specific commits...`
      )
      spinner.start()

      // Validate commit hashes
      const validCommits = []
      for (const hash of commitHashes) {
        const analysis = await this.gitService.getCommitAnalysis(hash)
        if (analysis) {
          validCommits.push(analysis)
        } else {
          EnhancedConsole.warn(`Invalid or inaccessible commit: ${hash}`)
        }
      }

      if (validCommits.length === 0) {
        spinner.fail('No valid commits found')
        return null
      }

      // Generate AI summaries for each commit
      const analyzedCommits = []
      for (let i = 0; i < validCommits.length; i++) {
        const commit = validCommits[i]
        process.stdout.write(
          `\r${colors.statusSymbol('processing', `Processing commit ${i + 1}/${validCommits.length}: ${colors.hash(commit.hash)}`)}`
        )

        const selectedModel = await this.aiAnalysisService.selectOptimalModel(commit)
        const aiSummary = await this.aiAnalysisService.generateAISummary(commit, selectedModel)

        if (aiSummary) {
          analyzedCommits.push({
            ...commit,
            aiSummary,
            type: aiSummary.category || 'other',
            breaking: aiSummary.breaking,
          })
        }
      }

      if (analyzedCommits.length === 0) {
        spinner.fail('No commits could be analyzed')
        return null
      }

      // Generate release insights and build changelog
      const insights = await this.changelogService.generateReleaseInsights(
        analyzedCommits,
        'Selected Commits'
      )
      const changelog = await this.changelogService.buildChangelog(
        analyzedCommits,
        insights,
        'Selected Commits'
      )

      process.stdout.write(`\r${' '.repeat(80)}\r`) // Clear processing line
      spinner.succeed(`Generated changelog for ${analyzedCommits.length} commits`)

      return {
        changelog,
        insights,
        analyzedCommits,
        requestedCommits: commitHashes.length,
        processedCommits: analyzedCommits.length,
      }
    } catch (error) {
      console.error(colors.errorMessage(`Error generating changelog for commits: ${error.message}`))
      throw error
    }
  }

  // Helper methods
  categorizeChanges(changes) {
    const categories = {}
    changes.forEach((change) => {
      const category = this.getFileCategory(change.path)
      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(change)
    })

    // Sort by count
    return Object.fromEntries(
      Object.entries(categories).sort(([, a], [, b]) => b.length - a.length)
    )
  }

  getFileCategory(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return 'other'
    }

    const path = filePath.toLowerCase()

    if (path.includes('/test/') || path.includes('.test.') || path.includes('.spec.')) {
      return 'tests'
    }
    if (path.includes('/doc/') || path.endsWith('.md') || path.endsWith('.txt')) {
      return 'documentation'
    }
    if (path.includes('/config/') || path.endsWith('.json') || path.endsWith('.yaml')) {
      return 'configuration'
    }
    if (path.includes('/src/') || path.includes('/lib/')) {
      return 'source'
    }
    if (path.includes('/style/') || path.endsWith('.css') || path.endsWith('.scss')) {
      return 'styles'
    }

    return 'other'
  }

  extractScopes(changes) {
    const scopes = new Set()

    changes.forEach((change) => {
      const parts = change.path.split('/')
      if (parts.length > 1) {
        // Extract directory name as scope
        const scope = parts.at(-2)
        if (scope && scope !== '.' && scope !== '..') {
          scopes.add(scope)
        }
      }
    })

    return Array.from(scopes).slice(0, 3) // Limit to 3 scopes
  }

  parseCommitSuggestions(content) {
    // Parse AI response to extract valid commit message suggestions
    const lines = content.split('\n').filter((line) => line.trim())
    const suggestions = []

    // Valid conventional commit types
    const validTypes = [
      'feat',
      'fix',
      'docs',
      'style',
      'refactor',
      'test',
      'chore',
      'perf',
      'ci',
      'build',
      'revert',
    ]

    lines.forEach((line) => {
      // Remove numbering and clean up
      const cleaned = line
        .replace(/^\d+\.\s*/, '')
        .replace(/^-\s*/, '')
        .trim()

      // Must be a reasonable length
      if (!cleaned || cleaned.length < 10 || cleaned.length > 100) {
        return
      }

      // Must have a colon (conventional format)
      if (!cleaned.includes(':')) {
        return
      }

      // Must start with a valid conventional commit type
      const startsWithValidType = validTypes.some((type) => {
        const pattern = new RegExp(`^${type}(\\(|:)`, 'i')
        return pattern.test(cleaned)
      })

      if (startsWithValidType) {
        suggestions.push(cleaned)
      }
    })

    return suggestions.length > 0 ? suggestions : [content.trim()]
  }

  generateRuleBasedCommitSuggestion(message, context) {
    const suggestions = []

    if (message) {
      // Improve existing message
      const improved = this.improveCommitMessage(message)
      suggestions.push(improved)
    }

    if (context) {
      // Generate from context
      const fromContext = this.generateFromContext(context)
      suggestions.push(fromContext)
    }

    // Add generic suggestions
    suggestions.push(
      'feat: add new functionality',
      'fix: resolve issue with component',
      'docs: update documentation'
    )

    return {
      success: true,
      suggestions: suggestions.slice(0, 3),
      source: 'rule-based',
    }
  }

  improveCommitMessage(message) {
    // Basic improvements
    let improved = message.trim()

    // Add conventional commit prefix if missing
    if (!/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)/.test(improved)) {
      improved = `feat: ${improved}`
    }

    // Ensure imperative mood
    improved = improved.replace(/^(\w+)ed\s/, '$1 ')
    improved = improved.replace(/^(\w+)s\s/, '$1 ')

    return improved
  }

  generateFromContext(context) {
    if (!context || typeof context !== 'string') {
      return 'feat: implement changes'
    }

    if (context.includes('test')) {
      return 'test: add test coverage'
    }
    if (context.includes('doc')) {
      return 'docs: update documentation'
    }
    if (context.includes('config')) {
      return 'chore: update configuration'
    }
    if (context.includes('fix') || context.includes('bug')) {
      return 'fix: resolve issue'
    }

    return 'feat: implement changes'
  }

  // Utility method for displaying interactive results
  displayInteractiveResults(results) {
    if (!results) {
      return
    }

    console.log(colors.header('\n📊 Interactive Session Results:'))

    if (results.changelog) {
      console.log(colors.subheader('Generated Changelog:'))
      console.log(results.changelog)
    }

    if (results.insights) {
      console.log(colors.subheader('\n📈 Insights:'))
      console.log(`Total commits: ${colors.number(results.insights.totalCommits)}`)
      console.log(`Risk level: ${colors.highlight(results.insights.riskLevel)}`)
    }

    if (results.analyzedCommits) {
      console.log(
        colors.subheader(`\n🔍 Processed ${colors.number(results.analyzedCommits.length)} commits`)
      )
    }
  }
}
