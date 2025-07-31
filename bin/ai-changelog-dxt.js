#!/usr/bin/env node

/**
 * AI Changelog Generator - Claude Desktop Extension Entry Point
 * Optimized for DXT packaging and Claude Desktop integration
 */

import AIChangelogMCPServer from '../src/infrastructure/mcp/mcp-server.service.js';
import { runMCPServer, setupProcessErrorHandlers } from '../src/shared/utils/cli-entry-utils.js';

// Setup error handlers for DXT environment
setupProcessErrorHandlers('AI Changelog Generator - Claude Desktop Extension');

// DXT-specific initialization
async function initializeDXTServer() {
  await runMCPServer(
    'AI Changelog Generator - Claude Desktop Extension',
    '3.0.0',
    AIChangelogMCPServer,
    {
      tools: ['generate_changelog', 'get_git_info', 'analyze_commits', 'list_providers'],
      debugMode: process.env.DEBUG === 'true'
    }
  );
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDXTServer().catch((error) => {
    console.error('💥 Fatal error starting AI Changelog Generator:', error);
    process.exit(1);
  });
}

export { initializeDXTServer };