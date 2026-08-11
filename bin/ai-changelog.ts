#!/usr/bin/env node

/**
 * AI Changelog Generator CLI
 * Main command-line interface (Updated for refactored architecture)
 */

import process from 'node:process'

import { CLIController } from '../src/infrastructure/cli/cli.controller.js'

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

try {
  const cliController = new CLIController()
  await cliController.runCLI()
  process.exit(process.exitCode ?? 0)
} catch (error) {
  process.stderr.write(`❌ CLI error: ${getErrorMessage(error)}\n`)

  if (process.env.DEBUG === 'true' && error instanceof Error && error.stack) {
    process.stderr.write(`${error.stack}\n`)
  }

  process.exit(1)
}
