/**
 * CLI Type Definitions
 *
 * Types for the Paradoc CLI registry system.
 */

/**
 * Artifact kinds supported by Paradoc
 */
export type ArtifactKind = 'form' | 'document' | 'checklist' | 'bundle'

/**
 * Output format for artifacts
 * - 'json': Raw JSON file only
 * - 'yaml': Raw YAML file only
 * - 'typed': JSON file with TypeScript declaration file (.d.ts) for type safety
 * - 'ts': TypeScript module with ready-to-use typed export
 */
export type OutputFormat = 'json' | 'yaml' | 'typed' | 'ts'

/**
 * Per-registry cache configuration
 */
export interface RegistryCacheConfig {
  /** Cache TTL in seconds. 0 disables caching for this registry. */
  ttl?: number
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Default cache TTL in seconds. 0 disables caching. Default: 3600 (1 hour) */
  ttl?: number
  /** Custom cache directory path. Default: ~/.paradoc/cache */
  directory?: string
}

/**
 * Registry entry - simple URL or object with auth
 */
export type RegistryEntry = string | {
  url: string
  headers?: Record<string, string>
  params?: Record<string, string>
  cache?: RegistryCacheConfig
}

/**
 * Security configuration for content types
 */
export interface ContentTypeConfig {
  /**
   * Additional allowed content types beyond the defaults.
   * These are merged with DEFAULT_ALLOWED_CONTENT_TYPES.
   * Blocked content types cannot be added here.
   */
  allowedContentTypes?: string[]
}

/**
 * Global CLI configuration
 */
export interface GlobalConfig {
  $schema?: string
  registries?: Record<string, RegistryEntry>
  defaults?: {
    output?: OutputFormat
    artifactsDir?: string
    registry?: string
  }
  /**
   * Security settings for layer downloads
   */
  security?: ContentTypeConfig
  /**
   * Global cache configuration for registry data
   */
  cache?: CacheConfig
  /**
   * Telemetry preferences
   */
  telemetry?: {
    enabled?: boolean
  }
  /**
   * Persistent anonymous identifier for telemetry (UUID v4).
   * Generated once on first use, preserved across resets.
   */
  anonymousId?: string
}

/**
 * Project-level cache configuration (without directory - uses global)
 */
export interface ProjectCacheConfig {
  /** Cache TTL in seconds. 0 disables caching. Default: 3600 (1 hour) */
  ttl?: number
}

/**
 * Project manifest (paradoc.json)
 */
export interface ProjectManifest {
  $schema?: string
  name: string
  title: string
  description?: string
  visibility: 'public' | 'private'
  registries?: Record<string, RegistryEntry>
  artifacts?: {
    dir?: string
    output?: OutputFormat
  }
  /**
   * Security settings for layer downloads (overrides global config)
   */
  security?: ContentTypeConfig
  /**
   * Project-level cache configuration (overrides global config)
   */
  cache?: ProjectCacheConfig
}

/**
 * Locked layer metadata
 */
export interface LockedLayer {
  integrity: string
  path: string
}

/**
 * Locked artifact metadata
 */
export interface LockedArtifact {
  kind: ArtifactKind
  version: string
  resolved: string
  integrity: string
  installedAt: string
  output: OutputFormat
  path: string
  layers: Record<string, LockedLayer>
}

/**
 * Lock file structure
 */
export interface LockFile {
  $schema?: string
  version: number
  artifacts: Record<string, LockedArtifact>
}

/**
 * Registry item summary (from registry.json index)
 */
export interface RegistryItemSummary {
  name: string
  kind: ArtifactKind
  version: string
  path?: string
  title?: string
  description?: string
  layers?: string[]
  tags?: string[]
}

/**
 * Registry index (registry.json)
 */
export interface RegistryIndex {
  $schema?: string
  name: string
  homepage?: string
  description?: string
  artifactsPath?: string
  items: RegistryItemSummary[]
}

/**
 * Parsed artifact reference
 */
export interface ArtifactRef {
  namespace: string  // e.g., "@acme"
  name: string       // e.g., "residential-lease"
  full: string       // e.g., "@acme/residential-lease"
}

/**
 * Resolved registry configuration
 */
export interface ResolvedRegistry {
  namespace: string
  baseUrl: string
  headers?: Record<string, string>
  params?: Record<string, string>
  artifactsPath?: string
  cache?: RegistryCacheConfig
}

/**
 * Add command options
 */
export interface AddOptions {
  layers?: string
  output?: OutputFormat
  /** Override cache TTL for this fetch (in seconds). 0 = no cache. */
  cacheTtl?: number
}

/**
 * View command options
 */
export interface ViewOptions {
  json?: boolean
}

/**
 * List command options
 */
export interface ListOptions {
  json?: boolean
  kind?: ArtifactKind
}

/**
 * Search command options
 */
export interface SearchOptions {
  query?: string
  kind?: ArtifactKind
  tags?: string
  json?: boolean
}
