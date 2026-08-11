/**
 * Color utility for consistent styled output across the application
 * Uses ANSI escape codes for maximum compatibility
 */

// ANSI escape codes for colors and styles
import process from 'node:process'

const ansiColors = {
  // Reset
  reset: '\x1b[0m',

  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  grey: '\x1b[90m',

  // Bright colors
  redBright: '\x1b[91m',
  greenBright: '\x1b[92m',
  yellowBright: '\x1b[93m',
  blueBright: '\x1b[94m',
  magentaBright: '\x1b[95m',
  cyanBright: '\x1b[96m',
  whiteBright: '\x1b[97m',

  // Styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',
  strikethrough: '\x1b[9m',
}

/**
 * Color utility class
 */
class Colors {
  [key: string]: any
  constructor() {
    this.enabled = this.shouldEnableColors()
    this.setupColors()
  }

  shouldEnableColors() {
    // Don't use colors if explicitly disabled
    if (process.env.NO_COLOR || process.env.NODE_DISABLE_COLORS) {
      return false
    }

    if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') {
      return true
    }

    // Don't use colors in dumb terminals
    if (process.env.TERM === 'dumb') {
      return false
    }

    // Allow explicit TERM capabilities to enable colors even in non-TTY test environments.
    if (process.env.TERM && process.env.TERM !== 'unknown') {
      return true
    }

    // Don't use colors if not in a TTY when there is no stronger signal.
    if (process.stdout && process.stdout.isTTY === false) {
      return false
    }

    // Enable colors by default
    return true
  }

  colorize(color, text) {
    if (!(this.enabled && text)) {
      return text
    }
    return `${ansiColors[color] || ''}${text}${ansiColors.reset}`
  }

  setupColors() {
    if (!this.enabled) {
      this.setupFallbackColors()
      return
    }

    // Status colors
    this.success = (text) => this.colorize('green', text)
    this.error = (text) => this.colorize('red', text)
    this.warning = (text) => this.colorize('yellow', text)
    this.info = (text) => this.colorize('blue', text)
    this.secondary = (text) => this.colorize('gray', text)
    this.highlight = (text) => this.colorize('cyan', text)
    this.bold = (text) => this.colorize('bold', text)
    this.dim = (text) => this.colorize('dim', text)

    // Semantic colors for changelog
    this.feature = (text) => this.colorize('greenBright', text)
    this.fix = (text) => this.colorize('redBright', text)
    this.security = (text) => this.colorize('magentaBright', text)
    this.breaking = (text) => this.colorize('bold', this.colorize('red', text))
    this.docs = (text) => this.colorize('blueBright', text)
    this.style = (text) => this.colorize('magenta', text)
    this.refactor = (text) => this.colorize('yellow', text)
    this.perf = (text) => this.colorize('cyan', text)
    this.test = (text) => this.colorize('blue', text)
    this.chore = (text) => this.colorize('gray', text)

    // UI elements
    this.header = (text) => this.colorize('underline', this.colorize('bold', text))
    this.subheader = (text) => this.colorize('bold', text)
    this.label = (text) => this.colorize('cyan', text)
    this.value = (text) => this.colorize('white', text)
    this.code = (text) => this.colorize('inverse', text)
    this.file = (text) => this.colorize('yellowBright', text)
    this.path = (text) => this.colorize('green', text)
    this.hash = (text) => this.colorize('magenta', text)

    // Metrics and stats
    this.metric = (text) => this.colorize('cyan', text)
    this.number = (text) => this.colorize('yellowBright', text)
    this.percentage = (text) => this.colorize('green', text)

    // Risk levels
    this.riskLow = (text) => this.colorize('green', text)
    this.riskMedium = (text) => this.colorize('yellow', text)
    this.riskHigh = (text) => this.colorize('red', text)
    this.riskCritical = (text) =>
      this.colorize('inverse', this.colorize('bold', this.colorize('red', text)))

    // Impact levels
    this.impactMinimal = (text) => this.colorize('gray', text)
    this.impactLow = (text) => this.colorize('blue', text)
    this.impactMedium = (text) => this.colorize('yellow', text)
    this.impactHigh = (text) => this.colorize('red', text)
    this.impactCritical = (text) => this.colorize('bold', this.colorize('red', text))
  }

  setupFallbackColors() {
    // Fallback to identity functions when colors are disabled
    const identity = (text) => text

    // Status colors
    this.success = identity
    this.error = identity
    this.warning = identity
    this.info = identity
    this.secondary = identity
    this.highlight = identity
    this.bold = identity
    this.dim = identity

    // Semantic colors for changelog
    this.feature = identity
    this.fix = identity
    this.security = identity
    this.breaking = identity
    this.docs = identity
    this.style = identity
    this.refactor = identity
    this.perf = identity
    this.test = identity
    this.chore = identity

    // UI elements
    this.header = identity
    this.subheader = identity
    this.label = identity
    this.value = identity
    this.code = identity
    this.file = identity
    this.path = identity
    this.hash = identity

    // Metrics and stats
    this.metric = identity
    this.number = identity
    this.percentage = identity

    // Risk levels
    this.riskLow = identity
    this.riskMedium = identity
    this.riskHigh = identity
    this.riskCritical = identity

    // Impact levels
    this.impactMinimal = identity
    this.impactLow = identity
    this.impactMedium = identity
    this.impactHigh = identity
    this.impactCritical = identity
  }

  disable() {
    this.enabled = false
    this.setupFallbackColors()
  }

  enable() {
    this.enabled = true
    this.setupColors()
  }

  // Utility methods for common patterns
  emoji(text) {
    return text // Emojis work without colors
  }

  status(type, message) {
    const colorMap = {
      success: this.success,
      error: this.error,
      warning: this.warning,
      info: this.info,
    }

    const color = colorMap[type] || this.info
    return color(message)
  }

  commitType(type) {
    const colorMap = {
      feat: this.feature,
      fix: this.fix,
      security: this.security,
      breaking: this.breaking,
      docs: this.docs,
      style: this.style,
      refactor: this.refactor,
      perf: this.perf,
      test: this.test,
      chore: this.chore,
    }

    return (colorMap[type] || this.secondary)(type)
  }

  risk(level) {
    const colorMap = {
      low: this.riskLow,
      medium: this.riskMedium,
      high: this.riskHigh,
      critical: this.riskCritical,
    }

    return (colorMap[level] || this.secondary)(level.toUpperCase())
  }

  impact(level) {
    const colorMap = {
      minimal: this.impactMinimal,
      low: this.impactLow,
      medium: this.impactMedium,
      high: this.impactHigh,
      critical: this.impactCritical,
    }

    return (colorMap[level] || this.secondary)(level)
  }

  // Diff highlighting
  diffAdd(text) {
    return this.success(`+ ${text}`)
  }

  diffRemove(text) {
    return this.error(`- ${text}`)
  }

  diffContext(text) {
    return this.dim(`  ${text}`)
  }

  // Progress indicators
  progress(current, total, label = '') {
    if (total <= 0) {
      return `${this.info('[░░░░░░░░░░░░░░░░░░░░]')} ${this.percentage('0%')} ${label}`
    }

    const percentage = Math.max(0, Math.min(100, Math.round((current / total) * 100)))
    const filledBars = Math.max(0, Math.round(percentage / 5))
    const emptyBars = Math.max(0, 20 - filledBars)
    const bar = '█'.repeat(filledBars) + '░'.repeat(emptyBars)
    return `${this.info(`[${bar}]`)} ${this.percentage(`${percentage}%`)} ${label}`
  }

  // Helper to get actual visible length of string (without ANSI codes)
  getVisibleLength(str) {
    // Remove ANSI escape sequences to get actual visible length.
    const ansiPrefix = String.fromCharCode(27)
    const ansiPattern = new RegExp(`${ansiPrefix}\\[[0-9;]*m`, 'g')
    return str.replace(ansiPattern, '').length
  }

  // Box drawing for sections with dynamic width calculation
  box(title, content, minWidth = 60) {
    const lines = content.split('\n')
    const titleVisibleLength = this.getVisibleLength(title)

    // Calculate required width based on content
    const maxContentLength = Math.max(
      titleVisibleLength + 4, // title + padding
      ...lines.map((line) => this.getVisibleLength(line) + 4), // content + padding
      minWidth
    )

    const width = Math.min(maxContentLength, 80) // Cap at 80 chars for readability

    const topBorder = `┌${'─'.repeat(width - 2)}┐`
    const bottomBorder = `└${'─'.repeat(width - 2)}┘`

    // Title line with proper padding accounting for ANSI codes
    const titlePadding = width - titleVisibleLength - 3
    const titleLine = `│ ${this.header(title)}${' '.repeat(Math.max(0, titlePadding))}│`

    const contentLines = lines.map((line) => {
      const visibleLength = this.getVisibleLength(line)
      const padding = width - visibleLength - 4
      return `│ ${line}${' '.repeat(Math.max(0, padding))} │`
    })

    return [
      this.secondary(topBorder),
      titleLine,
      this.secondary(`├${'─'.repeat(width - 2)}┤`),
      ...contentLines,
      this.secondary(bottomBorder),
    ].join('\n')
  }

  // Quick access to common formatted messages
  successMessage(message) {
    return `${this.success('✅')} ${message}`
  }

  errorMessage(message) {
    return `${this.error('❌')} ${message}`
  }

  warningMessage(message) {
    return `${this.warning('⚠️')} ${message}`
  }

  infoMessage(message) {
    return `${this.info('ℹ️')} ${message}`
  }

  processingMessage(message) {
    return `${this.highlight('🔍')} ${message}`
  }

  aiMessage(message) {
    return `${this.highlight('🤖')} ${message}`
  }

  metricsMessage(message) {
    return `${this.metric('📊')} ${message}`
  }

  separator(char = '─', length = 50) {
    return this.dim(char.repeat(length))
  }

  sectionHeader(text) {
    return this.header(text)
  }

  // Format file lists with syntax highlighting
  formatFileList(files, maxDisplay = 10) {
    const displayed = files.slice(0, maxDisplay)
    const result = displayed.map((file) => {
      const ext = file.split('.').pop()?.toLowerCase()
      let color = this.file

      // Color by file type
      if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
        color = this.feature
      } else if (['css', 'scss', 'sass'].includes(ext)) {
        color = this.style
      } else if (['md', 'txt'].includes(ext)) {
        color = this.docs
      } else if (['json', 'yaml', 'yml'].includes(ext)) {
        color = this.warning
      } else if (['sql'].includes(ext)) {
        color = this.fix
      }

      return `  - ${color(file)}`
    })

    if (files.length > maxDisplay) {
      result.push(`  ${this.dim(`... and ${files.length - maxDisplay} more`)}`)
    }

    return result.join('\n')
  }

  // Format metrics table
  formatMetrics(metrics) {
    const entries = Object.entries(metrics)
    const maxKeyLength = Math.max(...entries.map(([k]) => k.length))

    return entries
      .map(([key, value]) => {
        const paddedKey = key.padEnd(maxKeyLength)
        return `${this.label(paddedKey)}: ${this.value(value)}`
      })
      .join('\n')
  }

  // Unicode symbols for cross-platform compatibility
  get symbols() {
    return {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ',
      arrow: '→',
      bullet: '•',
      check: '✓',
      cross: '✗',
      star: '★',
      heart: '♥',
      diamond: '♦',
      circle: '●',
      square: '■',
      triangle: '▲',
      play: '▶',
      pause: '⏸',
      stop: '⏹',
      refresh: '↻',
      sync: '⟲',
      upload: '↑',
      download: '↓',
      plus: '+',
      minus: '-',
      multiply: '×',
      divide: '÷',
      equals: '=',
      pipe: '|',
      hash: '#',
      at: '@',
      dollar: '$',
      percent: '%',
      ampersand: '&',
      question: '?',
      exclamation: '!',
      ellipsis: '…',
      middot: '·',
      section: '§',
      paragraph: '¶',
      copyright: '©',
      registered: '®',
      trademark: '™',
      degree: '°',
      plusminus: '±',
      micro: 'µ',
      alpha: 'α',
      beta: 'β',
      gamma: 'γ',
      delta: 'δ',
      lambda: 'λ',
      mu: 'μ',
      pi: 'π',
      sigma: 'σ',
      tau: 'τ',
      phi: 'φ',
      omega: 'ω',
    }
  }

  // Enhanced status messages with symbols
  statusSymbol(type, message) {
    const symbolMap = {
      success: this.success(this.symbols.success),
      error: this.error(this.symbols.error),
      warning: this.warning(this.symbols.warning),
      info: this.info(this.symbols.info),
      processing: this.highlight(this.symbols.refresh),
      ai: this.highlight('🤖'),
      metrics: this.metric('📊'),
    }

    const symbol = symbolMap[type] || symbolMap.info
    return `${symbol} ${message}`
  }

  // Gradient text support (will work with gradient-string if available)
  async gradient(text, colors = ['#FF6B6B', '#4ECDC4']) {
    try {
      // Try to use gradient-string if available
      const { default: gradient } = await import('gradient-string')
      return gradient(colors)(text)
    } catch {
      // Fallback to regular coloring
      return this.highlight(text)
    }
  }

  // Spinner-like text animation frames
  get spinnerFrames() {
    return ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  }

  // Loading dots animation frames
  get dotsFrames() {
    return ['   ', '.  ', '.. ', '...']
  }

  // Enhanced box with options
  boxed(content, options: Record<string, any> = {}) {
    const {
      title = '',
      padding = 1,
      margin = 0,
      borderStyle = 'single',
      borderColor = 'secondary',
      titleColor = 'header',
    } = options

    const borders = {
      single: {
        top: '─',
        bottom: '─',
        left: '│',
        right: '│',
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
      },
      double: {
        top: '═',
        bottom: '═',
        left: '║',
        right: '║',
        topLeft: '╔',
        topRight: '╗',
        bottomLeft: '╚',
        bottomRight: '╝',
      },
      rounded: {
        top: '─',
        bottom: '─',
        left: '│',
        right: '│',
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
      },
    }

    const border = borders[borderStyle] || borders.single
    const lines = content.split('\n')
    const maxContentLength = Math.max(...lines.map((line) => this.getVisibleLength(line)))
    const titleLength = title ? this.getVisibleLength(title) + 2 : 0
    const width = Math.max(maxContentLength, titleLength) + padding * 2

    const colorBorder = this[borderColor] || this.secondary
    const colorTitle = this[titleColor] || this.header

    const result: any[] = []

    // Top margin
    if (margin > 0) {
      result.push(
        ''
          .repeat(margin)
          .split('')
          .map(() => '')
          .join('\n')
      )
    }

    // Top border
    if (title) {
      const titlePadding = Math.max(0, width - titleLength)
      result.push(
        colorBorder(border.topLeft + border.top.repeat(2)) +
          ` ${colorTitle(title)} ` +
          colorBorder(border.top.repeat(titlePadding - 2) + border.topRight)
      )
    } else {
      result.push(colorBorder(border.topLeft + border.top.repeat(width) + border.topRight))
    }

    // Content
    lines.forEach((line) => {
      const contentPadding = Math.max(0, width - this.getVisibleLength(line))
      result.push(
        colorBorder(border.left) +
          ' '.repeat(padding) +
          line +
          ' '.repeat(contentPadding - padding) +
          colorBorder(border.right)
      )
    })

    // Bottom border
    result.push(colorBorder(border.bottomLeft + border.bottom.repeat(width) + border.bottomRight))

    // Bottom margin
    if (margin > 0) {
      result.push(
        ''
          .repeat(margin)
          .split('')
          .map(() => '')
          .join('\n')
      )
    }

    return result.join('\n')
  }

  // Table formatting helper
  table(data, options: Record<string, any> = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      return ''
    }

    const { headers = Object.keys(data[0]), align = 'left' } = options
    const rows = data.map((row) => headers.map((header) => String(row[header] || '')))

    // Calculate column widths
    const colWidths = headers.map((header, i) =>
      Math.max(header.length, ...rows.map((row) => this.getVisibleLength(row[i])))
    )

    const formatRow = (row, isHeader = false) => {
      const cells = row.map((cell, i) => {
        const width = colWidths[i]
        const visibleLength = this.getVisibleLength(String(cell))
        const paddingNeeded = width - visibleLength

        if (align === 'right') {
          return ' '.repeat(paddingNeeded) + cell
        }
        if (align === 'center') {
          const leftPad = Math.floor(paddingNeeded / 2)
          const rightPad = paddingNeeded - leftPad
          return ' '.repeat(leftPad) + cell + ' '.repeat(rightPad)
        }
        return cell + ' '.repeat(paddingNeeded)
      })

      const colorFunc = isHeader ? this.header : this.secondary
      return colorFunc('│') + cells.map((cell) => ` ${cell} `).join(colorFunc('│')) + colorFunc('│')
    }

    const separator = this.secondary(`├${colWidths.map((w) => '─'.repeat(w + 2)).join('┼')}┤`)
    const topBorder = this.secondary(`┌${colWidths.map((w) => '─'.repeat(w + 2)).join('┬')}┐`)
    const bottomBorder = this.secondary(`└${colWidths.map((w) => '─'.repeat(w + 2)).join('┴')}┘`)

    return [
      topBorder,
      formatRow(headers, true),
      separator,
      ...rows.map((row) => formatRow(row)),
      bottomBorder,
    ].join('\n')
  }
}

// Export singleton instance
const colors = new Colors()

export default colors
