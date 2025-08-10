import { OpenAI } from 'openai'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins } from '../utils/base-provider-helpers.js'
import { buildClientOptions } from '../utils/provider-utils.js'

class LMStudioProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.client = null
    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  initializeClient() {
    const clientOptions = buildClientOptions(this.getProviderConfig(), {
      baseURL: 'http://localhost:1234/v1',
      apiKey: 'lm-studio', // Not required by LM Studio
      timeout: 120000,
      maxRetries: 2,
    })

    // LM Studio uses OpenAI-compatible API
    this.client = new OpenAI({
      baseURL: clientOptions.baseURL,
      apiKey: clientOptions.apiKey,
      timeout: clientOptions.timeout,
      maxRetries: clientOptions.maxRetries,
    })
  }

  getName() {
    return 'lmstudio'
  }

  isAvailable() {
    return !!this.config.LMSTUDIO_API_BASE
  }

  async generateCompletion(messages, options) {
    if (!this.isAvailable()) {
      return this.handleProviderError(
        new Error('LM Studio provider is not configured'),
        'generate_completion'
      )
    }

    // Prepare parameters for the API call
    const params = {
      model:
        options.model ||
        this.config.AI_MODEL ||
        this.config.LMSTUDIO_MODEL ||
        this.config.LMSTUDIO_DEFAULT_MODEL ||
        'local-model',
      messages,
      max_tokens: options.max_tokens || 2048,
      temperature: options.temperature || 0.7,
      top_p: options.top_p || 0.95,
      frequency_penalty: options.frequency_penalty || 0,
      presence_penalty: options.presence_penalty || 0,
      user: options.user || this.config.LMSTUDIO_USER_ID,
    }

    // Add function calling if provided and the model supports it
    if (options.tools && this.getCapabilities(params.model).tool_use) {
      params.tools = options.tools
      params.tool_choice = options.tool_choice || 'auto'
    }

    // Add JSON mode if requested and the model supports it
    if (
      options.response_format?.type === 'json_object' &&
      this.getCapabilities(params.model).json_mode
    ) {
      params.response_format = { type: 'json_object' }
    }

    // Handle streaming
    if (options.stream) {
      params.stream = true
      const stream = await this.client.chat.completions.create(params)
      return { stream, model: params.model }
    }

    // Make the non-streaming API call
    const response = await this.client.chat.completions.create(params)

    // Extract tool calls if present
    let toolCalls = null
    if (response.choices[0]?.message?.tool_calls?.length > 0) {
      toolCalls = response.choices[0].message.tool_calls
    }

    return {
      content: response.choices[0].message.content,
      model: response.model,
      tokens: response.usage?.total_tokens || 0,
      finish_reason: response.choices[0].finish_reason,
      tool_calls: toolCalls,
    }
  }

  getCapabilities(modelName) {
    const model =
      modelName ||
      this.config.AI_MODEL ||
      this.config.LMSTUDIO_MODEL ||
      this.config.LMSTUDIO_DEFAULT_MODEL ||
      'local-model'

    // Base capabilities - all models are local
    const capabilities = {
      vision: false,
      tool_use: false,
      json_mode: false,
      reasoning: false,
      local: true,
    }

    // Capabilities depend on the specific model loaded in LM Studio
    // These are general capabilities based on model family naming conventions

    // Llama models
    if (model.toLowerCase().includes('llama')) {
      capabilities.json_mode = true

      // Llama 3 models likely support function calling
      if (model.includes('3')) {
        capabilities.tool_use = true
      }
    }

    // Mistral models
    else if (model.toLowerCase().includes('mistral')) {
      capabilities.json_mode = true

      // Mixtral models likely have better reasoning
      if (model.toLowerCase().includes('mixtral')) {
        capabilities.reasoning = true
      }
    }

    // Vision models
    if (
      model.toLowerCase().includes('vision') ||
      model.toLowerCase().includes('llava') ||
      model.toLowerCase().includes('bakllava')
    ) {
      capabilities.vision = true
    }

    return capabilities
  }

  getAvailableModels() {
    return [
      {
        id: 'local-model',
        name: 'Local Model (LM Studio)',
        contextWindow: 4096,
        maxOutput: 2048,
        inputCost: 0, // Local models are free
        outputCost: 0,
        features: ['text', 'local'],
        description: 'Local model running in LM Studio',
      },
      {
        id: 'llama-3-8b-instruct',
        name: 'Llama 3 8B Instruct',
        contextWindow: 8192,
        maxOutput: 4096,
        inputCost: 0,
        outputCost: 0,
        features: ['text', 'tools', 'local'],
        description: 'Local Llama 3 8B instruction-tuned model',
      },
      {
        id: 'mistral-7b-instruct',
        name: 'Mistral 7B Instruct',
        contextWindow: 8192,
        maxOutput: 4096,
        inputCost: 0,
        outputCost: 0,
        features: ['text', 'reasoning', 'local'],
        description: 'Local Mistral 7B instruction-tuned model',
      },
      {
        id: 'llava-1.5-7b',
        name: 'LLaVA 1.5 7B',
        contextWindow: 4096,
        maxOutput: 2048,
        inputCost: 0,
        outputCost: 0,
        features: ['text', 'vision', 'local'],
        description: 'Local vision-language model',
      },
    ]
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins(LMStudioProvider, 'lmstudio')
