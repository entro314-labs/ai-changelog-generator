import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChangelogOrchestrator } from '../src/application/orchestrators/changelog.orchestrator.js'
import { ApplicationService } from '../src/application/services/application.service.js'
import { AIAnalysisService } from '../src/domains/ai/ai-analysis.service.js'
import { AnalysisEngine } from '../src/domains/analysis/analysis.engine.js'
import { ChangelogService } from '../src/domains/changelog/changelog.service.js'
import { GitManager } from '../src/domains/git/git-manager.js'
import { ConfigurationManager } from '../src/infrastructure/config/configuration.manager.js'
import CredentialTestingService from '../src/infrastructure/credentials/credential-testing-service.js'
import { ConfigStorage } from '../src/infrastructure/credentials/storage/config-storage.js'
import { EnvStorage } from '../src/infrastructure/credentials/storage/env-storage.js'
import {
  normalizeChangelogResult,
  TOOL_DEFINITIONS,
} from '../src/infrastructure/mcp/mcp-server.service.js'
import LMStudioProvider from '../src/infrastructure/providers/implementations/lmstudio.js'
import OllamaProviderClass from '../src/infrastructure/providers/implementations/ollama.js'
import VercelGatewayProvider, {
  DEFAULT_GATEWAY_MODEL,
} from '../src/infrastructure/providers/implementations/vercel-gateway.js'
import ProviderManagerService from '../src/infrastructure/providers/provider-manager.service.js'
import { applyMixins } from '../src/infrastructure/providers/utils/base-provider-helpers.js'
import {
  decodeBedrockCredential,
  encodeBedrockCredential,
} from '../src/infrastructure/providers/utils/provider-utils.js'

const tempDirectories: string[] = []

function createTempGitRepository() {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-changelog-fidelity-'))
  tempDirectories.push(repoPath)

  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'Codex Tester'], {
    cwd: repoPath,
    stdio: 'ignore',
  })
  execFileSync('git', ['config', 'user.email', 'codex@example.com'], {
    cwd: repoPath,
    stdio: 'ignore',
  })

  return repoPath
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop()
    if (directory && fs.existsSync(directory)) {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe('Fidelity regressions', () => {
  it('keeps workspace env credentials above global files and process.env', async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-changelog-workspace-'))
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-changelog-home-'))
    tempDirectories.push(workspaceRoot, homeDir)
    fs.mkdirSync(path.join(homeDir, '.config', 'ai-changelog'), { recursive: true })
    fs.writeFileSync(
      path.join(homeDir, '.config', 'ai-changelog', '.env.local'),
      'OPENAI_API_KEY="global-key"\n'
    )
    fs.writeFileSync(path.join(workspaceRoot, '.env'), 'OPENAI_API_KEY="workspace-key"\n')
    fs.writeFileSync(
      path.join(workspaceRoot, '.env.local'),
      'OPENAI_API_KEY="workspace-local-key"\n'
    )

    const storage = new EnvStorage({ workspaceRoot, homeDir })

    await expect(storage.get('openai')).resolves.toBe('workspace-local-key')
    await expect(storage.getMetadata('openai')).resolves.toMatchObject({
      source: 'workspace_env',
      filePath: path.join(workspaceRoot, '.env.local'),
    })
  })

  it('honors disabled global and system environment credential sources', async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-changelog-workspace-'))
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-changelog-home-'))
    tempDirectories.push(workspaceRoot, homeDir)
    fs.writeFileSync(path.join(homeDir, '.env'), 'OPENAI_API_KEY="global-key"\n')

    const storage = new EnvStorage({
      workspaceRoot,
      homeDir,
      useGlobalEnvironmentFiles: false,
      useSystemEnvironmentVariables: false,
    })

    await expect(storage.get('openai')).resolves.toBeNull()
  })

  it('resolves explicitly stored encrypted credentials without enabling discovery', async () => {
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-changelog-config-'))
    tempDirectories.push(configDir)
    const storedValue = 'sk-stored-credential-1234567890'
    await new ConfigStorage({ configDir }).set('openai', storedValue)

    const configManager = new ConfigurationManager(null, null, {
      autoDetectCredentials: false,
      configDir,
      config: {
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: undefined,
      },
    })

    await configManager.initializeCredentialDetection()

    expect(configManager.get('OPENAI_API_KEY')).toBe(storedValue)
    expect(configManager.getDetectedCredentials()).toEqual([])
  })

  it('stores and resolves complete Bedrock credentials as one protected bundle', async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-changelog-workspace-'))
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-changelog-config-'))
    tempDirectories.push(workspaceRoot, configDir)
    const value = encodeBedrockCredential({
      accessKeyId: `AKIA${'A'.repeat(16)}`,
      secretAccessKey: 'secret-access-key-value',
      sessionToken: 'temporary-session-token',
      region: 'eu-west-1',
    })

    const envStorage = new EnvStorage({ workspaceRoot })
    await envStorage.set('bedrock', value)
    expect(decodeBedrockCredential(await envStorage.get('bedrock'))).toEqual({
      accessKeyId: `AKIA${'A'.repeat(16)}`,
      secretAccessKey: 'secret-access-key-value',
      sessionToken: 'temporary-session-token',
      region: 'eu-west-1',
    })

    await new ConfigStorage({ configDir }).set('bedrock', value)
    const configManager = new ConfigurationManager(null, null, {
      autoDetectCredentials: false,
      configDir,
      workspaceRoot,
      config: { AI_PROVIDER: 'bedrock' },
    })
    await configManager.initializeCredentialDetection()
    expect(configManager.get('AWS_ACCESS_KEY_ID')).toBe(`AKIA${'A'.repeat(16)}`)
    expect(configManager.get('AWS_SECRET_ACCESS_KEY')).toBe('secret-access-key-value')
    expect(configManager.get('AWS_SESSION_TOKEN')).toBe('temporary-session-token')
    expect(configManager.get('AWS_REGION')).toBe('eu-west-1')
  })

  it('records successful and failed provider credential use at the invocation boundary', async () => {
    const logCredentialUsage = vi.fn()
    const provider = {
      getName: () => 'openai',
      isAvailable: () => true,
      generateCompletion: vi
        .fn()
        .mockResolvedValueOnce({ content: 'ok' })
        .mockRejectedValueOnce(new Error('provider unavailable')),
    }
    const service = new AIAnalysisService(provider, {}, null, 'standard', {
      getCredentialManager: () => ({ logCredentialUsage }),
    })

    await expect(service.generateCompletion([])).resolves.toEqual({ content: 'ok' })
    await expect(service.generateCompletion([])).rejects.toThrow('provider unavailable')
    expect(logCredentialUsage).toHaveBeenNthCalledWith(1, 'openai', true, null)
    expect(logCredentialUsage).toHaveBeenNthCalledWith(2, 'openai', false, 'provider unavailable')
  })

  it('routes explicit analysis modes through the current analysis engine contract', async () => {
    const engine = new AnalysisEngine({}, {})
    const comprehensiveSpy = vi.spyOn(engine, 'analyzeComprehensive').mockResolvedValue({
      mode: 'comprehensive',
    } as any)
    const currentChangesSpy = vi.spyOn(engine, 'analyzeCurrentChanges').mockResolvedValue({
      mode: 'changes',
    } as any)

    await expect(engine.analyze('comprehensive')).resolves.toEqual({ mode: 'comprehensive' })
    await expect(engine.analyze('changes')).resolves.toEqual({ mode: 'changes' })
    expect(comprehensiveSpy).toHaveBeenCalledOnce()
    expect(currentChangesSpy).toHaveBeenCalledOnce()
  })

  it('evaluates git repository validity using configured cwd', () => {
    const repoPath = createTempGitRepository()
    const previousCwd = process.cwd()
    process.chdir(os.tmpdir())

    try {
      const gitManager = new GitManager({ cwd: repoPath })
      expect(gitManager.isGitRepo).toBe(true)
    } finally {
      process.chdir(previousCwd)
    }
  })

  it('keeps bedrock provider in runtime provider registry', () => {
    const manager = new ProviderManagerService({}, { fallbackToDefault: false })
    expect(manager.validateProviderName('bedrock')).toBe(true)
    expect(manager.getProviderPriority()).toContain('bedrock')
  })

  it('auto-selects bedrock when running in auto mode with AWS environment configuration', () => {
    const configManager = new ConfigurationManager(null, null, {
      autoDetectCredentials: false,
      config: {
        AI_PROVIDER: 'auto',
        OPENAI_API_KEY: undefined,
        ANTHROPIC_API_KEY: undefined,
        GOOGLE_API_KEY: undefined,
        GOOGLE_OAUTH_TOKEN: undefined,
        AZURE_OPENAI_ENDPOINT: undefined,
        AZURE_OPENAI_KEY: undefined,
        AZURE_OAUTH_TOKEN: undefined,
        AZURE_USE_AD_AUTH: undefined,
        GITHUB_COPILOT_TOKEN: undefined,
        VERTEX_PROJECT_ID: undefined,
        GOOGLE_APPLICATION_CREDENTIALS: undefined,
        OLLAMA_HOST: undefined,
        HUGGINGFACE_API_KEY: undefined,
        LMSTUDIO_BASE_URL: undefined,
        AWS_REGION: 'us-east-1',
      },
    })

    expect(configManager.getActiveProvider()).toBe('bedrock')
  })

  it('uses LM Studio base-url configuration without alias fallbacks', () => {
    const provider = new LMStudioProvider({
      LMSTUDIO_BASE_URL: 'http://localhost:1234',
    })

    expect(provider.isAvailable()).toBe(true)
  })

  it('keeps changelog commit entries even when AI summaries are unavailable', async () => {
    const changelogService = new ChangelogService(
      {
        getCommitAnalysis: vi.fn().mockResolvedValue({
          hash: 'abc1234',
          type: 'feat',
          semanticAnalysis: { category: 'feat', breaking: false },
          breakingChanges: [],
          files: [],
        }),
      },
      {
        selectOptimalModel: vi.fn().mockResolvedValue({ model: 'dummy' }),
        generateAISummary: vi.fn().mockResolvedValue(null),
      },
      null,
      null
    )

    const result = await changelogService.processCommitsSequentially(['abc1234'])

    expect(result).toHaveLength(1)
    expect(result[0].hash).toBe('abc1234')
    expect(result[0].type).toBe('feat')
    expect(result[0].breaking).toBe(false)
  })

  it('keeps MCP manifest tool list aligned with runtime list-tools response', () => {
    const manifestPath = path.resolve(process.cwd(), 'manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const manifestTools = manifest.tools.map((tool) => tool.name).sort()
    const runtimeTools = Object.keys(TOOL_DEFINITIONS).sort()

    expect(manifestTools).toEqual(runtimeTools)
  })

  it('uses a single analysis-mode contract for MCP changelog generation', () => {
    const analysisMode = TOOL_DEFINITIONS.generate_changelog.inputSchema.shape.analysisMode
    // Unwrap the ZodDefault to reach the underlying enum.
    expect(analysisMode.def.innerType.options).toEqual(['standard', 'detailed', 'enterprise'])
  })

  it('generates commit message context from staged changes, not unstaged working tree changes', async () => {
    const repoPath = createTempGitRepository()
    const filePath = path.join(repoPath, 'app.js')

    fs.writeFileSync(filePath, "export const value = 'initial';\n", 'utf8')
    execFileSync('git', ['add', 'app.js'], { cwd: repoPath, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'feat: initial'], { cwd: repoPath, stdio: 'ignore' })

    fs.writeFileSync(filePath, "export const value = 'staged change';\n", 'utf8')
    execFileSync('git', ['add', 'app.js'], { cwd: repoPath, stdio: 'ignore' })
    fs.writeFileSync(
      filePath,
      "export const value = 'staged change';\nexport const extra = 'unstaged change';\n",
      'utf8'
    )

    const appService = new ApplicationService({
      repositoryPath: repoPath,
      silent: true,
      config: {
        AI_PROVIDER: 'dummy',
      },
    })

    await appService.ensureInitialized()

    vi.spyOn(appService.orchestrator, 'generateAICommitMessage').mockResolvedValue(
      'feat: use staged change'
    )
    vi.spyOn(appService.orchestrator.validationService, 'validateCommitMessage').mockResolvedValue({
      valid: true,
      score: 100,
      errors: [],
      warnings: [],
      suggestions: [],
    })

    const result = await appService.generateCommitMessage()

    expect(result.message).toBe('feat: use staged change')
    expect(result.stagedFiles).toHaveLength(1)
    expect(result.stagedFiles[0].diff).toContain('staged change')
    expect(result.stagedFiles[0].diff).not.toContain('unstaged change')
  })

  it('keeps commit changelog generation commit-only unless working directory changes are explicitly requested', async () => {
    const analysisEngine = {
      analyzeCurrentChanges: vi.fn().mockResolvedValue({
        changes: [{ filePath: 'app.js' }],
      }),
    }
    const gitService = {
      getCommitsSince: vi.fn().mockResolvedValue([{ hash: 'abc1234', message: 'feat: add thing' }]),
    }
    const aiAnalysisService = {}
    const changelogService = new ChangelogService(
      gitService,
      aiAnalysisService,
      analysisEngine,
      null
    )

    vi.spyOn(changelogService, 'processCommitsSequentially').mockResolvedValue([
      { hash: 'abc1234', analysis: 'ready' },
    ])
    vi.spyOn(changelogService, 'generateReleaseInsights').mockResolvedValue({
      summary: 'Release summary',
      totalCommits: 1,
      commitTypes: { feat: 1 },
      riskLevel: 'low',
      affectedAreas: ['src'],
      breaking: false,
      complexity: 'low',
      businessImpact: 'low',
      deploymentRequirements: [],
    })
    vi.spyOn(changelogService, 'buildChangelog').mockResolvedValue('## Changelog')

    const writeSpy = vi.spyOn(fs, 'writeFileSync')

    const result = await changelogService.generateChangelog('v1.0.0', 'v0.9.0', {
      silent: true,
    })

    expect(result?.changelog).toBe('## Changelog')
    expect(analysisEngine.analyzeCurrentChanges).not.toHaveBeenCalled()
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('maps detected OAuth credentials to runtime fields without coercing them into API keys', () => {
    const configManager = new ConfigurationManager(null, null, {
      autoDetectCredentials: false,
      config: {
        GOOGLE_API_KEY: undefined,
        GOOGLE_OAUTH_TOKEN: undefined,
        AZURE_OPENAI_KEY: undefined,
        AZURE_OAUTH_TOKEN: undefined,
        ANTHROPIC_API_KEY: undefined,
        OPENAI_API_KEY: undefined,
      },
    })

    configManager.detectedCredentials = [
      {
        provider: 'google',
        source: 'gemini-cli',
        authType: 'oauth_token',
        rawValue: 'google-oauth-token-1234567890',
      },
      {
        provider: 'azure',
        source: 'azure-cli',
        authType: 'oauth_token',
        rawValue: 'azure-oauth-token-1234567890',
      },
      {
        provider: 'anthropic',
        source: 'claude-code',
        authType: 'oauth_token',
        rawValue: 'anthropic-oauth-token-1234567890',
      },
      {
        provider: 'openai',
        source: 'env',
        authType: 'api_key',
        rawValue: 'sk-openai-1234567890abcdefghijklmnop',
      },
    ]

    configManager.mergeDetectedCredentials()

    expect(configManager.get('GOOGLE_OAUTH_TOKEN')).toBe('google-oauth-token-1234567890')
    expect(configManager.get('GOOGLE_API_KEY')).toBeUndefined()
    expect(configManager.get('AZURE_OAUTH_TOKEN')).toBe('azure-oauth-token-1234567890')
    expect(configManager.get('AZURE_OPENAI_KEY')).toBeUndefined()
    expect(configManager.get('ANTHROPIC_API_KEY')).toBeUndefined()
    expect(configManager.get('OPENAI_API_KEY')).toBe('sk-openai-1234567890abcdefghijklmnop')
  })

  it('validates Google OAuth tokens separately from API keys and rejects unsupported Anthropic OAuth', async () => {
    const testingService = new CredentialTestingService()

    expect(
      testingService.validateFormat('google', 'google-oauth-token-1234567890', {
        authType: 'oauth_token',
      })
    ).toEqual({ valid: true, error: null })

    await expect(
      testingService.testCredential('anthropic', 'anthropic-oauth-token-1234567890', {
        authType: 'oauth_token',
      })
    ).resolves.toEqual({
      valid: false,
      error: 'Anthropic OAuth tokens are discovered but not supported by the runtime provider',
    })
  })

  it('normalizes MCP changelog results from commit-based generation into text content', () => {
    expect(
      normalizeChangelogResult(
        {
          changelog: '## Release notes',
          analyzedCommits: [{ hash: 'abc1234' }],
          workingDirAnalysis: { changes: [] },
        },
        { source: 'commits', version: 'v1.2.3' }
      )
    ).toEqual({
      content: '## Release notes',
      metadata: {
        source: 'commits',
        version: 'v1.2.3',
        analyzedCommits: 1,
        workingDirectoryChanges: 0,
      },
    })
  })
})

describe('Audit fixes', () => {
  /**
   * F-02: a provider outage must never delete a commit that git read successfully.
   * The bug only bit at <=20 commits, because that size takes the sequential path
   * while larger sets take the batch path, which already preserved them.
   */
  it('keeps commits when AI enrichment fails on the sequential path', async () => {
    const gitService = {
      getCommitAnalysis: async (hash) => ({ hash, files: [], message: 'feat: add thing' }),
    }
    const aiAnalysisService = {
      selectOptimalModel: async () => 'model',
      generateAISummary: async () => {
        throw new Error('provider unavailable')
      },
    }

    const service = new ChangelogService(gitService, aiAnalysisService)
    const analyzed = await service.processCommitsSequentially(['aaa1111', 'bbb2222'], {
      silent: true,
    })

    expect(analyzed).toHaveLength(2)
    expect(analyzed.every((c) => typeof c.type === 'string')).toBe(true)
    expect(analyzed.every((c) => c.aiSummary === undefined)).toBe(true)
  })

  /** F-02: an unreadable commit is still the one case that legitimately drops it. */
  it('drops only commits git cannot read', async () => {
    const gitService = {
      getCommitAnalysis: async (hash) => {
        if (hash === 'bad') {
          throw new Error('object not found')
        }
        return { hash, files: [], message: 'fix: repair' }
      },
    }
    const service = new ChangelogService(gitService, { hasAI: false })
    const analyzed = await service.processCommitsSequentially(['good', 'bad'], {
      silent: true,
      includeAIAnalysis: false,
    })

    expect(analyzed).toHaveLength(1)
    expect(analyzed[0].hash).toBe('good')
  })

  /** F-01: --no-ai / includeAIAnalysis:false must stop the provider being called. */
  it('never calls the provider when AI analysis is disabled', async () => {
    const generateAISummary = vi.fn()
    const service = new ChangelogService(
      { getCommitAnalysis: async (hash) => ({ hash, files: [], message: 'feat: x' }) },
      { selectOptimalModel: vi.fn(), generateAISummary }
    )

    const analyzed = await service.processCommitsSequentially(['aaa1111'], {
      silent: true,
      includeAIAnalysis: false,
    })

    expect(generateAISummary).not.toHaveBeenCalled()
    expect(analyzed).toHaveLength(1)
  })

  /**
   * F-04: includeAIAnalysis:false must beat the analysis mode. Detailed/enterprise
   * previously called the provider regardless of the caller's explicit opt-out.
   */
  it('keeps detailed-mode workspace generation rule-based when AI is disabled', async () => {
    const service = new ChangelogService({}, { hasAI: true })
    const aiSpy = vi
      .spyOn(service, 'generateAIChangelogContentFromChanges')
      .mockResolvedValue('ai-content')
    const basicSpy = vi
      .spyOn(service, 'generateBasicChangelogContentFromChanges')
      .mockReturnValue('rule-based-content')

    const content = await service.generateWorkspaceChangelogContent([], {}, {}, 'detailed', {
      includeAIAnalysis: false,
    })

    expect(content).toBe('rule-based-content')
    expect(aiSpy).not.toHaveBeenCalled()
    expect(basicSpy).toHaveBeenCalled()
  })

  /** F-03: since/author/tagRange were accepted and then ignored. */
  it('applies since and author filters when analyzing recent commits', async () => {
    const getCommitsSince = vi.fn().mockResolvedValue([])
    const getCommitsBetween = vi.fn().mockResolvedValue([])
    const engine = new AnalysisEngine({ getCommitsSince, getCommitsBetween }, { hasAI: false })

    await engine.analyzeRecentCommits(5, { since: 'v1.0.0', author: 'ada@example.com' })

    expect(getCommitsSince).toHaveBeenCalledWith('v1.0.0', { author: 'ada@example.com' })
    expect(getCommitsBetween).not.toHaveBeenCalled()
  })

  /** F-03: a tag range must route through the range query, not unfiltered history. */
  it('routes a tag range through getCommitsBetween', async () => {
    const getCommitsSince = vi.fn().mockResolvedValue([])
    const getCommitsBetween = vi.fn().mockResolvedValue([])
    const engine = new AnalysisEngine({ getCommitsSince, getCommitsBetween }, { hasAI: false })

    await engine.analyzeRecentCommits(10, { tagRange: 'v1.0.0..v2.0.0', author: undefined })

    expect(getCommitsBetween).toHaveBeenCalledWith('v1.0.0', 'v2.0.0', { author: undefined })
    expect(getCommitsSince).not.toHaveBeenCalled()
  })

  /**
   * F-10: a failed commit must restore the exact pre-run index. The old path-based
   * `git reset HEAD -- <paths>` discarded hunks staged before the run whenever a
   * file was both partially staged and partially unstaged.
   */
  it('restores partially staged hunks when a commit is rolled back', async () => {
    const repoPath = createTempGitRepository()
    const filePath = path.join(repoPath, 'tracked.txt')

    fs.writeFileSync(filePath, 'line1\n')
    execFileSync('git', ['add', 'tracked.txt'], { cwd: repoPath, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'chore: seed'], { cwd: repoPath, stdio: 'ignore' })

    // Stage one revision, then leave a further edit unstaged: the file is now in
    // BOTH the staged and unstaged lists, which is what broke the old rollback.
    fs.writeFileSync(filePath, 'line1\nstaged-change\n')
    execFileSync('git', ['add', 'tracked.txt'], { cwd: repoPath, stdio: 'ignore' })
    fs.writeFileSync(filePath, 'line1\nstaged-change\nunstaged-change\n')

    const stagedBefore = execFileSync('git', ['diff', '--cached'], {
      cwd: repoPath,
      encoding: 'utf8',
    })
    expect(stagedBefore).toContain('staged-change')

    const orchestrator = new ChangelogOrchestrator(new ConfigurationManager(null, null, {}), {})
    const gitExecOptions = { cwd: repoPath }

    const snapshot = await orchestrator.captureIndexSnapshot(gitExecOptions)
    expect(snapshot).toBeTruthy()

    // Simulate the run staging everything, then failing.
    execFileSync('git', ['add', '-A'], { cwd: repoPath, stdio: 'ignore' })
    expect(
      execFileSync('git', ['diff', '--cached'], { cwd: repoPath, encoding: 'utf8' })
    ).toContain('unstaged-change')

    await expect(orchestrator.restoreIndexSnapshot(snapshot, gitExecOptions)).resolves.toBe(true)

    const stagedAfter = execFileSync('git', ['diff', '--cached'], {
      cwd: repoPath,
      encoding: 'utf8',
    })
    expect(stagedAfter).toBe(stagedBefore)
    expect(stagedAfter).toContain('staged-change')
    expect(stagedAfter).not.toContain('unstaged-change')

    // The working tree must be untouched by the index restore.
    expect(fs.readFileSync(filePath, 'utf8')).toBe('line1\nstaged-change\nunstaged-change\n')
  })
})

describe('Provider mixin precedence', () => {
  /**
   * Mixins fill gaps; they must never replace a provider's own implementation.
   * A plain Object.assign used to overwrite the class body, which silently
   * disabled every provider-specific credential and capability declaration.
   */
  it('lets a provider class method win over the mixin default', () => {
    class Probe {
      config: Record<string, any> = {}
      getRequiredEnvVars() {
        return ['PROBE_SPECIFIC_TOKEN']
      }
    }

    applyMixins(Probe, 'probe')
    const probe = new Probe()

    expect(probe.getRequiredEnvVars()).toEqual(['PROBE_SPECIFIC_TOKEN'])
    // Gaps are still filled by the mixins.
    expect(typeof (probe as any).handleProviderError).toBe('function')
    expect(typeof (probe as any).getProviderModelConfig).toBe('function')
  })

  it('supplies the generic default when the provider declares nothing', () => {
    class Bare {
      config: Record<string, any> = {}
    }

    applyMixins(Bare, 'bare')
    expect(new Bare().getRequiredEnvVars()).toEqual(['BARE_API_KEY'])
  })

  it('declares each provider real credential requirements', () => {
    expect(
      new OllamaProviderClass({ OLLAMA_HOST: 'http://localhost:11434' }).getRequiredEnvVars()
    ).toEqual(['OLLAMA_HOST'])
    expect(new VercelGatewayProvider({}).getRequiredEnvVars()).toEqual(['AI_GATEWAY_API_KEY'])
  })
})

describe('Vercel AI Gateway provider', () => {
  it('is unavailable without a gateway credential', () => {
    const provider = new VercelGatewayProvider({})
    expect(provider.isAvailable()).toBe(false)
    expect(provider.getName()).toBe('vercel-gateway')
    expect(provider.getRequiredEnvVars()).toContain('AI_GATEWAY_API_KEY')
  })

  it('becomes available with an API key or an OIDC token', () => {
    expect(new VercelGatewayProvider({ AI_GATEWAY_API_KEY: 'key-value' }).isAvailable()).toBe(true)
    expect(new VercelGatewayProvider({ VERCEL_OIDC_TOKEN: 'oidc-value' }).isAvailable()).toBe(true)
  })

  it('defaults to the pinned DeepSeek Flash snapshot and honors AI_MODEL', () => {
    expect(DEFAULT_GATEWAY_MODEL).toBe('deepseek/deepseek-v4-flash-0731')
    expect(new VercelGatewayProvider({}).getDefaultModel()).toBe(DEFAULT_GATEWAY_MODEL)

    expect(
      new VercelGatewayProvider({ AI_MODEL: 'anthropic/claude-sonnet-5' }).getDefaultModel()
    ).toBe('anthropic/claude-sonnet-5')
  })

  it('falls back to a static catalogue when discovery fails', async () => {
    const provider = new VercelGatewayProvider({ AI_GATEWAY_API_KEY: 'key-value' })
    provider.client = Object.assign(() => ({}), {
      getAvailableModels: async () => {
        throw new Error('gateway unreachable')
      },
    })

    const models = await provider.getAvailableModels()
    expect(models.length).toBeGreaterThan(0)
    expect(models.map((m) => m.id)).toContain(DEFAULT_GATEWAY_MODEL)
  })

  it('reports a configuration error rather than throwing when unconfigured', async () => {
    const provider = new VercelGatewayProvider({})
    const result = await provider.generateCompletion([{ role: 'user', content: 'hi' }])
    expect(result).toBeDefined()
  })

  it('is registered in the provider registry alongside BYOK and local providers', () => {
    const manager = new ProviderManagerService({}, {})
    expect(Object.keys(manager.providerClasses)).toEqual(
      expect.arrayContaining([
        'vercel-gateway',
        'openai',
        'anthropic',
        'google',
        'azure',
        'bedrock',
        'ollama',
        'lmstudio',
      ])
    )
  })
})
