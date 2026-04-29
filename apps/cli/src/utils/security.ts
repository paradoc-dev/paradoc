/**
 * Security Utilities
 *
 * Functions for validating and sanitizing user/external input.
 * Uses local-fs for all filesystem operations.
 */

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

// Pattern for valid artifact/layer names (must start with letter)
const SAFE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9-_]*$/

/**
 * Validate an artifact or layer name
 *
 * @param name - The name to validate
 * @param maxLength - Maximum allowed length (default 128)
 * @returns true if valid, false otherwise
 */
export function isValidName(name: string, maxLength: number = 128): boolean {
  if (!name || name.length > maxLength) {
    return false
  }
  return SAFE_NAME_PATTERN.test(name)
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
 * Validate a semantic version string
 *
 * @param version - Version string to validate
 * @returns true if valid semver format, false otherwise
 */
export function isValidSemver(version: string): boolean {
  if (!version) return false
  // Basic semver pattern: major.minor.patch with optional prerelease/metadata
  const semverPattern = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/
  return semverPattern.test(version)
}

/**
 * Result of artifact metadata validation
 */
export interface MetadataValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  sanitized: {
    name?: string
    title?: string
    description?: string
    version?: string
  }
}

/**
 * Validate and sanitize artifact metadata
 *
 * @param metadata - Artifact metadata to validate
 * @returns Validation result with sanitized values
 */
export function validateArtifactMetadata(metadata: {
  name?: string
  title?: string
  description?: string
  version?: string
  kind?: string
}): MetadataValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const sanitized: MetadataValidationResult['sanitized'] = {}

  // Validate name
  if (metadata.name) {
    if (!isValidName(metadata.name)) {
      errors.push(`Invalid artifact name: "${metadata.name}". Names must be alphanumeric with hyphens/underscores.`)
    }
    sanitized.name = metadata.name
  }

  // Validate and sanitize title
  if (metadata.title) {
    const sanitizedTitle = sanitizeForDisplay(metadata.title)
    if (sanitizedTitle !== metadata.title) {
      warnings.push('Title contained potentially unsafe characters that were removed.')
    }
    sanitized.title = sanitizedTitle
  }

  // Validate and sanitize description
  if (metadata.description) {
    const sanitizedDesc = sanitizeForDisplay(metadata.description)
    if (sanitizedDesc !== metadata.description) {
      warnings.push('Description contained potentially unsafe characters that were removed.')
    }
    sanitized.description = sanitizedDesc
  }

  // Validate version
  if (metadata.version) {
    if (!isValidSemver(metadata.version)) {
      errors.push(`Invalid version: "${metadata.version}". Must be valid semver (e.g., 1.0.0).`)
    }
    sanitized.version = metadata.version
  }

  // Validate kind
  if (metadata.kind) {
    const validKinds = ['form', 'document', 'checklist', 'bundle']
    if (!validKinds.includes(metadata.kind)) {
      errors.push(`Invalid kind: "${metadata.kind}". Must be one of: ${validKinds.join(', ')}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized,
  }
}

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

  // First check if file exists
  const exists = await storage.exists(filePath)
  if (!exists) {
    // File doesn't exist yet, which is fine for new files
    return
  }

  // Check if it's a symlink
  const isSymlink = await storage.isSymlink(filePath)
  if (isSymlink) {
    throw new SymlinkError(
      `Refusing to write to symlink: ${filePath}. This could be a security risk.`,
      filePath
    )
  }
}

/**
 * Check if a path is a symlink without throwing
 *
 * @param filePath - The path to check
 * @returns Object with isSymlink flag and any error details
 */
export async function checkSymlink(filePath: string): Promise<{
  isSymlink: boolean
  exists: boolean
  error?: string
}> {
  const storage = new LocalFileSystem()

  try {
    const exists = await storage.exists(filePath)
    if (!exists) {
      return {
        isSymlink: false,
        exists: false,
      }
    }

    const isSymlink = await storage.isSymlink(filePath)
    return {
      isSymlink,
      exists: true,
    }
  } catch (err) {
    return {
      isSymlink: false,
      exists: false,
      error: (err as Error).message,
    }
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
const VALID_ARTIFACT_KINDS = ['form', 'document', 'checklist', 'bundle'] as const

/**
 * Name pattern from schema: starts with letter/digit, allows letters, numbers, hyphens (no leading/trailing/consecutive hyphens)
 */
const ARTIFACT_NAME_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$/

/**
 * Magic byte signature - can have multiple signatures that ALL must match
 * (e.g., WebP needs RIFF at offset 0 AND WEBP at offset 8)
 */
interface MagicSignature {
  /** All parts must match for this signature to be valid */
  parts: { bytes: number[]; offset?: number }[]
}

/**
 * Magic bytes for common file types
 * Each type has an array of alternative signatures - if ANY signature matches, the type is detected
 * Each signature has parts that must ALL match (for complex formats like WebP)
 */
const MAGIC_BYTES: Record<string, MagicSignature[]> = {
  'application/pdf': [{ parts: [{ bytes: [0x25, 0x50, 0x44, 0x46] }] }], // %PDF
  'image/png': [{ parts: [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }] }],
  'image/jpeg': [{ parts: [{ bytes: [0xff, 0xd8, 0xff] }] }],
  'image/gif': [
    { parts: [{ bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }] }, // GIF87a
    { parts: [{ bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }] }, // GIF89a
  ],
  'image/webp': [
    {
      parts: [
        { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
        { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP
      ],
    },
  ],
  'application/zip': [{ parts: [{ bytes: [0x50, 0x4b, 0x03, 0x04] }] }],
  'application/gzip': [{ parts: [{ bytes: [0x1f, 0x8b] }] }],
  'application/json': [], // Special case: validated by parsing
  'text/plain': [], // Text files don't have magic bytes
  'text/html': [], // Text-based, no magic bytes
  'text/css': [], // Text-based, no magic bytes
  'application/javascript': [], // Text-based, no magic bytes
}

/**
 * Content type validation result
 */
export interface ContentTypeValidationResult {
  valid: boolean
  detectedType?: string
  error?: string
}

/**
 * Validate that downloaded content matches the expected MIME type
 *
 * Uses magic bytes to detect actual file type and compares with expected type.
 * For text-based types, performs basic content validation.
 *
 * @param content - The downloaded content (ArrayBuffer or string)
 * @param expectedMimeType - The expected MIME type
 * @returns Validation result
 */
export function validateContentType(
  content: ArrayBuffer | string,
  expectedMimeType: string
): ContentTypeValidationResult {
  const normalizedType = (expectedMimeType.toLowerCase().split(';')[0] ?? '').trim()

  // For string content, validate text-based types
  if (typeof content === 'string') {
    // JSON validation
    if (normalizedType === 'application/json') {
      try {
        JSON.parse(content)
        return { valid: true, detectedType: 'application/json' }
      } catch {
        return {
          valid: false,
          error: 'Content is not valid JSON',
          detectedType: 'text/plain',
        }
      }
    }

    // HTML detection
    if (normalizedType === 'text/html') {
      const trimmed = content.trim().toLowerCase()
      if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) {
        return { valid: true, detectedType: 'text/html' }
      }
      // Allow as it might be a fragment
      return { valid: true, detectedType: 'text/html' }
    }

    // Text types - generally valid for string content
    if (normalizedType.startsWith('text/') || normalizedType === 'application/javascript') {
      return { valid: true, detectedType: normalizedType }
    }

    // For binary types received as string, this is suspicious
    if (MAGIC_BYTES[normalizedType] && MAGIC_BYTES[normalizedType].length > 0) {
      return {
        valid: false,
        error: `Expected binary content for ${normalizedType}, but received text`,
        detectedType: 'text/plain',
      }
    }

    return { valid: true, detectedType: normalizedType }
  }

  // For ArrayBuffer content, check magic bytes
  const bytes = new Uint8Array(content)

  // Check known magic bytes
  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    if (signatures.length === 0) continue

    // Check if ANY signature matches (alternatives like GIF87a vs GIF89a)
    const anySignatureMatches = signatures.some((signature) => {
      // ALL parts of the signature must match
      return signature.parts.every((part) => {
        const offset = part.offset || 0
        if (bytes.length < offset + part.bytes.length) return false
        return part.bytes.every((byte, i) => bytes[offset + i] === byte)
      })
    })

    if (anySignatureMatches) {
      // Found a match
      if (mimeType === normalizedType) {
        return { valid: true, detectedType: mimeType }
      }
      // Type mismatch
      return {
        valid: false,
        error: `Content appears to be ${mimeType}, but expected ${normalizedType}`,
        detectedType: mimeType,
      }
    }
  }

  // No magic bytes matched - could be unknown binary or corrupted
  // For types we know should have magic bytes, this is a warning
  if (MAGIC_BYTES[normalizedType] && MAGIC_BYTES[normalizedType].length > 0) {
    return {
      valid: false,
      error: `Could not verify content type. Expected ${normalizedType} signature not found.`,
    }
  }

  // For unknown types, we can't validate
  return { valid: true, detectedType: normalizedType }
}

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
  const errors: string[] = []
  const warnings: string[] = []

  // Check for required 'name' field
  if (!artifact.name) {
    errors.push("Missing required field: 'name'")
  } else if (typeof artifact.name !== 'string') {
    errors.push("Field 'name' must be a string")
  } else {
    // Validate name format
    if (!ARTIFACT_NAME_PATTERN.test(artifact.name)) {
      errors.push(`Invalid artifact name format: "${artifact.name}". Names must start with a letter or digit and contain only letters, numbers, and non-consecutive hyphens.`)
    }

    // Check if name matches expected
    if (expectedName && artifact.name !== expectedName) {
      warnings.push(`Artifact name "${artifact.name}" does not match expected name "${expectedName}"`)
    }
  }

  // Check for required 'kind' field
  if (!artifact.kind) {
    errors.push("Missing required field: 'kind'")
  } else if (typeof artifact.kind !== 'string') {
    errors.push("Field 'kind' must be a string")
  } else if (!VALID_ARTIFACT_KINDS.includes(artifact.kind as typeof VALID_ARTIFACT_KINDS[number])) {
    errors.push(`Invalid artifact kind: "${artifact.kind}". Must be one of: ${VALID_ARTIFACT_KINDS.join(', ')}`)
  }

  // Validate version if present
  if (artifact.version !== undefined) {
    if (typeof artifact.version !== 'string') {
      errors.push("Field 'version' must be a string")
    } else if (!isValidSemver(artifact.version)) {
      warnings.push(`Version "${artifact.version}" is not valid semver format (expected: X.Y.Z)`)
    }
  }

  // Check recommended fields
  if (!artifact.title) {
    warnings.push("Missing recommended field: 'title'")
  }

  // Validate layers if present
  if (artifact.layers !== undefined) {
    if (typeof artifact.layers !== 'object' || artifact.layers === null || Array.isArray(artifact.layers)) {
      errors.push("Field 'layers' must be an object")
    } else {
      const layers = artifact.layers as Record<string, unknown>
      for (const [layerKey, layerValue] of Object.entries(layers)) {
        if (typeof layerValue !== 'object' || layerValue === null) {
          errors.push(`Layer "${layerKey}" must be an object`)
          continue
        }

        const layer = layerValue as Record<string, unknown>

        // Validate layer kind
        if (!layer.kind) {
          errors.push(`Layer "${layerKey}" is missing required field 'kind'`)
        } else if (layer.kind !== 'inline' && layer.kind !== 'file') {
          errors.push(`Layer "${layerKey}" has invalid kind: "${layer.kind}". Must be 'inline' or 'file'.`)
        }

        // Validate layer mimeType
        if (!layer.mimeType) {
          warnings.push(`Layer "${layerKey}" is missing recommended field 'mimeType'`)
        } else if (typeof layer.mimeType !== 'string') {
          errors.push(`Layer "${layerKey}" field 'mimeType' must be a string`)
        }

        // Validate file layers have path
        if (layer.kind === 'file' && !layer.path) {
          errors.push(`File layer "${layerKey}" is missing required field 'path'`)
        }

        // Validate inline layers have text
        if (layer.kind === 'inline' && layer.text === undefined) {
          errors.push(`Inline layer "${layerKey}" is missing required field 'text'`)
        }
      }
    }
  }

  // Validate ContentRef fields (instructions, agentInstructions) — on ArtifactBase, all kinds
  const contentRefFields = ['instructions', 'agentInstructions'] as const
  for (const field of contentRefFields) {
    const ref = artifact[field]
    if (ref === undefined) continue

    if (typeof ref !== 'object' || ref === null || Array.isArray(ref)) {
      errors.push(`Field '${field}' must be an object`)
      continue
    }

    const refObj = ref as Record<string, unknown>
    if (!refObj.kind) {
      errors.push(`Field '${field}' is missing required field 'kind'`)
    } else if (refObj.kind === 'file') {
      if (!refObj.path || typeof refObj.path !== 'string') {
        errors.push(`File-based '${field}' is missing required field 'path'`)
      }
      if (!refObj.mimeType || typeof refObj.mimeType !== 'string') {
        errors.push(`File-based '${field}' is missing required field 'mimeType'`)
      }
    } else if (refObj.kind === 'inline') {
      if (!refObj.text || typeof refObj.text !== 'string') {
        errors.push(`Inline '${field}' is missing required field 'text'`)
      }
    } else {
      errors.push(`Field '${field}' has invalid kind: "${String(refObj.kind)}". Must be 'inline' or 'file'.`)
    }
  }

  // Kind-specific validation
  if (artifact.kind === 'form') {
    // Forms should have fields or fieldsets
    if (!artifact.fields && !artifact.fieldsets) {
      warnings.push("Form artifact has no 'fields' or 'fieldsets' defined")
    }
  } else if (artifact.kind === 'checklist') {
    // Checklists should have items
    if (!artifact.items) {
      warnings.push("Checklist artifact has no 'items' defined")
    }
  } else if (artifact.kind === 'bundle') {
    // Bundles should have items
    if (!artifact.items) {
      warnings.push("Bundle artifact has no 'items' defined")
    }
  }

  // Sanitize string fields that will be displayed
  const displayFields = ['title', 'description'] as const
  for (const field of displayFields) {
    if (artifact[field] && typeof artifact[field] === 'string') {
      const sanitized = sanitizeForDisplay(artifact[field] as string)
      if (sanitized !== artifact[field]) {
        warnings.push(`Field '${field}' contains control characters that may affect display`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
