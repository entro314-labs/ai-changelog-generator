#!/usr/bin/env node

/**
 * AI Changelog Generator MCP Server (Refactored Architecture)
 * Model Context Protocol server for AI changelog generation
 */

import AIChangelogMCPServer from '../src/infrastructure/mcp/mcp-server.service.js'

// Setup error handlers
process.on('uncaughtException', (error) => {
  console.error('MCP Server - Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('MCP Server - Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start the MCP server with new architecture
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      console.error('🚀 Starting AI Changelog Generator MCP Server )...')
      const server = new AIChangelogMCPServer()
      await server.run()
    } catch (error) {
      console.error('❌ Failed to start MCP Server:', error.message)
      if (process.env.DEBUG) {
        console.error(error.stack)
      }
      process.exit(1)
    }
  })().catch(() => process.exit(1))
}
