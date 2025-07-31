/**
 * TypeScript definitions for AI Changelog Generator
 * Updated for GPT-4.1 series and o3/o4 reasoning models
 */

// Core Git Types
export interface CommitInfo {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  files?: string[];
  additions?: number;
  deletions?: number;
  type?: string;
  scope?: string;
  subject?: string;
  body?: string;
  footer?: string;
  breaking?: boolean;
}

export interface GitInfo {
  repository: {
    name: string;
    owner: string;
    url: string;
    remoteUrl: string;
  };
  currentBranch: string;
  totalCommits: number;
  contributors: number;
  lastCommit: {
    hash: string;
    date: string;
    author: string;
  };
  stats: {
    branches: number;
    tags: number;
    stashes: number;
  };
}

export interface GitStatus {
  staged: string[];
  unstaged: string[];
  untracked: string[];
  conflicts: string[];
  ahead: number;
  behind: number;
}

export interface BranchAnalysis {
  branches: Array<{
    name: string;
    current: boolean;
    lastCommit: {
      hash: string;
      date: string;
      author: string;
      message: string;
    };
    ahead: number;
    behind: number;
    unmergedCommits: CommitInfo[];
  }>;
  danglingCommits: CommitInfo[];
  recommendations: string[];
}

// AI Provider Types
export type AIProvider = 'openai' | 'azure' | 'auto';
export type AIModel = 
  | 'gpt-4.1' | 'gpt-4.1-mini' | 'gpt-4.1-nano'
  | 'gpt-4o' | 'gpt-4o-mini'
  | 'gpt-4' | 'gpt-3.5-turbo'
  | 'o4' | 'o4-mini'  // Latest reasoning models
  | 'o3' | 'o3-mini'; // Previous generation reasoning models

export interface ModelCapabilities {
  reasoning: boolean;
  largeContext: boolean;
  mediumContext: boolean;
  standardContext: boolean;
  promptCaching: boolean;
  textGeneration: boolean;
  tools: boolean;
  parallelToolCalling: boolean;
  reasoningSummary: boolean;
  latestReasoning: boolean;
  ultraEfficient: boolean;
  costEfficient: boolean;
  codingOptimized: boolean;
}

export interface AIProviderConfig {
  provider: AIProvider;
  openaiKey?: string;
  azureConfig?: {
    endpoint: string;
    key: string;
    deploymentName: string;
    apiVersion: string;
    useV1API?: boolean;
  };
  modelConfig: {
    default: AIModel;
    simple: AIModel;
    complex: AIModel;
    reasoning: AIModel;
    advanced_reasoning: AIModel;
    reasoning_legacy: AIModel;
    advanced_reasoning_legacy: AIModel;
    nano: AIModel;
  };
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

// Analysis Types
export type AnalysisMode = 'standard' | 'detailed' | 'enterprise';
export type OutputFormat = 'markdown' | 'json';
export type TemplateType = 'standard' | 'keep-a-changelog' | 'simple' | 'semantic' | 'github';

export interface ChangelogOptions {
  repositoryPath?: string;
  since?: string;
  version?: string;
  analysisMode?: AnalysisMode;
  outputFormat?: OutputFormat;
  includeUnreleased?: boolean;
  includeAIAnalysis?: boolean;
  model?: AIModel;
  template?: TemplateType;
  interactive?: boolean;
  validate?: boolean;
  metrics?: boolean;
}

export interface CommitAnalysis {
  totalCommits: number;
  commitsByType: Record<string, number>;
  commitsByAuthor: Record<string, number>;
  timeRange: {
    from: string | null;
    to: string | null;
  };
  commits: Array<CommitInfo & { 
    type: string;
    impact: 'minimal' | 'simple' | 'standard' | 'complex' | 'architectural';
    complexity: {
      files: number;
      lines: number;
      breaking: boolean;
    };
  }>;
  aiAnalysis?: {
    model: AIModel;
    summary: string;
    recommendations: string[];
    processingTime: number;
  };
}

export interface CurrentChangesAnalysis {
  staged: {
    files: string[];
    additions: number;
    deletions: number;
    summary: string;
  };
  unstaged: {
    files: string[];
    additions: number;
    deletions: number;
    summary: string;
  };
  untracked: {
    files: string[];
    categories: Record<string, string[]>;
    recommendations: string[];
  };
  aiAnalysis?: {
    model: AIModel;
    impact: string;
    suggestions: string[];
    readiness: 'ready' | 'needs-work' | 'incomplete';
  };
}

export interface RepositoryHealthCheck {
  branches: BranchAnalysis;
  commits: {
    total: number;
    recent: CommitInfo[];
    dangling: CommitInfo[];
  };
  files: {
    tracked: number;
    untracked: number;
    ignored: number;
  };
  recommendations: string[];
  health: 'excellent' | 'good' | 'needs-attention' | 'critical';
}

// Configuration Types
export interface ConfigManager {
  get(key: string): any;
  getAll(): Record<string, any>;
  isAIAvailable(): boolean;
  getOptimalModelConfig(): {
    provider: AIProvider;
    models: Record<string, AIModel>;
    features: Partial<ModelCapabilities>;
  } | null;
  getModelRecommendation(commitInfo?: {
    files?: number;
    lines?: number;
    breaking?: boolean;
    complex?: boolean;
  }): {
    model: AIModel;
    reason: string;
    features: string[];
  } | null;
  validate(): boolean;
  createSampleConfig(): void;
}

// MCP Server Types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPServerOptions {
  name?: string;
  version?: string;
  capabilities?: {
    tools?: Record<string, MCPTool>;
  };
}

// Template Types
export interface TemplateData {
  title?: string;
  version?: string;
  date?: string;
  changes?: Record<string, Array<{
    description: string;
    hash?: string;
    author?: string;
    commitUrl?: string;
    details?: string;
  }>>;
  metadata?: {
    totalCommits?: number;
    dateRange?: string;
    includeCommitHash?: boolean;
    includeAuthor?: boolean;
  };
  aiProvider?: string;
  summary?: string;
  breaking?: Array<{
    description: string;
    migration?: string;
  }>;
  repository?: string;
}

export interface TemplateEngine {
  render(template: TemplateType | ((data: TemplateData) => string), data: TemplateData): string;
  getAvailableTemplates(): TemplateType[];
  addCustomTemplate(name: string, template: (data: TemplateData) => string): void;
  getCategoryName(category: string): string;
}

// Main Classes
export class AIChangelogGenerator {
  constructor(options?: {
    repositoryPath?: string;
    configPath?: string;
  });
  
  // Core methods
  run(): Promise<void>;
  generateChangelog(options?: ChangelogOptions): Promise<string>;
  analyzeCommits(options?: { 
    since?: string; 
    limit?: number;
    repositoryPath?: string;
  }): Promise<CommitAnalysis>;
  
  // Enhanced analysis methods
  analyzeCurrentChanges(options?: {
    includeAIAnalysis?: boolean;
    repositoryPath?: string;
  }): Promise<CurrentChangesAnalysis>;
  
  analyzeBranches(options?: {
    includeAllBranches?: boolean;
    repositoryPath?: string;
  }): Promise<BranchAnalysis>;
  
  analyzeRepository(options?: {
    repositoryPath?: string;
  }): Promise<RepositoryHealthCheck>;
  
  // Configuration and validation
  validateConfig(): Promise<{
    success: boolean;
    provider?: AIProvider;
    model?: AIModel;
    capabilities?: ModelCapabilities;
    error?: string;
  }>;
  
  validateModels(): Promise<{
    success: boolean;
    models?: Array<{
      name: AIModel;
      available: boolean;
      capabilities?: ModelCapabilities;
    }>;
    error?: string;
  }>;
  
  // Git operations
  getGitInfo(options?: {
    includeStats?: boolean;
    repositoryPath?: string;
  }): Promise<GitInfo>;
}

export class AIChangelogMCPServer {
  constructor(options?: MCPServerOptions);
  
  run(): Promise<void>;
  
  // MCP Tools
  generateChangelog(params: {
    repositoryPath?: string;
    analysisMode?: AnalysisMode;
    outputFormat?: OutputFormat;
    since?: string;
    version?: string;
    includeUnreleased?: boolean;
    model?: AIModel;
  }): Promise<string>;
  
  analyzeCommits(params: {
    repositoryPath?: string;
    limit?: number;
    since?: string;
  }): Promise<CommitAnalysis>;
  
  analyzeCurrentChanges(params: {
    repositoryPath?: string;
    includeAIAnalysis?: boolean;
  }): Promise<CurrentChangesAnalysis>;
  
  getGitInfo(params: {
    repositoryPath?: string;
    includeStats?: boolean;
  }): Promise<GitInfo>;
  
  configureAIProvider(params: {
    provider?: AIProvider;
    showModels?: boolean;
    testConnection?: boolean;
  }): Promise<{
    success: boolean;
    provider?: AIProvider;
    models?: AIModel[];
    error?: string;
  }>;
  
  validateModels(params: {
    provider?: AIProvider;
    checkCapabilities?: boolean;
    testModels?: boolean;
  }): Promise<{
    success: boolean;
    models?: Array<{
      name: AIModel;
      available: boolean;
      capabilities?: ModelCapabilities;
    }>;
    error?: string;
  }>;
}

// Utility Classes
export class AIProvider {
  constructor();
  
  generateCompletion(messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>, options?: {
    temperature?: number;
    max_tokens?: number;
    model?: AIModel;
  }): Promise<AIResponse>;
  
  selectModelForCommit(commitInfo: CommitInfo): AIModel;
  getModelCapabilities(modelName: AIModel): ModelCapabilities;
  validateModelAvailability(modelName: AIModel): Promise<{
    available: boolean;
    model?: string;
    capabilities?: ModelCapabilities;
    error?: string;
  }>;
  
  testConnection(): Promise<{
    success: boolean;
    response?: string;
    model?: string;
    error?: string;
  }>;
}

export class GitManager {
  constructor(repositoryPath?: string);
  
  getCommits(options?: {
    since?: string;
    limit?: number;
    includeDiff?: boolean;
  }): Promise<CommitInfo[]>;
  
  getCurrentStatus(): Promise<GitStatus>;
  getBranches(): Promise<BranchAnalysis>;
  getInfo(): Promise<GitInfo>;
  validateRepository(): Promise<boolean>;
}

export class ChangelogTemplates {
  constructor();
  
  render(template: TemplateType, data: TemplateData): string;
  getAvailableTemplates(): TemplateType[];
  addCustomTemplate(name: string, template: (data: TemplateData) => string): void;
  getCategoryName(category: string): string;
}

// Export main entry points
export { AIChangelogGenerator as default };