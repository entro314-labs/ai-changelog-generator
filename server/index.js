#!/usr/bin/env node

/**
 * AI Changelog Generator DXT Extension Entry Point
 * Simplified MCP Server for Claude Desktop Extensions
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import node modules
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const server = new Server(
  {
    name: "ai-changelog-generator", 
    version: "3.0.2",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Helper function to execute git commands
function execGit(command, options = {}) {
  try {
    return execSync(`git ${command}`, { 
      encoding: 'utf8', 
      cwd: options.cwd || process.cwd(),
      ...options 
    }).trim();
  } catch (error) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}

// Helper function to check if we're in a git repository
function isGitRepository(dir = process.cwd()) {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_changelog",
        description: "Generate AI-powered changelog from git commits or working directory changes",
        inputSchema: {
          type: "object",
          properties: {
            repositoryPath: {
              type: "string",
              description: "Path to the git repository (defaults to current directory)",
            },
            since: {
              type: "string", 
              description: "Generate changelog since tag/commit (e.g., 'v1.0.0', 'HEAD~10')",
            },
            version: {
              type: "string",
              description: "Version number for changelog entry",
            },
            maxCommits: {
              type: "number",
              description: "Maximum number of commits to analyze",
              default: 50,
            },
          },
          required: [],
        },
      },
      {
        name: "analyze_repository",
        description: "Analyze git repository structure and health",
        inputSchema: {
          type: "object",
          properties: {
            repositoryPath: {
              type: "string",
              description: "Path to the git repository (defaults to current directory)",
            },
          },
          required: [],
        },
      },
      {
        name: "get_working_directory_changes",
        description: "Get current working directory changes (staged and unstaged)",
        inputSchema: {
          type: "object",
          properties: {
            repositoryPath: {
              type: "string",
              description: "Path to the git repository (defaults to current directory)",
            },
          },
          required: [],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const { repositoryPath } = args;
  
  // Change to repository directory if specified
  const originalCwd = process.cwd();
  if (repositoryPath && repositoryPath !== process.cwd()) {
    if (!fs.existsSync(repositoryPath)) {
      throw new Error(`Repository path does not exist: ${repositoryPath}`);
    }
    process.chdir(repositoryPath);
  }

  try {
    if (!isGitRepository()) {
      throw new Error("Not a git repository. Please run this command from within a git repository.");
    }

    switch (name) {
      case "generate_changelog":
        return await handleGenerateChangelog(args);
      case "analyze_repository":
        return await handleAnalyzeRepository(args);
      case "get_working_directory_changes":
        return await handleWorkingDirectoryChanges(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } finally {
    process.chdir(originalCwd);
  }
});

async function handleGenerateChangelog(args) {
  const { since, version, maxCommits = 50 } = args;
  
  try {
    // Get commits
    let gitLogCommand = `log --oneline --no-merges`;
    if (since) {
      gitLogCommand += ` ${since}..HEAD`;
    } else {
      gitLogCommand += ` -${maxCommits}`;
    }
    
    const commits = execGit(gitLogCommand);
    if (!commits) {
      return {
        content: [
          {
            type: "text",
            text: "No commits found for changelog generation.",
          },
        ],
      };
    }

    // Basic changelog generation (simplified version)
    const commitLines = commits.split('\n');
    const changelogEntries = commitLines.map(line => {
      const [hash, ...messageParts] = line.split(' ');
      const message = messageParts.join(' ');
      
      // Simple categorization based on conventional commits
      let category = 'Changes';
      if (message.startsWith('feat:') || message.startsWith('feature:')) {
        category = '🚀 Features';
      } else if (message.startsWith('fix:')) {
        category = '🐛 Bug Fixes';
      } else if (message.startsWith('docs:')) {
        category = '📚 Documentation';
      } else if (message.startsWith('refactor:')) {
        category = '♻️ Refactoring';
      } else if (message.startsWith('perf:')) {
        category = '⚡ Performance';
      }
      
      return { category, message, hash };
    });

    // Group by category
    const grouped = {};
    changelogEntries.forEach(entry => {
      if (!grouped[entry.category]) {
        grouped[entry.category] = [];
      }
      grouped[entry.category].push(`- ${entry.message} (${entry.hash})`);
    });

    // Build changelog
    const versionHeader = version ? `# Version ${version}` : `# Changelog`;
    const date = new Date().toISOString().split('T')[0];
    
    let changelog = `${versionHeader}\n*Generated on ${date}*\n\n`;
    
    Object.entries(grouped).forEach(([category, entries]) => {
      changelog += `## ${category}\n\n`;
      changelog += entries.join('\n') + '\n\n';
    });

    // Add configuration note
    changelog += '\n---\n*Note: This is a simplified changelog. For full AI-powered analysis with detailed categorization and summaries, please configure an AI provider (OpenAI, Claude, etc.) in the extension settings.*\n';

    return {
      content: [
        {
          type: "text",
          text: changelog,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Changelog generation failed: ${error.message}`);
  }
}

async function handleAnalyzeRepository(args) {
  try {
    const repoInfo = {
      branch: execGit('branch --show-current'),
      totalCommits: execGit('rev-list --count HEAD'),
      lastCommit: execGit('log -1 --format="%h - %s (%cr)"'),
      remotes: execGit('remote -v').split('\n').filter(line => line.trim()),
      status: execGit('status --porcelain'),
    };

    const analysis = `# Repository Analysis

## Current State
- **Branch**: ${repoInfo.branch}
- **Total Commits**: ${repoInfo.totalCommits}
- **Last Commit**: ${repoInfo.lastCommit}

## Remotes
${repoInfo.remotes.map(remote => `- ${remote}`).join('\n')}

## Working Directory Status
${repoInfo.status ? 
  `**Uncommitted changes detected:**\n\`\`\`\n${repoInfo.status}\n\`\`\`` : 
  '**Working directory is clean** ✅'
}

---
*For detailed health analysis and recommendations, please configure an AI provider in the extension settings.*`;

    return {
      content: [
        {
          type: "text", 
          text: analysis,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Repository analysis failed: ${error.message}`);
  }
}

async function handleWorkingDirectoryChanges(args) {
  try {
    const status = execGit('status --porcelain');
    
    if (!status) {
      return {
        content: [
          {
            type: "text",
            text: "No changes in working directory. Everything is up to date! ✅",
          },
        ],
      };
    }

    let changes = "# Working Directory Changes\n\n";
    
    // Parse git status output
    const lines = status.split('\n').filter(line => line.trim());
    const staged = [];
    const unstaged = [];
    const untracked = [];

    lines.forEach(line => {
      const statusCode = line.substring(0, 2);
      const fileName = line.substring(3);
      
      if (statusCode.startsWith('??')) {
        untracked.push(fileName);
      } else if (statusCode[0] !== ' ') {
        staged.push(`${fileName} (${getStatusDescription(statusCode[0])})`);
      } else if (statusCode[1] !== ' ') {
        unstaged.push(`${fileName} (${getStatusDescription(statusCode[1])})`);
      }
    });

    if (staged.length > 0) {
      changes += "## Staged Changes\n";
      changes += staged.map(item => `- ${item}`).join('\n') + '\n\n';
    }

    if (unstaged.length > 0) {
      changes += "## Unstaged Changes\n";
      changes += unstaged.map(item => `- ${item}`).join('\n') + '\n\n';
    }

    if (untracked.length > 0) {
      changes += "## Untracked Files\n";
      changes += untracked.map(item => `- ${item}`).join('\n') + '\n\n';
    }

    changes += '\n---\n*For AI-powered analysis of these changes, please configure an AI provider in the extension settings.*\n';

    return {
      content: [
        {
          type: "text",
          text: changes,
        },
      ],
    };
  } catch (error) {
    throw new Error(`Working directory analysis failed: ${error.message}`);
  }
}

function getStatusDescription(code) {
  switch (code) {
    case 'M': return 'modified';
    case 'A': return 'added'; 
    case 'D': return 'deleted';
    case 'R': return 'renamed';
    case 'C': return 'copied';
    case 'U': return 'updated but unmerged';
    default: return 'changed';
  }
}

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);

console.error("AI Changelog Generator MCP server running...");