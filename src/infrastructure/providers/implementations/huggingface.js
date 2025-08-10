/**
 * Hugging Face Provider for AI Changelog Generator
 * Uses @huggingface/inference v4.5.3 (2025 features)
 * Supports multi-provider routing, chat completion, and latest models
 */

import { InferenceClient } from '@huggingface/inference'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins } from '../utils/base-provider-helpers.js'
import { buildClientOptions } from '../utils/provider-utils.js'

class HuggingFaceProvider extends BaseProvider {
  constructor(config) {
    super(config)
    this.client = null

    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  initializeClient() {
    const clientOptions = buildClientOptions(this.getProviderConfig(), {
      timeout: 60000,
    })

    this.client = new InferenceClient({
      token: clientOptions.apiKey,
      endpointUrl: clientOptions.endpointUrl,
      timeout: clientOptions.timeout,
    })
  }

  getName() {
    return 'huggingface'
  }

  isAvailable() {
    return !!this.config.HUGGINGFACE_API_KEY
  }

  async generateCompletion(messages, options = {}) {
    if (!this.isAvailable()) {
      return this.handleProviderError(
        new Error('Hugging Face provider is not configured'),
        'generate_completion'
      )
    }

    try {
      const modelConfig = this.getProviderModelConfig()
      const modelId = options.model || modelConfig.standardModel
      const provider = options.provider || 'auto'

      const params = {
        model: modelId,
        messages: this.formatMessages(messages),
        max_tokens: options.max_tokens || 1000,
        temperature: options.temperature || 0.3,
        top_p: options.top_p || 0.95,
        stream: false,
      }

      if (provider && provider !== 'auto') {
        params.provider = provider
      }

      if (options.tools && this.getCapabilities(modelId).function_calling) {
        params.tools = this.formatTools(options.tools)
        params.tool_choice = options.tool_choice || 'auto'
      }

      if (options.stream && typeof options.onStreamData === 'function') {
        params.stream = true

        let fullContent = ''
        const stream = this.client.chatCompletionStream(params)

        for await (const chunk of stream) {
          const chunkContent = chunk.choices[0]?.delta?.content || ''
          if (chunkContent) {
            fullContent += chunkContent
            options.onStreamData({
              content: chunkContent,
              model: modelId,
              finish_reason: null,
              done: false,
            })
          }

          if (chunk.choices[0]?.finish_reason) {
            options.onStreamData({
              content: '',
              model: modelId,
              finish_reason: chunk.choices[0].finish_reason,
              done: true,
            })
            break
          }
        }

        return {
          content: fullContent,
          model: modelId,
          tokens: this.estimateTokenCount(fullContent),
          finish_reason: 'stop',
        }
      }

      const response = await this.client.chatCompletion(params)

      const choice = response.choices[0]
      const content = choice.message.content

      const toolCalls = choice.message.tool_calls
        ? choice.message.tool_calls.map((call) => ({
            id: call.id,
            type: call.type,
            function: {
              name: call.function.name,
              arguments: call.function.arguments,
            },
          }))
        : undefined

      return {
        content,
        model: response.model || modelId,
        tokens: response.usage?.total_tokens || this.estimateTokenCount(content),
        finish_reason: choice.finish_reason || 'stop',
        tool_calls: toolCalls,
      }
    } catch (error) {
      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        console.warn('Hugging Face rate limit hit, implementing backoff...')
        await this.sleep(2000)
      }

      return this.handleProviderError(error, 'generate_completion', { model: options.model })
    }
  }

  // HuggingFace-specific helper methods
  formatMessages(messages) {
    return messages.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system', content: msg.content }
      }
      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }
    })
  }

  formatTools(tools) {
    return tools.map((tool) => {
      if (tool.type === 'function') {
        return {
          type: 'function',
          function: {
            name: tool.function.name,
            description: tool.function.description || '',
            parameters: tool.function.parameters || {},
          },
        }
      }
      return tool
    })
  }

  estimateTokenCount(text) {
    return Math.ceil(text.length / 4)
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  getAvailableModels() {
    return [
      // Latest 2025 models from your standards document
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'Qwen 2.5 72B Instruct',
        contextWindow: 32768,
        maxOutput: 8192,
        inputCost: 0.000003,
        outputCost: 0.000009,
        features: ['text', 'tools', 'multilingual'],
        description: 'Latest Qwen model with enhanced capabilities',
        provider: 'auto',
      },
      {
        id: 'meta-llama/Llama-3.3-70B-Instruct',
        name: 'Llama 3.3 70B Instruct',
        contextWindow: 128000,
        maxOutput: 8192,
        inputCost: 0.000002,
        outputCost: 0.000006,
        features: ['text', 'tools', 'reasoning'],
        description: 'Latest Llama 3.3 with improved reasoning',
        provider: 'together',
      },
      {
        id: 'meta-llama/Llama-3.1-405B-Instruct',
        name: 'Llama 3.1 405B Instruct',
        contextWindow: 32768,
        maxOutput: 4096,
        inputCost: 0.000005,
        outputCost: 0.000015,
        features: ['text', 'tools', 'reasoning'],
        description: 'Most capable Llama model from Meta AI',
        provider: 'replicate',
      },
      {
        id: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
        name: 'Mixtral 8x22B Instruct',
        contextWindow: 65536,
        maxOutput: 4096,
        inputCost: 0.0000009,
        outputCost: 0.0000027,
        features: ['text', 'tools', 'multilingual'],
        description: 'Large mixture of experts model from Mistral',
        provider: 'together',
      },
      {
        id: 'microsoft/WizardLM-2-8x22B',
        name: 'WizardLM 2 8x22B',
        contextWindow: 32768,
        maxOutput: 4096,
        inputCost: 0.000001,
        outputCost: 0.000003,
        features: ['text', 'reasoning', 'complex_tasks'],
        description: 'Advanced reasoning model from Microsoft',
        provider: 'sambanova',
      },
      {
        id: 'black-forest-labs/FLUX.1-dev',
        name: 'FLUX.1 Dev',
        contextWindow: 0,
        maxOutput: 0,
        inputCost: 0.00005,
        outputCost: 0.00005,
        features: ['text_to_image', 'high_quality'],
        description: 'State-of-the-art text-to-image generation',
        provider: 'replicate',
      },
    ]
  }

  getDefaultModel() {
    return 'Qwen/Qwen2.5-72B-Instruct'
  }

  getRequiredEnvVars() {
    return ['HUGGINGFACE_API_KEY']
  }

  getProviderModelConfig() {
    return {
      smallModel: 'meta-llama/Llama-3.1-8B-Instruct',
      mediumModel: 'meta-llama/Llama-3.3-70B-Instruct',
      standardModel: 'Qwen/Qwen2.5-72B-Instruct',
      complexModel: 'meta-llama/Llama-3.1-405B-Instruct',
      reasoningModel: 'microsoft/WizardLM-2-8x22B',
      multilingualModel: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
      default: 'Qwen/Qwen2.5-72B-Instruct',
      temperature: 0.3,
      maxTokens: 1000,
    }
  }

  getModelCapabilities(modelName) {
    return {
      reasoning:
        modelName.includes('Llama-3') ||
        modelName.includes('WizardLM') ||
        modelName.includes('Qwen'),
      function_calling: modelName.includes('Instruct') && !modelName.includes('FLUX'),
      json_mode: true,
      multimodal: modelName.includes('FLUX'),
      largeContext:
        modelName.includes('Llama-3.3') ||
        modelName.includes('Mixtral') ||
        modelName.includes('Qwen'),
      multilingual: modelName.includes('Qwen') || modelName.includes('Mixtral'),
      multiProvider: true,
      imageGeneration: modelName.includes('FLUX'),
    }
  }

  getCapabilities(modelName) {
    return {
      completion: true,
      streaming: true,
      function_calling: modelName ? this.getModelCapabilities(modelName).function_calling : true,
      json_mode: true,
      reasoning: modelName ? this.getModelCapabilities(modelName).reasoning : true,
      multimodal: modelName ? this.getModelCapabilities(modelName).multimodal : false,
      multiProvider: true,
    }
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins(HuggingFaceProvider, 'huggingface')
