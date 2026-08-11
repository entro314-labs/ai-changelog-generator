import process from 'node:process'

import { GoogleGenAI, type GenerateContentConfig, type GoogleGenAIOptions } from '@google/genai'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins } from '../utils/base-provider-helpers.js'
import { buildClientOptions } from '../utils/provider-utils.js'

// Cache for model instances to avoid recreating them (with size limit to prevent memory leaks)
const modelCache = new Map<any, any>()
const MAX_MODEL_CACHE_SIZE = 50

function addToModelCache(key, value) {
  if (modelCache.size >= MAX_MODEL_CACHE_SIZE) {
    // Remove oldest entries (first added)
    const firstKey = modelCache.keys().next().value
    modelCache.delete(firstKey)
  }
  modelCache.set(key, value)
}

class VertexAIProvider extends BaseProvider {
  [key: string]: any
  constructor(config) {
    super(config)
    this.client = null
    this.generativeModel = null

    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  async initializeClient() {
    try {
      const clientOptions = buildClientOptions(this.getProviderConfig(), {
        location: 'us-central1',
        apiVersion: 'v1',
      })

      const vertexOptions: GoogleGenAIOptions = {
        vertexai: true,
        project: clientOptions.projectId,
        location: clientOptions.location,
        apiVersion: clientOptions.apiVersion,
        httpOptions: {
          timeout: 60000,
        },
      }

      if (clientOptions.keyFile || clientOptions.credentials) {
        vertexOptions.googleAuthOptions = {
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          ...(typeof clientOptions.keyFile === 'string'
            ? { keyFilename: clientOptions.keyFile }
            : {}),
          ...(typeof clientOptions.credentials === 'string'
            ? { credentials: JSON.parse(clientOptions.credentials) }
            : {}),
        }
      }

      if (typeof clientOptions.apiEndpoint === 'string') {
        vertexOptions.httpOptions = {
          ...vertexOptions.httpOptions,
          baseUrl: clientOptions.apiEndpoint,
        }
      }

      this.client = new GoogleGenAI(vertexOptions)

      this.generativeModel = null

      return true
    } catch (error) {
      console.error('Failed to initialize Vertex AI client:', error)
      this.client = null
      this.generativeModel = null
      return false
    }
  }

  getModelInstance(modelName, options: Record<string, any> = {}) {
    // Create a cache key based on model name and options
    const cacheKey = `${modelName}-${JSON.stringify(options)}`

    // Check if we already have this model instance cached
    if (modelCache.has(cacheKey)) {
      return modelCache.get(cacheKey)
    }

    // Default generation config
    const generationConfig: GenerateContentConfig = {
      temperature: options.temperature || this.config.VERTEX_TEMPERATURE || 0.7,
      topP: options.top_p || this.config.VERTEX_TOP_P || 0.95,
      topK: options.top_k || this.config.VERTEX_TOP_K || 40,
      maxOutputTokens: options.max_tokens || this.config.VERTEX_MAX_TOKENS || 8192,
    }

    // Add stop sequences if provided
    if (options.stop && options.stop.length > 0) {
      generationConfig.stopSequences = options.stop
    }

    const modelInstance = {
      model: modelName,
      config: {
        ...generationConfig,
        safetySettings: this.getSafetySettings(),
      },
    }

    // Cache the model instance with size limit
    addToModelCache(cacheKey, modelInstance)

    return modelInstance
  }

  getSafetySettings() {
    // Configure safety settings based on environment variables or defaults
    const safetySettings = [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: this.config.VERTEX_SAFETY_HATE_SPEECH || 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: this.config.VERTEX_SAFETY_DANGEROUS || 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: this.config.VERTEX_SAFETY_SEXUALLY_EXPLICIT || 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: this.config.VERTEX_SAFETY_HARASSMENT || 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ]

    return safetySettings
  }

  getName() {
    return 'vertex'
  }

  isAvailable() {
    // Check if we have the required configuration for Vertex AI
    return !!(
      this.config.VERTEX_PROJECT_ID &&
      (this.config.VERTEX_KEY_FILE ||
        this.config.VERTEX_CREDENTIALS ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS)
    )
  }

  async generateCompletion(messages, options: Record<string, any> = {}) {
    if (!this.isAvailable()) {
      return this.handleProviderError(
        new Error('Vertex AI provider is not configured'),
        'generate_completion'
      )
    }

    // Initialize client if not already done
    if (!this.client) {
      await this.initializeClient()
      if (!this.client) {
        return this.handleProviderError(
          new Error('Failed to initialize Vertex AI client'),
          'generate_completion'
        )
      }
    }

    const modelConfig = this.getProviderModelConfig()
    const modelName = options.model || modelConfig.standardModel

    try {
      // Get or create model request with the specified options
      const modelRequest = this.getModelInstance(modelName, options)

      // Convert messages to Vertex AI format
      const formattedMessages = await this.formatMessages(messages)

      // Add function calling if provided and the model supports it
      let tools: { functionDeclarations: any[] } | null = null
      if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
        const capabilities = this.getCapabilities(modelName)
        if (capabilities.function_calling) {
          tools = this.formatTools(options.tools)
        }
      }

      // Handle streaming if requested
      if (options.stream && typeof options.onUpdate === 'function') {
        const streamResult = await this.client.models.generateContentStream({
          model: modelRequest.model,
          contents: formattedMessages,
          config: {
            ...modelRequest.config,
            ...(tools ? { tools } : {}),
          },
        })

        let fullContent = ''
        for await (const chunk of streamResult) {
          const chunkContent = chunk.text || ''
          fullContent += chunkContent
          options.onUpdate({
            content: chunkContent,
            done: false,
          })
        }

        // Signal completion
        options.onUpdate({
          content: '',
          done: true,
        })

        // Return the full result
        return {
          content: fullContent,
          model: modelName,
        }
      }
      // Non-streaming request
      const response = await this.client.models.generateContent({
        model: modelRequest.model,
        contents: formattedMessages,
        config: {
          ...modelRequest.config,
          ...(tools ? { tools } : {}),
        },
      })

      const responseText = response.text || ''

      // Handle function calls if present
      let functionCalls = null
      if (response.functionCalls && response.functionCalls.length > 0) {
        functionCalls = response.functionCalls.map((call) => ({
          name: call.name,
          arguments: call.args ?? {},
        }))
      }

      return {
        content: responseText,
        model: modelName,
        function_call: functionCalls ? functionCalls[0] : undefined,
        function_calls: functionCalls,
      }
    } catch (error) {
      // Handle rate limiting with exponential backoff
      if (
        error.message &&
        (error.message.includes('quota') ||
          error.message.includes('rate') ||
          error.message.includes('limit'))
      ) {
        const retryCount = options.retryCount || 0
        if (retryCount < 3) {
          const delay = 2 ** retryCount * 1000 // Exponential backoff: 1s, 2s, 4s
          console.warn(`Rate limit hit, retrying in ${delay}ms...`)

          return new Promise((resolve) => {
            setTimeout(async () => {
              const retryOptions = { ...options, retryCount: retryCount + 1 }
              const result = await this.generateCompletion(messages, retryOptions)
              resolve(result)
            }, delay)
          })
        }
      }

      // If model not found, try with a fallback model
      if (
        error.message &&
        (error.message.includes('not found') || error.message.includes('invalid model'))
      ) {
        const fallbackModels = this.getSuggestedModels(modelName)
        if (fallbackModels.length > 0 && !options.triedFallback) {
          console.warn(`Model ${modelName} not found, trying fallback model: ${fallbackModels[0]}`)
          return this.generateCompletion(messages, {
            ...options,
            model: fallbackModels[0],
            triedFallback: true,
          })
        }
      }

      return this.handleProviderError(error, 'generate_completion', { model: options.model })
    }
  }

  async formatMessages(messages) {
    // Convert messages to Vertex AI format for the new SDK
    const formattedMessages: any[] = []

    for (const message of messages) {
      const role = message.role === 'assistant' ? 'model' : message.role

      // Handle different content formats
      const parts: any[] = []

      // If content is a string, convert to text part
      if (typeof message.content === 'string') {
        parts.push({ text: message.content })
      }
      // If content is an array (multimodal), convert each part
      else if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'text') {
            parts.push({ text: part.text })
          } else if (part.type === 'image_url') {
            // Handle inline image data
            if (part.image_url.url.startsWith('data:image/')) {
              const imageData = await this.getImageData(part.image_url.url)
              parts.push({ inlineData: { data: imageData, mimeType: 'image/jpeg' } })
            }
            // Handle remote image URL - for remote URLs, we now fetch and convert
            else {
              try {
                const imageData = await this.getImageData(part.image_url.url)
                parts.push({ inlineData: { data: imageData, mimeType: 'image/jpeg' } })
              } catch {
                // Fallback to fileData if remote fetch fails
                parts.push({ fileData: { mimeType: 'image/jpeg', fileUri: part.image_url.url } })
              }
            }
          }
        }
      }

      formattedMessages.push({
        role,
        parts,
      })
    }

    return formattedMessages
  }

  async getImageData(imageUrl) {
    // For base64 data URLs
    if (imageUrl.startsWith('data:')) {
      return imageUrl.split(',')[1]
    }

    // For regular URLs, fetch the image and convert to base64
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      return buffer.toString('base64')
    } catch (error) {
      throw new Error(`Remote image fetching failed: ${error.message}`, { cause: error })
    }
  }

  formatTools(tools) {
    const functionDeclarations: any[] = []

    for (const tool of tools) {
      if (tool.type === 'function' && tool.function) {
        functionDeclarations.push({
          name: tool.function.name,
          description: tool.function.description || '',
          parameters: tool.function.parameters || {},
        })
      }
    }

    return { functionDeclarations }
  }

  estimateTokenCount(text) {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  // Vertex AI-specific helper methods
  getRetryDelay(attempt) {
    return 2 ** attempt * 1000 // Exponential backoff
  }

  // Vertex AI-specific method for testing model availability
  async testModel(modelName) {
    try {
      const modelRequest = this.getModelInstance(modelName, { max_tokens: 10 })

      await this.client.models.generateContent({
        model: modelRequest.model,
        contents: [{ role: 'user', parts: [{ text: 'Test' }] }],
        config: {
          ...modelRequest.config,
          maxOutputTokens: 10,
          temperature: 0,
        },
      })

      return {
        success: true,
        model: modelName,
        project: this.config.VERTEX_PROJECT_ID,
        location: this.config.VERTEX_LOCATION || 'us-central1',
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        model: modelName,
      }
    }
  }

  getAvailableModels() {
    return [
      {
        id: 'gemini-2.5-exp',
        name: 'Gemini 2.5 Experimental',
        contextWindow: 1048576,
        maxOutput: 8192,
        inputCost: 0.00000125,
        outputCost: 0.000005,
        features: ['text', 'vision', 'tools', 'reasoning'],
        description: 'Latest Gemini model via Vertex AI',
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2097152,
        maxOutput: 8192,
        inputCost: 0.00000125,
        outputCost: 0.000005,
        features: ['text', 'vision', 'tools'],
        description: 'Previous generation - consider upgrading to Gemini 3 or 2.5',
        deprecated: true,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1048576,
        maxOutput: 8192,
        inputCost: 0.00000075,
        outputCost: 0.000003,
        features: ['text', 'vision', 'tools'],
        description: 'Previous generation - consider upgrading to Gemini 3 or 2.5',
        deprecated: true,
      },
    ]
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins(VertexAIProvider, 'vertex')
