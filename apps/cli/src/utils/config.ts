import { homedir } from 'node:os'
import { LocalFileSystem } from './local-fs.js'
import { ManifestSchema, GlobalConfigSchema, type Manifest } from '@paradoc/schemas'
import { z } from 'zod'

import type {
  GlobalConfig,
  ProjectManifest,
  RegistryEntry,
  OutputFormat,
  CacheConfig,
  RegistryCacheConfig,
} from '../types.js'
import { DEFAULT_CACHE_TTL, DEFAULT_CACHE_DIR } from './cache.js'
import {
  DEFAULT_ALLOWED_CONTENT_TYPES,
  isBlockedContentType,
} from './constants.js'

// Global storage instance for ~/.paradoc operations
const globalStorage = new LocalFileSystem(homedir())

// Default paths (relative to home directory for globalStorage)
const GLOBAL_CONFIG_DIR = '.paradoc'
const GLOBAL_CONFIG_FILE = 'config.json'
const DEFAULT_REGISTRY_URL = 'https://registry.paradoc.dev'

// Re-export Manifest type for convenience
export type { Manifest }

import type { ZodError } from 'zod'

/**
 * Format Zod validation errors into human-readable messages
 */
function formatValidationErrors(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

/**
 * Find the nearest paradoc.json file
 * @param cwd - Current working directory
 * @returns Path to paradoc.json or undefined
 */
export async function findConfig(cwd?: string): Promise<string | undefined> {
  const storage = new LocalFileSystem(cwd)
  const result = await storage.findUp('paradoc.json')
  return result ?? undefined
}

/**
 * Read and parse paradoc.json with validation
 * @param configPath - Path to paradoc.json
 * @returns Parsed and validated manifest object
 * @throws Error if the manifest is invalid
 */
export async function readConfig(configPath: string): Promise<Manifest> {
  const storage = new LocalFileSystem()
  const content = await storage.readFile(configPath)

  let data: unknown
  try {
    data = JSON.parse(content)
  } catch (e) {
    throw new Error(`Invalid JSON in ${configPath}: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Validate against manifest schema using Zod
  const result = ManifestSchema.safeParse(data)
  if (!result.success) {
    const errors = formatValidationErrors(result.error)
    throw new Error(`Invalid manifest in ${configPath}: ${errors}`)
  }

  return result.data
}

/**
 * Get the project root directory (where paradoc.json is located)
 * @param configPath - Path to paradoc.json
 * @returns Directory path
 */
export function getProjectRoot(configPath: string): string {
  const storage = new LocalFileSystem()
  return storage.dirname(configPath)
}

// ============================================================================
// Registry Configuration Manager
// ============================================================================

/**
 * Config manager for Paradoc CLI registry system
 * Handles global config (~/.paradoc/config.json) and project config (paradoc.json)
 */
export class ConfigManager {
  private globalConfig: GlobalConfig | null = null
  private projectManifest: ProjectManifest | null = null
  private projectRoot: string | null = null

  /**
   * Load the global config from ~/.paradoc/config.json
   */
  async loadGlobalConfig(): Promise<GlobalConfig> {
    if (this.globalConfig) {
      return this.globalConfig
    }

    try {
      const configPath = globalStorage.joinPath(GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE)
      const content = await globalStorage.readFile(configPath, 'utf-8')
      const data = JSON.parse(content)
      const result = GlobalConfigSchema.safeParse(data)
      this.globalConfig = result.success ? result.data : {}
    } catch {
      // Return empty config if file doesn't exist
      this.globalConfig = {}
    }

    return this.globalConfig
  }

  /**
   * Save the global config to ~/.paradoc/config.json
   */
  async saveGlobalConfig(config: GlobalConfig): Promise<void> {
    // Ensure directory exists
    await globalStorage.mkdir(GLOBAL_CONFIG_DIR, true)

    // Write config with schema
    const configWithSchema: GlobalConfig = {
      $schema: 'https://schema.paradoc.dev/cli/global-config.json',
      ...config,
    }

    const configPath = globalStorage.joinPath(GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE)
    await globalStorage.writeFile(configPath, JSON.stringify(configWithSchema, null, 2))
    this.globalConfig = configWithSchema
  }

  /**
   * Load the project manifest from paradoc.json
   */
  async loadProjectManifest(projectRoot: string): Promise<ProjectManifest | null> {
    this.projectRoot = projectRoot
    const projectStorage = new LocalFileSystem(projectRoot)
    const manifestPath = projectStorage.joinPath('paradoc.json')

    try {
      const content = await projectStorage.readFile(manifestPath, 'utf-8')
      const data = JSON.parse(content)
      // Lenient validation — ProjectManifest is broader than ManifestSchema
      const result = z.object({
        name: z.string(),
        title: z.string(),
        visibility: z.enum(['public', 'private']),
      }).passthrough().safeParse(data)
      this.projectManifest = result.success ? (result.data as ProjectManifest) : null
      return this.projectManifest
    } catch {
      return null
    }
  }

  /**
   * Save the project manifest to paradoc.json
   */
  async saveProjectManifest(manifest: ProjectManifest): Promise<void> {
    if (!this.projectRoot) {
      throw new Error('Project root not set. Call loadProjectManifest first.')
    }

    const projectStorage = new LocalFileSystem(this.projectRoot)
    const manifestPath = projectStorage.joinPath('paradoc.json')
    await projectStorage.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    this.projectManifest = manifest
  }

  /**
   * Get registry configuration for a namespace
   * Checks project config first, then global config
   */
  async getRegistry(namespace: string): Promise<RegistryEntry | null> {
    // Normalize namespace (ensure @ prefix)
    const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`

    // Check project config first
    if (this.projectManifest?.registries?.[normalizedNamespace]) {
      return this.projectManifest.registries[normalizedNamespace]
    }

    // Check global config
    const globalConfig = await this.loadGlobalConfig()
    if (globalConfig.registries?.[normalizedNamespace]) {
      return globalConfig.registries[normalizedNamespace]
    }

    // Return null if not found
    return null
  }

  /**
   * Get the resolved registry URL for a namespace
   */
  async getRegistryUrl(namespace: string): Promise<string> {
    const registry = await this.getRegistry(namespace)

    if (!registry) {
      return DEFAULT_REGISTRY_URL
    }

    if (typeof registry === 'string') {
      return this.expandEnvVars(registry)
    }

    return this.expandEnvVars(registry.url)
  }

  /**
   * Get registry headers (for authenticated registries)
   */
  async getRegistryHeaders(namespace: string): Promise<Record<string, string> | undefined> {
    const registry = await this.getRegistry(namespace)

    if (!registry || typeof registry === 'string') {
      return undefined
    }

    if (!registry.headers) {
      return undefined
    }

    // Expand environment variables in header values
    const expanded: Record<string, string> = {}
    for (const [key, value] of Object.entries(registry.headers)) {
      expanded[key] = this.expandEnvVars(value)
    }
    return expanded
  }

  /**
   * Get default output format
   * Project config takes precedence over global config
   */
  getDefaultFormat(): OutputFormat {
    if (this.projectManifest?.artifacts?.output) {
      return this.projectManifest.artifacts.output
    }

    if (this.globalConfig?.defaults?.output) {
      return this.globalConfig.defaults.output
    }

    return 'json'
  }

  /**
   * Get artifacts directory
   * Project config takes precedence over global config
   */
  getArtifactsDir(): string {
    if (this.projectManifest?.artifacts?.dir) {
      return this.projectManifest.artifacts.dir
    }

    if (this.globalConfig?.defaults?.artifactsDir) {
      return this.globalConfig.defaults.artifactsDir
    }

    return 'artifacts'
  }

  /**
   * Get default registry namespace
   * Returns undefined if no default is set
   */
  getDefaultRegistry(): string | undefined {
    return this.globalConfig?.defaults?.registry
  }

  /**
   * Get allowed content types for layer downloads.
   * Project config takes precedence over global config.
   * User-specified types are merged with defaults, blocked types are filtered out.
   *
   * @returns Array of allowed MIME types
   */
  async getAllowedContentTypes(): Promise<readonly string[]> {
    // Get user-specified additional types (project overrides global)
    let userTypes: string[] = []

    if (this.projectManifest?.security?.allowedContentTypes) {
      userTypes = this.projectManifest.security.allowedContentTypes
    } else if (this.globalConfig?.security?.allowedContentTypes) {
      userTypes = this.globalConfig.security.allowedContentTypes
    } else {
      // No user config, ensure global config is loaded to check
      const globalConfig = await this.loadGlobalConfig()
      if (globalConfig.security?.allowedContentTypes) {
        userTypes = globalConfig.security.allowedContentTypes
      }
    }

    // If no user types, return defaults
    if (userTypes.length === 0) {
      return DEFAULT_ALLOWED_CONTENT_TYPES
    }

    // Merge defaults with user types, filtering out blocked types
    const mergedTypes = new Set<string>([
      ...DEFAULT_ALLOWED_CONTENT_TYPES,
      ...userTypes.filter((type) => !isBlockedContentType(type)),
    ])

    return Array.from(mergedTypes)
  }

  /**
   * Validate that content types don't include blocked types.
   * Returns an array of blocked types that were found (empty if valid).
   *
   * @param contentTypes - Array of content types to validate
   * @returns Array of blocked types found in the input
   */
  validateContentTypesConfig(contentTypes: string[]): string[] {
    return contentTypes.filter((type) => isBlockedContentType(type))
  }

  /**
   * Add or update a registry in global config
   */
  async setGlobalRegistry(namespace: string, entry: RegistryEntry): Promise<void> {
    const config = await this.loadGlobalConfig()

    if (!config.registries) {
      config.registries = {}
    }

    const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`
    config.registries[normalizedNamespace] = entry

    await this.saveGlobalConfig(config)
  }

  /**
   * Remove a registry from global config
   */
  async removeGlobalRegistry(namespace: string): Promise<boolean> {
    const config = await this.loadGlobalConfig()

    if (!config.registries) {
      return false
    }

    const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`

    if (!(normalizedNamespace in config.registries)) {
      return false
    }

    delete config.registries[normalizedNamespace]
    await this.saveGlobalConfig(config)
    return true
  }

  /**
   * Add or update a registry in project config (paradoc.json)
   */
  async setProjectRegistry(namespace: string, entry: RegistryEntry): Promise<void> {
    if (!this.projectManifest || !this.projectRoot) {
      throw new Error('Not in an Paradoc project. Cannot save to project config.')
    }

    if (!this.projectManifest.registries) {
      this.projectManifest.registries = {}
    }

    const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`
    this.projectManifest.registries[normalizedNamespace] = entry

    await this.saveProjectManifest(this.projectManifest)
  }

  /**
   * Remove a registry from project config (paradoc.json)
   */
  async removeProjectRegistry(namespace: string): Promise<boolean> {
    if (!this.projectManifest || !this.projectRoot) {
      throw new Error('Not in an Paradoc project. Cannot modify project config.')
    }

    if (!this.projectManifest.registries) {
      return false
    }

    const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`

    if (!(normalizedNamespace in this.projectManifest.registries)) {
      return false
    }

    delete this.projectManifest.registries[normalizedNamespace]
    await this.saveProjectManifest(this.projectManifest)
    return true
  }

  /**
   * Check if currently in a project
   */
  isInProject(): boolean {
    return this.projectRoot !== null && this.projectManifest !== null
  }

  /**
   * List all configured registries
   */
  async listRegistries(): Promise<Array<{ namespace: string; url: string; source: 'global' | 'project' }>> {
    const result: Array<{ namespace: string; url: string; source: 'global' | 'project' }> = []

    // Add project registries
    if (this.projectManifest?.registries) {
      for (const [namespace, entry] of Object.entries(this.projectManifest.registries)) {
        const url = typeof entry === 'string' ? entry : entry.url
        result.push({ namespace, url, source: 'project' })
      }
    }

    // Add global registries (if not overridden by project)
    const globalConfig = await this.loadGlobalConfig()
    if (globalConfig.registries) {
      for (const [namespace, entry] of Object.entries(globalConfig.registries)) {
        if (!result.find((r) => r.namespace === namespace)) {
          const url = typeof entry === 'string' ? entry : entry.url
          result.push({ namespace, url, source: 'global' })
        }
      }
    }

    return result
  }

  // ============================================================================
  // Cache Configuration
  // ============================================================================

  /**
   * Get global cache configuration
   */
  async getGlobalCacheConfig(): Promise<CacheConfig | undefined> {
    const config = await this.loadGlobalConfig()
    return config.cache
  }

  /**
   * Get project cache configuration
   */
  getProjectCacheConfig(): CacheConfig | undefined {
    return this.projectManifest?.cache
  }

  /**
   * Get registry-specific cache configuration
   * @param namespace - Registry namespace (e.g., "@acme")
   */
  async getRegistryCacheConfig(namespace: string): Promise<RegistryCacheConfig | undefined> {
    const registry = await this.getRegistry(namespace)
    if (!registry || typeof registry === 'string') {
      return undefined
    }
    return registry.cache
  }

  /**
   * Get cache directory path
   * Global config takes precedence, falls back to default
   */
  async getCacheDirectory(): Promise<string> {
    const globalCache = await this.getGlobalCacheConfig()
    return globalCache?.directory ?? DEFAULT_CACHE_DIR
  }

  /**
   * Get the effective cache TTL for a namespace
   * Priority: per-registry > project > global > default
   *
   * @param namespace - Registry namespace (e.g., "@acme")
   * @returns TTL in seconds (0 = disabled)
   */
  async getCacheTtl(namespace: string): Promise<number> {
    // Check per-registry config
    const registryCache = await this.getRegistryCacheConfig(namespace)
    if (registryCache?.ttl !== undefined) {
      return registryCache.ttl
    }

    // Check project config
    const projectCache = this.getProjectCacheConfig()
    if (projectCache?.ttl !== undefined) {
      return projectCache.ttl
    }

    // Check global config
    const globalCache = await this.getGlobalCacheConfig()
    if (globalCache?.ttl !== undefined) {
      return globalCache.ttl
    }

    // Default TTL
    return DEFAULT_CACHE_TTL
  }

  /**
   * Get the effective cache TTL with optional command override
   * Priority: command flag > per-registry > project > global > default
   *
   * @param namespace - Registry namespace
   * @param commandTtl - Optional TTL from command flag
   * @returns TTL in seconds (0 = disabled)
   */
  async getEffectiveCacheTtl(namespace: string, commandTtl?: number): Promise<number> {
    if (commandTtl !== undefined) {
      return commandTtl
    }
    return this.getCacheTtl(namespace)
  }

  /**
   * Update global cache configuration
   * Pass an empty object to remove cache configuration (reset to defaults)
   */
  async setGlobalCacheConfig(cache: CacheConfig): Promise<void> {
    const config = await this.loadGlobalConfig()

    // If empty object, delete the cache key entirely
    if (Object.keys(cache).length === 0) {
      delete config.cache
    } else {
      config.cache = cache
    }

    await this.saveGlobalConfig(config)
  }

  /**
   * Remove global cache configuration (reset to defaults)
   */
  async resetGlobalCacheConfig(): Promise<void> {
    await this.setGlobalCacheConfig({})
  }

  /**
   * Expand environment variables in a string
   * Supports ${VAR_NAME} syntax
   */
  private expandEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      const envValue = process.env[varName]
      if (envValue === undefined) {
        throw new Error(`Environment variable not set: ${varName}`)
      }
      return envValue
    })
  }

  /**
   * Reset cached config (useful for testing)
   */
  reset(): void {
    this.globalConfig = null
    this.projectManifest = null
    this.projectRoot = null
  }
}

// Singleton instance
export const configManager = new ConfigManager()

// Convenience functions for registry config
export async function loadGlobalConfig(): Promise<GlobalConfig> {
  return configManager.loadGlobalConfig()
}

export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  return configManager.saveGlobalConfig(config)
}

export async function getRegistryUrl(namespace: string): Promise<string> {
  return configManager.getRegistryUrl(namespace)
}

export async function getRegistryHeaders(namespace: string): Promise<Record<string, string> | undefined> {
  return configManager.getRegistryHeaders(namespace)
}
