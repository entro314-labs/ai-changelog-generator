#!/usr/bin/env node

/**
 * AI Changelog Generator MCP Server (Refactored Architecture)
 * Model Context Protocol server for AI changelog generation
 */

import process from 'node:process'

import AIChangelogMCPServer from '../src/infrastructure/mcp/mcp-server.service.js'

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

try {
  process.stderr.write('🚀 Starting AI Changelog Generator MCP Server...\n')
  const server = new AIChangelogMCPServer()
  await server.run()
} catch (error) {
  process.stderr.write(`❌ Failed to start MCP Server: ${getErrorMessage(error)}\n`)

  if (process.env.DEBUG === 'true' && error instanceof Error && error.stack) {
    process.stderr.write(`${error.stack}\n`)
  }

  process.exitCode = 1
}
