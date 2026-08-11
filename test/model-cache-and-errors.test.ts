import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  classifyAiError,
  isRetryableAiError,
} from '../src/infrastructure/providers/utils/error-classification.js'
import {
  clearModelCacheMemory,
  createModelCacheMiddleware,
  fingerprint,
  responseAffectingParams,
  stableStringify,
} from '../src/infrastructure/providers/utils/model-cache-middleware.js'

const tempDirs: string[] = []

function tempCacheDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-changelog-cache-'))
  tempDirs.push(dir)
  return dir
}

const MODEL = {
  modelId: 'deepseek/deepseek-v4-flash-0731',
  provider: 'gateway',
  specificationVersion: 'v4',
}

function callParams(overrides: Record<string, any> = {}) {
  return {
    prompt: [{ role: 'user', content: 'summarize this commit' }],
    temperature: 0.3,
    maxOutputTokens: 1000,
    ...overrides,
  }
}

beforeEach(() => {
  clearModelCacheMemory()
})

afterEach(() => {
  clearModelCacheMemory()
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('model cache middleware', () => {
  it('serves a second identical call from cache without re-invoking the model', async () => {
    const cacheDir = tempCacheDir()
    const middleware = createModelCacheMiddleware({ cacheDir })
    const doGenerate = vi.fn().mockResolvedValue({ content: 'generated', finishReason: 'stop' })

    const first = await middleware.wrapGenerate!({
      doGenerate,
      params: callParams(),
      model: MODEL,
    } as any)
    const second = await middleware.wrapGenerate!({
      doGenerate,
      params: callParams(),
      model: MODEL,
    } as any)

    expect(first).toEqual({ content: 'generated', finishReason: 'stop' })
    expect(second).toEqual(first)
    expect(doGenerate).toHaveBeenCalledTimes(1)
  })

  it('treats a changed prompt as a different entry', async () => {
    const cacheDir = tempCacheDir()
    const middleware = createModelCacheMiddleware({ cacheDir })
    const doGenerate = vi.fn().mockResolvedValue({ content: 'x', finishReason: 'stop' })

    await middleware.wrapGenerate!({ doGenerate, params: callParams(), model: MODEL } as any)
    await middleware.wrapGenerate!({
      doGenerate,
      params: callParams({ prompt: [{ role: 'user', content: 'different commit' }] }),
      model: MODEL,
    } as any)

    expect(doGenerate).toHaveBeenCalledTimes(2)
  })

  it('survives across processes by persisting to disk', async () => {
    const cacheDir = tempCacheDir()
    const doGenerate = vi.fn().mockResolvedValue({ content: 'persisted', finishReason: 'stop' })

    await createModelCacheMiddleware({ cacheDir }).wrapGenerate!({
      doGenerate,
      params: callParams(),
      model: MODEL,
    } as any)

    // Simulate a fresh process: drop the in-memory layer entirely.
    clearModelCacheMemory()

    const result = await createModelCacheMiddleware({ cacheDir }).wrapGenerate!({
      doGenerate,
      params: callParams(),
      model: MODEL,
    } as any)

    expect(result).toEqual({ content: 'persisted', finishReason: 'stop' })
    expect(doGenerate).toHaveBeenCalledTimes(1)
  })

  it('ignores transport fields that do not affect the response', () => {
    const controller = new AbortController()
    const withTransport = {
      ...callParams(),
      abortSignal: controller.signal,
      headers: { 'x-id': '1' },
    }
    const withOtherTransport = {
      ...callParams(),
      abortSignal: new AbortController().signal,
      headers: { 'x-id': '2' },
    }

    expect(fingerprint(MODEL, withTransport)).toBe(fingerprint(MODEL, withOtherTransport))
    expect(responseAffectingParams(withTransport)).not.toHaveProperty('abortSignal')
    expect(responseAffectingParams(withTransport)).not.toHaveProperty('headers')
  })

  it('keys on model identity so two models never share an entry', () => {
    expect(fingerprint(MODEL, callParams())).not.toBe(
      fingerprint({ ...MODEL, modelId: 'anthropic/claude-sonnet-5' }, callParams())
    )
  })

  it('hashes independently of key order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }))
  })

  it('falls open when the model call cannot be cached', async () => {
    const cacheDir = tempCacheDir()
    const middleware = createModelCacheMiddleware({ cacheDir })
    const doGenerate = vi.fn().mockResolvedValue({ content: 'ok', finishReason: 'stop' })

    // A circular structure cannot be fingerprinted; generation must still work.
    const circular: any = { role: 'user' }
    circular.self = circular

    const result = await middleware.wrapGenerate!({
      doGenerate,
      params: { prompt: [circular] },
      model: MODEL,
    } as any)

    expect(result).toEqual({ content: 'ok', finishReason: 'stop' })
    expect(doGenerate).toHaveBeenCalledTimes(1)
  })

  it('can be disabled by environment', async () => {
    const cacheDir = tempCacheDir()
    const previous = process.env.AI_CACHE_ENABLED
    process.env.AI_CACHE_ENABLED = 'false'
    try {
      const middleware = createModelCacheMiddleware({ cacheDir })
      const doGenerate = vi.fn().mockResolvedValue({ content: 'x', finishReason: 'stop' })

      await middleware.wrapGenerate!({ doGenerate, params: callParams(), model: MODEL } as any)
      await middleware.wrapGenerate!({ doGenerate, params: callParams(), model: MODEL } as any)

      expect(doGenerate).toHaveBeenCalledTimes(2)
    } finally {
      if (previous === undefined) {
        delete process.env.AI_CACHE_ENABLED
      } else {
        process.env.AI_CACHE_ENABLED = previous
      }
    }
  })
})

describe('AI error classification', () => {
  it('separates retryable transport failures from permanent credential failures', () => {
    expect(classifyAiError({ status: 429 })).toMatchObject({
      code: 'rate_limited',
      retryable: true,
    })
    expect(classifyAiError({ status: 503 })).toMatchObject({
      code: 'provider_unavailable',
      retryable: true,
    })
    expect(classifyAiError({ status: 401 })).toMatchObject({
      code: 'auth_failed',
      retryable: false,
      shouldFallback: false,
    })
  })

  it('flags quota and context limits as non-retryable but fallback-worthy', () => {
    expect(classifyAiError(new Error('insufficient_quota for this account'))).toMatchObject({
      code: 'quota_exceeded',
      retryable: false,
      shouldFallback: true,
    })
    expect(classifyAiError(new Error('maximum context length exceeded'))).toMatchObject({
      code: 'context_limit_exceeded',
      retryable: false,
      shouldFallback: true,
    })
  })

  it('recognises cancellation and does not advise retrying it', () => {
    const aborted = new Error('The operation was aborted')
    aborted.name = 'AbortError'
    expect(classifyAiError(aborted)).toMatchObject({ code: 'cancelled', retryable: false })
  })

  it('treats unreachable local providers as retryable network errors', () => {
    expect(classifyAiError(new Error('connect ECONNREFUSED 127.0.0.1:11434'))).toMatchObject({
      code: 'network_error',
      retryable: true,
    })
  })

  /**
   * Measured against the live gateway: the default flash snapshot can finish
   * with `length` and an EMPTY string when the output budget is tight. Returning
   * that as success wrote an empty changelog entry, so it must classify as a
   * failure the caller can fall back from.
   */
  it('classifies an empty/truncated model response as a recoverable failure', () => {
    expect(
      classifyAiError(new Error('The model reached its output limit before producing any text.'))
    ).toMatchObject({
      code: 'output_truncated',
      retryable: true,
      shouldFallback: true,
    })

    expect(classifyAiError(new Error('The model returned no usable output.'))).toMatchObject({
      code: 'no_output',
      shouldFallback: true,
    })
  })

  it('always yields actionable output for unknown failures', () => {
    const classified = classifyAiError(new Error('something entirely new'))
    expect(classified.code).toBe('unknown')
    expect(classified.suggestions.length).toBeGreaterThan(0)
    expect(isRetryableAiError(new Error('something entirely new'))).toBe(false)
  })
})
