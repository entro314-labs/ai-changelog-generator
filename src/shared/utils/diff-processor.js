/**
 * DiffProcessor - Central utility for intelligent diff compression and processing
 *
 * Handles large diffs by applying smart reduction strategies while preserving
 * semantic meaning for AI analysis.
 */

export class DiffProcessor {
  constructor(options = {}) {
    this.analysisMode = options.analysisMode || 'standard'
    this.maxTotalSize = options.maxTotalSize || this.getDefaultMaxSize()
    this.priorityFiles = options.priorityFiles || this.getDefaultPriorityFiles()
    this.enableFiltering = options.enableFiltering !== false
    this.enablePatternDetection = options.enablePatternDetection !== false
  }

  getDefaultMaxSize() {
    const sizes = {
      standard: 12000,
      detailed: 20000,
      enterprise: 30000,
    }
    return sizes[this.analysisMode] || sizes.standard
  }

  getDefaultPriorityFiles() {
    const counts = {
      standard: 15,
      detailed: 25,
      enterprise: 40,
    }
    return counts[this.analysisMode] || counts.standard
  }

  /**
   * Process a collection of files with diffs, applying intelligent compression
   */
  processFiles(files, _options = {}) {
    if (!(files && Array.isArray(files)) || files.length === 0) {
      return {
        processedFiles: [],
        totalSize: 0,
        patterns: {},
        filesProcessed: 0,
        filesSkipped: 0,
      }
    }

    // Step 1: Prioritize files by importance
    const prioritizedFiles = this.prioritizeFiles(files)

    // Step 2: Detect bulk change patterns
    const patterns = this.enablePatternDetection ? this.detectChangePatterns(files) : {}

    // Step 3: Process individual files
    const processedFiles = []
    let totalSize = 0
    let remainingBudget = this.maxTotalSize

    for (let i = 0; i < Math.min(prioritizedFiles.length, this.priorityFiles); i++) {
      const file = prioritizedFiles[i]

      // Calculate budget for this file (remaining budget distributed across remaining files)
      const remainingFiles = Math.min(prioritizedFiles.length - i, this.priorityFiles - i)
      const fileBudget = Math.floor(remainingBudget / remainingFiles)

      const processedFile = this.processFileDiff(file, {
        budget: fileBudget,
        patterns,
        isHighPriority: i < 5, // First 5 files get high priority
      })

      processedFiles.push(processedFile)

      const fileSize = this.estimateSize(processedFile.diff)
      totalSize += fileSize
      remainingBudget -= fileSize

      if (remainingBudget <= 0) {
        break
      }
    }

    // Step 4: Add summary for remaining files
    if (prioritizedFiles.length > processedFiles.length) {
      const remainingFiles = prioritizedFiles.slice(processedFiles.length)
      const summary = this.createRemainingFilesSummary(remainingFiles, patterns)
      processedFiles.push(summary)
    }

    return {
      processedFiles,
      totalSize,
      patterns,
      filesProcessed: processedFiles.length,
      filesSkipped: Math.max(0, files.length - processedFiles.length),
    }
  }

  /**
   * Process a single file's diff with intelligent compression
   */
  processFileDiff(file, options = {}) {
    const { budget = 1500, patterns = {}, isHighPriority = false } = options

    if (!file.diff || file.diff === 'No diff available') {
      return {
        ...file,
        diff: this.generateFallbackDescription(file),
        processed: true,
        compressionApplied: false,
      }
    }

    let processedDiff = file.diff

    // Apply filtering pipeline if enabled
    if (this.enableFiltering) {
      processedDiff = this.applyDiffFiltering(processedDiff, file)
    }

    // Check if file matches bulk patterns
    const patternMatch = this.matchesBulkPattern(file, patterns)
    if (patternMatch) {
      return {
        ...file,
        diff: `[Bulk ${patternMatch.type}]: ${patternMatch.description}`,
        processed: true,
        compressionApplied: true,
        bulkPattern: patternMatch.type,
      }
    }

    // Apply intelligent truncation if still too large
    if (processedDiff.length > budget) {
      processedDiff = this.intelligentTruncation(processedDiff, budget, {
        preserveStructure: isHighPriority,
        filePath: file.filePath || file.path,
      })
    }

    return {
      ...file,
      diff: processedDiff,
      processed: true,
      compressionApplied: processedDiff.length < file.diff.length,
      originalSize: file.diff.length,
      compressedSize: processedDiff.length,
    }
  }

  /**
   * Prioritize files by importance for analysis
   */
  prioritizeFiles(files) {
    return [...files].sort((a, b) => {
      // Primary: Status priority (Modified > Added > Deleted)
      const statusPriority = { M: 0, R: 1, A: 2, D: 3 }
      const aStatus = statusPriority[a.status] ?? 4
      const bStatus = statusPriority[b.status] ?? 4
      if (aStatus !== bStatus) {
        return aStatus - bStatus
      }

      // Secondary: File importance
      const aImportance = this.calculateFileImportance(a)
      const bImportance = this.calculateFileImportance(b)
      if (aImportance !== bImportance) {
        return bImportance - aImportance
      }

      // Tertiary: Diff size (larger changes first)
      const aDiffSize = (a.diff || '').length
      const bDiffSize = (b.diff || '').length
      return bDiffSize - aDiffSize
    })
  }

  /**
   * Calculate file importance score
   */
  calculateFileImportance(file) {
    const filePath = file.filePath || file.path || ''
    let score = 0

    // Core source files
    if (filePath.includes('/src/') && (filePath.endsWith('.js') || filePath.endsWith('.ts'))) {
      score += 100
    }

    // Important directories
    if (filePath.includes('/domains/') || filePath.includes('/services/')) {
      score += 50
    }
    if (filePath.includes('/utils/') || filePath.includes('/shared/')) {
      score += 30
    }
    if (filePath.includes('/components/')) {
      score += 40
    }
    if (filePath.includes('/api/') || filePath.includes('/routes/')) {
      score += 60
    }

    // Configuration files
    if (filePath.includes('package.json') || filePath.includes('config')) {
      score += 20
    }

    // Tests (lower priority)
    if (filePath.includes('/test/') || filePath.includes('.test.') || filePath.includes('.spec.')) {
      score -= 20
    }

    // Documentation (lowest priority for code analysis)
    if (filePath.endsWith('.md') || filePath.includes('/docs/')) {
      score -= 30
    }

    // Generated/build files (very low priority)
    if (
      filePath.includes('/node_modules/') ||
      filePath.includes('/dist/') ||
      filePath.includes('/build/') ||
      filePath.includes('lock')
    ) {
      score -= 100
    }

    return score
  }

  /**
   * Detect bulk change patterns across files
   */
  detectChangePatterns(files) {
    const patterns = {}

    // Detect mass renames
    const renames = files.filter((f) => f.status === 'R')
    if (renames.length >= 3) {
      patterns.massRename = {
        type: 'massRename',
        count: renames.length,
        description: `${renames.length} files renamed`,
        files: renames.map((f) => ({ from: f.oldPath, to: f.filePath || f.path })),
      }
    }

    // Detect formatting changes
    const formattingFiles = files.filter((f) => this.isLikelyFormattingChange(f))
    if (formattingFiles.length >= 5) {
      patterns.formatting = {
        type: 'formatting',
        count: formattingFiles.length,
        description: `Formatting/linting applied to ${formattingFiles.length} files`,
        files: formattingFiles.map((f) => f.filePath || f.path),
      }
    }

    // Detect dependency updates
    const packageFiles = files.filter(
      (f) => (f.filePath || f.path).includes('package') || (f.filePath || f.path).includes('lock')
    )
    if (packageFiles.length > 0) {
      patterns.dependencies = {
        type: 'dependencies',
        count: packageFiles.length,
        description: `Package/dependency updates in ${packageFiles.length} files`,
        files: packageFiles.map((f) => f.filePath || f.path),
      }
    }

    return patterns
  }

  /**
   * Check if a file matches a bulk pattern
   */
  matchesBulkPattern(file, patterns) {
    const filePath = file.filePath || file.path || ''

    // Check for formatting pattern
    if (patterns.formatting?.files.includes(filePath)) {
      return patterns.formatting
    }

    // Check for rename pattern
    if (patterns.massRename?.files.some((r) => r.to === filePath)) {
      return patterns.massRename
    }

    // Check for dependency pattern
    if (patterns.dependencies?.files.includes(filePath)) {
      return patterns.dependencies
    }

    return null
  }

  /**
   * Apply diff filtering to remove noise
   */
  applyDiffFiltering(diff, _file) {
    let filteredDiff = diff

    // Remove whitespace-only changes
    filteredDiff = filteredDiff.replace(/^[+-]\s*$/gm, '')

    // Remove pure import/require shuffling (common in large refactors)
    const importLines = filteredDiff.split('\n').filter((line) => {
      const trimmed = line.replace(/^[+-]\s*/, '')
      return trimmed.match(/^(import|require|from\s+['"])/)
    })

    if (importLines.length > 10) {
      // If many import changes, summarize them
      filteredDiff = filteredDiff.replace(/^[+-]\s*(import|require|from\s+['"]).*$/gm, '')
      filteredDiff = `[${importLines.length} import/require changes summarized]\n${filteredDiff}`
    }

    // Remove console.log additions/removals (common in development)
    filteredDiff = filteredDiff.replace(/^[+-]\s*console\.(log|debug|info).*$/gm, '')

    // Clean up multiple empty lines
    filteredDiff = filteredDiff.replace(/\n\s*\n\s*\n/g, '\n\n')

    return filteredDiff.trim()
  }

  /**
   * Check if a file appears to be mostly formatting changes
   */
  isLikelyFormattingChange(file) {
    if (!file.diff) {
      return false
    }

    const lines = file.diff.split('\n')
    const changeLines = lines.filter((line) => line.startsWith('+') || line.startsWith('-'))

    if (changeLines.length === 0) {
      return false
    }

    // Count lines that are likely formatting (whitespace, semicolons, brackets)
    const formattingLines = changeLines.filter((line) => {
      const content = line.substring(1).trim()
      return (
        content === '' || // Empty lines
        content.match(/^[\s{}[\];,]+$/) || // Brackets, semicolons, commas
        content.match(/^\/\/\s*eslint/) || // ESLint comments
        (content.match(/^\s*(import|from)/) && // Import reordering
          changeLines.filter((l) =>
            l
              .substring(1)
              .trim()
              .includes(content.replace(/^[\s+-]*/, ''))
          ).length > 1)
      )
    })

    // If more than 80% of changes are formatting-related
    return formattingLines.length / changeLines.length > 0.8
  }

  /**
   * Apply intelligent truncation that preserves structure
   */
  intelligentTruncation(diff, budget, options = {}) {
    const { preserveStructure = false, filePath = '' } = options

    if (diff.length <= budget) {
      return diff
    }

    const lines = diff.split('\n')

    if (preserveStructure && lines.length > 20) {
      // For high-priority files, show context at beginning and end
      const headerLines = Math.floor((budget * 0.4) / 80) // Estimate chars per line
      const footerLines = Math.floor((budget * 0.3) / 80)
      const middleLines = Math.floor((budget * 0.2) / 80)

      const header = lines.slice(0, headerLines).join('\n')
      const footer = lines.slice(-footerLines).join('\n')

      // Find important middle sections (function definitions, class declarations)
      const importantMiddle = lines
        .slice(headerLines, -footerLines)
        .filter((line) => line.match(/^[+-]\s*(function|class|const|let|var|export|async)/))
        .slice(0, middleLines)

      const middle =
        importantMiddle.length > 0
          ? `\n... [${lines.length - headerLines - footerLines - importantMiddle.length} lines omitted] ...\n` +
            importantMiddle.join('\n')
          : `\n... [${lines.length - headerLines - footerLines} lines omitted] ...`

      return `${header}${middle}\n${footer}`.substring(0, budget)
    }

    // Simple truncation with context preservation
    const truncated = diff.substring(0, budget - 50)
    const lastNewline = truncated.lastIndexOf('\n')

    return (
      (lastNewline > budget * 0.8 ? truncated.substring(0, lastNewline) : truncated) +
      '\n... [truncated]'
    )
  }

  /**
   * Generate fallback description for files without diffs
   */
  generateFallbackDescription(file) {
    const filePath = file.filePath || file.path || 'unknown file'
    const status = file.status || 'modified'

    const statusDescriptions = {
      M: 'Modified',
      A: 'Added',
      D: 'Deleted',
      R: 'Renamed',
      '??': 'Untracked',
    }

    const description = statusDescriptions[status] || 'Changed'
    const fileType = this.getFileTypeDescription(filePath)

    return `${description} ${fileType}: ${filePath}`
  }

  /**
   * Get file type description
   */
  getFileTypeDescription(filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
      return 'JavaScript/TypeScript file'
    }
    if (filePath.endsWith('.json')) {
      return 'JSON configuration'
    }
    if (filePath.endsWith('.md')) {
      return 'documentation file'
    }
    if (filePath.includes('package')) {
      return 'package configuration'
    }
    if (filePath.includes('test') || filePath.includes('spec')) {
      return 'test file'
    }
    return 'file'
  }

  /**
   * Create summary for remaining files that weren't processed
   */
  createRemainingFilesSummary(remainingFiles, _patterns) {
    const categories = {}

    remainingFiles.forEach((file) => {
      const type = this.categorizeFile(file)
      if (!categories[type]) {
        categories[type] = []
      }
      categories[type].push(file)
    })

    const summaryParts = Object.entries(categories).map(([type, files]) => {
      return `${files.length} ${type} files`
    })

    return {
      path: '[SUMMARY]',
      status: 'SUMMARY',
      diff: `Additional ${remainingFiles.length} files not analyzed in detail: ${summaryParts.join(', ')}`,
      processed: true,
      compressionApplied: true,
      isSummary: true,
    }
  }

  /**
   * Categorize a file for summary purposes
   */
  categorizeFile(file) {
    const filePath = file.filePath || file.path || ''

    if (filePath.includes('/test/') || filePath.includes('.test.') || filePath.includes('.spec.')) {
      return 'test'
    }
    if (filePath.endsWith('.md') || filePath.includes('/docs/')) {
      return 'documentation'
    }
    if (filePath.includes('package') || filePath.includes('lock') || filePath.includes('config')) {
      return 'configuration'
    }
    if (filePath.includes('/build/') || filePath.includes('/dist/')) {
      return 'build'
    }
    return 'other'
  }

  /**
   * Estimate size of processed content
   */
  estimateSize(content) {
    return (content || '').length
  }
}

export default DiffProcessor
