import { GitService } from '../../domains/git/git.service.js';
import { AIAnalysisService } from '../../domains/ai/ai-analysis.service.js';
import { ChangelogService } from '../../domains/changelog/changelog.service.js';
import { AnalysisEngine } from '../../domains/analysis/analysis.engine.js';
import { ProviderManagerService } from '../../infrastructure/providers/provider-manager.service.js';
import { InteractiveWorkflowService } from '../../infrastructure/interactive/interactive-workflow.service.js';
import colors from '../../shared/constants/colors.js';

export class ChangelogOrchestrator {
  constructor(configManager, options = {}) {
    this.configManager = configManager;
    this.options = options;
    this.analysisMode = options.analysisMode || 'standard';
    this.metrics = {
      startTime: Date.now(),
      commitsProcessed: 0,
      apiCalls: 0,
      errors: 0,
      batchesProcessed: 0,
      totalTokens: 0,
      ruleBasedFallbacks: 0,
      cacheHits: 0
    };
    
    this.initialized = false;
    this.initializationPromise = null;
    
    // Start initialization
    this.initializationPromise = this.initializeServices();
  }
  
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializationPromise;
    }
  }

  async initializeServices() {
    try {
      // Initialize AI provider
      this.providerManager = new ProviderManagerService(this.configManager.getAll(), { 
        errorHandler: { logToConsole: true } 
      });
      this.aiProvider = this.providerManager.getActiveProvider();
      
      // Create lightweight implementations for missing dependencies
      this.gitManager = await this.createGitManager();
      this.tagger = await this.createTagger();
      this.promptEngine = await this.createPromptEngine();
      
      // Initialize domain services with proper dependencies
      this.gitService = new GitService(this.gitManager, this.tagger);
      this.aiAnalysisService = new AIAnalysisService(this.aiProvider, this.promptEngine, this.tagger, this.analysisMode);
      this.analysisEngine = new AnalysisEngine(this.gitService, this.aiAnalysisService);
      this.changelogService = new ChangelogService(this.gitService, this.aiAnalysisService, this.analysisEngine, this.configManager);
      this.interactiveService = new InteractiveWorkflowService(this.gitService, this.aiAnalysisService, this.changelogService);
      
      // Only log if not in MCP server mode
      if (!process.env.MCP_SERVER_MODE) {
        console.log(colors.successMessage('⚙️  Services initialized'));
      }
      this.initialized = true;
      
    } catch (error) {
      console.error(colors.errorMessage('Failed to initialize services:'), error.message);
      throw error;
    }
  }

  async createGitManager() {
    const { execSync } = await import('child_process');
    
    return {
      isGitRepo: (() => {
        try {
          execSync('git rev-parse --git-dir', { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      })(),
      
      execGit(command) {
        try {
          return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        } catch (error) {
          throw new Error(`Git command failed: ${error.message}`);
        }
      },
      
      execGitSafe(command) {
        try {
          return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        } catch {
          return '';
        }
      },
      
      execGitShow(command) {
        try {
          return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        } catch (error) {
          // console.warn(`Git command failed: ${command}`);
          // console.warn(`Error: ${error.message}`);
          return null;
        }
      },
      
      validateCommitHash(hash) {
        try {
          execSync(`git cat-file -e ${hash}`, { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      },
      
      getAllBranches() {
        try {
          const output = execSync('git branch -a', { encoding: 'utf8' });
          return output.split('\n').filter(Boolean).map(branch => branch.trim().replace(/^\*\s*/, ''));
        } catch {
          return [];
        }
      },
      
      getUnmergedCommits() {
        try {
          const output = execSync('git log --oneline --no-merges HEAD ^origin/main', { encoding: 'utf8' });
          return output.split('\n').filter(Boolean);
        } catch {
          return [];
        }
      },
      
      getDanglingCommits() {
        try {
          const output = execSync('git fsck --no-reflog | grep "dangling commit"', { encoding: 'utf8' });
          return output.split('\n').filter(Boolean);
        } catch {
          return [];
        }
      },
      
      getUntrackedFiles() {
        try {
          const output = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' });
          return output.split('\n').filter(Boolean);
        } catch {
          return [];
        }
      },
      
      getRecentCommits(limit = 10) {
        try {
          const output = execSync(`git log --oneline -${limit}`, { encoding: 'utf8' });
          return output.split('\n').filter(Boolean);
        } catch {
          return [];
        }
      },
      
      getComprehensiveAnalysis() {
        return {
          totalCommits: this.getRecentCommits(1000).length,
          branches: this.getAllBranches(),
          untrackedFiles: this.getUntrackedFiles()
        };
      },
      
      hasFile(filename) {
        try {
          execSync(`test -f ${filename}`, { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      }
    };
  }
  
  async createTagger() {
    const { analyzeSemanticChanges, analyzeFunctionalImpact } = await import('../../shared/utils/consolidated-utils.js');
    
    return {
      analyzeCommit(commit) {
        const semanticChanges = [];
        const breakingChanges = [];
        const categories = [];
        const tags = [];
        
        // Basic analysis based on commit message
        const message = commit.message.toLowerCase();
        
        if (message.includes('breaking') || message.includes('!:')) {
          breakingChanges.push('Breaking change detected in commit message');
          categories.push('breaking');
          tags.push('breaking');
        }
        
        if (message.startsWith('feat')) {
          categories.push('feature');
          tags.push('feature');
        } else if (message.startsWith('fix')) {
          categories.push('fix');
          tags.push('bugfix');
        } else if (message.startsWith('docs')) {
          categories.push('docs');
          tags.push('documentation');
        }
        
        // Analyze files if available
        if (commit.files && commit.files.length > 0) {
          commit.files.forEach(file => {
            const semantic = analyzeSemanticChanges('', file.path);
            if (semantic.frameworks) {
              semanticChanges.push(...semantic.frameworks);
            }
          });
        }
        
        // Determine importance
        let importance = 'medium';
        if (breakingChanges.length > 0 || commit.files?.length > 10) {
          importance = 'high';
        } else if (categories.includes('docs') || commit.files?.length < 3) {
          importance = 'low';
        }
        
        return {
          semanticChanges,
          breakingChanges,
          categories,
          importance,
          tags
        };
      }
    };
  }
  
  async createPromptEngine() {
    const { buildEnhancedPrompt } = await import('../../shared/utils/consolidated-utils.js');
    
    return {
      systemPrompts: {
        master: "You are an expert software analyst specializing in code change analysis and changelog generation.",
        standard: "Provide clear, concise analysis focusing on the practical impact of changes.",
        detailed: "Provide comprehensive technical analysis with detailed explanations and implications.",
        enterprise: "Provide enterprise-grade analysis suitable for stakeholder communication and decision-making.",
        changesAnalysis: "You are an expert at analyzing code changes and their business impact."
      },
      
      optimizeForProvider(prompt, providerName, capabilities = {}) {
        // Simple optimization - could be enhanced based on provider capabilities
        if (providerName?.toLowerCase().includes('claude')) {
          return `Please analyze this carefully and provide structured output:\n\n${prompt}`;
        } else if (providerName?.toLowerCase().includes('gpt')) {
          return `${prompt}\n\nPlease respond in JSON format as requested.`;
        }
        return prompt;
      },
      
      buildRepositoryHealthPrompt(healthData, analysisMode) {
        return `Analyze the health of this repository based on the following data:\n\n${JSON.stringify(healthData, null, 2)}\n\nProvide assessment and recommendations.`;
      }
    };
  }

  async generateChangelog(version, since) {
    try {
      await this.ensureInitialized();
      
      this.metrics.startTime = Date.now();
      
      console.log('\n' + colors.processingMessage('🚀 Starting changelog generation...'));
      
      // Validate git repository
      if (!this.gitManager.isGitRepo) {
        throw new Error('Not a git repository');
      }
      
      // Generate changelog using the service
      const result = await this.changelogService.generateChangelog(version, since);
      
      if (!result) {
        console.log(colors.warningMessage('No changelog generated'));
        return null;
      }
      
      // Update metrics
      this.updateMetrics(result);
      
      // Display results
      this.displayResults(result, version);
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      console.error(colors.errorMessage('Changelog generation failed:'), error.message);
      throw error;
    }
  }

  async analyzeRepository(options = {}) {
    try {
      await this.ensureInitialized();
      
      console.log(colors.processingMessage('🔍 Starting repository analysis...'));
      
      const analysisType = options.type || 'changes';
      const result = await this.analysisEngine.analyze(analysisType, options);
      
      this.displayAnalysisResults(result, analysisType);
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      console.error(colors.errorMessage('Repository analysis failed:'), error.message);
      throw error;
    }
  }

  async runInteractive() {
    await this.ensureInitialized();
    
    const { runInteractiveMode, selectSpecificCommits } = await import('../../shared/utils/consolidated-utils.js');
    const { confirm } = await import('@clack/prompts');
    
    console.log(colors.processingMessage('🎮 Starting interactive mode...'));
    
    let continueSession = true;
    
    while (continueSession) {
      try {
        const result = await runInteractiveMode();
        
        if (result.action === 'exit') {
          console.log(colors.successMessage('👋 Goodbye!'));
          break;
        }
        
        await this.handleInteractiveAction(result.action);
        
        // Ask if user wants to continue
        const continueChoice = await confirm({
          message: 'Would you like to perform another action?',
          initialValue: true
        });
        
        continueSession = continueChoice;
        
      } catch (error) {
        console.error(colors.errorMessage(`Interactive mode error: ${error.message}`));
        
        const retryChoice = await confirm({
          message: 'Would you like to try again?',
          initialValue: true
        });
        
        continueSession = retryChoice;
      }
    }
    
    return { interactive: true, status: 'completed' };
  }

  async handleInteractiveAction(action) {
    
    switch (action) {
      case 'changelog-recent':
        await this.handleRecentChangelogGeneration();
        break;
        
      case 'changelog-specific':
        await this.handleSpecificChangelogGeneration();
        break;
        
      case 'analyze-workdir':
        await this.generateChangelogFromChanges();
        break;
        
      case 'analyze-repo':
        await this.analyzeRepository({ type: 'comprehensive' });
        break;
        
      case 'commit-message':
        await this.handleCommitMessageGeneration();
        break;
        
      case 'configure-providers':
        await this.handleProviderConfiguration();
        break;
        
      case 'validate-config':
        await this.validateConfiguration();
        break;
        
      default:
        console.log(colors.warningMessage(`Unknown action: ${action}`));
    }
  }

  async handleRecentChangelogGeneration() {
    const { text } = await import('@clack/prompts');
    
    const commitCountInput = await text({
      message: 'How many recent commits to include?',
      placeholder: '10',
      validate: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num <= 0 || num > 100) {
          return 'Please enter a number between 1 and 100';
        }
      }
    });
    
    const commitCount = parseInt(commitCountInput) || 10;
    
    console.log(colors.processingMessage(`📝 Generating changelog for ${commitCount} recent commits...`));
    
    const result = await this.generateChangelog({ 
      version: `Recent-${commitCount}-commits`,
      maxCommits: commitCount 
    });
    
    if (result?.changelog) {
      console.log(colors.successMessage('✅ Changelog generated successfully!'));
    }
  }

  async handleSpecificChangelogGeneration() {
    const { selectSpecificCommits } = await import('../../shared/utils/consolidated-utils.js');
    
    console.log(colors.infoMessage('📋 Select specific commits for changelog generation:'));
    
    const selectedCommits = await selectSpecificCommits(30);
    
    if (selectedCommits.length === 0) {
      console.log(colors.warningMessage('No commits selected.'));
      return;
    }
    
    console.log(colors.processingMessage(`📝 Generating changelog for ${selectedCommits.length} selected commits...`));
    
    const result = await this.generateChangelogFromCommits(selectedCommits);
    
    if (result?.changelog) {
      console.log(colors.successMessage('✅ Changelog generated successfully!'));
    }
  }

  async handleCommitMessageGeneration() {
    console.log(colors.processingMessage('🤖 Analyzing current changes for commit message suggestions...'));
    
    // Use shared utility for getting working directory changes
    const { getWorkingDirectoryChanges } = await import('../../shared/utils/consolidated-utils.js');
    const changes = getWorkingDirectoryChanges();
    
    if (!changes || changes.length === 0) {
      console.log(colors.warningMessage('No uncommitted changes found.'));
      return;
    }
    
    const analysis = await this.interactiveService.generateCommitSuggestion();
    
    if (analysis.success && analysis.suggestions.length > 0) {
      const { select } = await import('@clack/prompts');
      
      const choices = [
        ...analysis.suggestions.map((msg, index) => ({
          value: msg,
          label: `${index + 1}. ${msg}`
        })),
        {
          value: 'CUSTOM',
          label: '✏️  Write custom message'
        }
      ];
      
      const selectedMessage = await select({
        message: 'Choose a commit message:',
        options: choices
      });
      
      if (selectedMessage === 'CUSTOM') {
        const { text } = await import('@clack/prompts');
        
        const customMessage = await text({
          message: 'Enter your commit message:',
          validate: (input) => {
            if (!input || input.trim().length === 0) {
              return 'Commit message cannot be empty';
            }
          }
        });
        
        console.log(colors.successMessage(`📝 Custom message: ${customMessage}`));
      } else {
        console.log(colors.successMessage(`📝 Selected: ${selectedMessage}`));
      }
    } else {
      console.log(colors.warningMessage('Could not generate commit message suggestions.'));
    }
  }

  async handleProviderConfiguration() {
    const { select } = await import('@clack/prompts');
    
    const availableProviders = this.providerManager.getAllProviders();
    
    const choices = availableProviders.map(p => ({
      value: p.name,
      label: `${p.name} ${p.available ? '✅' : '⚠️ (needs configuration)'}`
    }));
    
    const selectedProvider = await select({
      message: 'Select provider to configure:',
      options: choices
    });
    
    console.log(colors.infoMessage(`🔧 Configuring ${selectedProvider}...`));
    console.log(colors.infoMessage('Please edit your .env.local file to add the required API keys.'));
    console.log(colors.highlight(`Example for ${selectedProvider.toUpperCase()}:`));
    
    switch (selectedProvider) {
      case 'openai':
        console.log(colors.code('OPENAI_API_KEY=your_api_key_here'));
        break;
      case 'anthropic':
        console.log(colors.code('ANTHROPIC_API_KEY=your_api_key_here'));
        break;
      case 'azure':
        console.log(colors.code('AZURE_OPENAI_API_KEY=your_api_key_here'));
        console.log(colors.code('AZURE_OPENAI_ENDPOINT=your_endpoint_here'));
        break;
      case 'google':
        console.log(colors.code('GOOGLE_API_KEY=your_api_key_here'));
        break;
      default:
        console.log(colors.code(`${selectedProvider.toUpperCase()}_API_KEY=your_api_key_here`));
    }
  }

  async generateChangelogFromChanges(version) {
    try {
      await this.ensureInitialized();
      
      console.log(colors.processingMessage('📝 Generating changelog from working directory changes...'));
      
      const result = await this.changelogService.generateChangelogFromChanges(version);
      
      if (result) {
        console.log(colors.successMessage('✅ Working directory changelog generated'));
        console.log(result.changelog);
      }
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      console.error(colors.errorMessage('Working directory changelog generation failed:'), error.message);
      throw error;
    }
  }

  updateMetrics(result) {
    if (result.analyzedCommits) {
      this.metrics.commitsProcessed += result.analyzedCommits.length;
    }
    
    // Get metrics from AI service
    const aiMetrics = this.aiAnalysisService.getMetrics();
    this.metrics.apiCalls += aiMetrics.apiCalls;
    this.metrics.totalTokens += aiMetrics.totalTokens;
    this.metrics.ruleBasedFallbacks += aiMetrics.ruleBasedFallbacks;
  }

  displayResults(result, version) {
    const { changelog, insights, analyzedCommits } = result;
    
    console.log('\n' + colors.successMessage('✅ Changelog Generation Complete'));
    
    if (insights) {
      // Create a clean insights summary
      const insightLines = [
        `${colors.label('Total commits')}: ${colors.number(insights.totalCommits)}`,
        `${colors.label('Complexity')}: ${this.getComplexityColor(insights.complexity)(insights.complexity)}`,
        `${colors.label('Risk level')}: ${this.getRiskColor(insights.riskLevel)(insights.riskLevel)}`
      ];
      
      if (insights.breaking) {
        insightLines.push('');
        insightLines.push(colors.warningMessage('⚠️  Contains breaking changes'));
      }
      
      if (Object.keys(insights.commitTypes).length > 0) {
        insightLines.push('');
        insightLines.push(colors.dim('Commit types:'));
        Object.entries(insights.commitTypes).forEach(([type, count]) => {
          insightLines.push(`  ${colors.commitType(type)}: ${colors.number(count)}`);
        });
      }
      
      console.log(colors.box('📊 Release Insights', insightLines.join('\n')));
    }
    
    // Don't show changelog content in terminal - it's saved to file
    
    this.displayMetrics();
  }

  getComplexityColor(complexity) {
    const level = complexity?.toLowerCase();
    switch (level) {
      case 'low': return colors.success;
      case 'medium': return colors.warning;
      case 'high': return colors.error;
      default: return colors.highlight;
    }
  }

  getRiskColor(risk) {
    const level = risk?.toLowerCase();
    switch (level) {
      case 'low': return colors.riskLow;
      case 'medium': return colors.riskMedium;
      case 'high': return colors.riskHigh;
      case 'critical': return colors.riskCritical;
      default: return colors.highlight;
    }
  }

  displayAnalysisResults(result, type) {
    console.log(colors.successMessage(`\n✅ ${type.charAt(0).toUpperCase() + type.slice(1)} Analysis Complete`));
    console.log(colors.separator());
    
    if (result.summary) {
      console.log(colors.sectionHeader('📋 Summary'));
      console.log(result.summary);
      console.log('');
    }
    
    if (result.analysis) {
      console.log(colors.sectionHeader('🔍 Analysis Details'));
      if (typeof result.analysis === 'object') {
        Object.entries(result.analysis).forEach(([key, value]) => {
          if (typeof value === 'object') {
            console.log(`${key}: ${JSON.stringify(value, null, 2)}`);
          } else {
            console.log(`${key}: ${colors.highlight(value)}`);
          }
        });
      } else {
        console.log(result.analysis);
      }
    }
    
    this.displayMetrics();
  }

  displayMetrics() {
    const duration = Date.now() - this.metrics.startTime;
    
    const metricLines = [
      `${colors.label('Duration')}: ${colors.number(this.formatDuration(duration))}`,
      `${colors.label('Commits processed')}: ${colors.number(this.metrics.commitsProcessed)}`,
      `${colors.label('API calls')}: ${colors.number(this.metrics.apiCalls)}`,
      `${colors.label('Total tokens')}: ${colors.number(this.metrics.totalTokens.toLocaleString())}`
    ];
    
    if (this.metrics.ruleBasedFallbacks > 0) {
      metricLines.push('');
      metricLines.push(colors.warning(`⚠️  Rule-based fallbacks: ${this.metrics.ruleBasedFallbacks}`));
    }
    
    if (this.metrics.errors > 0) {
      metricLines.push('');
      metricLines.push(colors.error(`❌ Errors: ${this.metrics.errors}`));
    }
    
    console.log(colors.box('📈 Performance Metrics', metricLines.join('\n')));
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  // Configuration methods
  setAnalysisMode(mode) {
    this.analysisMode = mode;
    if (this.aiAnalysisService) {
      this.aiAnalysisService.analysisMode = mode;
    }
  }

  setModelOverride(model) {
    if (this.aiAnalysisService) {
      this.aiAnalysisService.setModelOverride(model);
    }
  }

  // Metrics methods
  getMetrics() {
    return {
      ...this.metrics,
      aiMetrics: this.aiAnalysisService?.getMetrics() || {}
    };
  }

  resetMetrics() {
    this.metrics = {
      startTime: Date.now(),
      commitsProcessed: 0,
      apiCalls: 0,
      errors: 0,
      batchesProcessed: 0,
      totalTokens: 0,
      ruleBasedFallbacks: 0,
      cacheHits: 0
    };
    
    if (this.aiAnalysisService) {
      this.aiAnalysisService.resetMetrics();
    }
  }
}