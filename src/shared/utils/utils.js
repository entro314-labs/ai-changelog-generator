/**
 * Consolidated Utility Functions
 *
 * Provides comprehensive utility functions for AI changelog generation:
 * - Data manipulation and conversion utilities
 * - Format and presentation utilities
 * - File analysis and categorization
 * - Text processing and analysis
 * - Commit analysis and changelog generation
 *
 * For advanced JSON operations with error detection, use JsonUtils from './json-utils.js'
 * For specialized error handling, use error classes from './error-classes.js'
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'

import colors from '../constants/colors.js'
import { DiffProcessor } from './diff-processor.js'
import { AbstractMethodError, AIChangelogError, ProviderError } from './error-classes.js'
import JsonUtils from './json-utils.js'

// Note: Error classes have been moved to './error-classes.js' to avoid duplication
// and provide better organization. Import them from there instead of defining here.
export { AbstractMethodError, AIChangelogError, ProviderError }

// ========================================
// DATA MANIPULATION UTILITIES
// ========================================

/**
 * Convert Sets to Arrays for JSON serialization
 */
export function convertSetsToArrays(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Set) {
    return Array.from(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(convertSetsToArrays)
  }

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = convertSetsToArrays(value)
  }
  return result
}

/**
 * Enhanced conventional commit parsing
 * Based on git-conventional-commits patterns with breaking change detection
 */
export function extractCommitScope(message) {
  // Enhanced regex to match conventional commits format: type(scope)!: description
  const conventionalMatch = message.match(
    /^(?<type>\w+)(?:\((?<scope>[^()]+)\))?(?<breaking>!)?:\s*(?<description>.+)/
  )

  if (conventionalMatch) {
    const { type, scope, breaking, description } = conventionalMatch.groups

    return {
      type,
      scope: scope || null,
      description: description.trim(),
      breaking: !!breaking,
      isConventional: true,
    }
  }

  // Fallback for non-conventional commits
  return {
    type: null,
    scope: null,
    description: message.trim(),
    breaking: false,
    isConventional: false,
  }
}

/**
 * Parse conventional commit message with full body analysis
 */
export function parseConventionalCommit(subject, body = '') {
  const parsed = extractCommitScope(subject)
  const fullMessage = `${subject}\n\n${body}`.trim()

  // Enhanced breaking change detection from body
  const breakingChanges = []

  // Check for BREAKING CHANGE: footer
  const breakingMatch = fullMessage.match(/BREAKING CHANGE:\s*(.*?)(?:\n\n|\n[A-Z]|\n*$)/s)
  if (breakingMatch) {
    breakingChanges.push(breakingMatch[1].trim())
    parsed.breaking = true
  }

  // Check for BREAKING-CHANGE: footer (alternative format)
  const breakingAltMatch = fullMessage.match(/BREAKING-CHANGE:\s*(.*?)(?:\n\n|\n[A-Z]|\n*$)/s)
  if (breakingAltMatch) {
    breakingChanges.push(breakingAltMatch[1].trim())
    parsed.breaking = true
  }

  // Extract issue references (GitHub/GitLab format)
  const issueRefs = []
  const issueMatches = fullMessage.match(/#[0-9]+/g)
  if (issueMatches) {
    issueRefs.push(...issueMatches)
  }

  // Extract closes references
  const closesMatches = fullMessage.match(
    /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s*#?([0-9]+)/gi
  )
  const closesRefs = []
  if (closesMatches) {
    closesMatches.forEach((match) => {
      const num = match.match(/([0-9]+)/)
      if (num) {
        closesRefs.push(`#${num[1]}`)
      }
    })
  }

  return {
    ...parsed,
    breakingChanges,
    issueReferences: [...new Set(issueRefs)],
    closesReferences: [...new Set(closesRefs)],
    body: body.trim(),
    revert: subject.toLowerCase().startsWith('revert'),
  }
}

/**
 * Generate markdown link for commit hash
 */
export function markdownCommitLink(commitHash, commitUrl, shortHash = true) {
  if (!commitUrl) {
    return shortHash ? commitHash.substring(0, 7) : commitHash
  }

  const url = commitUrl.replace('%commit%', commitHash)
  const displayHash = shortHash ? commitHash.substring(0, 7) : commitHash
  return `[${displayHash}](${url})`
}

/**
 * Generate markdown link for commit range
 */
export function markdownCommitRangeLink(fromCommit, toCommit, commitRangeUrl) {
  if (!commitRangeUrl) {
    return `${fromCommit.substring(0, 7)}...${toCommit.substring(0, 7)}`
  }

  const url = commitRangeUrl.replace('%from%', fromCommit).replace('%to%', toCommit)
  return `[${fromCommit.substring(0, 7)}...${toCommit.substring(0, 7)}](${url})`
}

/**
 * Generate markdown link for issue reference
 */
export function markdownIssueLink(issueId, issueUrl) {
  if (!issueUrl) {
    return issueId
  }

  const cleanIssueId = issueId.replace('#', '')
  const url = issueUrl.replace('%issue%', cleanIssueId)
  return `[${issueId}](${url})`
}

/**
 * Process issue references in text and convert to markdown links
 */
export function processIssueReferences(text, issueUrl, issueRegex) {
  if (!(issueUrl && text)) {
    return text
  }

  return text.replace(issueRegex, (match) => {
    return markdownIssueLink(match, issueUrl)
  })
}

/**
 * Deep merge objects
 */
export function deepMerge(target, source) {
  const result = { ...target }

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }

  return result
}

// ========================================
// FORMAT UTILITIES
// ========================================

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`
  }
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * Interactive configuration prompt (simplified)
 */
export function promptForConfig(message = 'Configure settings', defaultValue = '') {
  console.log(colors.infoMessage(message))
  return Promise.resolve(defaultValue)
}

/**
 * Get health status color
 */
export function getHealthColor(status) {
  const colorMap = {
    excellent: colors.successMessage,
    good: colors.successMessage,
    fair: colors.warningMessage,
    poor: colors.errorMessage,
    critical: colors.errorMessage,
  }
  return colorMap[status] || colors.infoMessage
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 B'
  }
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * Format percentage
 */
export function formatPercentage(value, total) {
  if (total === 0) {
    return '0%'
  }
  return `${((value / total) * 100).toFixed(1)}%`
}

// ========================================
// FILE UTILITIES
// ========================================

/**
 * Categorize file by path and extension
 */
export function categorizeFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return 'other'
  }
  const path = filePath.toLowerCase()
  const ext = path.split('.').pop()

  // Configuration files
  if (
    path.includes('package.json') ||
    path.includes('yarn.lock') ||
    path.includes('pnpm-lock') ||
    path.includes('.gitignore') ||
    ext === 'toml' ||
    ext === 'yaml' ||
    ext === 'yml' ||
    path.includes('dockerfile') ||
    path.includes('.env')
  ) {
    return 'configuration'
  }

  // Documentation
  if (
    ext === 'md' ||
    ext === 'txt' ||
    ext === 'rst' ||
    path.includes('readme') ||
    path.includes('changelog') ||
    path.includes('/docs/') ||
    path.includes('/doc/')
  ) {
    return 'documentation'
  }

  // Test files
  if (
    path.includes('/test/') ||
    path.includes('/tests/') ||
    path.includes('__tests__') ||
    path.includes('.test.') ||
    path.includes('.spec.') ||
    ext === 'test' ||
    ext === 'spec'
  ) {
    return 'tests'
  }

  // Source code
  const sourceExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'php']
  if (sourceExts.includes(ext)) {
    if (path.includes('/src/') || path.includes('/lib/')) {
      return 'source'
    }
    return 'source'
  }

  // Frontend/UI
  const frontendExts = ['html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte']
  if (frontendExts.includes(ext)) {
    return 'frontend'
  }

  // Assets
  const assetExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp']
  if (assetExts.includes(ext)) {
    return 'assets'
  }

  // Build/tooling
  if (
    path.includes('webpack') ||
    path.includes('rollup') ||
    path.includes('vite') ||
    path.includes('babel') ||
    path.includes('eslint') ||
    path.includes('prettier') ||
    path.includes('/build/') ||
    path.includes('/dist/')
  ) {
    return 'build'
  }

  return 'other'
}

/**
 * Detect programming language from file extension
 */
export function detectLanguage(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return 'Unknown'
  }
  const ext = filePath.split('.').pop()?.toLowerCase()

  const langMap = {
    js: 'JavaScript',
    jsx: 'JavaScript',
    ts: 'TypeScript',
    tsx: 'TypeScript',
    py: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    go: 'Go',
    rs: 'Rust',
    php: 'PHP',
    rb: 'Ruby',
    swift: 'Swift',
    kt: 'Kotlin',
    scala: 'Scala',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    vue: 'Vue',
    svelte: 'Svelte',
    json: 'JSON',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    md: 'Markdown',
    sql: 'SQL',
  }

  return langMap[ext] || 'Unknown'
}

/**
 * Assess file importance based on path and type
 */
export function assessFileImportance(filePath, status) {
  if (!filePath || typeof filePath !== 'string') {
    return 'medium'
  }
  const path = filePath.toLowerCase()

  // Critical files
  if (
    path.includes('package.json') ||
    path.includes('pom.xml') ||
    path.includes('cargo.toml') ||
    path.includes('requirements.txt') ||
    path.includes('dockerfile') ||
    path.includes('docker-compose')
  ) {
    return 'critical'
  }

  // Core source files
  if (path.includes('/src/') || path.includes('/lib/')) {
    if (
      path.includes('index.') ||
      path.includes('main.') ||
      path.includes('app.') ||
      path.includes('server.')
    ) {
      return 'critical'
    }
    return 'high'
  }

  // Configuration
  if (categorizeFile(filePath) === 'configuration') {
    return 'high'
  }

  // Tests
  if (categorizeFile(filePath) === 'tests') {
    return 'medium'
  }

  // Documentation
  if (categorizeFile(filePath) === 'documentation') {
    return 'low'
  }

  // File deletion is always important
  if (status === 'D') {
    return 'high'
  }

  return 'medium'
}

// ========================================
// TEXT PROCESSING UTILITIES
// ========================================

/**
 * Assess overall complexity of changes
 */
export function assessOverallComplexity(diffContent, fileCount) {
  const lines = diffContent.split('\n')
  const addedLines = lines.filter((line) => line.startsWith('+')).length
  const deletedLines = lines.filter((line) => line.startsWith('-')).length
  const totalChanges = addedLines + deletedLines

  // Complexity factors
  let complexity = 'low'

  if (fileCount > 20 || totalChanges > 500) {
    complexity = 'high'
  } else if (fileCount > 5 || totalChanges > 100) {
    complexity = 'medium'
  }

  // Check for complex patterns
  const complexPatterns = [
    /class\s+\w+/g,
    /function\s+\w+/g,
    /async\s+function/g,
    /try\s*{/g,
    /catch\s*\(/g,
    /interface\s+\w+/g,
    /type\s+\w+/g,
  ]

  const patternMatches = complexPatterns.reduce((count, pattern) => {
    return count + (diffContent.match(pattern) || []).length
  }, 0)

  if (patternMatches > 10) {
    complexity = complexity === 'low' ? 'medium' : 'high'
  }

  return complexity
}

/**
 * Assess risk level of changes
 */
export function assessRisk(diffContent, fileCount, commitMessage) {
  let risk = 'low'

  // High-risk keywords in commit message
  const highRiskKeywords = ['breaking', 'remove', 'delete', 'deprecated', 'migration']
  const mediumRiskKeywords = ['refactor', 'restructure', 'change', 'modify', 'update']

  if (!commitMessage || typeof commitMessage !== 'string') {
    return risk // Return early with default risk level
  }
  const message = commitMessage.toLowerCase()

  if (highRiskKeywords.some((keyword) => message.includes(keyword))) {
    risk = 'high'
  } else if (mediumRiskKeywords.some((keyword) => message.includes(keyword))) {
    risk = 'medium'
  }

  // High-risk file patterns
  const highRiskPatterns = [
    /package\.json/,
    /package-lock\.json/,
    /yarn\.lock/,
    /Dockerfile/,
    /docker-compose/,
    /database/,
    /migration/,
    /config/,
    /env/,
  ]

  const diffLines = diffContent.split('\n')
  const hasHighRiskFiles = diffLines.some((line) =>
    highRiskPatterns.some((pattern) => pattern.test(line))
  )

  if (hasHighRiskFiles) {
    risk = risk === 'low' ? 'medium' : 'high'
  }

  // Large changes are risky
  if (fileCount > 15 || diffContent.length > 10000) {
    risk = risk === 'low' ? 'medium' : 'high'
  }

  return risk
}

/**
 * Check if changes are breaking
 */
export function isBreakingChange(commitMessage, diffContent) {
  if (!commitMessage || typeof commitMessage !== 'string') {
    return false
  }
  const message = commitMessage.toLowerCase()

  // Check commit message for breaking indicators
  if (message.includes('breaking') || message.includes('!:')) {
    return true
  }

  // Check diff for breaking patterns
  const breakingPatterns = [
    /function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?}[\s\S]*?-/g, // Function signature changes
    /class\s+\w+[\s\S]*?-/g, // Class changes
    /interface\s+\w+[\s\S]*?-/g, // Interface changes
    /export\s+[\s\S]*?-/g, // Export changes
  ]

  return breakingPatterns.some((pattern) => pattern.test(diffContent))
}

/**
 * Assess business relevance of changes
 */
export function assessBusinessRelevance(commitMessage, filePaths) {
  if (!commitMessage || typeof commitMessage !== 'string') {
    return 'low'
  }
  const message = commitMessage.toLowerCase()

  // Business-relevant keywords
  const businessKeywords = [
    'feature',
    'user',
    'customer',
    'client',
    'business',
    'revenue',
    'payment',
    'billing',
    'subscription',
    'auth',
    'login',
    'security',
  ]

  const hasBusinessKeywords = businessKeywords.some((keyword) => message.includes(keyword))

  // Business-relevant file paths
  const businessPaths = [
    '/api/',
    '/service/',
    '/controller/',
    '/model/',
    '/auth/',
    '/payment/',
    '/billing/',
    '/user/',
  ]

  const hasBusinessFiles = filePaths.some(
    (path) =>
      path &&
      typeof path === 'string' &&
      businessPaths.some((businessPath) => path.includes(businessPath))
  )

  if (hasBusinessKeywords && hasBusinessFiles) {
    return 'high'
  }
  if (hasBusinessKeywords || hasBusinessFiles) {
    return 'medium'
  }
  return 'low'
}

// ========================================
// JSON UTILITIES
// ========================================

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse(jsonString, fallback = null) {
  // Use the advanced JsonUtils for better error handling
  return JsonUtils.safeParse(jsonString, fallback)
}

/**
 * Safe JSON stringify with formatting
 */
export function safeJsonStringify(obj, indent = 2) {
  try {
    return JSON.stringify(convertSetsToArrays(obj), null, indent)
  } catch (error) {
    console.warn(colors.warningMessage(`JSON stringify error: ${error.message}`))
    return '{}'
  }
}

// ========================================
// UTILITY HELPERS
// ========================================

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry utility with exponential backoff
 */
export async function retry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < maxRetries - 1) {
        const delay = baseDelay * 2 ** i
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * Debounce utility
 */
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle utility
 */
export function throttle(func, limit) {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// ========================================
// ANALYSIS UTILITIES
// ========================================

/**
 * Analyze semantic changes in code diffs
 */
export function analyzeSemanticChanges(diff, filePath) {
  const analysis = {
    changeType: 'modification',
    patterns: new Set(),
    frameworks: new Set(),
    keywords: new Set(),
    codeElements: new Set(),
    apiChanges: [],
    dataChanges: [],
  }

  if (!diff || diff === 'Binary file or diff unavailable') {
    return convertSetsToArrays(analysis)
  }

  const _addedLines = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  const _removedLines = diff
    .split('\n')
    .filter((line) => line.startsWith('-') && !line.startsWith('---'))

  // Framework detection (only if filePath is valid)
  if (
    filePath &&
    typeof filePath === 'string' &&
    (filePath.includes('database/') ||
      filePath.includes('sql/') ||
      filePath.includes('migrations/'))
  ) {
    analysis.frameworks.add('Database')
    if (diff.includes('CREATE TABLE') || diff.includes('ALTER TABLE')) {
      analysis.changeType = 'schema_change'
      analysis.patterns.add('database_schema')
    }
    if (diff.includes('CREATE POLICY') || diff.includes('ALTER POLICY')) {
      analysis.patterns.add('security_policy')
    }
  }

  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    analysis.frameworks.add('React')
    if (diff.includes('useState') || diff.includes('useEffect')) {
      analysis.patterns.add('react_hooks')
    }
    if (diff.includes('useCallback') || diff.includes('useMemo')) {
      analysis.patterns.add('performance_optimization')
    }
  }

  if (
    filePath &&
    typeof filePath === 'string' &&
    (filePath.includes('/api/') || filePath.includes('route.'))
  ) {
    analysis.frameworks.add('API')
    analysis.changeType = 'api_change'

    ;['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach((method) => {
      if (
        diff.includes(`export async function ${method}`) ||
        diff.includes(`app.${method.toLowerCase()}`)
      ) {
        analysis.apiChanges.push(`${method} endpoint`)
        analysis.patterns.add('api_endpoint')
      }
    })
  }

  // Code element detection
  const codePatterns = {
    function_definition: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
    component_definition: /(?:export\s+)?(?:const|function)\s+(\w+Component|\w+Page|\w+Layout)/g,
    hook_definition: /(?:export\s+)?(?:const|function)\s+(use\w+)/g,
    type_definition: /(?:export\s+)?(?:type|interface)\s+(\w+)/g,
    constant_definition: /(?:export\s+)?const\s+(\w+)/g,
  }

  Object.entries(codePatterns).forEach(([pattern, regex]) => {
    const matches = [...diff.matchAll(regex)]
    if (matches.length > 0) {
      analysis.patterns.add(pattern)
      matches.forEach((match) => analysis.codeElements.add(match[1]))
    }
  })

  // Advanced pattern detection
  const advancedPatterns = {
    error_handling: [/try\s*{/, /catch\s*\(/, /throw\s+/, /Error\(/],
    async_operations: [/async\s+/, /await\s+/, /Promise\./, /\.then\(/],
    data_validation: [/validate/, /schema/, /validation/, /validator/i],
    authentication: [/auth/, /login/, /logout/, /token/, /jwt/, /session/i],
    authorization: [/permission/, /role/, /access/, /policy/, /guard/i],
    caching: [/cache/, /memo/, /useMemo/, /useCallback/i],
    testing: [/test/, /spec/, /mock/, /describe/, /it\(/],
    styling: [/className/, /css/, /styled/, /style/],
    state_management: [/useState/, /useReducer/, /store/, /state/i],
    routing: [/router/, /navigate/, /redirect/, /route/, /Link/],
    data_fetching: [/fetch/, /axios/, /useQuery/, /useMutation/, /api/i],
  }

  Object.entries(advancedPatterns).forEach(([pattern, regexes]) => {
    if (regexes.some((regex) => regex.test(diff))) {
      analysis.patterns.add(pattern)
    }
  })

  return convertSetsToArrays(analysis)
}

/**
 * Analyze functional impact of code changes
 */
export function analyzeFunctionalImpact(diff, filePath, status) {
  const impact = {
    scope: 'local',
    severity: 'low',
    affectedSystems: new Set(),
    businessImpact: 'minimal',
    technicalDebt: 'none',
    migrationRequired: false,
    backwardCompatible: true,
  }

  if (!diff || diff === 'Binary file or diff unavailable') {
    return convertSetsToArrays(impact)
  }

  // File deletion has high impact
  if (status === 'D') {
    impact.severity = 'high'
    impact.scope = 'global'
    impact.backwardCompatible = false
    return convertSetsToArrays(impact)
  }

  const _addedLines = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
  const _removedLines = diff
    .split('\n')
    .filter((line) => line.startsWith('-') && !line.startsWith('---'))

  // Assess scope based on file type and changes (only if filePath is valid)
  if (filePath && typeof filePath === 'string') {
    if (
      filePath.includes('/api/') ||
      filePath.includes('/server/') ||
      filePath.includes('/backend/')
    ) {
      impact.scope = 'system'
      impact.affectedSystems.add('backend')

      if (diff.includes('export') || diff.includes('endpoint') || diff.includes('route')) {
        impact.scope = 'global'
        impact.severity = 'medium'
      }
    }

    if (filePath.includes('package.json') || filePath.includes('package-lock.json')) {
      impact.scope = 'global'
      impact.severity = 'high'
      impact.affectedSystems.add('dependencies')
      impact.migrationRequired = true
    }

    if (filePath.includes('database/') || filePath.includes('migrations/')) {
      impact.scope = 'global'
      impact.severity = 'high'
      impact.affectedSystems.add('database')
      impact.migrationRequired = true
      impact.backwardCompatible = false
    }
  }

  // Breaking change detection
  const breakingPatterns = [
    /export\s+(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?}-/g,
    /export\s+(?:const|let|var)\s+\w+\s*=[\s\S]*?-/g,
    /export\s+(?:class|interface|type)\s+\w+[\s\S]*?-/g,
  ]

  if (breakingPatterns.some((pattern) => pattern.test(diff))) {
    impact.backwardCompatible = false
    impact.severity = 'high'
    impact.businessImpact = 'high'
  }

  // Performance impact
  if (diff.includes('async') || diff.includes('await') || diff.includes('Promise')) {
    impact.affectedSystems.add('performance')
  }

  // Security impact
  if (diff.includes('auth') || diff.includes('permission') || diff.includes('security')) {
    impact.affectedSystems.add('security')
    impact.severity = 'high'
    impact.businessImpact = 'high'
  }

  return convertSetsToArrays(impact)
}

/**
 * Generate analysis summary from semantic and functional analysis
 */
export function generateAnalysisSummary(semanticAnalysis, functionalImpact) {
  const summary = {
    primaryChanges: [],
    impactLevel: functionalImpact.severity || 'low',
    technicalScope: functionalImpact.scope || 'local',
    businessRelevance: functionalImpact.businessImpact || 'minimal',
    frameworks: Array.from(semanticAnalysis.frameworks || []),
    patterns: Array.from(semanticAnalysis.patterns || []),
    recommendations: [],
    riskFactors: [],
  }

  // Generate primary changes based on patterns
  if (semanticAnalysis.patterns?.includes('api_endpoint')) {
    summary.primaryChanges.push('API endpoint modifications')
  }
  if (semanticAnalysis.patterns?.includes('database_schema')) {
    summary.primaryChanges.push('Database schema changes')
  }
  if (semanticAnalysis.patterns?.includes('react_hooks')) {
    summary.primaryChanges.push('React component updates')
  }
  if (semanticAnalysis.patterns?.includes('function_definition')) {
    summary.primaryChanges.push('Function implementations')
  }

  // Generate recommendations
  if (functionalImpact.migrationRequired) {
    summary.recommendations.push('Migration script required')
  }
  if (!functionalImpact.backwardCompatible) {
    summary.recommendations.push('Breaking change - update dependent code')
  }
  if (functionalImpact.affectedSystems?.includes('security')) {
    summary.recommendations.push('Security review recommended')
  }
  if (functionalImpact.affectedSystems?.includes('performance')) {
    summary.recommendations.push('Performance testing advised')
  }

  // Identify risk factors
  if (functionalImpact.severity === 'high') {
    summary.riskFactors.push('High impact changes')
  }
  if (functionalImpact.scope === 'global') {
    summary.riskFactors.push('System-wide effects')
  }
  if (semanticAnalysis.frameworks && semanticAnalysis.frameworks.length > 2) {
    summary.riskFactors.push('Multiple framework dependencies')
  }

  return summary
}

/**
 * Perform semantic analysis on files and commit message
 */
export function performSemanticAnalysis(files, subject, body) {
  const conventionalCommit = parseConventionalCommit(subject, body)
  const analysis = {
    commitType: conventionalCommit.type || 'unknown',
    scope: conventionalCommit.scope,
    description: conventionalCommit.description,
    isConventional: conventionalCommit.isConventional,
    breaking: conventionalCommit.breaking,
    breakingChanges: conventionalCommit.breakingChanges,
    issueReferences: conventionalCommit.issueReferences,
    closesReferences: conventionalCommit.closesReferences,
    affectedDomains: new Set(),
    technicalElements: new Set(),
    businessElements: new Set(),
    complexity: 'low',
  }

  // Analyze files
  files.forEach((file) => {
    const filePath = file.filePath || file.path || ''
    const category = categorizeFile(filePath)
    const language = detectLanguage(filePath)

    analysis.affectedDomains.add(category)
    analysis.technicalElements.add(language)

    // Business domain detection (only if filePath exists)
    if (filePath && typeof filePath === 'string') {
      if (filePath.includes('/user/') || filePath.includes('/customer/')) {
        analysis.businessElements.add('user_management')
      }
      if (filePath.includes('/payment/') || filePath.includes('/billing/')) {
        analysis.businessElements.add('financial_operations')
      }
      if (filePath.includes('/auth/') || filePath.includes('/security/')) {
        analysis.businessElements.add('security_access')
      }
      if (filePath.includes('/analytics/') || filePath.includes('/metrics/')) {
        analysis.businessElements.add('business_intelligence')
      }
    }
  })

  // Complexity assessment
  if (files.length > 10 || analysis.affectedDomains.size > 3) {
    analysis.complexity = 'high'
  } else if (files.length > 3 || analysis.affectedDomains.size > 1) {
    analysis.complexity = 'medium'
  }

  return convertSetsToArrays(analysis)
}

// ========================================
// AI UTILITIES
// ========================================

/**
 * Build enhanced prompt for AI analysis
 */
export function buildEnhancedPrompt(commitAnalysis, analysisMode = 'standard') {
  const {
    subject,
    files = [],
    semanticAnalysis = {},
    diffStats = {},
    complexity = {},
    riskAssessment = {},
  } = commitAnalysis

  // Detect merge commits and upgrade analysis mode for better specificity
  const isMergeCommit = subject && subject.toLowerCase().includes('merge')
  const effectiveAnalysisMode = isMergeCommit && files.length > 10 ? 'detailed' : analysisMode

  // Debug logging for merge commits (disabled)
  // if (isMergeCommit) {
  //   console.log('\n=== MERGE COMMIT DEBUG (EARLY) ===')
  //   console.log('Subject:', subject)
  //   console.log('Files count:', files.length)
  //   console.log('Effective analysis mode:', effectiveAnalysisMode)
  //   console.log('=== END EARLY DEBUG ===\n')
  // }

  // Initialize DiffProcessor with effective analysis mode
  const diffProcessor = new DiffProcessor({
    analysisMode: effectiveAnalysisMode,
    enableFiltering: true,
    enablePatternDetection: true,
  })

  // Process all files with intelligent diff compression
  const processedResult = diffProcessor.processFiles(files)
  const { processedFiles, patterns, filesProcessed, filesSkipped } = processedResult

  const insertions = diffStats.insertions || 0
  const deletions = diffStats.deletions || 0

  // Build pattern summary if patterns were detected
  const patternSummary =
    Object.keys(patterns).length > 0
      ? `\n**BULK PATTERNS DETECTED:**\n${Object.values(patterns)
          .map((p) => `- ${p.description}`)
          .join('\n')}\n`
      : ''

  // Build files section with processed diffs
  const filesSection = processedFiles
    .map((file) => {
      if (file.isSummary) {
        return `\n**[REMAINING FILES SUMMARY]:**\n${file.diff}\n`
      }

      const compressionInfo = file.compressionApplied
        ? ` [compressed from ${file.originalSize || 'unknown'} chars]`
        : ''
      const patternInfo = file.bulkPattern ? ` [${file.bulkPattern}]` : ''

      return `\n**${file.filePath || file.path}** (${file.status})${compressionInfo}${patternInfo}:\n${file.diff}\n`
    })
    .join('')

  // Check if we have enhanced merge summary from GitService (isMergeCommit already detected above)
  const enhancedMergeSummary =
    files.length > 0 && files[0].enhancedMergeSummary ? files[0].enhancedMergeSummary : null

  const prompt = `Analyze this git commit for changelog generation.

**COMMIT:** ${subject}${isMergeCommit ? ' (MERGE COMMIT - categorize as "merge")' : ''}
**FILES:** ${files.length} files (${filesProcessed} analyzed, ${filesSkipped} summarized), ${insertions + deletions} lines changed${patternSummary}${
    enhancedMergeSummary
      ? `

**ENHANCED MERGE SUMMARY:**
${enhancedMergeSummary}

**IMPORTANT FOR MERGE COMMITS:** Use the above enhanced summary as your description. Do NOT create a generic summary. Instead, convert the bullet points above into a flowing description that includes the specific file names, numbers, and technical details provided.`
      : ''
  }

**TARGET AUDIENCE:** End users and project stakeholders who need to understand what changed and why it matters.

**YOUR ROLE:** You are a release manager translating technical changes into clear, user-focused release notes.

**ANALYSIS APPROACH:**
1. **First, categorize correctly** using the rules below
2. **Then, focus on user impact** - what can they do now that they couldn't before?
3. **Keep technical details minimal** - only what's necessary for understanding
4. **Be definitive and factual** - never use uncertain language like "likely", "probably", "appears to", "seems to", or "possibly"
5. **Base analysis on actual code changes** - only describe what you can verify from the diff content
6. **For merge commits** - ALWAYS categorize as "merge" regardless of content
7. **Use enhanced merge summary** - If an "ENHANCED MERGE SUMMARY" section is provided above, DO NOT analyze individual file diffs. Instead, directly incorporate the specific bullet points from the enhanced summary into your response. Use the exact technical details, file names, and numbers provided in the enhanced summary.

**PROCESSED DIFFS:**${filesSection}

**CATEGORIZATION RULES (STRICTLY ENFORCED):**
- **merge**: Any commit with "Merge" in the subject line (branch merges, pull request merges)
- **fix**: ONLY actual bug fixes - broken functionality now works correctly
- **feature**: New capabilities, tools, or major functionality additions (NOT merges)
- **refactor**: Code restructuring without changing what users can do
- **perf**: Performance improvements users will notice
- **docs**: Documentation updates only
- **build/chore**: Build system, dependencies, maintenance

**CRITICAL VALIDATION:**
- Commits with "Merge" in subject = "merge" category ALWAYS
- Large additions (>10 files OR >1000 lines) = "feature" or "refactor", NEVER "fix" (unless merge)
- New modules/classes/tools = "feature" (unless merge)
- Only actual bug repairs = "fix"

Provide a JSON response with ONLY these fields (use definitive language - NO "likely", "probably", "appears", etc.):
{
  "summary": "${subject}",
  "impact": "critical|high|medium|low|minimal",
  "category": "feature|fix|security|breaking|docs|style|refactor|perf|test|chore",
  "description": "One clear, factual sentence describing what users can now do (for features) or what now works correctly (for fixes)",
  "technicalDetails": "Maximum 2 factual sentences about key technical changes - focus on the most important functions/modules/APIs added or modified",
  "businessValue": "Brief, definitive user benefit in 1 sentence",
  "riskFactors": ["minimal", "list"],
  "recommendations": ["minimal", "list"],
  "breakingChanges": false,
  "migrationRequired": false
}`

  return prompt
}

/**
 * Validate and correct AI categorization and impact assessment based on commit characteristics
 */
export function validateCommitCategory(category, commitAnalysis) {
  const { files = [], diffStats = {}, subject = '' } = commitAnalysis
  const fileCount = files.length
  const addedFiles = files.filter((f) => f.status === 'A' || f.status === '??').length
  const { insertions = 0, deletions = 0 } = diffStats

  // Rule 1: Large additions cannot be bug fixes
  if (category === 'fix' && (fileCount > 10 || addedFiles > 5 || insertions > 1000)) {
    // Check if it's likely a refactor vs new feature
    if (deletions > insertions * 0.5) {
      return 'refactor' // Significant deletions suggest refactoring
    }
    return 'feature' // More additions suggest new functionality
  }

  // Rule 2: New module/class additions are features
  if (category === 'fix' && addedFiles > 0) {
    const hasNewModules = files.some(
      (f) =>
        (f.status === 'A' || f.status === '??') &&
        (f.filePath.includes('.js') || f.filePath.includes('.ts') || f.filePath.includes('.py'))
    )
    if (hasNewModules) {
      return 'feature'
    }
  }

  // Rule 3: Documentation-only changes
  if (
    category !== 'docs' &&
    files.every(
      (f) =>
        f.filePath.endsWith('.md') ||
        f.filePath.endsWith('.txt') ||
        f.filePath.includes('README') ||
        f.filePath.includes('CHANGELOG')
    )
  ) {
    return 'docs'
  }

  // Rule 4: Test-only changes
  if (
    category !== 'test' &&
    files.every(
      (f) =>
        f.filePath.includes('test') ||
        f.filePath.includes('spec') ||
        f.filePath.endsWith('.test.js') ||
        f.filePath.endsWith('.spec.js')
    )
  ) {
    return 'test'
  }

  return category // No correction needed
}

/**
 * Validate and correct impact assessment based on actual change magnitude
 */
export function validateImpactAssessment(impact, commitAnalysis) {
  const { files = [], diffStats = {}, subject = '' } = commitAnalysis
  const fileCount = files.length
  const addedFiles = files.filter((f) => f.status === 'A' || f.status === '??').length
  const { insertions = 0, deletions = 0 } = diffStats
  const totalChanges = insertions + deletions

  // Rule 1: Large architectural changes cannot be "minimal" or "low"
  if ((impact === 'minimal' || impact === 'low') && (fileCount > 50 || totalChanges > 5000)) {
    return 'high'
  }

  // Rule 2: Major refactors or large features should be at least "medium"
  if (impact === 'minimal' && (fileCount > 20 || totalChanges > 2000 || addedFiles > 10)) {
    return 'medium'
  }

  // Rule 3: Small changes cannot be "critical" or "high" unless breaking
  if ((impact === 'critical' || impact === 'high') && fileCount <= 3 && totalChanges <= 100) {
    const hasBreakingIndicators =
      subject.includes('!') || subject.toLowerCase().includes('breaking')
    if (!hasBreakingIndicators) {
      return 'medium'
    }
  }

  // Rule 4: Documentation-only changes should be low impact
  if (
    files.every(
      (f) =>
        f.filePath.endsWith('.md') ||
        f.filePath.endsWith('.txt') ||
        f.filePath.includes('README') ||
        f.filePath.includes('CHANGELOG')
    ) &&
    (impact === 'critical' || impact === 'high')
  ) {
    return 'low'
  }

  return impact // No correction needed
}

/**
 * Parse AI response content
 */
export function parseAIResponse(content, originalCommit = {}) {
  if (!content) {
    return {
      summary: originalCommit.subject || 'Unknown change',
      impact: 'low',
      category: 'chore',
      description: 'AI analysis unavailable - using pattern-based description',
      technicalDetails: 'Analysis performed using file pattern recognition',
      businessValue: 'Impact assessment based on file changes only',
      riskFactors: [],
      recommendations: ['Consider configuring AI provider for detailed analysis'],
      breakingChanges: false,
      migrationRequired: false,
    }
  }

  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = safeJsonParse(jsonMatch[0])
      if (parsed) {
        // Validate and correct the category and impact
        const validatedCategory = validateCommitCategory(parsed.category || 'chore', originalCommit)
        const validatedImpact = validateImpactAssessment(parsed.impact || 'low', originalCommit)

        return {
          summary: parsed.summary || originalCommit.subject || 'Unknown change',
          impact: validatedImpact,
          category: validatedCategory,
          description: parsed.description || '',
          technicalDetails: parsed.technicalDetails || '',
          businessValue: parsed.businessValue || '',
          riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          breakingChanges: Boolean(parsed.breakingChanges),
          migrationRequired: Boolean(parsed.migrationRequired),
        }
      }
    }

    // Fallback to text parsing if JSON extraction fails
    const safeContent = content && typeof content === 'string' ? content : ''
    const lowerContent = safeContent.toLowerCase()

    return {
      summary: originalCommit.subject || 'Unknown change',
      impact: lowerContent.includes('critical')
        ? 'critical'
        : lowerContent.includes('high')
          ? 'high'
          : lowerContent.includes('medium')
            ? 'medium'
            : 'low',
      category: extractCategoryFromText(safeContent),
      description: safeContent.substring(0, 200) + (safeContent.length > 200 ? '...' : ''),
      technicalDetails: safeContent,
      businessValue: '',
      riskFactors: [],
      recommendations: [],
      breakingChanges: lowerContent.includes('breaking'),
      migrationRequired: lowerContent.includes('migration'),
    }
  } catch (error) {
    console.warn(colors.warningMessage(`AI response parsing error: ${error.message}`))
    return {
      summary: originalCommit.subject || 'Unknown change',
      impact: 'low',
      category: 'chore',
      description: 'AI analysis failed',
      technicalDetails: '',
      businessValue: '',
      riskFactors: [],
      recommendations: [],
      breakingChanges: false,
      migrationRequired: false,
    }
  }
}

/**
 * Extract category from text content
 * Helper for parseAIResponse
 */
function extractCategoryFromText(content) {
  if (!content || typeof content !== 'string') {
    return 'chore'
  }
  const text = content.toLowerCase()

  if (text.includes('feature') || text.includes('feat')) {
    return 'feature'
  }
  if (text.includes('fix') || text.includes('bug')) {
    return 'fix'
  }
  if (text.includes('security')) {
    return 'security'
  }
  if (text.includes('breaking')) {
    return 'breaking'
  }
  if (text.includes('doc')) {
    return 'docs'
  }
  if (text.includes('style')) {
    return 'style'
  }
  if (text.includes('refactor')) {
    return 'refactor'
  }
  if (text.includes('perf') || text.includes('performance')) {
    return 'perf'
  }
  if (text.includes('test')) {
    return 'test'
  }

  return 'chore'
}

// ========================================
// CHANGELOG UTILITIES
// ========================================

/**
 * Process working directory changes for changelog generation
 */
/**
 * Get raw working directory changes from git status
 *
 * Note: This is a lightweight utility function that shells out to git directly
 * for simple status checks. For comprehensive git operations, services should
 * use GitService/GitManager, but this utility is kept for:
 * - Performance (avoids service initialization overhead)
 * - Simplicity (standalone function for basic status checks)
 * - Backward compatibility (widely used across codebase)
 *
 * @returns {Array} Array of change objects with status and filePath
 */
export function getWorkingDirectoryChanges() {
  try {
    const result = execSync('git status --porcelain', { encoding: 'utf8' })

    if (!result.trim()) {
      return []
    }

    const lines = result.split('\n').filter((line) => line.trim())

    const changes = lines.map((line) => {
      const status = line.substring(0, 2).trim() || '??'
      const filePath = line.substring(3)

      return {
        status,
        filePath,
        path: filePath, // alias for compatibility
        diff: '', // Will be populated later if needed
        additions: 0,
        deletions: 0,
      }
    })

    return changes
  } catch (error) {
    console.warn('Could not get git status:', error.message)
    return []
  }
}

export function processWorkingDirectoryChanges(workingDirChanges, _gitManager = null) {
  // If no changes provided, get them from git status
  if (!workingDirChanges) {
    workingDirChanges = getWorkingDirectoryChanges()
  }

  if (!workingDirChanges || workingDirChanges.length === 0) {
    return []
  }

  const categorizedChanges = {
    added: [],
    modified: [],
    deleted: [],
    renamed: [],
    unknown: [],
  }

  let totalFiles = 0

  workingDirChanges.forEach((change) => {
    const category = categorizeFile(change.filePath)
    const language = detectLanguage(change.filePath)
    const importance = assessFileImportance(change.filePath, change.status)

    const processedChange = {
      filePath: change.filePath,
      status: change.status,
      category,
      language,
      importance,
      diff: change.diff || '',
      additions: change.additions || 0,
      deletions: change.deletions || 0,
    }

    switch (change.status) {
      case 'A':
        categorizedChanges.added.push(processedChange)
        break
      case 'M':
        categorizedChanges.modified.push(processedChange)
        break
      case 'D':
        categorizedChanges.deleted.push(processedChange)
        break
      case 'R':
        categorizedChanges.renamed.push(processedChange)
        break
      default:
        categorizedChanges.unknown.push(processedChange)
    }

    totalFiles++
  })

  // Generate summary
  const summary = generateWorkspaceChangesSummary(categorizedChanges)

  // Assess complexity
  const complexity = assessWorkspaceComplexity(categorizedChanges, totalFiles)

  return {
    categorizedChanges,
    summary,
    totalFiles,
    complexity,
  }
}

/**
 * Summarize file changes for changelog
 */
export function summarizeFileChanges(changes) {
  if (!changes || changes.length === 0) {
    return {
      summary: 'No file changes detected',
      categories: {},
      stats: { added: 0, modified: 0, deleted: 0, renamed: 0 },
      languages: {},
    }
  }

  const stats = {
    added: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
  }

  const categories = {}
  const languages = new Set()

  changes.forEach((change) => {
    // Handle status mapping for git status format
    let status = change.status
    if (status === '??') {
      status = 'A' // Untracked files are "added"
    }
    if (status.length > 1) {
      status = status[0] // Take first character for multiple status codes
    }

    switch (status) {
      case 'A':
        stats.added++
        break
      case 'M':
        stats.modified++
        break
      case 'D':
        stats.deleted++
        break
      case 'R':
        stats.renamed++
        break
    }

    const filePath = change.filePath || change.path
    const category = categorizeFile(filePath)
    const language = detectLanguage(filePath)

    // Group files by category
    if (!categories[category]) {
      categories[category] = []
    }
    categories[category].push({
      status,
      path: filePath,
      language,
    })

    languages.add(language)
  })

  const parts = []
  if (stats.added > 0) {
    parts.push(`${stats.added} added`)
  }
  if (stats.modified > 0) {
    parts.push(`${stats.modified} modified`)
  }
  if (stats.deleted > 0) {
    parts.push(`${stats.deleted} deleted`)
  }
  if (stats.renamed > 0) {
    parts.push(`${stats.renamed} renamed`)
  }

  let summary = `${changes.length} files changed: ${parts.join(', ')}`

  if (Object.keys(categories).length > 0) {
    summary += `. Affected areas: ${Object.keys(categories).join(', ')}`
  }

  return {
    summary,
    categories,
    stats,
    languages: Array.from(languages),
  }
}

/**
 * Build commit changelog from analyzed commits
 */
export function buildCommitChangelog(analyzedCommits, releaseInsights, version, options = {}) {
  const { metrics, includeAttribution = true } = options
  const currentDate = new Date().toISOString().split('T')[0]
  const versionHeader = version || 'Unreleased'

  let changelog = `# Changelog\n\n## [${versionHeader}] - ${currentDate}\n\n`

  // Add release summary with business impact
  if (releaseInsights?.summary) {
    changelog += `### 📋 Release Summary\n${releaseInsights.summary}\n\n`
    changelog += `**Business Impact**: ${releaseInsights.businessImpact}\n`
    changelog += `**Complexity**: ${releaseInsights.complexity}\n`
    if (
      releaseInsights.deploymentRequirements &&
      releaseInsights.deploymentRequirements.length > 0
    ) {
      changelog += `**Deployment Requirements**: ${releaseInsights.deploymentRequirements.join(', ')}\n`
    }
    changelog += '\n'
  }

  // Use unified format with impact-based ordering instead of categorized sections
  changelog += '## Changes\n\n'

  // Sort commits by business impact (breaking/critical first, then by impact level)
  const sortedCommits = analyzedCommits.sort((a, b) => {
    // Breaking changes always come first
    if (a.breaking && !b.breaking) {
      return -1
    }
    if (!a.breaking && b.breaking) {
      return 1
    }

    // Then sort by impact level
    const impactOrder = { critical: 0, high: 1, medium: 2, low: 3, minimal: 4 }
    const aImpact = impactOrder[a.aiSummary?.impact] ?? 5
    const bImpact = impactOrder[b.aiSummary?.impact] ?? 5

    return aImpact - bImpact
  })

  sortedCommits.forEach((commit) => {
    const type = commit.breaking ? 'breaking' : commit.type || 'chore'
    const summary = commit.aiSummary?.summary || commit.subject
    const confidence = commit.aiSummary?.confidence
      ? `${Math.round(commit.aiSummary.confidence * 100)}%`
      : '85%'

    // Format: - (tag) Brief description - Detailed explanation (hash) (confidence%)
    let line = `- (${type}) ${summary}`

    // Add breaking change indicator
    if (commit.breaking || commit.aiSummary?.breaking) {
      line += ' ⚠️ BREAKING CHANGE'
    }

    // Add high/critical impact indicator
    if (commit.aiSummary?.impact === 'critical' || commit.aiSummary?.impact === 'high') {
      line += ' 🔥'
    }

    // Add detailed technical explanation
    if (commit.aiSummary?.technicalDetails) {
      line += ` - ${commit.aiSummary.technicalDetails}`
    } else if (
      commit.aiSummary?.description &&
      commit.aiSummary.description !== commit.aiSummary.summary
    ) {
      line += ` - ${commit.aiSummary.description}`
    }

    // Add commit hash and confidence
    line += ` (${commit.hash}) (${confidence})`

    changelog += `${line}\n`

    // Add sub-bullets for additional details
    if (commit.aiSummary?.highlights?.length > 1) {
      commit.aiSummary.highlights.slice(1).forEach((highlight) => {
        changelog += `  - ${highlight}\n`
      })
    }

    // Add migration notes
    if (commit.aiSummary?.migrationNotes) {
      changelog += `  - **Migration**: ${commit.aiSummary.migrationNotes}\n`
    }

    changelog += '\n'
  })

  // Add detailed risk assessment
  if (releaseInsights && (releaseInsights.riskLevel !== 'low' || releaseInsights.breaking)) {
    changelog += '### ⚠️ Risk Assessment\n'
    changelog += `**Risk Level:** ${releaseInsights.riskLevel.toUpperCase()}\n\n`

    if (releaseInsights.breaking) {
      changelog +=
        '🚨 **Breaking Changes**: This release contains breaking changes. Please review migration notes above.\n\n'
    }

    if (
      releaseInsights.deploymentRequirements &&
      releaseInsights.deploymentRequirements.length > 0
    ) {
      changelog += '📋 **Deployment Requirements**:\n'
      releaseInsights.deploymentRequirements.forEach((req) => {
        changelog += `- ${req}\n`
      })
      changelog += '\n'
    }
  }

  // Add performance metrics
  if (metrics) {
    changelog += '### 📊 Generation Metrics\n'
    changelog += `- **Total Commits**: ${analyzedCommits.length}\n`
    if (metrics.startTime) {
      changelog += `- **Processing Time**: ${formatDuration(Date.now() - metrics.startTime)}\n`
    }
    changelog += `- **AI Calls**: ${metrics.apiCalls || 0}\n`
    if (metrics.totalTokens > 0) {
      changelog += `- **Tokens Used**: ${metrics.totalTokens.toLocaleString()}\n`
    }
    changelog += `- **Batches Processed**: ${metrics.batchesProcessed || 0}\n`
    if (metrics.errors > 0) {
      changelog += `- **Errors**: ${metrics.errors}\n`
    }
    changelog += '\n'
  }

  // Add attribution footer
  if (includeAttribution !== false) {
    changelog +=
      '---\n\n*Generated using [ai-changelog-generator](https://github.com/entro314-labs/AI-changelog-generator) - AI-powered changelog generation for Git repositories*\n'
  }

  return changelog
}

/**
 * Generate workspace changes summary
 * Helper for processWorkingDirectoryChanges
 */
function generateWorkspaceChangesSummary(categorizedChanges) {
  const parts = []

  if (categorizedChanges.added.length > 0) {
    parts.push(`${categorizedChanges.added.length} files added`)
  }
  if (categorizedChanges.modified.length > 0) {
    parts.push(`${categorizedChanges.modified.length} files modified`)
  }
  if (categorizedChanges.deleted.length > 0) {
    parts.push(`${categorizedChanges.deleted.length} files deleted`)
  }
  if (categorizedChanges.renamed.length > 0) {
    parts.push(`${categorizedChanges.renamed.length} files renamed`)
  }

  return parts.length > 0 ? parts.join(', ') : 'No changes detected'
}

/**
 * Assess workspace complexity
 * Helper for processWorkingDirectoryChanges
 */
function assessWorkspaceComplexity(categorizedChanges, totalFiles) {
  if (totalFiles > 20) {
    return 'high'
  }
  if (totalFiles > 5) {
    return 'medium'
  }
  if (categorizedChanges.deleted.length > 0) {
    return 'medium'
  }
  return 'low'
}

// ========================================
// CLI OUTPUT UTILITIES
// ========================================

/**
 * Handle unified output for analysis commands
 */
export function handleUnifiedOutput(data, config) {
  const { format = 'markdown', outputFile, silent, dryRun } = config
  if (format === 'json') {
    const jsonOutput = safeJsonStringify(data)

    if (outputFile && !dryRun) {
      // Write to file
      try {
        fs.writeFileSync(outputFile, jsonOutput, 'utf8')
        if (!silent) {
          console.log(colors.success(`📄 Changelog saved to: ${colors.file(outputFile)}`))
        }
      } catch (error) {
        console.error(`❌ Error writing to file: ${error.message}`)
        if (!silent) {
          console.log(jsonOutput)
        }
      }
    } else if (!silent) {
      if (dryRun && outputFile) {
        console.log(
          colors.infoMessage(`[DRY RUN] Would save changelog to: ${colors.file(outputFile)}`)
        )
      }
      console.log(jsonOutput)
    }
  } else {
    // Markdown format (default)
    const markdownOutput = typeof data === 'string' ? data : safeJsonStringify(data)

    if (outputFile && !dryRun) {
      try {
        fs.writeFileSync(outputFile, markdownOutput, 'utf8')
        if (!silent) {
          console.log(colors.success(`📄 Changelog saved to: ${colors.file(outputFile)}`))
        }
      } catch (error) {
        console.error(`❌ Error writing to file: ${error.message}`)
        if (!silent) {
          console.log(markdownOutput)
        }
      }
    } else if (!silent) {
      if (dryRun && outputFile) {
        console.log(
          colors.infoMessage(`[DRY RUN] Would save changelog to: ${colors.file(outputFile)}`)
        )
      }
      console.log(markdownOutput)
    }
  }

  return data
}

/**
 * Simple output data function
 * Wrapper around handleUnifiedOutput for backwards compatibility
 */
export function outputData(data, format = 'markdown') {
  return handleUnifiedOutput(data, { format, silent: false })
}

// ========================================
// INTERACTIVE UTILITIES
// ========================================

/**
 * Run interactive mode with full menu system
 */
export async function runInteractiveMode() {
  const { select, intro } = await import('@clack/prompts')

  intro(colors.header('🎮 AI Changelog Generator - Interactive Mode'))

  const choices = [
    { value: 'changelog-recent', label: '📝 Generate changelog from recent commits' },
    { value: 'changelog-specific', label: '🎯 Generate changelog from specific commits' },
    { value: 'analyze-workdir', label: '🔧 Analyze working directory changes' },
    { value: 'analyze-repo', label: '📊 Repository health analysis' },
    { value: 'commit-message', label: '💬 Generate commit message for current changes' },
    { value: 'configure-providers', label: '⚙️  Configure AI providers' },
    { value: 'validate-config', label: '🔍 Validate configuration' },
    { value: 'exit', label: '❌ Exit' },
  ]

  const action = await select({
    message: 'What would you like to do?',
    options: choices,
  })

  return { action, timestamp: new Date().toISOString() }
}

/**
 * Analyze changes for commit message with detailed analysis
 */
export function analyzeChangesForCommitMessage(changes, includeScope = false) {
  if (!(changes && Array.isArray(changes)) || changes.length === 0) {
    return {
      summary: 'No changes detected',
      scope: null,
      changes: 0,
      recommendations: ['Make some changes first'],
      type: 'chore',
    }
  }

  // Categorize changes
  const categories = {}
  const scopes = new Set()
  let hasTests = false
  let hasDocs = false
  let hasConfig = false
  let hasSource = false

  changes.forEach((change) => {
    const filePath = change.path || change.filePath || ''
    const category = categorizeFile(filePath)

    if (!categories[category]) {
      categories[category] = []
    }
    categories[category].push(change)

    // Extract scope from path
    if (includeScope) {
      const pathParts = filePath.split('/')
      if (pathParts.length > 1) {
        const scope = pathParts.at(-2)
        if (scope && scope !== '.' && scope !== '..') {
          scopes.add(scope)
        }
      }
    }

    // Track content types
    if (category === 'tests') {
      hasTests = true
    }
    if (category === 'documentation') {
      hasDocs = true
    }
    if (category === 'configuration') {
      hasConfig = true
    }
    if (category === 'source') {
      hasSource = true
    }
  })

  // Determine primary category and type
  const primaryCategory = Object.keys(categories).sort(
    (a, b) => categories[b].length - categories[a].length
  )[0]

  const typeMapping = {
    source: 'feat',
    tests: 'test',
    documentation: 'docs',
    configuration: 'chore',
    build: 'build',
    frontend: 'feat',
    assets: 'chore',
  }

  const commitType = typeMapping[primaryCategory] || 'chore'

  // Generate summary
  const fileCount = changes.length
  const addedFiles = changes.filter((c) => c.status === 'A').length
  const modifiedFiles = changes.filter((c) => c.status === 'M').length
  const deletedFiles = changes.filter((c) => c.status === 'D').length

  let summary = `${fileCount} file${fileCount === 1 ? '' : 's'} changed`

  const changeDetails = []
  if (addedFiles > 0) {
    changeDetails.push(`${addedFiles} added`)
  }
  if (modifiedFiles > 0) {
    changeDetails.push(`${modifiedFiles} modified`)
  }
  if (deletedFiles > 0) {
    changeDetails.push(`${deletedFiles} deleted`)
  }

  if (changeDetails.length > 0) {
    summary += ` (${changeDetails.join(', ')})`
  }

  // Generate recommendations
  const recommendations = []

  if (hasSource && !hasTests) {
    recommendations.push('Consider adding tests for source changes')
  }

  if (hasSource && !hasDocs) {
    recommendations.push('Consider updating documentation')
  }

  if (fileCount > 10) {
    recommendations.push('Consider breaking this into smaller commits')
  }

  if (hasConfig) {
    recommendations.push('Review configuration changes carefully')
  }

  return {
    summary,
    scope: includeScope && scopes.size > 0 ? Array.from(scopes).slice(0, 2).join(', ') : null,
    changes: fileCount,
    type: commitType,
    primaryCategory,
    categories: Object.keys(categories),
    recommendations,
    details: {
      added: addedFiles,
      modified: modifiedFiles,
      deleted: deletedFiles,
      hasTests,
      hasDocs,
      hasConfig,
      hasSource,
    },
  }
}

/**
 * Select specific commits with interactive interface
 */
export async function selectSpecificCommits(maxCommits = 20) {
  const { multiselect, note } = await import('@clack/prompts')
  const { execSync } = await import('node:child_process')

  try {
    note('🔍 Fetching recent commits...', 'Please wait')

    // Get recent commits with formatted output
    const gitCommand = `git log --oneline --no-merges -${maxCommits} --pretty=format:"%h|%s|%an|%ar"`
    const output = execSync(gitCommand, { encoding: 'utf8' })

    if (!output.trim()) {
      note('No commits found', 'Warning')
      return []
    }

    // Parse commits
    const commits = output
      .trim()
      .split('\n')
      .map((line) => {
        const [hash, subject, author, date] = line.split('|')
        return {
          hash,
          subject: subject || 'No subject',
          author: author || 'Unknown',
          date: date || 'Unknown',
          display: `${hash} ${subject} (${author}, ${date})`,
        }
      })

    if (commits.length === 0) {
      note('No commits available', 'Warning')
      return []
    }

    note(`Found ${commits.length} recent commits`, 'Info')

    // Create choices for selection
    const choices = commits.map((commit) => ({
      value: commit.hash,
      label: commit.display,
      hint: commit.hash,
    }))

    const selectedCommits = await multiselect({
      message: 'Select commits to include in changelog:',
      options: choices,
      required: true,
    })

    note(`✅ Selected ${selectedCommits.length} commits`, 'Success')
    return selectedCommits
  } catch (error) {
    note(`Error fetching commits: ${error.message}`, 'Error')
    return []
  }
}

// ========================================
// FILE UTILITIES (EXTENDED)
// ========================================

/**
 * Assess change complexity based on diff output
 */
export function assessChangeComplexity(diff) {
  if (!diff || diff === 'Binary file or diff unavailable') {
    return { score: 1 }
  }

  const lines = diff.split('\n')
  const additions = lines.filter((line) => line.startsWith('+')).length
  const deletions = lines.filter((line) => line.startsWith('-')).length
  const total = additions + deletions

  let score = 1
  if (total >= 200) {
    score = 5
  } else if (total >= 100) {
    score = 4
  } else if (total >= 50) {
    score = 3
  } else if (total >= 10) {
    score = 2
  }

  return {
    score,
    additions,
    deletions,
    total,
    level: score <= 2 ? 'low' : score <= 3 ? 'medium' : 'high',
  }
}

// ========================================
// BRANCH INTELLIGENCE UTILITIES
// ========================================

/**
 * Get current git branch name
 */
export function getCurrentBranch() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
    return branch !== 'HEAD' ? branch : null
  } catch (_error) {
    console.warn(colors.warning('Could not determine current branch'))
    return null
  }
}

/**
 * Extract branch context and intelligence from branch name
 * Based on better-commits patterns: type/ticket-description, feat/ABC-123-add-feature
 */
export function analyzeBranchIntelligence(branchName = null) {
  const branch = branchName || getCurrentBranch()

  if (!branch) {
    return {
      branch: null,
      type: null,
      ticket: null,
      description: null,
      confidence: 0,
      patterns: [],
    }
  }

  const analysis = {
    branch,
    type: null,
    ticket: null,
    description: null,
    confidence: 0,
    patterns: [],
  }

  // Pattern 1: type/ticket-description (e.g., feat/ABC-123-add-feature)
  const typeTicketDescPattern =
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)\/([A-Z]{2,}-\d+)-(.+)$/i
  let match = branch.match(typeTicketDescPattern)
  if (match) {
    analysis.type = match[1].toLowerCase()
    analysis.ticket = match[2].toUpperCase()
    analysis.description = match[3].replace(/[-_]/g, ' ')
    analysis.confidence = 95
    analysis.patterns.push('type/ticket-description')
    return analysis
  }

  // Pattern 2: type/description (e.g., feat/add-new-feature)
  const typeDescPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)\/(.+)$/i
  match = branch.match(typeDescPattern)
  if (match) {
    analysis.type = match[1].toLowerCase()
    analysis.description = match[2].replace(/[-_]/g, ' ')
    analysis.confidence = 85
    analysis.patterns.push('type/description')

    // Look for ticket in description
    const ticketInDesc = match[2].match(/([A-Z]{2,}-\d+)/)
    if (ticketInDesc) {
      analysis.ticket = ticketInDesc[1]
      analysis.confidence = 90
      analysis.patterns.push('ticket-in-description')
    }
    return analysis
  }

  // Pattern 3: ticket-description (e.g., ABC-123-fix-bug)
  const ticketDescPattern = /^([A-Z]{2,}-\d+)-(.+)$/
  match = branch.match(ticketDescPattern)
  if (match) {
    analysis.ticket = match[1]
    analysis.description = match[2].replace(/[-_]/g, ' ')
    analysis.confidence = 70
    analysis.patterns.push('ticket-description')

    // Infer type from description
    const inferredType = inferTypeFromDescription(match[2])
    if (inferredType) {
      analysis.type = inferredType
      analysis.confidence = 75
      analysis.patterns.push('inferred-type')
    }
    return analysis
  }

  // Pattern 4: just type at start (e.g., feat-add-feature)
  const typeStartPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)[-_](.+)$/i
  match = branch.match(typeStartPattern)
  if (match) {
    analysis.type = match[1].toLowerCase()
    analysis.description = match[2].replace(/[-_]/g, ' ')
    analysis.confidence = 60
    analysis.patterns.push('type-start')
    return analysis
  }

  // Pattern 5: ticket at start (e.g., ABC-123_add_feature)
  const ticketStartPattern = /^([A-Z]{2,}-\d+)[-_](.+)$/
  match = branch.match(ticketStartPattern)
  if (match) {
    analysis.ticket = match[1]
    analysis.description = match[2].replace(/[-_]/g, ' ')
    analysis.confidence = 60
    analysis.patterns.push('ticket-start')

    // Infer type from description
    const inferredType = inferTypeFromDescription(match[2])
    if (inferredType) {
      analysis.type = inferredType
      analysis.confidence = 65
      analysis.patterns.push('inferred-type')
    }
    return analysis
  }

  // Pattern 6: just ticket anywhere (e.g., add-feature-ABC-123)
  const ticketAnywherePattern = /([A-Z]{2,}-\d+)/
  match = branch.match(ticketAnywherePattern)
  if (match) {
    analysis.ticket = match[1]
    analysis.confidence = 40
    analysis.patterns.push('ticket-anywhere')

    // Use the whole branch as description, removing ticket
    analysis.description = branch.replace(match[1], '').replace(/[-_]/g, ' ').trim()
    return analysis
  }

  // Pattern 7: conventional type anywhere in branch
  const typeAnywherePattern = /(feat|fix|docs|style|refactor|perf|test|build|ci|chore)/i
  match = branch.match(typeAnywherePattern)
  if (match) {
    analysis.type = match[1].toLowerCase()
    analysis.confidence = 30
    analysis.patterns.push('type-anywhere')
    analysis.description = branch.replace(/[-_]/g, ' ')
    return analysis
  }

  // Fallback: use branch as description and try to infer type
  analysis.description = branch.replace(/[-_]/g, ' ')
  const inferredType = inferTypeFromDescription(branch)
  if (inferredType) {
    analysis.type = inferredType
    analysis.confidence = 25
    analysis.patterns.push('inferred-type')
  } else {
    analysis.confidence = 10
    analysis.patterns.push('no-pattern')
  }

  return analysis
}

/**
 * Infer commit type from description text
 */
function inferTypeFromDescription(description) {
  const text = description.toLowerCase()

  // Feature indicators
  if (text.match(/add|new|create|implement|introduce|feature/)) {
    return 'feat'
  }

  // Fix indicators
  if (text.match(/fix|bug|error|issue|resolve|correct|patch/)) {
    return 'fix'
  }

  // Documentation indicators
  if (text.match(/doc|readme|comment|guide|tutorial/)) {
    return 'docs'
  }

  // Style indicators
  if (text.match(/style|format|lint|prettier|eslint/)) {
    return 'style'
  }

  // Refactor indicators
  if (text.match(/refactor|restructure|reorganize|cleanup|clean/)) {
    return 'refactor'
  }

  // Performance indicators
  if (text.match(/perf|performance|optimize|speed|fast/)) {
    return 'perf'
  }

  // Test indicators
  if (text.match(/test|spec|unit|integration/)) {
    return 'test'
  }

  // Build indicators
  if (text.match(/build|deploy|package|bundle|webpack|vite/)) {
    return 'build'
  }

  // CI indicators
  if (text.match(/ci|pipeline|action|workflow|github/)) {
    return 'ci'
  }

  // Chore indicators
  if (text.match(/chore|update|upgrade|dependency|deps|config/)) {
    return 'chore'
  }

  return null
}

/**
 * Generate enhanced commit message context from branch intelligence
 */
export function generateCommitContextFromBranch(branchAnalysis, _changes = []) {
  if (!branchAnalysis || branchAnalysis.confidence < 20) {
    return ''
  }

  let context = '\n**Branch Context:**'

  if (branchAnalysis.type) {
    context += `\n- Inferred type: ${branchAnalysis.type}`
  }

  if (branchAnalysis.ticket) {
    context += `\n- Related ticket: ${branchAnalysis.ticket}`
  }

  if (branchAnalysis.description) {
    context += `\n- Branch description: ${branchAnalysis.description}`
  }

  context += `\n- Confidence: ${branchAnalysis.confidence}%`
  context += `\n- Detection patterns: ${branchAnalysis.patterns.join(', ')}`

  return context
}

/**
 * Get suggested commit type based on branch analysis and file changes
 */
export function getSuggestedCommitType(branchAnalysis, changes = []) {
  // High confidence branch type takes precedence
  if (branchAnalysis?.type && branchAnalysis.confidence >= 70) {
    return {
      type: branchAnalysis.type,
      source: 'branch',
      confidence: branchAnalysis.confidence,
    }
  }

  // Analyze file changes to infer type
  const changeAnalysis = analyzeChangesForType(changes)

  // Medium confidence branch type combined with file analysis
  if (
    branchAnalysis?.type &&
    branchAnalysis.confidence >= 40 &&
    changeAnalysis.type === branchAnalysis.type
  ) {
    return {
      type: branchAnalysis.type,
      source: 'branch+files',
      confidence: Math.min(95, branchAnalysis.confidence + 20),
    }
  }

  // Use file-based analysis
  if (changeAnalysis.confidence >= 60) {
    return changeAnalysis
  }

  // Low confidence branch type as fallback
  if (branchAnalysis?.type) {
    return {
      type: branchAnalysis.type,
      source: 'branch-fallback',
      confidence: branchAnalysis.confidence,
    }
  }

  // Default fallback
  return {
    type: 'feat',
    source: 'default',
    confidence: 20,
  }
}

/**
 * Analyze file changes to suggest commit type
 */
function analyzeChangesForType(changes) {
  if (!changes || changes.length === 0) {
    return { type: 'feat', source: 'default', confidence: 20 }
  }

  const categories = {
    docs: 0,
    test: 0,
    config: 0,
    source: 0,
    style: 0,
  }

  // Categorize files
  changes.forEach((change) => {
    const path = change.path || change.filePath || ''
    const ext = path.split('.').pop()?.toLowerCase() || ''

    if (path.match(/readme|doc|\.md$|guide|tutorial/i)) {
      categories.docs++
    } else if (path.match(/test|spec|\.test\.|\.spec\./i)) {
      categories.test++
    } else if (path.match(/config|\.json$|\.yaml$|\.yml$|\.toml$|\.ini$/i)) {
      categories.config++
    } else if (path.match(/\.css$|\.scss$|\.less$|\.styl$/i)) {
      categories.style++
    } else if (['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp'].includes(ext)) {
      categories.source++
    }
  })

  const total = Object.values(categories).reduce((a, b) => a + b, 0)

  if (total === 0) {
    return { type: 'feat', source: 'files-default', confidence: 30 }
  }

  // Determine primary type
  if (categories.docs / total > 0.6) {
    return { type: 'docs', source: 'files', confidence: 80 }
  }

  if (categories.test / total > 0.6) {
    return { type: 'test', source: 'files', confidence: 80 }
  }

  if (categories.config / total > 0.6) {
    return { type: 'chore', source: 'files', confidence: 70 }
  }

  if (categories.style / total > 0.6) {
    return { type: 'style', source: 'files', confidence: 75 }
  }

  // Mixed or source-heavy changes - look at modification patterns
  const hasNewFiles = changes.some((c) => c.status === 'A' || c.status === '??')
  const hasDeletedFiles = changes.some((c) => c.status === 'D')

  if (hasNewFiles && !hasDeletedFiles) {
    return { type: 'feat', source: 'files-new', confidence: 65 }
  }

  if (hasDeletedFiles) {
    return { type: 'refactor', source: 'files-deleted', confidence: 60 }
  }

  // Default to feat for source changes
  return { type: 'feat', source: 'files-mixed', confidence: 50 }
}

// ========================================
// CHANGELOG UTILITIES (EXTENDED)
// ========================================

// Additional changelog utility functions
