/**
 * GitHub Copilot Provider for AI Changelog Generator
 *
 * Uses GitHub Copilot authentication to access AI models.
 * Supports users with GitHub Copilot Pro, Pro+, Business, or Enterprise subscriptions.
 *
 * Authentication sources:
 * - ~/.config/github-copilot/hosts.json (Copilot CLI)
 * - VS Code GitHub authentication (via extension)
 * - Manual token configuration
 *
 * API Compatibility: OpenAI-compatible endpoint
 */

import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins } from '../utils/base-provider-helpers.js'

/**
 * Copilot API endpoints
 */
const COPILOT_API = {
  GITHUB_API: 'https://api.github.com',
  COPILOT_PROXY: 'https://api.githubcopilot.com',
  TOKEN_ENDPOINT: 'https://api.github.com/copilot_internal/v2/token',
}

/**
 * Available models through Copilot
 */
const COPILOT_MODELS = {
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o (via Copilot)',
    contextWindow: 128000,
    maxOutput: 16384,
    features: ['text', 'vision', 'tools', 'json_mode'],
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini (via Copilot)',
    contextWindow: 128000,
    maxOutput: 16384,
    features: ['text', 'vision', 'tools', 'json_mode'],
  },
  'claude-3.5-sonnet': {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet (via Copilot)',
    contextWindow: 200000,
    maxOutput: 8192,
    features: ['text', 'vision', 'tools'],
  },
  'o1-preview': {
    id: 'o1-preview',
    name: 'O1 Preview (via Copilot)',
    contextWindow: 128000,
    maxOutput: 32768,
    features: ['text', 'reasoning'],
  },
  'o1-mini': {
    id: 'o1-mini',
    name: 'O1 Mini (via Copilot)',
    contextWindow: 128000,
    maxOutput: 65536,
    features: ['text', 'reasoning'],
  },
}

class GitHubCopilotProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.homeDir = os.homedir()
    this.githubToken = null
    this.copilotToken = null
    this.tokenExpiry = null
    this.machineId = null

    if (this.isAvailable()) {
      this.initializeCredentials()
    }
  }

  getName() {
    return 'github-copilot'
  }

  isAvailable() {
    // Check for explicit token in config
    if (this.config.GITHUB_COPILOT_TOKEN) {
      return true
    }

    // Check for token from credential detection
    if (this.config.GITHUB_TOKEN || this.config.GH_TOKEN) {
      return true
    }

    // Check for hosts.json file
    const hostsPath = path.join(this.homeDir, '.config', 'github-copilot', 'hosts.json')
    if (fs.existsSync(hostsPath)) {
      try {
        const content = fs.readFileSync(hostsPath, 'utf8')
        const hosts = JSON.parse(content)
        return !!hosts['github.com']?.oauth_token
      } catch {
        return false
      }
    }

    // Check gh CLI hosts.yml
    const ghHostsPath = path.join(this.homeDir, '.config', 'gh', 'hosts.yml')
    if (fs.existsSync(ghHostsPath)) {
      try {
        const content = fs.readFileSync(ghHostsPath, 'utf8')
        return content.includes('oauth_token:')
      } catch {
        return false
      }
    }

    return false
  }

  initializeCredentials() {
    // Priority 1: Explicit token in config
    if (this.config.GITHUB_COPILOT_TOKEN) {
      this.githubToken = this.config.GITHUB_COPILOT_TOKEN
      return
    }

    // Priority 2: GitHub token from env/config
    if (this.config.GITHUB_TOKEN || this.config.GH_TOKEN) {
      this.githubToken = this.config.GITHUB_TOKEN || this.config.GH_TOKEN
      return
    }

    // Priority 3: hosts.json (Copilot CLI)
    const hostsPath = path.join(this.homeDir, '.config', 'github-copilot', 'hosts.json')
    if (fs.existsSync(hostsPath)) {
      try {
        const content = fs.readFileSync(hostsPath, 'utf8')
        const hosts = JSON.parse(content)
        if (hosts['github.com']?.oauth_token) {
          this.githubToken = hosts['github.com'].oauth_token
          return
        }
      } catch {
        // Continue to next source
      }
    }

    // Priority 4: gh CLI hosts.yml
    const ghHostsPath = path.join(this.homeDir, '.config', 'gh', 'hosts.yml')
    if (fs.existsSync(ghHostsPath)) {
      try {
        const content = fs.readFileSync(ghHostsPath, 'utf8')
        const tokenMatch = content.match(/oauth_token:\s*(.+)/)
        if (tokenMatch && tokenMatch[1]) {
          this.githubToken = tokenMatch[1].trim()
        }
      } catch {
        // No token found
      }
    }
  }

  /**
   * Get a Copilot API token using the GitHub OAuth token
   * @returns {Promise<string>}
   */
  async getCopilotToken() {
    // Return cached token if still valid
    if (this.copilotToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.copilotToken
    }

    if (!this.githubToken) {
      throw new Error('No GitHub token available for Copilot authentication')
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: '/copilot_internal/v2/token',
        method: 'GET',
        headers: {
          Authorization: `token ${this.githubToken}`,
          'User-Agent': 'ai-changelog-generator/1.0',
          Accept: 'application/json',
          'Editor-Version': 'vscode/1.95.0',
          'Editor-Plugin-Version': 'copilot/1.250.0',
        },
      }

      const req = https.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to get Copilot token: ${res.statusCode} - ${data}`))
            return
          }

          try {
            const tokenData = JSON.parse(data)
            this.copilotToken = tokenData.token
            // Token typically expires in 30 minutes
            this.tokenExpiry = new Date(
              Date.now() +
                (tokenData.expires_at ? tokenData.expires_at * 1000 - Date.now() : 25 * 60 * 1000)
            )
            resolve(this.copilotToken)
          } catch (error) {
            reject(new Error(`Failed to parse Copilot token response: ${error.message}`))
          }
        })
      })

      req.on('error', (error) => {
        reject(new Error(`Copilot token request failed: ${error.message}`))
      })

      req.end()
    })
  }

  async generateCompletion(messages, options = {}) {
    if (!this.isAvailable()) {
      return this.handleProviderError(
        new Error('GitHub Copilot provider is not configured'),
        'generate_completion'
      )
    }

    try {
      const copilotToken = await this.getCopilotToken()
      const modelConfig = this.getProviderModelConfig()
      const modelName = options.model || modelConfig.standardModel

      // Convert messages to OpenAI format (Copilot uses OpenAI-compatible API)
      const formattedMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const requestBody = {
        model: modelName,
        messages: formattedMessages,
        max_tokens: options.max_tokens || 4096,
        temperature: options.temperature || 0.3,
        top_p: options.top_p || 1,
        stream: false,
      }

      if (options.response_format?.type === 'json_object') {
        requestBody.response_format = { type: 'json_object' }
      }

      if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools
        requestBody.tool_choice = options.tool_choice || 'auto'
      }

      const response = await this.makeRequest(copilotToken, requestBody)

      return {
        content: response.choices[0]?.message?.content || '',
        model: modelName,
        tool_calls: response.choices[0]?.message?.tool_calls,
        tokens: response.usage?.total_tokens || 0,
        finish_reason: response.choices[0]?.finish_reason || 'stop',
      }
    } catch (error) {
      // Handle token expiry
      if (error.message.includes('401') || error.message.includes('403')) {
        this.copilotToken = null
        this.tokenExpiry = null
        // Retry once with fresh token
        if (!options._retried) {
          return this.generateCompletion(messages, { ...options, _retried: true })
        }
      }
      return this.handleProviderError(error, 'generate_completion', { model: options.model })
    }
  }

  /**
   * Make a request to the Copilot API
   * @param {string} token - Copilot API token
   * @param {Object} body - Request body
   * @returns {Promise<Object>}
   */
  makeRequest(token, body) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body)

      const options = {
        hostname: 'api.githubcopilot.com',
        port: 443,
        path: '/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'ai-changelog-generator/1.0',
          Accept: 'application/json',
          'Editor-Version': 'vscode/1.95.0',
          'Editor-Plugin-Version': 'copilot/1.250.0',
          'Copilot-Integration-Id': 'vscode-chat',
          'Openai-Intent': 'conversation-panel',
        },
      }

      const req = https.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Copilot API error: ${res.statusCode} - ${data}`))
            return
          }

          try {
            resolve(JSON.parse(data))
          } catch (error) {
            reject(new Error(`Failed to parse Copilot response: ${error.message}`))
          }
        })
      })

      req.on('error', (error) => {
        reject(new Error(`Copilot API request failed: ${error.message}`))
      })

      req.write(postData)
      req.end()
    })
  }

  getModelRecommendation(commitDetails) {
    const { files = 0, lines = 0, breaking = false, complex = false } = commitDetails

    if (breaking || complex || files > 20 || lines > 500) {
      return {
        model: 'gpt-4o',
        reason: 'Complex changes requiring advanced reasoning',
      }
    }

    if (files > 5 || lines > 100) {
      return {
        model: 'gpt-4o',
        reason: 'Standard analysis with good capability',
      }
    }

    return {
      model: 'gpt-4o-mini',
      reason: 'Simple changes, using faster model',
    }
  }

  async validateModelAvailability(modelName) {
    const model = COPILOT_MODELS[modelName]
    return {
      available: !!model,
      model: model || null,
      reason: model ? 'Model available via Copilot' : 'Model not available',
    }
  }

  async testConnection() {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'GitHub Copilot credentials not found',
      }
    }

    try {
      const startTime = Date.now()
      await this.getCopilotToken()
      const tokenTime = Date.now() - startTime

      // Test actual completion
      const testStart = Date.now()
      await this.generateCompletion([{ role: 'user', content: 'Say "test" in one word.' }], {
        max_tokens: 5,
      })
      const completionTime = Date.now() - testStart

      return {
        success: true,
        responseTime: completionTime,
        tokenFetchTime: tokenTime,
        message: 'GitHub Copilot connection successful',
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  getCapabilities(modelName) {
    const model = COPILOT_MODELS[modelName] || COPILOT_MODELS['gpt-4o']
    const features = model.features || []

    return {
      reasoning: features.includes('reasoning'),
      function_calling: features.includes('tools'),
      json_mode: features.includes('json_mode'),
      multimodal: features.includes('vision'),
      largeContext: model.contextWindow >= 100000,
    }
  }

  async getAvailableModels() {
    return Object.values(COPILOT_MODELS)
  }

  getDefaultModel() {
    return 'gpt-4o'
  }

  getRequiredEnvVars() {
    return ['GITHUB_COPILOT_TOKEN'] // Or detected from hosts.json
  }

  getProviderModelConfig() {
    return {
      smallModel: 'gpt-4o-mini',
      mediumModel: 'gpt-4o',
      standardModel: 'gpt-4o',
      complexModel: 'gpt-4o',
      reasoningModel: 'o1-mini',
      default: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 4096,
    }
  }

  getProviderInfo() {
    const hasToken = !!this.githubToken
    const tokenSource = this.config.GITHUB_COPILOT_TOKEN
      ? 'config'
      : this.config.GITHUB_TOKEN
        ? 'env'
        : 'hosts.json'

    return `GitHub Copilot Provider (token: ${hasToken ? `from ${tokenSource}` : 'not found'})`
  }

  /**
   * Check if user has active Copilot subscription
   * @returns {Promise<Object>}
   */
  async checkSubscription() {
    if (!this.githubToken) {
      return { active: false, error: 'No GitHub token' }
    }

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: '/copilot_internal/user',
        method: 'GET',
        headers: {
          Authorization: `token ${this.githubToken}`,
          'User-Agent': 'ai-changelog-generator/1.0',
          Accept: 'application/json',
        },
      }

      const req = https.request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const userData = JSON.parse(data)
              resolve({
                active: true,
                plan: userData.copilot_plan || 'unknown',
                organization: userData.organization_login,
              })
            } catch {
              resolve({ active: true, plan: 'unknown' })
            }
          } else {
            resolve({ active: false, statusCode: res.statusCode })
          }
        })
      })

      req.on('error', () => {
        resolve({ active: false, error: 'Request failed' })
      })

      req.end()
    })
  }

  /**
   * Set GitHub token manually (for VS Code extension integration)
   * @param {string} token
   */
  setGitHubToken(token) {
    this.githubToken = token
    this.copilotToken = null
    this.tokenExpiry = null
  }
}

export default applyMixins(GitHubCopilotProvider, 'github-copilot')
export { GitHubCopilotProvider }
