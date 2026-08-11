/**
 * Vercel AI Gateway Provider
 *
 * Routes completions through the Vercel AI Gateway using the Vercel AI SDK
 * (`ai` + `@ai-sdk/gateway`) rather than a vendor SDK. One credential reaches
 * every model the gateway fronts, addressed as `<provider>/<model>`.
 *
 * Authentication resolves in the SDK's own order:
 *   1. `AI_GATEWAY_API_KEY`
 *   2. Vercel OIDC (`VERCEL_OIDC_TOKEN`, or the per-request OIDC header when
 *      running on Vercel)
 *
 * BYOK and local providers (OpenAI, Anthropic, Google, Bedrock, Ollama,
 * LM Studio, ...) remain available and unchanged; this is an additional route,
 * not a replacement for them.
 */

import process from 'node:process'

import { createGateway } from '@ai-sdk/gateway'
import { generateText, wrapLanguageModel } from 'ai'

import { ProviderError } from '../../../shared/utils/error-classes.js'
import { BaseProvider } from '../core/base-provider.js'
import { applyMixins } from '../utils/base-provider-helpers.js'
import { classifyAiError } from '../utils/error-classification.js'
import { createModelCacheMiddleware, isModelCacheEnabled } from '../utils/model-cache-middleware.js'

/**
 * Pinned snapshot rather than a floating alias: a changelog is a reproducible
 * artifact, and an upstream snapshot rotation would otherwise silently change
 * generated output with no code change to point at.
 */
export const DEFAULT_GATEWAY_MODEL = 'deepseek/deepseek-v4-flash-0731'

/**
 * Resilient fallback catalogue for when live gateway discovery is unavailable
 * (offline, auth not yet configured, gateway degraded). Discovery is still
 * preferred — this only keeps model pickers and `--list-models` useful instead
 * of collapsing to an empty list.
 */
/**
 * Output budget for gateway calls.
 *
 * The default flash snapshot spends a chunk of its budget before emitting
 * visible text, so a tight cap returns an EMPTY string with finishReason
 * `length` rather than a short answer. Measured against the live gateway: a
 * one-line changelog summary finished cleanly at a 400-token cap using 173
 * tokens, and returned nothing at a 60-token cap. 4000 leaves ample headroom for
 * the multi-entry prompts this package actually sends.
 *
 * Note: explicitly sending `providerOptions.deepseek.thinking = { type:
 * 'disabled' }` was measured to make this WORSE through the gateway — it
 * consumed the entire budget and returned empty text where the default finished
 * cleanly — so thinking is deliberately left at the provider default here.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 4000

const FALLBACK_GATEWAY_MODELS = [
  {
    id: DEFAULT_GATEWAY_MODEL,
    name: 'DeepSeek V4 Flash (0731)',
    description: 'Default low-cost, long-context workhorse for changelog generation',
  },
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: 'Stronger DeepSeek tier for harder analyses',
  },
  {
    id: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    description: 'Balanced Claude tier',
  },
  {
    id: 'openai/gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: 'High-volume, low-cost OpenAI tier',
  },
]

class VercelGatewayProvider extends BaseProvider {
  [key: string]: any

  constructor(config) {
    super(config)
    this.client = null
    if (this.isAvailable()) {
      this.initializeClient()
    }
  }

  initializeClient() {
    const baseURL = this.config.AI_GATEWAY_BASE_URL?.trim()
    const apiKey = this.config.AI_GATEWAY_API_KEY?.trim()

    this.client = createGateway({
      // Leave both undefined unless actually configured, so the SDK's own
      // defaults apply. A present-but-empty env var would otherwise pin the
      // base URL to '' and break every call, because the SDK falls back with `??`.
      ...(apiKey ? { apiKey } : {}),
      ...(baseURL ? { baseURL } : {}),
    })
  }

  getName() {
    return 'vercel-gateway'
  }

  /**
   * An API key or an OIDC token is enough. On a Vercel runtime the OIDC token
   * usually arrives as a request header and never appears in the environment,
   * so treat "running on Vercel" as credentials-may-exist: a false negative
   * here disables the provider entirely, which is the worse failure.
   */
  isAvailable(): boolean {
    return Boolean(
      this.config.AI_GATEWAY_API_KEY?.trim() ||
      this.config.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL?.trim()
    )
  }

  // The credential is AI_GATEWAY_API_KEY, not the VERCEL-GATEWAY_API_KEY the
  // generic mixin would derive from the provider name.
  getRequiredEnvVars() {
    return ['AI_GATEWAY_API_KEY']
  }

  // Model tiers are registered in model-config.ts under 'vercel-gateway', so the
  // shared getDefaultModel resolution (AI_MODEL / <PROVIDER>_MODEL / standardModel)
  // applies unchanged.

  getCapabilities(_modelName?: string) {
    return {
      streaming: true,
      tool_use: true,
      json_mode: true,
      vision: false,
      reasoning: true,
      temperature_control: true,
    }
  }

  /**
   * The gateway's catalogue is remote and changes independently of this package,
   * so it is queried rather than hard-coded. Returns [] when unreachable: an
   * empty catalogue degrades model pickers, a throw would break provider health.
   */
  async getAvailableModels() {
    if (!this.isAvailable()) {
      return FALLBACK_GATEWAY_MODELS
    }

    try {
      const { models } = await this.client.getAvailableModels()
      if (!Array.isArray(models) || models.length === 0) {
        return FALLBACK_GATEWAY_MODELS
      }
      return models.map((model) => ({
        id: model.id,
        name: model.name ?? model.id,
        description: model.description ?? '',
      }))
    } catch {
      // Discovery is best-effort: a degraded gateway must not empty the catalogue.
      return FALLBACK_GATEWAY_MODELS
    }
  }

  /**
   * Resolve a gateway model, wrapped in the response cache unless caching is
   * disabled. Wrapping at the model boundary means every call path — commit
   * summaries, working-directory analysis, commit messages — shares one cache
   * without any of them knowing about it.
   */
  resolveModel(modelId: string) {
    const model = this.client(modelId)

    if (!isModelCacheEnabled()) {
      return model
    }

    this._cacheMiddleware ??= createModelCacheMiddleware({
      onHit: () => {
        this._cacheHits = (this._cacheHits || 0) + 1
      },
      onMiss: () => {
        this._cacheMisses = (this._cacheMisses || 0) + 1
      },
    })

    return wrapLanguageModel({ model, middleware: this._cacheMiddleware })
  }

  resolveTemperature(options: Record<string, any>, modelConfig: Record<string, any>) {
    if (options.temperature !== undefined) {
      return options.temperature
    }
    if (typeof modelConfig?.temperature === 'number') {
      return modelConfig.temperature
    }
    const configured = Number.parseFloat(this.config?.AI_TEMPERATURE)
    return Number.isFinite(configured) ? configured : 0.3
  }

  /** Cache counters for this process, surfaced in provider info/metrics. */
  getCacheStats() {
    return { hits: this._cacheHits || 0, misses: this._cacheMisses || 0 }
  }

  /**
   * Translate the internal chat-message contract into an AI SDK call. Any
   * leading system messages become `system`, matching how generateText separates
   * the system prompt from the conversation.
   */
  async generateCompletion(messages, options: Record<string, any> = {}) {
    if (!this.isAvailable()) {
      return this.handleProviderError(
        new Error(
          'Vercel AI Gateway is not configured. Set AI_GATEWAY_API_KEY, or run on Vercel with OIDC enabled.'
        ),
        'generate_completion'
      )
    }

    const modelId = options.model || this.getDefaultModel()

    try {
      const systemPrompt = messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content)
        .join('\n\n')

      const conversation = messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({ role: message.role, content: message.content }))

      const modelConfig = this.getProviderModelConfig()

      const result = await generateText({
        model: this.resolveModel(modelId),
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: conversation,
        // The shared model registry carries no temperature for this provider, so
        // resolve it explicitly: per-call wins, then the configured
        // AI_TEMPERATURE, then a low default suited to changelog prose.
        temperature: this.resolveTemperature(options, modelConfig),
        maxOutputTokens: options.max_tokens || modelConfig.maxTokens || DEFAULT_MAX_OUTPUT_TOKENS,
        ...(options.tools ? { tools: options.tools } : {}),
        // Propagate cancellation so a timed-out or aborted caller actually stops
        // the upstream request instead of leaving it in flight.
        ...(options.signal ? { abortSignal: options.signal } : {}),
      })

      // A model can finish "successfully" with no usable text — most often when
      // the output budget was consumed before any visible answer was produced.
      // Returning '' here would write an empty changelog entry and look like a
      // success, so it is surfaced as a failure and the caller falls back to
      // rule-based analysis.
      if (!result.text || result.text.trim().length === 0) {
        const truncated = result.finishReason === 'length'
        return {
          success: false,
          error: truncated
            ? 'The model reached its output limit before producing any text.'
            : 'The model returned no usable output.',
          errorCode: truncated ? 'output_truncated' : 'no_output',
          retryable: truncated,
          shouldFallback: true,
          model: modelId,
          finish_reason: result.finishReason,
          suggestions: truncated
            ? [
                'Increase the output budget for this model',
                'Narrow the commit range so the prompt is smaller',
              ]
            : ['Retry, or use --no-ai for rule-based generation'],
        }
      }

      return {
        content: result.text,
        model: modelId,
        tokens: result.usage?.totalTokens ?? 0,
        finish_reason: result.finishReason,
        tool_calls: result.toolCalls?.length ? result.toolCalls : undefined,
      }
    } catch (error) {
      // Classify before delegating: the shared handler matches on message text,
      // which cannot distinguish "retry will work" (rate limit, 5xx, network)
      // from "retry is pointless" (bad credential, missing model, quota).
      const classified = classifyAiError(error)
      return {
        ...this.handleProviderError(error, 'generate_completion', { model: modelId }),
        errorCode: classified.code,
        retryable: classified.retryable,
        shouldFallback: classified.shouldFallback,
        message: classified.message,
        suggestions: classified.suggestions,
      }
    }
  }

  async generateEmbedding() {
    // Embeddings go through `embed`/`embedMany`, a different SDK surface with a
    // different model catalogue. Nothing in this package requests embeddings
    // from the gateway yet, so fail loudly rather than return a fake vector.
    throw new ProviderError(
      'Embeddings are not implemented for the Vercel AI Gateway provider',
      'vercel-gateway',
      'generateEmbedding'
    )
  }
}

export default applyMixins(VercelGatewayProvider, 'vercel-gateway')
export { VercelGatewayProvider }
