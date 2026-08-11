#!/usr/bin/env node

/**
 * AI Changelog Generator MCP Server
 * Provides Model Context Protocol interface for changelog generation
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { access, rename, unlink, writeFile as writeFileAsync } from 'node:fs/promises'
import path, { dirname } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { format, promisify } from 'node:util'

import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod'

import { ApplicationService } from '../../application/services/application.service.js'

import { formatChangelogOutput } from '../../shared/utils/utils.js'

import { ConfigurationManager } from '../config/configuration.manager.js'
import { ProviderManagerService } from '../providers/provider-manager.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const execFileAsync = promisify(execFile)

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

const SECRET_KEY_PATTERN =
  /(api[_-]?key|secret|token|password|passwd|credential|authorization|access[_-]?key|client[_-]?secret|private[_-]?key)/i

/**
 * Recursively redact secret-like values so provider configuration can be returned
 * safely over the MCP transport. provider.getConfiguration() returns the raw runtime
 * config (which includes API keys / tokens); without this, configure_providers
 * "list"/"configure" would serialize those secrets to the connected client.
 */
function redactProviderSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactProviderSecrets(item)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] =
        SECRET_KEY_PATTERN.test(key) && val !== null && val !== ''
          ? '***REDACTED***'
          : redactProviderSecrets(val)
    }
    return out as unknown as T
  }
  return value
}

function writeStdErrLine(message) {
  process.stderr.write(`${message}\n`)
}

export function normalizeChangelogResult(result, metadata: Record<string, any> = {}) {
  if (!result) {
    return null
  }

  if (typeof result === 'string') {
    return { content: result, metadata }
  }

  if (typeof result?.content === 'string') {
    return {
      content: result.content,
      metadata: { ...metadata, ...result.metadata },
    }
  }

  if (typeof result?.changelog === 'string') {
    return {
      content: result.changelog,
      metadata: {
        ...metadata,
        analyzedCommits: result.analyzedCommits?.length,
        workingDirectoryChanges: result.workingDirAnalysis?.changes?.length || 0,
        ...result.metadata,
      },
    }
  }

  return {
    content: JSON.stringify(result, null, 2),
    metadata,
  }
}

/**
 * Per-tool server-side time budgets, in milliseconds. Composed with the client's
 * own cancellation signal at dispatch.
 */
export const TOOL_TIMEOUTS: Record<string, number> = {
  generate_changelog: 120000,
  analyze_repository: 90000,
  analyze_current_changes: 60000,
  configure_providers: 30000,
}

const repositoryPathField = z
  .string()
  .optional()
  .describe('Path to the git repository (defaults to current directory)')

/**
 * Single source of truth for the tool surface: `registerTools` builds the server
 * from this, and the manifest-alignment test reads the same object, so the
 * advertised tools and the packaged manifest cannot drift apart.
 *
 * Schemas are Zod (SDK v2 derives the JSON Schema clients see, and validates
 * arguments before a handler runs).
 */
export const TOOL_DEFINITIONS = {
  generate_changelog: {
    title: 'Generate changelog',
    description: 'Generate AI-powered changelog from commits or working directory changes',
    inputSchema: z.object({
      repositoryPath: repositoryPathField,
      source: z
        .enum(['commits', 'working-dir', 'auto'])
        .default('auto')
        .describe('Source of changes to analyze'),
      since: z
        .string()
        .optional()
        .describe('For commit analysis: since tag/commit/date (e.g., "v1.0.0", "HEAD~10")'),
      tagRange: z
        .string()
        .optional()
        .describe('For commit analysis: tag range to generate between (e.g., "v1.0.0..v2.0.0")'),
      author: z.string().optional().describe('For commit analysis: filter commits by author'),
      version: z.string().optional().describe('Version number for changelog entry'),
      analysisMode: z
        .enum(['standard', 'detailed', 'enterprise'])
        .default('standard')
        .describe('Analysis depth level'),
      format: z
        .enum(['markdown', 'json', 'html'])
        .default('markdown')
        .describe('Output format for the generated changelog'),
      template: z
        .enum(['standard', 'keep-a-changelog', 'simple', 'semantic', 'github'])
        .optional()
        .describe('Changelog template style'),
      model: z.string().optional().describe('Override the AI model used for analysis'),
      includeAIAnalysis: z
        .boolean()
        .default(true)
        .describe('Include AI-powered analysis of changes (false => rule-based)'),
      includeAttribution: z.boolean().default(true).describe('Include AI attribution in output'),
      writeFile: z
        .boolean()
        .default(true)
        .describe(
          'Write changelog to AI_CHANGELOG file (extension matches format: .md/.json/.html)'
        ),
    }),
    outputSchema: z.object({
      version: z.string().optional(),
      source: z.string().optional(),
      since: z.string().optional(),
      format: z.string().optional(),
      analyzedCommits: z.number().optional(),
      workingDirectoryChanges: z.number().optional(),
      outputFile: z.string().optional().describe('Absolute path written, when writeFile was set'),
    }),
  },

  analyze_repository: {
    title: 'Analyze repository',
    description: 'Comprehensive repository analysis including health, commits, and branches',
    inputSchema: z.object({
      repositoryPath: repositoryPathField,
      analysisType: z
        .enum(['health', 'commits', 'branches', 'working-dir', 'comprehensive'])
        .default('comprehensive')
        .describe('Type of analysis to perform'),
      includeRecommendations: z
        .boolean()
        .default(true)
        .describe('Include improvement recommendations'),
      commitLimit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50)
        .describe('Maximum commits to analyze'),
      since: z.string().optional().describe('Only analyze commits after this tag/commit/date'),
      author: z.string().optional().describe('Filter commits by author'),
      tagRange: z.string().optional().describe('Analyze a tag range (e.g., "v1.0.0..v2.0.0")'),
    }),
  },

  analyze_current_changes: {
    title: 'Analyze current changes',
    description: 'Analyze staged and unstaged changes in working directory',
    inputSchema: z.object({
      repositoryPath: repositoryPathField,
      includeAIAnalysis: z
        .boolean()
        .default(true)
        .describe('Include AI-powered analysis of changes'),
      includeAttribution: z.boolean().default(true).describe('Include AI attribution in output'),
    }),
  },

  configure_providers: {
    title: 'Configure providers',
    description: 'Manage AI providers - list, switch, test, and configure',
    inputSchema: z.object({
      action: z
        .enum(['list', 'switch', 'test', 'configure', 'validate'])
        .default('list')
        .describe('Provider management action'),
      provider: z
        .enum([
          'vercel-gateway',
          'openai',
          'azure',
          'anthropic',
          'google',
          'bedrock',
          'huggingface',
          'github-copilot',
          'vertex',
          'ollama',
          'lmstudio',
          'auto',
        ])
        .optional()
        .describe('Specific provider for switch/test/configure actions'),
      testConnection: z.boolean().default(false).describe('Test connection after configuration'),
    }),
  },
} as const

class AIChangelogMCPServer {
  [key: string]: any
  constructor() {
    this.isShuttingDown = false
    this.shutdownPromise = null
    this.resolveShutdown = null

    this.initializeServer()
    this.initializeServices()
    this.registerTools()
  }

  initializeServer() {
    // Walk up to the nearest package.json rather than assuming a fixed depth:
    // the built layout (dist/src/infrastructure/mcp) sits one level deeper than
    // the source layout, so a hardcoded '../../../' resolved to a nonexistent
    // dist/package.json and the server advertised version 1.0.0 to every client.
    let packageJson = { version: '0.0.0', name: 'ai-changelog-generator' }
    let directory = __dirname
    for (let depth = 0; depth < 6; depth++) {
      const candidate = path.join(directory, 'package.json')
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'))
        if (parsed?.version) {
          packageJson = parsed
          break
        }
      } catch {
        // keep walking up
      }
      const parent = path.dirname(directory)
      if (parent === directory) {
        break
      }
      directory = parent
    }

    // Capabilities are declared implicitly by what gets registered, so there is
    // no separate capabilities block to keep in sync with the tool list.
    this.server = new McpServer({
      name: 'ai-changelog-generator',
      version: packageJson.version,
    })
  }

  initializeServices() {
    try {
      // Set MCP server mode to suppress verbose logging
      process.env.MCP_SERVER_MODE = 'true'
      this.redirectStdoutLoggingToStderr()

      // Initialize configuration
      this.configManager = new ConfigurationManager()

      // Initialize provider service
      this.providerService = new ProviderManagerService(this.configManager.getAll())

      // Log available configuration
      const hasProvider = process.env.AI_PROVIDER
      const hasApiKey =
        process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_API_KEY

      if (!(hasProvider && hasApiKey)) {
        writeStdErrLine(
          '[MCP] Warning: No AI provider or API key configured. Tools will provide configuration guidance.'
        )
      } else {
        writeStdErrLine(`[MCP] Configured with provider: ${process.env.AI_PROVIDER}`)
      }

      this.initPromise = Promise.resolve()
    } catch (error) {
      writeStdErrLine(`[MCP] Failed to initialize services: ${getErrorMessage(error)}`)
      writeStdErrLine('[MCP] Server will start but tools may require configuration')
    }
  }

  redirectStdoutLoggingToStderr() {
    if (this.stdoutRedirected) {
      return
    }

    const redirect = (...args) => {
      writeStdErrLine(format(...args))
    }

    console.log = redirect
    console.info = redirect
    console.debug = redirect
    console.time = () => {}
    console.timeEnd = () => {}
    this.stdoutRedirected = true
  }

  /**
   * Register every tool on the McpServer.
   *
   * The SDK derives the advertised JSON Schema from these Zod schemas and
   * validates arguments BEFORE the handler runs, so handlers no longer hand-check
   * their inputs. `outputSchema` additionally makes the result machine-readable:
   * clients get `structuredContent` alongside the human-facing text block.
   */
  registerTools() {
    for (const [name, definition] of Object.entries(TOOL_DEFINITIONS)) {
      this.server.registerTool(
        name,
        {
          title: definition.title,
          description: definition.description,
          inputSchema: definition.inputSchema,
          // Only some tools declare a structured result contract.
          ...('outputSchema' in definition ? { outputSchema: definition.outputSchema } : {}),
        },
        (args, ctx) => this.runTool(name, args, ctx)
      )
    }
  }

  /**
   * Shared execution wrapper: applies the per-tool time budget, resolves the
   * repository path, and converts thrown errors into MCP error results.
   *
   * Cancellation composes two sources — the client's own cancellation
   * (`ctx.mcpReq.signal`) and a server-side time budget. Passing the combined
   * signal down means a timed-out or cancelled call stops before performing
   * durable side effects, rather than completing a write after the caller has
   * already been told it failed and possibly retried.
   */
  async runTool(name, args: Record<string, any> = {}, ctx?: any) {
    writeStdErrLine(`[MCP] Tool call: ${name}`)
    const startTime = Date.now()

    const timeout = TOOL_TIMEOUTS[name] ?? 60000
    const timeoutSignal = AbortSignal.timeout(timeout)
    const signal = ctx?.mcpReq?.signal
      ? AbortSignal.any([ctx.mcpReq.signal, timeoutSignal])
      : timeoutSignal

    try {
      const repositoryPath = args.repositoryPath || process.cwd()
      if (name !== 'configure_providers') {
        try {
          await access(repositoryPath)
        } catch {
          throw new Error(`Repository path does not exist: ${repositoryPath}`)
        }
      }

      let result
      switch (name) {
        case 'generate_changelog':
          result = await this.generateChangelog({ ...args, repositoryPath }, signal)
          break
        case 'analyze_repository':
          result = await this.analyzeRepository({ ...args, repositoryPath })
          break
        case 'analyze_current_changes':
          result = await this.analyzeCurrentChanges({ ...args, repositoryPath })
          break
        case 'configure_providers':
          result = await this.configureProviders(args)
          break
        default:
          throw new Error(`Unknown tool: ${name}`)
      }

      writeStdErrLine(`[MCP-TIMER] ${name}: ${Date.now() - startTime}ms`)
      return result
    } catch (error) {
      if (signal.aborted && timeoutSignal.aborted) {
        writeStdErrLine(`[MCP] Tool '${name}' timed out after ${timeout}ms`)
        return this.formatError(new Error(`Tool '${name}' timed out`), name)
      }
      writeStdErrLine(`[MCP] Tool error [${name}]: ${getErrorMessage(error)}`)
      return this.formatError(error, name)
    }
  }

  async createApplicationService(repositoryPath) {
    const appService = new ApplicationService({
      repositoryPath,
      cwd: repositoryPath,
      silent: true,
      config: this.configManager?.getAll?.() || {},
    })
    await appService.ensureInitialized()
    return appService
  }

  async generateChangelog(args, signal?: AbortSignal) {
    const {
      repositoryPath,
      source = 'auto',
      since,
      tagRange,
      author,
      version,
      analysisMode = 'standard',
      format = 'markdown',
      template,
      model,
      includeAIAnalysis = true,
      includeAttribution = true,
      writeFile = true,
    } = args

    try {
      // Ensure services are initialized
      if (this.initPromise) {
        await this.initPromise
      }

      const appService = await this.createApplicationService(repositoryPath)

      // Thread the analysis depth + model override through the shared delegation
      // methods so the connected client controls model tier the same way the CLI does.
      appService.setAnalysisMode(analysisMode)
      if (model) {
        appService.setModelOverride(model)
      }

      let normalizedResult

      if (
        source === 'working-dir' ||
        (source === 'auto' && (await this.hasWorkingDirectoryChanges(repositoryPath)))
      ) {
        const result = await appService.orchestrator.changelogService.generateWorkspaceChangelog(
          version,
          {
            analysisMode,
            format,
            template,
            includeAIAnalysis,
            includeAttribution,
          }
        )

        normalizedResult = normalizeChangelogResult(result, {
          version,
          source: 'working-directory',
          filesProcessed: result?.filesProcessed,
          filesSkipped: result?.filesSkipped,
        })
      } else {
        // The MCP server owns the file write below (honoring writeFile + format), so we
        // intentionally do NOT pass outputFile here — that would double-write via
        // handleUnifiedOutput. analysisMode previously dropped here is now applied above.
        const result = await appService.generateChangelog({
          version,
          since,
          author,
          tagRange,
          format,
          template,
          analysisMode,
          includeAIAnalysis,
          includeAttribution,
          includeWorkingDirectoryChanges: false,
          silent: true,
        })

        normalizedResult = normalizeChangelogResult(result, {
          version,
          since,
          source: 'commits',
        })
      }

      // Format ONCE, then use the same value for both the response and the file.
      // Formatting only on the write path made a json/html caller receive raw
      // markdown in the response while the file on disk held the requested format.
      const extensions = { markdown: 'md', json: 'json', html: 'html' }
      const extension = extensions[format] || 'md'
      const formattedContent =
        normalizedResult?.content && format !== 'markdown'
          ? formatChangelogOutput(normalizedResult.content, format, {
              version,
              generatedAt: new Date().toISOString(),
            })
          : normalizedResult?.content

      let writtenPath
      if (writeFile && formattedContent) {
        // A timed-out call has already been reported to the client as a failure;
        // completing the write afterwards would let a retry race the original
        // operation over the same path.
        if (signal?.aborted) {
          throw new Error('Changelog generation was cancelled before the file could be written')
        }

        const changelogPath = path.join(repositoryPath, `AI_CHANGELOG.${extension}`)
        // Write to a sibling temp file and rename: rename is atomic within a
        // filesystem, so a concurrent reader sees either the old file or the new
        // one, never a partially written changelog.
        const tempPath = `${changelogPath}.${process.pid}.tmp`
        try {
          await writeFileAsync(tempPath, formattedContent, 'utf8')
          await rename(tempPath, changelogPath)
          writtenPath = changelogPath
          writeStdErrLine(`[MCP] Changelog written to: ${changelogPath}`)
        } catch (writeError) {
          await unlink(tempPath).catch(() => {})
          // Surface the failure: the caller asked for the file to be written, so
          // reporting success here would make "generated and saved" and
          // "generated but not saved" indistinguishable.
          throw new Error(
            `Changelog generated but could not be written to ${changelogPath}: ${getErrorMessage(writeError)}`,
            { cause: writeError }
          )
        }
      }

      // `structuredContent` is validated against the tool's outputSchema, giving
      // clients machine-readable metadata (what was analyzed, where it was
      // written) instead of only prose they would have to parse.
      const structuredContent = {
        ...(version ? { version } : {}),
        ...(normalizedResult?.metadata?.source ? { source: normalizedResult.metadata.source } : {}),
        ...(since ? { since } : {}),
        format,
        ...(typeof normalizedResult?.metadata?.analyzedCommits === 'number'
          ? { analyzedCommits: normalizedResult.metadata.analyzedCommits }
          : {}),
        ...(typeof normalizedResult?.metadata?.workingDirectoryChanges === 'number'
          ? { workingDirectoryChanges: normalizedResult.metadata.workingDirectoryChanges }
          : {}),
        ...(writtenPath ? { outputFile: writtenPath } : {}),
      }

      return {
        content: [
          {
            type: 'text',
            text: formattedContent || 'No changelog content generated',
          },
        ],
        structuredContent,
      }
    } catch (error) {
      throw new Error(`Changelog generation failed: ${getErrorMessage(error)}`, { cause: error })
    }
  }

  async analyzeRepository(args) {
    const { repositoryPath } = args
    const { analysisType = 'comprehensive', includeRecommendations = true, commitLimit = 50 } = args

    try {
      // Ensure services are initialized
      if (this.initPromise) {
        await this.initPromise
      }
      const appService = await this.createApplicationService(repositoryPath)
      const orchestrator = appService.orchestrator

      let result

      switch (analysisType) {
        case 'health':
          result = await orchestrator.gitService.assessRepositoryHealth(includeRecommendations)
          break
        case 'commits':
          result = await orchestrator.analysisEngine.analyzeRecentCommits(commitLimit)
          break
        case 'branches':
          result = await orchestrator.gitService.analyzeBranches()
          break
        case 'working-dir':
          result = await orchestrator.analysisEngine.analyzeCurrentChanges()
          break
        default:
          result = await appService.analyzeRepository({ type: analysisType })
          break
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      throw new Error(`Repository analysis failed: ${getErrorMessage(error)}`, { cause: error })
    }
  }

  async analyzeCurrentChanges(args) {
    const { repositoryPath, includeAIAnalysis = true, includeAttribution = true } = args

    try {
      if (this.initPromise) {
        await this.initPromise
      }
      const appService = await this.createApplicationService(repositoryPath)

      const result = await appService.orchestrator.analysisEngine.analyzeCurrentChanges({
        includeAIAnalysis,
        includeAttribution,
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      throw new Error(`Current changes analysis failed: ${getErrorMessage(error)}`, {
        cause: error,
      })
    }
  }

  async configureProviders(args) {
    const { action = 'list', provider, testConnection = false } = args

    try {
      let result

      switch (action) {
        case 'list':
          result = redactProviderSecrets(await this.providerService.listProviders())
          break
        case 'switch': {
          if (!provider) {
            throw new Error('Provider required for switch action')
          }
          const switchResult = await this.providerService.switchProvider(provider)
          // Return a structured object; concatenating result objects with += previously
          // produced "[object Object]" garbage in the serialized response.
          result = testConnection
            ? { switch: switchResult, test: await this.providerService.testProvider(provider) }
            : switchResult
          break
        }
        case 'test': {
          const activeProvider = this.providerService.getActiveProvider()
          if (!activeProvider) {
            throw new Error('No active provider found')
          }
          result = await this.providerService.testProvider(activeProvider.getName())
          break
        }
        case 'configure': {
          if (!provider) {
            throw new Error('Provider required for configure action')
          }
          const providerData = this.providerService.findProviderByName(provider)
          if (!providerData) {
            throw new Error(`Provider '${provider}' not found`)
          }
          result = {
            name: provider,
            available: providerData.available,
            configuration: redactProviderSecrets(
              providerData.instance.getConfiguration ? providerData.instance.getConfiguration() : {}
            ),
            requiredVars: providerData.instance.getRequiredEnvVars
              ? providerData.instance.getRequiredEnvVars()
              : [],
          }
          break
        }
        case 'validate': {
          const validationResults = await this.providerService.validateAll()
          result = validationResults
          break
        }
        default:
          throw new Error(`Unknown action: ${action}`)
      }

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      throw new Error(`Provider management failed: ${getErrorMessage(error)}`, { cause: error })
    }
  }

  async hasWorkingDirectoryChanges(repositoryPath = process.cwd()) {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
        encoding: 'utf8',
        cwd: repositoryPath,
      })
      return stdout.trim().length > 0
    } catch (error) {
      writeStdErrLine(`[MCP] Git check warning: ${getErrorMessage(error)}`)
      return false
    }
  }

  formatError(error, toolName) {
    if (error.message.includes('timed out')) {
      return {
        content: [
          {
            type: 'text',
            text: `⏱️ Timeout: '${toolName}' exceeded time limit. Try with smaller scope or check connectivity.`,
          },
        ],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error in '${toolName}': ${getErrorMessage(error)}`,
        },
      ],
      isError: true,
    }
  }

  createShutdownPromise() {
    if (!this.shutdownPromise) {
      this.shutdownPromise = new Promise((resolve) => {
        this.resolveShutdown = resolve
      })
    }

    return this.shutdownPromise
  }

  finishShutdown(exitCode = 0) {
    process.exitCode = exitCode

    if (this.resolveShutdown) {
      this.resolveShutdown()
      this.resolveShutdown = null
    }
  }

  async gracefulShutdown(signal, exitCode = 1) {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    writeStdErrLine(`[MCP] Received ${signal}, shutting down gracefully...`)

    try {
      // Closing the stdio handle tears down both the pinned server instance and
      // the transport; fall back to the server itself if run() never started.
      if (this.stdioHandle) {
        await this.stdioHandle.close()
      } else {
        await this.server.close()
      }
      this.finishShutdown(exitCode)
    } catch (error) {
      writeStdErrLine(`[MCP] Error during shutdown: ${getErrorMessage(error)}`)
      this.finishShutdown(1)
    }
  }

  async run() {
    try {
      // serveStdio owns transport construction, connection and its own signal
      // handling. It takes a factory because the 2026-07-28 protocol allows a
      // fresh server instance per session; this process serves one session, so
      // the already-constructed instance is returned.
      this.stdioHandle = serveStdio(() => this.server)

      process.on('SIGINT', () => {
        void this.gracefulShutdown('SIGINT', 1)
      })
      process.on('SIGTERM', () => {
        void this.gracefulShutdown('SIGTERM', 1)
      })
      process.on('SIGQUIT', () => {
        void this.gracefulShutdown('SIGQUIT', 1)
      })
      process.on('uncaughtException', (error) => {
        writeStdErrLine(`[MCP] Uncaught exception: ${getErrorMessage(error)}`)
        if (process.env.DEBUG === 'true' && error.stack) {
          writeStdErrLine(error.stack)
        }
        void this.gracefulShutdown('uncaughtException', 1)
      })
      process.on('unhandledRejection', (reason) => {
        writeStdErrLine(`[MCP] Unhandled rejection: ${getErrorMessage(reason)}`)
        if (process.env.DEBUG === 'true' && reason instanceof Error && reason.stack) {
          writeStdErrLine(reason.stack)
        }
        void this.gracefulShutdown('unhandledRejection', 1)
      })

      writeStdErrLine('[MCP] AI Changelog Generator server running...')
      await this.createShutdownPromise()
    } catch (error) {
      writeStdErrLine(`[MCP] Server failed to start: ${getErrorMessage(error)}`)
      throw error
    }
  }
}

// Start server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new AIChangelogMCPServer()
  server.run().catch((error) => {
    writeStdErrLine(`MCP Server startup failed: ${getErrorMessage(error)}`)
    process.exit(1)
  })
}

export default AIChangelogMCPServer
