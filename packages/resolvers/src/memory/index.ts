import type { Resolver } from '@paradoc/types'
import { invalidOptions, notFound } from '../shared/errors'

/** Options for creating an in-memory resolver. */
export interface MemoryResolverOptions {
  /** Exact resolver paths mapped to UTF-8 text or binary content. */
  contents: Record<string, Uint8Array | string>
}

/**
 * Create a browser-safe resolver backed by an exact-key content map.
 *
 * Binary inputs, including Node.js `Buffer`s, are copied at construction and
 * every read returns a fresh `Uint8Array` copy, so mutations by either the
 * caller or a consumer cannot change stored content.
 *
 * Throws `ERR_RESOLVER_INVALID_OPTIONS` when `contents` is not an object or a
 * value is neither a string nor a `Uint8Array`.
 */
export function createMemoryResolver(options: MemoryResolverOptions): Resolver {
  const supplied: unknown = options?.contents
  if (typeof supplied !== 'object' || supplied === null || Array.isArray(supplied)) {
    throw invalidOptions('Memory resolver contents must be an object of paths to strings or Uint8Arrays')
  }

  const encoder = new TextEncoder()
  const contents = new Map<string, Uint8Array>()

  for (const [path, content] of Object.entries(supplied)) {
    if (typeof content === 'string') {
      contents.set(path, encoder.encode(content))
    } else if (content instanceof Uint8Array) {
      contents.set(path, new Uint8Array(content))
    } else {
      throw invalidOptions(`Memory resolver content for "${path}" must be a string or Uint8Array`)
    }
  }

  return {
    async read(path: string): Promise<Uint8Array> {
      const content = contents.get(path)
      if (content === undefined) throw notFound(path)
      return new Uint8Array(content)
    },
  }
}
