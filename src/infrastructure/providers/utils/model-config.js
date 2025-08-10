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
    entries.slice(-keepCount).forEach((entry) => warningCache.add(entry))
  }
  warningCache.add(key)
}

/**
 * Standard model configurations for each provider
 * Updated 2025 models based on Complete AI Providers & Models Integration.md
 */
export const MODEL_CONFIGS = {
  openai: {
    complexModel: 'gpt-4o',
    standardModel: 'gpt-4.1',
    mediumModel: 'gpt-4.1-mini',
    smallModel: 'gpt-4.1-nano',
    fallbacks: ['gpt-4.1', 'gpt-4o', 'o1'],
  },

  anthropic: {
    complexModel: 'claude-opus-4-20250617',
    standardModel: 'claude-sonnet-4-20250514',
    mediumModel: 'claude-3.7-sonnet-20250114',
    smallModel: 'claude-3.5-haiku-20241022',
    fallbacks: [
      'claude-sonnet-4-20250514',
      'claude-3.5-sonnet-20241022',
      'claude-3.5-haiku-20241022',
    ],
  },

  google: {
    complexModel: 'gemini-2.5-pro',
    standardModel: 'gemini-2.5-flash',
    mediumModel: 'gemini-2.0-flash',
    smallModel: 'gemini-2.0-flash-001',
    fallbacks: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  },

  vertex: {
    complexModel: 'gemini-2.5-pro',
    standardModel: 'gemini-2.5-flash',
    mediumModel: 'gemini-2.0-flash',
    smallModel: 'gemini-2.0-flash-001',
    fallbacks: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    // Vertex AI configuration
    requiresAuth: true,
    location: 'us-central1',
  },

  azure: {
    // Azure uses deployment names - should detect from actual deployments
    complexModel: 'gpt-4.1',
    standardModel: 'gpt-4.1',
    mediumModel: 'gpt-4.1',
    smallModel: 'gpt-4.1',
    fallbacks: ['gpt-4.1', 'gpt-4o', 'gpt-35-turbo'],
    // Hub-specific configuration
    isHub: true,
    detectDeployments: true,
    supportedProviders: ['openai', 'microsoft', 'meta', 'anthropic'],
    defaultProvider: 'openai',
    // Azure-specific models (available via deployments)
    hubModels: {
      openai: ['gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4'],
      microsoft: ['phi-3', 'phi-3.5'],
      meta: ['llama-3.1', 'llama-3.2'],
      anthropic: ['claude-3.5-sonnet'],
    },
  },

  bedrock: {
    // Amazon Bedrock - Multi-provider AI hub
    complexModel: 'anthropic.claude-opus-4-v1:0',
    standardModel: 'anthropic.claude-sonnet-4-v1:0',
    mediumModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    smallModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    fallbacks: [
      'anthropic.claude-sonnet-4-v1:0',
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'meta.llama3-1-70b-instruct-v1:0',
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
        'anthropic.claude-opus-4-v1:0',
        'anthropic.claude-sonnet-4-v1:0',
        'anthropic.claude-3-5-sonnet-20241022-v2:0',
        'anthropic.claude-3-5-haiku-20241022-v1:0',
      ],
      meta: [
        'meta.llama3-1-405b-instruct-v1:0',
        'meta.llama3-1-70b-instruct-v1:0',
        'meta.llama3-1-8b-instruct-v1:0',
      ],
      amazon: ['amazon.titan-text-premier-v1:0', 'amazon.titan-text-express-v1'],
      ai21: ['ai21.jamba-1-5-large-v1:0', 'ai21.jamba-1-5-mini-v1:0'],
      cohere: ['cohere.command-r-plus-v1:0', 'cohere.command-r-v1:0'],
    },
  },

  huggingface: {
    complexModel: 'meta-llama/Llama-3.1-70B-Instruct',
    standardModel: 'meta-llama/Llama-3.1-8B-Instruct',
    mediumModel: 'meta-llama/Llama-3.2-3B-Instruct',
    smallModel: 'meta-llama/Llama-3.2-1B-Instruct',
    fallbacks: [
      'meta-llama/Llama-3.1-8B-Instruct',
      'microsoft/DialoGPT-medium',
      'google/flan-t5-base',
    ],
  },

  ollama: {
    complexModel: 'llama3.1:70b',
    standardModel: 'llama3.1',
    mediumModel: 'llama3.1:8b',
    smallModel: 'llama3.2:3b',
    fallbacks: ['llama3.1', 'llama3.2', 'mistral'],
  },

  lmstudio: {
    complexModel: 'llama-3.2-1b-instruct',
    standardModel: 'llama-3.2-1b-instruct',
    mediumModel: 'llama-3.2-1b-instruct',
    smallModel: 'llama-3.2-1b-instruct',
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
 * Token limits removed as requested - left blank
 */
export const MODEL_CAPABILITIES = {
  // OpenAI Models
  'gpt-4o': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
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

  o1: {
    reasoning: true,
    tool_use: true,
    large_context: true,
    advanced_reasoning: true,
  },

  o3: {
    reasoning: true,
    advanced_reasoning: true,
    tool_use: true,
    large_context: true,
    azure_only: true,
  },

  o4: {
    reasoning: true,
    advanced_reasoning: true,
    tool_use: true,
    large_context: true,
    azure_only: true,
    next_generation: true,
  },

  // Anthropic Models
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
  },

  'claude-3': {
    vision: true,
    tool_use: true, // Only Opus and Sonnet
    json_mode: true, // Only Opus and Sonnet
  },

  // Google Models (Gemini & Vertex AI)
  'gemini-2.5': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    thinking_mode: true,
    most_capable: true,
  },

  'gemini-2.0': {
    vision: true,
    tool_use: true,
    json_mode: true,
    reasoning: true,
    large_context: true,
    multimodal: true,
    fast_processing: true,
  },

  'gemini-1.5': {
    vision: true,
    tool_use: true,
    json_mode: true,
    large_context: true,
    multimodal: true,
    deprecated: true,
  },

  // Hugging Face Models
  'llama-3.1': {
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
    lightweight: true,
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
