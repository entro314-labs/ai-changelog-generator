/**
 * Mock Provider
 * Used for testing without real API credentials
 */

import { BaseProvider } from '../core/base-provider.js';
import { ProviderError } from '../../../shared/utils/utils.js';

class MockProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'mock';
    this.mockResponses = config.MOCK_RESPONSES || {};
    this.shouldFail = config.MOCK_SHOULD_FAIL === 'true';
    this.failureRate = parseFloat(config.MOCK_FAILURE_RATE || '0.1');
    this.latency = parseInt(config.MOCK_LATENCY || '500', 10);
    this.models = [
      'mock-basic',
      'mock-standard',
      'mock-advanced'
    ];
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
   * @returns {boolean} Always true for mock provider
   */
  isAvailable() {
    return true;
  }

  /**
   * Simulate network latency
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} - Promise that resolves after delay
   */
  async _simulateLatency() {
    return new Promise(resolve => setTimeout(resolve, this.latency));
  }

  /**
   * Determine if operation should fail based on failure rate
   * @returns {boolean} - Whether operation should fail
   */
  _shouldFailOperation() {
    if (this.shouldFail) {
      return true;
    }
    return Math.random() < this.failureRate;
  }

  /**
   * Generate completion with mock data
   * @param {Array} messages - Messages for completion
   * @param {Object} options - Generation options
   * @returns {Promise} - Promise that resolves with mock completion
   */
  async generateCompletion(messages, options = {}) {
    await this._simulateLatency();

    if (this._shouldFailOperation()) {
      throw new ProviderError(
        'Mock provider simulated failure',
        'mock_error',
        this.getName(),
        options.model || 'mock-standard'
      );
    }

    const model = options.model || 'mock-standard';
    const lastMessage = messages[messages.length - 1];
    const prompt = typeof lastMessage === 'string'
      ? lastMessage
      : (lastMessage.content || '');

    // Check for predefined responses
    if (this.mockResponses[prompt]) {
      return {
        content: this.mockResponses[prompt],
        tokens: this.mockResponses[prompt].length / 4, // Rough estimate
        model: model
      };
    }

    // Generate mock response based on commit convention if it looks like a commit message
    if (prompt.match(/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?:/)) {
      return {
        content: this._generateMockChangelog(prompt),
        tokens: 150,
        model: model
      };
    }

    // Default mock response
    return {
      content: `This is a mock response from the ${model} model.`,
      tokens: 10,
      model: model
    };
  }

  /**
   * Generate mock changelog based on commit message
   * @param {string} commitMessage - Commit message
   * @returns {string} - Mock changelog entry
   */
  _generateMockChangelog(commitMessage) {
    const typeMatch = commitMessage.match(/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?:/);

    if (!typeMatch) {
      return 'Mock changelog entry for conventional commit';
    }

    const type = typeMatch[1];
    const scope = typeMatch[2] ? typeMatch[2].replace(/[()]/g, '') : '';
    const description = commitMessage.split(':')[1]?.trim() || '';

    const typeMap = {
      feat: 'Feature',
      fix: 'Bug Fix',
      docs: 'Documentation',
      style: 'Style',
      refactor: 'Code Refactoring',
      perf: 'Performance',
      test: 'Tests',
      build: 'Build',
      ci: 'CI',
      chore: 'Chore'
    };

    const title = `${typeMap[type]}${scope ? ` (${scope})` : ''}`;
    return `### ${title}\n\n- ${description}\n`;
  }

  /**
   * Get model recommendation based on mock rules
   * @param {Object} commitInfo - Commit information
   * @returns {Object} Model recommendation
   */
  getModelRecommendation(commitInfo = {}) {
    if (!commitInfo.message) {
      return {
        model: 'mock-standard',
        reason: 'Default model selected due to insufficient commit information'
      };
    }

    // Simple logic based on commit complexity
    const filesChanged = commitInfo.files?.length || 0;
    const linesChanged = (commitInfo.additions || 0) + (commitInfo.deletions || 0);

    if (filesChanged > 10 || linesChanged > 500 || commitInfo.breaking) {
      return {
        model: 'mock-advanced',
        reason: 'Complex commit detected, using advanced model'
      };
    } else if (filesChanged > 3 || linesChanged > 100) {
      return {
        model: 'mock-standard',
        reason: 'Moderate commit detected, using standard model'
      };
    } else {
      return {
        model: 'mock-basic',
        reason: 'Simple commit detected, using basic model'
      };
    }
  }

  /**
   * Validate model availability
   * @param {string} model - Model name
   * @returns {Promise} - Promise that resolves with validation result
   */
  async validateModelAvailability(model) {
    await this._simulateLatency();

    if (this._shouldFailOperation()) {
      return {
        available: false,
        error: 'Mock validation failure',
        alternatives: this.models
      };
    }

    const isAvailable = this.models.includes(model);

    return {
      available: isAvailable,
      model: isAvailable ? model : null,
      alternatives: isAvailable ? [] : this.models
    };
  }

  /**
   * Test connection to mock provider
   * @returns {Promise} - Promise that resolves with connection test result
   */
  async testConnection() {
    await this._simulateLatency();

    if (this._shouldFailOperation()) {
      return {
        success: false,
        error: 'Mock connection failure',
        provider: this.getName()
      };
    }

    return {
      success: true,
      provider: this.getName(),
      model: 'mock-standard',
      response: 'Mock connection successful'
    };
  }

  /**
   * Get provider capabilities
   * @returns {Object} - Capabilities object
   */
  getCapabilities() {
    return {
      streaming: false,
      tool_use: true,
      vision: false,
      json_mode: true
    };
  }

  getAvailableModels() {
    return [
      {
        id: 'mock-basic',
        name: 'Mock Basic Model',
        contextWindow: 2048,
        maxOutput: 1000,
        inputCost: 0,
        outputCost: 0,
        features: ['text', 'testing'],
        description: 'Basic mock model for simple testing'
      },
      {
        id: 'mock-standard',
        name: 'Mock Standard Model',
        contextWindow: 4096,
        maxOutput: 2000,
        inputCost: 0,
        outputCost: 0,
        features: ['text', 'tools', 'testing'],
        description: 'Standard mock model for moderate testing'
      },
      {
        id: 'mock-advanced',
        name: 'Mock Advanced Model',
        contextWindow: 8192,
        maxOutput: 4000,
        inputCost: 0,
        outputCost: 0,
        features: ['text', 'tools', 'json', 'testing'],
        description: 'Advanced mock model for complex testing scenarios'
      }
    ];
  }
}

export default MockProvider;
