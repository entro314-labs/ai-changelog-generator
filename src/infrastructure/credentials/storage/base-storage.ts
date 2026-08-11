/**
 * Base Storage Interface
 *
 * All credential storage backends must implement this interface
 */

export class BaseStorage {
  [key: string]: any
  constructor(options: Record<string, any> = {}) {
    this.options = options
  }

  /**
   * Get credential for a provider
   * @param {string} provider - Provider name (openai, anthropic, etc.)
   * @returns {Promise<string|null>} Credential value or null if not found
   */
  async get(_provider: string): Promise<string | null> {
    throw new Error('Method not implemented')
  }

  /**
   * Set credential for a provider
   * @param {string} provider - Provider name
   * @param {string} credential - Credential value
   * @param {Object} metadata - Additional metadata (authType, expiresAt, etc.)
   * @returns {Promise<void>}
   */
  async set(
    _provider: string,
    _credential: string,
    _metadata: Record<string, any> = {}
  ): Promise<void> {
    throw new Error('Method not implemented')
  }

  /**
   * Delete credential for a provider
   * @param {string} provider - Provider name
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(_provider: string): Promise<boolean> {
    throw new Error('Method not implemented')
  }

  /**
   * List all providers with credentials
   * @returns {Promise<string[]>} Array of provider names
   */
  async list(): Promise<string[]> {
    throw new Error('Method not implemented')
  }

  /**
   * Check if credential exists for provider
   * @param {string} provider - Provider name
   * @returns {Promise<boolean>}
   */
  async has(provider: string): Promise<boolean> {
    const credential = await this.get(provider)
    return credential !== null
  }

  /**
   * Get metadata for a credential
   * @param {string} provider - Provider name
   * @returns {Promise<Object|null>} Metadata or null
   */
  async getMetadata(_provider: string): Promise<Record<string, any> | null> {
    throw new Error('Method not implemented')
  }

  /**
   * Get storage type identifier
   * @returns {string}
   */
  getType(): string {
    throw new Error('Method not implemented')
  }

  /**
   * Get human-readable storage name
   * @returns {string}
   */
  getName(): string {
    throw new Error('Method not implemented')
  }

  /**
   * Get priority for this storage type
   * @returns {number} Higher number = higher priority
   */
  getPriority(): number {
    throw new Error('Method not implemented')
  }
}

export default BaseStorage
