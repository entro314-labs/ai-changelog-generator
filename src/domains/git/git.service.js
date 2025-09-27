import colors from '../../shared/constants/colors.js'
import { GitError } from '../../shared/utils/error-classes.js'
import {
  analyzeFunctionalImpact,
  analyzeSemanticChanges,
  assessChangeComplexity,
  assessFileImportance,
  categorizeFile,
  detectLanguage,
} from '../../shared/utils/utils.js'

export class GitService {
  constructor(gitManager, tagger) {
    this.gitManager = gitManager
    this.tagger = tagger
  }

  async getCommitAnalysis(commitHash) {
    try {
      // Validate commit hash first
      if (!this.gitManager.validateCommitHash(commitHash)) {
        console.warn(colors.warningMessage(`Invalid commit hash: ${colors.hash(commitHash)}`))
        return null
      }

      // Get comprehensive commit information
      const commitInfo = this.gitManager.execGit(
        `git show --pretty=format:"%H|%s|%an|%ad|%B" --no-patch ${commitHash}`
      )
      const lines = commitInfo.split('\n')
      const [hash, subject, author, date] = lines[0].split('|')
      const body = lines.slice(1).join('\n').trim()

      // Detect merge commits and handle them differently
      let isMergeCommit = subject.toLowerCase().includes('merge')
      if (!isMergeCommit) {
        // Check if commit has multiple parents (more reliable for merge detection)
        try {
          const parents = this.gitManager
            .execGitSafe(`git show --format='%P' --no-patch ${commitHash}`)
            .trim()
            .split(' ')
          isMergeCommit = parents.length > 1
        } catch {
          isMergeCommit = false
        }
      }

      let files = []

      if (isMergeCommit) {
        // For merge commits, get the stat summary and create a special analysis
        const statOutput = this.gitManager.execGitSafe(
          `git show --stat --pretty=format: ${commitHash}`
        )
        files = this.processMergeCommitStats(commitHash, statOutput)

        // Generate comprehensive summary for large merge commits
        if (files.length > 10) {
          const enhancedSummary = this.generateMergeCommitSummary(files, commitHash, subject)
          // Add the enhanced summary to the first file entry for the AI to use
          if (files.length > 0) {
            files[0].enhancedMergeSummary = enhancedSummary
          }
        }
      } else {
        // For regular commits, use the existing approach
        const filesCommand = `git show --name-status --pretty=format: ${commitHash}`
        const filesOutput = this.gitManager.execGitSafe(filesCommand)
        files = await Promise.all(
          filesOutput
            .split('\n')
            .filter(Boolean)
            .map(async (line) => {
              const parts = line.split('\t')
              if (parts.length < 2) {
                return null
              }
              const [status, filePath] = parts
              return await this.analyzeFileChange(commitHash, status, filePath)
            })
        )
      }

      // Filter out null entries
      const validFiles = files.filter(Boolean)

      // Get overall diff statistics
      const diffStats = this.getCommitDiffStats(commitHash)

      // Use intelligent tagging system
      const commitForTagging = {
        hash: hash.substring(0, 7),
        message: subject,
        files: validFiles.map((f) => ({ path: f.filePath })),
        stats: diffStats,
      }

      const taggingAnalysis = this.tagger.analyzeCommit(commitForTagging)

      const analysis = {
        hash: hash.substring(0, 7),
        fullHash: hash,
        subject,
        author,
        date,
        body,
        files: validFiles,
        diffStats,
        semanticChanges: taggingAnalysis.semanticChanges || [],
        breakingChanges: taggingAnalysis.breakingChanges || [],
        categories: taggingAnalysis.categories || [],
        importance: taggingAnalysis.importance || 'medium',
        tags: taggingAnalysis.tags || [],
      }

      return analysis
    } catch (error) {
      const gitError = GitError.fromCommandFailure('show', null, null, error.message, error)
      console.error(colors.errorMessage(`Error analyzing commit ${commitHash}:`), gitError.message)
      return null
    }
  }

  async analyzeFileChange(commitHash, status, filePath) {
    try {
      // Get file diff with context
      const diffCommand = `git show ${commitHash} --pretty=format: -U5 -- "${filePath}"`
      let diff = ''

      diff = this.gitManager.execGitShow(diffCommand)

      if (diff === null) {
        if (status === 'D') {
          diff = 'File deleted in this commit'
        } else {
          console.warn(
            colors.warningMessage(
              `⚠️  File ${colors.file(filePath)} diff failed for commit ${commitHash}`
            )
          )
          diff = 'File content unavailable (git show failed)'
        }
      } else if (!diff || diff.trim() === '') {
        if (status === 'A') {
          // For new files, try to get the content directly
          const newFileContent = this.gitManager.execGitShow(`git show ${commitHash}:"${filePath}"`)
          if (newFileContent && newFileContent.length > 0) {
            diff = `New file created with content:\n${newFileContent.slice(0, 1000)}${newFileContent.length > 1000 ? '\n...' : ''}`
          } else {
            diff = 'New file created (content unavailable)'
          }
        } else {
          diff = 'No changes detected (binary or empty file)'
        }
      }

      // Get file content context
      let beforeContent = ''
      let afterContent = ''

      if (status !== 'A' && !diff.includes('not available')) {
        const beforeResult = this.gitManager.execGitShow(`git show ${commitHash}~1:"${filePath}"`)
        beforeContent = beforeResult ? beforeResult.slice(0, 1000) : ''
      }

      if (status !== 'D' && !diff.includes('not available')) {
        const afterResult = this.gitManager.execGitShow(`git show ${commitHash}:"${filePath}"`)
        afterContent = afterResult ? afterResult.slice(0, 1000) : ''
      }

      return {
        status,
        filePath,
        diff,
        beforeContent,
        afterContent,
        category: categorizeFile(filePath),
        language: detectLanguage(filePath),
        importance: assessFileImportance(filePath, status),
        complexity: assessChangeComplexity(diff),
        semanticChanges: analyzeSemanticChanges(diff, filePath),
        functionalImpact: analyzeFunctionalImpact(diff, filePath, status),
      }
    } catch (error) {
      console.error(colors.errorMessage(`Error analyzing file change ${filePath}:`), error.message)
      return null
    }
  }

  async analyzeWorkingDirectoryFileChange(status, filePath) {
    try {
      let diff = ''

      // Get working directory diff based on status
      if (status === 'A' || status === '??') {
        // New/untracked file - show entire content (first 50 lines)
        try {
          const content = this.gitManager.execGitSafe(`cat "${filePath}"`)
          if (content?.trim()) {
            const lines = content.split('\n').slice(0, 50)
            diff = `New file created with ${content.split('\n').length} lines\n\nContent preview:\n${lines.join('\n')}${content.split('\n').length > 50 ? '\n... (truncated)' : ''}`
          } else {
            diff = 'New empty file created'
          }
        } catch {
          diff = 'New file created (binary or inaccessible)'
        }
      } else if (status === 'D') {
        // Deleted file - get the content that was removed for better analysis
        try {
          const headContent = this.gitManager.execGitSafe(`git show HEAD:"${filePath}"`)
          if (headContent?.trim()) {
            // Get first 30 lines to understand what was removed
            const lines = headContent.split('\n').slice(0, 30)
            diff = `File deleted from working directory\n\nRemoved content preview:\n${lines.join('\n')}${headContent.split('\n').length > 30 ? '\n... (truncated)' : ''}`
          } else {
            diff = 'File deleted from working directory (content was empty)'
          }
        } catch {
          diff = 'File deleted from working directory (content unavailable)'
        }
      } else if (status === 'M' || status.includes('M')) {
        // Modified file - get actual diff
        try {
          const diffCommand = `git diff HEAD -- "${filePath}"`
          diff = this.gitManager.execGitSafe(diffCommand)
          if (!diff || diff.trim() === '') {
            // Try staged diff if no working directory diff
            const stagedDiff = this.gitManager.execGitSafe(`git diff --cached -- "${filePath}"`)
            diff = stagedDiff || 'No diff available (binary or identical)'
          }
        } catch {
          diff = 'Modified file (diff unavailable)'
        }
      } else if (status === 'R') {
        // Renamed file
        diff = 'File renamed in working directory'
      } else {
        // Other status
        diff = `File status: ${status}`
      }

      // Get file content context
      let beforeContent = ''
      let afterContent = ''

      if (status === 'D') {
        // For deleted files, get the content that was removed
        try {
          const headResult = this.gitManager.execGitSafe(`git show HEAD:"${filePath}"`)
          beforeContent = headResult ? headResult.slice(0, 1000) : ''
        } catch {
          beforeContent = ''
        }
        // afterContent stays empty for deleted files
      } else if (status !== 'A' && status !== '??') {
        // For modified files, get both before and after
        try {
          // Get HEAD version
          const headResult = this.gitManager.execGitSafe(`git show HEAD:"${filePath}"`)
          beforeContent = headResult ? headResult.slice(0, 1000) : ''
        } catch {
          beforeContent = ''
        }

        try {
          // Get current working directory version
          const currentResult = this.gitManager.execGitSafe(`cat "${filePath}"`)
          afterContent = currentResult ? currentResult.slice(0, 1000) : ''
        } catch {
          afterContent = ''
        }
      }

      return {
        status,
        filePath,
        diff,
        beforeContent,
        afterContent,
        category: categorizeFile(filePath),
        language: detectLanguage(filePath),
        importance: assessFileImportance(filePath, status),
        complexity: assessChangeComplexity(diff),
        semanticChanges: analyzeSemanticChanges(diff, filePath),
        functionalImpact: analyzeFunctionalImpact(diff, filePath, status),
      }
    } catch (error) {
      console.error(
        colors.errorMessage(`Error analyzing working directory file change ${filePath}:`),
        error.message
      )
      return {
        status,
        filePath,
        diff: 'Analysis failed',
        beforeContent: '',
        afterContent: '',
        category: categorizeFile(filePath),
        language: 'unknown',
        importance: 'medium',
        complexity: { score: 1 },
        semanticChanges: { changeType: 'unknown', patterns: [], frameworks: [] },
        functionalImpact: { scope: 'local', severity: 'low' },
      }
    }
  }

  getCommitDiffStats(commitHash) {
    try {
      const command = `git show --stat --pretty=format: ${commitHash}`
      const output = this.gitManager.execGitSafe(command)
      const lines = output.split('\n').filter(Boolean)
      const summary = lines.at(-1)

      if (summary?.includes('changed')) {
        const match = summary.match(
          /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/
        )
        if (match) {
          return {
            files: Number.parseInt(match[1], 10),
            insertions: Number.parseInt(match[2] || 0, 10),
            deletions: Number.parseInt(match[3] || 0, 10),
          }
        }
      }

      return { files: 0, insertions: 0, deletions: 0 }
    } catch {
      return { files: 0, insertions: 0, deletions: 0 }
    }
  }

  async getCommitsSince(since) {
    try {
      const command = since ? `git log --oneline --since="${since}"` : 'git log --oneline -10'

      const output = this.gitManager.execGitSafe(command)
      return output
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, ...messageParts] = line.split(' ')
          return {
            hash: hash.substring(0, 7),
            message: messageParts.join(' '),
          }
        })
    } catch (error) {
      console.error(colors.errorMessage('Error getting commits since:'), error.message)
      return []
    }
  }

  /**
   * Process merge commit statistics to create meaningful file analysis
   */
  processMergeCommitStats(commitHash, statOutput) {
    if (!statOutput || statOutput.trim() === '') {
      return []
    }

    // Parse the git stat output to extract file information
    const lines = statOutput.split('\n').filter(Boolean)
    const files = []

    for (const line of lines) {
      // Look for lines with file changes: "filename | additions +++--- deletions"
      const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*([+\-\s]+)/)
      if (match) {
        const [, filePath, changes, diffSymbols] = match
        const additions = (diffSymbols.match(/\+/g) || []).length
        const deletions = (diffSymbols.match(/-/g) || []).length

        // Determine file status based on changes
        let status = 'M' // Default to modified
        if (additions > 0 && deletions === 0) {
          status = 'A' // Likely added
        } else if (deletions > 0 && additions === 0) {
          status = 'D' // Likely deleted
        }

        // Create a meaningful diff summary for the AI
        const diff = this.createMergeCommitDiffSummary(
          filePath,
          parseInt(changes, 10),
          additions,
          deletions,
          commitHash
        )

        files.push({
          status,
          filePath: filePath.trim(),
          diff,
          beforeContent: '',
          afterContent: '',
          category: categorizeFile(filePath),
          language: detectLanguage(filePath),
          importance: assessFileImportance(filePath, status),
          complexity: { level: changes > 100 ? 'high' : changes > 20 ? 'medium' : 'low' },
          semanticChanges: { patterns: ['merge-commit'] },
          functionalImpact: { level: changes > 50 ? 'high' : 'medium' },
          isMergeCommit: true,
          changeCount: parseInt(changes, 10),
          additions,
          deletions,
        })
      }
    }

    return files
  }

  /**
   * Create a meaningful diff summary for merge commits with enhanced categorization
   */
  createMergeCommitDiffSummary(filePath, totalChanges, additions, deletions, commitHash) {
    const changeType =
      additions > deletions ? 'expanded' : deletions > additions ? 'reduced' : 'modified'

    let summary = `Merge commit changes: ${totalChanges} lines ${changeType}`

    if (additions > 0 && deletions > 0) {
      summary += ` (${additions} added, ${deletions} removed)`
    } else if (additions > 0) {
      summary += ` (${additions} lines added)`
    } else if (deletions > 0) {
      summary += ` (${deletions} lines removed)`
    }

    // Enhanced context based on file type and size of changes
    if (filePath.includes('test')) {
      summary += ' - Test infrastructure changes from merge'
    } else if (filePath.includes('config') || filePath.includes('.json')) {
      summary += ' - Configuration and dependency changes from merge'
    } else if (filePath.includes('README') || filePath.includes('.md')) {
      summary += ' - Documentation updates from merge'
    } else if (filePath.includes('src/domains/')) {
      summary += ' - Core domain logic changes from merge'
    } else if (filePath.includes('src/infrastructure/')) {
      summary += ' - Infrastructure and provider changes from merge'
    } else if (filePath.includes('src/application/')) {
      summary += ' - Application service changes from merge'
    } else if (filePath.includes('bin/') || filePath.includes('cli')) {
      summary += ' - CLI interface changes from merge'
    } else if (totalChanges > 100) {
      summary += ' - Major code changes from merge'
    } else if (totalChanges > 20) {
      summary += ' - Moderate code changes from merge'
    } else {
      summary += ' - Minor code changes from merge'
    }

    return summary
  }

  /**
   * Generate comprehensive merge commit summary with categorized changes and technical details
   */
  generateMergeCommitSummary(files, commitHash, subject) {
    const categories = {
      tests: { count: 0, lines: 0, files: [] },
      docs: { count: 0, lines: 0, files: [] },
      config: { count: 0, lines: 0, files: [] },
      core: { count: 0, lines: 0, files: [] },
      infrastructure: { count: 0, lines: 0, files: [] },
      cli: { count: 0, lines: 0, files: [] },
      other: { count: 0, lines: 0, files: [] },
    }

    let totalLines = 0
    let totalFiles = files.length

    // Categorize files and accumulate statistics
    for (const file of files) {
      const changes = file.changeCount || 0
      totalLines += changes

      if (file.filePath.includes('test')) {
        categories.tests.count++
        categories.tests.lines += changes
        categories.tests.files.push(file.filePath)
      } else if (
        file.filePath.includes('.md') ||
        file.filePath.includes('README') ||
        file.filePath.includes('docs/')
      ) {
        categories.docs.count++
        categories.docs.lines += changes
        categories.docs.files.push(file.filePath)
      } else if (
        file.filePath.includes('config') ||
        file.filePath.includes('.json') ||
        file.filePath.includes('package.json')
      ) {
        categories.config.count++
        categories.config.lines += changes
        categories.config.files.push(file.filePath)
      } else if (file.filePath.includes('src/domains/')) {
        categories.core.count++
        categories.core.lines += changes
        categories.core.files.push(file.filePath)
      } else if (file.filePath.includes('src/infrastructure/')) {
        categories.infrastructure.count++
        categories.infrastructure.lines += changes
        categories.infrastructure.files.push(file.filePath)
      } else if (file.filePath.includes('bin/') || file.filePath.includes('cli')) {
        categories.cli.count++
        categories.cli.lines += changes
        categories.cli.files.push(file.filePath)
      } else {
        categories.other.count++
        categories.other.lines += changes
        categories.other.files.push(file.filePath)
      }
    }

    // Extract technical details from key files for more specific descriptions
    const technicalDetails = this.extractTechnicalDetailsFromMerge(files, commitHash)

    // Generate detailed summary bullets with specifics
    const bullets = []

    if (categories.tests.count > 0) {
      const testSamples = categories.tests.files
        .slice(0, 3)
        .map((f) => f.split('/').pop())
        .join(', ')
      bullets.push(
        `Added comprehensive test infrastructure with ${categories.tests.count} test files (${testSamples}${categories.tests.count > 3 ? ', ...' : ''}) totaling ${categories.tests.lines.toLocaleString()} lines of test code`
      )
    }

    if (categories.core.count > 0) {
      const coreSamples = categories.core.files
        .slice(0, 3)
        .map((f) => f.split('/').pop())
        .join(', ')
      const coreDetails = technicalDetails.filter(
        (detail) => detail.includes('Enhanced') && detail.includes('.js')
      )
      const detailSuffix =
        coreDetails.length > 0 ? ` with ${coreDetails.slice(0, 2).join(' and ')}` : ''
      bullets.push(
        `Enhanced core domain services (${coreSamples}${categories.core.count > 3 ? ', ...' : ''}) for changelog generation, AI analysis, and Git operations with ${categories.core.lines.toLocaleString()} lines changed${detailSuffix}`
      )
    }

    if (categories.infrastructure.count > 0) {
      const infraSamples = categories.infrastructure.files
        .slice(0, 3)
        .map((f) => f.split('/').pop())
        .join(', ')
      bullets.push(
        `Updated provider integrations and infrastructure services (${infraSamples}${categories.infrastructure.count > 3 ? ', ...' : ''}) across ${categories.infrastructure.count} files`
      )
    }

    if (categories.cli.count > 0) {
      const cliSamples = categories.cli.files
        .slice(0, 3)
        .map((f) => f.split('/').pop())
        .join(', ')
      bullets.push(
        `Improved CLI interface and command handling (${cliSamples}${categories.cli.count > 3 ? ', ...' : ''}) across ${categories.cli.count} files`
      )
    }

    if (categories.docs.count > 0) {
      const docSamples = categories.docs.files
        .slice(0, 3)
        .map((f) => f.split('/').pop())
        .join(', ')
      bullets.push(
        `Updated documentation and guides (${docSamples}${categories.docs.count > 3 ? ', ...' : ''}) across ${categories.docs.count} files`
      )
    }

    if (categories.config.count > 0) {
      const configSamples = categories.config.files
        .slice(0, 3)
        .map((f) => f.split('/').pop())
        .join(', ')
      const configDetails = technicalDetails.filter(
        (detail) =>
          detail.includes('dependencies') ||
          detail.includes('configuration') ||
          detail.includes('.gitignore')
      )
      const detailSuffix =
        configDetails.length > 0 ? ` including ${configDetails.slice(0, 2).join(' and ')}` : ''
      bullets.push(
        `Modified configuration files and dependencies (${configSamples}${categories.config.count > 3 ? ', ...' : ''}) across ${categories.config.count} files${detailSuffix}`
      )
    }

    // Create enhanced merge commit description
    let description = `${subject} brought together major updates across ${totalFiles} files with ${totalLines.toLocaleString()} total line changes:\n\n`

    if (bullets.length > 0) {
      description += bullets.map((bullet) => `  • ${bullet}`).join('\n')
    } else {
      description += `  • Major codebase changes across multiple modules and services`
    }

    return description
  }

  /**
   * Extract technical details from key merge commit files for specific descriptions
   */
  extractTechnicalDetailsFromMerge(files, commitHash) {
    const details = []

    // Focus on key configuration and important files for technical details
    const keyFiles = files
      .filter((file) => {
        const path = file.filePath.toLowerCase()
        return (
          path.includes('package.json') ||
          path.includes('.config.') ||
          path.includes('biome.json') ||
          path.includes('.gitignore') ||
          path.endsWith('.md') ||
          (path.includes('src/') && file.changeCount > 100)
        ) // Major code changes
      })
      .slice(0, 5) // Limit to 5 key files to avoid overwhelming

    for (const file of keyFiles) {
      try {
        // Get a sample of the actual diff for technical details
        const diffCommand = `git show ${commitHash} --pretty=format: -U2 -- "${file.filePath}"`
        const diff = this.gitManager.execGitSafe(diffCommand)

        if (diff && diff.length > 0) {
          const techDetail = this.extractSpecificChanges(file.filePath, diff)
          if (techDetail) {
            details.push(techDetail)
          }
        }
      } catch (_error) {}
    }

    return details
  }

  /**
   * Extract specific technical changes from a diff
   */
  extractSpecificChanges(filePath, diff) {
    const fileName = filePath.split('/').pop()

    // Package.json changes
    if (fileName === 'package.json') {
      const versionChanges = diff.match(/[-+]\s*"([^"]+)":\s*"([^"]+)"/g)
      if (versionChanges && versionChanges.length > 0) {
        const changes = versionChanges
          .slice(0, 3)
          .map((change) => {
            const match = change.match(/[-+]\s*"([^"]+)":\s*"([^"]+)"/)
            if (match) {
              const [, pkg, version] = match
              return `${pkg} to ${version}`
            }
            return change
          })
          .join(', ')
        return `Updated dependencies: ${changes}${versionChanges.length > 3 ? ', ...' : ''}`
      }
    }

    // Configuration file changes
    if (fileName.includes('.json') || fileName.includes('.config')) {
      const addedLines = diff
        .split('\n')
        .filter((line) => line.startsWith('+'))
        .slice(0, 3)
      if (addedLines.length > 0) {
        const configChanges = addedLines
          .map((line) => line.replace(/^\+\s*/, '').trim())
          .filter((line) => line.length > 0)
        if (configChanges.length > 0) {
          return `Modified ${fileName} configuration: ${configChanges.slice(0, 2).join(', ')}${configChanges.length > 2 ? ', ...' : ''}`
        }
      }
    }

    // .gitignore changes
    if (fileName === '.gitignore') {
      const removedPatterns = diff
        .split('\n')
        .filter((line) => line.startsWith('-'))
        .map((line) => line.replace(/^-\s*/, '').trim())
        .filter((line) => line.length > 0)
      const addedPatterns = diff
        .split('\n')
        .filter((line) => line.startsWith('+'))
        .map((line) => line.replace(/^\+\s*/, '').trim())
        .filter((line) => line.length > 0)

      if (removedPatterns.length > 0 || addedPatterns.length > 0) {
        let change = ''
        if (removedPatterns.length > 0) {
          change += `removed ${removedPatterns.slice(0, 3).join(', ')} patterns`
        }
        if (addedPatterns.length > 0) {
          change += `${change ? ' and ' : ''}added ${addedPatterns.slice(0, 3).join(', ')} patterns`
        }
        return `Updated .gitignore: ${change}`
      }
    }

    // Major code files - look for function/method additions
    if (filePath.includes('src/') && fileName.endsWith('.js')) {
      const functionMatches = diff.match(/\+.*(?:function|async|const|let|var)\s+(\w+)/g)
      if (functionMatches && functionMatches.length > 0) {
        const functions = functionMatches
          .slice(0, 3)
          .map((match) => {
            const funcMatch = match.match(/\+.*(?:function|async|const|let|var)\s+(\w+)/)
            return funcMatch ? funcMatch[1] : null
          })
          .filter(Boolean)

        if (functions.length > 0) {
          return `Enhanced ${fileName}: added ${functions.join(', ')}${functionMatches.length > 3 ? ', ...' : ''} functions`
        }
      }
    }

    return null
  }

  // Repository analysis methods (formerly in GitRepositoryAnalyzer)
  async assessRepositoryHealth(config = {}) {
    try {
      const health = {
        healthy: true,
        score: 100,
        issues: [],
        recommendations: [],
        metrics: {
          branches: 0,
          commits: 0,
          untrackedFiles: 0,
          staleBranches: 0,
          largeBinaryFiles: 0,
          commitFrequency: 0,
        },
      }

      // Get basic repository statistics
      try {
        const branchesOutput = this.gitManager.execGitSafe('git branch -a')
        health.metrics.branches = branchesOutput.split('\n').filter((line) => line.trim()).length

        const commitsOutput = this.gitManager.execGitSafe('git rev-list --all --count')
        health.metrics.commits = parseInt(commitsOutput.trim(), 10) || 0

        const untrackedOutput = this.gitManager.execGitSafe(
          'git ls-files --others --exclude-standard'
        )
        health.metrics.untrackedFiles = untrackedOutput
          .split('\n')
          .filter((line) => line.trim()).length
      } catch (error) {
        health.issues.push(`Failed to collect basic metrics: ${error.message}`)
        health.score -= 10
      }

      // Check for stale branches (no commits in last 90 days)
      try {
        const staleBranchesOutput = this.gitManager.execGitSafe(
          'git for-each-ref --format="%(refname:short) %(committerdate:iso)" refs/heads'
        )
        const staleThreshold = new Date()
        staleThreshold.setDate(staleThreshold.getDate() - 90)

        health.metrics.staleBranches = staleBranchesOutput.split('\n').filter((line) => {
          const parts = line.trim().split(' ')
          if (parts.length < 2) return false
          const commitDate = new Date(parts[1])
          return commitDate < staleThreshold
        }).length

        if (health.metrics.staleBranches > 5) {
          health.issues.push(
            `${health.metrics.staleBranches} stale branches found (no commits in 90+ days)`
          )
          health.recommendations.push(
            'Consider cleaning up old branches with: git branch -d <branch-name>'
          )
          health.score -= Math.min(20, health.metrics.staleBranches * 2)
        }
      } catch (error) {
        console.warn(`Warning: Could not check for stale branches: ${error.message}`)
      }

      // Check for large binary files in repository
      try {
        const largeFilesOutput = this.gitManager.execGitSafe(
          'git rev-list --objects --all | git cat-file --batch-check="%(objecttype) %(objectsize) %(rest)" | grep "^blob" | sort -nr -k2 | head -10'
        )
        const largeFiles = largeFilesOutput
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            const parts = line.split(' ')
            return { size: parseInt(parts[1], 10), path: parts.slice(2).join(' ') }
          })
          .filter((file) => file.size > 10 * 1024 * 1024) // 10MB threshold

        health.metrics.largeBinaryFiles = largeFiles.length
        if (largeFiles.length > 0) {
          health.issues.push(`${largeFiles.length} large files found (>10MB)`)
          health.recommendations.push('Consider using Git LFS for large binary files')
          health.score -= Math.min(15, largeFiles.length * 5)
        }
      } catch (error) {
        console.warn(`Warning: Could not check for large files: ${error.message}`)
      }

      // Calculate commit frequency (commits per week over last month)
      try {
        const oneMonthAgo = new Date()
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)
        const recentCommitsOutput = this.gitManager.execGitSafe(
          `git rev-list --count --since="${oneMonthAgo.toISOString()}" HEAD`
        )
        const recentCommits = parseInt(recentCommitsOutput.trim(), 10) || 0
        health.metrics.commitFrequency = Math.round((recentCommits / 4) * 10) / 10 // commits per week

        if (health.metrics.commitFrequency < 1) {
          health.issues.push('Low commit frequency (less than 1 commit per week)')
          health.recommendations.push('Consider more frequent commits for better project tracking')
          health.score -= 5
        }
      } catch (error) {
        console.warn(`Warning: Could not calculate commit frequency: ${error.message}`)
      }

      // Check if working directory is clean
      try {
        const statusOutput = this.gitManager.execGitSafe('git status --porcelain')
        if (statusOutput.trim()) {
          health.issues.push('Working directory has uncommitted changes')
          health.recommendations.push('Commit or stash working directory changes')
          health.score -= 5
        }
      } catch (error) {
        health.issues.push(`Could not check working directory status: ${error.message}`)
        health.score -= 5
      }

      // Check for .gitignore file
      try {
        const gitignoreExists = this.gitManager.execGitSafe('test -f .gitignore && echo "exists"')
        if (!gitignoreExists.includes('exists')) {
          health.issues.push('No .gitignore file found')
          health.recommendations.push('Add a .gitignore file to exclude unwanted files')
          health.score -= 10
        }
      } catch (error) {
        console.warn(`Warning: Could not check .gitignore: ${error.message}`)
      }

      // Determine overall health
      health.healthy = health.score >= 70
      health.score = Math.max(0, health.score)

      return health
    } catch (error) {
      console.error(`Repository health assessment failed: ${error.message}`)
      return {
        healthy: false,
        score: 0,
        issues: [`Health assessment failed: ${error.message}`],
        recommendations: ['Ensure you are in a valid Git repository'],
        metrics: { branches: 0, commits: 0, untrackedFiles: 0 },
      }
    }
  }

  async analyzeBranches(format = 'markdown') {
    try {
      const analysis = {
        branches: [],
        unmergedCommits: [],
        danglingCommits: [],
        analysis: '',
      }

      // Get all branches with their last commit info
      const branchesOutput = this.gitManager.execGitSafe(
        'git for-each-ref --format="%(refname:short)|%(committerdate:iso)|%(authorname)|%(subject)" refs/heads refs/remotes'
      )

      analysis.branches = branchesOutput
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [name, date, author, subject] = line.split('|')
          const isRemote = name.startsWith('origin/')
          const isStale = new Date() - new Date(date) > 90 * 24 * 60 * 60 * 1000 // 90 days

          return {
            name: name.trim(),
            lastCommitDate: date,
            lastCommitAuthor: author,
            lastCommitSubject: subject,
            isRemote,
            isStale,
            type: isRemote ? 'remote' : 'local',
          }
        })

      // Find unmerged commits (commits in feature branches not in main/master)
      try {
        const mainBranch = this.findMainBranch()
        if (mainBranch) {
          const localBranches = analysis.branches.filter(
            (b) => !b.isRemote && b.name !== mainBranch
          )

          for (const branch of localBranches) {
            try {
              const unmergedOutput = this.gitManager.execGitSafe(
                `git log ${mainBranch}..${branch.name} --oneline`
              )
              const unmergedCommits = unmergedOutput
                .split('\n')
                .filter((line) => line.trim())
                .map((line) => {
                  const [hash, ...messageParts] = line.split(' ')
                  return {
                    hash: hash.trim(),
                    message: messageParts.join(' '),
                    branch: branch.name,
                  }
                })

              analysis.unmergedCommits.push(...unmergedCommits)
            } catch (error) {
              console.warn(`Could not check unmerged commits for ${branch.name}: ${error.message}`)
            }
          }
        }
      } catch (error) {
        console.warn(`Could not analyze unmerged commits: ${error.message}`)
      }

      // Find dangling commits (unreachable commits)
      try {
        const danglingOutput = this.gitManager.execGitSafe('git fsck --unreachable --no-reflogs')
        analysis.danglingCommits = danglingOutput
          .split('\n')
          .filter((line) => line.includes('unreachable commit'))
          .map((line) => {
            const hash = line.split(' ').pop()
            return { hash, type: 'dangling' }
          })
      } catch (error) {
        console.warn(`Could not check for dangling commits: ${error.message}`)
      }

      // Generate analysis summary
      const totalBranches = analysis.branches.length
      const localBranches = analysis.branches.filter((b) => !b.isRemote).length
      const staleBranches = analysis.branches.filter((b) => b.isStale).length
      const unmergedCount = analysis.unmergedCommits.length
      const danglingCount = analysis.danglingCommits.length

      if (format === 'markdown') {
        analysis.analysis = `# Branch Analysis

## Summary
- **Total branches**: ${totalBranches} (${localBranches} local, ${totalBranches - localBranches} remote)
- **Stale branches**: ${staleBranches} (no commits in 90+ days)
- **Unmerged commits**: ${unmergedCount}
- **Dangling commits**: ${danglingCount}

## Branch Details
${analysis.branches
  .map(
    (b) =>
      `- **${b.name}** ${b.isStale ? '(stale)' : ''}\n  - Last commit: ${b.lastCommitDate} by ${b.lastCommitAuthor}\n  - Subject: ${b.lastCommitSubject}`
  )
  .join('\n')}

${
  unmergedCount > 0
    ? `\n## Unmerged Commits\n${analysis.unmergedCommits
        .slice(0, 10)
        .map((c) => `- ${c.hash}: ${c.message} (${c.branch})`)
        .join('\n')}${unmergedCount > 10 ? `\n... and ${unmergedCount - 10} more` : ''}`
    : ''
}

${
  danglingCount > 0
    ? `\n## Dangling Commits\n${analysis.danglingCommits
        .slice(0, 5)
        .map((c) => `- ${c.hash}`)
        .join('\n')}${danglingCount > 5 ? `\n... and ${danglingCount - 5} more` : ''}`
    : ''
}
`
      } else {
        analysis.analysis = `Found ${totalBranches} branches (${staleBranches} stale), ${unmergedCount} unmerged commits, ${danglingCount} dangling commits`
      }

      return analysis
    } catch (error) {
      console.error(`Branch analysis failed: ${error.message}`)
      return {
        branches: [],
        unmergedCommits: [],
        danglingCommits: [],
        analysis: `Branch analysis failed: ${error.message}`,
      }
    }
  }

  async analyzeComprehensive(includeRecommendations = true) {
    try {
      console.log('🔍 Performing comprehensive repository analysis...')

      const analysis = {
        analysis: '',
        recommendations: includeRecommendations ? [] : undefined,
        metrics: {},
        health: {},
      }

      // Get repository health
      analysis.health = await this.assessRepositoryHealth()

      // Get branch analysis
      const branchAnalysis = await this.analyzeBranches('object')

      // Get repository statistics
      analysis.metrics = {
        ...analysis.health.metrics,
        totalCommits: analysis.health.metrics.commits,
        totalBranches: branchAnalysis.branches.length,
        unmergedCommits: branchAnalysis.unmergedCommits.length,
        danglingCommits: branchAnalysis.danglingCommits.length,
      }

      // Analyze commit patterns
      try {
        const commitHistory = this.gitManager.execGitSafe('git log --oneline --since="30 days ago"')
        const recentCommits = commitHistory.split('\n').filter((line) => line.trim())

        const conventionalCommits = recentCommits.filter((commit) =>
          /^[a-f0-9]+\s+(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\(.+\))?:/.test(
            commit
          )
        )

        analysis.metrics.conventionalCommitRatio =
          recentCommits.length > 0
            ? Math.round((conventionalCommits.length / recentCommits.length) * 100)
            : 0

        analysis.metrics.recentCommitsCount = recentCommits.length
      } catch (error) {
        console.warn(`Could not analyze commit patterns: ${error.message}`)
        analysis.metrics.conventionalCommitRatio = 0
        analysis.metrics.recentCommitsCount = 0
      }

      // Calculate repository age
      try {
        const firstCommitOutput = this.gitManager.execGitSafe(
          'git log --reverse --format="%ci" | head -1'
        )
        if (firstCommitOutput.trim()) {
          const firstCommitDate = new Date(firstCommitOutput.trim())
          const ageInDays = Math.floor((new Date() - firstCommitDate) / (1000 * 60 * 60 * 24))
          analysis.metrics.repositoryAgeInDays = ageInDays
        }
      } catch (error) {
        console.warn(`Could not determine repository age: ${error.message}`)
      }

      // Generate comprehensive analysis
      const healthScore = analysis.health.score
      const isHealthy = analysis.health.healthy
      const staleBranches = branchAnalysis.branches.filter((b) => b.isStale).length
      const conventionalRatio = analysis.metrics.conventionalCommitRatio

      analysis.analysis = `# Comprehensive Repository Analysis

## Overall Health: ${healthScore}/100 ${isHealthy ? '✅' : '⚠️'}

### Repository Metrics
- **Age**: ${analysis.metrics.repositoryAgeInDays || 'Unknown'} days
- **Total Commits**: ${analysis.metrics.totalCommits}
- **Branches**: ${analysis.metrics.totalBranches} (${staleBranches} stale)
- **Recent Activity**: ${analysis.metrics.recentCommitsCount} commits in last 30 days
- **Commit Convention**: ${conventionalRatio}% following conventional commits

### Issues Found
${analysis.health.issues.length > 0 ? analysis.health.issues.map((issue) => `- ${issue}`).join('\n') : '- No major issues detected'}

### Branch Health
- **Unmerged commits**: ${analysis.metrics.unmergedCommits}
- **Dangling commits**: ${analysis.metrics.danglingCommits}
- **Stale branches**: ${staleBranches}
`

      // Add recommendations if requested
      if (includeRecommendations && analysis.health.recommendations.length > 0) {
        analysis.recommendations = [
          ...analysis.health.recommendations,
          ...(staleBranches > 3
            ? ['Clean up stale branches to improve repository organization']
            : []),
          ...(conventionalRatio < 50
            ? ['Consider adopting conventional commit format for better changelog generation']
            : []),
          ...(analysis.metrics.unmergedCommits > 10
            ? ['Review and merge or clean up unmerged commits']
            : []),
        ]
      }

      return analysis
    } catch (error) {
      console.error(`Comprehensive analysis failed: ${error.message}`)
      return {
        analysis: `Comprehensive analysis failed: ${error.message}`,
        recommendations: includeRecommendations
          ? ['Ensure you are in a valid Git repository']
          : undefined,
        metrics: {},
        health: { healthy: false, score: 0 },
      }
    }
  }

  // Helper method to find the main branch (master/main)
  findMainBranch() {
    try {
      const branches = this.gitManager.execGitSafe('git branch -l')
      const branchNames = branches
        .split('\n')
        .map((b) => b.replace('*', '').trim())
        .filter(Boolean)

      // Check for common main branch names in order of preference
      const mainBranchCandidates = ['main', 'master', 'develop', 'dev']
      for (const candidate of mainBranchCandidates) {
        if (branchNames.includes(candidate)) {
          return candidate
        }
      }

      // Fallback to first branch if no standard main branch found
      return branchNames[0] || 'main'
    } catch (error) {
      console.warn(`Could not determine main branch: ${error.message}`)
      return 'main'
    }
  }
}
