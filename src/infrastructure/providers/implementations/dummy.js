/**
 * Dummy Provider
 * Fallback provider when no other providers are available
 */

import { ProviderError } from '../../../shared/utils/error-classes.js'
import { BaseProvider } from '../core/base-provider.js'
import { applyMixins } from '../utils/base-provider-helpers.js'

class DummyProvider extends BaseProvider {
  constructor(config = {}) {
    super(config)
    this.name = 'dummy'
  }

  getName() {
    return this.name
  }

  isAvailable() {
    return true
  }

  getRequiredEnvVars() {
    return []
  }

  getDefaultModel() {
    return 'rule-based'
  }

  /**
   * Generate completion (always fails with informative error)
   * @param {Array} messages - Messages for completion
   * @param {Object} options - Generation options
   * @returns {Promise} - Promise that rejects with error
   */
  async generateCompletion(_messages, _options = {}) {
    throw new ProviderError(
      'No AI provider is available. Please configure at least one provider in your .env.local file. ' +
        'Run "node config-wizard.js" to set up your providers.',
      'dummy',
      'generateCompletion'
    )
  }

  /**
   * Get model recommendation (returns rule-based fallback)
   * @param {Object} commitInfo - Commit information
   * @returns {Object} Model recommendation
   */
  getModelRecommendation(_commitInfo = {}) {
    return {
      model: 'rule-based',
      reason: 'No AI provider configured, using rule-based fallback.',
    }
  }

  /**
   * Validate model availability (always fails with informative error)
   * @param {string} model - Model name
   * @returns {Promise} - Promise that resolves with validation result
   */
  async validateModelAvailability(_model) {
    return {
      available: false,
      error: 'No AI provider configured',
      alternatives: [],
    }
  }

  /**
   * Test connection (always fails with informative error)
   * @returns {Promise} - Promise that resolves with connection test result
   */
  async testConnection() {
    return {
      success: false,
      error: 'No AI provider configured',
      provider: this.getName(),
    }
  }

  /**
   * Get provider capabilities
   * @returns {Object} - Empty capabilities object
   */
  getCapabilities() {
    return {
      streaming: false,
      tool_use: false,
      vision: false,
      json_mode: false,
    }
  }

  async getAvailableModels() {
    return [
      {
        id: 'rule-based',
        name: 'Rule-based Fallback',
        description: 'No AI model available - configure a provider',
      },
    ]
  }
}

// Apply minimal mixins (error handling only - dummy provider doesn't need full functionality)
export default applyMixins ? applyMixins(DummyProvider, 'dummy', []) : DummyProvider
