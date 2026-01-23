/**
 * Model configuration and capabilities for different AI providers
 * Consolidates model-specific logic that was duplicated across providers
 */

// Cache for warnings to prevent spam (with size limit to prevent memory leaks)
const warningCache = new Set()
const MAX_WARNING_CACHE_SIZE = 100

function addWarningToCache(key) {
  if (warningCache.size >= MAX_WARNING_CACHE_SIZE) {
    // Clear oldest entries by recreating the set
    const entries = Array.from(warningCache)
    warningCache.clear()
    // Keep last 80% of entries
    const keepCount = Math.floor(MAX_WARNING_CACHE_SIZE * 0.8)
    entries.slice(-keepCount).forEach((entry) => {
      warningCache.add(entry)
    })
  }
  warningCache.add(key)
}

/**
 * Standard model configurations for each provider
 * Updated January 2026 - Latest models and SDK conventions
 */
export const MODEL_CONFIGS = {
  openai: {
    // GPT-5.2 is the newest flagship model (December 2025)
    complexModel: 'gpt-5.2',
    standardModel: 'gpt-5.2',
    mediumModel: 'gpt-5-mini',
    smallModel: 'gpt-5-nano',
    reasoningModel: 'o4',
    codingModel: 'gpt-5.2-codex',
    fallbacks: ['gpt-5.2', 'gpt-5', 'gpt-4.1', 'gpt-4o'],
    // GPT-5.2 features
    contextWindow: 400000,
    maxOutputTokens: 128000,
  },

  anthropic: {
    // Claude 4.5 series (November 2025) - hybrid reasoning models
    complexModel: 'claude-opus-4-5-20251124',
    standardModel: 'claude-sonnet-4-5-20250929',
    mediumModel: 'claude-sonnet-4-20250514',
    smallModel: 'claude-haiku-4-5-20251001',
    reasoningModel: 'claude-opus-4-5-20251124',
    fallbacks: [
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-5-20251124',
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
    ],
    // Claude 4.5 features
    contextWindow: 200000,
    extendedContext: 1000000, // 1M tokens (beta)
    supportsEffortParameter: true, // low, medium, high
    supportsToolSearch: true, // beta: advanced-tool-use-2025-11-20
  },

  google: {
    // Gemini 3 series (November-December 2025)
    complexModel: 'gemini-3-pro',
    standardModel: 'gemini-3-flash',
    mediumModel: 'gemini-2.5-flash',
    smallModel: 'gemini-2.5-flash',
    reasoningModel: 'gemini-3-pro',
    fallbacks: ['gemini-3-flash', 'gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    // Gemini 3 features
    contextWindow: 1000000, // 1M tokens
    supportsThinkingLevel: true, // thinking_level parameter
    supportsThoughtSignatures: true, // encrypted reasoning chain
  },

  vertex: {
    // Gemini 3 on Vertex AI
    complexModel: 'gemini-3-pro',
    standardModel: 'gemini-3-flash',
    mediumModel: 'gemini-2.5-flash',
    smallModel: 'gemini-2.5-flash',
    reasoningModel: 'gemini-3-pro',
    fallbacks: ['gemini-3-flash', 'gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    // Vertex AI configuration
    requiresAuth: true,
    location: 'us-central1',
    contextWindow: 1000000,
    supportsThinkingLevel: true,
    supportsThoughtSignatures: true,
  },

  azure: {
    // Azure AI Foundry - v1 API (no api-version required)
    complexModel: 'gpt-5.2',
    standardModel: 'gpt-5',
    mediumModel: 'gpt-5-mini',
    smallModel: 'gpt-5-nano',
    reasoningModel: 'o4',
    codingModel: 'gpt-5.2-codex',
    fallbacks: ['gpt-5.2', 'gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-35-turbo'],
    // Hub-specific configuration
    isHub: true,
    detectDeployments: true,
    supportedProviders: ['openai', 'microsoft', 'meta', 'anthropic'],
    defaultProvider: 'openai',
    // v1 API (August 2025+) - no api-version required
    useV1Api: true,
    // Azure-specific models (available via deployments)
    hubModels: {
      openai: [
        'gpt-5.2',
        'gpt-5.2-codex',
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
        'gpt-5-chat',
        'gpt-4.1',
        'gpt-4.1-nano',
        'gpt-4o',
        'o4',
        'o4-mini',
        'o3',
        'gpt-image-1.5',
      ],
      microsoft: ['phi-3', 'phi-3.5', 'phi-4'],
      meta: ['llama-3.1', 'llama-3.2', 'llama-3.3', 'llama-4'],
      anthropic: ['claude-3.5-sonnet', 'claude-sonnet-4'],
      openWeight: ['gpt-oss-120b', 'gpt-oss-20b'], // OpenAI's open-weight models
    },
  },

  bedrock: {
    // Amazon Bedrock - Claude 4.5 models (September-November 2025)
    complexModel: 'anthropic.claude-opus-4-5-v1:0',
    standardModel: 'anthropic.claude-sonnet-4-5-v1:0',
    mediumModel: 'anthropic.claude-sonnet-4-v1:0',
    smallModel: 'anthropic.claude-haiku-4-5-v1:0',
    reasoningModel: 'anthropic.claude-opus-4-5-v1:0',
    fallbacks: [
      'anthropic.claude-sonnet-4-5-v1:0',
      'anthropic.claude-opus-4-5-v1:0',
      'anthropic.claude-sonnet-4-v1:0',
      'meta.llama4-scout-v1:0',
    ],
    // Hub-specific configuration
    isHub: true,
    detectModels: true,
    supportedProviders: ['anthropic', 'meta', 'amazon', 'ai21', 'cohere', 'stability'],
    defaultProvider: 'anthropic',
    region: 'us-east-1',
    // Bedrock model mappings by provider
    hubModels: {
      anthropic: [
        'anthropic.claude-opus-4-5-v1:0',
        'anthropic.claude-sonnet-4-5-v1:0',
        'anthropic.claude-haiku-4-5-v1:0',
        'anthropic.claude-opus-4-v1:0',
        'anthropic.claude-sonnet-4-v1:0',
        'anthropic.claude-3-5-sonnet-20241022-v2:0',
        'anthropic.claude-3-5-haiku-20241022-v1:0',
      ],
      meta: [
        'meta.llama4-scout-v1:0',
        'meta.llama4-maverick-v1:0',
        'meta.llama3-3-70b-instruct-v1:0',
        'meta.llama3-2-90b-instruct-v1:0',
        'meta.llama3-1-405b-instruct-v1:0',
        'meta.llama3-1-70b-instruct-v1:0',
      ],
      amazon: ['amazon.titan-text-premier-v1:0', 'amazon.titan-text-express-v1'],
      ai21: ['ai21.jamba-1-5-large-v1:0', 'ai21.jamba-1-5-mini-v1:0'],
      cohere: ['cohere.command-r-plus-v1:0', 'cohere.command-r-v1:0'],
    },
    // Extended context for Claude 4.5 (1M tokens in preview)
    extendedContext: 1000000,
  },

  huggingface: {
    // Latest Llama and open models
    complexModel: 'meta-llama/Llama-4-Scout',
    standardModel: 'meta-llama/Llama-3.3-70B-Instruct',
    mediumModel: 'meta-llama/Llama-3.2-11B-Vision-Instruct',
    smallModel: 'meta-llama/Llama-3.2-3B-Instruct',
    reasoningModel: 'Qwen/Qwen3-235B-A22B',
    fallbacks: [
      'meta-llama/Llama-3.3-70B-Instruct',
      'meta-llama/Llama-3.1-70B-Instruct',
      'Qwen/Qwen3-30B-A3B',
      'microsoft/DialoGPT-medium',
    ],
  },

  ollama: {
    // Latest local models (January 2026)
    complexModel: 'qwen3:235b',
    standardModel: 'llama4:scout',
    mediumModel: 'llama3.3:70b',
    smallModel: 'llama3.2:3b',
    reasoningModel: 'deepseek-r1:32b',
    codingModel: 'qwen2.5-coder:32b',
    fallbacks: ['llama4:scout', 'llama3.3', 'qwen3', 'deepseek-r1', 'mistral'],
    // Thinking mode support
    supportsThinkingMode: true,
  },

  lmstudio: {
    complexModel: 'llama-4-scout',
    standardModel: 'llama-3.3-70b-instruct',
    mediumModel: 'llama-3.2-11b-vision-instruct',
    smallModel: 'llama-3.2-3b-instruct',
    fallbacks: ['local-model'],
  },
}

/**
 * Get model configuration for a provider with config overrides
 * @param {string} providerName - Name of the provider
 * @param {Object} config - Configuration object with potential overrides
 * @returns {Object} Model configuration with overrides applied
 */
export function getProviderModelConfig(providerName, config = {}, availableModels = []) {
  const baseConfig = MODEL_CONFIGS[providerName] || MODEL_CONFIGS.openai

  const modelConfig = {
    complexModel:
      config.AI_MODEL_COMPLEX ||
      config[`${providerName.toUpperCase()}_MODEL_COMPLEX`] ||
      baseConfig.complexModel,
    standardModel:
      config.AI_MODEL || config[`${providerName.toUpperCase()}_MODEL`] || baseConfig.standardModel,
    mediumModel:
      config.AI_MODEL_SIMPLE ||
      config[`${providerName.toUpperCase()}_MODEL_SIMPLE`] ||
      baseConfig.mediumModel,
    smallModel:
      config.AI_MODEL_NANO ||
      config[`${providerName.toUpperCase()}_MODEL_NANO`] ||
      baseConfig.smallModel,
    fallbacks: baseConfig.fallbacks,
  }

  // For hub providers, validate models against available deployments
  if (baseConfig.isHub) {
    if (availableModels.length > 0) {
      // Use actual deployed models
      const validateModel = (model) => {
        if (availableModels.includes(model)) {
          return model
        }

        // Try fallbacks in order
        for (const fallback of baseConfig.fallbacks) {
          if (availableModels.includes(fallback)) {
            return fallback
          }
        }

        // Try common deployments for Azure
        if (providerName === 'azure' && baseConfig.commonDeployments) {
          for (const common of baseConfig.commonDeployments) {
            if (availableModels.includes(common)) {
              return common
            }
          }
        }

        return availableModels[0] || model // Use first available or original
      }

      modelConfig.complexModel = validateModel(modelConfig.complexModel)
      modelConfig.standardModel = validateModel(modelConfig.standardModel)
      modelConfig.mediumModel = validateModel(modelConfig.mediumModel)
      modelConfig.smallModel = validateModel(modelConfig.smallModel)

      // Update fallbacks to only include available models
      modelConfig.fallbacks = baseConfig.fallbacks.filter((model) =>
        availableModels.includes(model)
      )

      modelConfig.availableModels = availableModels
    } else {
      // No deployment info available - use safer defaults for Azure
      if (providerName === 'azure') {
        const warningKey = 'azure-no-deployment-info'
        if (!warningCache.has(warningKey)) {
          console.log('ℹ️  Using default Azure deployment names (deployment detection runs async)')
          addWarningToCache(warningKey)
        }
        modelConfig.complexModel = 'gpt-4.1'
        modelConfig.standardModel = 'gpt-4.1'
        modelConfig.mediumModel = 'gpt-4.1'
        modelConfig.smallModel = 'gpt-4.1'
        modelConfig.availableModels = baseConfig.commonDeployments || []
      }
    }

    // Add hub-specific info
    modelConfig.isHub = true
    modelConfig.hubInfo = {
      supportedProviders: baseConfig.supportedProviders,
      defaultProvider: baseConfig.defaultProvider,
      hubModels: baseConfig.hubModels,
      commonDeployments: baseConfig.commonDeployments,
    }
  }

  return modelConfig
}

/**
 * Model capabilities database
 * Defines what each model family supports
 * Updated January 2026
 */
export const MODEL_CAPABILITIES = {
  // OpenAI Models - GPT-5.x series (2025-2026)
  'gpt-5.2': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    coding_optimized: true,
    context_window: 400000,
    max_output: 128000,
    flagship: true,
  },

  'gpt-5.2-codex': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    coding_optimized: true,
    agentic_coding: true,
    context_compaction: true,
    cybersecurity: true,
  },

  'gpt-5': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    context_window: 272000,
  },

  'gpt-4o': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    previous_generation: true,
  },

  'gpt-4.1': {
    prompt_caching: true,
    tool_use: true,
    json_mode: true,
    vision: true,
    large_context: true,
    coding_optimized: true,
    cost_reduction: 0.75, // 75% cost reduction with caching
  },

  o4: {
    reasoning: true,
    advanced_reasoning: true,
    tool_use: true,
    large_context: true,
    next_generation: true,
  },

  'o4-mini': {
    reasoning: true,
    advanced_reasoning: true,
    tool_use: true,
    large_context: true,
    cost_effective: true,
  },

  o3: {
    reasoning: true,
    advanced_reasoning: true,
    tool_use: true,
    large_context: true,
  },

  o1: {
    reasoning: true,
    tool_use: true,
    large_context: true,
    advanced_reasoning: true,
    previous_generation: true,
  },

  // Anthropic Models - Claude 4.5 series (November 2025)
  'claude-opus-4-5': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    hybrid_reasoning: true,
    extended_thinking: true,
    coding_optimized: true,
    parallel_tool_use: true,
    effort_parameter: true, // low, medium, high
    tool_search: true, // advanced-tool-use-2025-11-20
    most_capable: true,
    context_window: 200000,
    extended_context: 1000000, // beta
  },

  'claude-sonnet-4-5': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    hybrid_reasoning: true,
    extended_thinking: true,
    coding_optimized: true,
    agentic_coding: true,
    computer_use: true,
    context_window: 200000,
    extended_context: 1000000, // beta
  },

  'claude-haiku-4-5': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    hybrid_reasoning: true,
    extended_thinking: true,
    fast_processing: true,
    cost_effective: true,
    context_window: 200000,
  },

  'claude-sonnet-4': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    balanced_performance: true,
    coding_optimized: true,
  },

  'claude-opus-4': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    hybrid_reasoning: true,
    extended_thinking: true,
    coding_optimized: true,
    parallel_tool_use: true,
    most_capable: true,
  },

  'claude-3.7': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    previous_generation: true,
  },

  'claude-3.5': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    previous_generation: true,
  },

  'claude-3': {
    vision: true,
    tool_use: true, // Only Opus and Sonnet
    json_mode: true, // Only Opus and Sonnet
    deprecated: true,
  },

  // Google Models - Gemini 3 series (November-December 2025)
  'gemini-3-pro': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    thinking_level: true, // thinking_level parameter
    thought_signatures: true, // encrypted reasoning chain
    agentic_workflows: true,
    autonomous_coding: true,
    context_window: 1000000,
    most_capable: true,
  },

  'gemini-3-flash': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    thinking_level: true,
    thought_signatures: true,
    fast_processing: true,
    pro_level_intelligence: true,
    context_window: 1000000,
  },

  'gemini-2.5-pro': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    thinking_mode: true,
    context_window: 2097152,
    previous_generation: true,
  },

  'gemini-2.5': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    thinking_mode: true,
    previous_generation: true,
  },

  'gemini-2.0': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    fast_processing: true,
    previous_generation: true,
  },

  'gemini-1.5': {
    vision: true,
    tool_use: true,
    json_mode: true,
    large_context: true,
    multimodal: true,
    deprecated: true,
  },

  // Open-source/Local Models - Llama 4, Qwen 3, DeepSeek
  'llama-4': {
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    open_source: true,
    community_license: true,
  },

  'llama-3.3': {
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    open_source: true,
  },

  'llama-3.2': {
    tool_use: true,
    json_mode: true,
    reasoning: true,
    open_source: true,
    multimodal: true, // 90B has vision
    lightweight: true,
  },

  'llama-3.1': {
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    open_source: true,
    previous_generation: true,
  },

  qwen3: {
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true, // qwen3-vl
    thinking_mode: true,
    open_source: true,
    context_window: 32768,
    extended_context: 131072, // with YaRN
  },

  'qwen2.5-coder': {
    tool_use: true,
    json_mode: true,
    reasoning: true,
    coding_optimized: true,
    open_source: true,
  },

  'deepseek-r1': {
    reasoning: true,
    advanced_reasoning: true,
    thinking_mode: true,
    json_mode: true,
    open_source: true,
    cost_effective: true,
  },

  // Amazon Bedrock Models
  'anthropic.claude': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    bedrock_hosted: true,
  },

  'meta.llama4': {
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    open_source: true,
    bedrock_hosted: true,
  },

  'meta.llama': {
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    open_source: true,
    bedrock_hosted: true,
  },

  'amazon.titan': {
    tool_use: false,
    json_mode: true,
    reasoning: false,
    large_context: true,
    bedrock_hosted: true,
    aws_native: true,
  },

  // Local Models (Ollama/LM Studio)
  'local-model': {
    tool_use: false,
    json_mode: false,
    reasoning: false,
    large_context: false,
    offline: true,
    privacy_focused: true,
  },
}

/**
 * Get capabilities for a specific model
 * @param {string} modelName - Full model name
 * @returns {Object} Model capabilities
 */
export function getModelCapabilities(modelName) {
  if (!modelName) {
    return {}
  }

  // Find the closest match in our capabilities database
  for (const [pattern, capabilities] of Object.entries(MODEL_CAPABILITIES)) {
    if (modelName.includes(pattern)) {
      const baseCapabilities = {
        vision: false,
        tool_use: false,
        json_mode: false,
        reasoning: false,
        large_context: false,
        streaming: true,
        temperature_control: true,
        max_tokens_control: true,
      }

      return { ...baseCapabilities, ...capabilities }
    }
  }

  // Return basic capabilities for unknown models
  return {
    vision: false,
    tool_use: false,
    json_mode: false,
    reasoning: false,
    large_context: false,
    streaming: true,
    temperature_control: true,
    max_tokens_control: true,
  }
}

/**
 * Get suggested alternative models for a provider
 * @param {string} providerName - Provider name
 * @param {string} unavailableModel - Model that's not available
 * @returns {Array<string>} Suggested alternative models
 */
export function getSuggestedModels(providerName, unavailableModel) {
  const config = MODEL_CONFIGS[providerName]
  if (!config) {
    return []
  }

  // Return fallbacks, but exclude the unavailable model
  return config.fallbacks.filter((model) => model !== unavailableModel)
}

/**
 * Check if a model supports a specific capability
 * @param {string} modelName - Model name to check
 * @param {string} capability - Capability to check for
 * @returns {boolean} Whether the model supports the capability
 */
export function modelSupports(modelName, capability) {
  const capabilities = getModelCapabilities(modelName)
  return !!capabilities[capability]
}

/**
 * Get the best model for a specific use case
 * @param {string} providerName - Provider name
 * @param {Array<string>} requiredCapabilities - Required capabilities
 * @param {Object} config - Configuration with model overrides
 * @returns {string} Best model name for the use case
 */
export function getBestModelForCapabilities(providerName, requiredCapabilities = [], config = {}) {
  const modelConfig = getProviderModelConfig(providerName, config)
  const modelsToCheck = [
    modelConfig.complexModel,
    modelConfig.standardModel,
    modelConfig.mediumModel,
    modelConfig.smallModel,
  ]

  // Find the first model that supports all required capabilities
  for (const model of modelsToCheck) {
    const capabilities = getModelCapabilities(model)
    const supportsAll = requiredCapabilities.every((capability) => capabilities[capability])

    if (supportsAll) {
      return model
    }
  }

  // If no model supports all capabilities, return the most capable one
  return modelConfig.complexModel
}

/**
 * Get all hub providers and their status
 * @returns {Array<Object>} Hub provider information
 */
export function getAllHubProviders() {
  return Object.entries(MODEL_CONFIGS)
    .filter(([_name, config]) => config.isHub)
    .map(([name, config]) => ({
      name,
      defaultProvider: config.defaultProvider,
      supportedProviders: config.supportedProviders || [],
      modelCount: config.hubModels ? Object.values(config.hubModels).flat().length : 0,
      region: config.region,
      location: config.location,
      detectDeployments: config.detectDeployments,
      detectModels: config.detectModels,
    }))
}

/**
 * Analyze commit complexity and recommend model tier
 * @param {Object} commitInfo - Commit analysis information
 * @param {string} providerName - Provider name
 * @returns {Object} Model recommendation with reasoning
 */
export function analyzeCommitComplexity(commitInfo, providerName) {
  const { files = [], additions = 0, deletions = 0, complex = false } = commitInfo
  const totalChanges = additions + deletions
  const fileCount = files.length

  let complexity = 'simple'
  const reasoning = []

  // Analyze complexity factors
  if (complex) {
    complexity = 'complex'
    reasoning.push('Commit marked as complex')
  } else if (fileCount > 20) {
    complexity = 'complex'
    reasoning.push(`High file count: ${fileCount} files`)
  } else if (totalChanges > 1000) {
    complexity = 'complex'
    reasoning.push(`Large change set: ${totalChanges} lines`)
  } else if (fileCount > 10 || totalChanges > 500) {
    complexity = 'medium'
    reasoning.push(`Moderate changes: ${fileCount} files, ${totalChanges} lines`)
  } else if (totalChanges > 100) {
    complexity = 'standard'
    reasoning.push(`Standard changes: ${totalChanges} lines`)
  } else {
    complexity = 'simple'
    reasoning.push(`Simple changes: ${totalChanges} lines in ${fileCount} files`)
  }

  const modelConfig = MODEL_CONFIGS[providerName]
  const modelTiers = {
    simple: modelConfig?.smallModel,
    standard: modelConfig?.standardModel,
    medium: modelConfig?.mediumModel,
    complex: modelConfig?.complexModel,
  }

  return {
    complexity,
    recommendedModel: modelTiers[complexity] || modelConfig?.standardModel,
    reasoning: reasoning.join(', '),
    metrics: {
      fileCount,
      totalChanges,
      additions,
      deletions,
      isComplex: complex,
    },
  }
}

/**
 * Provider-specific model name normalization
 * @param {string} providerName - Provider name
 * @param {string} modelName - Raw model name
 * @returns {string} Normalized model name
 */
export function normalizeModelName(providerName, modelName) {
  if (!modelName) {
    return null
  }

  switch (providerName) {
    case 'azure':
      // Azure uses deployment names, so return as-is
      return modelName

    case 'ollama':
      // Ollama models often have version tags
      return modelName.includes(':') ? modelName : `${modelName}:latest`

    case 'anthropic':
      // Anthropic models need full version strings
      if (modelName.includes('claude') && !modelName.includes('-')) {
        return `${modelName}-20250514` // Add default date if missing
      }
      return modelName

    default:
      return modelName
  }
}
