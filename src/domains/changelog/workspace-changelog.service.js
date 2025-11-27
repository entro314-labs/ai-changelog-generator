import colors from '../../shared/constants/colors.js'
import { getWorkingDirectoryChanges } from '../../shared/utils/utils.js'
import { ChangelogService } from './changelog.service.js'

/**
 * WorkspaceChangelogService extends ChangelogService with workspace-specific functionality
 * for analyzing uncommitted changes and workspace state
 *
 * @deprecated This class is being phased out. The workspace changelog logic has been
 * consolidated into ChangelogService. This class is maintained for backward compatibility
 * with existing tests but should not be used in new code.
 */
export class WorkspaceChangelogService extends ChangelogService {
  constructor(gitService, aiAnalysisService, analysisEngine = null, configManager = null) {
    super(gitService, aiAnalysisService, analysisEngine, configManager)
    this.workspaceMetrics = {
      unstagedFiles: 0,
      stagedFiles: 0,
      untrackedFiles: 0,
      modifiedLines: 0,
    }
  }

  /**
   * Analyze workspace changes without committing
   * @returns {Promise<Object>} Workspace analysis results
   */
  async analyzeWorkspaceChanges() {
    console.log(colors.processingMessage('🔍 Analyzing workspace changes...'))

    try {
      // Get git status information using utility function
      const changes = getWorkingDirectoryChanges()

      // Categorize changes
      const status = {
        staged: [],
        unstaged: [],
        untracked: [],
      }

      changes.forEach((change) => {
        const statusCode = change.status || '??'
        if (statusCode.startsWith('??')) {
          status.untracked.push(change.filePath)
        } else if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
          status.staged.push(change.filePath)
        } else {
          status.unstaged.push(change.filePath)
        }
      })

      // Update workspace metrics
      this.workspaceMetrics.unstagedFiles = status.unstaged?.length || 0
      this.workspaceMetrics.stagedFiles = status.staged?.length || 0
      this.workspaceMetrics.untrackedFiles = status.untracked?.length || 0

      // Get detailed diff for staged/unstaged changes (empty for now)
      const diff = ''

      // Use analysis engine if available
      let analysis = null
      if (this.analysisEngine) {
        analysis = await this.analysisEngine.analyzeCurrentChanges()
      }

      return {
        status,
        diff,
        analysis,
        metrics: this.workspaceMetrics,
      }
    } catch (error) {
      console.error(colors.errorMessage(`Failed to analyze workspace: ${error.message}`))
      throw error
    }
  }

  /**
   * Generate changelog preview for workspace changes
   * @returns {Promise<string>} Preview changelog content
   */
  async generateWorkspacePreview() {
    console.log(colors.processingMessage('📝 Generating workspace preview...'))

    const workspaceData = await this.analyzeWorkspaceChanges()

    if (!workspaceData.analysis || workspaceData.analysis.changes.length === 0) {
      return colors.infoMessage('No significant workspace changes detected.')
    }

    // Generate preview using parent class methods
    const previewContent = await this.generateChangelogFromAnalysis(workspaceData.analysis)

    return previewContent
  }

  /**
   * Get workspace statistics
   * @returns {Object} Workspace statistics
   */
  getWorkspaceStats() {
    return {
      ...this.workspaceMetrics,
      hasChanges: this.hasWorkspaceChanges(),
      summary: this.getWorkspaceSummary(),
    }
  }

  /**
   * Check if workspace has any changes
   * @returns {boolean} True if workspace has changes
   */
  hasWorkspaceChanges() {
    return (
      this.workspaceMetrics.unstagedFiles > 0 ||
      this.workspaceMetrics.stagedFiles > 0 ||
      this.workspaceMetrics.untrackedFiles > 0
    )
  }

  /**
   * Get workspace summary string
   * @returns {string} Human-readable workspace summary
   */
  getWorkspaceSummary() {
    const { unstagedFiles, stagedFiles, untrackedFiles } = this.workspaceMetrics
    const parts = []

    if (stagedFiles > 0) {
      parts.push(`${stagedFiles} staged`)
    }
    if (unstagedFiles > 0) {
      parts.push(`${unstagedFiles} unstaged`)
    }
    if (untrackedFiles > 0) {
      parts.push(`${untrackedFiles} untracked`)
    }

    return parts.length > 0 ? parts.join(', ') : 'No changes'
  }

  /**
   * Validate workspace state before operations
   * @returns {Promise<boolean>} True if workspace is valid
   */
  async validateWorkspace() {
    try {
      // Check if we're in a git repository
      let isGitRepo = false
      try {
        const { execSync } = await import('node:child_process')
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
        isGitRepo = true
      } catch {
        isGitRepo = false
      }

      if (!isGitRepo) {
        console.error(colors.errorMessage('Not in a git repository'))
        return false
      }

      const changes = getWorkingDirectoryChanges()

      // Check if workspace has changes
      if (!this.hasWorkspaceChanges() && changes.length === 0) {
        console.log(colors.infoMessage('No workspace changes detected'))
        return false
      }

      return true
    } catch (error) {
      console.error(colors.errorMessage(`Workspace validation failed: ${error.message}`))
      return false
    }
  }

  /**
   * Generate comprehensive workspace changelog
   * @returns {Promise<string>} Comprehensive changelog content
   */
  async generateComprehensiveWorkspaceChangelog() {
    console.log(colors.processingMessage('📋 Generating comprehensive workspace changelog...'))

    try {
      const workspaceData = await this.analyzeWorkspaceChanges()

      if (!workspaceData.analysis) {
        return this.generateBasicWorkspaceChangelog(workspaceData)
      }

      return await this.generateAIChangelogContentFromChanges(workspaceData.analysis.changes)
    } catch (error) {
      console.error(
        colors.errorMessage(`Failed to generate comprehensive changelog: ${error.message}`)
      )
      throw error
    }
  }

  /**
   * Generate AI-powered changelog content from changes
   * @param {Array} changes - Array of change objects
   * @returns {Promise<string>} Generated changelog content
   */
  async generateAIChangelogContentFromChanges(changes) {
    if (!changes || changes.length === 0) {
      return colors.infoMessage('No changes to process for changelog.')
    }

    try {
      // Use AI analysis service if available
      if (this.aiAnalysisService && this.aiAnalysisService.hasAI) {
        const enhancedChanges = await this.enhanceChangesWithDiff(changes)
        return await this.generateChangelogContent(enhancedChanges)
      }

      // Fallback to rule-based generation
      return this.generateRuleBasedChangelog(changes)
    } catch (error) {
      console.error(colors.errorMessage(`AI changelog generation failed: ${error.message}`))
      return this.generateRuleBasedChangelog(changes)
    }
  }

  /**
   * Enhance changes with diff information
   * @param {Array} changes - Array of change objects
   * @returns {Promise<Array>} Enhanced changes with diff data
   */
  async enhanceChangesWithDiff(changes) {
    const enhancedChanges = []

    for (const change of changes) {
      try {
        // For workspace changelog service, we don't have detailed diffs
        // Just add basic enhancement
        enhancedChanges.push({
          ...change,
          diff: '',
          complexity: this.assessChangeComplexity(''),
          impact: this.assessChangeImpact(change.file, ''),
        })
      } catch (error) {
        console.warn(
          colors.warningMessage(`Failed to enhance change for ${change.file}: ${error.message}`)
        )
        enhancedChanges.push(change)
      }
    }

    return enhancedChanges
  }

  /**
   * Generate changelog content from enhanced changes
   * @param {Array} enhancedChanges - Enhanced change objects
   * @returns {Promise<string>} Generated changelog content
   */
  async generateChangelogContent(enhancedChanges) {
    const sections = {
      features: [],
      fixes: [],
      improvements: [],
      docs: [],
      tests: [],
      chores: [],
    }

    // Categorize changes
    for (const change of enhancedChanges) {
      const category = this.categorizeChange(change)
      if (sections[category]) {
        sections[category].push(change)
      }
    }

    // Generate markdown content
    let content = '# Workspace Changes\n\n'

    for (const [section, changes] of Object.entries(sections)) {
      if (changes.length > 0) {
        content += `## ${this.formatSectionTitle(section)}\n\n`

        for (const change of changes) {
          content += `- ${this.formatChangeEntry(change)}\n`
        }

        content += '\n'
      }
    }

    return content
  }

  /**
   * Generate commit-style working directory entries
   * @returns {Promise<Array>} Array of commit-style entries
   */
  async generateCommitStyleWorkingDirectoryEntries() {
    const workspaceData = await this.analyzeWorkspaceChanges()
    const entries = []

    if (workspaceData.status) {
      // Process staged files
      if (workspaceData.status.staged) {
        for (const file of workspaceData.status.staged) {
          entries.push({
            type: 'staged',
            file,
            message: `Add: ${file}`,
            timestamp: new Date().toISOString(),
          })
        }
      }

      // Process unstaged files
      if (workspaceData.status.unstaged) {
        for (const file of workspaceData.status.unstaged) {
          entries.push({
            type: 'unstaged',
            file,
            message: `Modify: ${file}`,
            timestamp: new Date().toISOString(),
          })
        }
      }

      // Process untracked files
      if (workspaceData.status.untracked) {
        for (const file of workspaceData.status.untracked) {
          entries.push({
            type: 'untracked',
            file,
            message: `Create: ${file}`,
            timestamp: new Date().toISOString(),
          })
        }
      }
    }

    return entries
  }

  /**
   * Generate workspace changelog
   * @returns {Promise<string>} Workspace changelog content
   */
  async generateWorkspaceChangelog() {
    console.log(colors.processingMessage('📝 Generating workspace changelog...'))

    try {
      const entries = await this.generateCommitStyleWorkingDirectoryEntries()

      if (entries.length === 0) {
        return colors.infoMessage('No workspace changes to include in changelog.')
      }

      let content = '# Workspace Changes\n\n'
      content += `Generated on: ${new Date().toLocaleString()}\n\n`

      const groupedEntries = this.groupEntriesByType(entries)

      for (const [type, typeEntries] of Object.entries(groupedEntries)) {
        if (typeEntries.length > 0) {
          content += `## ${this.formatEntryType(type)} (${typeEntries.length})\n\n`

          for (const entry of typeEntries) {
            content += `- ${entry.message}\n`
          }

          content += '\n'
        }
      }

      return content
    } catch (error) {
      console.error(colors.errorMessage(`Failed to generate workspace changelog: ${error.message}`))
      throw error
    }
  }

  // Helper methods

  /**
   * Generate basic workspace changelog without AI
   */
  generateBasicWorkspaceChangelog(workspaceData) {
    let content = '# Workspace Changes\n\n'

    if (workspaceData.metrics) {
      content += '## Summary\n\n'
      content += `- Staged files: ${workspaceData.metrics.stagedFiles}\n`
      content += `- Unstaged files: ${workspaceData.metrics.unstagedFiles}\n`
      content += `- Untracked files: ${workspaceData.metrics.untrackedFiles}\n\n`
    }

    return content
  }

  /**
   * Generate rule-based changelog fallback
   */
  generateRuleBasedChangelog(changes) {
    let content = '# Changes Summary\n\n'

    for (const change of changes) {
      content += `- ${change.type || 'Modified'}: ${change.file}\n`
    }

    return content
  }

  /**
   * Assess change complexity
   */
  assessChangeComplexity(diff) {
    if (!diff) return 'low'

    const lines = diff.split('\n').length
    if (lines > 100) return 'high'
    if (lines > 20) return 'medium'
    return 'low'
  }

  /**
   * Assess change impact
   */
  assessChangeImpact(file, diff) {
    const criticalFiles = ['package.json', 'README.md', 'Dockerfile', '.env']
    const isCritical = criticalFiles.some((critical) => file.includes(critical))

    if (isCritical) return 'high'
    if (file.includes('test') || file.includes('spec')) return 'low'
    return 'medium'
  }

  /**
   * Categorize a change
   */
  categorizeChange(change) {
    const file = change.file.toLowerCase()

    if (file.includes('test') || file.includes('spec')) return 'tests'
    if (file.includes('readme') || file.includes('doc')) return 'docs'
    if (file.includes('fix') || change.type === 'fix') return 'fixes'
    if (file.includes('feat') || change.type === 'feature') return 'features'
    if (file.includes('config') || file.includes('package')) return 'chores'

    return 'improvements'
  }

  /**
   * Format section title
   */
  formatSectionTitle(section) {
    const titles = {
      features: 'Features',
      fixes: 'Bug Fixes',
      improvements: 'Improvements',
      docs: 'Documentation',
      tests: 'Tests',
      chores: 'Maintenance',
    }
    return titles[section] || section
  }

  /**
   * Format change entry
   */
  formatChangeEntry(change) {
    const impact = change.impact ? `[${change.impact}]` : ''
    const complexity = change.complexity ? `{${change.complexity}}` : ''
    return `${change.file} ${impact} ${complexity}`.trim()
  }

  /**
   * Group entries by type
   */
  groupEntriesByType(entries) {
    return entries.reduce((groups, entry) => {
      const type = entry.type || 'unknown'
      if (!groups[type]) groups[type] = []
      groups[type].push(entry)
      return groups
    }, {})
  }

  /**
   * Format entry type for display
   */
  formatEntryType(type) {
    const types = {
      staged: 'Staged Changes',
      unstaged: 'Unstaged Changes',
      untracked: 'New Files',
    }
    return types[type] || type
  }

  /**
   * Initialize workspace for analysis
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initializeWorkspace() {
    try {
      console.log(colors.processingMessage('🔧 Initializing workspace...'))

      // Reset metrics
      this.cleanup()

      // Validate git repository
      const isValid = await this.validateWorkspace()
      if (!isValid) {
        return false
      }

      // Perform initial analysis
      await this.analyzeWorkspaceChanges()

      console.log(colors.successMessage('✅ Workspace initialized successfully'))
      return true
    } catch (error) {
      console.error(colors.errorMessage(`Failed to initialize workspace: ${error.message}`))
      return false
    }
  }

  /**
   * Validate workspace structure
   * @returns {boolean} True if workspace structure is valid
   */
  validateWorkspaceStructure() {
    try {
      // Check if we have the required services
      if (!this.gitService) {
        console.error(colors.errorMessage('Git service not available'))
        return false
      }

      // Check if workspace has any changes to analyze
      if (!this.hasWorkspaceChanges()) {
        console.log(colors.infoMessage('No workspace changes detected'))
        return true // Still valid, just nothing to do
      }

      return true
    } catch (error) {
      console.error(colors.errorMessage(`Workspace structure validation failed: ${error.message}`))
      return false
    }
  }

  /**
   * Clean up workspace analysis resources
   */
  cleanup() {
    this.workspaceMetrics = {
      unstagedFiles: 0,
      stagedFiles: 0,
      untrackedFiles: 0,
      modifiedLines: 0,
    }
  }
}
