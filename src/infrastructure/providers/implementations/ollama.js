import process from 'node:process'

import { Ollama } from 'ollama'

import { ProviderError } from '../../../shared/utils/utils.js'
import { BaseProvider } from '../core/base-provider.js'
import { applyMixins } from '../utils/base-provider-helpers.js'
import { buildClientOptions } from '../utils/provider-utils.js'

class OllamaProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.client = null
    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  initializeClient() {
    const clientOptions = buildClientOptions(this.getProviderConfig(), {
      host: 'http://localhost:11434',
    })

    this.client = new Ollama({
      host: clientOptions.host,
    })
  }

  getName() {
    return 'ollama'
  }

  isAvailable() {
    return !!this.config.OLLAMA_HOST
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
}

// Apply mixins to add standard provider functionality
export default applyMixins(OllamaProvider, 'ollama')
