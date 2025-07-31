#!/usr/bin/env node

/**
 * AI Changelog Generator MCP Server
 * Provides Model Context Protocol interface for changelog generation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Import application services
import { ApplicationService } from '../../application/services/application.service.js';
import { ChangelogOrchestrator } from '../../application/orchestrators/changelog.orchestrator.js';
import { GitRepositoryAnalyzer } from '../../domains/git/git-repository.analyzer.js';
import { AnalysisEngine } from '../../domains/analysis/analysis.engine.js';
import { ProviderManagementService } from '../providers/provider-management.service.js';
import { ConfigurationManager } from '../config/configuration.manager.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AIChangelogMCPServer {
  constructor() {
    this.initializeServer();
    this.initializeServices();
    this.setupHandlers();
  }

  initializeServer() {
    let packageJson;
    try {
      const packagePath = path.join(__dirname, '../../../package.json');
      const packageContent = fs.readFileSync(packagePath, 'utf8');
      packageJson = JSON.parse(packageContent);
    } catch (error) {
      packageJson = { version: '1.0.0' };
    }

    this.server = new Server(
      {
        name: 'ai-changelog-generator',
        version: packageJson.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
  }

  initializeServices() {
    try {
      // Set MCP server mode to suppress verbose logging
      process.env.MCP_SERVER_MODE = 'true';
      
      this.configManager = new ConfigurationManager();
      this.applicationService = new ApplicationService();
      this.changelogOrchestrator = new ChangelogOrchestrator(this.configManager);
      this.gitAnalyzer = new GitRepositoryAnalyzer();
      this.analysisEngine = new AnalysisEngine();
      this.providerService = new ProviderManagementService();
    } catch (error) {
      console.error('Failed to initialize services:', error.message);
      throw error;
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleListTools.bind(this));
    this.server.setRequestHandler(CallToolRequestSchema, this.handleCallTool.bind(this));
  }

  handleListTools() {
    return {
      tools: [
        {
          name: 'generate_changelog',
          description: 'Generate AI-powered changelog from commits or working directory changes',
          inputSchema: {
            type: 'object',
            properties: {
              repositoryPath: {
                type: 'string',
                description: 'Path to the git repository (defaults to current directory)',
              },
              source: {
                type: 'string',
                description: 'Source of changes to analyze',
                enum: ['commits', 'working-dir', 'auto'],
                default: 'auto',
              },
              since: {
                type: 'string',
                description: 'For commit analysis: since tag/commit/date (e.g., "v1.0.0", "HEAD~10")',
              },
              version: {
                type: 'string',
                description: 'Version number for changelog entry',
              },
              analysisMode: {
                type: 'string',
                description: 'Analysis depth level',
                enum: ['basic', 'detailed', 'comprehensive'],
                default: 'detailed',
              },
              includeAttribution: {
                type: 'boolean',
                description: 'Include AI attribution in output',
                default: true,
              },
              writeFile: {
                type: 'boolean',
                description: 'Write changelog to AI_CHANGELOG.md file',
                default: true,
              },
            },
            required: [],
          },
        },
        {
          name: 'analyze_repository',
          description: 'Comprehensive repository analysis including health, commits, and branches',
          inputSchema: {
            type: 'object',
            properties: {
              repositoryPath: {
                type: 'string',
                description: 'Path to the git repository (defaults to current directory)',
              },
              analysisType: {
                type: 'string',
                description: 'Type of analysis to perform',
                enum: ['health', 'commits', 'branches', 'working-dir', 'comprehensive'],
                default: 'comprehensive',
              },
              includeRecommendations: {
                type: 'boolean',
                description: 'Include improvement recommendations',
                default: true,
              },
              commitLimit: {
                type: 'number',
                description: 'Maximum commits to analyze',
                default: 50,
                minimum: 1,
                maximum: 200,
              },
            },
            required: [],
          },
        },
        {
          name: 'analyze_current_changes',
          description: 'Analyze staged and unstaged changes in working directory',
          inputSchema: {
            type: 'object',
            properties: {
              repositoryPath: {
                type: 'string',
                description: 'Path to the git repository (defaults to current directory)',
              },
              includeAIAnalysis: {
                type: 'boolean',
                description: 'Include AI-powered analysis of changes',
                default: true,
              },
              includeAttribution: {
                type: 'boolean',
                description: 'Include AI attribution in output',
                default: true,
              },
            },
            required: [],
          },
        },
        {
          name: 'configure_providers',
          description: 'Manage AI providers - list, switch, test, and configure',
          inputSchema: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: 'Provider management action',
                enum: ['list', 'switch', 'test', 'configure', 'validate'],
                default: 'list',
              },
              provider: {
                type: 'string',
                description: 'Specific provider for switch/test/configure actions',
                enum: ['openai', 'azure', 'anthropic', 'google', 'ollama', 'lmstudio', 'auto'],
              },
              testConnection: {
                type: 'boolean',
                description: 'Test connection after configuration',
                default: false,
              },
            },
            required: [],
          },
        },
      ],
    };
  }

  async handleCallTool(request) {
    const { name, arguments: args } = request.params;
    console.log(`[MCP] Tool call: ${name}`);

    try {
      console.time(`[MCP-TIMER] ${name}`);

      const timeouts = {
        'generate_changelog': 120000,
        'analyze_repository': 90000,
        'analyze_current_changes': 60000,
        'configure_providers': 30000,
      };

      const timeout = timeouts[name] || 60000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Tool '${name}' timed out after ${timeout}ms`)), timeout);
      });

      const operationPromise = this.executeOperation(name, args);
      const result = await Promise.race([operationPromise, timeoutPromise]);

      console.timeEnd(`[MCP-TIMER] ${name}`);
      return result;

    } catch (error) {
      console.error(`[MCP] Tool Error [${name}]:`, error.message);
      console.timeEnd(`[MCP-TIMER] ${name}`);
      return this.formatError(error, name);
    }
  }

  async executeOperation(name, args) {
    const originalCwd = process.cwd();
    
    try {
      // Change to repository path if specified
      if (args.repositoryPath && args.repositoryPath !== process.cwd()) {
        if (!fs.existsSync(args.repositoryPath)) {
          throw new Error(`Repository path does not exist: ${args.repositoryPath}`);
        }
        process.chdir(args.repositoryPath);
      }

      switch (name) {
        case 'generate_changelog':
          return await this.generateChangelog(args);
        case 'analyze_repository':
          return await this.analyzeRepository(args);
        case 'analyze_current_changes':
          return await this.analyzeCurrentChanges(args);
        case 'configure_providers':
          return await this.configureProviders(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } finally {
      process.chdir(originalCwd);
    }
  }

  async generateChangelog(args) {
    const {
      source = 'auto',
      since,
      version,
      analysisMode = 'detailed',
      includeAttribution = true,
      writeFile = true
    } = args;

    try {
      let result;

      if (source === 'working-dir' || (source === 'auto' && this.hasWorkingDirectoryChanges())) {
        // Generate from working directory changes
        result = await this.changelogOrchestrator.generateWorkspaceChangelog({
          version,
          analysisMode,
          includeAttribution
        });
      } else {
        // Generate from commits
        result = await this.changelogOrchestrator.generateChangelog({
          version,
          since,
          analysisMode,
          includeAttribution
        });
      }

      // Write file if requested
      if (writeFile && result.content) {
        const changelogPath = path.join(process.cwd(), 'AI_CHANGELOG.md');
        try {
          fs.writeFileSync(changelogPath, result.content, 'utf8');
          console.log(`[MCP] Changelog written to: ${changelogPath}`);
        } catch (writeError) {
          console.warn(`[MCP] Could not write file: ${writeError.message}`);
        }
      }

      return {
        content: [{
          type: 'text',
          text: result.content || 'No changelog content generated'
        }],
        metadata: result.metadata
      };

    } catch (error) {
      throw new Error(`Changelog generation failed: ${error.message}`);
    }
  }

  async analyzeRepository(args) {
    const {
      analysisType = 'comprehensive',
      includeRecommendations = true,
      commitLimit = 50
    } = args;

    try {
      let result;

      switch (analysisType) {
        case 'health':
          result = await this.gitAnalyzer.assessRepositoryHealth(includeRecommendations);
          break;
        case 'commits':
          result = await this.analysisEngine.analyzeRecentCommits(commitLimit);
          break;
        case 'branches':
          result = await this.gitAnalyzer.analyzeBranches();
          break;
        case 'working-dir':
          result = await this.analysisEngine.analyzeCurrentChanges();
          break;
        case 'comprehensive':
        default:
          result = await this.gitAnalyzer.analyzeComprehensive(includeRecommendations);
          break;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error) {
      throw new Error(`Repository analysis failed: ${error.message}`);
    }
  }

  async analyzeCurrentChanges(args) {
    const {
      includeAIAnalysis = true,
      includeAttribution = true
    } = args;

    try {
      const result = await this.analysisEngine.analyzeCurrentChanges({
        includeAIAnalysis,
        includeAttribution
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error) {
      throw new Error(`Current changes analysis failed: ${error.message}`);
    }
  }

  async configureProviders(args) {
    const {
      action = 'list',
      provider,
      testConnection = false
    } = args;

    try {
      let result;

      switch (action) {
        case 'list':
          result = await this.providerService.listProviders();
          break;
        case 'switch':
          if (!provider) throw new Error('Provider required for switch action');
          result = await this.providerService.switchProvider(provider);
          if (testConnection) {
            const testResult = await this.providerService.testProvider(provider);
            result += `\n${testResult}`;
          }
          break;
        case 'test':
          result = await this.providerService.testCurrentProvider();
          break;
        case 'configure':
          result = await this.providerService.configureProvider(provider);
          break;
        case 'validate':
          result = await this.providerService.validateModels(provider);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        content: [{
          type: 'text',
          text: result
        }]
      };

    } catch (error) {
      throw new Error(`Provider management failed: ${error.message}`);
    }
  }

  hasWorkingDirectoryChanges() {
    try {
      // Simple check for working directory changes
      const { execSync } = require('child_process');
      const result = execSync('git status --porcelain', { encoding: 'utf8' });
      return result.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  formatError(error, toolName) {
    if (error.message.includes('timed out')) {
      return {
        content: [{
          type: 'text',
          text: `⏱️ Timeout: '${toolName}' exceeded time limit. Try with smaller scope or check connectivity.`,
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: `❌ Error in '${toolName}': ${error.message}`,
      }],
      isError: true,
    };
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      // Minimal heartbeat - no console output for MCP protocol
      const keepAlive = setInterval(() => {}, 30000);

      const gracefulShutdown = (signal) => {
        clearInterval(keepAlive);
        process.exit(0);
      };

      process.on('SIGINT', gracefulShutdown);
      process.on('SIGTERM', gracefulShutdown);

      return new Promise(() => {}); // Never resolves, keeps server alive

    } catch (error) {
      console.error('MCP server failed:', error.message);
      throw error;
    }
  }
}

// Start server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new AIChangelogMCPServer();
  server.run().catch((error) => {
    console.error('MCP Server startup failed:', error);
    process.exit(1);
  });
}

export default AIChangelogMCPServer;