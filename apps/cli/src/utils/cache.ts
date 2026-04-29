/**
 * Cache Manager
 *
 * Provides persistent caching for registry data with configurable TTL.
 * Supports global, project, and per-registry cache settings.
 */

import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { LocalFileSystem } from './local-fs.js'

/**
 * Cache entry stored on disk
 */
interface CacheEntry<T = unknown> {
  /** Cached data */
  data: T
  /** Timestamp when cached (ISO 8601) */
  cachedAt: string
  /** TTL in seconds used when caching */
  ttl: number
  /** Cache key (for verification) */
  key: string
}

const CacheEntrySchema = z.object({
  data: z.unknown(),
  cachedAt: z.string(),
  ttl: z.number(),
  key: z.string(),
})

/**
 * Cache configuration
 */
interface CacheManagerConfig {
  /** Cache directory path. Default: ~/.paradoc/cache */
  directory?: string
  /** Default TTL in seconds. 0 disables caching. Default: 3600 */
  defaultTtl?: number
}

/**
 * Cache retrieval result
 */
export type CacheResult<T> =
  | { hit: true; data: T; age: number }
  | { hit: false; reason: 'miss' | 'expired' | 'disabled' | 'error' }

/**
 * Default cache TTL (1 hour)
 */
export const DEFAULT_CACHE_TTL = 3600

/**
 * Default cache directory
 */
const homeDir = homedir()
const defaultStorage = new LocalFileSystem(homeDir)
export const DEFAULT_CACHE_DIR = defaultStorage.joinPath('.paradoc', 'cache')

/**
 * Cache manager for registry data
 */
class CacheManager {
  private directory: string = DEFAULT_CACHE_DIR
  private defaultTtl: number = DEFAULT_CACHE_TTL
  private storage: LocalFileSystem
  private initialized = false

  constructor() {
    // Initialize storage with home directory as base
    this.storage = new LocalFileSystem(homeDir)
  }

  /**
   * Initialize the cache manager with configuration
   */
  async init(config?: CacheManagerConfig): Promise<void> {
    if (config?.directory) {
      this.directory = config.directory
      // Update storage to use the custom directory's parent
      this.storage = new LocalFileSystem()
    }
    if (config?.defaultTtl !== undefined) {
      this.defaultTtl = config.defaultTtl
    }

    // Ensure cache directory exists
    await this.storage.mkdir(this.directory, true)
    this.initialized = true
  }

  /**
   * Generate a cache key from a URL
   */
  private getCacheKey(url: string): string {
    const hash = createHash('sha256').update(url).digest('hex')
    return hash.substring(0, 16) // Use first 16 chars for shorter filenames
  }

  /**
   * Get the cache file path for a URL
   */
  private getCacheFilePath(url: string): string {
    const key = this.getCacheKey(url)
    // Extract domain for organization
    let domain = 'unknown'
    try {
      const parsed = new URL(url)
      domain = parsed.hostname.replace(/\./g, '_')
    } catch {
      // Use 'unknown' if URL parsing fails
    }
    return this.storage.joinPath(this.directory, domain, `${key}.json`)
  }

  /**
   * Get cached data for a URL
   * @param url - The URL to get cached data for
   * @param ttlOverride - Optional TTL override for this fetch
   * @returns Cache result indicating hit/miss and data
   */
  async get<T>(url: string, ttlOverride?: number): Promise<CacheResult<T>> {
    const effectiveTtl = ttlOverride ?? this.defaultTtl

    // TTL of 0 means caching is disabled
    if (effectiveTtl === 0) {
      return { hit: false, reason: 'disabled' }
    }

    const filePath = this.getCacheFilePath(url)

    try {
      const content = await this.storage.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(content)
      const validation = CacheEntrySchema.safeParse(parsed)
      if (!validation.success) {
        return { hit: false, reason: 'error' }
      }
      const entry = validation.data as CacheEntry<T>

      // Verify the key matches (defense against hash collisions)
      const expectedKey = this.getCacheKey(url)
      if (entry.key !== expectedKey) {
        return { hit: false, reason: 'miss' }
      }

      // Check if cache has expired
      const cachedAt = new Date(entry.cachedAt).getTime()
      const now = Date.now()
      const age = Math.floor((now - cachedAt) / 1000)

      if (age > effectiveTtl) {
        return { hit: false, reason: 'expired' }
      }

      return { hit: true, data: entry.data, age }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT') {
        return { hit: false, reason: 'miss' }
      }
      // Log error but don't fail - treat as cache miss
      return { hit: false, reason: 'error' }
    }
  }

  /**
   * Store data in cache
   * @param url - The URL the data was fetched from
   * @param data - The data to cache
   * @param ttl - TTL in seconds (0 = don't cache)
   */
  async set<T>(url: string, data: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this.defaultTtl

    // TTL of 0 means caching is disabled
    if (effectiveTtl === 0) {
      return
    }

    const filePath = this.getCacheFilePath(url)
    const key = this.getCacheKey(url)

    const entry: CacheEntry<T> = {
      data,
      cachedAt: new Date().toISOString(),
      ttl: effectiveTtl,
      key,
    }

    // storage.writeFile automatically creates parent directories
    await this.storage.writeFile(filePath, JSON.stringify(entry, null, 2))
  }

  /**
   * Invalidate cached data for a URL
   * @param url - The URL to invalidate cache for
   */
  async invalidate(url: string): Promise<boolean> {
    const filePath = this.getCacheFilePath(url)
    try {
      await this.storage.deleteFile(filePath)
      return true
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT') {
        return false // Already not cached
      }
      throw error
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0
    let errors = 0

    try {
      const entries = await this.storage.listFiles(this.directory)

      for (const entryName of entries) {
        const entryPath = this.storage.joinPath(this.directory, entryName)

        try {
          const stats = await this.storage.stat(entryPath)

          if (stats.isDirectory) {
            // Delete all files in subdirectory
            try {
              const files = await this.storage.listFiles(entryPath)
              for (const file of files) {
                if (file.endsWith('.json')) {
                  try {
                    await this.storage.deleteFile(this.storage.joinPath(entryPath, file))
                    deleted++
                  } catch {
                    errors++
                  }
                }
              }
              // Try to remove empty directory
              await this.storage.deleteDirectory(entryPath, false).catch(() => { /* ignore */ })
            } catch {
              errors++
            }
          } else if (entryName.endsWith('.json')) {
            try {
              await this.storage.deleteFile(entryPath)
              deleted++
            } catch {
              errors++
            }
          }
        } catch {
          errors++
        }
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code !== 'ENOENT') {
        throw error
      }
    }

    return { deleted, errors }
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<{
    directory: string
    defaultTtl: number
    entries: number
    totalSize: number
  }> {
    let entries = 0
    let totalSize = 0

    try {
      const domainDirs = await this.storage.listFiles(this.directory)

      for (const dirName of domainDirs) {
        const domainPath = this.storage.joinPath(this.directory, dirName)

        try {
          const dirStats = await this.storage.stat(domainPath)
          if (dirStats.isDirectory) {
            const files = await this.storage.listFiles(domainPath)

            for (const file of files) {
              if (file.endsWith('.json')) {
                entries++
                try {
                  const stat = await this.storage.stat(this.storage.joinPath(domainPath, file))
                  totalSize += stat.size
                } catch {
                  // Ignore stat errors
                }
              }
            }
          }
        } catch {
          // Ignore directory errors
        }
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code !== 'ENOENT') {
        throw error
      }
    }

    return {
      directory: this.directory,
      defaultTtl: this.defaultTtl,
      entries,
      totalSize,
    }
  }

  /**
   * Get the effective TTL considering hierarchy:
   * command flag > per-registry > project > global > default
   */
  getEffectiveTtl(options: {
    commandTtl?: number
    registryTtl?: number
    projectTtl?: number
    globalTtl?: number
  }): number {
    // Command flag takes highest priority
    if (options.commandTtl !== undefined) {
      return options.commandTtl
    }
    // Then per-registry
    if (options.registryTtl !== undefined) {
      return options.registryTtl
    }
    // Then project
    if (options.projectTtl !== undefined) {
      return options.projectTtl
    }
    // Then global
    if (options.globalTtl !== undefined) {
      return options.globalTtl
    }
    // Finally, default
    return this.defaultTtl
  }

  /**
   * Update configuration (for runtime reconfiguration)
   */
  configure(config: CacheManagerConfig): void {
    if (config.directory !== undefined) {
      this.directory = config.directory
    }
    if (config.defaultTtl !== undefined) {
      this.defaultTtl = config.defaultTtl
    }
  }

  /**
   * Get current cache directory
   */
  getDirectory(): string {
    return this.directory
  }

  /**
   * Get current default TTL
   */
  getDefaultTtl(): number {
    return this.defaultTtl
  }
}

/**
 * Singleton cache manager instance
 */
export const cacheManager = new CacheManager()
