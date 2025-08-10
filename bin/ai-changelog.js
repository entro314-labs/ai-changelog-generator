#!/usr/bin/env node

/**
 * AI Changelog Generator CLI
 * Main command-line interface (Updated for refactored architecture)
 */

import { CLIController } from '../src/infrastructure/cli/cli.controller.js'

// Run the CLI with new refactored architecture using proper CLI controller
const cliController = new CLIController()
cliController.runCLI().catch((error) => {
  console.error('❌ CLI Error:', error.message)
  if (process.env.DEBUG) {
    console.error(error.stack)
  }
  process.exit(1)
})
