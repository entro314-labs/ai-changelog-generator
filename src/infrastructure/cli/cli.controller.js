import { access } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'

import { ApplicationService } from '../../application/services/application.service.js'
import colors from '../../shared/constants/colors.js'
import { handleCLIError, setupProcessErrorHandlers } from '../../shared/utils/cli-entry-utils.js'
import { EnhancedConsole } from '../../shared/utils/cli-ui.js'
import { formatDuration, promptForConfig } from '../../shared/utils/utils.js'

export class CLIController {
  constructor() {
    this.commands = new Map()
    this.appService = null
    this.startTime = Date.now()

    // Setup enhanced error handling
    setupProcessErrorHandlers('AI Changelog Generator', {
      gracefulShutdown: true,
      logErrors: true,
      showStack: process.env.DEBUG === 'true',
    })

    this.registerCommands()
  }

  registerCommands() {
    // Register all available commands
    this.commands.set('default', new DefaultCommand())
    this.commands.set('init', new InitCommand())
    this.commands.set('validate', new ValidateCommand())
    this.commands.set('analyze', new AnalyzeCommand())
    this.commands.set('analyze-commits', new AnalyzeCommitsCommand())
    this.commands.set('git-info', new GitInfoCommand())
    this.commands.set('health', new HealthCommand())
    this.commands.set('branches', new BranchesCommand())
    this.commands.set('comprehensive', new ComprehensiveCommand())
    this.commands.set('untracked', new UntrackedCommand())
    this.commands.set('working-dir', new WorkingDirCommand())
    this.commands.set('from-commits', new FromCommitsCommand())
    this.commands.set('commit-message', new CommitMessageCommand())
    this.commands.set('commit', new CommitCommand())
    this.commands.set('providers', new ProvidersCommand())
    this.commands.set('stash', new StashCommand())
  }

  async runCLI() {
    try {
      // Ensure config exists
      await this.ensureConfig()

      const argv = await this.setupYargs()

      // Initialize application service with CLI options
      this.appService = new ApplicationService({
        dryRun: argv.dryRun,
        noColor: argv.noColor,
        silent: argv.silent,
      })

      // Execute command
      const commandName = argv._[0] || 'default'
      const command = this.commands.get(commandName)

      if (!command) {
        throw new Error(`Unknown command: ${commandName}`)
      }

      await command.execute(argv, this.appService)

      // Show completion metrics
      await this.showMetrics()
    } catch (error) {
      handleCLIError(error, 'run CLI application', {
        exitOnError: false,
        showTips: true,
        showStack: process.env.DEBUG === 'true',
      })
      process.exitCode = 1
    }
  }

  async ensureConfig() {
    // Skip config setup in test environments to prevent hanging
    if (process.env.NODE_ENV === 'test' || process.env.CI) {
      return
    }

    const configPath = path.join(process.cwd(), '.env.local')
    try {
      await access(configPath)
    } catch {
      await promptForConfig()
    }
  }

  setupYargs() {
    return (
      yargs(hideBin(process.argv))
        .scriptName('ai-changelog')
        .usage(
          `${colors.header('AI Changelog Generator')} - ${colors.secondary('Automatically generate changelogs from your git commits using AI.')}\n\n${colors.header('Usage:')} $0 [command] [options]`
        )

        // Default command
        .command('$0', 'Generate a changelog from git commits (default command).', (yargs) => {
          yargs
            .option('interactive', {
              alias: 'i',
              type: 'boolean',
              description: 'Choose commits interactively.',
            })
            .option('release-version', {
              alias: 'v',
              type: 'string',
              description: 'Set the release version (e.g., 1.2.3).',
            })
            .option('since', {
              alias: 's',
              type: 'string',
              description: 'Generate changelog since a specific git ref (tag/commit).',
            })
            .option('author', {
              alias: 'a',
              type: 'string',
              description: 'Filter commits by author name or email.',
            })
            .option('tag-range', {
              type: 'string',
              description: 'Generate changelog between two tags (format: v1.0.0..v2.0.0).',
            })
            .option('format', {
              alias: 'f',
              type: 'string',
              choices: ['markdown', 'json', 'html'],
              default: 'markdown',
              description: 'Output format for the changelog.',
            })
            .option('model', {
              alias: 'm',
              type: 'string',
              description: 'Override the default model.',
            })
            .option('detailed', { type: 'boolean', description: 'Use detailed analysis mode.' })
            .option('enterprise', { type: 'boolean', description: 'Use enterprise analysis mode.' })
            .option('dry-run', {
              type: 'boolean',
              description: 'Preview changelog without writing to file.',
            })
            .option('no-attribution', {
              type: 'boolean',
              description: 'Disable the attribution footer.',
            })
            .option('output', {
              alias: 'o',
              type: 'string',
              description: 'Output file path.',
            })
        })

        // Analysis commands
        .command('init', 'Run interactive setup to configure the tool.')
        .command('validate', 'Validate your configuration and connectivity.')
        .command(
          'analyze',
          'Analyze current working directory changes.',
          this.createStandardOptions
        )
        .command(
          'analyze-commits <limit>',
          'Analyze recent commits with detailed information.',
          (yargs) => {
            this.createStandardOptions(yargs).positional('limit', {
              type: 'number',
              default: 10,
              description: 'Number of commits to analyze',
            })
          }
        )
        .command(
          'git-info',
          'Display comprehensive repository information and statistics.',
          this.createStandardOptions
        )
        .command(
          'health',
          'Assess repository health and commit quality.',
          this.createStandardOptions
        )
        .command(
          'branches',
          'Analyze all branches and unmerged commits.',
          this.createStandardOptions
        )
        .command(
          'comprehensive',
          'Comprehensive analysis including dangling commits.',
          this.createStandardOptions
        )
        .command('untracked', 'Include untracked files analysis.', this.createStandardOptions)
        .command(
          'working-dir',
          'Generate changelog from working directory changes.',
          this.createStandardOptions
        )
        .command(
          'from-commits <commits...>',
          'Generate changelog from specific commit hashes.',
          (yargs) => {
            yargs.positional('commits', { describe: 'Commit hashes to analyze', type: 'string' })
          }
        )

        // Utility commands
        .command('commit-message', 'Generate a commit message for current changes.')
        .command('commit', 'Interactive commit workflow with AI-generated messages.', (yargs) => {
          yargs
            .option('interactive', {
              alias: 'i',
              type: 'boolean',
              default: true,
              description: 'Use interactive staging (default).',
            })
            .option('all', {
              alias: 'a',
              type: 'boolean',
              description: 'Automatically stage all changes.',
            })
            .option('message', {
              alias: 'm',
              type: 'string',
              description: 'Use provided commit message (skip AI generation).',
            })
            .option('dry-run', {
              type: 'boolean',
              description: 'Preview commit message without committing.',
            })
            .option('editor', {
              alias: 'e',
              type: 'boolean',
              description: 'Open editor to review/edit commit message.',
            })
            .option('model', { type: 'string', description: 'Override the default AI model.' })
        })
        .command('stash', 'Analyze stashed changes.', (yargs) => {
          yargs
            .command('list', 'List all stashed changes.')
            .command('analyze [stash]', 'Analyze a specific stash entry.', (y) => {
              y.positional('stash', {
                describe: 'Stash reference (e.g., stash@{0})',
                default: 'stash@{0}',
                type: 'string',
              })
            })
            .command('changelog [stash]', 'Generate changelog from stashed changes.', (y) => {
              y.positional('stash', {
                describe: 'Stash reference (e.g., stash@{0})',
                default: 'stash@{0}',
                type: 'string',
              })
            })
            .demandCommand(1, 'Please specify a stash subcommand.')
        })
        .command('providers', 'Manage AI providers.', (yargs) => {
          yargs
            .command('list', 'List available providers.')
            .command('switch <provider>', 'Switch to a different provider.')
            .command('configure [provider]', 'Configure AI provider settings.')
            .command('validate [provider]', 'Validate provider models and capabilities.')
            .command('status', 'Check health status of all providers.')
            .command('models [provider]', 'List available models for a provider.', (y) => {
              y.positional('provider', {
                describe: 'Provider name (optional, shows all if not specified)',
                type: 'string',
              })
            })
            .demandCommand(1, 'Please specify a provider subcommand.')
        })

        // Global options
        .option('no-color', { type: 'boolean', description: 'Disable colored output.' })
        .option('silent', { type: 'boolean', description: 'Suppress non-essential output.' })
        .help('h')
        .alias('h', 'help')
        .epilogue(
          `For more information, visit ${colors.highlight('https://github.com/entro314-labs/ai-changelog-generator')}`
        )
        .demandCommand(0)
        .strict()
        .parse()
    )
  }

  createStandardOptions(yargs) {
    return yargs
      .option('format', {
        alias: 'f',
        type: 'string',
        choices: ['markdown', 'json', 'html'],
        default: 'markdown',
        description: 'Output format',
      })
      .option('output', { alias: 'o', type: 'string', description: 'Output file path' })
      .option('since', { type: 'string', description: 'Analyze changes since this git ref' })
      .option('author', { alias: 'a', type: 'string', description: 'Filter commits by author' })
      .option('tag-range', { type: 'string', description: 'Generate changelog between tags (v1.0..v2.0)' })
      .option('silent', { type: 'boolean', description: 'Suppress non-essential output' })
      .option('dry-run', { type: 'boolean', description: 'Preview without writing files' })
      .option('detailed', { type: 'boolean', description: 'Use detailed analysis mode' })
      .option('enterprise', { type: 'boolean', description: 'Use enterprise analysis mode' })
      .option('model', { alias: 'm', type: 'string', description: 'Override the default model' })
  }

  async showMetrics() {
    if (!this.appService || this.appService.options.silent) {
      return
    }

    const endTime = Date.now()
    const metrics = this.appService.getMetrics()

    const summaryData = {
      'Total time': formatDuration(endTime - this.startTime),
      'Commits processed': metrics.commitsProcessed || 0,
    }

    if (metrics.apiCalls > 0) {
      summaryData['AI calls'] = metrics.apiCalls
      summaryData['Total tokens'] = (metrics.totalTokens || 0).toLocaleString()
    }

    if (metrics.errors > 0) {
      summaryData.Errors = colors.error(`${metrics.errors}`)
    }

    EnhancedConsole.box('📊 Session Summary', colors.formatMetrics(summaryData), {
      borderStyle: 'rounded',
      borderColor: 'info',
    })
  }
}

// Base command class
class BaseCommand {
  async execute(_argv, _appService) {
    throw new Error('Command execute method not implemented')
  }

  processStandardFlags(argv, appService) {
    const config = {
      format: argv.format || 'markdown',
      output: argv.output,
      since: argv.since,
      author: argv.author,
      tagRange: argv.tagRange,
      silent: argv.silent,
      dryRun: argv.dryRun,
    }

    // Apply analysis mode
    if (argv.detailed) {
      appService.setAnalysisMode('detailed')
    }
    if (argv.enterprise) {
      appService.setAnalysisMode('enterprise')
    }
    if (argv.model) {
      appService.setModelOverride(argv.model)
    }

    return config
  }
}

// Command implementations
class DefaultCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)

    if (argv.interactive) {
      await appService.runInteractive()
    } else {
      const result = await appService.generateChangelog({
        version: argv.releaseVersion,
        since: argv.since,
        author: argv.author,
        tagRange: argv.tagRange,
        format: config.format,
        output: config.output,
        dryRun: config.dryRun,
      })

      // Handle output formatting
      if (result?.changelog && config.format !== 'markdown') {
        const formattedOutput = this.formatOutput(result.changelog, config.format)
        if (config.dryRun || !config.output) {
          console.log(formattedOutput)
        }
      }
    }
  }

  formatOutput(changelog, format) {
    if (format === 'json') {
      return JSON.stringify({ changelog, generatedAt: new Date().toISOString() }, null, 2)
    }
    if (format === 'html') {
      return this.convertToHtml(changelog)
    }
    return changelog
  }

  convertToHtml(markdown) {
    // Simple markdown to HTML conversion
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
      // List items
      .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
      // Inline code
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      // Paragraphs
      .replace(/\n\n/gim, '</p><p>')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Changelog</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    ul { padding-left: 2em; }
    li { margin: 0.5em 0; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
    a { color: #0066cc; }
    .generated { color: #666; font-size: 0.9em; margin-top: 2em; border-top: 1px solid #eee; padding-top: 1em; }
  </style>
</head>
<body>
  <p>${html}</p>
  <div class="generated">Generated by AI Changelog Generator on ${new Date().toLocaleString()}</div>
</body>
</html>`
  }
}

class InitCommand extends BaseCommand {
  async execute(_argv, _appService) {
    await promptForConfig()
  }
}

class ValidateCommand extends BaseCommand {
  async execute(_argv, appService) {
    const validation = await appService.validateConfiguration()

    if (validation.valid) {
      EnhancedConsole.success('✅ Configuration is valid')
    } else {
      EnhancedConsole.error('❌ Configuration has issues:')
      validation.issues.forEach((issue) => {
        EnhancedConsole.log(`  - ${issue}`)
      })

      if (validation.recommendations.length > 0) {
        EnhancedConsole.info('\n💡 Recommendations:')
        validation.recommendations.forEach((rec) => {
          EnhancedConsole.log(`  - ${rec}`)
        })
      }
    }
  }
}

class AnalyzeCommand extends BaseCommand {
  async execute(argv, appService) {
    const _config = this.processStandardFlags(argv, appService)
    await appService.analyzeCurrentChanges()
  }
}

class AnalyzeCommitsCommand extends BaseCommand {
  async execute(argv, appService) {
    const _config = this.processStandardFlags(argv, appService)
    await appService.analyzeRecentCommits(argv.limit || 10)
  }
}

class GitInfoCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    await appService.analyzeRepository({ type: 'git-info', ...config })
  }
}

class HealthCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    await appService.assessHealth(config)
  }
}

class BranchesCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    await appService.analyzeRepository({ type: 'branches', ...config })
  }
}

class ComprehensiveCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    await appService.analyzeRepository({ type: 'comprehensive', ...config })
  }
}

class UntrackedCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    await appService.analyzeRepository({ type: 'untracked', ...config })
  }
}

class WorkingDirCommand extends BaseCommand {
  async execute(argv, appService) {
    const _config = this.processStandardFlags(argv, appService)
    await appService.generateChangelogFromChanges(argv.releaseVersion)
  }
}

class FromCommitsCommand extends BaseCommand {
  async execute(argv, appService) {
    const _config = this.processStandardFlags(argv, appService)
    console.log(colors.processingMessage(`🔍 Generating changelog from commits: ${argv.commits.join(', ')}`))

    try {
      const result = await appService.generateChangelogFromCommits(argv.commits)

      if (result?.changelog) {
        console.log(colors.successMessage('\n✅ Changelog generated successfully!'))
        console.log(colors.dim('─'.repeat(50)))
        console.log(result.changelog)
      } else {
        console.log(colors.warningMessage('No changelog could be generated from the specified commits.'))
      }
    } catch (error) {
      console.error(colors.errorMessage(`Error generating changelog: ${error.message}`))
    }
  }
}

class CommitMessageCommand extends BaseCommand {
  async execute(_argv, appService) {
    console.log(
      colors.processingMessage('🤖 Analyzing current changes for commit message suggestions...')
    )

    try {
      const result = await appService.generateCommitMessage()

      if (result?.suggestions && result.suggestions.length > 0) {
        console.log(colors.successMessage('\n✅ Generated commit message suggestions:'))
        result.suggestions.forEach((suggestion, index) => {
          console.log(`${colors.number(index + 1)}. ${colors.highlight(suggestion)}`)
        })

        if (result.context) {
          console.log(colors.dim(`\nContext: ${result.context}`))
        }
      } else {
        console.log(colors.warningMessage('No commit message suggestions could be generated.'))
        console.log(colors.infoMessage('Make sure you have uncommitted changes.'))
      }
    } catch (error) {
      console.error(colors.errorMessage(`Error generating commit message: ${error.message}`))
    }
  }
}

class CommitCommand extends BaseCommand {
  async execute(argv, appService) {
    console.log(colors.processingMessage('🚀 Starting interactive commit workflow...'))

    try {
      // Process flags and model override
      if (argv.model) {
        appService.setModelOverride(argv.model)
      }

      // Execute the commit workflow
      const result = await appService.executeCommitWorkflow({
        interactive: argv.interactive !== false, // Default to true unless explicitly false
        stageAll: argv.all,
        customMessage: argv.message,
        dryRun: argv.dryRun,
        useEditor: argv.editor,
      })

      if (result?.success) {
        if (argv.dryRun) {
          console.log(colors.successMessage('✅ Commit workflow completed (dry-run mode)'))
          console.log(colors.highlight(`Proposed commit message:\n${result.commitMessage}`))
        } else {
          console.log(colors.successMessage('✅ Changes committed successfully!'))
          console.log(colors.highlight(`Commit: ${result.commitHash}`))
          console.log(colors.dim(`Message: ${result.commitMessage}`))
        }
      } else {
        console.log(colors.warningMessage('Commit workflow cancelled or no changes to commit.'))
      }
    } catch (error) {
      console.error(colors.errorMessage(`Commit workflow failed: ${error.message}`))

      // Provide helpful suggestions based on error type
      if (error.message.includes('No changes')) {
        console.log(
          colors.infoMessage('💡 Try making some changes first, then run the commit command.')
        )
      } else if (error.message.includes('git')) {
        console.log(
          colors.infoMessage(
            '💡 Make sure you are in a git repository and git is properly configured.'
          )
        )
      }
    }
  }
}

class ProvidersCommand extends BaseCommand {
  async execute(argv, appService) {
    const subcommand = argv._[1]

    switch (subcommand) {
      case 'list':
        await this.listProviders(appService)
        break
      case 'switch':
        await this.switchProvider(appService, argv.provider)
        break
      case 'configure':
        await this.configureProvider(appService, argv.provider)
        break
      case 'validate':
        await this.validateProvider(appService, argv.provider)
        break
      case 'status':
        await this.checkProviderStatus(appService)
        break
      case 'models':
        await this.listModels(appService, argv.provider)
        break
      default:
        console.log(colors.errorMessage('Unknown provider subcommand'))
        console.log(colors.infoMessage('Available subcommands: list, switch, configure, validate, status, models'))
    }
  }

  async listProviders(appService) {
    try {
      const providers = await appService.listProviders()

      console.log(colors.header('\n🤖 Available AI Providers:'))

      providers.forEach((provider) => {
        const status = provider.available ? '✅ Available' : '⚠️  Needs configuration'
        const activeIndicator = provider.active ? ' 🎯 (Active)' : ''

        console.log(`  ${colors.highlight(provider.name)} - ${status}${activeIndicator}`)

        if (provider.capabilities && Object.keys(provider.capabilities).length > 0) {
          const caps = Object.entries(provider.capabilities)
            .filter(([_key, value]) => value === true)
            .map(([key]) => key)
            .join(', ')
          if (caps) {
            console.log(`    ${colors.dim(`Capabilities: ${caps}`)}`)
          }
        }
      })

      console.log(
        colors.dim('\nUse "ai-changelog providers configure <provider>" to set up a provider')
      )
    } catch (error) {
      EnhancedConsole.error(`Error listing providers: ${error.message}`)
    }
  }

  async switchProvider(appService, providerName) {
    if (!providerName) {
      console.log(colors.errorMessage('Please specify a provider name'))
      console.log(colors.infoMessage('Usage: ai-changelog providers switch <provider>'))
      return
    }

    try {
      const result = await appService.switchProvider(providerName)

      if (result.success) {
        console.log(colors.successMessage(`✅ Switched to ${providerName} provider`))
      } else {
        console.log(colors.errorMessage(`❌ Failed to switch provider: ${result.error}`))
        console.log(
          colors.infoMessage('Use "ai-changelog providers list" to see available providers')
        )
      }
    } catch (error) {
      EnhancedConsole.error(`Error switching provider: ${error.message}`)
    }
  }

  async configureProvider(appService, providerName) {
    const { select } = await import('@clack/prompts')

    try {
      // If no provider specified, let user choose
      if (!providerName) {
        const providers = await appService.listProviders()

        const choices = providers.map((p) => ({
          value: p.name,
          label: `${p.name} ${p.available ? '✅' : '⚠️ (needs configuration)'}`,
        }))

        providerName = await select({
          message: 'Select provider to configure:',
          options: choices,
        })
      }

      console.log(colors.header(`\n🔧 Configuring ${providerName.toUpperCase()} Provider`))
      console.log(colors.infoMessage('Please add the following to your .env.local file:\n'))

      switch (providerName.toLowerCase()) {
        case 'openai':
          console.log(colors.code('OPENAI_API_KEY=your_openai_api_key_here'))
          console.log(colors.dim('Get your API key from: https://platform.openai.com/api-keys'))
          break

        case 'anthropic':
          console.log(colors.code('ANTHROPIC_API_KEY=your_anthropic_api_key_here'))
          console.log(colors.dim('Get your API key from: https://console.anthropic.com/'))
          break

        case 'azure':
          console.log(colors.code('AZURE_OPENAI_API_KEY=your_azure_api_key_here'))
          console.log(colors.code('AZURE_OPENAI_ENDPOINT=your_azure_endpoint_here'))
          console.log(colors.dim('Get from your Azure OpenAI resource in Azure portal'))
          break

        case 'google':
          console.log(colors.code('GOOGLE_API_KEY=your_google_api_key_here'))
          console.log(colors.dim('Get your API key from: https://aistudio.google.com/app/apikey'))
          break

        case 'ollama':
          console.log(colors.code('OLLAMA_HOST=http://localhost:11434'))
          console.log(colors.dim('Make sure Ollama is running: ollama serve'))
          break

        default:
          console.log(colors.code(`${providerName.toUpperCase()}_API_KEY=your_api_key_here`))
      }

      console.log(colors.infoMessage('\nAfter adding the configuration, run:'))
      console.log(colors.highlight(`ai-changelog providers validate ${providerName}`))
    } catch (error) {
      EnhancedConsole.error(`Error configuring provider: ${error.message}`)
    }
  }

  async validateProvider(appService, providerName) {
    try {
      if (!providerName) {
        console.log(colors.processingMessage('🔍 Validating all configured providers...'))
        const result = await appService.validateAllProviders()

        console.log(colors.header('\n📊 Provider Validation Results:'))

        Object.entries(result).forEach(([name, validation]) => {
          const status = validation.success ? '✅ Valid' : '❌ Invalid'
          console.log(`  ${colors.highlight(name)}: ${status}`)

          if (!validation.success) {
            console.log(`    ${colors.errorMessage(validation.error)}`)
          }
        })
      } else {
        console.log(colors.processingMessage(`🔍 Validating ${providerName} provider...`))
        const result = await appService.validateProvider(providerName)

        if (result.success) {
          console.log(colors.successMessage(`✅ ${providerName} provider is configured correctly`))
          if (result.model) {
            console.log(colors.dim(`   Default model: ${result.model}`))
          }
        } else {
          console.log(colors.errorMessage(`❌ ${providerName} validation failed: ${result.error}`))
          console.log(
            colors.infoMessage(
              `Use "ai-changelog providers configure ${providerName}" for setup instructions`
            )
          )
        }
      }
    } catch (error) {
      EnhancedConsole.error(`Error validating provider: ${error.message}`)
    }
  }

  async checkProviderStatus(appService) {
    console.log(colors.processingMessage('🏥 Checking provider health status...'))

    try {
      const providers = await appService.listProviders()
      const healthResults = []

      for (const provider of providers) {
        if (provider.available) {
          const startTime = Date.now()
          try {
            const validation = await appService.validateProvider(provider.name)
            const responseTime = Date.now() - startTime

            healthResults.push({
              name: provider.name,
              status: validation.success ? 'healthy' : 'unhealthy',
              responseTime,
              model: validation.model || 'N/A',
              error: validation.error || null,
              active: provider.active,
            })
          } catch (error) {
            healthResults.push({
              name: provider.name,
              status: 'error',
              responseTime: Date.now() - startTime,
              error: error.message,
              active: provider.active,
            })
          }
        } else {
          healthResults.push({
            name: provider.name,
            status: 'unconfigured',
            responseTime: null,
            error: 'Not configured',
            active: false,
          })
        }
      }

      // Display results
      console.log(colors.header('\n🏥 Provider Health Status:\n'))

      const statusIcons = {
        healthy: '🟢',
        unhealthy: '🔴',
        error: '🔴',
        unconfigured: '⚪',
      }

      healthResults.forEach((result) => {
        const icon = statusIcons[result.status] || '⚪'
        const activeMarker = result.active ? ' 🎯' : ''
        const responseInfo = result.responseTime ? ` (${result.responseTime}ms)` : ''

        console.log(`  ${icon} ${colors.highlight(result.name)}${activeMarker}`)
        console.log(`     Status: ${result.status}${responseInfo}`)

        if (result.model && result.status === 'healthy') {
          console.log(`     Model: ${colors.dim(result.model)}`)
        }

        if (result.error && result.status !== 'unconfigured') {
          console.log(`     Error: ${colors.errorMessage(result.error)}`)
        }

        console.log('')
      })

      // Summary
      const healthy = healthResults.filter((r) => r.status === 'healthy').length
      const unhealthy = healthResults.filter((r) => ['unhealthy', 'error'].includes(r.status)).length
      const unconfigured = healthResults.filter((r) => r.status === 'unconfigured').length

      console.log(colors.dim('─'.repeat(40)))
      console.log(
        `Summary: ${colors.successMessage(`${healthy} healthy`)}, ${unhealthy > 0 ? colors.errorMessage(`${unhealthy} unhealthy`) : `${unhealthy} unhealthy`}, ${unconfigured} unconfigured`
      )
    } catch (error) {
      EnhancedConsole.error(`Error checking provider status: ${error.message}`)
    }
  }

  async listModels(appService, providerName) {
    console.log(colors.processingMessage('🔍 Discovering available models...'))

    try {
      const providers = await appService.listProviders()

      if (providerName) {
        // List models for specific provider
        const provider = providers.find((p) => p.name.toLowerCase() === providerName.toLowerCase())
        if (!provider) {
          console.log(colors.errorMessage(`Provider '${providerName}' not found.`))
          console.log(colors.infoMessage('Use "ai-changelog providers list" to see available providers.'))
          return
        }

        console.log(colors.header(`\n📦 Models for ${provider.name}:\n`))

        if (provider.models && provider.models.length > 0) {
          provider.models.forEach((model) => {
            const isDefault = model === provider.defaultModel ? ' 🎯 (default)' : ''
            console.log(`  ${colors.highlight(model)}${isDefault}`)
          })
        } else {
          // Show known models from config
          const knownModels = this.getKnownModelsForProvider(provider.name)
          if (knownModels.length > 0) {
            console.log(colors.dim('  Known models (from configuration):'))
            knownModels.forEach((model) => {
              console.log(`  ${colors.highlight(model)}`)
            })
          } else {
            console.log(colors.infoMessage('  No model information available.'))
          }
        }
      } else {
        // List models for all available providers
        console.log(colors.header('\n📦 Available Models by Provider:\n'))

        for (const provider of providers) {
          if (!provider.available) continue

          console.log(`${colors.highlight(provider.name)}:`)

          if (provider.models && provider.models.length > 0) {
            provider.models.slice(0, 5).forEach((model) => {
              const isDefault = model === provider.defaultModel ? ' 🎯' : ''
              console.log(`  ${colors.dim('•')} ${model}${isDefault}`)
            })
            if (provider.models.length > 5) {
              console.log(`  ${colors.dim(`... and ${provider.models.length - 5} more`)}`)
            }
          } else {
            const knownModels = this.getKnownModelsForProvider(provider.name)
            knownModels.slice(0, 3).forEach((model) => {
              console.log(`  ${colors.dim('•')} ${model}`)
            })
          }
          console.log('')
        }
      }
    } catch (error) {
      EnhancedConsole.error(`Error listing models: ${error.message}`)
    }
  }

  getKnownModelsForProvider(providerName) {
    const knownModels = {
      openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'],
      anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
      google: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
      azure: ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo'],
      ollama: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'deepseek-coder'],
      lmstudio: ['local-model'],
      bedrock: ['anthropic.claude-3-sonnet', 'anthropic.claude-3-haiku', 'amazon.titan-text-express'],
      vertex: ['gemini-1.5-pro', 'gemini-1.5-flash'],
      huggingface: ['mistralai/Mistral-7B-Instruct-v0.2', 'google/flan-t5-xxl'],
    }
    return knownModels[providerName.toLowerCase()] || []
  }
}

class StashCommand extends BaseCommand {
  async execute(argv, appService) {
    const subcommand = argv._[1]

    switch (subcommand) {
      case 'list':
        await this.listStashes(appService)
        break
      case 'analyze':
        await this.analyzeStash(appService, argv.stash)
        break
      case 'changelog':
        await this.generateStashChangelog(appService, argv.stash)
        break
      default:
        console.log(colors.errorMessage('Unknown stash subcommand'))
        console.log(colors.infoMessage('Available subcommands: list, analyze, changelog'))
    }
  }

  async listStashes(appService) {
    try {
      const stashes = appService.orchestrator.gitManager.getStashList()

      if (stashes.length === 0) {
        console.log(colors.infoMessage('No stashed changes found.'))
        return
      }

      console.log(colors.header(`\n📦 Stashed Changes (${stashes.length}):\n`))

      stashes.forEach((stash, index) => {
        console.log(`  ${colors.highlight(stash.index)}`)
        console.log(`    ${colors.dim('Message:')} ${stash.message}`)
        console.log(`    ${colors.dim('Date:')} ${stash.date}`)
        if (index < stashes.length - 1) console.log('')
      })

      console.log(colors.dim('\nUse "ai-changelog stash analyze <stash>" to see details'))
    } catch (error) {
      EnhancedConsole.error(`Error listing stashes: ${error.message}`)
    }
  }

  async analyzeStash(appService, stashRef = 'stash@{0}') {
    console.log(colors.processingMessage(`🔍 Analyzing ${stashRef}...`))

    try {
      const details = appService.orchestrator.gitManager.getStashDetails(stashRef)

      if (!details) {
        console.log(colors.errorMessage(`Stash '${stashRef}' not found.`))
        return
      }

      console.log(colors.header(`\n📦 Stash Analysis: ${stashRef}\n`))
      console.log(`${colors.dim('Message:')} ${details.message}`)
      console.log(`${colors.dim('Files changed:')} ${details.stats.filesChanged}`)
      console.log(`${colors.dim('Insertions:')} ${colors.success(`+${details.stats.insertions}`)}`)
      console.log(`${colors.dim('Deletions:')} ${colors.error(`-${details.stats.deletions}`)}`)

      console.log(colors.header('\n📁 Files:\n'))
      details.files.forEach((file) => {
        console.log(`  ${colors.highlight(file.path)} (${file.changes} changes)`)
      })

      console.log(colors.dim('\nUse "ai-changelog stash changelog" to generate changelog'))
    } catch (error) {
      EnhancedConsole.error(`Error analyzing stash: ${error.message}`)
    }
  }

  async generateStashChangelog(appService, stashRef = 'stash@{0}') {
    console.log(colors.processingMessage(`📝 Generating changelog from ${stashRef}...`))

    try {
      const details = appService.orchestrator.gitManager.getStashDetails(stashRef)

      if (!details) {
        console.log(colors.errorMessage(`Stash '${stashRef}' not found.`))
        return
      }

      // Create pseudo-commit data for AI analysis
      const stashData = {
        hash: stashRef.replace(/[{}@]/g, ''),
        message: details.message || 'Stashed changes',
        files: details.files.map((f) => ({
          filePath: f.path,
          status: 'modified',
          diff: '',
        })),
        diff: details.diff,
        stats: details.stats,
      }

      // Analyze with AI if available
      if (appService.orchestrator.aiAnalysisService?.hasAI) {
        console.log(colors.processingMessage('🤖 Analyzing stashed changes with AI...'))

        const analysis = await appService.orchestrator.aiAnalysisService.analyzeCommit(stashData)

        console.log(colors.header('\n📋 Stash Changelog:\n'))
        console.log(`## Stashed Changes\n`)
        console.log(`**Summary:** ${analysis?.summary || details.message}`)
        console.log(`**Impact:** ${analysis?.impact || 'medium'}`)
        console.log(`**Category:** ${analysis?.category || 'chore'}`)

        if (analysis?.description) {
          console.log(`\n${analysis.description}`)
        }

        console.log(`\n**Files affected:** ${details.files.length}`)
        details.files.forEach((f) => {
          console.log(`- ${f.path}`)
        })
      } else {
        // Basic changelog without AI
        console.log(colors.header('\n📋 Stash Changelog:\n'))
        console.log(`## Stashed Changes\n`)
        console.log(`**Message:** ${details.message}`)
        console.log(`**Stats:** ${details.stats.filesChanged} files, +${details.stats.insertions}/-${details.stats.deletions}`)

        console.log(`\n**Files affected:**`)
        details.files.forEach((f) => {
          console.log(`- ${f.path}`)
        })
      }
    } catch (error) {
      EnhancedConsole.error(`Error generating stash changelog: ${error.message}`)
    }
  }
}

// Export the controller
export default CLIController
