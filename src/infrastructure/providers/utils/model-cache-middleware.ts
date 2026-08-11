/**
 * Language-model response cache, as a Vercel AI SDK middleware.
 *
 * Changelog generation is highly repetitive across runs: previewing with
 * `--dry-run` and then generating for real, re-running after a failed provider
 * call, or regenerating the same release, all re-send byte-identical prompts for
 * commits whose diffs have not changed. Caching on the model boundary removes
 * that repeat cost without any call site having to know about it.
 *
 * Key: SHA-256 over the model identity plus the RESPONSE-AFFECTING call
 * parameters only (see `responseAffectingParams`). Transport/runtime fields
 * (`abortSignal`, `headers`) are deliberately excluded — they vary per call and
 * would defeat the cache entirely without changing what the model returns.
 *
 * Storage is a small in-memory LRU in front of a JSON-file cache under the
 * user's cache directory, so hits survive across CLI invocations (the case that
 * actually matters here — a single run rarely repeats a prompt).
 *
 * Every failure path falls OPEN: a cache problem returns the freshly generated
 * result rather than turning a working generation into an error. Streaming
 * (`wrapStream`) is intentionally not cached — this package never streams model
 * output into a changelog.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import type { LanguageModelMiddleware } from 'ai'

const DEFAULT_TTL_SECONDS = 24 * 60 * 60
const MEMORY_LRU_MAX_ENTRIES = 128
const MAX_PAYLOAD_BYTES = 256 * 1024
const MAX_DISK_ENTRIES = 500

interface MemoryEntry {
  value: string
  expiresAt: number
}

const memoryStore = new Map<string, MemoryEntry>()

export function defaultCacheDirectory() {
  return path.join(os.homedir(), '.cache', 'ai-changelog-generator', 'model-responses')
}

/**
 * Opt-out via AI_CACHE_ENABLED=false. Caching is on by default because a stale
 * entry can only occur for a byte-identical prompt to the same model, which by
 * construction would have produced an equivalent answer.
 */
export function isModelCacheEnabled() {
  return process.env.AI_CACHE_ENABLED?.trim().toLowerCase() !== 'false'
}

function pruneMemoryStore() {
  const now = Date.now()
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key)
    }
  }

  // Map preserves insertion order, so the first key is the oldest.
  while (memoryStore.size >= MEMORY_LRU_MAX_ENTRIES) {
    const oldest = memoryStore.keys().next().value
    if (oldest === undefined) {
      break
    }
    memoryStore.delete(oldest)
  }
}

/**
 * Deterministic serialization: plain JSON.stringify is key-order dependent, so
 * two structurally identical parameter objects could hash differently and miss.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value ?? null)
  }

  if (typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(',')}}`
}

/**
 * The subset of call parameters that can change what the model returns.
 * Anything omitted here is transport or bookkeeping.
 */
export function responseAffectingParams(params: Record<string, any>) {
  return {
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens,
    temperature: params.temperature,
    stopSequences: params.stopSequences,
    topP: params.topP,
    topK: params.topK,
    presencePenalty: params.presencePenalty,
    frequencyPenalty: params.frequencyPenalty,
    responseFormat: params.responseFormat,
    seed: params.seed,
    tools: params.tools,
    toolChoice: params.toolChoice,
    providerOptions: params.providerOptions,
  }
}

export function fingerprint(model: Record<string, any>, params: Record<string, any>) {
  const payload = stableStringify({
    modelId: model?.modelId,
    provider: model?.provider,
    specificationVersion: model?.specificationVersion,
    params: responseAffectingParams(params),
  })
  return createHash('sha256').update(payload).digest('hex')
}

/**
 * A non-deterministic call (temperature > 0 with no fixed seed) is still cached:
 * the point is reproducible changelog output for an unchanged repository. Calls
 * that cannot be represented safely are skipped instead.
 */
function canCache(params: Record<string, any>) {
  try {
    const encoded = stableStringify(responseAffectingParams(params))
    return encoded.length <= MAX_PAYLOAD_BYTES
  } catch {
    return false
  }
}

async function readDisk(cacheDir: string, key: string, ttlSeconds: number) {
  try {
    const file = path.join(cacheDir, `${key}.json`)
    const info = await stat(file)
    if (Date.now() - info.mtimeMs > ttlSeconds * 1000) {
      await unlink(file).catch(() => {})
      return null
    }
    return await readFile(file, 'utf8')
  } catch {
    return null
  }
}

async function writeDisk(cacheDir: string, key: string, value: string) {
  try {
    await mkdir(cacheDir, { recursive: true })
    // Temp file + rename so a concurrent reader never sees a partial entry.
    const file = path.join(cacheDir, `${key}.json`)
    const temp = `${file}.${process.pid}.tmp`
    await writeFile(temp, value, 'utf8')
    await rename(temp, file)
    await enforceDiskBudget(cacheDir)
  } catch {
    // Fall open: an unwritable cache must not fail generation.
  }
}

/** Keep the on-disk cache bounded; oldest entries are evicted first. */
async function enforceDiskBudget(cacheDir: string) {
  try {
    const files = (await readdir(cacheDir)).filter((f) => f.endsWith('.json'))
    if (files.length <= MAX_DISK_ENTRIES) {
      return
    }
    const withTimes = await Promise.all(
      files.map(async (f) => {
        try {
          const info = await stat(path.join(cacheDir, f))
          return { f, time: info.mtimeMs }
        } catch {
          return { f, time: 0 }
        }
      })
    )
    withTimes.sort((a, b) => a.time - b.time)
    const excess = withTimes.slice(0, withTimes.length - MAX_DISK_ENTRIES)
    await Promise.all(excess.map((e) => unlink(path.join(cacheDir, e.f)).catch(() => {})))
  } catch {
    // Best effort.
  }
}

export interface ModelCacheOptions {
  ttlSeconds?: number
  cacheDir?: string
  /** Reported on a hit so callers can surface cache usage. */
  onHit?: (key: string) => void
  onMiss?: (key: string) => void
}

export function createModelCacheMiddleware(
  options: ModelCacheOptions = {}
): LanguageModelMiddleware {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS
  const cacheDir = options.cacheDir ?? defaultCacheDirectory()

  return {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      if (!isModelCacheEnabled() || !canCache(params)) {
        return doGenerate()
      }

      let key: string
      try {
        key = fingerprint(model as Record<string, any>, params as Record<string, any>)
      } catch {
        return doGenerate()
      }

      const now = Date.now()
      const memoryHit = memoryStore.get(key)
      if (memoryHit && memoryHit.expiresAt > now) {
        options.onHit?.(key)
        try {
          return JSON.parse(memoryHit.value)
        } catch {
          memoryStore.delete(key)
        }
      }

      const diskHit = await readDisk(cacheDir, key, ttlSeconds)
      if (diskHit) {
        try {
          const parsed = JSON.parse(diskHit)
          pruneMemoryStore()
          memoryStore.set(key, { value: diskHit, expiresAt: now + ttlSeconds * 1000 })
          options.onHit?.(key)
          return parsed
        } catch {
          // Corrupt entry: fall through and regenerate.
        }
      }

      options.onMiss?.(key)
      const result = await doGenerate()

      try {
        const serialized = JSON.stringify(result)
        if (serialized.length <= MAX_PAYLOAD_BYTES) {
          pruneMemoryStore()
          memoryStore.set(key, { value: serialized, expiresAt: now + ttlSeconds * 1000 })
          await writeDisk(cacheDir, key, serialized)
        }
      } catch {
        // A result that will not serialize is simply not cached.
      }

      return result
    },
  }
}

/** Exposed for tests: drops the in-process layer without touching disk. */
export function clearModelCacheMemory() {
  memoryStore.clear()
}
