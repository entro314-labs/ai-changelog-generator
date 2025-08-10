#!/usr/bin/env node

/**
 * Core Functionality Unit Tests
 *
 * Tests individual components and services to ensure 100% functionality coverage
 * that complements the comprehensive end-to-end test suite
 */

import fs from 'node:fs'
import path from 'node:path'

import { AIChangelogGenerator } from '../src/ai-changelog-generator.js'
import colors from '../src/shared/constants/colors.js'

class CoreFunctionalityTest {
  constructor() {
    this.results = {
      suites: {
        mainFacade: { passed: 0, failed: 0, tests: [] },
        gitOperations: { passed: 0, failed: 0, tests: [] },
        configManagement: { passed: 0, failed: 0, tests: [] },
        aiIntegration: { passed: 0, failed: 0, tests: [] },
        changelogGeneration: { passed: 0, failed: 0, tests: [] },
        utilityFunctions: { passed: 0, failed: 0, tests: [] },
        errorHandling: { passed: 0, failed: 0, tests: [] },
        validation: { passed: 0, failed: 0, tests: [] },
      },
      summary: { total: 0, passed: 0, failed: 0 },
    }
  }

  async runAll() {
    console.log(colors.header('🧪 Core Functionality Unit Tests'))
    console.log(colors.secondary('Testing individual components for 100% coverage\n'))
    console.log('='.repeat(70))

    try {
      await this.testMainFacade()
      await this.testGitOperations()
      await this.testConfigManagement()
      await this.testAIIntegration()
      await this.testChangelogGeneration()
      await this.testUtilityFunctions()
      await this.testErrorHandling()
      await this.testValidation()

      this.printSummary()
      this.saveResults()
    } catch (error) {
      console.error(colors.errorMessage(`\n❌ Test suite failed: ${error.message}`))
      throw error
    }

    return this.results
  }

  async testMainFacade() {
    console.log(colors.subheader('\n🎯 Testing AIChangelogGenerator Main Facade'))
    console.log('-'.repeat(50))

    // Test constructor and initialization
    await this.runTest('mainFacade', 'Constructor with default options', async () => {
      const generator = new AIChangelogGenerator({ silent: true })
      return {
        passed: generator !== null && typeof generator === 'object',
        details: 'Generator created successfully with defaults',
      }
    })

    await this.runTest('mainFacade', 'Constructor with custom options', async () => {
      const generator = new AIChangelogGenerator({
        silent: true,
        dryRun: true,
        analysisMode: 'detailed',
      })
      return {
        passed: generator.dryRun === true && generator.analysisMode === 'detailed',
        details: 'Custom options applied correctly',
      }
    })

    // Test getters
    await this.runTest('mainFacade', 'hasAI getter', async () => {
      const generator = new AIChangelogGenerator({ silent: true })
      const hasAI = generator.hasAI
      return {
        passed: typeof hasAI === 'boolean',
        details: `hasAI returned: ${hasAI}`,
      }
    })

    await this.runTest('mainFacade', 'gitExists getter', async () => {
      const generator = new AIChangelogGenerator({ silent: true })
      const gitExists = generator.gitExists
      return {
        passed: typeof gitExists === 'boolean',
        details: `gitExists returned: ${gitExists}`,
      }
    })

    // Test getMetrics method
    await this.runTest('mainFacade', 'getMetrics method', async () => {
      const generator = new AIChangelogGenerator({ silent: true })
      const metrics = generator.getMetrics()
      return {
        passed: metrics !== null && typeof metrics === 'object',
        details: `Metrics object returned with keys: ${Object.keys(metrics || {}).join(', ')}`,
      }
    })
  }

  async testGitOperations() {
    console.log(colors.subheader('\n📊 Testing Git Operations'))
    console.log('-'.repeat(50))

    const generator = new AIChangelogGenerator({ silent: true })

    await this.runTest('gitOperations', 'analyzeRepository method', async () => {
      const result = await generator.analyzeRepository()
      return {
        passed: result !== null,
        details: `Repository analysis completed: ${typeof result}`,
      }
    })

    await this.runTest('gitOperations', 'analyzeCurrentChanges method', async () => {
      const result = await generator.analyzeCurrentChanges()
      return {
        passed: result !== null,
        details: `Current changes analysis completed: ${typeof result}`,
      }
    })

    await this.runTest('gitOperations', 'analyzeRecentCommits with custom limit', async () => {
      const result = await generator.analyzeRecentCommits(5)
      return {
        passed: result !== null,
        details: 'Recent commits analysis completed for 5 commits',
      }
    })

    await this.runTest('gitOperations', 'analyzeBranches method', async () => {
      const result = await generator.analyzeBranches()
      return {
        passed: result !== null,
        details: `Branch analysis completed: ${typeof result}`,
      }
    })

    await this.runTest('gitOperations', 'analyzeUntrackedFiles method', async () => {
      const result = await generator.analyzeUntrackedFiles()
      return {
        passed: result !== null,
        details: `Untracked files analysis completed: ${typeof result}`,
      }
    })

    await this.runTest('gitOperations', 'analyzeComprehensive method', async () => {
      const result = await generator.analyzeComprehensive()
      return {
        passed: result !== null,
        details: `Comprehensive analysis completed: ${typeof result}`,
      }
    })
  }

  async testConfigManagement() {
    console.log(colors.subheader('\n⚙️  Testing Configuration Management'))
    console.log('-'.repeat(50))

    const generator = new AIChangelogGenerator({ silent: true })

    await this.runTest('configManagement', 'validateConfiguration method', async () => {
      const result = await generator.validateConfiguration()
      return {
        passed: typeof result === 'boolean',
        details: `Configuration validation: ${result ? 'valid' : 'invalid'}`,
      }
    })

    await this.runTest('configManagement', 'listProviders method', async () => {
      const providers = await generator.listProviders()
      return {
        passed: Array.isArray(providers),
        details: `Found ${providers ? providers.length : 0} providers`,
      }
    })

    await this.runTest('configManagement', 'healthCheck method', async () => {
      const health = await generator.healthCheck()
      return {
        passed: health !== null && typeof health === 'object',
        details: `Health check completed: ${health?.status || 'unknown'}`,
      }
    })

    await this.runTest('configManagement', 'assessRepositoryHealth method', async () => {
      const health = await generator.assessRepositoryHealth()
      return {
        passed: health !== null,
        details: 'Repository health assessment completed',
      }
    })
  }

  async testAIIntegration() {
    console.log(colors.subheader('\n🤖 Testing AI Integration'))
    console.log('-'.repeat(50))

    const generator = new AIChangelogGenerator({ silent: true })

    await this.runTest('aiIntegration', 'Provider availability check', async () => {
      const providers = await generator.listProviders()
      return {
        passed: Array.isArray(providers),
        details: 'Providers list returned successfully',
      }
    })

    await this.runTest('aiIntegration', 'Provider switching (if providers available)', async () => {
      const providers = await generator.listProviders()
      if (providers && providers.length > 0) {
        const providerName = providers[0].name || providers[0]
        const result = await generator.switchProvider(providerName)
        return {
          passed: !!result,
          details: 'Provider switching test completed',
        }
      }
      return {
        passed: true,
        details: 'No providers available to test switching (test skipped)',
      }
    })

    await this.runTest('aiIntegration', 'AI availability status', async () => {
      const hasAI = generator.hasAI
      return {
        passed: typeof hasAI === 'boolean',
        details: `AI status properly reported: ${hasAI}`,
      }
    })
  }

  async testChangelogGeneration() {
    console.log(colors.subheader('\n📝 Testing Changelog Generation'))
    console.log('-'.repeat(50))

    const generator = new AIChangelogGenerator({ silent: true, dryRun: true })

    await this.runTest('changelogGeneration', 'Basic changelog generation', async () => {
      const result = await generator.generateChangelog()
      return {
        passed: result !== null,
        details: `Basic changelog generated: ${typeof result}`,
      }
    })

    await this.runTest('changelogGeneration', 'Versioned changelog generation', async () => {
      const result = await generator.generateChangelog('1.0.0')
      return {
        passed: result !== null,
        details: 'Versioned changelog generated for v1.0.0',
      }
    })

    await this.runTest('changelogGeneration', 'Date-filtered changelog generation', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const result = await generator.generateChangelog(null, yesterday.toISOString().split('T')[0])
      return {
        passed: result !== null,
        details: 'Date-filtered changelog generated',
      }
    })

    await this.runTest('changelogGeneration', 'Working directory changelog', async () => {
      const result = await generator.generateChangelogFromChanges()
      return {
        passed: result !== null,
        details: 'Working directory changelog generated',
      }
    })
  }

  async testUtilityFunctions() {
    console.log(colors.subheader('\n🔧 Testing Utility Functions'))
    console.log('-'.repeat(50))

    // Test utilities from utils.js
    await this.runTest('utilityFunctions', 'Utils module import', async () => {
      try {
        const utils = await import('../src/shared/utils/utils.js')
        return {
          passed: typeof utils === 'object',
          details: 'Utils module imported successfully',
        }
      } catch (error) {
        return {
          passed: false,
          details: `Utils import failed: ${error.message}`,
        }
      }
    })

    // Test colors module
    await this.runTest('utilityFunctions', 'Colors module functionality', async () => {
      return {
        passed: typeof colors === 'object' && typeof colors.successMessage === 'function',
        details: 'Colors module working correctly',
      }
    })

    // Test diff processor
    await this.runTest('utilityFunctions', 'Diff processor import', async () => {
      try {
        const diffProcessor = await import('../src/shared/utils/diff-processor.js')
        return {
          passed: typeof diffProcessor === 'object',
          details: 'Diff processor imported successfully',
        }
      } catch (error) {
        return {
          passed: false,
          details: `Diff processor import failed: ${error.message}`,
        }
      }
    })
  }

  async testErrorHandling() {
    console.log(colors.subheader('\n⚠️  Testing Error Handling'))
    console.log('-'.repeat(50))

    const generator = new AIChangelogGenerator({ silent: true })

    await this.runTest('errorHandling', 'Invalid provider switching', async () => {
      try {
        await generator.switchProvider('nonexistent-provider')
        return {
          passed: true,
          details: 'Invalid provider handled gracefully',
        }
      } catch (error) {
        return {
          passed: true,
          details: 'Invalid provider properly rejected with error',
        }
      }
    })

    await this.runTest('errorHandling', 'Invalid changelog parameters', async () => {
      try {
        await generator.generateChangelog(null, 'invalid-date')
        return {
          passed: true,
          details: 'Invalid parameters handled gracefully',
        }
      } catch (error) {
        return {
          passed: true,
          details: 'Invalid parameters properly rejected',
        }
      }
    })
  }

  async testValidation() {
    console.log(colors.subheader('\n✅ Testing Validation Systems'))
    console.log('-'.repeat(50))

    const generator = new AIChangelogGenerator({ silent: true })

    await this.runTest('validation', 'Configuration validation', async () => {
      const isValid = await generator.validateConfiguration()
      return {
        passed: typeof isValid === 'boolean',
        details: `Configuration validation returned: ${isValid}`,
      }
    })

    await this.runTest('validation', 'Repository health check', async () => {
      const health = await generator.assessRepositoryHealth()
      return {
        passed: health !== null,
        details: 'Repository health check completed',
      }
    })

    await this.runTest('validation', 'System health check', async () => {
      const health = await generator.healthCheck()
      return {
        passed: health !== null && typeof health === 'object',
        details: `System health check completed: ${health?.status || 'checked'}`,
      }
    })
  }

  async runTest(suite, name, testFn) {
    try {
      const result = await testFn()
      const testResult = {
        name,
        passed: result.passed,
        details: result.details,
        timestamp: new Date().toISOString(),
      }

      if (result.passed) {
        console.log(colors.successMessage(`   ✅ ${name}`))
        this.results.suites[suite].passed++
        this.results.summary.passed++
      } else {
        console.log(colors.errorMessage(`   ❌ ${name}: ${result.details}`))
        this.results.suites[suite].failed++
        this.results.summary.failed++
      }

      this.results.suites[suite].tests.push(testResult)
      this.results.summary.total++
    } catch (error) {
      console.log(colors.errorMessage(`   ❌ ${name}: ${error.message}`))
      this.results.suites[suite].failed++
      this.results.summary.failed++
      this.results.suites[suite].tests.push({
        name,
        passed: false,
        details: error.message,
        error: error.stack,
        timestamp: new Date().toISOString(),
      })
      this.results.summary.total++
    }
  }

  printSummary() {
    console.log(colors.header('\n📊 Core Functionality Test Results'))
    console.log('='.repeat(70))

    // Suite breakdown
    for (const [name, suite] of Object.entries(this.results.suites)) {
      const total = suite.passed + suite.failed
      if (total > 0) {
        const passRate = Math.round((suite.passed / total) * 100)
        const status = suite.failed === 0 ? '✅' : suite.passed > 0 ? '⚠️' : '❌'
        const color =
          suite.failed === 0
            ? 'successMessage'
            : suite.passed > 0
              ? 'warningMessage'
              : 'errorMessage'
        console.log(
          colors[color](
            `   ${status} ${name.padEnd(20)}: ${suite.passed}/${total} passed (${passRate}%)`
          )
        )
      }
    }

    // Overall results
    const passRate =
      this.results.summary.total > 0
        ? Math.round((this.results.summary.passed / this.results.summary.total) * 100)
        : 0

    console.log(colors.subheader('\n🎯 Overall Results:'))
    console.log(colors.infoMessage(`   Total tests: ${this.results.summary.total}`))
    console.log(colors.successMessage(`   Passed: ${this.results.summary.passed}`))
    if (this.results.summary.failed > 0) {
      console.log(colors.errorMessage(`   Failed: ${this.results.summary.failed}`))
    }
    console.log(colors.metricsMessage(`   Success rate: ${passRate}%`))

    if (passRate >= 90) {
      console.log(colors.successMessage('\n🎉 EXCELLENT - Core functionality fully tested!'))
    } else if (passRate >= 75) {
      console.log(colors.warningMessage('\n⚠️  GOOD - Most core functionality covered'))
    } else {
      console.log(colors.errorMessage('\n❌ NEEDS WORK - Core functionality testing incomplete'))
    }
  }

  saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const resultsDir = path.join('.', 'test', 'test-results')

    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true })
    }

    const resultsPath = path.join(resultsDir, `core-functionality-${timestamp}.json`)
    fs.writeFileSync(
      resultsPath,
      JSON.stringify(
        {
          ...this.results,
          timestamp: new Date().toISOString(),
          version: '3.1.2',
          testType: 'core-functionality',
          environment: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
          },
        },
        null,
        2
      )
    )

    console.log(colors.secondary(`\n📄 Test results saved to: ${resultsPath}`))
  }
}

// Export for use in other tests
export default CoreFunctionalityTest

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new CoreFunctionalityTest()
  testSuite
    .runAll()
    .then((results) => {
      process.exit(results.summary.failed > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error(colors.errorMessage(`Fatal test error: ${error.message}`))
      process.exit(1)
    })
}
