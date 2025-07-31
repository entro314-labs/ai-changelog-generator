import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { access } from 'fs/promises';
import path from 'path';
import { ApplicationService } from '../../application/services/application.service.js';
import colors from '../../shared/constants/colors.js';
import { formatDuration, promptForConfig } from '../../shared/utils/utils.js';
import { setupProcessErrorHandlers, handleCLIError, getDefaultStartupTips } from '../../shared/utils/cli-entry-utils.js';

export class CLIController {
  constructor() {
    this.commands = new Map();
    this.appService = null;
    this.startTime = Date.now();

    // Setup enhanced error handling
    setupProcessErrorHandlers('AI Changelog Generator', {
      gracefulShutdown: true,
      logErrors: true,
      showStack: process.env.DEBUG === 'true'
    });

    this.registerCommands();
  }

  registerCommands() {
    // Register all available commands
    this.commands.set('default', new DefaultCommand());
    this.commands.set('init', new InitCommand());
    this.commands.set('validate', new ValidateCommand());
    this.commands.set('analyze', new AnalyzeCommand());
    this.commands.set('analyze-commits', new AnalyzeCommitsCommand());
    this.commands.set('git-info', new GitInfoCommand());
    this.commands.set('health', new HealthCommand());
    this.commands.set('branches', new BranchesCommand());
    this.commands.set('comprehensive', new ComprehensiveCommand());
    this.commands.set('untracked', new UntrackedCommand());
    this.commands.set('working-dir', new WorkingDirCommand());
    this.commands.set('from-commits', new FromCommitsCommand());
    this.commands.set('commit-message', new CommitMessageCommand());
    this.commands.set('providers', new ProvidersCommand());
  }

  async runCLI() {
    try {
      // Ensure config exists
      await this.ensureConfig();

      const argv = await this.setupYargs();

      // Initialize application service with CLI options
      this.appService = new ApplicationService({
        dryRun: argv.dryRun,
        noColor: argv.noColor,
        silent: argv.silent
      });

      // Execute command
      const commandName = argv._[0] || 'default';
      const command = this.commands.get(commandName);

      if (!command) {
        throw new Error(`Unknown command: ${commandName}`);
      }

      await command.execute(argv, this.appService);

      // Show completion metrics
      await this.showMetrics();

    } catch (error) {
      handleCLIError(error, 'run CLI application', {
        exitOnError: false,
        showTips: true,
        showStack: process.env.DEBUG === 'true'
      });
      process.exitCode = 1;
    }
  }

  async ensureConfig() {
    const configPath = path.join(process.cwd(), '.env.local');
    try {
      await access(configPath);
    } catch {
      await promptForConfig();
    }
  }

  setupYargs() {
    return yargs(hideBin(process.argv))
      .scriptName("ai-changelog")
      .usage(`${colors.header('AI Changelog Generator')} - ${colors.secondary('Automatically generate changelogs from your git commits using AI.')}\n\n${colors.header('Usage:')} $0 [command] [options]`)

      // Default command
      .command('$0', 'Generate a changelog from git commits (default command).', (yargs) => {
        yargs
          .option('interactive', { alias: 'i', type: 'boolean', description: 'Choose commits interactively.' })
          .option('release-version', { alias: 'v', type: 'string', description: 'Set the release version (e.g., 1.2.3).' })
          .option('since', { alias: 's', type: 'string', description: 'Generate changelog since a specific git ref (tag/commit).' })
          .option('model', { alias: 'm', type: 'string', description: 'Override the default model.' })
          .option('detailed', { type: 'boolean', description: 'Use detailed analysis mode.' })
          .option('enterprise', { type: 'boolean', description: 'Use enterprise analysis mode.' })
          .option('dry-run', { type: 'boolean', description: 'Preview changelog without writing to file.' })
          .option('no-attribution', { type: 'boolean', description: 'Disable the attribution footer.' });
      })

      // Analysis commands
      .command('init', 'Run interactive setup to configure the tool.')
      .command('validate', 'Validate your configuration and connectivity.')
      .command('analyze', 'Analyze current working directory changes.', this.createStandardOptions)
      .command('analyze-commits <limit>', 'Analyze recent commits with detailed information.', (yargs) => {
        this.createStandardOptions(yargs)
          .positional('limit', { type: 'number', default: 10, description: 'Number of commits to analyze' });
      })
      .command('git-info', 'Display comprehensive repository information and statistics.', this.createStandardOptions)
      .command('health', 'Assess repository health and commit quality.', this.createStandardOptions)
      .command('branches', 'Analyze all branches and unmerged commits.', this.createStandardOptions)
      .command('comprehensive', 'Comprehensive analysis including dangling commits.', this.createStandardOptions)
      .command('untracked', 'Include untracked files analysis.', this.createStandardOptions)
      .command('working-dir', 'Generate changelog from working directory changes.', this.createStandardOptions)
      .command('from-commits <commits...>', 'Generate changelog from specific commit hashes.', (yargs) => {
        yargs.positional('commits', { describe: 'Commit hashes to analyze', type: 'string' });
      })

      // Utility commands
      .command('commit-message', 'Generate a commit message for current changes.')
      .command('providers', 'Manage AI providers.', (yargs) => {
        yargs
          .command('list', 'List available providers.')
          .command('switch <provider>', 'Switch to a different provider.')
          .command('configure [provider]', 'Configure AI provider settings.')
          .command('validate [provider]', 'Validate provider models and capabilities.')
          .demandCommand(1, 'Please specify a provider subcommand.');
      })

      // Global options
      .option('no-color', { type: 'boolean', description: 'Disable colored output.' })
      .option('silent', { type: 'boolean', description: 'Suppress non-essential output.' })
      .help('h')
      .alias('h', 'help')
      .epilogue(`For more information, visit ${colors.highlight('https://github.com/entro314-labs/ai-changelog-generator')}`)
      .demandCommand(0)
      .strict()
      .parse();
  }

  createStandardOptions(yargs) {
    return yargs
      .option('format', { alias: 'f', type: 'string', choices: ['markdown', 'json'], default: 'markdown', description: 'Output format' })
      .option('output', { alias: 'o', type: 'string', description: 'Output file path' })
      .option('since', { type: 'string', description: 'Analyze changes since this git ref' })
      .option('silent', { type: 'boolean', description: 'Suppress non-essential output' })
      .option('dry-run', { type: 'boolean', description: 'Preview without writing files' })
      .option('detailed', { type: 'boolean', description: 'Use detailed analysis mode' })
      .option('enterprise', { type: 'boolean', description: 'Use enterprise analysis mode' })
      .option('model', { alias: 'm', type: 'string', description: 'Override the default model' });
  }

  async showMetrics() {
    if (!this.appService || this.appService.options.silent) return;

    const endTime = Date.now();
    const metrics = this.appService.getMetrics();

    const summaryLines = [
      `${colors.label('Total time')}: ${colors.value(formatDuration(endTime - this.startTime))}`,
      `${colors.label('Commits processed')}: ${colors.number(metrics.commitsProcessed || 0)}`
    ];

    if (metrics.apiCalls > 0) {
      summaryLines.push(`${colors.label('AI calls')}: ${colors.number(metrics.apiCalls)}`);
      summaryLines.push(`${colors.label('Total tokens')}: ${colors.number((metrics.totalTokens || 0).toLocaleString())}`);
    }

    if (metrics.errors > 0) {
      summaryLines.push('');
      summaryLines.push(colors.error(`❌ Errors: ${metrics.errors}`));
    }

    console.log(colors.box('📊 Session Summary', summaryLines.join('\n')));
  }
}

// Base command class
class BaseCommand {
  async execute(argv, appService) {
    throw new Error('Command execute method not implemented');
  }

  processStandardFlags(argv, appService) {
    const config = {
      format: argv.format || 'markdown',
      output: argv.output,
      since: argv.since,
      silent: argv.silent || false,
      dryRun: argv.dryRun || false
    };

    // Apply analysis mode
    if (argv.detailed) appService.setAnalysisMode('detailed');
    if (argv.enterprise) appService.setAnalysisMode('enterprise');
    if (argv.model) appService.setModelOverride(argv.model);

    return config;
  }
}

// Command implementations
class DefaultCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);

    if (argv.interactive) {
      await appService.runInteractive();
    } else {
      await appService.generateChangelog({
        version: argv.releaseVersion,
        since: argv.since
      });
    }
  }
}

class InitCommand extends BaseCommand {
  async execute(argv, appService) {
    await promptForConfig();
  }
}

class ValidateCommand extends BaseCommand {
  async execute(argv, appService) {
    const validation = await appService.validateConfiguration();

    if (validation.valid) {
      console.log(colors.successMessage('✅ Configuration is valid'));
    } else {
      console.log(colors.errorMessage('❌ Configuration has issues:'));
      validation.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });

      if (validation.recommendations.length > 0) {
        console.log(colors.infoMessage('\n💡 Recommendations:'));
        validation.recommendations.forEach(rec => {
          console.log(`  - ${rec}`);
        });
      }
    }
  }
}

class AnalyzeCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);
    await appService.analyzeCurrentChanges();
  }
}

class AnalyzeCommitsCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);
    await appService.analyzeRecentCommits(argv.limit || 10);
  }
}

class GitInfoCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);
    await appService.analyzeRepository({ type: 'git-info', ...config });
  }
}

class HealthCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);
    await appService.assessHealth(config);
  }
}

class BranchesCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);
    await appService.analyzeRepository({ type: 'branches', ...config });
  }
}

class ComprehensiveCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);
    await appService.analyzeRepository({ type: 'comprehensive', ...config });
  }
}

class UntrackedCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);
    await appService.analyzeRepository({ type: 'untracked', ...config });
  }
}

class WorkingDirCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);
    await appService.generateChangelogFromChanges(argv.releaseVersion);
  }
}

class FromCommitsCommand extends BaseCommand {
  async execute(argv, appService) {
    const config = this.processStandardFlags(argv, appService);
    // Implementation would generate changelog from specific commits
    console.log(colors.infoMessage(`Generating changelog from commits: ${argv.commits.join(', ')}`));
  }
}

class CommitMessageCommand extends BaseCommand {
  async execute(argv, appService) {
    console.log(colors.processingMessage('🤖 Analyzing current changes for commit message suggestions...'));

    try {
      const result = await appService.generateCommitMessage();

      if (result && result.suggestions && result.suggestions.length > 0) {
        console.log(colors.successMessage('\n✅ Generated commit message suggestions:'));
        result.suggestions.forEach((suggestion, index) => {
          console.log(`${colors.number(index + 1)}. ${colors.highlight(suggestion)}`);
        });

        if (result.context) {
          console.log(colors.dim(`\nContext: ${result.context}`));
        }
      } else {
        console.log(colors.warningMessage('No commit message suggestions could be generated.'));
        console.log(colors.infoMessage('Make sure you have uncommitted changes.'));
      }
    } catch (error) {
      console.error(colors.errorMessage(`Error generating commit message: ${error.message}`));
    }
  }
}

class ProvidersCommand extends BaseCommand {
  async execute(argv, appService) {
    const subcommand = argv._[1];

    switch (subcommand) {
      case 'list':
        await this.listProviders(appService);
        break;
      case 'switch':
        await this.switchProvider(appService, argv.provider);
        break;
      case 'configure':
        await this.configureProvider(appService, argv.provider);
        break;
      case 'validate':
        await this.validateProvider(appService, argv.provider);
        break;
      default:
        console.log(colors.errorMessage('Unknown provider subcommand'));
        console.log(colors.infoMessage('Available subcommands: list, switch, configure, validate'));
    }
  }

  async listProviders(appService) {
    try {
      const providers = await appService.listProviders();

      console.log(colors.header('\n🤖 Available AI Providers:'));

      providers.forEach(provider => {
        const status = provider.available ? '✅ Available' : '⚠️  Needs configuration';
        const activeIndicator = provider.active ? ' 🎯 (Active)' : '';

        console.log(`  ${colors.highlight(provider.name)} - ${status}${activeIndicator}`);

        if (provider.capabilities && Object.keys(provider.capabilities).length > 0) {
          const caps = Object.entries(provider.capabilities)
            .filter(([key, value]) => value === true)
            .map(([key]) => key)
            .join(', ');
          if (caps) {
            console.log(`    ${colors.dim(`Capabilities: ${caps}`)}`);
          }
        }
      });

      console.log(colors.dim('\nUse "ai-changelog providers configure <provider>" to set up a provider'));

    } catch (error) {
      console.error(colors.errorMessage(`Error listing providers: ${error.message}`));
    }
  }

  async switchProvider(appService, providerName) {
    if (!providerName) {
      console.log(colors.errorMessage('Please specify a provider name'));
      console.log(colors.infoMessage('Usage: ai-changelog providers switch <provider>'));
      return;
    }

    try {
      const result = await appService.switchProvider(providerName);

      if (result.success) {
        console.log(colors.successMessage(`✅ Switched to ${providerName} provider`));
      } else {
        console.log(colors.errorMessage(`❌ Failed to switch provider: ${result.error}`));
        console.log(colors.infoMessage('Use "ai-changelog providers list" to see available providers'));
      }
    } catch (error) {
      console.error(colors.errorMessage(`Error switching provider: ${error.message}`));
    }
  }

  async configureProvider(appService, providerName) {
    const { select } = await import('@clack/prompts');

    try {
      // If no provider specified, let user choose
      if (!providerName) {
        const providers = await appService.listProviders();

        const choices = providers.map(p => ({
          value: p.name,
          label: `${p.name} ${p.available ? '✅' : '⚠️ (needs configuration)'}`
        }));

        providerName = await select({
          message: 'Select provider to configure:',
          options: choices
        });
      }

      console.log(colors.header(`\n🔧 Configuring ${providerName.toUpperCase()} Provider`));
      console.log(colors.infoMessage('Please add the following to your .env.local file:\n'));

      switch (providerName.toLowerCase()) {
        case 'openai':
          console.log(colors.code('OPENAI_API_KEY=your_openai_api_key_here'));
          console.log(colors.dim('Get your API key from: https://platform.openai.com/api-keys'));
          break;

        case 'anthropic':
          console.log(colors.code('ANTHROPIC_API_KEY=your_anthropic_api_key_here'));
          console.log(colors.dim('Get your API key from: https://console.anthropic.com/'));
          break;

        case 'azure':
          console.log(colors.code('AZURE_OPENAI_API_KEY=your_azure_api_key_here'));
          console.log(colors.code('AZURE_OPENAI_ENDPOINT=your_azure_endpoint_here'));
          console.log(colors.dim('Get from your Azure OpenAI resource in Azure portal'));
          break;

        case 'google':
          console.log(colors.code('GOOGLE_API_KEY=your_google_api_key_here'));
          console.log(colors.dim('Get your API key from: https://aistudio.google.com/app/apikey'));
          break;

        case 'ollama':
          console.log(colors.code('OLLAMA_HOST=http://localhost:11434'));
          console.log(colors.dim('Make sure Ollama is running: ollama serve'));
          break;

        default:
          console.log(colors.code(`${providerName.toUpperCase()}_API_KEY=your_api_key_here`));
      }

      console.log(colors.infoMessage('\nAfter adding the configuration, run:'));
      console.log(colors.highlight(`ai-changelog providers validate ${providerName}`));

    } catch (error) {
      console.error(colors.errorMessage(`Error configuring provider: ${error.message}`));
    }
  }

  async validateProvider(appService, providerName) {
    try {
      if (!providerName) {
        console.log(colors.processingMessage('🔍 Validating all configured providers...'));
        const result = await appService.validateAllProviders();

        console.log(colors.header('\n📊 Provider Validation Results:'));

        Object.entries(result).forEach(([name, validation]) => {
          const status = validation.success ? '✅ Valid' : '❌ Invalid';
          console.log(`  ${colors.highlight(name)}: ${status}`);

          if (!validation.success) {
            console.log(`    ${colors.errorMessage(validation.error)}`);
          }
        });

      } else {
        console.log(colors.processingMessage(`🔍 Validating ${providerName} provider...`));
        const result = await appService.validateProvider(providerName);

        if (result.success) {
          console.log(colors.successMessage(`✅ ${providerName} provider is configured correctly`));
          if (result.model) {
            console.log(colors.dim(`   Default model: ${result.model}`));
          }
        } else {
          console.log(colors.errorMessage(`❌ ${providerName} validation failed: ${result.error}`));
          console.log(colors.infoMessage(`Use "ai-changelog providers configure ${providerName}" for setup instructions`));
        }
      }

    } catch (error) {
      console.error(colors.errorMessage(`Error validating provider: ${error.message}`));
    }
  }
}

// Export the controller
export default CLIController;