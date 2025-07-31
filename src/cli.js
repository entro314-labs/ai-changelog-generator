#!/usr/bin/env node

/**
 * CLI Entry Point for AI Changelog Generator
 * Provides command-line interface for changelog generation functionality
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { AIChangelogGenerator } from './ai-changelog-generator.js';
import colors from './shared/constants/colors.js';

async function runCLI() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('ai-changelog')
    .usage('$0 [options]', 'Generate AI-powered changelogs from git commits')
    .option('tag', {
      alias: ['v', 'version'],
      type: 'string',
      description: 'Version tag for changelog'
    })
    .option('since', {
      alias: 's',
      type: 'string',
      description: 'Generate changelog since commit/tag'
    })
    .option('detailed', {
      type: 'boolean',
      description: 'Generate detailed technical analysis'
    })
    .option('enterprise', {
      type: 'boolean',
      description: 'Generate enterprise-ready documentation'
    })
    .option('interactive', {
      alias: 'i',
      type: 'boolean',
      description: 'Run in interactive mode'
    })
    .option('analyze', {
      type: 'boolean',
      description: 'Analyze current working directory changes'
    })
    .option('health', {
      type: 'boolean',
      description: 'Assess repository health'
    })
    .option('branches', {
      type: 'boolean',
      description: 'Analyze all branches'
    })
    .option('comprehensive', {
      type: 'boolean',
      description: 'Comprehensive repository analysis'
    })
    .option('model', {
      type: 'string',
      description: 'Override AI model selection'
    })
    .option('no-attribution', {
      type: 'boolean',
      description: 'Disable attribution footer'
    })
    .option('validate', {
      type: 'boolean',
      description: 'Validate configuration'
    })
    .help()
    .alias('help', 'h')
    .parse();

  try {
    const generator = new AIChangelogGenerator({
      analysisMode: argv.detailed ? 'detailed' : argv.enterprise ? 'enterprise' : 'standard',
      modelOverride: argv.model,
      includeAttribution: !argv.noAttribution
    });

    if (argv.model) {
      generator.setModelOverride(argv.model);
    }

    if (argv.detailed) {
      generator.setAnalysisMode('detailed');
    } else if (argv.enterprise) {
      generator.setAnalysisMode('enterprise');
    }

    if (argv.validate) {
      console.log(colors.infoMessage('🔧 Validating configuration...'));
      await generator.validateConfiguration();
      console.log(colors.successMessage('✅ Configuration is valid'));
      return;
    }

    if (argv.interactive) {
      console.log(colors.infoMessage('🎮 Starting interactive mode...'));
      await generator.runInteractive();
      return;
    }

    if (argv.health) {
      console.log(colors.infoMessage('🏥 Assessing repository health...'));
      await generator.assessRepositoryHealth();
      return;
    }

    if (argv.analyze) {
      console.log(colors.infoMessage('🔍 Analyzing current changes...'));
      await generator.analyzeCurrentChanges();
      return;
    }

    if (argv.branches) {
      console.log(colors.infoMessage('🌿 Analyzing branches...'));
      await generator.analyzeRepository({ type: 'branches' });
      return;
    }

    if (argv.comprehensive) {
      console.log(colors.infoMessage('📊 Running comprehensive analysis...'));
      await generator.analyzeRepository({ type: 'comprehensive' });
      return;
    }

    // Default: Generate changelog
    console.log(colors.infoMessage('📝 Generating changelog...'));
    const result = await generator.generateChangelog(argv.tag || argv.version, argv.since);
    
    if (result) {
      console.log(colors.successMessage('✅ Changelog generated successfully!'));
      
      // Show metrics
      const metrics = generator.getMetrics();
      console.log(colors.infoMessage(`📊 Processed ${metrics.commitsProcessed} commits in ${formatDuration(Date.now() - metrics.startTime)}`));
    }

  } catch (error) {
    console.error(colors.errorMessage('❌ Error:'), error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds > 0 ? `${seconds}s` : `${ms}ms`;
}

export { runCLI };

// If this file is run directly, execute CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI();
}