import { LocalFileSystem } from './local-fs.js'

import type { Artifact } from '@paradoc/core'
import { fileReferencesOf, loadValidatedArtifact } from './artifact-file.js'

// --------------------------------------------
// Project Utilities
// --------------------------------------------

/**
 * Find the root of the project by looking for its `.paradoc` directory and
 * `paradoc.json` together — both are what `paradoc init` writes, and both are
 * required: a `.paradoc` directory alone is not proof of a project, because
 * the CLI also writes one under the user's home directory for its own global
 * config (cache, saved preferences), with no `paradoc.json` beside it. Without
 * requiring both, a walk starting anywhere under the user's home directory
 * would stop at that global config directory and report it as the project
 * root.
 *
 * `startDir` defaults to `process.cwd()`; passed explicitly for testing.
 */
export async function findRepoRoot(startDir: string = process.cwd()): Promise<string | null> {
  const storage = new LocalFileSystem()
  let currentDir = storage.getAbsolutePath(startDir)

  while (true) {
    const paradocPath = storage.joinPath(currentDir, '.paradoc')
    const manifestPath = storage.joinPath(currentDir, 'paradoc.json')

    try {
      const [dirStats, manifestExists] = await Promise.all([
        storage.stat(paradocPath),
        storage.exists(manifestPath),
      ])
      if (dirStats.isDirectory && manifestExists) {
        return currentDir
      }
    } catch {
      // .paradoc doesn't exist here, continue searching
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
    throw new Error("Not an Paradoc repository (no .paradoc directory found). Run 'paradoc init' first.")
  }
  return root
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
  const artifact = loadValidatedArtifact(content)

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
  return [...fileReferencesOf(artifact)].map((reference) => reference.path)
}
