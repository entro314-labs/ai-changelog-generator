/**
 * Credential Testing Service
 *
 * Validates credentials by making actual API calls to providers.
 * Caches results to avoid excessive API calls.
 */

import https from 'node:https'
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { decodeBedrockCredential } from '../providers/utils/provider-utils.js'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function normalizeAzureOpenAIBaseUrl(rawValue: unknown): string | null {
  if (typeof rawValue !== 'string') {
    return null
  }

  const trimmed = rawValue.trim().replace(/\/+$/, '')
  if (!trimmed) {
    return null
  }

  if (trimmed.includes('/openai/v1')) {
    return trimmed.endsWith('/openai/v1') ? `${trimmed}/` : trimmed
  }

  return `${trimmed}/openai/v1/`
}

export class CredentialTestingService {
  [key: string]: any
  constructor(options: Record<string, any> = {}) {
    this.options = options
    this.cache = new Map<any, any>()
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
  async testCredential(provider, credential, config: Record<string, any> = {}) {
    if (provider === 'anthropic' && config.authType === 'oauth_token') {
      return {
        valid: false,
        error: 'Anthropic OAuth tokens are discovered but not supported by the runtime provider',
      }
    }

    // Check format first
    const formatValidation = this.validateFormat(provider, credential, config)
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
    const results = new Map<any, any>()

    for (const provider of providers) {
      const credential = await credentialManager.getCredential(provider)
      if (credential) {
        const config = await credentialManager.getProviderConfig(provider)
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
  validateFormat(provider, credential, config: Record<string, any> = {}) {
    if (!credential || typeof credential !== 'string') {
      return {
        valid: false,
        error: 'Credential must be a non-empty string',
      }
    }

    const authType = config.authType || config.metadata?.authType

    if (authType === 'oauth_token') {
      return {
        valid: credential.length >= 20,
        error: credential.length < 20 ? `Invalid ${provider} OAuth token format` : null,
      }
    }

    if (provider === 'bedrock') {
      try {
        decodeBedrockCredential(credential)
        return { valid: true, error: null }
      } catch (error) {
        return { valid: false, error: error.message }
      }
    }

    const patterns = {
      openai: /^sk-[a-zA-Z0-9-_]{20,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9-_]{20,}$/,
      google: /^AIza[a-zA-Z0-9-_]{35,}$/,
      azure: /.{8,}/, // More lenient, various formats
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
  async _testOpenAI(apiKey, _config) {
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
  async _testAnthropic(apiKey, _config) {
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      })
    )
  }

  /**
   * Test Google (Gemini) credential
   * @private
   */
  async _testGoogle(credential, config) {
    if (config.authType === 'oauth_token') {
      return this._makeRequest({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1/models',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credential}`,
        },
      })
    }

    return this._makeRequest({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1/models?key=${credential}`,
      method: 'GET',
    })
  }

  /**
   * Test Azure OpenAI credential
   * @private
   */
  async _testAzure(credential, config) {
    const baseUrl = normalizeAzureOpenAIBaseUrl(config.baseUrl || config.endpoint)

    if (!baseUrl) {
      return {
        valid: false,
        error: 'Azure requires OPENAI_BASE_URL or AZURE_OPENAI_ENDPOINT in config',
      }
    }

    const url = new URL(baseUrl)
    const headers =
      config.authType === 'oauth_token'
        ? { Authorization: `Bearer ${credential}` }
        : { 'api-key': credential }

    return this._makeRequest({
      hostname: url.hostname,
      path: `${url.pathname.replace(/\/$/, '')}/models`,
      method: 'GET',
      headers,
    })
  }

  /**
   * Test AWS Bedrock credential
   * @private
   */
  async _testBedrock(credential, config) {
    const bundle = decodeBedrockCredential(credential)
    const region = bundle.region || config.region || 'us-east-1'
    const modelId = config.model || config.modelId || 'anthropic.claude-sonnet-4-5-v1:0'
    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: bundle.accessKeyId,
        secretAccessKey: bundle.secretAccessKey,
        sessionToken: bundle.sessionToken,
      },
      maxAttempts: 1,
    })

    try {
      const response = await client.send(
        new ConverseCommand({
          modelId,
          messages: [{ role: 'user', content: [{ text: 'Reply with OK.' }] }],
          inferenceConfig: { maxTokens: 2, temperature: 0 },
        })
      )
      return {
        valid: !!response.output,
        error: response.output ? null : 'Bedrock returned no output',
        metadata: { region, model: modelId },
      }
    } finally {
      client.destroy()
    }
  }

  /**
   * Test Hugging Face credential
   * @private
   */
  async _testHuggingFace(token, _config) {
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
  _makeRequest(options, postData: any = null) {
    return new Promise((resolve) => {
      let settled = false
      let timeout: NodeJS.Timeout
      const finish = (result) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve(result)
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          const statusCode = res.statusCode ?? 0
          if (statusCode >= 200 && statusCode < 300) {
            finish({
              valid: true,
              error: null,
              metadata: {
                statusCode: res.statusCode,
              },
            })
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            finish({
              valid: false,
              error: `Authentication failed (${res.statusCode})`,
              metadata: {
                statusCode: res.statusCode,
              },
            })
          } else {
            finish({
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

      timeout = setTimeout(() => {
        finish({
          valid: false,
          error: 'Request timeout',
        })
        req.destroy()
      }, 10000) // 10 second timeout

      req.on('error', (error) => {
        finish({
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
