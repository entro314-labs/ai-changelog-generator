import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import colors from '../src/shared/constants/colors.js'
import {
  cliUtils,
  EnhancedConsole,
  MultiProgress,
  ProgressBar,
  SimpleSpinner,
  TaskList,
} from '../src/shared/utils/cli-ui.js'

describe('CLI UI Components', () => {
  let mockStdout
  let mockStderr

  beforeEach(() => {
    // Mock process.stdout.write
    mockStdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('SimpleSpinner', () => {
    it('should create spinner with default text', () => {
      const spinner = new SimpleSpinner()
      expect(spinner.text).toBe('Loading...')
      expect(spinner.interval).toBe(80)
    })

    it('should create spinner with custom text and interval', () => {
      const spinner = new SimpleSpinner('Processing...', 100)
      expect(spinner.text).toBe('Processing...')
      expect(spinner.interval).toBe(100)
    })

    it('should start and stop spinner', async () => {
      const spinner = new SimpleSpinner('Test spinner')

      spinner.start()
      expect(spinner.isSpinning).toBe(true)
      expect(spinner.timer).toBeDefined()

      await new Promise((resolve) => setTimeout(resolve, 200))

      spinner.stop()
      expect(spinner.isSpinning).toBe(false)
      expect(spinner.timer).toBe(null)
    })

    it('should succeed with message', () => {
      const spinner = new SimpleSpinner('Test spinner')
      spinner.start()

      const result = spinner.succeed('Success message')

      expect(result).toBe(spinner)
      expect(spinner.isSpinning).toBe(false)
      expect(mockStdout).toHaveBeenCalled()
    })

    it('should fail with message', () => {
      const spinner = new SimpleSpinner('Test spinner')
      spinner.start()

      const result = spinner.fail('Error message')

      expect(result).toBe(spinner)
      expect(spinner.isSpinning).toBe(false)
      expect(mockStdout).toHaveBeenCalled()
    })

    it('should warn with message', () => {
      const spinner = new SimpleSpinner('Test spinner')
      spinner.start()

      const result = spinner.warn('Warning message')

      expect(result).toBe(spinner)
      expect(spinner.isSpinning).toBe(false)
      expect(mockStdout).toHaveBeenCalled()
    })

    it('should not start if already spinning', () => {
      const spinner = new SimpleSpinner('Test spinner')

      spinner.start()
      const firstTimer = spinner.timer

      spinner.start()
      expect(spinner.timer).toBe(firstTimer)

      spinner.stop()
    })
  })

  describe('ProgressBar', () => {
    it('should create progress bar with correct properties', () => {
      const progressBar = new ProgressBar(100, 40)

      expect(progressBar.total).toBe(100)
      expect(progressBar.width).toBe(40)
      expect(progressBar.current).toBe(0)
    })

    it('should update progress correctly', () => {
      const progressBar = new ProgressBar(100, 20)

      progressBar.update(25)
      expect(progressBar.current).toBe(25)
      expect(mockStdout).toHaveBeenCalled()
    })

    it('should not exceed total when updating', () => {
      const progressBar = new ProgressBar(100, 20)

      progressBar.update(150)
      expect(progressBar.current).toBe(100)
    })

    it('should increment correctly', () => {
      const progressBar = new ProgressBar(100, 20)

      progressBar.increment()
      expect(progressBar.current).toBe(1)

      progressBar.increment('Test label')
      expect(progressBar.current).toBe(2)
    })

    it('should finish with message', () => {
      const progressBar = new ProgressBar(100, 20)

      progressBar.finish('Complete!')
      expect(progressBar.current).toBe(100)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Complete!'))
    })

    it('should throttle rendering', () => {
      const progressBar = new ProgressBar(100, 20, { renderThrottle: 1000 })

      progressBar.update(10)
      const firstCallCount = mockStdout.mock.calls.length

      progressBar.update(20)
      const secondCallCount = mockStdout.mock.calls.length

      // Should not render second update due to throttling
      expect(secondCallCount).toBe(firstCallCount)
    })
  })

  describe('TaskList', () => {
    it('should create task list with initial tasks', () => {
      const tasks = ['Task 1', 'Task 2', 'Task 3']
      const taskList = new TaskList(tasks)

      expect(taskList.tasks).toHaveLength(3)
      expect(taskList.tasks[0].text).toBe('Task 1')
      expect(taskList.tasks[0].status).toBe('pending')
    })

    it('should add new tasks', () => {
      const taskList = new TaskList()

      taskList.add('New task')
      expect(taskList.tasks).toHaveLength(1)
      expect(taskList.tasks[0].text).toBe('New task')
    })

    it('should start task correctly', () => {
      const taskList = new TaskList(['Task 1'])

      taskList.start(0)
      expect(taskList.tasks[0].status).toBe('running')
      expect(taskList.tasks[0].startTime).toBeDefined()
      expect(taskList.currentIndex).toBe(0)
    })

    it('should complete task correctly', () => {
      const taskList = new TaskList(['Task 1'])

      taskList.complete(0, 'Done!')
      expect(taskList.tasks[0].status).toBe('completed')
      expect(taskList.tasks[0].endTime).toBeDefined()
      expect(taskList.tasks[0].text).toContain('Done!')
    })

    it('should fail task correctly', () => {
      const taskList = new TaskList(['Task 1'])

      taskList.fail(0, 'Failed!')
      expect(taskList.tasks[0].status).toBe('failed')
      expect(taskList.tasks[0].endTime).toBeDefined()
    })

    it('should render tasks', () => {
      const taskList = new TaskList(['Task 1', 'Task 2'])

      taskList.render()
      expect(console.log).toHaveBeenCalled()
    })

    it('should show summary', () => {
      const taskList = new TaskList(['Task 1', 'Task 2'])
      taskList.complete(0)
      taskList.fail(1)

      taskList.summary()
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Tasks completed'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Tasks failed'))
    })

    it('should handle invalid task indices gracefully', () => {
      const taskList = new TaskList(['Task 1'])

      // Should not throw errors
      taskList.start(-1)
      taskList.start(10)
      taskList.complete(-1)
      taskList.complete(10)
      taskList.fail(-1)
      taskList.fail(10)
    })
  })

  describe('EnhancedConsole', () => {
    it('should log messages with correct types', () => {
      EnhancedConsole.success('Success message')
      EnhancedConsole.error('Error message')
      EnhancedConsole.warn('Warning message')
      EnhancedConsole.info('Info message')
      EnhancedConsole.processing('Processing message')
      EnhancedConsole.ai('AI message')
      EnhancedConsole.metrics('Metrics message')

      expect(console.log).toHaveBeenCalled()
    })

    it('should create sections', () => {
      EnhancedConsole.section('Test Section', 'Content here')

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Test Section'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('─'))
      expect(console.log).toHaveBeenCalledWith('Content here')
    })

    it('should create boxes', () => {
      EnhancedConsole.box('Title', 'Content', { borderStyle: 'rounded' })

      expect(console.log).toHaveBeenCalled()
    })

    it('should display tables', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ]

      EnhancedConsole.table(data)
      expect(console.log).toHaveBeenCalled()
    })

    it('should display file lists', () => {
      const files = ['file1.js', 'file2.ts', 'file3.md']

      EnhancedConsole.fileList(files, 'Modified Files')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Modified Files'))
    })

    it('should display metrics', () => {
      const metrics = {
        'Total Files': 10,
        'Lines Added': 150,
        'Lines Removed': 50,
      }

      EnhancedConsole.metrics(metrics, 'Project Stats')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Project Stats'))
    })

    it('should create dividers and spaces', () => {
      EnhancedConsole.divider()
      EnhancedConsole.space(2)

      expect(console.log).toHaveBeenCalled()
    })

    it('should handle empty data gracefully', () => {
      // These should not throw errors or log anything
      expect(() => {
        EnhancedConsole.table([])
        EnhancedConsole.fileList([], 'Empty Files')
        EnhancedConsole.metrics({}, 'Empty Metrics')
      }).not.toThrow()

      // Methods with guards should not log when data is empty
      // This is expected behavior
    })
  })

  describe('MultiProgress', () => {
    it('should create and manage multiple progress bars', () => {
      const multiProgress = new MultiProgress()

      const bar1 = multiProgress.create('task1', 100, 'Task 1')
      const bar2 = multiProgress.create('task2', 50, 'Task 2')

      expect(multiProgress.bars.size).toBe(2)
      expect(bar1).toBeInstanceOf(ProgressBar)
      expect(bar2).toBeInstanceOf(ProgressBar)
    })

    it('should update specific progress bars', () => {
      const multiProgress = new MultiProgress()
      multiProgress.create('task1', 100, 'Task 1')

      multiProgress.update('task1', 50)
      // Should not throw error
    })

    it('should remove progress bars', () => {
      const multiProgress = new MultiProgress()
      multiProgress.create('task1', 100, 'Task 1')

      multiProgress.remove('task1', 'Completed')
      expect(multiProgress.bars.size).toBe(0)
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Task 1'))
    })

    it('should clear all progress bars', () => {
      const multiProgress = new MultiProgress()
      multiProgress.create('task1', 100, 'Task 1')
      multiProgress.create('task2', 50, 'Task 2')

      multiProgress.clear()
      expect(multiProgress.bars.size).toBe(0)
    })

    it('should handle operations on non-existent bars gracefully', () => {
      const multiProgress = new MultiProgress()

      // Should not throw errors
      multiProgress.update('nonexistent', 50)
      multiProgress.remove('nonexistent')
    })
  })

  describe('cliUtils', () => {
    it('should clear screen', () => {
      cliUtils.clear()
      expect(mockStdout).toHaveBeenCalledWith('\u001b[2J\u001b[0;0H')
    })

    it('should move cursor up', () => {
      cliUtils.cursorUp(3)
      expect(mockStdout).toHaveBeenCalledWith('\u001b[3A')
    })

    it('should clear line', () => {
      cliUtils.clearLine()
      expect(mockStdout).toHaveBeenCalledWith('\u001b[0K')
    })

    it('should format duration correctly', () => {
      expect(cliUtils.formatDuration(500)).toBe('0s')
      expect(cliUtils.formatDuration(1500)).toBe('1s')
      expect(cliUtils.formatDuration(65000)).toBe('1m 5s')
      expect(cliUtils.formatDuration(3665000)).toBe('1h 1m 5s')
    })

    it('should format bytes correctly', () => {
      expect(cliUtils.formatBytes(0)).toBe('0B')
      expect(cliUtils.formatBytes(1024)).toBe('1KB')
      expect(cliUtils.formatBytes(1048576)).toBe('1MB')
      expect(cliUtils.formatBytes(1073741824)).toBe('1GB')
      expect(cliUtils.formatBytes(1536)).toBe('1.5KB')
    })

    it('should handle edge cases for formatting', () => {
      expect(cliUtils.formatDuration(0)).toBe('0s')
      expect(cliUtils.formatDuration(-1000)).toBe('0s')
      expect(cliUtils.formatBytes(-100)).toBe('0B')
    })
  })

  describe('Integration Tests', () => {
    it('should work together - spinner and progress bar', async () => {
      const spinner = new SimpleSpinner('Starting...')
      const progressBar = new ProgressBar(10, 20)

      spinner.start()
      await new Promise((resolve) => setTimeout(resolve, 100))
      spinner.succeed('Started')

      for (let i = 1; i <= 10; i++) {
        progressBar.update(i, `Step ${i}`)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      progressBar.finish('All done!')

      expect(mockStdout).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalled()
    })

    it('should work with task list and enhanced console', () => {
      const taskList = new TaskList(['Setup', 'Process', 'Cleanup'])

      taskList.start(0)
      EnhancedConsole.processing('Setting up...')
      taskList.complete(0)

      taskList.start(1)
      EnhancedConsole.processing('Processing...')
      taskList.complete(1)

      taskList.start(2)
      EnhancedConsole.processing('Cleaning up...')
      taskList.complete(2)

      taskList.summary()

      expect(console.log).toHaveBeenCalled()
    })

    it('should handle colors integration', () => {
      const spinner = new SimpleSpinner('Colorful spinner')
      spinner.start()
      spinner.succeed(colors.success('Success with colors!'))

      EnhancedConsole.box(
        'Colorful Box',
        colors.info('This is info text\n') + colors.warning('This is warning text'),
        { borderStyle: 'double' }
      )

      expect(mockStdout).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle spinner errors gracefully', () => {
      const spinner = new SimpleSpinner('Test')

      // Stop without starting
      expect(() => spinner.stop()).not.toThrow()

      // Multiple stops
      spinner.start()
      spinner.stop()
      expect(() => spinner.stop()).not.toThrow()
    })

    it('should handle progress bar edge cases', () => {
      const progressBar = new ProgressBar(0, 10) // Zero total

      expect(() => progressBar.update(1)).not.toThrow()
      expect(() => progressBar.increment()).not.toThrow()
      expect(() => progressBar.finish()).not.toThrow()
    })

    it('should handle task list with empty tasks', () => {
      const taskList = new TaskList()

      expect(() => taskList.render()).not.toThrow()
      expect(() => taskList.summary()).not.toThrow()
    })
  })

  describe('Performance Tests', () => {
    it('should handle rapid spinner updates', () => {
      const spinner = new SimpleSpinner('Rapid test', 10)

      const start = Date.now()
      spinner.start()

      setTimeout(() => {
        spinner.stop()
        const duration = Date.now() - start
        expect(duration).toBeLessThan(1000)
      }, 100)
    })

    it('should handle many progress updates efficiently', () => {
      const progressBar = new ProgressBar(1000, 50, { renderThrottle: 50 })

      const start = Date.now()

      for (let i = 0; i < 1000; i++) {
        progressBar.update(i)
      }

      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Should complete quickly due to throttling
    })
  })
})
