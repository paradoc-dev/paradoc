import { LocalFileSystem } from './local-fs.js'

import { parse, validate } from '@paradoc/core'
import type { Artifact } from '@paradoc/core'

// --------------------------------------------
// Project Utilities
// --------------------------------------------

/**
 * Find the root of the project by looking for .paradoc directory
 */
export async function findRepoRoot(): Promise<string | null> {
  const storage = new LocalFileSystem()
  let currentDir = storage.getAbsolutePath(process.cwd())

  while (true) {
    // Check if .paradoc directory exists in current directory
    const paradocPath = storage.joinPath(currentDir, '.paradoc')

    try {
      const stats = await storage.stat(paradocPath)
      if (stats.isDirectory) {
        return currentDir
      }
    } catch {
      // Directory doesn't exist, continue searching
    }

    // Move up one directory
    const parentDir = storage.dirname(currentDir)

    // Stop if we've reached the root (parent is same as current)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  return null
}

/**
 * Ensure the current working directory is a valid Paradoc repository
 */
export async function ensureRepo(): Promise<string> {
  const root = await findRepoRoot()
  if (!root) {
    throw new Error("Not an Paradoc repository (no .paradoc directory found). Run 'para init' first.")
  }
  return root
}

// --------------------------------------------
// File System Utilities
// --------------------------------------------

/**
 * Scan for artifacts in the repository
 */
export async function scanArtifacts(repoRoot: string, pattern?: string): Promise<string[]> {
  const storage = new LocalFileSystem(repoRoot)
  const patterns = pattern ? [pattern] : ['*.yaml', '*.yml', '*.json', '!paradoc.json']

  const files = await storage.glob(patterns, {
    onlyFiles: true,
    ignore: ['.paradoc/**', 'node_modules/**', '.git/**', 'artifacts/**'],
  })

  return files
}

/**
 * Scan for all files in the repository (not just artifacts)
 */
export async function scanAllFiles(repoRoot: string, pattern?: string): Promise<string[]> {
  const storage = new LocalFileSystem(repoRoot)
  const patterns = pattern ? [pattern] : ['**/*', '!paradoc.json']

  const files = await storage.glob(patterns, {
    onlyFiles: true,
    ignore: ['.paradoc/**', 'node_modules/**', '.git/**'],
  })

  return files
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const storage = new LocalFileSystem()
  try {
    await storage.stat(filePath)
    return true
  } catch {
    return false
  }
}

// --------------------------------------------
// Parsing
// --------------------------------------------

/**
 * Parse and validate an artifact file
 */
export async function parseAndValidateArtifact(filePath: string): Promise<Artifact> {
  const storage = new LocalFileSystem()
  const content = await storage.readFile(filePath)

  // Parse the content (auto-detects JSON/YAML)
  const parsed = parse(content)

  // Validate the artifact
  const result = validate(parsed)
  if (result.issues) {
    const issueMessages = result.issues
      .map((issue) => {
        const path = issue.path ? issue.path.map(String).join('.') : 'root'
        return `${path}: ${issue.message}`
      })
      .join(', ')
    throw new Error(`Invalid artifact: ${issueMessages}`)
  }

  const artifact = result.value as Artifact

  // Type guard to ensure we have a valid artifact
  if (
    !artifact ||
    !artifact.kind ||
    !['form', 'document', 'checklist', 'bundle'].includes(artifact.kind)
  ) {
    const kind = artifact && 'kind' in artifact ? String(artifact.kind) : 'unknown'
    throw new Error(`Invalid artifact kind: ${kind}`)
  }

  return artifact
}

// --------------------------------------------
// Dependency detection
// --------------------------------------------

/**
 * Detect file dependencies from an artifact
 */
export function detectFileDependencies(artifact: Artifact): string[] {
  const deps: string[] = []

  // Helper to extract deps from layers
  const extractLayerDeps = (layers: Record<string, { kind: string; path?: string }>) => {
    for (const layer of Object.values(layers)) {
      if (layer.kind === 'file' && layer.path) {
        deps.push(layer.path)
      }
    }
  }

  // Forms with file-based layers
  if (artifact.kind === 'form' && artifact.layers) {
    extractLayerDeps(artifact.layers as Record<string, { kind: string; path?: string }>)
  }

  // Documents with file-based layers
  if (artifact.kind === 'document' && artifact.layers) {
    extractLayerDeps(artifact.layers as Record<string, { kind: string; path?: string }>)
  }

  // Checklists with file-based layers
  if (artifact.kind === 'checklist' && artifact.layers) {
    extractLayerDeps(artifact.layers as Record<string, { kind: string; path?: string }>)
  }

  // ContentRef file dependencies (on ArtifactBase — all kinds)
  const contentRefFields = ['instructions', 'agentInstructions'] as const
  for (const field of contentRefFields) {
    const ref = (artifact as unknown as Record<string, unknown>)[field] as { kind: string; path?: string } | undefined
    if (ref && ref.kind === 'file' && ref.path) {
      deps.push(ref.path)
    }
  }

  return deps
}

// --------------------------------------------
// Media type detection
// --------------------------------------------

/**
 * Get media type from file extension
 */
export function getMediaType(filePath: string): string {
  const storage = new LocalFileSystem()
  const ext = storage.extname(filePath).toLowerCase()
  const mediaTypes: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.yaml': 'application/yaml',
    '.yml': 'application/yaml',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  }

  return mediaTypes[ext] || 'application/octet-stream'
}
