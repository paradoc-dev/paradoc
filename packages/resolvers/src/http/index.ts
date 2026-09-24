/**
 * HTTP resolver for any environment with the Fetch API.
 */

import type { Resolver } from '@paradoc/types'
import { invalidOptions, invalidPath, notFound, outsideRoot, resolverError } from '../shared/errors'
import { normalizeRootedPath } from '../shared/path'

/** Options for creating an HTTP resolver. */
export interface HttpResolverOptions {
  /**
   * Absolute `http:` or `https:` URL of the root directory. Every read resolves
   * beneath it. Its query and fragment are ignored.
   */
  baseUrl: string
  /**
   * Fetch function for each read. Defaults to the global `fetch`. Supply one to
   * add transport policy such as allowed hosts, timeouts, redirects, or body
   * size limits.
   */
  fetch?: (url: string) => Promise<Response>
}

/**
 * Create a resolver that reads content over HTTP beneath a base URL.
 *
 * Paths follow the filesystem resolver's rules: forward slashes only, and a
 * single leading slash means the base URL, not the origin root. Each path
 * segment is percent-encoded, so `?`, `#`, and `%` are part of a file name.
 * Paths that resolve outside the base URL reject with
 * `ERR_RESOLVER_OUTSIDE_ROOT`, and a path that names the base URL itself with
 * `ERR_RESOLVER_INVALID_PATH`, before any request. Redirects follow the fetch
 * function's own policy. A 404 rejects with `ERR_RESOLVER_NOT_FOUND`,
 * and any other non-2xx status rejects with `ERR_RESOLVER_FETCH_FAILED`.
 *
 * @example
 * ```typescript
 * import { createHttpResolver } from '@paradoc/resolvers/http'
 *
 * const resolver = createHttpResolver({ baseUrl: 'https://example.com/forms/w-9/' })
 *
 * // Fetches https://example.com/forms/w-9/templates/form.pdf
 * const bytes = await resolver.read('/templates/form.pdf')
 * ```
 */
export function createHttpResolver(options: HttpResolverOptions): Resolver {
  const root = parseBaseUrl(options?.baseUrl)
  const fetchFn = options.fetch ?? ((url: string) => globalThis.fetch(url))
  if (typeof fetchFn !== 'function') {
    throw invalidOptions('HTTP resolver fetch must be a function')
  }

  return {
    async read(path: string): Promise<Uint8Array> {
      const url = resolveUrl(root, path)
      const response = await fetchFn(url)
      if (response.status === 404) throw notFound(path)
      if (!response.ok) {
        throw resolverError(
          'ERR_RESOLVER_FETCH_FAILED',
          `Resolver fetch failed for "${path}" with status ${response.status}`,
        )
      }
      return new Uint8Array(await response.arrayBuffer())
    },
  }
}

function parseBaseUrl(baseUrl: unknown): URL {
  if (typeof baseUrl !== 'string' || baseUrl.length === 0) {
    throw invalidOptions('HTTP resolver baseUrl must be a non-empty string')
  }
  let root: URL
  try {
    root = new URL(baseUrl)
  } catch {
    throw invalidOptions(`HTTP resolver baseUrl must be an absolute URL: "${baseUrl}"`)
  }
  if (root.protocol !== 'https:' && root.protocol !== 'http:') {
    throw invalidOptions(`HTTP resolver baseUrl must use http or https: "${baseUrl}"`)
  }
  root.search = ''
  root.hash = ''
  if (!root.pathname.endsWith('/')) root.pathname = `${root.pathname}/`
  return root
}

function resolveUrl(root: URL, path: string): string {
  const encoded = normalizeRootedPath(path)
    .split('/')
    .map((segment) => (segment === '.' || segment === '..' ? segment : encodeURIComponent(segment)))
    .join('/')
  const url = new URL(encoded, root)
  // Encoding keeps the origin fixed; the origin check guards that invariant.
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) {
    throw outsideRoot(path)
  }
  if (url.pathname === root.pathname) {
    throw invalidPath('Resolver path must name a file beneath the base URL')
  }
  return url.toString()
}
