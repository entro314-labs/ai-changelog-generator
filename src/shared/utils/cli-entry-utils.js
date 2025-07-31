/**
 * CLI Entry Point Utilities
 * Provides process error handlers, startup tips, and common CLI patterns
 * Provides CLI error handling, validation, and user interface utilities
 */

import fs from 'fs';
import path from 'path';
import { GitError, ConfigError, NetworkError, ErrorContext } from './error-classes.js';
import colors from '../constants/colors.js';

/**
 * Enhanced error handling for CLI applications with context-aware tips
 * @param {Error} error - The error that occurred
 * @param {string} context - Context where the error occurred
 * @param {Object} options - Error handling options
 */
export function handleCLIError(error, context = 'application', options = {}) {
  const { exitOnError = true, showTips = true, showStack = false } = options;
  
  console.error(colors.errorMessage(`❌ Failed to ${context}: ${error.message}`));
  
  if (showStack && error.stack) {
    console.error(colors.gray(error.stack));
  }
  
  if (showTips) {
    const tips = getContextualTips(error, context);
    if (tips.length > 0) {
      tips.forEach(tip => console.error(colors.infoMessage(`💡 Tip: ${tip}`)));
    }
  }
  
  if (exitOnError) {
    process.exit(1);
  }
}

/**
 * Get contextual tips based on error type and message
 * @param {Error} error - The error that occurred
 * @param {string} context - Context where the error occurred
 * @returns {Array} Array of helpful tip strings
 */
function getContextualTips(error, context) {
  const tips = [];
  const message = error.message.toLowerCase();
  
  // Git-related tips
  if (error instanceof GitError || message.includes('git')) {
    if (message.includes('not a git repository')) {
      tips.push('Make sure you\'re in a git repository directory');
      tips.push('Run `git init` to initialize a new repository');
    } else if (message.includes('no commits')) {
      tips.push('Make at least one commit before generating a changelog');
    } else if (message.includes('remote')) {
      tips.push('Check your git remote configuration with `git remote -v`');
    } else {
      tips.push('Ensure git is properly installed and configured');
    }
  }
  
  // Provider/API related tips
  if (error instanceof ConfigError || message.includes('provider') || message.includes('api key')) {
    tips.push('Configure at least one AI provider in your .env.local file');
    tips.push('Check the documentation for provider-specific setup instructions');
    tips.push('Verify your API keys are valid and have sufficient quota');
  }
  
  // Network related tips
  if (error instanceof NetworkError || message.includes('enotfound') || message.includes('network') || message.includes('timeout')) {
    tips.push('Check your internet connection');
    tips.push('If using a proxy, verify your proxy settings');
    tips.push('Some providers may be temporarily unavailable - try again later');
  }
  
  // Permission related tips
  if (message.includes('permission') || message.includes('eacces')) {
    tips.push('Check file and directory permissions');
    tips.push('Try running with appropriate privileges (but avoid sudo if possible)');
    tips.push('Ensure the current user has write access to the working directory');
  }
  
  // File system tips
  if (message.includes('enoent') || message.includes('file not found')) {
    tips.push('Verify the file or directory exists');
    tips.push('Check the file path spelling and case sensitivity');
  }
  
  // Memory/resource tips
  if (message.includes('out of memory') || message.includes('heap')) {
    tips.push('Try processing fewer commits at once');
    tips.push('Increase Node.js memory limit with --max-old-space-size');
  }
  
  // Context-specific tips
  if (context.includes('changelog')) {
    tips.push('Try using a smaller commit range or batch processing');
  }
  
  if (context.includes('mcp')) {
    tips.push('Ensure MCP server dependencies are installed');
    tips.push('Check MCP server configuration and permissions');
  }
  
  return tips;
}

/**
 * Comprehensive process error handlers for CLI applications
 * @param {string} appName - Name of the application for error messages
 * @param {Object} options - Handler options
 */
export function setupProcessErrorHandlers(appName = 'Application', options = {}) {
  const { gracefulShutdown = true, logErrors = true, showStack = false } = options;
  
  process.on('uncaughtException', (error) => {
    if (logErrors) {
      console.error(colors.errorMessage(`💥 Uncaught Exception in ${appName}:`), error.message);
      if (showStack) {
        console.error(colors.gray('Stack trace:'), error.stack);
      }
    }
    
    const errorContext = new ErrorContext()
      .add('type', 'uncaughtException')
      .add('appName', appName)
      .build();
    
    handleCLIError(error, 'handle uncaught exception', { 
      exitOnError: true, 
      showTips: true,
      showStack 
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    if (logErrors) {
      console.error(colors.errorMessage(`💥 Unhandled Rejection in ${appName}:`));
      console.error('Promise:', promise);
      console.error('Reason:', reason);
    }
    
    const error = reason instanceof Error ? reason : new Error(String(reason));
    handleCLIError(error, 'handle unhandled promise rejection', { 
      exitOnError: true, 
      showTips: true,
      showStack 
    });
  });
  
  if (gracefulShutdown) {
    // Graceful shutdown handling
    process.on('SIGINT', () => {
      console.log(colors.infoMessage(`\n👋 ${appName} interrupted by user. Shutting down gracefully...`));
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log(colors.infoMessage(`\n👋 ${appName} terminated. Shutting down gracefully...`));
      process.exit(0);
    });
  }
}

/**
 * Enhanced CLI application wrapper with comprehensive startup handling
 * @param {string} appName - Name of the application
 * @param {string} version - Version string
 * @param {Function} initFn - Initialization function to run
 * @param {Object} options - Application options
 */
export async function runCLIApplication(appName, version, initFn, options = {}) {
  const { 
    showStartupMessage = true, 
    setupErrorHandlers = true,
    debugMode = process.env.DEBUG === 'true',
    showTips = true,
    validateGit = false,
    requiredEnvVars = [],
    startupTips = []
  } = options;
  
  if (setupErrorHandlers) {
    setupProcessErrorHandlers(appName, { 
      gracefulShutdown: true, 
      logErrors: true, 
      showStack: debugMode 
    });
  }
  
  if (showStartupMessage) {
    displayStartupMessage(appName, version, { debugMode });
  }
  
  // Pre-flight checks
  if (validateGit && !validateGitRepository()) {
    console.error(colors.errorMessage('❌ Not in a git repository'));
    console.error(colors.infoMessage('💡 Tip: Navigate to a git repository or run `git init`'));
    process.exit(1);
  }
  
  if (requiredEnvVars.length > 0 && !validateEnvironment(requiredEnvVars)) {
    process.exit(1);
  }
  
  if (showTips && startupTips.length > 0) {
    showStartupTips(appName, startupTips);
  }
  
  try {
    await initFn();
  } catch (error) {
    handleCLIError(error, `start ${appName}`, { 
      exitOnError: true, 
      showTips: true,
      showStack: debugMode
    });
  }
}

/**
 * Enhanced MCP Server startup wrapper
 * @param {string} serverName - Name of the MCP server
 * @param {string} version - Version string  
 * @param {Function} serverClass - MCP Server class constructor
 * @param {Object} options - Server options
 */
export async function runMCPServer(serverName, version, serverClass, options = {}) {
  const { 
    debugMode = process.env.DEBUG === 'true',
    showTools = true,
    tools = [],
    showCapabilities = true,
    capabilities = []
  } = options;
  
  displayStartupMessage(serverName, version, { 
    type: 'MCP Server',
    debugMode 
  });
  
  console.log(colors.processingMessage('🔌 Starting MCP server...'));
  
  if (showTools && tools.length > 0) {
    console.log(colors.infoMessage(`🎯 Available tools: ${tools.join(', ')}`));
  }
  
  if (showCapabilities && capabilities.length > 0) {
    console.log(colors.infoMessage(`⚡ Capabilities: ${capabilities.join(', ')}`));
  }
  
  try {
    console.log(colors.processingMessage('✅ MCP server initializing...'));
    
    const server = new serverClass();
    await server.run();
    
    console.log(colors.successMessage('🚀 MCP server started successfully'));
    
  } catch (error) {
    handleCLIError(error, 'initialize MCP server', {
      exitOnError: true,
      showTips: true,
      showStack: debugMode
    });
  }
}

/**
 * Display formatted startup message
 * @param {string} name - Application name
 * @param {string} version - Version string
 * @param {Object} options - Display options
 */
function displayStartupMessage(name, version, options = {}) {
  const { type = 'CLI Tool', debugMode = false } = options;
  
  console.log(colors.header(`🤖 ${name}`));
  console.log(colors.label(`📦 Version: ${colors.highlight(version)}`));
  console.log(colors.label(`🏷️  Type: ${colors.value(type)}`));
  
  if (debugMode) {
    console.log(colors.warningMessage('🐛 Debug mode enabled'));
    console.log(colors.label(`📁 Working directory: ${colors.path(process.cwd())}`));
    console.log(colors.label(`⚙️  Node.js: ${colors.highlight(process.version)}`));
    console.log(colors.label(`🖥️  Platform: ${colors.value(process.platform)} ${process.arch}`));
  }
  console.log('');
}

/**
 * Enhanced CLI argument validation with detailed feedback
 * @param {Array} requiredArgs - Required argument names
 * @param {Object} argv - Parsed arguments object
 * @param {Object} options - Validation options
 * @returns {boolean} Whether all required arguments are present
 */
export function validateRequiredArgs(requiredArgs, argv, options = {}) {
  const { showUsage = true } = options;
  const missing = requiredArgs.filter(arg => !argv[arg]);
  
  if (missing.length > 0) {
    console.error(colors.errorMessage(`❌ Missing required arguments: ${missing.join(', ')}`));
    
    if (showUsage) {
      console.error(colors.infoMessage('💡 Tip: Use --help to see usage information'));
      
      // Show specific argument descriptions if available
      missing.forEach(arg => {
        const description = getArgumentDescription(arg);
        if (description) {
          console.error(colors.gray(`   --${arg}: ${description}`));
        }
      });
    }
    
    return false;
  }
  
  return true;
}

/**
 * Get description for common CLI arguments
 * @param {string} arg - Argument name
 * @returns {string} Argument description
 */
function getArgumentDescription(arg) {
  const descriptions = {
    'version': 'Version to use for changelog generation',
    'since': 'Git reference to start changelog from',
    'provider': 'AI provider to use (openai, anthropic, etc.)',
    'model': 'AI model to use for analysis',
    'output': 'Output file path for generated changelog',
    'format': 'Output format (markdown, json)',
    'config': 'Configuration file path'
  };
  return descriptions[arg] || '';
}

/**
 * Enhanced environment validation with helpful guidance
 * @param {Array} requiredEnvVars - Required environment variable names
 * @param {Object} options - Validation options
 * @returns {boolean} Whether all required environment variables are set
 */
export function validateEnvironment(requiredEnvVars = [], options = {}) {
  const { showExamples = true } = options;
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error(colors.errorMessage(`❌ Missing required environment variables: ${missing.join(', ')}`));
    console.error(colors.infoMessage('💡 Tip: Check your .env.local file or environment configuration'));
    
    if (showExamples) {
      console.error(colors.gray('\nExample .env.local configuration:'));
      missing.forEach(envVar => {
        const example = getEnvVarExample(envVar);
        if (example) {
          console.error(colors.gray(`${envVar}=${example}`));
        }
      });
    }
    
    return false;
  }
  
  return true;
}

/**
 * Get example values for common environment variables
 * @param {string} envVar - Environment variable name
 * @returns {string} Example value
 */
function getEnvVarExample(envVar) {
  const examples = {
    'OPENAI_API_KEY': 'sk-...',
    'ANTHROPIC_API_KEY': 'sk-ant-...',
    'AZURE_OPENAI_API_KEY': 'your-azure-key',
    'AZURE_OPENAI_ENDPOINT': 'https://your-resource.openai.azure.com/',
    'GOOGLE_AI_API_KEY': 'your-google-ai-key',
    'HUGGINGFACE_API_KEY': 'hf_...',
    'DATABASE_URL': 'postgresql://user:pass@localhost:5432/db',
    'DEBUG': 'true'
  };
  return examples[envVar] || 'your-value-here';
}

/**
 * Enhanced git repository validation
 * @param {string} pathToCheck - Path to check (defaults to current directory)
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with details
 */
export function validateGitRepository(pathToCheck = process.cwd(), options = {}) {
  const { checkCommits = false, showDetails = false } = options;
  
  try {
    const gitPath = path.join(pathToCheck, '.git');
    const isGitRepo = fs.existsSync(gitPath);
    
    if (!isGitRepo) {
      return { valid: false, reason: 'not_git_repository' };
    }
    
    const result = { valid: true, path: pathToCheck };
    
    if (checkCommits) {
      // Git validation requires command execution
      result.hasCommits = true; // Assume true for basic validation
    }
    
    if (showDetails) {
      console.log(colors.successMessage(`✅ Valid git repository: ${pathToCheck}`));
    }
    
    return result;
    
  } catch (error) {
    return { 
      valid: false, 
      reason: 'access_error', 
      error: error.message 
    };
  }
}

/**
 * Display helpful startup tips
 * @param {string} appName - Name of the application
 * @param {Array} tips - Array of tip strings to display
 */
export function showStartupTips(appName, tips = []) {
  if (tips.length === 0) return;
  
  console.log(colors.header(`💡 ${appName} Tips:`));
  tips.forEach((tip, index) => {
    console.log(colors.infoMessage(`   ${index + 1}. ${tip}`));
  });
  console.log('');
}

/**
 * Enhanced version information display
 * @param {string} name - Application name
 * @param {string} version - Version string
 * @param {Object} additional - Additional version info
 */
export function displayVersionInfo(name, version, additional = {}) {
  console.log(colors.header(`${name} v${version}`));
  
  if (additional.nodeVersion !== false) {
    console.log(colors.label(`Node.js: ${colors.highlight(process.version)}`));
  }
  
  if (additional.platform !== false) {
    console.log(colors.label(`Platform: ${colors.value(process.platform)} ${process.arch}`));
  }
  
  if (additional.gitVersion && additional.gitVersion !== false) {
    console.log(colors.label(`Git: ${colors.highlight(additional.gitVersion || 'Available')}`));
  }
  
  Object.entries(additional).forEach(([key, value]) => {
    if (typeof value === 'string' && !['nodeVersion', 'platform', 'gitVersion'].includes(key)) {
      console.log(colors.label(`${key}: ${colors.value(value)}`));
    }
  });
}

/**
 * Create startup tips for AI changelog generator
 * @returns {Array} Array of helpful tips
 */
export function getDefaultStartupTips() {
  return [
    'Ensure you have at least one AI provider configured in .env.local',
    'Use --help to see all available commands and options',
    'Run in a git repository with existing commits for best results',
    'Try --analysis-mode detailed for comprehensive changelog generation',
    'Use --interactive for guided changelog creation'
  ];
}

/**
 * Validate common CLI preconditions
 * @param {Object} requirements - Requirements to validate
 * @returns {Object} Validation result
 */
export function validateCLIPreconditions(requirements = {}) {
  const {
    gitRepository = false,
    envVars = [],
    args = [],
    argv = {}
  } = requirements;
  
  const results = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  if (gitRepository) {
    const gitResult = validateGitRepository();
    if (!gitResult.valid) {
      results.valid = false;
      results.errors.push('Not in a git repository');
    }
  }
  
  if (envVars.length > 0 && !validateEnvironment(envVars, { showExamples: false })) {
    results.valid = false;
    results.errors.push('Missing required environment variables');
  }
  
  if (args.length > 0 && !validateRequiredArgs(args, argv, { showUsage: false })) {
    results.valid = false;
    results.errors.push('Missing required arguments');
  }
  
  return results;
}