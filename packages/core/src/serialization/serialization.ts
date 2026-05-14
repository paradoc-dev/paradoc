import { stringify as stringifyYaml, parse as parseYaml } from "yaml"
import { PARADOC_SCHEMA_URL } from "@paradoc/schemas"

// Re-export types from centralized types.ts
export type { SerializationFormat, SerializationOptions } from "@/types"

// Import for internal use
import type { SerializationFormat, SerializationOptions } from "@/types"

/**
 * Custom error for serialization failures
 */
export class SerializationError extends Error {
  constructor(
    message: string,
    public readonly format: SerializationFormat | "unknown",
    public readonly cause?: Error
  ) {
    super(message)
    this.name = "SerializationError"
  }
}

// ============================================================================
// YAML SERIALIZATION
// ============================================================================

/**
 * Serialize object to YAML string
 *
 * @param data - Object to serialize
 * @param options - Serialization options
 * @returns YAML string, optionally with schema comment for IDE validation
 */
export function toYAML(
  data: unknown,
  options: SerializationOptions = {}
): string {
  const { yamlIndent = 2, sortKeys = false, includeSchema = true } = options

  try {
    const yaml = stringifyYaml(data, {
      indent: yamlIndent,
      sortMapEntries: sortKeys,
    })

    if (includeSchema) {
      return `# yaml-language-server: $schema=${PARADOC_SCHEMA_URL}\n${yaml}`
    }

    return yaml
  } catch (error) {
    throw new SerializationError(
      "Failed to serialize to YAML",
      "yaml",
      error as Error
    )
  }
}

/**
 * Parse YAML string to object
 */
export function fromYAML<T = unknown>(content: string): T {
  try {
    return parseYaml(content) as T
  } catch (error) {
    throw new SerializationError(
      "Failed to parse YAML",
      "yaml",
      error as Error
    )
  }
}

/**
 * Check if string is valid YAML
 * @internal
 */
function isYAML(content: string): boolean {
  try {
    parseYaml(content)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// JSON UTILITIES (Internal)
// ============================================================================

/**
 * Check if string is valid JSON
 * @internal
 */
function isJSON(content: string): boolean {
  try {
    JSON.parse(content)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// FORMAT DETECTION & PARSING
// ============================================================================

/**
 * Detect whether string is JSON or YAML
 * @internal
 */
function detectFormat(content: string): SerializationFormat | null {
  const trimmed = content.trim()

  // Empty content
  if (!trimmed) {
    return null
  }

  // Try JSON first (stricter format)
  if (isJSON(trimmed)) {
    return "json"
  }

  // Try YAML (more permissive)
  if (isYAML(trimmed)) {
    return "yaml"
  }

  return null
}

/**
 * Auto-detect format and parse string
 *
 * @param content - String content to parse
 * @returns Parsed object
 * @throws {SerializationError} If content cannot be parsed as JSON or YAML
 */
export function parse<T = unknown>(content: string): T {
  const format = detectFormat(content)

  if (format === "json") {
    try {
      return JSON.parse(content)
    } catch (error) {
      throw new SerializationError(
        "Failed to parse JSON",
        "json",
        error as Error
      )
    }
  }

  if (format === "yaml") {
    return fromYAML<T>(content)
  }

  throw new SerializationError(
    "Unable to detect format - content is neither valid JSON nor YAML",
    "unknown"
  )
}
