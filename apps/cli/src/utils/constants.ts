/**
 * CLI Constants
 *
 * Security limits, timeouts, and other configurable constants.
 */

/**
 * Security limits for downloads
 */
export const SECURITY_LIMITS = {
  /**
   * Maximum file size for artifact JSON files (1MB)
   * Artifacts are JSON metadata files, they should never be large
   */
  MAX_ARTIFACT_SIZE: 1 * 1024 * 1024, // 1MB

  /**
   * Maximum file size for layer downloads (20MB)
   * This is a hard security limit that cannot be overridden
   */
  MAX_LAYER_SIZE: 20 * 1024 * 1024, // 20MB

  /**
   * Maximum file size for registry index (5MB)
   * Registry index lists all artifacts, could be moderately large
   */
  MAX_INDEX_SIZE: 5 * 1024 * 1024, // 5MB
}

/**
 * Network timeouts
 */
export const NETWORK_TIMEOUTS = {
  /**
   * Connection timeout in milliseconds
   */
  CONNECT_TIMEOUT: 30_000, // 30 seconds

  /**
   * Read timeout for slow responses
   */
  READ_TIMEOUT: 60_000, // 60 seconds

  /**
   * Total download timeout
   */
  DOWNLOAD_TIMEOUT: 300_000, // 5 minutes
}

/**
 * Allowed URL schemes for registry URLs
 * Only HTTPS is allowed for security
 */
export const ALLOWED_URL_SCHEMES = ['https:']

/**
 * Blocked content types that should never be downloaded as layers.
 * These are hardcoded security restrictions that cannot be overridden.
 */
export const BLOCKED_CONTENT_TYPES: readonly string[] = [
  // Executables
  'application/x-executable',
  'application/x-msdos-program',
  'application/x-msdownload',
  'application/vnd.microsoft.portable-executable',
  'application/x-dosexec',
  'application/x-elf',
  'application/x-mach-binary',
  'application/x-pie-executable',

  // Shell scripts
  'application/x-sh',
  'application/x-shellscript',
  'application/x-bash',
  'application/x-csh',
  'application/x-ksh',
  'application/x-zsh',

  // Other scripts that can execute
  'application/x-perl',
  'application/x-python',
  'application/x-python-code',
  'application/x-ruby',
  'application/x-php',

  // Windows-specific dangerous types
  'application/x-ms-shortcut',
  'application/x-msi',
  'application/x-msdownload',
  'application/hta',
  'application/x-bat',
  'application/x-cmd',

  // macOS-specific
  'application/x-apple-diskimage',
  'application/x-macos',

  // Archives that could contain executables (optional, but safer)
  // Commented out as these may be legitimate use cases
  // 'application/x-tar',
  // 'application/x-gzip',
  // 'application/zip',

  // Java
  'application/java-archive',
  'application/x-java-class',
  'application/x-java-jnlp-file',

  // Other dangerous types
  'application/x-sharedlib',
  'application/x-object',
  'application/x-coredump',
]

/**
 * Default allowed content types for layer downloads.
 * Users can expand this list in their config, but cannot add blocked types.
 */
export const DEFAULT_ALLOWED_CONTENT_TYPES: readonly string[] = [
  // Plain text
  'text/plain',

  // Markdown
  'text/markdown',
  'text/x-markdown',

  // HTML
  'text/html',

  // PDF
  'application/pdf',

  // Microsoft Office
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/msword', // .doc (legacy)
  'application/vnd.ms-excel', // .xls (legacy)

  // CSV
  'text/csv',
  'application/csv',

  // JSON (for data layers)
  'application/json',
  'text/json',

  // XML
  'text/xml',
  'application/xml',

  // Images (common for templates)
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

/**
 * Allowed content types for artifact/index JSON files
 */
export const JSON_CONTENT_TYPES: readonly string[] = [
  'application/json',
  'text/json',
  'text/plain', // Some servers return text/plain for JSON
]

/**
 * Allowed content types for artifact YAML files
 */
export const YAML_CONTENT_TYPES: readonly string[] = [
  'application/x-yaml',
  'application/yaml',
  'text/yaml',
  'text/x-yaml',
  'text/plain', // Some servers return text/plain for YAML
]

/**
 * Check if a content type is blocked (dangerous executable types).
 * This check cannot be bypassed by user configuration.
 *
 * @param contentType - The Content-Type header value (may include charset)
 * @returns true if the content type is blocked
 */
export function isBlockedContentType(contentType: string): boolean {
  // Extract the base MIME type (remove charset and other parameters)
  const baseMimeType = (contentType.split(';')[0] ?? '').trim().toLowerCase()
  return BLOCKED_CONTENT_TYPES.includes(baseMimeType)
}

/**
 * Check if a content type is in the allowed list.
 *
 * @param contentType - The Content-Type header value (may include charset)
 * @param allowedTypes - List of allowed MIME types
 * @returns true if the content type is allowed
 */
export function isAllowedContentType(
  contentType: string,
  allowedTypes: readonly string[] = DEFAULT_ALLOWED_CONTENT_TYPES
): boolean {
  const baseMimeType = (contentType.split(';')[0] ?? '').trim().toLowerCase()
  return allowedTypes.some((allowed) => allowed.toLowerCase() === baseMimeType)
}

/**
 * Validate a content type for layer downloads.
 * Returns an error message if blocked or not allowed, null if OK.
 *
 * @param contentType - The Content-Type header value
 * @param allowedTypes - List of allowed MIME types (from config or defaults)
 * @returns Error message or null if valid
 */
export function validateLayerContentType(
  contentType: string,
  allowedTypes: readonly string[] = DEFAULT_ALLOWED_CONTENT_TYPES
): string | null {
  const baseMimeType = (contentType.split(';')[0] ?? '').trim().toLowerCase()

  // Check blocked first (these can never be allowed)
  if (isBlockedContentType(contentType)) {
    return `Content type '${baseMimeType}' is blocked for security reasons`
  }

  // Check if in allowed list
  if (!isAllowedContentType(contentType, allowedTypes)) {
    return `Content type '${baseMimeType}' is not in the allowed list`
  }

  return null
}

/**
 * Validate a content type for artifact JSON/YAML files.
 *
 * @param contentType - The Content-Type header value
 * @returns Error message or null if valid
 */
export function validateArtifactContentType(contentType: string): string | null {
  const baseMimeType = (contentType.split(';')[0] ?? '').trim().toLowerCase()

  const isJson = JSON_CONTENT_TYPES.some((t) => t.toLowerCase() === baseMimeType)
  const isYaml = YAML_CONTENT_TYPES.some((t) => t.toLowerCase() === baseMimeType)

  if (!isJson && !isYaml) {
    return `Artifact must be JSON or YAML, got '${baseMimeType}'`
  }

  return null
}
