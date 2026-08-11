/**
 * Classification of AI provider failures into a small, actionable set.
 *
 * The value is deciding two things the caller cannot infer from a message
 * string: whether retrying could plausibly succeed (`retryable`), and whether a
 * different model/provider should be tried instead (`shouldFallback`). Rule-based
 * changelog generation is always available as a floor, so a permanent failure
 * should stop wasting time rather than retry a request that will never succeed.
 *
 * Deliberately narrower than a hosted-service taxonomy: this is a local CLI with
 * no ledger, no tenants and no per-request budgets, so codes exist only where
 * they change behaviour or the advice shown to the user.
 */

export type AiErrorCode =
  | 'auth_failed'
  | 'forbidden'
  | 'model_missing'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'context_limit_exceeded'
  | 'content_filtered'
  | 'timed_out'
  | 'cancelled'
  | 'network_error'
  | 'provider_unavailable'
  | 'request_invalid'
  | 'not_configured'
  | 'output_truncated'
  | 'no_output'
  | 'unknown'

export interface ClassifiedAiError {
  code: AiErrorCode
  /** True when the identical request could succeed on a later attempt. */
  retryable: boolean
  /** True when a different model or provider is the sensible next step. */
  shouldFallback: boolean
  message: string
  suggestions: string[]
}

function statusOf(error: any): number | undefined {
  const candidate =
    error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.cause?.status
  return typeof candidate === 'number' ? candidate : undefined
}

function textOf(error: any): string {
  const parts = [
    error?.message,
    error?.cause?.message,
    error?.error?.message,
    typeof error === 'string' ? error : '',
  ].filter(Boolean)
  return parts.join(' ').toLowerCase()
}

/**
 * Order matters: the most specific and most actionable signals are checked
 * first, and HTTP status is preferred over message matching where available
 * because provider prose changes far more often than status codes.
 */
export function classifyAiError(error: unknown): ClassifiedAiError {
  const status = statusOf(error)
  const text = textOf(error)
  const name = (error as any)?.name ?? ''

  if (name === 'AbortError' || text.includes('aborted') || text.includes('cancell')) {
    return {
      code: 'cancelled',
      retryable: false,
      shouldFallback: false,
      message: 'The request was cancelled before it completed.',
      suggestions: [],
    }
  }

  if (name === 'TimeoutError' || text.includes('timed out') || text.includes('timeout')) {
    return {
      code: 'timed_out',
      retryable: true,
      shouldFallback: true,
      message: 'The AI provider did not respond in time.',
      suggestions: [
        'Retry with a smaller commit range',
        'Use --no-ai for rule-based generation',
        'Check network connectivity to the provider',
      ],
    }
  }

  if (status === 401 || text.includes('api key') || text.includes('unauthorized')) {
    return {
      code: 'auth_failed',
      retryable: false,
      shouldFallback: false,
      message: 'The AI provider rejected the configured credentials.',
      suggestions: [
        'Verify the provider credential is set and current',
        'Run `ai-changelog providers --validate` to test credentials',
      ],
    }
  }

  if (status === 403 || text.includes('forbidden') || text.includes('permission')) {
    return {
      code: 'forbidden',
      retryable: false,
      shouldFallback: true,
      message: 'The AI provider denied this request.',
      suggestions: ['Confirm the credential has access to the requested model'],
    }
  }

  if (status === 404 || text.includes('model not found') || text.includes('does not exist')) {
    return {
      code: 'model_missing',
      retryable: false,
      shouldFallback: true,
      message: 'The configured model could not be found for this provider.',
      suggestions: [
        'Check AI_MODEL against the provider model list',
        'Remove AI_MODEL to use the provider default',
      ],
    }
  }

  if (status === 429 || text.includes('rate limit') || text.includes('too many requests')) {
    return {
      code: 'rate_limited',
      retryable: true,
      shouldFallback: true,
      message: 'The AI provider is rate limiting requests.',
      suggestions: ['Retry shortly', 'Increase RATE_LIMIT_DELAY', 'Reduce the commit range'],
    }
  }

  if (text.includes('quota') || text.includes('insufficient_quota') || text.includes('billing')) {
    return {
      code: 'quota_exceeded',
      retryable: false,
      shouldFallback: true,
      message: 'The AI provider account has exhausted its quota.',
      suggestions: ['Check provider billing', 'Switch provider with --provider'],
    }
  }

  if (
    text.includes('context length') ||
    text.includes('context_length_exceeded') ||
    text.includes('too many tokens') ||
    text.includes('maximum context')
  ) {
    return {
      code: 'context_limit_exceeded',
      retryable: false,
      shouldFallback: true,
      message: 'The request exceeded the model context window.',
      suggestions: [
        'Use --analysis-mode standard to send smaller diffs',
        'Narrow the commit range',
        'Switch to a longer-context model',
      ],
    }
  }

  if (
    text.includes('content filter') ||
    text.includes('safety') ||
    text.includes('content_policy')
  ) {
    return {
      code: 'content_filtered',
      retryable: false,
      shouldFallback: true,
      message: 'The provider safety system blocked this content.',
      suggestions: ['Use --no-ai for the affected range'],
    }
  }

  if (typeof status === 'number' && status >= 500) {
    return {
      code: 'provider_unavailable',
      retryable: true,
      shouldFallback: true,
      message: 'The AI provider returned a server error.',
      suggestions: ['Retry shortly', 'Switch provider with --provider'],
    }
  }

  if (
    text.includes('econnrefused') ||
    text.includes('enotfound') ||
    text.includes('econnreset') ||
    text.includes('fetch failed') ||
    text.includes('network')
  ) {
    return {
      code: 'network_error',
      retryable: true,
      shouldFallback: true,
      message: 'The AI provider could not be reached.',
      suggestions: [
        'Check network connectivity',
        'For local providers, confirm the server is running',
      ],
    }
  }

  if (status === 400 || text.includes('invalid request') || text.includes('bad request')) {
    return {
      code: 'request_invalid',
      retryable: false,
      shouldFallback: true,
      message: 'The AI provider rejected the request format.',
      suggestions: ['Check model-specific parameter support'],
    }
  }

  // Reasoning models can burn the whole output budget before emitting visible
  // text, finishing "successfully" with an empty string. That must not read as
  // a usable result.
  if (text.includes('output limit') || text.includes('truncat')) {
    return {
      code: 'output_truncated',
      retryable: true,
      shouldFallback: true,
      message: 'The model reached its output limit before producing any text.',
      suggestions: [
        'Increase the output budget for this model',
        'Narrow the commit range so the prompt is smaller',
        'Disable model thinking so the budget goes to visible output',
      ],
    }
  }

  if (text.includes('no usable output') || text.includes('empty response')) {
    return {
      code: 'no_output',
      retryable: true,
      shouldFallback: true,
      message: 'The model returned no usable output.',
      suggestions: ['Retry, or use --no-ai for rule-based generation'],
    }
  }

  if (text.includes('not configured') || text.includes('no provider')) {
    return {
      code: 'not_configured',
      retryable: false,
      shouldFallback: false,
      message: 'No AI provider is configured.',
      suggestions: ['Run `ai-changelog providers` to configure one', 'Or use --no-ai'],
    }
  }

  return {
    code: 'unknown',
    retryable: false,
    shouldFallback: true,
    message: (error as any)?.message || 'An unknown AI provider error occurred.',
    suggestions: ['Retry, or use --no-ai for rule-based generation'],
  }
}

/** True when re-issuing the identical request could plausibly succeed. */
export function isRetryableAiError(error: unknown): boolean {
  return classifyAiError(error).retryable
}
