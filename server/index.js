#!/usr/bin/env node

/**
 * AI Changelog Generator DXT Extension Entry Point
 * Standalone MCP Server for Claude Desktop Extensions
 */

// Import the refactored MCP server implementation
import AIChangelogMCPServer from '../src/infrastructure/mcp/mcp-server.service.js';

// Create and start the server
const server = new AIChangelogMCPServer();

// Start the server with proper error handling
server.run().catch((error) => {
  console.error('Failed to start AI Changelog Generator MCP server:', error);
  process.exit(1);
});