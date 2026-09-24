import { invalidPath } from './errors'

/**
 * Validate a rooted resolver path and return it relative to the root.
 *
 * Paths use forward slashes. A single leading slash means the resolver root.
 * Null bytes, backslashes, drive letters, and UNC or protocol-relative paths
 * are rejected.
 */
export function normalizeRootedPath(path: string): string {
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
