/**
 * Modern CLI UI utilities for enhanced visual feedback
 * Provides loading indicators, progress bars, and modern CLI aesthetics
 */

import process from 'node:process'

import colors from '../constants/colors.js'

/**
 * Simple spinner implementation for loading states
 */
export class SimpleSpinner {
  constructor(text = 'Loading...', interval = 80) {
    this.text = text
    this.interval = interval
    this.frames = colors.spinnerFrames
    this.currentFrame = 0
    this.timer = null
    this.isSpinning = false
  }

  start() {
    if (this.isSpinning) {
      return this
    }

    this.isSpinning = true
    this.timer = setInterval(() => {
      const frame = this.frames[this.currentFrame]
      process.stdout.write(`\r${colors.highlight(frame)} ${this.text}`)
      this.currentFrame = (this.currentFrame + 1) % this.frames.length
    }, this.interval)

    return this
  }

  stop(finalText = null) {
    if (!this.isSpinning) {
      return this
    }

    clearInterval(this.timer)
    this.timer = null
    this.isSpinning = false

    if (finalText) {
      process.stdout.write(`\r${finalText}\n`)
    } else {
      process.stdout.write(`\r${' '.repeat(this.text.length + 2)}\r`)
    }

    return this
  }

  succeed(text = null) {
    return this.stop(colors.statusSymbol('success', text || this.text))
  }

  fail(text = null) {
    return this.stop(colors.statusSymbol('error', text || this.text))
  }

  warn(text = null) {
    return this.stop(colors.statusSymbol('warning', text || this.text))
  }

  info(text = null) {
    return this.stop(colors.statusSymbol('info', text || this.text))
  }
}

/**
 * Progress bar for long-running operations
 */
export class ProgressBar {
  constructor(total, width = 40, options = {}) {
    this.total = total
    this.current = 0
    this.width = width
    this.startTime = Date.now()

    const {
      format = '{bar} {percentage}% | {current}/{total} | ETA: {eta}s',
      complete = '█',
      incomplete = '░',
      renderThrottle = 100,
    } = options

    this.format = format
    this.complete = complete
    this.incomplete = incomplete
    this.renderThrottle = renderThrottle
    this.lastRender = 0
  }

  update(current, label = '') {
    this.current = Math.min(current, this.total)

    const now = Date.now()
    if (now - this.lastRender < this.renderThrottle && this.current < this.total) {
      return
    }
    this.lastRender = now

    const percentage = Math.floor((this.current / this.total) * 100)
    const filledWidth = Math.floor((this.current / this.total) * this.width)
    const emptyWidth = this.width - filledWidth

    const bar =
      colors.success(this.complete.repeat(filledWidth)) +
      colors.dim(this.incomplete.repeat(emptyWidth))

    // Calculate ETA
    const elapsed = (now - this.startTime) / 1000
    const rate = this.current / elapsed
    const eta = rate > 0 ? Math.ceil((this.total - this.current) / rate) : 0

    let output = this.format
      .replace('{bar}', bar)
      .replace('{percentage}', percentage.toString().padStart(3))
      .replace('{current}', this.current.toString())
      .replace('{total}', this.total.toString())
      .replace('{eta}', eta.toString())

    if (label) {
      output += ` | ${label}`
    }

    process.stdout.write(`\r${output}`)

    if (this.current >= this.total) {
      process.stdout.write('\n')
    }
  }

  increment(label = '') {
    this.update(this.current + 1, label)
  }

  finish(message = '') {
    this.update(this.total)
    if (message) {
      console.log(colors.statusSymbol('success', message))
    }
  }
}

/**
 * Multi-line progress display for multiple concurrent operations
 */
export class MultiProgress {
  constructor() {
    this.bars = new Map()
    this.isActive = false
  }

  create(id, total, label = '', options = {}) {
    const bar = new ProgressBar(total, options.width || 30, {
      ...options,
      format: `${label.padEnd(20)} {bar} {percentage}% | {current}/{total}`,
    })

    this.bars.set(id, { bar, label, lastOutput: '' })
    return bar
  }

  update(id, current, label = '') {
    const entry = this.bars.get(id)
    if (!entry) {
      return
    }

    entry.bar.update(current, label)
  }

  remove(id, finalMessage = '') {
    const entry = this.bars.get(id)
    if (!entry) {
      return
    }

    this.bars.delete(id)
    if (finalMessage) {
      console.log(colors.statusSymbol('success', `${entry.label}: ${finalMessage}`))
    }
  }

  clear() {
    this.bars.clear()
  }
}

/**
 * Enhanced console with better formatting
 */
export class EnhancedConsole {
  static log(message, type = 'info') {
    console.log(colors.statusSymbol(type, message))
  }

  static success(message) {
    EnhancedConsole.log(message, 'success')
  }

  static error(message) {
    EnhancedConsole.log(message, 'error')
  }

  static warn(message) {
    EnhancedConsole.log(message, 'warning')
  }

  static info(message) {
    EnhancedConsole.log(message, 'info')
  }

  static processing(message) {
    EnhancedConsole.log(message, 'processing')
  }

  static ai(message) {
    EnhancedConsole.log(message, 'ai')
  }

  static metrics(data, title = 'Metrics') {
    if (typeof data === 'string') {
      EnhancedConsole.log(data, 'metrics')
    } else if (data && Object.keys(data).length > 0) {
      EnhancedConsole.section(title)
      console.log(colors.formatMetrics(data))
    }
  }

  static section(title, content = '') {
    console.log(`\n${colors.sectionHeader(title)}`)
    console.log(colors.separator('─', 50))
    if (content) {
      console.log(content)
    }
  }

  static box(title, content, options = {}) {
    console.log(colors.boxed(content, { title, ...options }))
  }

  static table(data, options = {}) {
    if (data && data.length > 0) {
      console.log(colors.table(data, options))
    }
  }

  static fileList(files, title = 'Files') {
    if (files && files.length > 0) {
      EnhancedConsole.section(title)
      console.log(colors.formatFileList(files))
    }
  }

  static divider(char = '─', length = 60) {
    console.log(colors.separator(char, length))
  }

  static space(lines = 1) {
    console.log('\n'.repeat(lines - 1))
  }
}

/**
 * Task list display for showing progress on multiple items
 */
export class TaskList {
  constructor(tasks = []) {
    this.tasks = tasks.map((task) => ({
      text: task,
      status: 'pending',
      startTime: null,
      endTime: null,
    }))
    this.currentIndex = -1
  }

  add(task) {
    this.tasks.push({
      text: task,
      status: 'pending',
      startTime: null,
      endTime: null,
    })
  }

  start(index) {
    if (index < 0 || index >= this.tasks.length) {
      return
    }

    this.currentIndex = index
    this.tasks[index].status = 'running'
    this.tasks[index].startTime = Date.now()
    this.render()
  }

  complete(index, message = '') {
    if (index < 0 || index >= this.tasks.length) {
      return
    }

    this.tasks[index].status = 'completed'
    this.tasks[index].endTime = Date.now()
    if (message) {
      this.tasks[index].text += ` (${message})`
    }
    this.render()
  }

  fail(index, message = '') {
    if (index < 0 || index >= this.tasks.length) {
      return
    }

    this.tasks[index].status = 'failed'
    this.tasks[index].endTime = Date.now()
    if (message) {
      this.tasks[index].text += ` (${colors.error(message)})`
    }
    this.render()
  }

  render() {
    // Clear previous output
    if (this.lastRenderHeight) {
      process.stdout.write(`\u001b[${this.lastRenderHeight}A`)
      process.stdout.write('\u001b[0J')
    }

    const output = this.tasks
      .map((task, _index) => {
        let symbol
        let color

        switch (task.status) {
          case 'completed':
            symbol = colors.symbols.success
            color = colors.success
            break
          case 'failed':
            symbol = colors.symbols.error
            color = colors.error
            break
          case 'running':
            symbol = colors.symbols.refresh
            color = colors.highlight
            break
          default:
            symbol = colors.symbols.bullet
            color = colors.dim
        }

        return `${color(symbol)} ${task.text}`
      })
      .join('\n')

    console.log(output)
    this.lastRenderHeight = this.tasks.length
  }

  summary() {
    const completed = this.tasks.filter((t) => t.status === 'completed').length
    const failed = this.tasks.filter((t) => t.status === 'failed').length
    const total = this.tasks.length

    console.log(`\n${colors.separator('─', 50)}`)
    console.log(
      colors.statusSymbol('info', `Tasks completed: ${colors.success(completed)}/${total}`)
    )

    if (failed > 0) {
      console.log(colors.statusSymbol('error', `Tasks failed: ${colors.error(failed)}`))
    }
  }
}

/**
 * Utility functions for common CLI patterns
 */
export const cliUtils = {
  // Wait for user input
  async waitForKey(message = 'Press any key to continue...') {
    console.log(colors.dim(message))
    process.stdin.setRawMode(true)
    process.stdin.resume()

    return new Promise((resolve) => {
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        resolve()
      })
    })
  },

  // Clear screen
  clear() {
    process.stdout.write('\u001b[2J\u001b[0;0H')
  },

  // Move cursor up
  cursorUp(lines = 1) {
    process.stdout.write(`\u001b[${lines}A`)
  },

  // Clear current line
  clearLine() {
    process.stdout.write('\u001b[0K')
  },

  // Format duration
  formatDuration(ms) {
    if (ms <= 0) {
      return '0s'
    }

    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  },

  // Format bytes
  formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes <= 0 || !Number.isFinite(bytes)) {
      return '0B'
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round((bytes / 1024 ** i) * 100) / 100}${sizes[i]}`
  },
}
