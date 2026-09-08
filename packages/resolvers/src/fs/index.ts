/**
 * Filesystem resolver for Node.js environments.
 */

import type { Resolver } from '@paradoc/types'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

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
    throw invalidPath('Resolver root must be a non-empty string')
  }

  const rootPath = resolve(options.root)
  let canonicalRoot: Promise<string> | undefined

  return {
    async read(path: string): Promise<Uint8Array> {
      const logicalPath = normalizeReadPath(path)
      const fullPath = resolve(rootPath, logicalPath)

      if (!isContained(rootPath, fullPath)) {
        throw outsideRoot(path)
      }

      const [resolvedRoot, canonicalPath] = await Promise.all([
        (canonicalRoot ??= realpath(rootPath)),
        realpath(fullPath),
      ])
      if (!isContained(resolvedRoot, canonicalPath)) {
        throw outsideRoot(path)
      }

      return readFile(canonicalPath)
    },
  }
}

function normalizeReadPath(path: string): string {
  if (typeof path !== 'string' || path.length === 0) {
    throw invalidPath('Resolver path must be a non-empty string')
  }
  if (path.includes('\0')) {
    throw invalidPath('Resolver path cannot contain a null byte')
  }
  if (path.includes('\\')) {
    throw invalidPath('Resolver paths must use forward slashes')
  }
  if (/^[a-zA-Z]:/.test(path) || path.startsWith('//')) {
    throw invalidPath('Resolver paths cannot use drive or UNC syntax')
  }

  return path.startsWith('/') ? path.slice(1) : path
}

function isContained(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate)
  return fromRoot === '' || (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
}

function outsideRoot(path: string): Error {
  return Object.assign(
    new Error(`Resolver path "${path}" resolves outside the configured root`),
    { code: 'ERR_RESOLVER_OUTSIDE_ROOT' },
  )
}

function invalidPath(message: string): Error {
  return Object.assign(new TypeError(message), { code: 'ERR_RESOLVER_INVALID_PATH' })
}
