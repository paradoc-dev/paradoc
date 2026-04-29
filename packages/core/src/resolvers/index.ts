/**
 * Resolvers - utilities for loading and resolving content
 */

import type { Resolver } from "@paradoc/types";

// Re-export Resolver from types for convenience
export type { Resolver } from "@paradoc/types";

/**
 * Options for creating an in-memory resolver.
 */
export interface MemoryResolverOptions {
  /**
   * Map of paths to content.
   * Values can be Uint8Array (binary) or string (will be UTF-8 encoded).
   */
  contents: Record<string, Uint8Array | string>;
}

/**
 * Create an in-memory resolver from a file map.
 * Useful for testing and browser environments.
 *
 * @example
 * ```typescript
 * const resolver = createMemoryResolver({
 *   contents: {
 *     '/templates/form.md': '# {{title}}',
 *     '/assets/logo.png': myLogoBytes,
 *   }
 * })
 * ```
 */
export function createMemoryResolver(options: MemoryResolverOptions): Resolver {
  const map = new Map(Object.entries(options.contents));
  const encoder = new TextEncoder();

  return {
    async read(path: string): Promise<Uint8Array> {
      const content = map.get(path);
      if (content === undefined) {
        throw new Error(`Not found: ${path}`);
      }
      if (typeof content === "string") {
        return encoder.encode(content);
      }
      return content;
    },
  };
}
