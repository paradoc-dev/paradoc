import type { Resolver } from '@paradoc/types'

/** Options for creating an in-memory resolver. */
export interface MemoryResolverOptions {
  /** Exact resolver paths mapped to UTF-8 text or binary content. */
  contents: Record<string, Uint8Array | string>
}

/**
 * Create a browser-safe resolver backed by an exact-key content map.
 *
 * Binary inputs are copied at construction and every read returns a fresh copy,
 * so mutations by either the caller or a consumer cannot change stored content.
 */
export function createMemoryResolver(options: MemoryResolverOptions): Resolver {
  const encoder = new TextEncoder()
  const contents = new Map<string, Uint8Array>()

  for (const [path, content] of Object.entries(options.contents)) {
    contents.set(path, typeof content === 'string' ? encoder.encode(content) : content.slice())
  }

  return {
    async read(path: string): Promise<Uint8Array> {
      const content = contents.get(path)
      if (content === undefined) {
        throw Object.assign(new Error(`Resolver content not found: "${path}"`), {
          code: 'ERR_RESOLVER_NOT_FOUND',
        })
      }
      return content.slice()
    },
  }
}
