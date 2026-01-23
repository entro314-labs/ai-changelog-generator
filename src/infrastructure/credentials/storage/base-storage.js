/**
 * Base Storage Interface
 *
 * All credential storage backends must implement this interface
 */

export class BaseStorage {
  constructor(options = {}) {
    this.options = options
  }

  /**
   * Get credential for a provider
   * @param {string} provider - Provider name (openai, anthropic, etc.)
   * @returns {Promise<string|null>} Credential value or null if not found
   */
  async get(provider) {
    throw new Error('Method not implemented')
  }

  /**
   * Set credential for a provider
   * @param {string} provider - Provider name
   * @param {string} credential - Credential value
   * @param {Object} metadata - Additional metadata (authType, expiresAt, etc.)
   * @returns {Promise<void>}
   */
  async set(provider, credential, metadata = {}) {
    throw new Error('Method not implemented')
  }

  /**
   * Delete credential for a provider
   * @param {string} provider - Provider name
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(provider) {
    throw new Error('Method not implemented')
  }

  /**
   * List all providers with credentials
   * @returns {Promise<string[]>} Array of provider names
   */
  async list() {
    throw new Error('Method not implemented')
  }

  /**
   * Check if credential exists for provider
   * @param {string} provider - Provider name
   * @returns {Promise<boolean>}
   */
  async has(provider) {
    const credential = await this.get(provider)
    return credential !== null
  }

  /**
   * Get metadata for a credential
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>} Metadata or null
   */
  async getMetadata(provider) {
    throw new Error('Method not implemented')
  }

  /**
   * Get storage type identifier
   * @returns {string}
   */
  getType() {
    throw new Error('Method not implemented')
  }

  /**
   * Get human-readable storage name
   * @returns {string}
   */
  getName() {
    throw new Error('Method not implemented')
  }

  /**
   * Get priority for this storage type
   * @returns {number} Higher number = higher priority
   */
  getPriority() {
    throw new Error('Method not implemented')
  }
}

export default BaseStorage
