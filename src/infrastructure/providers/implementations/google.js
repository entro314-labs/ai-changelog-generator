/**
 * Google AI Provider for AI Changelog Generator
 * Uses Google Generative AI SDK v0.3.2 (July 2025)
 * Supports Gemini 2.5, 2.0 and 1.5 models
 */

import { GoogleGenAI } from '@google/genai';
import { BaseProvider } from '../core/base-provider.js';
import { ProviderError } from '../../../shared/utils/consolidated-utils.js';
import { applyMixins } from '../utils/base-provider-helpers.js';
import { buildClientOptions } from '../utils/provider-utils.js';

class GoogleProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.genAI = null;
    this.modelCache = new Map();
    this.maxCacheSize = 50; // Limit cache size to prevent memory leaks
    
    if (this.isAvailable()) {
      this.initializeClient();
    }
  }

  initializeClient() {
    const clientOptions = buildClientOptions(this.getProviderConfig(), {
      apiVersion: 'v1',
      timeout: 60000,
      maxRetries: 2
    });
    
    this.genAI = new GoogleGenAI({
      apiKey: clientOptions.apiKey,
      apiVersion: clientOptions.apiVersion,
      apiEndpoint: clientOptions.apiEndpoint,
      timeout: clientOptions.timeout,
      retry: clientOptions.maxRetries ? {
        retries: clientOptions.maxRetries,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 60000
      } : undefined
    });
  }

  getName() {
    return 'google';
  }

  isAvailable() {
    return !!this.config.GOOGLE_API_KEY;
  }

  async generateCompletion(messages, options = {}) {
    if (!this.isAvailable()) {
      return this.handleProviderError(
        new Error('Google provider is not configured'), 
        'generate_completion'
      );
    }

    try {
      const modelConfig = this.getProviderModelConfig();
      const modelName = options.model || modelConfig.standardModel;
      
      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      
      // Separate system instruction from chat history
      const history = messages
        .filter(m => m.role !== 'system')
        .map(m => {
          const role = m.role === 'assistant' ? 'model' : 'user';
          if (typeof m.content === 'string') {
            return { role, parts: [{ text: m.content }] };
          }
          if (Array.isArray(m.content)) {
            const parts = m.content.map(part => {
              if (typeof part === 'string') {
                return { text: part };
              } else if (part.type === 'image_url') {
                return {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: part.image_url.url.startsWith('data:image/') 
                      ? part.image_url.url.split(',')[1]
                      : Buffer.from(part.image_url.url).toString('base64')
                  }
                };
              }
              return { text: JSON.stringify(part) };
            });
            return { role, parts };
          }
          return { role, parts: [{ text: JSON.stringify(m.content) }] };
        });

      const generationConfig = {
        temperature: options.temperature || 0.4,
        maxOutputTokens: options.max_tokens || 8192,
        topP: options.top_p || 0.95,
        topK: options.top_k || 64,
        candidateCount: options.n || 1,
        stopSequences: options.stop || [],
        responseMimeType: options.response_format?.type === 'json_object' ? 'application/json' : undefined
      };

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
        }
      ];

      const modelOptions = {
        model: modelName,
        generationConfig,
        safetySettings
      };

      if (systemInstruction) {
        modelOptions.systemInstruction = systemInstruction;
      }

      if (options.tools && options.tools.length > 0) {
        try {
          const tools = options.tools.map(tool => ({
            functionDeclarations: [{
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters
            }]
          }));
          
          const model = this.genAI.models.getModel(modelName);
          const chat = model.startChat({
            tools,
            history: history.slice(0, -1),
            systemInstruction: systemInstruction ? { text: systemInstruction } : undefined
          });
          
          const lastMessage = history[history.length - 1];
          const result = await chat.sendMessage(lastMessage.parts);
          const response = result.response;
          
          const functionCalls = response.functionCalls();
          
          return {
            content: response.text(),
            model: modelName,
            tool_calls: functionCalls.length > 0 ? functionCalls.map(call => ({
              id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              type: 'function',
              function: {
                name: call.name,
                arguments: call.args ? JSON.stringify(call.args) : '{}'
              }
            })) : undefined,
            tokens: response.usageMetadata?.totalTokenCount || 0,
            finish_reason: functionCalls.length > 0 ? 'tool_calls' : 'stop'
          };
        } catch (error) {
          console.error('Error in tool calling:', error);
          return this.handleProviderError(error, 'generate_completion', { model: options.model });
        }
      }

      // Standard completion without tools
      const model = this.genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig,
        safetySettings,
        systemInstruction: systemInstruction ? { text: systemInstruction } : undefined
      });

      const result = await model.generateContent({
        contents: history
      });

      const response = await result.response;
      
      return {
        content: response.text(),
        model: modelName,
        tokens: response.usageMetadata?.totalTokenCount || 0,
        finish_reason: response.candidates?.[0]?.finishReason || 'stop'
      };
    } catch (error) {
      // Handle rate limits and retries
      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        const retryDelay = this.getRetryDelay();
        console.warn(`Rate limit hit, retrying in ${retryDelay}ms...`);
        await this.sleep(retryDelay);
        return this.generateCompletion(messages, options);
      }
      return this.handleProviderError(error, 'generate_completion', { model: options.model });
    }
  }

  // Google-specific helper methods
  getRetryDelay() {
    return Math.random() * 5000 + 1000; // Random delay between 1-6 seconds
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getAvailableModels() {
    return [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        contextWindow: 1048576, // 1M tokens
        maxOutput: 8192,
        inputCost: 0.00000075,  // $0.75 per 1M tokens
        outputCost: 0.00000300, // $3.00 per 1M tokens
        features: ['text', 'vision', 'tools', 'multimodal', 'speed'],
        description: 'Fastest Gemini 2.5 model for high-throughput tasks'
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        contextWindow: 2097152, // 2M tokens
        maxOutput: 8192,
        inputCost: 0.00000125,  // $1.25 per 1M tokens
        outputCost: 0.00000500, // $5.00 per 1M tokens
        features: ['text', 'vision', 'tools', 'reasoning', 'thinking'],
        description: 'Most capable Gemini model with thinking mode support'
      },
      {
        id: 'gemini-2.0-flash-001',
        name: 'Gemini 2.0 Flash',
        contextWindow: 1048576, // 1M tokens
        maxOutput: 8192,
        inputCost: 0.00000075,  // $0.75 per 1M tokens
        outputCost: 0.00000300, // $3.00 per 1M tokens
        features: ['text', 'vision', 'tools', 'multimodal', 'functions'],
        description: 'Multimodal capabilities with function calling'
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2097152, // 2M tokens
        maxOutput: 8192,
        inputCost: 0.00000125,  // $1.25 per 1M tokens
        outputCost: 0.00000500, // $5.00 per 1M tokens
        features: ['text', 'vision', 'tools'],
        description: 'High-intelligence model for complex reasoning'
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1048576, // 1M tokens
        maxOutput: 8192,
        inputCost: 0.00000075,  // $0.75 per 1M tokens
        outputCost: 0.00000300, // $3.00 per 1M tokens
        features: ['text', 'vision', 'tools'],
        description: 'Fast and versatile performance across diverse tasks'
      },
      {
        id: 'gemini-1.5-flash-8b',
        name: 'Gemini 1.5 Flash 8B',
        contextWindow: 1048576, // 1M tokens
        maxOutput: 8192,
        inputCost: 0.000000375, // $0.375 per 1M tokens
        outputCost: 0.000000150, // $1.50 per 1M tokens
        features: ['text', 'vision'],
        description: 'High volume and lower intelligence tasks'
      }
    ];
  }

  getDefaultModel() {
    return 'gemini-2.5-flash';
  }

  getRequiredEnvVars() {
    return ['GOOGLE_API_KEY'];
  }

  getProviderModelConfig() {
    return {
      smallModel: 'gemini-1.5-flash-8b',
      mediumModel: 'gemini-2.5-flash',
      standardModel: 'gemini-2.5-flash',
      complexModel: 'gemini-2.5-pro',
      reasoningModel: 'gemini-2.5-pro',
      default: 'gemini-2.5-flash',
      temperature: 0.4,
      maxTokens: 8192
    };
  }

  getModelCapabilities(modelName) {
    return {
      reasoning: modelName.includes('2.5-pro') || modelName.includes('1.5-pro'),
      function_calling: true,
      json_mode: true,
      multimodal: true,
      largeContext: true,
      thinking: modelName.includes('2.5-pro'),
      speed: modelName.includes('flash')
    };
  }
}

// Apply mixins to add standard provider functionality
export default applyMixins(GoogleProvider, 'google');