/**
 * TypeScript definitions for AI Changelog Generator
 * Updated for GPT-4.1 series and o3/o4 reasoning models
 */

// Core Git Types
export interface CommitInfo {
  hash: string
  author: string
  email: string
  date: string
  message: string
  files?: string[]
  additions?: number
  deletions?: number
  type?: string
  scope?: string
  subject?: string
  body?: string
  footer?: string
  breaking?: boolean
}

export interface GitInfo {
  repository: {
    name: string
    owner: string
    url: string
    remoteUrl: string
  }
  currentBranch: string
  totalCommits: number
  contributors: number
  lastCommit: {
    hash: string
    date: string
    author: string
  }
  stats: {
    branches: number
    tags: number
    stashes: number
  }
}

export interface GitStatus {
  staged: string[]
  unstaged: string[]
  untracked: string[]
  conflicts: string[]
  ahead: number
  behind: number
}

export interface BranchAnalysis {
  branches: Array<{
    name: string
    current: boolean
    lastCommit: {
      hash: string
      date: string
      author: string
      message: string
    }
    ahead: number
    behind: number
    unmergedCommits: CommitInfo[]
  }>
  danglingCommits: CommitInfo[]
  recommendations: string[]
}

// AI Provider Types
export type AIProvider = 'openai' | 'azure' | 'auto'
export type AIModel =
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-4.1-nano'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'o4'
  | 'o4-mini' // Latest reasoning models
  | 'o3'
  | 'o3-mini' // Previous generation reasoning models

export interface ModelCapabilities {
  reasoning: boolean
  largeContext: boolean
  mediumContext: boolean
  standardContext: boolean
  promptCaching: boolean
  textGeneration: boolean
  tools: boolean
  parallelToolCalling: boolean
  reasoningSummary: boolean
  latestReasoning: boolean
  ultraEfficient: boolean
  costEfficient: boolean
  codingOptimized: boolean
}

export interface AIProviderConfig {
  provider: AIProvider
  openaiKey?: string
  azureConfig?: {
    endpoint: string
    key: string
    deploymentName: string
    apiVersion: string
    useV1API?: boolean
  }
  modelConfig: {
    default: AIModel
    simple: AIModel
    complex: AIModel
    reasoning: AIModel
    advanced_reasoning: AIModel
    reasoning_legacy: AIModel
    advanced_reasoning_legacy: AIModel
    nano: AIModel
  }
}

export interface AIResponse {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

// Analysis Types
export type AnalysisMode = 'standard' | 'detailed' | 'enterprise'
export type OutputFormat = 'markdown' | 'json'
export type TemplateType = 'standard' | 'keep-a-changelog' | 'simple' | 'semantic' | 'github'

export interface ChangelogOptions {
  repositoryPath?: string
  since?: string
  version?: string
  analysisMode?: AnalysisMode
  outputFormat?: OutputFormat
  includeUnreleased?: boolean
  includeAIAnalysis?: boolean
  model?: AIModel
  template?: TemplateType
  interactive?: boolean
  validate?: boolean
  metrics?: boolean
}

export interface CommitAnalysis {
  totalCommits: number
  commitsByType: Record<string, number>
  commitsByAuthor: Record<string, number>
  timeRange: {
    from: string | null
    to: string | null
  }
  commits: Array<
    CommitInfo & {
      type: string
      impact: 'minimal' | 'simple' | 'standard' | 'complex' | 'architectural'
      complexity: {
        files: number
        lines: number
        breaking: boolean
      }
    }
  >
  aiAnalysis?: {
    model: AIModel
    summary: string
    recommendations: string[]
    processingTime: number
  }
}

export interface CurrentChangesAnalysis {
  staged: {
    files: string[]
    additions: number
    deletions: number
    summary: string
  }
  unstaged: {
    files: string[]
    additions: number
    deletions: number
    summary: string
  }
  untracked: {
    files: string[]
    categories: Record<string, string[]>
    recommendations: string[]
  }
  aiAnalysis?: {
    model: AIModel
    impact: string
    suggestions: string[]
    readiness: 'ready' | 'needs-work' | 'incomplete'
  }
}

export interface RepositoryHealthCheck {
  branches: BranchAnalysis
  commits: {
    total: number
    recent: CommitInfo[]
    dangling: CommitInfo[]
  }
  files: {
    tracked: number
    untracked: number
    ignored: number
  }
  recommendations: string[]
  health: 'excellent' | 'good' | 'needs-attention' | 'critical'
}

// Configuration Types
export interface ConfigManager {
  get(key: string): any
  getAll(): Record<string, any>
  isAIAvailable(): boolean
  getOptimalModelConfig(): {
    provider: AIProvider
    models: Record<string, AIModel>
    features: Partial<ModelCapabilities>
  } | null
  getModelRecommendation(commitInfo?: {
    files?: number
    lines?: number
    breaking?: boolean
    complex?: boolean
  }): {
    model: AIModel
    reason: string
    features: string[]
  } | null
  validate(): boolean
  createSampleConfig(): void
}

// MCP Server Types
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface MCPServerOptions {
  name?: string
  version?: string
  capabilities?: {
    tools?: Record<string, MCPTool>
  }
}

// Template Types
export interface TemplateData {
  title?: string
  version?: string
  date?: string
  changes?: Record<
    string,
    Array<{
      description: string
      hash?: string
      author?: string
      commitUrl?: string
      details?: string
    }>
  >
  metadata?: {
    totalCommits?: number
    dateRange?: string
    includeCommitHash?: boolean
    includeAuthor?: boolean
  }
  aiProvider?: string
  summary?: string
  breaking?: Array<{
    description: string
    migration?: string
  }>
  repository?: string
}

export interface TemplateEngine {
  render(
    template: TemplateType | ((templateData: TemplateData) => string),
    data: TemplateData
  ): string
  getAvailableTemplates(): TemplateType[]
  addCustomTemplate(name: string, template: (templateData: TemplateData) => string): void
  getCategoryName(category: string): string
}

// Main Classes
export class AIChangelogGenerator {
  constructor(constructorOptions?: {
    repositoryPath?: string
    configPath?: string
    analysisMode?: AnalysisMode
    modelOverride?: AIModel
    dryRun?: boolean
    silent?: boolean
  })

  // Core methods (these actually exist in the implementation)
  generateChangelog(version?: string | null, since?: string | null): Promise<string>

  // Analysis methods
  analyzeRepository(config?: { type?: string }): Promise<any>
  analyzeCurrentChanges(): Promise<CurrentChangesAnalysis>
  analyzeRecentCommits(limit?: number): Promise<CommitAnalysis>
  analyzeBranches(config?: any): Promise<BranchAnalysis>
  analyzeComprehensive(config?: any): Promise<RepositoryHealthCheck>

  // Repository health
  assessRepositoryHealth(includeRecommendations?: boolean): Promise<any>

  // Interactive mode
  runInteractive(): Promise<void>

  // Configuration
  setAnalysisMode(mode: AnalysisMode): void
  setModelOverride(model: AIModel): void

  // Validation
  validateConfiguration(): Promise<void>

  // Metrics
  getMetrics(): {
    startTime: number
    commitsProcessed: number
    apiCalls: number
    errors: number
  }
}

export class AIChangelogMCPServer {
  constructor(options?: MCPServerOptions)

  run(): Promise<void>

  // MCP Tools (these match the actual implementation)
  generateChangelog(params: {
    repositoryPath?: string
    source?: 'commits' | 'working-dir' | 'auto'
    analysisMode?: AnalysisMode
    since?: string
    version?: string
    includeAttribution?: boolean
    writeFile?: boolean
  }): Promise<{
    content: Array<{
      type: 'text'
      text: string
    }>
    metadata?: any
  }>

  analyzeRepository(params: {
    repositoryPath?: string
    analysisType?: 'health' | 'commits' | 'branches' | 'working-dir' | 'comprehensive'
    includeRecommendations?: boolean
    commitLimit?: number
  }): Promise<{
    content: Array<{
      type: 'text'
      text: string
    }>
  }>

  analyzeCurrentChanges(params: {
    repositoryPath?: string
    includeAIAnalysis?: boolean
    includeAttribution?: boolean
  }): Promise<{
    content: Array<{
      type: 'text'
      text: string
    }>
  }>

  configureProviders(params: {
    action?: 'list' | 'switch' | 'test' | 'configure' | 'validate'
    provider?: string
    testConnection?: boolean
  }): Promise<{
    content: Array<{
      type: 'text'
      text: string
    }>
  }>
}

// Utility Classes
export class AIProviderBase {
  constructor()

  generateCompletion(
    messages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string
    }>,
    options?: {
      temperature?: number
      max_tokens?: number
      model?: AIModel
    }
  ): Promise<AIResponse>

  selectModelForCommit(commitInfo: CommitInfo): AIModel
  getModelCapabilities(modelName: AIModel): ModelCapabilities
  validateModelAvailability(modelName: AIModel): Promise<{
    available: boolean
    model?: string
    capabilities?: ModelCapabilities
    error?: string
  }>

  testConnection(): Promise<{
    success: boolean
    response?: string
    model?: string
    error?: string
  }>
}

export class GitManager {
  constructor(repositoryPath?: string)

  getCommits(options?: {
    since?: string
    limit?: number
    includeDiff?: boolean
  }): Promise<CommitInfo[]>

  getCurrentStatus(): Promise<GitStatus>
  getBranches(): Promise<BranchAnalysis>
  getInfo(): Promise<GitInfo>
  validateRepository(): Promise<boolean>
}

export class ChangelogTemplates {
  constructor()

  render(template: TemplateType, data: TemplateData): string
  getAvailableTemplates(): TemplateType[]
  addCustomTemplate(name: string, template: (templateData: TemplateData) => string): void
  getCategoryName(category: string): string
}

// Export main entry points
export { AIChangelogGenerator as default }
