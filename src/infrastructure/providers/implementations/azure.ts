/**
 * Azure OpenAI Provider for AI Changelog Generator
 *
 * Uses the OpenAI SDK against Azure's `/openai/v1/` endpoint.
 * Supported authentication methods:
 * - API key via `OPENAI_API_KEY` or `AZURE_OPENAI_KEY`
 * - OAuth token via `AZURE_OAUTH_TOKEN`
 * - Microsoft Entra ID via `AZURE_USE_AD_AUTH=true`
 *
 * Required configuration:
 * - `OPENAI_BASE_URL`, or
 * - `AZURE_OPENAI_ENDPOINT` (normalized to `/openai/v1/`)
 *
 * The `model` parameter must always be the Azure deployment name.
 */

import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity'
import { OpenAI } from 'openai'

import { BaseProvider } from '../core/base-provider.js'
import { applyMixins, ProviderResponseHandler } from '../utils/base-provider-helpers.js'
import { getProviderModelConfig } from '../utils/model-config.js'

interface AzureCompletionParams {
  model: string
  messages: any[]
  max_tokens: number
  temperature: number
  user?: string
  tools?: any[]
  tool_choice?: string
  data_sources?: any
  stream?: boolean
}

const AzureAuthType = {
  API_KEY: 'api_key',
  OAUTH_TOKEN: 'oauth_token',
  AZURE_AD: 'azure_ad',
}

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

class AzureOpenAIProvider extends BaseProvider {
  [key: string]: any

  constructor(config) {
    super(config)
    this.azureClient = null
    this._cachedDeployments = null
    this._deploymentsCacheTime = 0
    this._authType = null
    this._baseUrl = this.resolveBaseUrl()

    if (this.isAvailable()) {
      try {
        this.initializeClient()
      } catch (error) {
        console.warn(`Azure provider initialization warning: ${error.message}`)
      }
    }
  }

  resolveBaseUrl() {
    return normalizeAzureOpenAIBaseUrl(
      this.config.OPENAI_BASE_URL || this.config.AZURE_OPENAI_ENDPOINT
    )
  }

  getAuthType() {
    return this._authType
  }

  getAuthInfo() {
    return {
      type: this._authType,
      endpoint: this._baseUrl,
      valid: this.isAvailable(),
    }
  }

  setOAuthToken(token) {
    this.config.AZURE_OAUTH_TOKEN = token
    this._cachedDeployments = null
    this.initializeClient()
  }

  initializeClient() {
    this._baseUrl = this.resolveBaseUrl()

    if (!this._baseUrl) {
      throw new Error(
        'Azure OpenAI is not configured. Set OPENAI_BASE_URL or AZURE_OPENAI_ENDPOINT.'
      )
    }

    if (this.config.AZURE_USE_AD_AUTH === 'true') {
      const azureADTokenProvider = getBearerTokenProvider(
        new DefaultAzureCredential(),
        'https://ai.azure.com/.default'
      )

      this.azureClient = new OpenAI({
        baseURL: this._baseUrl,
        apiKey: azureADTokenProvider,
        timeout: 30000,
        maxRetries: 2,
      })
      this._authType = AzureAuthType.AZURE_AD
      return
    }

    if (this.config.AZURE_OAUTH_TOKEN) {
      this.azureClient = new OpenAI({
        baseURL: this._baseUrl,
        apiKey: this.config.AZURE_OAUTH_TOKEN,
        timeout: 30000,
        maxRetries: 2,
      })
      this._authType = AzureAuthType.OAUTH_TOKEN
      return
    }

    const apiKey = this.config.OPENAI_API_KEY || this.config.AZURE_OPENAI_KEY
    if (!apiKey) {
      throw new Error('Azure OpenAI is not configured. Set AZURE_OPENAI_KEY or OPENAI_API_KEY.')
    }

    this.azureClient = new OpenAI({
      baseURL: this._baseUrl,
      apiKey,
      timeout: 30000,
      maxRetries: 2,
    })
    this._authType = AzureAuthType.API_KEY
  }

  getName() {
    return 'azure'
  }

  isAvailable() {
    const baseUrl = this.resolveBaseUrl()
    if (!baseUrl) {
      return false
    }

    return !!(
      this.config.OPENAI_API_KEY ||
      this.config.AZURE_OPENAI_KEY ||
      this.config.AZURE_OAUTH_TOKEN ||
      this.config.AZURE_USE_AD_AUTH === 'true'
    )
  }

  async generateCompletion(messages, options: Record<string, any> = {}) {
    return ProviderResponseHandler.executeWithErrorHandling(
      this,
      'generate_completion',
      async () => {
        if (!this.azureClient) {
          this.initializeClient()
        }

        const modelConfig = this.getProviderModelConfig()
        const deploymentName =
          options.model || this.config.AZURE_OPENAI_DEPLOYMENT_NAME || modelConfig.standardModel

        if (!deploymentName) {
          throw new Error(
            'Azure deployment name is not configured. Set AZURE_OPENAI_DEPLOYMENT_NAME or pass a deployment name in options.model.'
          )
        }

        const params: AzureCompletionParams = {
          model: deploymentName,
          messages,
          max_tokens: options.max_tokens || 2000,
          temperature: options.temperature || 0.3,
          user: options.user || this.config.AZURE_USER_ID,
        }

        if (options.tools) {
          params.tools = options.tools
          params.tool_choice = options.tool_choice || 'auto'
        }

        if (options.dataSources) {
          params.data_sources = options.dataSources
        }

        if (options.stream) {
          params.stream = true
          const stream = await this.azureClient.chat.completions.create(params)
          return { stream, model: deploymentName }
        }

        const completion = await Promise.race([
          this.azureClient.chat.completions.create(params),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout after 25 seconds')), 25000)
          ),
        ])

        if (!(completion.choices?.length > 0 && completion.choices[0]?.message?.content)) {
          const finishReason = completion.choices?.[0]?.finish_reason
          const errorMessage =
            finishReason === 'length'
              ? `Response truncated due to token limit (max_tokens: ${params.max_tokens}). Consider increasing max_tokens or reducing prompt size.`
              : 'Empty response from Azure API'
          throw new Error(errorMessage)
        }

        const content = completion.choices[0].message.content
        const finishReason = completion.choices[0].finish_reason

        if (finishReason === 'length') {
          console.warn(
            `Azure response truncated due to token limit (${params.max_tokens}). Response may be incomplete.`
          )
        }

        return {
          content,
          model: completion.model,
          tokens: completion.usage?.total_tokens,
          usage: completion.usage,
          finish_reason: finishReason,
          tool_calls: completion.choices[0].message.tool_calls,
          content_filters: completion.choices[0].content_filter_results || null,
        }
      },
      { model: options.model }
    )
  }

  getDeploymentName() {
    const modelConfig = this.getProviderModelConfig()
    return this.config.AZURE_OPENAI_DEPLOYMENT_NAME || modelConfig.standardModel
  }

  async testDeployment(deploymentName) {
    try {
      if (!this.azureClient) {
        this.initializeClient()
      }

      const response = await this.azureClient.chat.completions.create({
        model: deploymentName,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
      })

      return {
        success: true,
        deployment: deploymentName,
        model: response.model,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        deployment: deploymentName,
      }
    }
  }

  async getAvailableModels() {
    if (!this.isAvailable()) {
      return []
    }

    if (this._cachedDeployments && Date.now() - this._deploymentsCacheTime < 300000) {
      return this._cachedDeployments
    }

    const modelConfig = getProviderModelConfig('azure', this.config)
    const potentialDeployments = [
      this.config.AZURE_OPENAI_DEPLOYMENT_NAME,
      modelConfig.complexModel,
      modelConfig.standardModel,
      modelConfig.mediumModel,
      modelConfig.smallModel,
      ...modelConfig.fallbacks,
    ]
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)

    const availableDeployments: any[] = []

    const testPromises = potentialDeployments.slice(0, 8).map(async (deployment) => {
      const result = await this.testDeployment(deployment)
      if (result.success) {
        availableDeployments.push(deployment)
      }
      return result
    })

    try {
      await Promise.allSettled(testPromises)
      this._cachedDeployments = availableDeployments
      this._deploymentsCacheTime = Date.now()

      if (availableDeployments.length === 0) {
        const fallback = this.config.AZURE_OPENAI_DEPLOYMENT_NAME || modelConfig.standardModel
        if (fallback) {
          return [fallback]
        }
      }

      return availableDeployments
    } catch (error) {
      console.warn('Failed to detect Azure deployments:', error.message)
      return modelConfig.fallbacks
    }
  }

  async refreshAvailableModels() {
    this._cachedDeployments = null
    this._deploymentsCacheTime = 0
    return await this.getAvailableModels()
  }
}

export default applyMixins(AzureOpenAIProvider, 'azure')
