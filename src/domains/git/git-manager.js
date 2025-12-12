import { execSync } from 'node:child_process'

import { GitError } from '../../shared/utils/error-classes.js'

/**
 * GitManager - Handles all Git command execution and repository operations
 *
 * This class provides a centralized interface for Git operations with proper
 * error handling, command validation, and consistent output formatting.
 */
export class GitManager {
  constructor(options = {}) {
    this.options = {
      encoding: 'utf8',
      timeout: 30000,
      stdio: 'pipe',
      ...options,
    }

    // Cache git repository status
    this._isGitRepoCache = null
    this._gitDirCache = null
  }

  /**
   * Check if current directory is a Git repository
   * @returns {boolean} True if in a Git repository
   */
  get isGitRepo() {
    if (this._isGitRepoCache === null) {
      this._isGitRepoCache = this._checkIsGitRepo()
    }
    return this._isGitRepoCache
  }

  /**
   * Get the Git directory path
   * @returns {string|null} Path to .git directory or null if not a Git repo
   */
  get gitDir() {
    if (this._gitDirCache === null && this.isGitRepo) {
      try {
        this._gitDirCache = this.execGitSafe('git rev-parse --git-dir').trim()
      } catch {
        this._gitDirCache = null
      }
    }
    return this._gitDirCache
  }

  /**
   * Execute a Git command with full error handling
   * @param {string} command - The Git command to execute
   * @returns {string} Command output
   * @throws {GitError} If command fails
   */
  execGit(command) {
    try {
      return execSync(command, {
        encoding: this.options.encoding,
        stdio: this.options.stdio,
        timeout: this.options.timeout,
      })
    } catch (error) {
      throw this._createGitError(command, error)
    }
  }

  /**
   * Execute a Git command safely, returning empty string on failure
   * @param {string} command - The Git command to execute
   * @returns {string} Command output or empty string on failure
   */
  execGitSafe(command) {
    try {
      return this.execGit(command)
    } catch {
      return ''
    }
  }

  /**
   * Execute a Git show command with specific error handling for missing files
   * @param {string} command - The Git show command to execute
   * @returns {string|null} Command output or null if file doesn't exist
   */
  execGitShow(command) {
    try {
      return this.execGit(command)
    } catch (error) {
      // Return null for missing files rather than throwing
      if (
        error.message.includes('does not exist') ||
        error.message.includes('bad file') ||
        error.message.includes('not found')
      ) {
        return null
      }
      throw error
    }
  }

  /**
   * Validate a commit hash exists in the repository
   * @param {string} hash - The commit hash to validate
   * @returns {boolean} True if commit exists
   */
  validateCommitHash(hash) {
    if (!hash || typeof hash !== 'string') {
      return false
    }

    // Basic format validation
    if (!/^[a-f0-9]{6,40}$/i.test(hash)) {
      return false
    }

    try {
      this.execGit(`git cat-file -e ${hash}`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the current branch name
   * @returns {string} Current branch name or 'HEAD' if detached
   */
  getCurrentBranch() {
    try {
      return this.execGitSafe('git branch --show-current').trim() || 'HEAD'
    } catch {
      return 'HEAD'
    }
  }

  /**
   * Get the remote URL for the repository
   * @param {string} remoteName - Name of the remote (default: 'origin')
   * @returns {string|null} Remote URL or null if not found
   */
  getRemoteUrl(remoteName = 'origin') {
    try {
      return this.execGitSafe(`git remote get-url ${remoteName}`).trim() || null
    } catch {
      return null
    }
  }

  /**
   * Get repository root directory
   * @returns {string|null} Repository root path or null if not in a Git repo
   */
  getRepositoryRoot() {
    try {
      return this.execGitSafe('git rev-parse --show-toplevel').trim() || null
    } catch {
      return null
    }
  }

  /**
   * Check if working directory is clean (no uncommitted changes)
   * @returns {boolean} True if working directory is clean
   */
  isWorkingDirectoryClean() {
    try {
      const status = this.execGitSafe('git status --porcelain')
      return status.trim() === ''
    } catch {
      return false
    }
  }

  /**
   * Get list of all tags in repository
   * @returns {Array<string>} Array of tag names
   */
  getAllTags() {
    try {
      const output = this.execGitSafe('git tag -l')
      return output
        .split('\n')
        .filter((tag) => tag.trim())
        .sort()
    } catch {
      return []
    }
  }

  /**
   * Get the latest tag
   * @returns {string|null} Latest tag name or null if no tags
   */
  getLatestTag() {
    try {
      return this.execGitSafe('git describe --tags --abbrev=0').trim() || null
    } catch {
      return null
    }
  }

  /**
   * Get commits between two references
   * @param {string} from - Starting reference (commit, tag, branch)
   * @param {string} to - Ending reference (default: 'HEAD')
   * @param {Object} options - Optional filters
   * @param {string} options.author - Filter by author name or email
   * @returns {Array<Object>} Array of commit objects
   */
  getCommitsBetween(from, to = 'HEAD', options = {}) {
    try {
      let command = `git log ${from}..${to} --oneline`
      if (options.author) {
        command += ` --author="${options.author}"`
      }
      const output = this.execGitSafe(command)
      return output
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, ...messageParts] = line.split(' ')
          return {
            hash: hash.trim(),
            message: messageParts.join(' '),
          }
        })
    } catch {
      return []
    }
  }

  /**
   * Get commits filtered by author
   * @param {string} author - Author name or email to filter by
   * @param {number} limit - Maximum number of commits to return
   * @returns {Array<Object>} Array of commit objects by this author
   */
  getCommitsByAuthor(author, limit = 50) {
    try {
      const output = this.execGitSafe(
        `git log --author="${author}" --oneline -n ${limit}`
      )
      return output
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, ...messageParts] = line.split(' ')
          return {
            hash: hash.trim(),
            message: messageParts.join(' '),
          }
        })
    } catch {
      return []
    }
  }

  /**
   * Get commits between two tags
   * @param {string} fromTag - Starting tag
   * @param {string} toTag - Ending tag (default: 'HEAD')
   * @param {Object} options - Optional filters
   * @returns {Array<Object>} Array of commit objects between tags
   */
  getCommitsBetweenTags(fromTag, toTag = 'HEAD', options = {}) {
    return this.getCommitsBetween(fromTag, toTag, options)
  }

  /**
   * Get list of all authors in repository
   * @returns {Array<string>} Array of unique author names
   */
  getAllAuthors() {
    try {
      const output = this.execGitSafe('git log --format="%an" | sort -u')
      return output
        .split('\n')
        .filter((name) => name.trim())
        .sort()
    } catch {
      return []
    }
  }

  /**
   * Get list of stashed changes
   * @returns {Array<Object>} Array of stash entries with index, message, and date
   */
  getStashList() {
    try {
      const output = this.execGitSafe('git stash list --format="%gd|%gs|%ci"')
      if (!output.trim()) {
        return []
      }
      return output
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [index, message, date] = line.split('|')
          return {
            index: index.trim(),
            message: message.trim(),
            date: date.trim(),
          }
        })
    } catch {
      return []
    }
  }

  /**
   * Get detailed information about a specific stash entry
   * @param {string} stashRef - Stash reference (e.g., 'stash@{0}')
   * @returns {Object|null} Stash details including files changed
   */
  getStashDetails(stashRef = 'stash@{0}') {
    try {
      // Get stash message
      const message = this.execGitSafe(`git stash list --format="%gs" -1 ${stashRef}`).trim()

      // Get files changed in stash
      const statOutput = this.execGitSafe(`git stash show ${stashRef} --stat`)
      const diffOutput = this.execGitSafe(`git stash show ${stashRef} -p`)

      // Parse stat output for files
      const files = statOutput
        .split('\n')
        .filter((line) => line.includes('|'))
        .map((line) => {
          const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)/)
          if (match) {
            return {
              path: match[1].trim(),
              changes: parseInt(match[2], 10),
            }
          }
          return null
        })
        .filter(Boolean)

      // Get summary stats
      const summaryMatch = statOutput.match(/(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/)

      return {
        ref: stashRef,
        message,
        files,
        diff: diffOutput,
        stats: {
          filesChanged: summaryMatch ? parseInt(summaryMatch[1], 10) : files.length,
          insertions: summaryMatch && summaryMatch[2] ? parseInt(summaryMatch[2], 10) : 0,
          deletions: summaryMatch && summaryMatch[3] ? parseInt(summaryMatch[3], 10) : 0,
        },
      }
    } catch {
      return null
    }
  }

  /**
   * Check if there are any stashed changes
   * @returns {boolean} True if stash has entries
   */
  hasStashedChanges() {
    return this.getStashList().length > 0
  }

  /**
   * Check if a file exists in a specific commit
   * @param {string} commitHash - The commit to check
   * @param {string} filePath - The file path to check
   * @returns {boolean} True if file exists in the commit
   */
  fileExistsInCommit(commitHash, filePath) {
    try {
      this.execGit(`git cat-file -e ${commitHash}:${filePath}`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get file content from a specific commit
   * @param {string} commitHash - The commit to get the file from
   * @param {string} filePath - The file path to retrieve
   * @returns {string|null} File content or null if file doesn't exist
   */
  getFileFromCommit(commitHash, filePath) {
    try {
      return this.execGitShow(`git show ${commitHash}:${filePath}`)
    } catch {
      return null
    }
  }

  /**
   * Reset internal caches (call when repository state might have changed)
   */
  resetCache() {
    this._isGitRepoCache = null
    this._gitDirCache = null
  }

  /**
   * Get detailed repository information
   * @returns {Object} Repository information object
   */
  getRepositoryInfo() {
    if (!this.isGitRepo) {
      return { isGitRepo: false }
    }

    return {
      isGitRepo: true,
      gitDir: this.gitDir,
      repositoryRoot: this.getRepositoryRoot(),
      currentBranch: this.getCurrentBranch(),
      remoteUrl: this.getRemoteUrl(),
      isClean: this.isWorkingDirectoryClean(),
      latestTag: this.getLatestTag(),
      totalTags: this.getAllTags().length,
    }
  }

  // Private methods

  /**
   * Check if current directory is a Git repository
   * @private
   * @returns {boolean}
   */
  _checkIsGitRepo() {
    try {
      execSync('git rev-parse --git-dir', {
        stdio: 'ignore',
        timeout: 5000,
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Create a GitError from a command execution error
   * @private
   * @param {string} command - The Git command that failed
   * @param {Error} error - The original error
   * @returns {GitError}
   */
  _createGitError(command, error) {
    const gitCommand = command.replace(/^git\s+/, '')

    // Enhanced error handling with more specific messages
    if (error.code === 128) {
      if (error.message.includes('not a git repository')) {
        return GitError.fromCommandFailure(gitCommand, null, null, 'Not in a git repository', error)
      }
      return GitError.fromCommandFailure(
        gitCommand,
        null,
        null,
        `Git repository error: ${error.message}`,
        error
      )
    }

    if (error.code === 129) {
      return GitError.fromCommandFailure(
        gitCommand,
        null,
        null,
        `Git command syntax error: ${command}`,
        error
      )
    }

    if (error.code === 'ENOENT') {
      return GitError.fromCommandFailure(
        gitCommand,
        null,
        null,
        'Git is not installed or not in PATH',
        error
      )
    }

    return GitError.fromCommandFailure(
      gitCommand,
      null,
      null,
      `Git command failed: ${error.message}`,
      error
    )
  }
}
