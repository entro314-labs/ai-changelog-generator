/**
 * Dummy Provider
 * Fallback provider when no other providers are available
 */

import { BaseProvider } from '../core/base-provider.js';
import { ProviderError } from '../../../shared/utils/utils.js';

class DummyProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'dummy';
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getName() {
    return this.name;
  }

  /**
   * Check if provider is available
   * @returns {boolean} Always true for dummy provider
   */
  isAvailable() {
    return true;
  }

  /**
   * Generate completion (always fails with informative error)
   * @param {Array} messages - Messages for completion
   * @param {Object} options - Generation options
   * @returns {Promise} - Promise that rejects with error
   */
  async generateCompletion(messages, options = {}) {
    throw new ProviderError(
      'No AI provider is available. Please configure at least one provider in your .env.local file. ' +
      'Run "node config-wizard.js" to set up your providers.',
      'dummy',
      'generateCompletion'
    );
  }

  /**
   * Get model recommendation (returns rule-based fallback)
   * @param {Object} commitInfo - Commit information
   * @returns {Object} Model recommendation
   */
  getModelRecommendation(commitInfo = {}) {
    return {
      model: 'rule-based',
      reason: 'No AI provider configured, using rule-based fallback.'
    };
  }

  /**
   * Validate model availability (always fails with informative error)
   * @param {string} model - Model name
   * @returns {Promise} - Promise that resolves with validation result
   */
  async validateModelAvailability(model) {
    return {
      available: false,
      error: 'No AI provider configured',
      alternatives: []
    };
  }

  /**
   * Test connection (always fails with informative error)
   * @returns {Promise} - Promise that resolves with connection test result
   */
  async testConnection() {
    return {
      success: false,
      error: 'No AI provider configured',
      provider: this.getName()
    };
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
      json_mode: false
    };
  }

  getAvailableModels() {
    return [
      {
        id: 'rule-based',
        name: 'Rule-based Fallback',
        contextWindow: 0,
        maxOutput: 0,
        inputCost: 0,
        outputCost: 0,
        features: [],
        description: 'No AI model available - configure a provider'
      }
    ];
  }
}

export default DummyProvider;
