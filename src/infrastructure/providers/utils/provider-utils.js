/**
 * Common utility functions for AI providers
 * Consolidates duplicate logic across all provider implementations
 */

/**
 * Standard model selection algorithm based on commit details
 * @param {Object} commitDetails - Details about the commit (files, lines, breaking, complex)
 * @param {Object} modelConfig - Provider-specific model configuration
 * @returns {Object} Selected model and reason
 */
export function selectModelByComplexity(commitDetails, modelConfig) {
  const {
    complexModel = 'default-complex',
    standardModel = 'default-standard', 
    mediumModel = 'default-medium',
    smallModel = 'default-small'
  } = modelConfig;

  // Breaking or complex changes need the most capable model
  if (commitDetails.breaking || commitDetails.complex || commitDetails.files > 20) {
    return { 
      model: complexModel, 
      reason: 'Complex or breaking change requiring advanced reasoning' 
    };
  }
  
  // Large commits need standard model
  if (commitDetails.lines > 1000 || commitDetails.files > 10) {
    return { 
      model: standardModel, 
      reason: 'Large change requiring standard capabilities' 
    };
  }
  
  // Medium commits
  if (commitDetails.lines > 200 || commitDetails.files > 5) {
    return { 
      model: mediumModel, 
      reason: 'Medium-sized change' 
    };
  }
  
  // Small commits can use the most efficient model
  return { 
    model: smallModel, 
    reason: 'Small change, optimized for efficiency' 
  };
}

/**
 * Standard connection test implementation
 * @param {Function} generateCompletion - Provider's generateCompletion method
 * @param {string} defaultModel - Default model to use for testing
 * @returns {Promise<Object>} Test result with success status
 */
export async function standardConnectionTest(generateCompletion, defaultModel) {
  try {
    const response = await generateCompletion([
      { role: 'user', content: 'Test connection' }
    ], { 
      max_tokens: 5, 
      model: defaultModel,
      temperature: 0.1 
    });
    
    return { 
      success: true, 
      response: response.content || response.text || 'Connection successful', 
      model: response.model || defaultModel
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Generate standard error response for provider operations
 * @param {string} providerName - Name of the provider
 * @param {string} operation - Operation that failed
 * @param {string} reason - Reason for failure
 * @param {Array} alternatives - Alternative suggestions
 * @returns {Object} Standardized error response
 */
export function createProviderErrorResponse(providerName, operation, reason, alternatives = []) {
  return {
    available: false,
    provider: providerName,
    operation,
    error: reason,
    alternatives: alternatives.length > 0 ? alternatives : [`Check ${providerName} configuration`],
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate standard success response for provider operations
 * @param {string} providerName - Name of the provider
 * @param {Object} data - Success data
 * @returns {Object} Standardized success response
 */
export function createProviderSuccessResponse(providerName, data = {}) {
  return {
    available: true,
    provider: providerName,
    ...data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Build common model capabilities structure
 * @param {Object} baseCapabilities - Base capabilities all models have
 * @param {Object} modelSpecificCapabilities - Capabilities specific to the model
 * @returns {Object} Complete capabilities object
 */
export function buildCapabilities(baseCapabilities = {}, modelSpecificCapabilities = {}) {
  const defaultCapabilities = {
    vision: false,
    tool_use: false,
    json_mode: false,
    reasoning: false,
    large_context: false,
    streaming: false,
    temperature_control: true,
    max_tokens_control: true
  };

  return {
    ...defaultCapabilities,
    ...baseCapabilities,
    ...modelSpecificCapabilities
  };
}

/**
 * Extract provider configuration with defaults
 * @param {Object} config - Full configuration object
 * @param {string} providerPrefix - Provider prefix (e.g., 'OPENAI', 'ANTHROPIC')
 * @param {Object} defaults - Default values for missing config
 * @returns {Object} Provider-specific configuration
 */
export function extractProviderConfig(config, providerPrefix, defaults = {}) {
  const providerConfig = {};
  
  // Extract all config keys that start with the provider prefix
  Object.keys(config).forEach(key => {
    if (key.startsWith(providerPrefix + '_') || key === providerPrefix) {
      providerConfig[key] = config[key];
    }
  });
  
  // Add fallback AI_MODEL configs
  if (config.AI_MODEL && !providerConfig[providerPrefix + '_MODEL']) {
    providerConfig[providerPrefix + '_MODEL'] = config.AI_MODEL;
  }
  
  // Apply defaults for missing values
  Object.keys(defaults).forEach(key => {
    if (providerConfig[key] === undefined) {
      providerConfig[key] = defaults[key];
    }
  });
  
  return providerConfig;
}

/**
 * Parse numeric configuration values with defaults
 * @param {string|number} value - Value to parse
 * @param {number} defaultValue - Default if parsing fails
 * @returns {number} Parsed numeric value
 */
export function parseNumericConfig(value, defaultValue) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Standard model validation logic
 * @param {Function} testModelFn - Function to test if model is available
 * @param {string} modelName - Model name to validate
 * @param {Array} fallbackModels - Fallback models to suggest
 * @returns {Promise<Object>} Validation result
 */
export async function validateModelWithFallbacks(testModelFn, modelName, fallbackModels = []) {
  try {
    const result = await testModelFn(modelName);
    if (result.success || result.available) {
      return createProviderSuccessResponse('validation', {
        model: modelName,
        capabilities: result.capabilities || {}
      });
    } else {
      return createProviderErrorResponse('validation', 'model_test', result.error || 'Model not available', fallbackModels);
    }
  } catch (error) {
    return createProviderErrorResponse('validation', 'model_test', error.message, fallbackModels);
  }
}

/**
 * Common message formatting for different provider APIs
 * @param {Array} messages - OpenAI-style messages
 * @param {string} format - Target format ('openai', 'anthropic', 'google')
 * @returns {Object} Formatted messages for the specific provider
 */
export function formatMessagesForProvider(messages, format) {
  switch (format) {
    case 'anthropic':
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');
      return {
        system: systemMessage ? systemMessage.content : undefined,
        messages: userMessages
      };
      
    case 'google':
      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      const history = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
      return { systemInstruction, history };
      
    case 'openai':
    default:
      return { messages };
  }
}

/**
 * Build standard client options for providers
 * @param {Object} config - Provider configuration
 * @param {Object} defaults - Default client options
 * @returns {Object} Client initialization options
 */
export function buildClientOptions(config, defaults = {}) {
  const options = { ...defaults };
  
  // Common timeout handling
  if (config.timeout || config.TIMEOUT) {
    options.timeout = parseNumericConfig(config.timeout || config.TIMEOUT, 60000);
  }
  
  // Common retry handling
  if (config.maxRetries || config.MAX_RETRIES) {
    options.maxRetries = parseNumericConfig(config.maxRetries || config.MAX_RETRIES, 2);
  }
  
  // Common base URL handling
  if (config.baseURL || config.BASE_URL || config.API_URL) {
    options.baseURL = config.baseURL || config.BASE_URL || config.API_URL;
  }
  
  return options;
}

/**
 * Standard request parameters builder
 * @param {Array} messages - Chat messages
 * @param {Object} options - Request options
 * @param {Object} defaults - Provider-specific defaults
 * @returns {Object} Standard request parameters
 */
export function buildRequestParams(messages, options, defaults = {}) {
  return {
    messages,
    model: options.model || defaults.model,
    max_tokens: options.max_tokens || defaults.max_tokens || 1000,
    temperature: options.temperature !== undefined ? options.temperature : (defaults.temperature || 0.3),
    stream: !!options.stream,
    ...(options.tools && { tools: options.tools }),
    ...(options.tool_choice && { tool_choice: options.tool_choice }),
    ...defaults.extraParams
  };
}