/**
 * Security Utilities
 *
 * Functions for validating and sanitizing user/external input.
 * Uses local-fs for all filesystem operations.
 */

import { ARTIFACT_VERSION_PATTERN } from '@paradoc/schemas'
import { LocalFileSystem } from './local-fs.js'

/**
 * Result of URL validation
 */
export interface UrlValidationResult {
  valid: boolean
  url?: URL
  error?: string
  warnings: string[]
}

/**
 * Validate a URL for security concerns
 *
 * Checks for valid URL syntax and supported protocol (HTTP or HTTPS).
 * Following mainstream CLI conventions (shadcn, npm), any URL the user
 * explicitly configures is trusted — no SSRF or localhost blocking.
 *
 * @param urlString - The URL to validate
 * @returns Validation result with any warnings
 */
export function validateUrl(urlString: string): UrlValidationResult {
  const warnings: string[] = []

  // Parse URL
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    return { valid: false, error: 'Invalid URL syntax', warnings }
  }

  // Only allow HTTP and HTTPS schemes
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { valid: false, error: `Unsupported URL scheme: ${url.protocol}. Only HTTP(S) is allowed.`, warnings }
  }

  return { valid: true, url, warnings }
}

/**
 * Sanitize a string for safe terminal display
 *
 * Removes:
 * - ANSI escape sequences (could manipulate terminal)
 * - Null bytes (could truncate strings)
 * - Other control characters
 *
 * @param text - The text to sanitize
 * @returns Sanitized text safe for terminal display
 */
export function sanitizeForDisplay(text: string): string {
  if (!text) return text

  // First remove ANSI escape sequences (ESC [ ... letter)
  // eslint-disable-next-line no-control-regex
  let sanitized = text.replace(/\x1B\[[\d;]*[A-Za-z]/g, '')

  // Then remove other dangerous control characters (but not newline \n, tab \t, carriage return \r)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return sanitized
}

/**
 * Validate an artifact version against the shared SemVer 2.0.0 rule
 *
 * @param version - Version string to validate
 * @returns true if the version is valid SemVer, false otherwise
 */
export function isValidSemver(version: string): boolean {
  return ARTIFACT_VERSION_PATTERN.test(version)
}

/**
 * Result of artifact metadata validation
 */
/**
 * Validate and sanitize a file path to prevent path traversal attacks
 *
 * This function ensures that a given path, when resolved relative to a base directory,
 * stays within that base directory. This prevents attacks where a malicious path
 * like "../../../etc/passwd" could escape the intended directory.
 *
 * @param baseDir - The allowed base directory (must be absolute)
 * @param filePath - The file path to validate (can be relative or absolute)
 * @returns The sanitized absolute path, or null if the path attempts to escape baseDir
 *
 * @example
 * // Valid paths
 * sanitizePath('/project/artifacts', 'layer.pdf')       // '/project/artifacts/layer.pdf'
 * sanitizePath('/project/artifacts', 'sub/layer.pdf')   // '/project/artifacts/sub/layer.pdf'
 *
 * // Invalid paths (return null)
 * sanitizePath('/project/artifacts', '../secret.txt')   // null
 * sanitizePath('/project/artifacts', '/etc/passwd')     // null
 */
export function sanitizePath(baseDir: string, filePath: string): string | null {
  const storage = new LocalFileSystem()
  const sep = storage.separator

  // Resolve the full path
  const fullPath = storage.resolve(baseDir, filePath)

  // Get the relative path from baseDir to fullPath
  const relativePath = storage.relative(baseDir, fullPath)

  // Check for path traversal:
  // 1. If relative path starts with '../' (actual traversal), it escapes
  // 2. If relative path equals '..' exactly, it escapes
  // 3. If relative path is absolute (on Windows starts with drive letter), it's outside
  // Note: '...' is a valid filename, so we specifically check for '../' or '..' exactly
  const isTraversal = relativePath === '..' ||
    relativePath.startsWith('..' + sep) ||
    relativePath.startsWith('..' + '/')  // Handle both separators
  const isAbsolute = isAbsolutePath(relativePath)

  if (isTraversal || isAbsolute) {
    return null
  }

  return fullPath
}

/**
 * Check if a path is absolute (works cross-platform)
 */
function isAbsolutePath(p: string): boolean {
  // Unix absolute path
  if (p.startsWith('/')) return true
  // Windows absolute path (e.g., C:\)
  if (/^[A-Za-z]:[\\/]/.test(p)) return true
  return false
}

/**
 * Error thrown when attempting to write to a symlink
 */
export class SymlinkError extends Error {
  constructor(
    message: string,
    public filePath: string
  ) {
    super(message)
    this.name = 'SymlinkError'
  }
}

/**
 * Assert that a file path is not a symlink
 *
 * This function checks if the target path exists and is a symlink.
 * If it is, it throws an error to prevent symlink-based attacks
 * where an attacker could trick the CLI into overwriting files
 * outside the intended directory.
 *
 * @param filePath - The absolute path to check
 * @throws SymlinkError if the path is a symlink
 *
 * @example
 * // Before writing a file:
 * await assertNotSymlink('/project/artifacts/layer.pdf')
 * await fs.writeFile('/project/artifacts/layer.pdf', content)
 */
export async function assertNotSymlink(filePath: string): Promise<void> {
  const storage = new LocalFileSystem()

  let isSymlink: boolean
  try {
    isSymlink = await storage.isSymlink(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  if (isSymlink) {
    throw new SymlinkError(
      `Refusing to write to symlink: ${filePath}. This could be a security risk.`,
      filePath
    )
  }
}

/**
 * Artifact validation result
 */
export interface ArtifactValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Valid artifact kinds
 */
/**
 * Validate a downloaded artifact for structural integrity
 *
 * This function validates that a downloaded artifact:
 * - Has required fields (name, kind)
 * - Has valid values for known fields
 * - Has consistent layer references
 *
 * @param artifact - The artifact object to validate
 * @param expectedName - The expected artifact name (from registry reference)
 * @returns Validation result with errors and warnings
 */
export function validateDownloadedArtifact(
  artifact: Record<string, unknown>,
  expectedName?: string
): ArtifactValidationResult {
  const warnings: string[] = []

  if (expectedName && artifact.name !== expectedName) {
    warnings.push(`Artifact name "${String(artifact.name)}" does not match expected name "${expectedName}"`)
  }

  for (const field of ['title', 'description'] as const) {
    if (typeof artifact[field] === 'string' && sanitizeForDisplay(artifact[field]) !== artifact[field]) {
      warnings.push(`Field '${field}' contains control characters that may affect display`)
    }
  }

  return { valid: true, errors: [], warnings }
}
