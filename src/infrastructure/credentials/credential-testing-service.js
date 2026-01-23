/**
 * Credential Testing Service
 *
 * Validates credentials by making actual API calls to providers.
 * Caches results to avoid excessive API calls.
 */

import https from 'node:https'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export class CredentialTestingService {
  constructor(options = {}) {
    this.options = options
    this.cache = new Map()
    this.cacheTTL = options.cacheTTL || CACHE_TTL
  }

  /**
   * Test a credential for a specific provider
   *
   * @param {string} provider - Provider name
   * @param {string} credential - Credential to test
   * @param {Object} config - Additional configuration (endpoints, etc.)
   * @returns {Promise<Object>} { valid, error, metadata }
   */
  async testCredential(provider, credential, config = {}) {
    // Check format first
    const formatValidation = this.validateFormat(provider, credential)
    if (!formatValidation.valid) {
      return formatValidation
    }

    // Check cache
    const cacheKey = `${provider}:${this._hash(credential)}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result
    }

    // Test based on provider
    let result
    try {
      switch (provider) {
        case 'openai':
          result = await this._testOpenAI(credential, config)
          break
        case 'anthropic':
          result = await this._testAnthropic(credential, config)
          break
        case 'google':
          result = await this._testGoogle(credential, config)
          break
        case 'azure':
          result = await this._testAzure(credential, config)
          break
        case 'bedrock':
          result = await this._testBedrock(credential, config)
          break
        case 'huggingface':
          result = await this._testHuggingFace(credential, config)
          break
        case 'ollama':
          result = await this._testOllama(config)
          break
        case 'lmstudio':
          result = await this._testLMStudio(config)
          break
        default:
          result = {
            valid: false,
            error: `Testing not implemented for provider: ${provider}`,
          }
      }
    } catch (error) {
      result = {
        valid: false,
        error: error.message,
      }
    }

    // Cache result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    })

    return result
  }

  /**
   * Test all configured credentials
   *
   * @param {Object} credentialManager - UnifiedCredentialManager instance
   * @returns {Promise<Map>} Map of provider -> test result
   */
  async testAllCredentials(credentialManager) {
    const providers = await credentialManager.listProviders()
    const results = new Map()

    for (const provider of providers) {
      const credential = await credentialManager.getCredential(provider)
      if (credential) {
        const config = {}
        // Get additional config for providers that need it
        if (provider === 'azure' || provider === 'ollama' || provider === 'lmstudio') {
          // Would need to get config from storage backend
          // For now, skip or use defaults
        }

        const result = await this.testCredential(provider, credential, config)
        results.set(provider, result)
      }
    }

    return results
  }

  /**
   * Validate credential format (without API call)
   *
   * @param {string} provider - Provider name
   * @param {string} credential - Credential to validate
   * @returns {Object} { valid, error }
   */
  validateFormat(provider, credential) {
    if (!credential || typeof credential !== 'string') {
      return {
        valid: false,
        error: 'Credential must be a non-empty string',
      }
    }

    const patterns = {
      openai: /^sk-[a-zA-Z0-9-_]{20,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9-_]{20,}$/,
      google: /^AIza[a-zA-Z0-9-_]{35,}$/,
      azure: /.{8,}/, // More lenient, various formats
      bedrock: /^AKI[A-Z0-9]{17}$/,
      huggingface: /^hf_[a-zA-Z0-9]{34,}$/,
    }

    const pattern = patterns[provider]
    if (!pattern) {
      // No pattern defined, assume valid if has minimum length
      return {
        valid: credential.length >= 20,
        error: credential.length < 20 ? 'Credential too short' : null,
      }
    }

    const valid = pattern.test(credential)
    return {
      valid,
      error: valid ? null : `Invalid ${provider} credential format`,
    }
  }

  /**
   * Invalidate cache for a provider/credential
   *
   * @param {string} provider - Provider name
   * @param {string} credential - Credential
   */
  invalidateCache(provider, credential) {
    const cacheKey = `${provider}:${this._hash(credential)}`
    this.cache.delete(cacheKey)
  }

  /**
   * Clear all cached results
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * Test OpenAI credential
   * @private
   */
  async _testOpenAI(apiKey, config) {
    return this._makeRequest({
      hostname: 'api.openai.com',
      path: '/v1/models',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
  }

  /**
   * Test Anthropic credential
   * @private
   */
  async _testAnthropic(apiKey, config) {
    // Anthropic doesn't have a simple "list models" endpoint
    // Use a minimal message request
    return this._makeRequest(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      },
      JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      })
    )
  }

  /**
   * Test Google (Gemini) credential
   * @private
   */
  async _testGoogle(apiKey, config) {
    return this._makeRequest({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1/models?key=${apiKey}`,
      method: 'GET',
    })
  }

  /**
   * Test Azure OpenAI credential
   * @private
   */
  async _testAzure(apiKey, config) {
    if (!config.endpoint || !config.deploymentName) {
      return {
        valid: false,
        error: 'Azure requires endpoint and deploymentName in config',
      }
    }

    const url = new URL(config.endpoint)
    return this._makeRequest({
      hostname: url.hostname,
      path: `/openai/deployments?api-version=${config.apiVersion || '2023-05-15'}`,
      method: 'GET',
      headers: {
        'api-key': apiKey,
      },
    })
  }

  /**
   * Test AWS Bedrock credential
   * @private
   */
  async _testBedrock(accessKeyId, config) {
    // Bedrock requires AWS SigV4 signing, more complex
    // For now, just validate format
    return {
      valid: this.validateFormat('bedrock', accessKeyId).valid,
      error: null,
      metadata: {
        note: 'Full Bedrock testing requires AWS SigV4 signing',
      },
    }
  }

  /**
   * Test Hugging Face credential
   * @private
   */
  async _testHuggingFace(token, config) {
    return this._makeRequest({
      hostname: 'huggingface.co',
      path: '/api/whoami-v2',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  /**
   * Test Ollama connection
   * @private
   */
  async _testOllama(config) {
    const host = config.ollamaHost || 'http://localhost:11434'
    const url = new URL(host)

    return this._makeRequest({
      hostname: url.hostname,
      port: url.port || 11434,
      path: '/api/tags',
      method: 'GET',
    })
  }

  /**
   * Test LM Studio connection
   * @private
   */
  async _testLMStudio(config) {
    const host = config.lmstudioHost || 'http://localhost:1234'
    const url = new URL(host)

    return this._makeRequest({
      hostname: url.hostname,
      port: url.port || 1234,
      path: '/v1/models',
      method: 'GET',
    })
  }

  /**
   * Make HTTPS request
   * @private
   */
  _makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        req.destroy()
        resolve({
          valid: false,
          error: 'Request timeout',
        })
      }, 10000) // 10 second timeout

      const req = https.request(options, (res) => {
        clearTimeout(timeout)

        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              valid: true,
              error: null,
              metadata: {
                statusCode: res.statusCode,
              },
            })
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            resolve({
              valid: false,
              error: `Authentication failed (${res.statusCode})`,
              metadata: {
                statusCode: res.statusCode,
              },
            })
          } else {
            resolve({
              valid: false,
              error: `API error (${res.statusCode})`,
              metadata: {
                statusCode: res.statusCode,
                response: data.substring(0, 200),
              },
            })
          }
        })
      })

      req.on('error', (error) => {
        clearTimeout(timeout)
        resolve({
          valid: false,
          error: `Connection failed: ${error.message}`,
        })
      })

      if (postData) {
        req.write(postData)
      }

      req.end()
    })
  }

  /**
   * Simple hash function for cache keys
   * @private
   */
  _hash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }
}

export default CredentialTestingService
