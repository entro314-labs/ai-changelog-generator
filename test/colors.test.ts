import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import colors from '../src/shared/constants/colors.js'

describe('Enhanced Colors System', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    // Reset colors to enabled state
    colors.enable()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('Color Detection', () => {
    it('should detect color support correctly', () => {
      expect(colors.enabled).toBe(true)
    })

    it('should disable colors when NO_COLOR is set', () => {
      process.env.NO_COLOR = '1'
      const testColors = new colors.constructor()
      expect(testColors.enabled).toBe(false)
    })

    it('should disable colors when NODE_DISABLE_COLORS is set', () => {
      process.env.NODE_DISABLE_COLORS = '1'
      const testColors = new colors.constructor()
      expect(testColors.enabled).toBe(false)
    })

    it('should disable colors in dumb terminal', () => {
      process.env.TERM = 'dumb'
      const testColors = new colors.constructor()
      expect(testColors.enabled).toBe(false)
    })
  })

  describe('Basic Color Functions', () => {
    it('should apply basic colors', () => {
      expect(colors.success('test')).toContain('test')
      expect(colors.error('test')).toContain('test')
      expect(colors.warning('test')).toContain('test')
      expect(colors.info('test')).toContain('test')
      expect(colors.highlight('test')).toContain('test')
    })

    it('should apply text styles', () => {
      expect(colors.bold('test')).toContain('test')
      expect(colors.dim('test')).toContain('test')
      expect(colors.secondary('test')).toContain('test')
    })

    it('should handle empty strings gracefully', () => {
      expect(colors.success('')).toBe('')
      expect(colors.error('')).toBe('')
      expect(colors.bold(null)).toBe(null)
      expect(colors.dim(undefined)).toBe(undefined)
    })
  })

  describe('Semantic Colors', () => {
    it('should apply commit type colors', () => {
      expect(colors.feature('feature')).toContain('feature')
      expect(colors.fix('fix')).toContain('fix')
      expect(colors.security('security')).toContain('security')
      expect(colors.breaking('breaking')).toContain('breaking')
      expect(colors.docs('docs')).toContain('docs')
      expect(colors.style('style')).toContain('style')
      expect(colors.refactor('refactor')).toContain('refactor')
      expect(colors.perf('perf')).toContain('perf')
      expect(colors.test('test')).toContain('test')
      expect(colors.chore('chore')).toContain('chore')
    })

    it('should apply UI element colors', () => {
      expect(colors.header('header')).toContain('header')
      expect(colors.subheader('subheader')).toContain('subheader')
      expect(colors.label('label')).toContain('label')
      expect(colors.value('value')).toContain('value')
      expect(colors.code('code')).toContain('code')
      expect(colors.file('file')).toContain('file')
      expect(colors.path('path')).toContain('path')
      expect(colors.hash('hash')).toContain('hash')
    })

    it('should apply metrics colors', () => {
      expect(colors.metric('metric')).toContain('metric')
      expect(colors.number('123')).toContain('123')
      expect(colors.percentage('50%')).toContain('50%')
    })

    it('should apply risk level colors', () => {
      expect(colors.riskLow('low')).toContain('low')
      expect(colors.riskMedium('medium')).toContain('medium')
      expect(colors.riskHigh('high')).toContain('high')
      expect(colors.riskCritical('critical')).toContain('critical')
    })

    it('should apply impact level colors', () => {
      expect(colors.impactMinimal('minimal')).toContain('minimal')
      expect(colors.impactLow('low')).toContain('low')
      expect(colors.impactMedium('medium')).toContain('medium')
      expect(colors.impactHigh('high')).toContain('high')
      expect(colors.impactCritical('critical')).toContain('critical')
    })
  })

  describe('Unicode Symbols', () => {
    it('should provide basic symbols', () => {
      expect(colors.symbols.success).toBe('✓')
      expect(colors.symbols.error).toBe('✗')
      expect(colors.symbols.warning).toBe('⚠')
      expect(colors.symbols.info).toBe('ℹ')
      expect(colors.symbols.arrow).toBe('→')
      expect(colors.symbols.bullet).toBe('•')
    })

    it('should provide navigation symbols', () => {
      expect(colors.symbols.play).toBe('▶')
      expect(colors.symbols.pause).toBe('⏸')
      expect(colors.symbols.stop).toBe('⏹')
      expect(colors.symbols.refresh).toBe('↻')
      expect(colors.symbols.sync).toBe('⟲')
    })

    it('should provide mathematical symbols', () => {
      expect(colors.symbols.plus).toBe('+')
      expect(colors.symbols.minus).toBe('-')
      expect(colors.symbols.multiply).toBe('×')
      expect(colors.symbols.degree).toBe('°')
      expect(colors.symbols.micro).toBe('µ')
      expect(colors.symbols.pi).toBe('π')
    })
  })

  describe('Enhanced Status Messages', () => {
    it('should create status messages with symbols', () => {
      expect(colors.statusSymbol('success', 'Done')).toContain('✓')
      expect(colors.statusSymbol('success', 'Done')).toContain('Done')

      expect(colors.statusSymbol('error', 'Failed')).toContain('✗')
      expect(colors.statusSymbol('error', 'Failed')).toContain('Failed')

      expect(colors.statusSymbol('warning', 'Caution')).toContain('⚠')
      expect(colors.statusSymbol('warning', 'Caution')).toContain('Caution')

      expect(colors.statusSymbol('info', 'Info')).toContain('ℹ')
      expect(colors.statusSymbol('info', 'Info')).toContain('Info')

      expect(colors.statusSymbol('processing', 'Working')).toContain('↻')
      expect(colors.statusSymbol('processing', 'Working')).toContain('Working')
    })

    it('should fallback to info for unknown status types', () => {
      const result = colors.statusSymbol('unknown', 'Message')
      expect(result).toContain('ℹ')
      expect(result).toContain('Message')
    })
  })

  describe('Spinner Frames', () => {
    it('should provide spinner animation frames', () => {
      const frames = colors.spinnerFrames
      expect(Array.isArray(frames)).toBe(true)
      expect(frames.length).toBe(10)
      expect(frames[0]).toBe('⠋')
      expect(frames[9]).toBe('⠏')
    })

    it('should provide dots animation frames', () => {
      const frames = colors.dotsFrames
      expect(Array.isArray(frames)).toBe(true)
      expect(frames.length).toBe(4)
      expect(frames[0]).toBe('   ')
      expect(frames[3]).toBe('...')
    })
  })

  describe('Box Drawing', () => {
    it('should create basic boxes', () => {
      const box = colors.boxed('Simple content')
      expect(box).toContain('Simple content')
      expect(box).toContain('┌')
      expect(box).toContain('└')
    })

    it('should create boxes with titles', () => {
      const box = colors.boxed('Content here', { title: 'Test Title' })
      expect(box).toContain('Content here')
      expect(box).toContain('Test Title')
    })

    it('should support different border styles', () => {
      const singleBox = colors.boxed('Content', { borderStyle: 'single' })
      const doubleBox = colors.boxed('Content', { borderStyle: 'double' })
      const roundedBox = colors.boxed('Content', { borderStyle: 'rounded' })

      expect(singleBox).toContain('┌')
      expect(doubleBox).toContain('╔')
      expect(roundedBox).toContain('╭')
    })

    it('should handle multiline content', () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3'
      const box = colors.boxed(multilineContent)

      expect(box).toContain('Line 1')
      expect(box).toContain('Line 2')
      expect(box).toContain('Line 3')
    })

    it('should calculate width correctly', () => {
      const shortBox = colors.boxed('Short')
      const longBox = colors.boxed('This is a much longer line of content')

      // Both should be properly formatted
      expect(shortBox.split('\n')[0].length).toBeGreaterThan(10)
      expect(longBox.split('\n')[0].length).toBeGreaterThan(30)
    })
  })

  describe('Table Formatting', () => {
    it('should create tables from data arrays', () => {
      const data = [
        { name: 'John', age: 30, role: 'Developer' },
        { name: 'Jane', age: 25, role: 'Designer' },
      ]

      const table = colors.table(data)
      expect(table).toContain('John')
      expect(table).toContain('Jane')
      expect(table).toContain('30')
      expect(table).toContain('25')
      expect(table).toContain('Developer')
      expect(table).toContain('Designer')
    })

    it('should handle custom headers', () => {
      const data = [
        { firstName: 'John', years: 30 },
        { firstName: 'Jane', years: 25 },
      ]

      const table = colors.table(data, {
        headers: ['firstName', 'years'],
      })

      expect(table).toContain('firstName')
      expect(table).toContain('years')
    })

    it('should support different alignments', () => {
      const data = [{ name: 'Test', value: 123 }]

      const leftTable = colors.table(data, { align: 'left' })
      const rightTable = colors.table(data, { align: 'right' })
      const centerTable = colors.table(data, { align: 'center' })

      // All should contain the data
      ;[leftTable, rightTable, centerTable].forEach((table) => {
        expect(table).toContain('Test')
        expect(table).toContain('123')
      })
    })

    it('should handle empty arrays', () => {
      expect(colors.table([])).toBe('')
    })

    it('should handle arrays with missing properties', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane' }, // Missing age
      ]

      const table = colors.table(data)
      expect(table).toContain('John')
      expect(table).toContain('Jane')
      expect(table).toContain('30')
    })
  })

  describe('Utility Methods', () => {
    it('should handle emoji passthrough', () => {
      expect(colors.emoji('🎉')).toBe('🎉')
      expect(colors.emoji('🚀 Rocket')).toBe('🚀 Rocket')
    })

    it('should format status messages', () => {
      expect(colors.status('success', 'All good')).toContain('All good')
      expect(colors.status('error', 'Something failed')).toContain('Something failed')
      expect(colors.status('warning', 'Be careful')).toContain('Be careful')
      expect(colors.status('info', 'FYI')).toContain('FYI')
    })

    it('should handle unknown status types', () => {
      const result = colors.status('unknown', 'Message')
      expect(result).toContain('Message')
    })

    it('should format commit types', () => {
      expect(colors.commitType('feat')).toContain('feat')
      expect(colors.commitType('fix')).toContain('fix')
      expect(colors.commitType('docs')).toContain('docs')
      expect(colors.commitType('unknown')).toContain('unknown')
    })

    it('should format risk levels', () => {
      expect(colors.risk('low')).toContain('LOW')
      expect(colors.risk('medium')).toContain('MEDIUM')
      expect(colors.risk('high')).toContain('HIGH')
      expect(colors.risk('critical')).toContain('CRITICAL')
    })

    it('should format impact levels', () => {
      expect(colors.impact('minimal')).toContain('minimal')
      expect(colors.impact('low')).toContain('low')
      expect(colors.impact('medium')).toContain('medium')
      expect(colors.impact('high')).toContain('high')
      expect(colors.impact('critical')).toContain('critical')
    })
  })

  describe('Diff Highlighting', () => {
    it('should format diff additions', () => {
      const result = colors.diffAdd('+ New line')
      expect(result).toContain('+ New line')
      expect(result).toContain('+ ')
    })

    it('should format diff removals', () => {
      const result = colors.diffRemove('- Removed line')
      expect(result).toContain('- Removed line')
      expect(result).toContain('- ')
    })

    it('should format diff context', () => {
      const result = colors.diffContext('  Context line')
      expect(result).toContain('  Context line')
      expect(result).toContain('  ')
    })
  })

  describe('Progress Indicators', () => {
    it('should create progress bars', () => {
      const progress = colors.progress(50, 100, 'Processing')
      expect(progress).toContain('50%')
      expect(progress).toContain('Processing')
      expect(progress).toContain('[')
      expect(progress).toContain(']')
    })

    it('should handle edge cases for progress', () => {
      expect(colors.progress(0, 100)).toContain('0%')
      expect(colors.progress(100, 100)).toContain('100%')
      expect(colors.progress(150, 100)).toContain('100%') // Should cap at 100%
    })

    it('should work with zero total', () => {
      const progress = colors.progress(0, 0)
      expect(progress).toBeDefined()
      expect(typeof progress).toBe('string')
    })
  })

  describe('Visible Length Calculation', () => {
    it('should calculate visible length correctly', () => {
      expect(colors.getVisibleLength('plain text')).toBe(10)
      expect(colors.getVisibleLength(colors.bold('bold text'))).toBe(9)
      expect(colors.getVisibleLength(colors.success('✓ success'))).toBe(9)
    })

    it('should handle empty strings', () => {
      expect(colors.getVisibleLength('')).toBe(0)
    })

    it('should handle strings with multiple ANSI codes', () => {
      const complexString = colors.bold(colors.success('Complex'))
      expect(colors.getVisibleLength(complexString)).toBe(7)
    })
  })

  describe('Formatted Messages', () => {
    it('should create formatted success messages', () => {
      const result = colors.successMessage('Task completed')
      expect(result).toContain('✅')
      expect(result).toContain('Task completed')
    })

    it('should create formatted error messages', () => {
      const result = colors.errorMessage('Task failed')
      expect(result).toContain('❌')
      expect(result).toContain('Task failed')
    })

    it('should create formatted warning messages', () => {
      const result = colors.warningMessage('Be careful')
      expect(result).toContain('⚠️')
      expect(result).toContain('Be careful')
    })

    it('should create formatted info messages', () => {
      const result = colors.infoMessage('Information')
      expect(result).toContain('ℹ️')
      expect(result).toContain('Information')
    })

    it('should create formatted processing messages', () => {
      const result = colors.processingMessage('Working...')
      expect(result).toContain('🔍')
      expect(result).toContain('Working...')
    })

    it('should create formatted AI messages', () => {
      const result = colors.aiMessage('AI response')
      expect(result).toContain('🤖')
      expect(result).toContain('AI response')
    })

    it('should create formatted metrics messages', () => {
      const result = colors.metricsMessage('Stats updated')
      expect(result).toContain('📊')
      expect(result).toContain('Stats updated')
    })
  })

  describe('File List Formatting', () => {
    it('should format file lists with syntax highlighting', () => {
      const files = [
        'src/component.tsx',
        'styles/main.scss',
        'docs/README.md',
        'package.json',
        'database.sql',
      ]

      const result = colors.formatFileList(files)
      expect(result).toContain('component.tsx')
      expect(result).toContain('main.scss')
      expect(result).toContain('README.md')
      expect(result).toContain('package.json')
      expect(result).toContain('database.sql')
    })

    it('should limit file display and show more indicator', () => {
      const manyFiles = Array.from({ length: 15 }, (_, i) => `file${i}.js`)
      const result = colors.formatFileList(manyFiles, 5)

      expect(result).toContain('file0.js')
      expect(result).toContain('file4.js')
      expect(result).toContain('... and 10 more')
      expect(result).not.toContain('file14.js')
    })

    it('should handle empty file lists', () => {
      const result = colors.formatFileList([])
      expect(result).toBe('')
    })
  })

  describe('Metrics Formatting', () => {
    it('should format metrics with proper alignment', () => {
      const metrics = {
        Short: 'value1',
        'Much Longer Key': 'value2',
        Key: 'value3',
      }

      const result = colors.formatMetrics(metrics)
      expect(result).toContain('Short')
      expect(result).toContain('Much Longer Key')
      expect(result).toContain('value1')
      expect(result).toContain('value2')
      expect(result).toContain('value3')
    })

    it('should handle empty metrics', () => {
      const result = colors.formatMetrics({})
      expect(result).toBe('')
    })
  })

  describe('Separators and Headers', () => {
    it('should create separators', () => {
      const separator = colors.separator()
      expect(separator).toContain('─')
      expect(separator.length).toBeGreaterThan(10)
    })

    it('should create custom separators', () => {
      const separator = colors.separator('=', 20)
      expect(separator).toContain('=')
      expect(separator.length).toBeLessThanOrEqual(50) // Account for color codes
    })

    it('should create section headers', () => {
      const header = colors.sectionHeader('Test Section')
      expect(header).toContain('Test Section')
    })
  })

  describe('Disabled Colors Mode', () => {
    it('should return plain text when colors are disabled', () => {
      colors.disable()

      expect(colors.success('test')).toBe('test')
      expect(colors.error('test')).toBe('test')
      expect(colors.bold('test')).toBe('test')
      expect(colors.highlight('test')).toBe('test')
    })

    it('should still provide symbols when colors are disabled', () => {
      colors.disable()

      expect(colors.symbols.success).toBe('✓')
      expect(colors.symbols.error).toBe('✗')
    })

    it('should still format status messages when colors are disabled', () => {
      colors.disable()

      const result = colors.statusSymbol('success', 'Done')
      expect(result).toContain('✓')
      expect(result).toContain('Done')
    })
  })

  describe('Re-enabling Colors', () => {
    it('should re-enable colors after being disabled', () => {
      colors.disable()
      expect(colors.success('test')).toBe('test')

      colors.enable()
      expect(colors.success('test')).toContain('test')
      expect(colors.success('test')).not.toBe('test') // Should have color codes
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => colors.success(null)).not.toThrow()
      expect(() => colors.error(undefined)).not.toThrow()
      expect(() => colors.bold('')).not.toThrow()
    })

    it('should handle very long content', () => {
      const longText = 'x'.repeat(1000)
      expect(() => colors.success(longText)).not.toThrow()
      expect(() => colors.boxed(longText)).not.toThrow()
    })

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+{}|:<>?[];\'",./'
      expect(() => colors.success(specialChars)).not.toThrow()
      expect(colors.success(specialChars)).toContain(specialChars)
    })

    it('should handle unicode characters', () => {
      const unicode = '🚀 🎉 ✨ 💫 🌟'
      expect(() => colors.success(unicode)).not.toThrow()
      expect(colors.success(unicode)).toContain(unicode)
    })
  })
})
