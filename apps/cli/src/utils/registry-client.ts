/**
 * Registry Client Utility
 *
 * Handles HTTP requests to artifact registries with persistent caching.
 */

import type {
  RegistryIndex,
  RegistryItemSummary,
  ResolvedRegistry,
} from '../types.js'
import {
  buildRegistryIndexUrl,
  buildArtifactItemUrl,
  buildLayerFileUrl,
} from './registry.js'
import {
  SECURITY_LIMITS,
  NETWORK_TIMEOUTS,
  validateArtifactContentType,
  validateLayerContentType,
  DEFAULT_ALLOWED_CONTENT_TYPES,
} from './constants.js'
import { validateUrl } from './security.js'
import { cacheManager, type CacheResult } from './cache.js'

/**
 * ContentRef from a registry item (inline text or file reference)
 */
export type RegistryContentRef =
  | { kind: 'inline'; text: string }
  | { kind: 'file'; path: string; mimeType: string; checksum?: string }

/**
 * Registry item with full details (fetched from r/{name}.json).
 *
 * A registry serves the artifact itself, flat, as `paradoc registry build`
 * writes it. `tags` and a file layer's `url` are registry metadata that the
 * installed artifact does not carry.
 */
export interface RegistryItem {
  $schema?: string
  name: string
  kind: 'form' | 'document' | 'checklist' | 'bundle'
  version: string
  title?: string
  description?: string
  tags?: string[]
  layers?: Record<string, RegistryLayerInfo>
  instructions?: RegistryContentRef
  agentInstructions?: RegistryContentRef
}

/**
 * Base layer information shared by all layer types
 */
interface RegistryLayerBase {
  mimeType: string
  title?: string
  description?: string
  checksum?: string
}

/**
 * Inline layer with embedded text content
 */
export interface RegistryInlineLayer extends RegistryLayerBase {
  kind: 'inline'
  text: string
}

/**
 * File-backed layer referenced by path
 */
export interface RegistryFileLayer extends RegistryLayerBase {
  kind: 'file'
  path: string
  /** Download URL a registry may publish; registry metadata, never installed. */
  url?: string
  /** Font a PDF layer draws with; downloaded beside the layer file. */
  font?: { path: string; checksum?: string }
  /** PDF layers only: AcroForm field name to Paradoc path. */
  bindings?: Record<string, string>
  /** PDF layers only: key of a sibling PDF layer whose bindings this layer reuses. */
  bindingsFrom?: string
}

/**
 * Layer information from registry item
 */
export type RegistryLayerInfo = RegistryInlineLayer | RegistryFileLayer

/**
 * Fetch error with status code
 */
export class RegistryFetchError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public url?: string
  ) {
    super(message)
    this.name = 'RegistryFetchError'
  }
}

/**
 * Error thrown when file size exceeds the limit
 */
export class FileSizeExceededError extends Error {
  constructor(
    message: string,
    public url: string,
    public size: number,
    public limit: number
  ) {
    super(message)
    this.name = 'FileSizeExceededError'
  }
}

/**
 * Error thrown when request times out
 */
export class RequestTimeoutError extends Error {
  constructor(message: string, public url: string) {
    super(message)
    this.name = 'RequestTimeoutError'
  }
}

/**
 * Error thrown when URL validation fails (SSRF protection, invalid scheme, etc.)
 */
export class UrlValidationError extends Error {
  constructor(message: string, public url: string) {
    super(message)
    this.name = 'UrlValidationError'
  }
}

/**
 * Error thrown when content type validation fails
 */
export class ContentTypeError extends Error {
  constructor(
    message: string,
    public url: string,
    public contentType: string
  ) {
    super(message)
    this.name = 'ContentTypeError'
  }
}

/**
 * Validate a URL before making a request
 * @throws UrlValidationError if URL is invalid or blocked
 */
function assertValidUrl(url: string): string[] {
  const result = validateUrl(url)

  if (!result.valid) {
    throw new UrlValidationError(result.error || 'Invalid URL', url)
  }

  return result.warnings
}

/**
 * Check Content-Length header and throw if exceeds limit
 */
function checkContentLength(response: Response, url: string, maxSize: number): void {
  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (!isNaN(size) && size > maxSize) {
      throw new FileSizeExceededError(
        `File size (${formatBytes(size)}) exceeds limit (${formatBytes(maxSize)})`,
        url,
        size,
        maxSize
      )
    }
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Read a response body, refusing it once it grows past maxSize
 * (covers streaming responses without Content-Length)
 */
async function readBytesWithSizeLimit(response: Response, url: string, maxSize: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader()
  if (!reader) {
    return new Uint8Array(await response.arrayBuffer())
  }

  const chunks: Uint8Array[] = []
  let totalSize = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    totalSize += value.length
    if (totalSize > maxSize) {
      reader.cancel()
      throw new FileSizeExceededError(
        `Download size (>${formatBytes(totalSize)}) exceeds limit (${formatBytes(maxSize)})`,
        url,
        totalSize,
        maxSize
      )
    }
    chunks.push(value)
  }

  const allChunks = new Uint8Array(totalSize)
  let position = 0
  for (const chunk of chunks) {
    allChunks.set(chunk, position)
    position += chunk.length
  }

  return allChunks
}

/**
 * Limits and checks applied to one registry request
 */
interface FetchLimits {
  /** Abort the request if response headers do not arrive within this time. */
  timeoutMs: number
  /** Largest body accepted, by Content-Length and by bytes read. */
  maxSize: number
  headers?: Record<string, string>
  /** Returns an error message when the response Content-Type is not accepted. */
  validateContentType: (contentType: string) => string | null
}

/**
 * Fetch a URL and read its body as bytes, enforcing URL validation, timeout,
 * status, content-type, and size limits
 */
async function fetchBytesWithLimits(url: string, limits: FetchLimits): Promise<Uint8Array<ArrayBuffer>> {
  // Validate URL before making request
  const warnings = assertValidUrl(url)
  if (warnings.length > 0) {
    // Log warnings to stderr (they'll be visible but not break the operation)
    warnings.forEach((w) => console.warn(`Warning: ${w}`))
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), limits.timeoutMs)

  try {
    const response = await fetch(url, {
      headers: { ...limits.headers },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new RegistryFetchError(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
        response.status,
        url
      )
    }

    const contentType = response.headers.get('content-type') ?? ''
    const contentTypeError = limits.validateContentType(contentType)
    if (contentTypeError) {
      throw new ContentTypeError(contentTypeError, url, contentType)
    }

    // Check Content-Length before downloading
    checkContentLength(response, url, limits.maxSize)

    return await readBytesWithSizeLimit(response, url, limits.maxSize)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RequestTimeoutError(`Request timed out after ${limits.timeoutMs}ms`, url)
    }
    throw error
  }
}

/**
 * Fetch registry JSON (index or item); the body must be a JSON or YAML content type
 */
async function fetchJson<T>(
  url: string,
  headers: Record<string, string> | undefined,
  maxSize: number,
): Promise<T> {
  const bytes = await fetchBytesWithLimits(url, {
    timeoutMs: NETWORK_TIMEOUTS.CONNECT_TIMEOUT,
    maxSize,
    headers: { Accept: 'application/json', ...headers },
    validateContentType: validateArtifactContentType,
  })
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

/**
 * Fetch layer bytes; the body must be one of the allowed layer content types
 */
async function fetchLayerBytes(
  url: string,
  headers: Record<string, string> | undefined,
  allowedContentTypes: readonly string[],
): Promise<Uint8Array<ArrayBuffer>> {
  return fetchBytesWithLimits(url, {
    timeoutMs: NETWORK_TIMEOUTS.DOWNLOAD_TIMEOUT,
    maxSize: SECURITY_LIMITS.MAX_LAYER_SIZE,
    headers,
    validateContentType: (contentType) => validateLayerContentType(contentType, allowedContentTypes),
  })
}

/**
 * Options for fetching with cache
 */
export interface FetchOptions {
  /** Cache TTL in seconds. 0 disables caching. */
  cacheTtl?: number
  /** Skip cache and fetch fresh. */
  skipCache?: boolean
}

/**
 * Registry Client for fetching artifacts from registries
 */
export class RegistryClient {
  // In-memory cache for current session (faster than disk for repeated lookups)
  private sessionCache: Map<string, RegistryIndex> = new Map()
  private cacheInitialized = false

  /**
   * Initialize the cache manager with configuration
   * @param config - Cache configuration
   */
  async initCache(config?: { directory?: string; defaultTtl?: number }): Promise<void> {
    if (!this.cacheInitialized) {
      await cacheManager.init(config)
      this.cacheInitialized = true
    }
  }

  /**
   * Fetch the registry index (list of all artifacts)
   * Uses persistent cache with configurable TTL
   *
   * @param registry - Resolved registry configuration
   * @param options - Fetch options including cache TTL
   */
  async fetchIndex(registry: ResolvedRegistry, options?: FetchOptions): Promise<RegistryIndex> {
    const url = buildRegistryIndexUrl(registry)
    const ttl = options?.cacheTtl

    // Check session cache first (fastest)
    if (!options?.skipCache) {
      const sessionCached = this.sessionCache.get(url)
      if (sessionCached) {
        return sessionCached
      }
    }

    // Initialize cache if not already done
    if (!this.cacheInitialized) {
      await this.initCache()
    }

    // Check persistent cache (if not skipping)
    if (!options?.skipCache && ttl !== 0) {
      const cacheResult: CacheResult<RegistryIndex> = await cacheManager.get<RegistryIndex>(url, ttl)
      if (cacheResult.hit) {
        // Store in session cache for fast repeated access
        this.sessionCache.set(url, cacheResult.data)
        return cacheResult.data
      }
    }

    // Fetch from network
    const index = await fetchJson<RegistryIndex>(
      url,
      registry.headers,
      SECURITY_LIMITS.MAX_INDEX_SIZE,
    )

    // Store in persistent cache (if caching is enabled)
    if (ttl !== 0) {
      await cacheManager.set(url, index, ttl)
    }

    // Store in session cache
    this.sessionCache.set(url, index)

    return index
  }

  /**
   * Invalidate cache for a registry
   * @param registry - Registry to invalidate cache for
   */
  async invalidateCache(registry: ResolvedRegistry): Promise<boolean> {
    const url = buildRegistryIndexUrl(registry)
    this.sessionCache.delete(url)
    return cacheManager.invalidate(url)
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<{ deleted: number; errors: number }> {
    this.sessionCache.clear()
    return cacheManager.clear()
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    directory: string
    defaultTtl: number
    entries: number
    totalSize: number
    sessionEntries: number
  }> {
    const stats = await cacheManager.stats()
    return {
      ...stats,
      sessionEntries: this.sessionCache.size,
    }
  }

  /**
   * Get the artifacts path for a registry, fetching index if needed
   * @param registry - Resolved registry configuration
   * @param options - Fetch options including cache TTL
   */
  async getArtifactsPath(registry: ResolvedRegistry, options?: FetchOptions): Promise<string> {
    // If already set on the registry, use it
    if (registry.artifactsPath) {
      return registry.artifactsPath
    }

    // Otherwise, fetch the index to get it
    const index = await this.fetchIndex(registry, options)
    return index.artifactsPath || ''
  }

  /**
   * Fetch a specific artifact item
   * @param registry - Resolved registry configuration
   * @param artifactName - Name of the artifact
   * @param options - Fetch options including cache TTL
   */
  async fetchItem(registry: ResolvedRegistry, artifactName: string, options?: FetchOptions): Promise<RegistryItem> {
    // Ensure we have the artifacts path
    const artifactsPath = await this.getArtifactsPath(registry, options)
    const resolvedRegistry = { ...registry, artifactsPath }

    // Look up item.path from the index (session-cached, so free after first fetch)
    const index = await this.fetchIndex(registry, options)
    const item = index.items.find((i) => i.name === artifactName)

    const url = buildArtifactItemUrl(resolvedRegistry, artifactName, item?.path)
    return fetchJson<RegistryItem>(
      url,
      registry.headers,
      SECURITY_LIMITS.MAX_ARTIFACT_SIZE,
    )
  }

  /**
   * Fetch a layer file as text
   * @param registry - Resolved registry configuration
   * @param filePath - Path to the file (or full URL from layer info)
   * @param allowedContentTypes - List of allowed MIME types for layers
   */
  async fetchLayerText(
    registry: ResolvedRegistry,
    filePath: string,
    allowedContentTypes: readonly string[] = DEFAULT_ALLOWED_CONTENT_TYPES
  ): Promise<string> {
    // If it's already a full URL, use it directly
    const url = filePath.startsWith('https') || filePath.startsWith('http') ? filePath : buildLayerFileUrl(registry, filePath)
    const bytes = await fetchLayerBytes(url, registry.headers, allowedContentTypes)
    return new TextDecoder().decode(bytes)
  }

  /**
   * Fetch a layer file as binary
   * @param registry - Resolved registry configuration
   * @param filePath - Path to the file (or full URL from layer info)
   * @param allowedContentTypes - List of allowed MIME types for layers
   */
  async fetchLayerBinary(
    registry: ResolvedRegistry,
    filePath: string,
    allowedContentTypes: readonly string[] = DEFAULT_ALLOWED_CONTENT_TYPES
  ): Promise<ArrayBuffer> {
    const url = filePath.startsWith('https') || filePath.startsWith('http') ? filePath : buildLayerFileUrl(registry, filePath)
    const bytes = await fetchLayerBytes(url, registry.headers, allowedContentTypes)
    return bytes.buffer
  }

  /**
   * Search artifacts in a registry by query
   * @param registry - Resolved registry configuration
   * @param options - Search options
   * @param fetchOptions - Fetch options including cache TTL
   */
  async searchArtifacts(
    registry: ResolvedRegistry,
    options: {
      query?: string
      kind?: string
      tags?: string[]
    },
    fetchOptions?: FetchOptions
  ): Promise<RegistryItemSummary[]> {
    // Fetch the full index and filter client-side
    // (In the future, this could use server-side search if available)
    const index = await this.fetchIndex(registry, fetchOptions)

    let results = [...index.items]

    // Filter by query (searches name, title, description)
    if (options.query) {
      const queryLower = options.query.toLowerCase()
      results = results.filter(
        (item) =>
          item.name.toLowerCase().includes(queryLower) ||
          item.title?.toLowerCase().includes(queryLower) ||
          item.description?.toLowerCase().includes(queryLower)
      )
    }

    // Filter by kind
    if (options.kind) {
      results = results.filter((item) => item.kind === options.kind)
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(
        (item) => item.tags && options.tags!.some((tag) => item.tags!.includes(tag))
      )
    }

    return results
  }

  /**
   * Check if an artifact exists in a registry
   * @param registry - Resolved registry configuration
   * @param artifactName - Name of the artifact
   * @param options - Fetch options including cache TTL
   */
  async artifactExists(registry: ResolvedRegistry, artifactName: string, options?: FetchOptions): Promise<boolean> {
    try {
      await this.fetchItem(registry, artifactName, options)
      return true
    } catch (error) {
      if (error instanceof RegistryFetchError && error.statusCode === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * Get artifact summary from registry index
   * @param registry - Resolved registry configuration
   * @param artifactName - Name of the artifact
   * @param options - Fetch options including cache TTL
   */
  async getArtifactSummary(
    registry: ResolvedRegistry,
    artifactName: string,
    options?: FetchOptions
  ): Promise<RegistryItemSummary | null> {
    const index = await this.fetchIndex(registry, options)
    return index.items.find((item) => item.name === artifactName) || null
  }
}

// Singleton instance
export const registryClient = new RegistryClient()
