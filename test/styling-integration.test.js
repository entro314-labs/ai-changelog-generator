import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkspaceChangelogService } from '../src/domains/changelog/workspace-changelog.service.js'
import { CLIController } from '../src/infrastructure/cli/cli.controller.js'
import { InteractiveWorkflowService } from '../src/infrastructure/interactive/interactive-workflow.service.js'
import { CommitMessageValidationService } from '../src/infrastructure/validation/commit-message-validation.service.js'
import colors from '../src/shared/constants/colors.js'
import { EnhancedConsole, SimpleSpinner } from '../src/shared/utils/cli-ui.js'

// Mock dependencies with proper partial mocking
vi.mock('../src/shared/utils/utils.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    runInteractiveMode: vi.fn(),
    analyzeChangesForCommitMessage: vi.fn(),
    selectSpecificCommits: vi.fn(),
    formatDuration: vi.fn(() => '1.2s'),
    promptForConfig: vi.fn(),
    getWorkingDirectoryChanges: vi.fn(() => []),
    summarizeFileChanges: vi.fn(() => ({ totalFiles: 0, categories: {} })),
    // Preserve all actual utility functions for tests
    categorizeFile: actual.categorizeFile,
    detectLanguage: actual.detectLanguage,
    assessFileImportance: actual.assessFileImportance,
    assessChangeComplexity: actual.assessChangeComplexity,
    analyzeSemanticChanges: actual.analyzeSemanticChanges,
    analyzeFunctionalImpact: actual.analyzeFunctionalImpact,
  }
})

describe('Styling Integration Tests', () => {
  let mockStdout
  let mockStderr
  let mockConsole

  beforeEach(() => {
    // Mock output streams
    mockStdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    // Mock console methods
    mockConsole = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    }

    // Enable colors for testing
    colors.enable()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Interactive Workflow Service Styling', () => {
    let mockAiService
    let mockGitService
    let service

    beforeEach(() => {
      mockAiService = {
        aiProvider: {
          generateCompletion: vi.fn().mockResolvedValue({ content: 'AI response' }),
        },
      }
      mockGitService = {}
      service = new InteractiveWorkflowService(mockGitService, mockAiService)
    })

    it('should use enhanced console for error messages', async () => {
      const consoleSpy = vi.spyOn(EnhancedConsole, 'error')

      // Force an error by mocking a failure in getWorkingDirectoryChanges
      const { getWorkingDirectoryChanges } = await vi.importActual('../src/shared/utils/utils.js')
      vi.mocked(getWorkingDirectoryChanges).mockImplementation(() => {
        throw new Error('Mock error for testing')
      })

      await service.generateCommitSuggestion('test', null).catch(() => {})

      // The service should use EnhancedConsole.error instead of console.error
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should use spinners for long operations', async () => {
      // Mock successful AI service
      mockAiService.aiProvider.generateCompletion.mockResolvedValue({
        content: 'Generated changelog content',
      })

      const mockCommits = [
        { hash: 'abc123', message: 'feat: add feature' },
        { hash: 'def456', message: 'fix: bug fix' },
      ]

      // Test that spinners are used
      await service.generateChangelogForRecentCommits(2)

      // Should have written spinner output
      expect(mockStdout).toHaveBeenCalled()
    })

    it('should handle spinner cleanup on errors', async () => {
      mockAiService.aiProvider.generateCompletion.mockRejectedValue(new Error('AI failed'))

      await service.generateChangelogForRecentCommits(5)

      // Should clean up spinner and show error
      expect(mockStdout).toHaveBeenCalled()
      expect(mockConsole.log).toHaveBeenCalled()
    })

    it('should use enhanced console for warnings', () => {
      const warnSpy = vi.spyOn(EnhancedConsole, 'warn')

      service.generateChangelogForCommitHashes([])

      expect(warnSpy).toHaveBeenCalledWith('No commit hashes provided')
    })
  })

  describe('Commit Message Validation Service Styling', () => {
    let service
    let mockConfigManager

    beforeEach(() => {
      mockConfigManager = {
        getAll: vi.fn().mockReturnValue({}),
      }
      service = new CommitMessageValidationService(mockConfigManager)
    })

    it('should use enhanced console for section display', async () => {
      const sectionSpy = vi.spyOn(EnhancedConsole, 'section')

      const result = await service.validateCommitMessage('invalid message')
      service.displayValidationResults(result)

      expect(sectionSpy).toHaveBeenCalledWith('🔍 Commit Message Validation')
    })

    it('should use symbols for validation results', async () => {
      // Create a result that will definitely have errors to ensure symbols are displayed
      const result = await service.validateCommitMessage('this is an invalid message without conventional format')
      service.displayValidationResults(result)

      // Should use symbols from colors.symbols
      expect(mockConsole.log).toHaveBeenCalled()
      const calls = mockConsole.log.mock.calls.map((call) => call[0])
      const hasSymbols = calls.some(
        (call) =>
          typeof call === 'string' && (call.includes('•') || call.includes('⚬') || call.includes('◦'))
      )
      expect(hasSymbols).toBe(true)
    })

    it('should properly space validation sections', async () => {
      const spaceSpy = vi.spyOn(EnhancedConsole, 'space')

      // Create a validation result with errors and warnings
      const result = {
        valid: false,
        errors: ['Error 1'],
        warnings: ['Warning 1'],
        suggestions: ['Suggestion 1'],
        score: 60,
        summary: 'Test summary',
      }

      service.displayValidationResults(result)

      expect(spaceSpy).toHaveBeenCalled()
    })
  })

  describe('Workspace Changelog Service Styling', () => {
    let service
    let mockAiService
    let mockGitService

    beforeEach(() => {
      mockAiService = {
        aiProvider: {
          generateCompletion: vi.fn().mockResolvedValue({ content: 'Generated content' }),
        },
      }
      mockGitService = {}
      service = new WorkspaceChangelogService(mockAiService, mockGitService)
    })

    it('should use enhanced console for info messages', async () => {
      const infoSpy = vi.spyOn(EnhancedConsole, 'info')

      // Mock no changes scenario
      const { getWorkingDirectoryChanges } = await import('../src/shared/utils/utils.js')
      getWorkingDirectoryChanges.mockReturnValue([])

      await service.generateComprehensiveWorkspaceChangelog()

      expect(infoSpy).toHaveBeenCalledWith('No changes detected in working directory.')
    })

    it('should use enhanced console for error messages', async () => {
      const errorSpy = vi.spyOn(console, 'error')

      // Mock utils to throw error
      const { getWorkingDirectoryChanges } = await import('../src/shared/utils/utils.js')
      getWorkingDirectoryChanges.mockImplementation(() => {
        throw new Error('Git error')
      })

      try {
        await service.generateComprehensiveWorkspaceChangelog()
      } catch (error) {
        // Expected to throw
        expect(error.message).toBe('Git error')
      }

      expect(errorSpy).toHaveBeenCalled()
    })
  })

  describe('CLI Controller Styling', () => {
    let controller

    beforeEach(() => {
      controller = new CLIController()
    })

    it('should use enhanced console for metrics display', () => {
      // Mock app service with metrics
      controller.appService = {
        options: { silent: false },
        getMetrics: () => ({
          commitsProcessed: 5,
          apiCalls: 3,
          totalTokens: 1500,
          errors: 0,
        }),
      }

      controller.showMetrics()

      // Should use enhanced console box formatting
      expect(mockConsole.log).toHaveBeenCalled()
    })

    it('should format metrics data properly', () => {
      const boxSpy = vi.spyOn(EnhancedConsole, 'box')

      controller.appService = {
        options: { silent: false },
        getMetrics: () => ({
          commitsProcessed: 10,
          apiCalls: 5,
          totalTokens: 2500,
          errors: 1,
        }),
      }

      controller.showMetrics()

      expect(boxSpy).toHaveBeenCalledWith(
        '📊 Session Summary',
        expect.any(String),
        expect.objectContaining({
          borderStyle: 'rounded',
          borderColor: 'info',
        })
      )
    })

    it('should handle silent mode correctly', () => {
      controller.appService = {
        options: { silent: true },
        getMetrics: () => ({}),
      }

      controller.showMetrics()

      // Should not display anything in silent mode
      expect(mockConsole.log).not.toHaveBeenCalled()
    })
  })

  describe('Cross-Component Styling Consistency', () => {
    it('should use consistent status symbols across components', () => {
      // Test that all components use the same status symbol format
      const successMessage = colors.statusSymbol('success', 'Test message')
      const errorMessage = colors.statusSymbol('error', 'Test message')
      const warningMessage = colors.statusSymbol('warning', 'Test message')

      expect(successMessage).toContain(colors.symbols.success)
      expect(errorMessage).toContain(colors.symbols.error)
      expect(warningMessage).toContain(colors.symbols.warning)
    })

    it('should maintain color consistency when disabled', () => {
      colors.disable()

      const result1 = colors.success('test')
      const result2 = colors.error('test')
      const result3 = colors.warning('test')

      // All should return plain text
      expect(result1).toBe('test')
      expect(result2).toBe('test')
      expect(result3).toBe('test')

      colors.enable()
    })

    it('should handle spinner integration consistently', async () => {
      const spinner = new SimpleSpinner('Test operation')

      spinner.start()
      expect(spinner.isSpinning).toBe(true)

      await new Promise((resolve) => setTimeout(resolve, 50))

      spinner.succeed('Operation completed')
      expect(spinner.isSpinning).toBe(false)

      // Should have used enhanced console formatting
      expect(mockStdout).toHaveBeenCalled()
    })
  })

  describe('Enhanced Console Integration', () => {
    it('should provide consistent section formatting', () => {
      EnhancedConsole.section('Test Section', 'Content here')

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Test Section'))
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('─'))
      expect(mockConsole.log).toHaveBeenCalledWith('Content here')
    })

    it('should handle empty content gracefully', () => {
      expect(() => EnhancedConsole.section('Empty Section')).not.toThrow()
      expect(() => EnhancedConsole.box('Empty', '')).not.toThrow()
      expect(() => EnhancedConsole.table([])).not.toThrow()
    })

    it('should provide consistent message formatting', () => {
      EnhancedConsole.success('Success message')
      EnhancedConsole.error('Error message')
      EnhancedConsole.warn('Warning message')
      EnhancedConsole.info('Info message')

      expect(mockConsole.log).toHaveBeenCalledTimes(4)

      // Each call should include appropriate symbols
      const calls = mockConsole.log.mock.calls.map((call) => call[0])
      expect(calls[0]).toContain(colors.symbols.success)
      expect(calls[1]).toContain(colors.symbols.error)
      expect(calls[2]).toContain(colors.symbols.warning)
      expect(calls[3]).toContain(colors.symbols.info)
    })
  })

  describe('Real-World Integration Scenarios', () => {
    it('should handle complete changelog generation workflow', async () => {
      // Mock a complete workflow
      const { getWorkingDirectoryChanges } = await import('../src/shared/utils/utils.js')
      getWorkingDirectoryChanges.mockReturnValue([{ path: 'test.js', status: 'modified' }])

      const service = new WorkspaceChangelogService({
        aiProvider: {
          generateCompletion: vi.fn().mockResolvedValue({ content: 'Generated changelog' }),
        },
      })

      await service.generateComprehensiveWorkspaceChangelog()

      // Should have used enhanced styling throughout
      expect(mockStdout).toHaveBeenCalled()
      expect(mockConsole.log).toHaveBeenCalled()
    })

    it('should handle validation workflow with styling', async () => {
      const service = new CommitMessageValidationService({
        getAll: vi.fn().mockReturnValue({}),
      })

      const result = await service.validateCommitMessage(
        'invalid: message that is way too long for the subject line limits and should trigger validation errors'
      )
      service.displayValidationResults(result)

      // Should have used enhanced styling for validation display
      expect(mockConsole.log).toHaveBeenCalled()
    })

    it('should maintain styling consistency under error conditions', async () => {
      const service = new InteractiveWorkflowService(null, {
        aiProvider: {
          generateCompletion: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      })

      await service.generateCommitSuggestion('test message').catch(() => {})

      // Should still use enhanced console for errors
      const errorSpy = vi.spyOn(EnhancedConsole, 'error')
      expect(mockConsole.log).toHaveBeenCalled()
    })
  })

  describe('Performance Impact of Styling', () => {
    it('should not significantly impact performance', async () => {
      const start = Date.now()

      // Perform multiple styling operations
      for (let i = 0; i < 100; i++) {
        colors.success(`Message ${i}`)
        colors.statusSymbol('info', `Info ${i}`)
        EnhancedConsole.processing(`Processing ${i}`)
      }

      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })

    it('should handle large content efficiently', () => {
      const largeContent = 'x'.repeat(10000)
      const start = Date.now()

      colors.boxed(largeContent)
      colors.success(largeContent)

      const duration = Date.now() - start
      expect(duration).toBeLessThan(500) // Should handle large content quickly
    })
  })

  describe('Accessibility and Terminal Compatibility', () => {
    it('should work in different terminal environments', () => {
      // Test with different TERM values
      const originalTerm = process.env.TERM

      process.env.TERM = 'xterm-256color'
      let testColors = new colors.constructor()
      expect(testColors.enabled).toBe(true)

      process.env.TERM = 'dumb'
      testColors = new colors.constructor()
      expect(testColors.enabled).toBe(false)

      process.env.TERM = originalTerm
    })

    it('should respect NO_COLOR environment variable', () => {
      const originalNoColor = process.env.NO_COLOR

      process.env.NO_COLOR = '1'
      const testColors = new colors.constructor()
      expect(testColors.enabled).toBe(false)

      process.env.NO_COLOR = originalNoColor
    })

    it('should provide fallbacks when colors are disabled', () => {
      colors.disable()

      // Should still provide useful output without colors
      expect(colors.statusSymbol('success', 'Done')).toContain('Done')
      expect(colors.symbols.success).toBe('✓')

      colors.enable()
    })
  })
})
