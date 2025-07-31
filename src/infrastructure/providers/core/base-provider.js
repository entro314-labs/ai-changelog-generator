/**
 * Abstract Base Provider for AI models.
 * Defines the interface that all provider plugins must implement.
 */
import { AbstractMethodError } from '../../../shared/utils/consolidated-utils.js';

export class BaseProvider {
  constructor(config) {
    if (this.constructor === BaseProvider) {
      throw new AbstractMethodError("Abstract classes can't be instantiated", 'BaseProvider', 'constructor');
    }
    this.config = config;
    this.modelConfig = null;
    this.capabilities = {};
  }

  /**
   * Returns the name of the provider.
   * @returns {string} The provider's name (e.g., 'openai', 'azure').
   */
  getName() {
    throw new AbstractMethodError('Method "getName()" must be implemented', this.constructor.name, 'getName');
  }

  /**
   * Checks if the provider is available and configured correctly.
   * @returns {boolean} True if the provider is available, false otherwise.
   */
  isAvailable() {
    throw new AbstractMethodError('Method "isAvailable()" must be implemented', this.constructor.name, 'isAvailable');
  }

  /**
   * Generates a completion from the AI model.
   * @param {Array<object>} messages - The array of messages for the conversation.
   * @param {object} options - Additional options for the completion (e.g., max_tokens).
   * @returns {Promise<object>} The AI's response.
   */
  async generateCompletion(messages, options = {}) {
    throw new AbstractMethodError('Method "generateCompletion()" must be implemented', this.constructor.name, 'generateCompletion');
  }

  /**
   * Alternative method name for compatibility
   * @param {Array<object>} messages - The array of messages for the conversation.
   * @param {string} model - The model to use.
   * @returns {Promise<object>} The AI's response.
   */
  async generateText(messages, model = null) {
    return this.generateCompletion(messages, { model });
  }

  /**
   * Recommends a model based on the commit details.
   * @param {object} commitDetails - Details about the commit (e.g., files changed, lines changed).
   * @returns {object} The recommended model and reason.
   */
  getModelRecommendation(commitDetails) {
    throw new AbstractMethodError('Method "getModelRecommendation()" must be implemented', this.constructor.name, 'getModelRecommendation');
  }

  /**
   * Selects optimal model based on analysis
   * @param {object} commitInfo - Commit analysis information
   * @returns {Promise<object>} Optimal model selection
   */
  async selectOptimalModel(commitInfo) {
    try {
      return this.getModelRecommendation(commitInfo);
    } catch (error) {
      return { model: this.getDefaultModel(), reason: 'fallback' };
    }
  }

  /**
   * Validates if a specific model is available for the provider.
   * @param {string} modelName - The name of the model to validate.
   * @returns {Promise<object>} An object indicating availability and capabilities.
   */
  async validateModelAvailability(modelName) {
    throw new AbstractMethodError('Method "validateModelAvailability()" must be implemented', this.constructor.name, 'validateModelAvailability');
  }

  /**
   * Tests the connection to the provider's API.
   * @returns {Promise<object>} An object indicating success or failure.
   */
  async testConnection() {
    throw new AbstractMethodError('Method "testConnection()" must be implemented', this.constructor.name, 'testConnection');
  }

  /**
   * Gets the capabilities of the provider or a specific model.
   * @param {string} [modelName] - Optional model name to get specific capabilities.
   * @returns {object} An object listing the provider's capabilities.
   */
  getCapabilities(modelName) {
    throw new AbstractMethodError('Method "getCapabilities()" must be implemented', this.constructor.name, 'getCapabilities');
  }

  /**
   * Gets available models for this provider
   * @returns {Promise<Array>} List of available models
   */
  async getAvailableModels() {
    throw new AbstractMethodError('Method "getAvailableModels()" must be implemented', this.constructor.name, 'getAvailableModels');
  }

  /**
   * Gets the default model for this provider
   * @returns {string} Default model name
   */
  getDefaultModel() {
    throw new AbstractMethodError('Method "getDefaultModel()" must be implemented', this.constructor.name, 'getDefaultModel');
  }

  /**
   * Gets provider configuration
   * @returns {object} Provider configuration
   */
  getConfiguration() {
    return this.config || {};
  }

  /**
   * Gets required environment variables for this provider
   * @returns {Array<string>} List of required env vars
   */
  getRequiredEnvVars() {
    throw new AbstractMethodError('Method "getRequiredEnvVars()" must be implemented', this.constructor.name, 'getRequiredEnvVars');
  }

  /**
   * Gets provider information for display purposes.
   * @returns {string} Provider information string.
   */
  getProviderInfo() {
    return `${this.getName()} provider`;
  }

  /**
   * Test a specific model
   * @param {string} modelName - Model to test
   * @returns {Promise<object>} Test result
   */
  async testModel(modelName) {
    try {
      const startTime = Date.now();
      await this.generateCompletion([
        { role: 'user', content: 'Test message' }
      ], { model: modelName, max_tokens: 5 });
      const responseTime = Date.now() - startTime;
      return { success: true, responseTime };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Gets provider-specific configuration for the model config system
   * @returns {object} Provider model configuration
   */
  getProviderModelConfig() {
    return this.modelConfig || {
      default: this.getDefaultModel(),
      temperature: 0.3,
      maxTokens: 1000
    };
  }

  /**
   * Gets provider configuration for client initialization
   * @returns {object} Provider configuration
   */
  getProviderConfig() {
    return {
      name: this.getName(),
      config: this.config,
      available: this.isAvailable()
    };
  }
}

export default BaseProvider;