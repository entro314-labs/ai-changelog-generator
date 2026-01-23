/**
 * Ollama Provider for AI Changelog Generator
 * Supports local models via Ollama (January 2026)
 *
 * Recommended models:
 * - llama4:scout / llama4:maverick - Meta's latest multimodal models
 * - qwen3:235b / qwen3:30b - Alibaba's flagship MoE with thinking mode
 * - deepseek-r1:32b - Advanced reasoning model
 * - qwen2.5-coder:32b - Code-optimized model
 * - llama3.3:70b - Previous gen reliable option
 *
 * Install with: ollama pull <model-name>
 */

import process from 'node:process'

import { Ollama } from 'ollama'

import { ProviderError } from '../../../shared/utils/error-classes.js'
import { BaseProvider } from '../core/base-provider.js'
import { applyMixins } from '../utils/base-provider-helpers.js'

class OllamaProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.client = null
    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  initializeClient() {
    const clientOptions = this.buildClientOptions({
      host: 'http://localhost:11434',
    })

    this.client = new Ollama({
      host: clientOptions.OLLAMA_HOST || clientOptions.host,
    })
  }

  getName() {
    return 'ollama'
  }

  isAvailable() {
    return !!this.config.OLLAMA_HOST
  }

  getRequiredEnvVars() {
    return ['OLLAMA_HOST']
  }

  getDefaultModel() {
    const modelConfig = this.getProviderModelConfig()
    return modelConfig.standardModel
  }

  async generateCompletion(messages, options = {}) {
    if (!this.isAvailable()) {
      return this.handleProviderError(
        new Error('Ollama provider is not configured'),
        'generate_completion'
      )
    }

    try {
      // Test connection first time if not already done
      if (!this._connectionTested) {
        try {
          await this.client.list()
          this._connectionTested = true
        } catch (connectionError) {
          return this.handleProviderError(
            new Error(
              `Ollama server unreachable: ${connectionError.message}. Please run 'ollama serve' first.`
            ),
            'generate_completion'
          )
        }
      }

      const modelConfig = this.getProviderModelConfig()
      const modelName = options.model || modelConfig.standardModel

      const params = {
        model: modelName,
        messages,
        stream: !!options.stream,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          num_predict: options.max_tokens || 1024,
          stop: options.stop || [],
        },
      }

      if (options.tools && this.getCapabilities(modelName).tool_use) {
        params.tools = options.tools
      }

      if (
        options.response_format?.type === 'json_object' &&
        this.getCapabilities(modelName).json_mode
      ) {
        params.format = 'json'
      }

      if (params.stream) {
        const stream = await this.client.chat(params)
        return { stream, model: modelName }
      }

      const response = await this.client.chat(params)
      return {
        content: response.message.content,
        model: response.model,
        tokens: response.eval_count,
        finish_reason: response.done ? 'stop' : 'incomplete',
        tool_calls: response.message.tool_calls,
      }
    } catch (error) {
      return this.handleProviderError(error, 'generate_completion', { model: options.model })
    }
  }

  async generateEmbedding(text, options = {}) {
    if (!this.isAvailable()) {
      throw new ProviderError('Ollama provider is not configured', 'ollama', 'isAvailable')
    }

    const modelName =
      options.model ||
      this.config.OLLAMA_EMBEDDING_MODEL ||
      this.config.AI_MODEL_EMBEDDING ||
      'nomic-embed-text'

    const response = await this.client.embeddings({
      model: modelName,
      prompt: text,
      options: {
        temperature: options.temperature || 0.0,
      },
    })

    return {
      embedding: response.embedding,
      model: modelName,
      tokens: response.token_count || 0,
    }
  }

  // Ollama-specific helper methods
  async getAvailableModels() {
    if (!this.isAvailable()) {
      return []
    }
    try {
      const response = await this.client.list()
      return response.models.map((m) => m.name)
    } catch (error) {
      // Only log connection errors in development mode or when explicitly used
      if (
        !this._connectionErrorLogged &&
        (process.env.NODE_ENV === 'development' || process.env.DEBUG)
      ) {
        console.warn(`⚠️  Ollama connection failed: ${error.message}`)
        console.warn('💡 Make sure Ollama is running: ollama serve')
        this._connectionErrorLogged = true
      }
      return []
    }
  }

  async pullModel(modelName) {
    if (!this.isAvailable()) {
      throw new ProviderError('Ollama provider is not configured', 'ollama', 'isAvailable')
    }

    try {
      const pullStream = await this.client.pull({ model: modelName, stream: true })
      return { stream: pullStream, model: modelName }
    } catch (error) {
      throw new ProviderError(
        `Failed to pull model ${modelName}: ${error.message}`,
        'ollama',
        'pullModel',
        error,
        { modelName }
      )
    }
  }

  getProviderModelConfig() {
    return {
      // Latest recommended models (January 2026)
      complexModel: 'qwen3:235b',
      standardModel: 'llama4:scout',
      mediumModel: 'llama3.3:70b',
      smallModel: 'llama3.2:3b',
      reasoningModel: 'deepseek-r1:32b',
      codingModel: 'qwen2.5-coder:32b',
      default: 'llama4:scout',
      temperature: 0.7,
      maxTokens: 1024,
    }
  }

  getCapabilities(modelName) {
    // Determine capabilities based on model name
    const isQwen3 = modelName && modelName.includes('qwen3')
    const isDeepSeek = modelName && modelName.includes('deepseek')
    const isLlama4 = modelName && modelName.includes('llama4')
    const isCoder = modelName && modelName.includes('coder')

    return {
      completion: true,
      streaming: true,
      // Tool use supported by newer models
      tool_use: isQwen3 || isLlama4 || (modelName && modelName.includes('llama3.3')),
      json_mode: true,
      // Thinking mode for reasoning models
      thinking_mode: isQwen3 || isDeepSeek,
      reasoning: isQwen3 || isDeepSeek || isLlama4,
      // Vision for multimodal models
      vision: isLlama4 || (modelName && modelName.includes('qwen3-vl')),
      coding_optimized: isCoder || isQwen3,
      offline: true,
      privacy_focused: true,
    }
  }

  // Get recommended models for common use cases
  getRecommendedModels() {
    return [
      {
        id: 'llama4:scout',
        name: 'Llama 4 Scout',
        description: "Meta's latest multimodal model - balanced performance",
        useCase: 'general',
        install: 'ollama pull llama4:scout',
      },
      {
        id: 'qwen3:235b',
        name: 'Qwen 3 235B',
        description: "Alibaba's flagship MoE with thinking mode",
        useCase: 'complex_reasoning',
        install: 'ollama pull qwen3:235b',
      },
      {
        id: 'deepseek-r1:32b',
        name: 'DeepSeek R1 32B',
        description: 'Advanced reasoning model - best for reasoning tasks',
        useCase: 'reasoning',
        install: 'ollama pull deepseek-r1:32b',
      },
      {
        id: 'qwen2.5-coder:32b',
        name: 'Qwen 2.5 Coder 32B',
        description: 'Code-optimized model - best for coding tasks',
        useCase: 'coding',
        install: 'ollama pull qwen2.5-coder:32b',
      },
      {
        id: 'llama3.3:70b',
        name: 'Llama 3.3 70B',
        description: 'Previous gen reliable option for general use',
        useCase: 'general',
        install: 'ollama pull llama3.3:70b',
      },
    ]
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins(OllamaProvider, 'ollama')
