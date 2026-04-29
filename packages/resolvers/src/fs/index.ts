/**
 * Filesystem resolver for Node.js environments.
 */

import type { Resolver } from '@paradoc/types'
import { readFile } from 'node:fs/promises'
import { resolve, relative, isAbsolute } from 'node:path'

/**
 * Options for creating a filesystem resolver.
 */
export interface FsResolverOptions {
  /**
   * Absolute path to the root directory.
   * All paths passed to read() will be resolved relative to this root.
   */
  root: string
}

/**
 * Create a filesystem resolver for Node.js environments.
 *
 * Security: The resolver validates that all resolved paths stay within the root
 * directory to prevent path traversal attacks.
 *
 * @example
 * ```typescript
 * import { createFsResolver } from '@paradoc/resolvers'
 *
 * const resolver = createFsResolver({ root: process.cwd() })
 *
 * // Read a file relative to root
 * const bytes = await resolver.read('/templates/form.md')
 * ```
 */
export function createFsResolver(options: FsResolverOptions): Resolver {
  const { root } = options
  // Normalize the root path to absolute
  const normalizedRoot = resolve(root)

  return {
    async read(path: string): Promise<Uint8Array> {
      const fullPath = resolve(normalizedRoot, path.startsWith('/') ? path.slice(1) : path)

      // Security: Ensure the resolved path is within the root directory
      const relativePath = relative(normalizedRoot, fullPath)
      if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
        throw new Error(`Path traversal detected: "${path}" resolves outside root directory`)
      }

      const buffer = await readFile(fullPath)
      return new Uint8Array(buffer)
    },
  }
}
