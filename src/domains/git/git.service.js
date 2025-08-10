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

      // Get files with detailed analysis
      const filesCommand = `git show --name-status --pretty=format: ${commitHash}`
      const filesOutput = this.gitManager.execGitSafe(filesCommand)
      const files = await Promise.all(
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
}
