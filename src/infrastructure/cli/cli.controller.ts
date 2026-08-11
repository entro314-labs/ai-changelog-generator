import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'

import { ApplicationService } from '../../application/services/application.service.js'
import colors from '../../shared/constants/colors.js'
import { handleCLIError, setupProcessErrorHandlers } from '../../shared/utils/cli-entry-utils.js'
import { EnhancedConsole } from '../../shared/utils/cli-ui.js'
import { encodeBedrockCredential } from '../providers/utils/provider-utils.js'
import {
  formatChangelogOutput,
  formatDuration,
  handleUnifiedOutput,
  promptForConfig,
} from '../../shared/utils/utils.js'

const CLI_CONTROLLER_DIR = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_JSON_PATHS = [
  path.resolve(CLI_CONTROLLER_DIR, '../../../package.json'),
  path.resolve(CLI_CONTROLLER_DIR, '../../../../package.json'),
]

function getPackageVersion(): string {
  try {
    const packageJsonPath = PACKAGE_JSON_PATHS.find((candidatePath) => existsSync(candidatePath))
    if (!packageJsonPath) {
      return '0.0.0'
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: string
    }

    return packageJson.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const CLI_VERSION = getPackageVersion()

export class CLIController {
  [key: string]: any
  constructor() {
    this.commands = new Map<any, any>()
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
    this.commands.set('health', new HealthCommand())
    this.commands.set('branches', new BranchesCommand())
    this.commands.set('comprehensive', new ComprehensiveCommand())
    this.commands.set('working-dir', new WorkingDirCommand())
    this.commands.set('from-commits', new FromCommitsCommand())
    this.commands.set('commit-message', new CommitMessageCommand())
    this.commands.set('commit', new CommitCommand())
    this.commands.set('providers', new ProvidersCommand())
    this.commands.set('stash', new StashCommand())
  }

  async runCLI() {
    try {
      const argv = await this.setupYargs()

      if (argv.help || argv.version) {
        return
      }

      const commandName = argv._[0] || 'default'
      const command = this.commands.get(commandName)

      if (!command) {
        throw new Error(`Unknown command: ${commandName}`)
      }

      if (!command.requiresApplicationService()) {
        await command.execute(argv, null)
        return
      }

      // Initialize application service with CLI options
      this.appService = new ApplicationService({
        dryRun: argv.dryRun,
        noColor: argv.noColor,
        silent: argv.silent,
      })

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
              alias: 'r',
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
            .option('template', {
              alias: 't',
              type: 'string',
              choices: ['standard', 'keep-a-changelog', 'simple', 'semantic', 'github'],
              description: 'Changelog template to render.',
            })
            .option('model', {
              alias: 'm',
              type: 'string',
              description: 'Override the default model.',
            })
            .option('detailed', { type: 'boolean', description: 'Use detailed analysis mode.' })
            .option('enterprise', { type: 'boolean', description: 'Use enterprise analysis mode.' })
            .option('ai', {
              type: 'boolean',
              default: true,
              description: 'Use AI analysis (use --no-ai for rule-based analysis only).',
            })
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
        .command('validate', 'Validate your configuration and connectivity.', (yargs) =>
          yargs.option('exit-code', {
            type: 'boolean',
            default: false,
            description:
              'Exit with a non-zero status code when the configuration is invalid (for CI).',
          })
        )
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
            .option('verify', {
              type: 'boolean',
              default: true,
              description: 'Run the conventional-commit gate (use --no-verify to skip it).',
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
                .option('format', {
                  alias: 'f',
                  type: 'string',
                  choices: ['markdown', 'json', 'html'],
                  default: 'markdown',
                  description: 'Output format for the changelog.',
                })
                .option('output', {
                  alias: 'o',
                  type: 'string',
                  description: 'Output file path.',
                })
                .option('dry-run', {
                  type: 'boolean',
                  description: 'Preview changelog without writing to file.',
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
        .version(CLI_VERSION)
        .alias('version', 'v')
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
      .option('tag-range', {
        type: 'string',
        description: 'Generate changelog between tags (v1.0..v2.0)',
      })
      .option('silent', { type: 'boolean', description: 'Suppress non-essential output' })
      .option('dry-run', { type: 'boolean', description: 'Preview without writing files' })
      .option('detailed', { type: 'boolean', description: 'Use detailed analysis mode' })
      .option('enterprise', { type: 'boolean', description: 'Use enterprise analysis mode' })
      .option('ai', {
        type: 'boolean',
        default: true,
        description: 'Use AI analysis (use --no-ai for rule-based analysis only)',
      })
      .option('model', { alias: 'm', type: 'string', description: 'Override the default model' })
  }

  async showMetrics() {
    if (!this.appService || this.appService.options.silent) {
      return
    }

    const endTime = Date.now()
    const metrics = this.appService.getMetrics()

    const summaryData: Record<string, string | number> = {
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
  [key: string]: any
  async execute(_argv, _appService) {
    throw new Error('Command execute method not implemented')
  }

  requiresApplicationService() {
    return true
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
      // `--no-ai` (yargs negates the boolean `ai` option) toggles the analysis engine's
      // AI gate. Only thread `false` so the engine default (AI on) is preserved otherwise.
      includeAIAnalysis: argv.ai !== false,
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
  [key: string]: any
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
        template: argv.template,
        includeAttribution: !argv.noAttribution,
        includeAIAnalysis: config.includeAIAnalysis,
      })

      // Echo the changelog to the console only when it is not being written to a
      // dedicated file (or in dry-run). Route through the shared formatChangelogOutput
      // so the console echo matches the on-disk output (markdown/json/html) byte-for-byte.
      if (result?.changelog && (config.dryRun || !config.output)) {
        const formattedOutput = formatChangelogOutput(result.changelog, config.format, {
          version: argv.releaseVersion,
        })
        console.log(formattedOutput)
      }
    }
  }
}

class InitCommand extends BaseCommand {
  [key: string]: any
  requiresApplicationService() {
    return false
  }

  async execute(_argv, _appService) {
    await promptForConfig()
  }
}

class ValidateCommand extends BaseCommand {
  [key: string]: any
  async execute(argv, appService) {
    const validation = await appService.validateConfiguration()

    if (validation.valid) {
      EnhancedConsole.success('✅ Configuration is valid')
      return
    }

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

    // Surface failure as a non-zero exit code for CI when requested (README documents
    // `ai-changelog validate --exit-code`). Use process.exitCode so buffered output flushes.
    if (argv.exitCode) {
      process.exitCode = 1
    }
  }
}

class AnalyzeCommand extends BaseCommand {
  [key: string]: any
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    // Forward the standard-flag filters (since/author/tagRange) and the AI toggle into
    // the analysis so they reach the underlying git query instead of being discarded.
    await appService.analyzeCurrentChanges({
      since: config.since,
      author: config.author,
      tagRange: config.tagRange,
      includeAIAnalysis: config.includeAIAnalysis,
    })
  }
}

class AnalyzeCommitsCommand extends BaseCommand {
  [key: string]: any
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    await appService.analyzeRecentCommits(argv.limit || 10, {
      since: config.since,
      author: config.author,
      tagRange: config.tagRange,
      includeAIAnalysis: config.includeAIAnalysis,
    })
  }
}

class HealthCommand extends BaseCommand {
  [key: string]: any
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    await appService.assessHealth(config)
  }
}

class BranchesCommand extends BaseCommand {
  [key: string]: any
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    await appService.analyzeRepository({ type: 'branches', ...config })
  }
}

class ComprehensiveCommand extends BaseCommand {
  [key: string]: any
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    await appService.analyzeRepository({ type: 'comprehensive', ...config })
  }
}

class WorkingDirCommand extends BaseCommand {
  [key: string]: any
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    // Forward the working-dir flags so --format/--output/--dry-run and the analysis-mode /
    // attribution toggles actually reach the changelog generator (C-1 propagation).
    await appService.generateChangelogFromChanges(argv.releaseVersion, {
      analysisMode: argv.enterprise ? 'enterprise' : argv.detailed ? 'detailed' : undefined,
      includeAttribution: !argv.noAttribution,
      format: config.format,
      outputFile: config.output,
      dryRun: config.dryRun,
    })
  }
}

class FromCommitsCommand extends BaseCommand {
  [key: string]: any
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService)
    EnhancedConsole.processing(`Generating changelog from commits: ${argv.commits.join(', ')}`)

    try {
      // Forward the AI toggle so --no-ai reaches the analysis engine; format/output/dryRun
      // are honored below via the shared unified writer (C-1 propagation).
      const result = await appService.generateChangelogFromCommits(argv.commits, {
        format: config.format,
        outputFile: config.output,
        dryRun: config.dryRun,
        includeAIAnalysis: config.includeAIAnalysis,
      })

      if (result?.changelog) {
        EnhancedConsole.success('Changelog generated successfully!')
        EnhancedConsole.divider()
        // Route through the shared writer so console echo uses formatChangelogOutput and
        // file output (when --output is set) is written via the same unified gate.
        handleUnifiedOutput(result.changelog, {
          format: config.format,
          outputFile: config.output,
          silent: config.silent,
          dryRun: config.dryRun,
        })
      } else {
        EnhancedConsole.warn('No changelog could be generated from the specified commits.')
      }
    } catch (error) {
      EnhancedConsole.error(`Error generating changelog: ${error.message}`)
    }
  }
}

class CommitMessageCommand extends BaseCommand {
  [key: string]: any
  async execute(_argv, appService) {
    EnhancedConsole.processing('Analyzing current changes for commit message suggestions...')

    try {
      const result = await appService.generateCommitMessage()

      if (result?.message) {
        EnhancedConsole.success('Generated commit message:')
        console.log(colors.highlight(result.message))

        if (result.validation) {
          console.log(colors.dim(`Validation score: ${result.validation.score || 0}/100`))
        }
      } else {
        EnhancedConsole.warn('No commit message could be generated.')
        EnhancedConsole.info('Make sure you have staged changes.')
      }
    } catch (error) {
      EnhancedConsole.error(`Error generating commit message: ${error.message}`)
    }
  }
}

class CommitCommand extends BaseCommand {
  [key: string]: any
  async execute(argv, appService) {
    EnhancedConsole.processing('Starting interactive commit workflow...')

    try {
      // Process flags and model override
      if (argv.model) {
        appService.setModelOverride(argv.model)
      }

      // Execute the commit workflow. `verify === false` (CLI `--no-verify`) skips the
      // conventional-commit gate; --editor/--model are forwarded so they reach the
      // workflow rather than being dropped.
      const result = await appService.executeCommitWorkflow({
        interactive: argv.interactive !== false, // Default to true unless explicitly false
        all: argv.all,
        message: argv.message,
        dryRun: argv.dryRun,
        editor: argv.editor,
        model: argv.model,
        verify: argv.verify,
      })

      if (result?.success) {
        if (argv.dryRun) {
          EnhancedConsole.success('Commit workflow completed (dry-run mode)')
          console.log(colors.highlight(`Proposed commit message:\n${result.commitMessage}`))
        } else {
          EnhancedConsole.success('Changes committed successfully!')
          console.log(colors.highlight(`Commit: ${result.commitHash}`))
          console.log(colors.dim(`Message: ${result.commitMessage}`))
        }
      } else {
        EnhancedConsole.warn('Commit workflow cancelled or no changes to commit.')
      }
    } catch (error) {
      EnhancedConsole.error(`Commit workflow failed: ${error.message}`)

      // Provide helpful suggestions based on error type
      if (error.message.includes('No changes')) {
        EnhancedConsole.info('Try making some changes first, then run the commit command.')
      } else if (error.message.includes('git')) {
        EnhancedConsole.info('Make sure you have uncommitted changes.')
      }
    }
  }
}

class ProvidersCommand extends BaseCommand {
  [key: string]: any
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
        EnhancedConsole.error('Unknown provider subcommand')
        EnhancedConsole.info(
          'Available subcommands: list, switch, configure, validate, status, models'
        )
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
      EnhancedConsole.error('Please specify a provider name')
      EnhancedConsole.info('Usage: ai-changelog providers switch <provider>')
      return
    }

    try {
      const result = await appService.switchProvider(providerName)

      if (result.success) {
        EnhancedConsole.success(`Switched to ${providerName} provider`)
      } else {
        EnhancedConsole.error(`Failed to switch provider: ${result.error}`)
        EnhancedConsole.info('Use "ai-changelog providers list" to see available providers')
      }
    } catch (error) {
      EnhancedConsole.error(`Error switching provider: ${error.message}`)
    }
  }

  async configureProvider(appService, providerName) {
    const { select, text, isCancel } = await import('@clack/prompts')

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
      EnhancedConsole.info('Please add the following to your .env.local file:\n')

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
          console.log(colors.code('AZURE_OPENAI_KEY=your_azure_api_key_here'))
          console.log(colors.code('AZURE_OPENAI_ENDPOINT=your_azure_endpoint_here'))
          console.log(colors.dim('Get from your Azure OpenAI resource in Azure portal'))
          break

        case 'google':
          console.log(colors.code('GOOGLE_API_KEY=your_google_api_key_here'))
          console.log(colors.dim('Get your API key from: https://aistudio.google.com/app/apikey'))
          break

        case 'bedrock':
          console.log(colors.code('AWS_ACCESS_KEY_ID=your_access_key_id'))
          console.log(colors.code('AWS_SECRET_ACCESS_KEY=your_secret_access_key'))
          console.log(colors.code('AWS_REGION=us-east-1'))
          console.log(colors.dim('Temporary credentials may also require AWS_SESSION_TOKEN'))
          break

        case 'ollama':
          console.log(colors.code('OLLAMA_HOST=http://localhost:11434'))
          console.log(colors.dim('Make sure Ollama is running: ollama serve'))
          break

        default:
          console.log(colors.code(`${providerName.toUpperCase()}_API_KEY=your_api_key_here`))
      }

      // Offer to store the credential securely now via the UnifiedCredentialManager
      // (OS keychain or encrypted config file) instead of requiring a manual .env.local edit.
      const storage = await select({
        message: 'Store a credential securely now?',
        options: [
          { value: 'keychain', label: 'OS keychain (recommended)' },
          { value: 'config', label: 'Encrypted config file (~/.config/ai-changelog)' },
          { value: 'skip', label: "Skip — I'll set an environment variable myself" },
        ],
      })

      if (!isCancel(storage) && storage !== 'skip') {
        let key: string | symbol
        if (providerName.toLowerCase() === 'bedrock') {
          const accessKeyId = await text({
            message: 'Enter the AWS access key ID:',
            validate: (value) =>
              /^(AKIA|ASIA)[A-Z0-9]{16}$/.test(value?.trim() || '')
                ? undefined
                : 'Enter a 20-character AKIA or ASIA access key ID',
          })
          if (isCancel(accessKeyId)) return
          const secretAccessKey = await text({
            message: 'Enter the AWS secret access key:',
            validate: (value) => (value?.trim() ? undefined : 'A value is required'),
          })
          if (isCancel(secretAccessKey)) return
          const sessionToken = await text({
            message: 'Enter the AWS session token (leave empty for long-lived credentials):',
          })
          if (isCancel(sessionToken)) return
          const region = await text({
            message: 'Enter the AWS region:',
            placeholder: 'us-east-1',
          })
          if (isCancel(region)) return
          key = encodeBedrockCredential({
            accessKeyId: String(accessKeyId),
            secretAccessKey: String(secretAccessKey),
            sessionToken: String(sessionToken || '') || undefined,
            region: String(region || '') || 'us-east-1',
          })
        } else {
          key = await text({
            message: `Enter the ${providerName} API key / token:`,
            validate: (value) => (value && value.trim() ? undefined : 'A value is required'),
          })
        }

        if (!isCancel(key) && key) {
          const result = await appService.storeCredential(
            providerName.toLowerCase(),
            String(key).trim(),
            String(storage)
          )
          if (result.success) {
            EnhancedConsole.success(
              `✅ Stored ${providerName} credential in ${result.storageType}.`
            )
          } else {
            EnhancedConsole.error(`Could not store credential securely: ${result.error}`)
            EnhancedConsole.info('You can still configure it via .env.local as shown above.')
          }
        }
      }

      EnhancedConsole.info('\nValidate the configuration with:')
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

        Object.entries(result as Record<string, { success: boolean; error?: string }>).forEach(
          ([name, validation]) => {
            const status = validation.success ? '✅ Valid' : '❌ Invalid'
            console.log(`  ${colors.highlight(name)}: ${status}`)

            if (!validation.success) {
              console.log(`    ${colors.errorMessage(validation.error)}`)
            }
          }
        )
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
      const healthResults: any[] = []

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
      const unhealthy = healthResults.filter((r) =>
        ['unhealthy', 'error'].includes(r.status)
      ).length
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
          console.log(
            colors.infoMessage('Use "ai-changelog providers list" to see available providers.')
          )
          return
        }

        console.log(colors.header(`\n📦 Models for ${provider.name}:\n`))

        // Pull REAL models from the live provider (no hardcoded list).
        const models = await appService.getProviderModels(provider.name)
        const defaultModel = this.resolveDefaultModel(provider)

        if (models && models.length > 0) {
          models.forEach((model) => {
            const isDefault = model === defaultModel ? ' 🎯 (default)' : ''
            console.log(`  ${colors.highlight(model)}${isDefault}`)
          })
        } else {
          console.log(colors.infoMessage('  No model information available.'))
        }
      } else {
        // List models for all available providers
        console.log(colors.header('\n📦 Available Models by Provider:\n'))

        for (const provider of providers) {
          if (!provider.available) {
            continue
          }

          console.log(`${colors.highlight(provider.name)}:`)

          const models = await appService.getProviderModels(provider.name)
          const defaultModel = this.resolveDefaultModel(provider)

          if (models && models.length > 0) {
            models.slice(0, 5).forEach((model) => {
              const isDefault = model === defaultModel ? ' 🎯' : ''
              console.log(`  ${colors.dim('•')} ${model}${isDefault}`)
            })
            if (models.length > 5) {
              console.log(`  ${colors.dim(`... and ${models.length - 5} more`)}`)
            }
          } else {
            console.log(`  ${colors.dim('No model information available.')}`)
          }
          console.log('')
        }
      }
    } catch (error) {
      EnhancedConsole.error(`Error listing models: ${error.message}`)
    }
  }

  resolveDefaultModel(provider) {
    // The default model is reported on the provider's configuration (listProviders()
    // surfaces each provider instance's getConfiguration() under `configuration`).
    return (
      provider.defaultModel ||
      provider.configuration?.model ||
      provider.configuration?.defaultModel ||
      null
    )
  }
}

class StashCommand extends BaseCommand {
  [key: string]: any
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
        await this.generateStashChangelog(appService, argv.stash, {
          format: argv.format || 'markdown',
          output: argv.output,
          dryRun: argv.dryRun,
          silent: argv.silent,
        })
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

  async generateStashChangelog(
    appService,
    stashRef = 'stash@{0}',
    options: Record<string, any> = {}
  ) {
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

      // Assemble the changelog as a markdown string so it can be routed through the
      // shared unified writer (console echo and file output share one formatter and the
      // --format/--output/--dry-run flags are honored, matching the other changelog paths).
      const lines: string[] = ['## Stashed Changes', '']

      // Analyze with AI if available
      if (appService.orchestrator.aiAnalysisService?.hasAI) {
        console.log(colors.processingMessage('🤖 Analyzing stashed changes with AI...'))

        const analysis = await appService.orchestrator.aiAnalysisService.analyzeCommit(stashData)

        lines.push(`**Summary:** ${analysis?.summary || details.message}`)
        lines.push(`**Impact:** ${analysis?.impact || 'medium'}`)
        lines.push(`**Category:** ${analysis?.category || 'chore'}`)

        if (analysis?.description) {
          lines.push('', analysis.description)
        }

        lines.push('', `**Files affected:** ${details.files.length}`)
        details.files.forEach((f) => {
          lines.push(`- ${f.path}`)
        })
      } else {
        // Basic changelog without AI
        lines.push(`**Message:** ${details.message}`)
        lines.push(
          `**Stats:** ${details.stats.filesChanged} files, +${details.stats.insertions}/-${details.stats.deletions}`
        )

        lines.push('', '**Files affected:**')
        details.files.forEach((f) => {
          lines.push(`- ${f.path}`)
        })
      }

      const changelog = lines.join('\n')

      if (!options.output && !options.silent) {
        console.log(colors.header('\n📋 Stash Changelog:\n'))
      }

      handleUnifiedOutput(changelog, {
        format: options.format || 'markdown',
        outputFile: options.output,
        silent: options.silent,
        dryRun: options.dryRun,
      })
    } catch (error) {
      EnhancedConsole.error(`Error generating stash changelog: ${error.message}`)
    }
  }
}

// Export the controller
export default CLIController
