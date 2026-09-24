/**
 * Filesystem resolver for Node.js environments.
 */

import type { Resolver } from '@paradoc/types'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { invalidOptions, outsideRoot } from '../shared/errors'
import { normalizeRootedPath } from '../shared/path'

/**
 * Options for creating a filesystem resolver.
 */
export interface FsResolverOptions {
  /**
   * Absolute or current-working-directory-relative path to the root directory.
   * Relative roots are anchored when the resolver is created.
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
 * import { createFsResolver } from '@paradoc/resolvers/fs'
 *
 * const resolver = createFsResolver({ root: process.cwd() })
 *
 * // Read a file relative to root
 * const bytes = await resolver.read('/templates/form.md')
 * ```
 */
export function createFsResolver(options: FsResolverOptions): Resolver {
  if (!options || typeof options.root !== 'string' || options.root.length === 0) {
    throw invalidOptions('Resolver root must be a non-empty string')
  }

  const rootPath = resolve(options.root)
  // Cache only a successful lookup, so a root created after a failed read
  // becomes readable.
  let canonicalRoot: Promise<string> | undefined
  const resolveRoot = (): Promise<string> =>
    (canonicalRoot ??= realpath(rootPath).catch((error: unknown) => {
      canonicalRoot = undefined
      throw error
    }))

  return {
    async read(path: string): Promise<Uint8Array> {
      const logicalPath = normalizeRootedPath(path)
      const fullPath = resolve(rootPath, logicalPath)

      if (!isContained(rootPath, fullPath)) {
        throw outsideRoot(path)
      }

      const [resolvedRoot, canonicalPath] = await Promise.all([
        resolveRoot(),
        realpath(fullPath),
      ])
      if (!isContained(resolvedRoot, canonicalPath)) {
        throw outsideRoot(path)
      }

      return readFile(canonicalPath)
    },
  }
}

function isContained(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate)
  return fromRoot === '' || (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
}
