#!/usr/bin/env node

/**
 * DEPRECATED: Legacy CLI Entry Point
 *
 * This file is deprecated and maintained only for backward compatibility.
 * Please use bin/ai-changelog.js which delegates to CLIController instead.
 *
 * @deprecated Use bin/ai-changelog.js with CLIController
 */

console.warn('\n⚠️  WARNING: This CLI entry point is deprecated.')
console.warn('Please use the main CLI: ai-changelog (or bin/ai-changelog.js)\n')

/**
 * CLI Entry Point for AI Changelog Generator
 * Provides command-line interface for changelog generation functionality
 */

import process from 'node:process'

import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'

import { AIChangelogGenerator } from './ai-changelog-generator.js'
import { EnhancedConsole, SimpleSpinner } from './shared/utils/cli-ui.js'

async function runCLI() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('ai-changelog')
    .usage('$0 [options]', 'Generate AI-powered changelogs from git commits')
    .option('tag', {
      alias: ['v', 'version'],
      type: 'string',
      description: 'Version tag for changelog',
    })
    .option('since', {
      alias: 's',
      type: 'string',
      description: 'Generate changelog since commit/tag',
    })
    .option('detailed', {
      type: 'boolean',
      description: 'Generate detailed technical analysis',
    })
    .option('enterprise', {
      type: 'boolean',
      description: 'Generate enterprise-ready documentation',
    })
    .option('interactive', {
      alias: 'i',
      type: 'boolean',
      description: 'Run in interactive mode',
    })
    .option('analyze', {
      type: 'boolean',
      description: 'Analyze current working directory changes',
    })
    .option('health', {
      type: 'boolean',
      description: 'Assess repository health',
    })
    .option('branches', {
      type: 'boolean',
      description: 'Analyze all branches',
    })
    .option('comprehensive', {
      type: 'boolean',
      description: 'Comprehensive repository analysis',
    })
    .option('model', {
      type: 'string',
      description: 'Override AI model selection',
    })
    .option('no-attribution', {
      type: 'boolean',
      description: 'Disable attribution footer',
    })
    .option('validate', {
      type: 'boolean',
      description: 'Validate configuration',
    })
    .help()
    .alias('help', 'h')
    .parse()

  try {
    const generator = new AIChangelogGenerator({
      analysisMode: argv.detailed ? 'detailed' : argv.enterprise ? 'enterprise' : 'standard',
      modelOverride: argv.model,
      includeAttribution: !argv.noAttribution,
    })

    if (argv.model) {
      generator.setModelOverride(argv.model)
    }

    if (argv.detailed) {
      generator.setAnalysisMode('detailed')
    } else if (argv.enterprise) {
      generator.setAnalysisMode('enterprise')
    }

    if (argv.validate) {
      EnhancedConsole.info('🔧 Validating configuration...')
      await generator.validateConfiguration()
      EnhancedConsole.success('✅ Configuration is valid')
      return
    }

    if (argv.interactive) {
      EnhancedConsole.info('🎮 Starting interactive mode...')
      await generator.runInteractive()
      return
    }

    if (argv.health) {
      const healthSpinner = new SimpleSpinner('Assessing repository health...')
      healthSpinner.start()
      await generator.assessRepositoryHealth()
      healthSpinner.succeed('Repository health assessment complete')
      return
    }

    if (argv.analyze) {
      const analyzeSpinner = new SimpleSpinner('Analyzing current changes...')
      analyzeSpinner.start()
      await generator.analyzeCurrentChanges()
      analyzeSpinner.succeed('Current changes analysis complete')
      return
    }

    if (argv.branches) {
      const branchSpinner = new SimpleSpinner('Analyzing branches...')
      branchSpinner.start()
      await generator.analyzeRepository({ type: 'branches' })
      branchSpinner.succeed('Branch analysis complete')
      return
    }

    if (argv.comprehensive) {
      const compSpinner = new SimpleSpinner('Running comprehensive analysis...')
      compSpinner.start()
      await generator.analyzeRepository({ type: 'comprehensive' })
      compSpinner.succeed('Comprehensive analysis complete')
      return
    }

    // Default: Generate changelog
    const changelogSpinner = new SimpleSpinner('Generating changelog...')
    changelogSpinner.start()
    const result = await generator.generateChangelog(argv.tag || argv.version, argv.since)

    if (result) {
      changelogSpinner.succeed('Changelog generated successfully!')

      // Show metrics
      const metrics = generator.getMetrics()
      EnhancedConsole.metrics(
        `Processed ${metrics.commitsProcessed} commits in ${formatDuration(Date.now() - metrics.startTime)}`
      )
    } else {
      changelogSpinner.fail('Failed to generate changelog')
    }
  } catch (error) {
    EnhancedConsole.error(`Error: ${error.message}`)
    if (process.env.DEBUG) {
      EnhancedConsole.error(error.stack)
    }
    process.exit(1)
  }
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000)
  return seconds > 0 ? `${seconds}s` : `${ms}ms`
}

export { runCLI }

// If this file is run directly, execute CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch((error) => {
    EnhancedConsole.error('CLI Error:', error.message)
    process.exit(1)
  })
}
