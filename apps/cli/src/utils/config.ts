import { LocalFileSystem } from './local-fs.js'
import { GlobalConfigSchema, ManifestSchema, type GlobalConfig } from '@paradoc/schemas'

import type {
  ProjectManifest,
  RegistryEntry,
  OutputFormat,
  CacheConfig,
  RegistryCacheConfig,
} from '../types.js'
import { DEFAULT_CACHE_TTL, defaultCacheDir } from './cache.js'
import { userHomeDir } from './home.js'
import {
  DEFAULT_ALLOWED_CONTENT_TYPES,
  isBlockedContentType,
} from './constants.js'

// Default paths (relative to the home directory)
const GLOBAL_CONFIG_DIR = '.paradoc'
const GLOBAL_CONFIG_FILE = 'config.json'
const GLOBAL_CONFIG_SCHEMA_URL = 'https://schema.paradoc.dev/config.json'

import type { ZodError } from 'zod'

/** The reserved, built-in registry namespace. */
export const PARADOC_NAMESPACE = '@paradoc'

/** Where {@link PARADOC_NAMESPACE} always resolves. No configuration can change it. */
export const PARADOC_REGISTRY_URL = 'https://registry.paradoc.dev'

/** A namespace with its `@` prefix. */
export function normalizeNamespace(namespace: string): string {
  return namespace.startsWith('@') ? namespace : `@${namespace}`
}

/** Whether a namespace is the reserved `@paradoc`, in any case. */
export function isReservedNamespace(namespace: string): boolean {
  return normalizeNamespace(namespace).toLowerCase() === PARADOC_NAMESPACE
}

function reservedNamespaceMessage(namespace: string): string {
  return `${normalizeNamespace(namespace)} is reserved and always resolves to ${PARADOC_REGISTRY_URL}; it cannot be configured`
}

/** Throw when a namespace is reserved and so cannot be configured. */
export function assertConfigurableNamespace(namespace: string): void {
  if (isReservedNamespace(namespace)) {
    throw new Error(reservedNamespaceMessage(namespace))
  }
}

/** Describe each registries entry that configures a reserved namespace, or return undefined. */
function reservedRegistryIssues(registries: Record<string, unknown> | undefined): string | undefined {
  const reserved = Object.keys(registries ?? {}).filter(isReservedNamespace)
  if (reserved.length === 0) return undefined
  return reserved.map((key) => `"registries.${key}": ${reservedNamespaceMessage(key)}`).join('; ')
}

/** A namespace that neither is built in nor has a registry configured. */
export class UnconfiguredRegistryError extends Error {
  constructor(public readonly namespace: string) {
    super(`No registry is configured for ${namespace}. Run: paradoc registry add ${namespace} <url>`)
    this.name = 'UnconfiguredRegistryError'
  }
}

/**
 * Describe each config problem by key: unknown keys by name, other
 * problems by their dotted path.
 */
export function formatConfigIssues(error: ZodError): string {
  return error.issues
    .flatMap((issue) => {
      const prefix = issue.path.length > 0 ? `${issue.path.join('.')}.` : ''
      if (issue.code === 'unrecognized_keys') {
        return issue.keys.map((key) => `unknown key "${prefix}${key}"`)
      }
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root'
      return [`"${path}": ${issue.message}`]
    })
    .join('; ')
}

export function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT'
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

/** A registry entry as configured in one scope. */
export interface ConfiguredRegistry {
  namespace: string
  url: string
  source: 'global' | 'project'
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
  private readonly globalStorage: LocalFileSystem

  /**
   * @param homeDir - Directory that holds `.paradoc/config.json`. Defaults to the user's home.
   */
  constructor(homeDir: string = userHomeDir()) {
    this.globalStorage = new LocalFileSystem(homeDir)
  }

  /**
   * Absolute path of the global config file
   */
  getGlobalConfigPath(): string {
    return this.globalStorage.joinPath(GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE)
  }

  /**
   * Load the global config from ~/.paradoc/config.json.
   *
   * A missing file loads as an empty config. Invalid JSON or a config the
   * schema rejects throws an error naming the file and each bad key; the file
   * is left as it is.
   */
  async loadGlobalConfig(): Promise<GlobalConfig> {
    if (this.globalConfig) {
      return this.globalConfig
    }

    const configPath = this.getGlobalConfigPath()
    let content: string
    try {
      content = await this.globalStorage.readFile(configPath, 'utf-8')
    } catch (error) {
      if (isMissingFileError(error)) {
        this.globalConfig = {}
        return this.globalConfig
      }
      throw error
    }

    let data: unknown
    try {
      data = JSON.parse(content)
    } catch (error) {
      throw new Error(
        `Invalid JSON in ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const result = GlobalConfigSchema.safeParse(data)
    if (!result.success) {
      throw new Error(`Invalid global config in ${configPath}: ${formatConfigIssues(result.error)}`)
    }
    const reserved = reservedRegistryIssues(result.data.registries)
    if (reserved) {
      throw new Error(`Invalid global config in ${configPath}: ${reserved}`)
    }

    this.globalConfig = result.data
    return this.globalConfig
  }

  /**
   * Save the global config to ~/.paradoc/config.json.
   * The config is validated first; an invalid config throws and nothing is written.
   */
  async saveGlobalConfig(config: GlobalConfig): Promise<void> {
    const configPath = this.getGlobalConfigPath()
    const { $schema: _schema, ...settings } = config
    const configWithSchema: GlobalConfig = { $schema: GLOBAL_CONFIG_SCHEMA_URL, ...settings }
    const result = GlobalConfigSchema.safeParse(configWithSchema)
    if (!result.success) {
      throw new Error(
        `Refusing to write an invalid global config to ${configPath}: ${formatConfigIssues(result.error)}`,
      )
    }

    await this.globalStorage.mkdir(GLOBAL_CONFIG_DIR, true)
    await this.globalStorage.writeFile(configPath, JSON.stringify(configWithSchema, null, 2))
    this.globalConfig = result.data
  }

  /**
   * Load the project manifest from paradoc.json.
   *
   * A missing manifest loads as null. Invalid JSON, a manifest the manifest
   * schema refuses, or one that configures a reserved registry namespace
   * throws an error naming the file.
   */
  async loadProjectManifest(projectRoot: string): Promise<ProjectManifest | null> {
    this.projectRoot = projectRoot
    this.projectManifest = null
    const projectStorage = new LocalFileSystem(projectRoot)
    const manifestPath = projectStorage.joinPath('paradoc.json')

    let content: string
    try {
      content = await projectStorage.readFile(manifestPath, 'utf-8')
    } catch (error) {
      if (isMissingFileError(error)) return null
      throw error
    }

    let data: unknown
    try {
      data = JSON.parse(content)
    } catch (error) {
      throw new Error(
        `Invalid JSON in ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const result = ManifestSchema.safeParse(data)
    if (!result.success) {
      throw new Error(`Invalid project config in ${manifestPath}: ${formatConfigIssues(result.error)}`)
    }
    const reserved = reservedRegistryIssues(result.data.registries)
    if (reserved) {
      throw new Error(`Invalid project config in ${manifestPath}: ${reserved}`)
    }
    this.projectManifest = result.data
    return this.projectManifest
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
    const normalizedNamespace = normalizeNamespace(namespace)

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
   * Get the resolved registry URL for a namespace.
   *
   * `@paradoc` always resolves to {@link PARADOC_REGISTRY_URL}. Every other
   * namespace resolves only through configuration; an unconfigured one throws
   * {@link UnconfiguredRegistryError}.
   */
  async getRegistryUrl(namespace: string): Promise<string> {
    const normalizedNamespace = normalizeNamespace(namespace)
    // Loads the config first, so a config that configures @paradoc fails here too.
    const registry = await this.getRegistry(normalizedNamespace)

    if (isReservedNamespace(normalizedNamespace)) {
      return PARADOC_REGISTRY_URL
    }

    if (!registry) {
      throw new UnconfiguredRegistryError(normalizedNamespace)
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
    assertConfigurableNamespace(namespace)
    const config = await this.loadGlobalConfig()

    if (!config.registries) {
      config.registries = {}
    }

    const normalizedNamespace = normalizeNamespace(namespace)
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

    const normalizedNamespace = normalizeNamespace(namespace)

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
    assertConfigurableNamespace(namespace)
    if (!this.projectManifest || !this.projectRoot) {
      throw new Error('Not in an Paradoc project. Cannot save to project config.')
    }

    if (!this.projectManifest.registries) {
      this.projectManifest.registries = {}
    }

    const normalizedNamespace = normalizeNamespace(namespace)
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

    const normalizedNamespace = normalizeNamespace(namespace)

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
   * List configured registries.
   *
   * With no scope, lists the registries in effect: project entries, then global
   * entries a project entry does not override. With a scope, lists every entry
   * of that config only.
   */
  async listRegistries(scope?: ConfiguredRegistry['source']): Promise<ConfiguredRegistry[]> {
    const entries = (registries: Record<string, RegistryEntry> | undefined, source: ConfiguredRegistry['source']) =>
      Object.entries(registries ?? {}).map(([namespace, entry]) => ({
        namespace,
        url: typeof entry === 'string' ? entry : entry.url,
        source,
      }))

    const project = entries(this.projectManifest?.registries, 'project')
    if (scope === 'project') return project

    const global = entries((await this.loadGlobalConfig()).registries, 'global')
    if (scope === 'global') return global

    return [...project, ...global.filter((g) => !project.some((p) => p.namespace === g.namespace))]
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
    return globalCache?.directory ?? defaultCacheDir()
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
