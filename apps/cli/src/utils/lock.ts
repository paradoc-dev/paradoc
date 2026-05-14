/**
 * Lock File Manager
 *
 * Manages .paradoc/lock.json for tracking installed artifacts
 */

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { LocalFileSystem } from './local-fs.js'

import type {
  ArtifactKind,
  LockFile,
  LockedArtifact,
  LockedLayer,
  OutputFormat,
} from '../types.js'

// Lock file path within project
const LOCK_FILE_DIR = '.paradoc'
const LOCK_FILE_NAME = 'lock.json'
const LOCK_FILE_VERSION = 1

/**
 * Lock file manager for tracking installed artifacts
 */
export class LockFileManager {
  private lockFile: LockFile | null = null
  private projectRoot: string | null = null
  private storage: LocalFileSystem | null = null
  private dirty = false

  /**
   * Initialize the lock file manager for a project
   * @param projectRoot - Root directory of the project
   */
  async init(projectRoot: string): Promise<void> {
    this.projectRoot = projectRoot
    this.storage = new LocalFileSystem(projectRoot)
    await this.load()
  }

  /**
   * Load the lock file from disk
   */
  async load(): Promise<LockFile> {
    if (!this.projectRoot || !this.storage) {
      throw new Error('Lock file manager not initialized. Call init() first.')
    }

    const lockPath = this.getLockPath()

    try {
      const content = await this.storage.readFile(lockPath, 'utf-8')
      const data = JSON.parse(content)
      // Lenient validation — LockFile CLI type is broader than LockFileSchema
      const result = z.object({
        version: z.number(),
        artifacts: z.record(z.string(), z.object({}).passthrough()),
      }).passthrough().safeParse(data)
      this.lockFile = result.success ? (result.data as unknown as LockFile) : {
        $schema: 'https://schema.paradoc.dev/cli/lock.json',
        version: LOCK_FILE_VERSION,
        artifacts: {},
      }
    } catch {
      // Create empty lock file if it doesn't exist
      this.lockFile = {
        $schema: 'https://schema.paradoc.dev/cli/lock.json',
        version: LOCK_FILE_VERSION,
        artifacts: {},
      }
    }

    this.dirty = false
    return this.lockFile
  }

  /**
   * Save the lock file to disk
   */
  async save(): Promise<void> {
    if (!this.projectRoot || !this.lockFile || !this.storage) {
      throw new Error('Lock file manager not initialized.')
    }

    // Ensure directory exists
    const lockDir = this.storage.joinPath(LOCK_FILE_DIR)
    await this.storage.mkdir(lockDir, true)

    const lockPath = this.getLockPath()
    await this.storage.writeFile(lockPath, JSON.stringify(this.lockFile, null, 2))
    this.dirty = false
  }

  /**
   * Save only if there are changes
   */
  async saveIfDirty(): Promise<void> {
    if (this.dirty) {
      await this.save()
    }
  }

  /**
   * Get the path to the lock file
   */
  getLockPath(): string {
    if (!this.projectRoot || !this.storage) {
      throw new Error('Lock file manager not initialized.')
    }
    return this.storage.joinPath(LOCK_FILE_DIR, LOCK_FILE_NAME)
  }

  /**
   * Check if an artifact is installed
   * @param artifactRef - Full artifact reference (e.g., "@acme/residential-lease")
   */
  isInstalled(artifactRef: string): boolean {
    if (!this.lockFile) return false
    return artifactRef in this.lockFile.artifacts
  }

  /**
   * Get installed artifact info
   * @param artifactRef - Full artifact reference
   */
  getArtifact(artifactRef: string): LockedArtifact | null {
    if (!this.lockFile) return null
    return this.lockFile.artifacts[artifactRef] || null
  }

  /**
   * Add or update an installed artifact
   * @param artifactRef - Full artifact reference
   * @param info - Artifact installation info
   */
  setArtifact(artifactRef: string, info: Omit<LockedArtifact, 'installedAt'>): void {
    if (!this.lockFile) {
      throw new Error('Lock file not loaded.')
    }

    this.lockFile.artifacts[artifactRef] = {
      ...info,
      installedAt: new Date().toISOString(),
    }
    this.dirty = true
  }

  /**
   * Remove an installed artifact
   * @param artifactRef - Full artifact reference
   * @returns true if removed, false if not found
   */
  removeArtifact(artifactRef: string): boolean {
    if (!this.lockFile) return false

    if (artifactRef in this.lockFile.artifacts) {
      delete this.lockFile.artifacts[artifactRef]
      this.dirty = true
      return true
    }
    return false
  }

  /**
   * List all installed artifacts
   */
  listArtifacts(): Array<{ ref: string; info: LockedArtifact }> {
    if (!this.lockFile) return []

    return Object.entries(this.lockFile.artifacts).map(([ref, info]) => ({
      ref,
      info,
    }))
  }

  /**
   * Get all installed artifacts for a namespace
   * @param namespace - Namespace (with @ prefix)
   */
  getArtifactsByNamespace(namespace: string): Array<{ ref: string; info: LockedArtifact }> {
    const normalizedNamespace = namespace.startsWith('@') ? namespace : `@${namespace}`
    return this.listArtifacts().filter(({ ref }) => ref.startsWith(`${normalizedNamespace}/`))
  }

  /**
   * Check if the installed version matches the requested version
   * @param artifactRef - Full artifact reference
   * @param version - Version to check
   */
  isVersionMatch(artifactRef: string, version: string): boolean {
    const artifact = this.getArtifact(artifactRef)
    return artifact?.version === version
  }

  /**
   * Compute integrity hash for content
   * @param content - Content to hash
   */
  computeIntegrity(content: string | Buffer): string {
    const hash = createHash('sha256')
      .update(content)
      .digest('base64')
    return `sha256-${hash}`
  }

  /**
   * Verify integrity of installed artifact
   * @param artifactRef - Full artifact reference
   * @param content - Current content
   */
  verifyIntegrity(artifactRef: string, content: string | Buffer): boolean {
    const artifact = this.getArtifact(artifactRef)
    if (!artifact) return false

    const currentIntegrity = this.computeIntegrity(content)
    return artifact.integrity === currentIntegrity
  }

  /**
   * Create a locked artifact entry
   */
  createLockedArtifact(params: {
    kind: ArtifactKind
    version: string
    resolved: string
    content: string | Buffer
    output: OutputFormat
    path: string
    layers?: Record<string, { content: string | Buffer; path: string }>
  }): Omit<LockedArtifact, 'installedAt'> {
    const layers: Record<string, LockedLayer> = {}

    if (params.layers) {
      for (const [name, layer] of Object.entries(params.layers)) {
        layers[name] = {
          integrity: this.computeIntegrity(layer.content),
          path: layer.path,
        }
      }
    }

    return {
      kind: params.kind,
      version: params.version,
      resolved: params.resolved,
      integrity: this.computeIntegrity(params.content),
      output: params.output,
      path: params.path,
      layers,
    }
  }

  /**
   * Reset the manager (for testing)
   */
  reset(): void {
    this.lockFile = null
    this.projectRoot = null
    this.storage = null
    this.dirty = false
  }
}

// Singleton instance
export const lockFileManager = new LockFileManager()
