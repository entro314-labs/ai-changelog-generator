/**
 * Google AI Provider for AI Changelog Generator
 * Uses Google GenAI SDK v1.35.0 (January 2026)
 * Supports Gemini 3 (Flash/Pro), 2.5, 2.0 models
 * @google/generative-ai is deprecated - using @google/genai
 *
 * Authentication methods:
 * - API Key (GOOGLE_API_KEY or GEMINI_API_KEY)
 * - OAuth tokens (from Gemini CLI or OAuth flow)
 * - Service Account (GOOGLE_APPLICATION_CREDENTIALS)
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import {
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentConfig,
  type GoogleGenAIOptions,
} from '@google/genai'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins } from '../utils/base-provider-helpers.js'
import { buildClientOptions } from '../utils/provider-utils.js'

/**
 * Authentication types for Google provider
 */
const GoogleAuthType = {
  API_KEY: 'api_key',
  OAUTH: 'oauth',
  SERVICE_ACCOUNT: 'service_account',
}

type GoogleAuthCredential = string | Record<string, any> | null

interface GoogleAuthMethod {
  type: string | null
  credential: GoogleAuthCredential
}

class GoogleProvider extends BaseProvider {
  [key: string]: any
  constructor(config) {
    super(config)
    this.genAI = null
    this.modelCache = new Map<any, any>()
    this.maxCacheSize = 50 // Limit cache size to prevent memory leaks
    this.authType = null
    this.oauthHandler = null

    if (this.isAvailable()) {
      try {
        this.initializeClient()
      } catch (error) {
        // Log but don't throw - provider will be unavailable for operations
        console.warn(`Google provider initialization warning: ${error.message}`)
        this.genAI = null
      }
    }
  }

  /**
   * Detect the best available authentication method
   * @returns {{ type: string, credential: string|Object }}
   */
  detectAuthMethod(): GoogleAuthMethod {
    // Priority 1: Explicit API key in config
    if (this.config.GOOGLE_API_KEY) {
      return { type: GoogleAuthType.API_KEY, credential: this.config.GOOGLE_API_KEY }
    }

    // Priority 2: GEMINI_API_KEY (alternative env var)
    if (this.config.GEMINI_API_KEY) {
      return { type: GoogleAuthType.API_KEY, credential: this.config.GEMINI_API_KEY }
    }

    // Priority 3: OAuth tokens from config (set by credential detection)
    if (this.config.GOOGLE_OAUTH_TOKEN) {
      return { type: GoogleAuthType.OAUTH, credential: this.config.GOOGLE_OAUTH_TOKEN }
    }

    // Priority 4: Gemini CLI OAuth tokens
    const geminiOAuthPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json')
    if (fs.existsSync(geminiOAuthPath)) {
      try {
        const content = fs.readFileSync(geminiOAuthPath, 'utf8')
        const oauthCreds = JSON.parse(content)
        if (oauthCreds.access_token) {
          // Check if token is not expired
          if (oauthCreds.expiry_date && new Date(oauthCreds.expiry_date) > new Date()) {
            return { type: GoogleAuthType.OAUTH, credential: oauthCreds }
          }
          // If there's a refresh token, we can still use it
          if (oauthCreds.refresh_token) {
            return { type: GoogleAuthType.OAUTH, credential: oauthCreds }
          }
        }
      } catch {
        // Continue to next method
      }
    }

    // Priority 5: Gemini CLI .env file
    const geminiEnvPath = path.join(os.homedir(), '.gemini', '.env')
    if (fs.existsSync(geminiEnvPath)) {
      try {
        const content = fs.readFileSync(geminiEnvPath, 'utf8')
        const match = content.match(/(?:GEMINI_API_KEY|GOOGLE_API_KEY)=["']?([^"'\n]+)["']?/)
        if (match && match[1]) {
          return { type: GoogleAuthType.API_KEY, credential: match[1] }
        }
      } catch {
        // Continue to next method
      }
    }

    // Priority 6: Service Account credentials
    const serviceAccountPath = this.config.GOOGLE_APPLICATION_CREDENTIALS
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      try {
        const content = fs.readFileSync(serviceAccountPath, 'utf8')
        const credentials = JSON.parse(content)
        if (credentials.type === 'service_account') {
          return { type: GoogleAuthType.SERVICE_ACCOUNT, credential: credentials }
        }
      } catch {
        // Continue
      }
    }

    return { type: null, credential: null }
  }

  initializeClient() {
    const auth = this.detectAuthMethod()
    this.authType = auth.type

    if (!auth.type) {
      return
    }

    const baseOptions = {
      apiVersion: 'v1',
      timeout: 60000,
      maxRetries: 2,
    }

    if (auth.type === GoogleAuthType.API_KEY) {
      const clientOptions = buildClientOptions(
        { ...this.getProviderConfig(), apiKey: auth.credential },
        baseOptions
      )

      const googleOptions: GoogleGenAIOptions = {
        apiKey: clientOptions.apiKey,
        apiVersion: clientOptions.apiVersion,
        httpOptions: {
          timeout: clientOptions.timeout,
          ...(typeof clientOptions.apiEndpoint === 'string'
            ? { baseUrl: clientOptions.apiEndpoint }
            : {}),
        },
      }

      this.genAI = new GoogleGenAI(googleOptions)
    } else if (auth.type === GoogleAuthType.OAUTH) {
      // For OAuth, we use the access token as a bearer token
      if (!auth.credential) {
        throw new Error('Google OAuth credential is missing')
      }

      const accessToken =
        typeof auth.credential === 'string' ? auth.credential : auth.credential.access_token

      this.genAI = new GoogleGenAI({
        apiVersion: 'v1',
        httpOptions: {
          timeout: 60000,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      })

      // Store refresh token for later use
      if (typeof auth.credential === 'object' && auth.credential.refresh_token) {
        this.refreshToken = auth.credential.refresh_token
      }
    } else if (auth.type === GoogleAuthType.SERVICE_ACCOUNT) {
      if (typeof this.config.GOOGLE_APPLICATION_CREDENTIALS === 'string') {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = this.config.GOOGLE_APPLICATION_CREDENTIALS
      }

      this.genAI = new GoogleGenAI({
        apiVersion: 'v1',
        httpOptions: {
          apiVersion: 'v1',
          timeout: 60000,
        },
      })
    }
  }

  getName() {
    return 'google'
  }

  isAvailable() {
    const auth = this.detectAuthMethod()
    return auth.type !== null
  }

  /**
   * Get the current authentication type
   * @returns {string|null}
   */
  getAuthType() {
    return this.authType
  }

  /**
   * Set OAuth token manually (for external OAuth flows)
   * @param {string|Object} token - Access token or full OAuth response
   */
  setOAuthToken(token) {
    if (typeof token === 'string') {
      this.config.GOOGLE_OAUTH_TOKEN = token
    } else if (token.access_token) {
      this.config.GOOGLE_OAUTH_TOKEN = token.access_token
      if (token.refresh_token) {
        this.refreshToken = token.refresh_token
      }
    }
    this.initializeClient()
  }

  /**
   * Get authentication info for display
   * @returns {Object}
   */
  getAuthInfo() {
    const auth = this.detectAuthMethod()
    return {
      type: auth.type,
      source: this.getAuthSource(auth),
      valid: auth.type !== null,
    }
  }

  /**
   * Get the source of authentication
   * @param {Object} auth
   * @returns {string}
   */
  getAuthSource(auth) {
    if (!auth.type) return 'none'

    if (this.config.GOOGLE_API_KEY) return 'config (GOOGLE_API_KEY)'
    if (this.config.GEMINI_API_KEY) return 'config (GEMINI_API_KEY)'
    if (this.config.GOOGLE_OAUTH_TOKEN) return 'config (OAuth token)'

    const geminiOAuthPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json')
    if (fs.existsSync(geminiOAuthPath)) return 'Gemini CLI OAuth'

    const geminiEnvPath = path.join(os.homedir(), '.gemini', '.env')
    if (fs.existsSync(geminiEnvPath)) return 'Gemini CLI .env'

    if (this.config.GOOGLE_APPLICATION_CREDENTIALS) return 'Service Account'

    return 'unknown'
  }

  async generateCompletion(messages, options: Record<string, any> = {}) {
    if (!this.isAvailable()) {
      return this.handleProviderError(
        new Error('Google provider is not configured'),
        'generate_completion'
      )
    }

    try {
      const modelConfig = this.getProviderModelConfig()
      const modelName = options.model || modelConfig.standardModel

      const systemInstruction = messages.find((m) => m.role === 'system')?.content

      // Separate system instruction from chat history
      const history = messages
        .filter((m) => m.role !== 'system')
        .map((m) => {
          const role = m.role === 'assistant' ? 'model' : 'user'
          if (typeof m.content === 'string') {
            return { role, parts: [{ text: m.content }] }
          }
          if (Array.isArray(m.content)) {
            const parts = m.content.map((part) => {
              if (typeof part === 'string') {
                return { text: part }
              }
              if (part.type === 'image_url') {
                return {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: part.image_url.url.startsWith('data:image/')
                      ? part.image_url.url.split(',')[1]
                      : Buffer.from(part.image_url.url).toString('base64'),
                  },
                }
              }
              return { text: JSON.stringify(part) }
            })
            return { role, parts }
          }
          return { role, parts: [{ text: JSON.stringify(m.content) }] }
        })

      const generationConfig: GenerateContentConfig = {
        temperature: options.temperature || 0.4,
        maxOutputTokens: options.max_tokens || 8192,
        topP: options.top_p || 0.95,
        topK: options.top_k || 64,
        candidateCount: options.n || 1,
        stopSequences: options.stop || [],
        responseMimeType:
          options.response_format?.type === 'json_object' ? 'application/json' : undefined,
      }

      // Gemini 3 thinking_level parameter - controls reasoning depth
      // Valid values: 'low', 'medium', 'high' (relative guidelines, not strict token limits)
      if (options.thinking_level && this.isGemini3Model(modelName)) {
        generationConfig.thinkingConfig = {
          thinkingLevel:
            {
              low: ThinkingLevel.LOW,
              medium: ThinkingLevel.MEDIUM,
              high: ThinkingLevel.HIGH,
              minimal: ThinkingLevel.MINIMAL,
            }[options.thinking_level] || ThinkingLevel.MEDIUM,
        }
      }

      if (systemInstruction) {
        generationConfig.systemInstruction = systemInstruction
      }

      const safetySettings = [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ]

      if (options.tools && options.tools.length > 0) {
        try {
          const tools = options.tools.map((tool) => ({
            functionDeclarations: [
              {
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters,
              },
            ],
          }))

          const chat = this.genAI.chats.create({
            model: modelName,
            history: history.slice(0, -1),
            config: {
              ...generationConfig,
              safetySettings,
              tools,
            },
          })

          const lastMessage = history.at(-1)
          if (!lastMessage) {
            throw new Error('No user message available for Google chat request')
          }

          const response = await chat.sendMessage({
            message: lastMessage.parts,
          })

          const functionCalls = response.functionCalls ?? []

          return {
            content: response.text || '',
            model: modelName,
            tool_calls:
              functionCalls.length > 0
                ? functionCalls.map((call) => ({
                    id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                    type: 'function',
                    function: {
                      name: call.name,
                      arguments: call.args ? JSON.stringify(call.args) : '{}',
                    },
                  }))
                : undefined,
            tokens: response.usageMetadata?.totalTokenCount || 0,
            finish_reason: functionCalls.length > 0 ? 'tool_calls' : 'stop',
          }
        } catch (error) {
          console.error('Error in tool calling:', error)
          return this.handleProviderError(error, 'generate_completion', { model: options.model })
        }
      }

      // Standard completion without tools
      const response = await this.genAI.models.generateContent({
        model: modelName,
        contents: history,
        config: {
          ...generationConfig,
          safetySettings,
        },
      })

      return {
        content: response.text || '',
        model: modelName,
        tokens: response.usageMetadata?.totalTokenCount || 0,
        finish_reason: response.candidates?.[0]?.finishReason || 'stop',
      }
    } catch (error) {
      // Handle rate limits and retries
      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        const retryDelay = this.getRetryDelay()
        console.warn(`Rate limit hit, retrying in ${retryDelay}ms...`)
        await this.sleep(retryDelay)
        return this.generateCompletion(messages, options)
      }
      return this.handleProviderError(error, 'generate_completion', { model: options.model })
    }
  }

  // Google-specific helper methods
  getRetryDelay() {
    return Math.random() * 5000 + 1000 // Random delay between 1-6 seconds
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Check if model is Gemini 3 (supports new features)
  isGemini3Model(modelName) {
    return modelName && modelName.includes('gemini-3')
  }

  getAvailableModels() {
    return [
      // Gemini 3 series (November-December 2025) - latest and recommended
      {
        id: 'gemini-3-pro',
        name: 'Gemini 3 Pro',
        contextWindow: 1000000, // 1M tokens
        maxOutput: 8192,
        inputCost: 0.0000005, // $0.50 per 1M tokens
        outputCost: 0.000003, // $3.00 per 1M tokens
        features: [
          'text',
          'vision',
          'tools',
          'reasoning',
          'thinking_level',
          'thought_signatures',
          'agentic',
          'autonomous_coding',
        ],
        description:
          'Most advanced reasoning model with 78% SWE-bench, thinking_level parameter (Nov 2025)',
      },
      {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        contextWindow: 1000000, // 1M tokens
        maxOutput: 8192,
        inputCost: 0.0000005, // $0.50 per 1M tokens
        outputCost: 0.000003, // $3.00 per 1M tokens
        features: [
          'text',
          'vision',
          'tools',
          'reasoning',
          'thinking_level',
          'thought_signatures',
          'speed',
        ],
        description: 'Pro-level intelligence at Flash speed and pricing (Dec 2025)',
      },
      {
        id: 'gemini-3.6-flash',
        name: 'Gemini 3.6 Flash',
        contextWindow: 1000000,
        maxOutput: 65536,
        features: ['text', 'vision', 'tools', 'reasoning', 'thinking_level', 'speed'],
        description: 'Current-generation Flash tier',
      },
      {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        contextWindow: 1000000,
        maxOutput: 65536,
        features: ['text', 'vision', 'tools', 'reasoning', 'thinking_level', 'speed'],
        description: 'Previous Flash release, still current',
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro (preview)',
        contextWindow: 1000000,
        maxOutput: 65536,
        features: ['text', 'vision', 'tools', 'reasoning', 'thinking_level', 'thought_signatures'],
        description: 'Highest-capability Gemini tier',
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'Gemini 3.1 Flash Lite',
        contextWindow: 1000000,
        maxOutput: 65536,
        features: ['text', 'vision', 'tools', 'speed'],
        description: 'Lowest-cost current Gemini tier',
      },
      // Gemini 2.5 series (previous generation, still supported)
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        contextWindow: 2097152, // 2M tokens
        maxOutput: 8192,
        inputCost: 0.00000125, // $1.25 per 1M tokens
        outputCost: 0.000005, // $5.00 per 1M tokens
        features: ['text', 'vision', 'tools', 'reasoning', 'thinking'],
        description: 'Previous generation with 2M context window',
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        contextWindow: 1048576, // 1M tokens
        maxOutput: 8192,
        inputCost: 0.00000075, // $0.75 per 1M tokens
        outputCost: 0.000003, // $3.00 per 1M tokens
        features: ['text', 'vision', 'tools', 'multimodal', 'speed'],
        description: 'Fast Gemini 2.5 model for high-throughput tasks',
      },
      {
        id: 'gemini-2.0-flash-001',
        name: 'Gemini 2.0 Flash',
        contextWindow: 1048576, // 1M tokens
        maxOutput: 8192,
        inputCost: 0.00000075, // $0.75 per 1M tokens
        outputCost: 0.000003, // $3.00 per 1M tokens
        features: ['text', 'vision', 'tools', 'multimodal', 'functions'],
        description: 'RETIRING MARCH 3, 2026 - Migrate to Gemini 2.5 or 3 series',
        deprecated: true,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2097152, // 2M tokens
        maxOutput: 8192,
        inputCost: 0.00000125, // $1.25 per 1M tokens
        outputCost: 0.000005, // $5.00 per 1M tokens
        features: ['text', 'vision', 'tools'],
        description: 'Legacy model - consider upgrading to Gemini 3',
        deprecated: true,
      },
    ]
  }

  getRequiredEnvVars() {
    // API key is the primary method, but OAuth and service account are alternatives
    return ['GOOGLE_API_KEY'] // Or GEMINI_API_KEY, or OAuth, or service account
  }

  getModelCapabilities(modelName) {
    const isGemini3 = this.isGemini3Model(modelName)
    return {
      reasoning: isGemini3 || modelName.includes('2.5-pro') || modelName.includes('1.5-pro'),
      function_calling: true,
      json_mode: true,
      multimodal: true,
      largeContext: true,
      thinking: isGemini3 || modelName.includes('2.5-pro'),
      thinking_level: isGemini3, // Gemini 3 only
      thought_signatures: isGemini3, // Gemini 3 only
      agentic_workflows: isGemini3,
      autonomous_coding: isGemini3 && modelName.includes('pro'),
      speed: modelName.includes('flash'),
    }
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins(GoogleProvider, 'google')
