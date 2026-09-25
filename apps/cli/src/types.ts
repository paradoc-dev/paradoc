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
import type { RegistryCacheConfig } from '@paradoc/schemas'
export type { RegistryCacheConfig, CacheConfig, RegistryEntry } from '@paradoc/schemas'

/**
 * Project manifest (paradoc.json), lock file (.paradoc/lock.json) and their
 * entries: the published schemas' types, so the CLI reads and writes exactly
 * what the schemas describe.
 */
export type {
  Manifest as ProjectManifest,
  LockFile,
  LockedArtifact,
  LockedLayer,
} from '@paradoc/schemas'

/**
 * Registry item summary (from registry.json index)
 */
export type { RegistryItemSummary, RegistryIndex } from '@paradoc/schemas'

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
  /** Configured URL before environment variables are expanded. */
  configuredUrl?: string
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
