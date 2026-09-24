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

// ============================================================================
// FORMAT DETECTION & PARSING
// ============================================================================

/**
 * Auto-detect format and parse string.
 *
 * Tries JSON first (the stricter format), then falls back to YAML (a
 * superset of JSON syntax) exactly once. If neither parses, the thrown
 * `SerializationError` carries the YAML parser's own error - with its line
 * and reason - as `cause` and in its message.
 *
 * @param content - String content to parse
 * @returns Parsed object
 * @throws {SerializationError} If content cannot be parsed as JSON or YAML
 */
export function parse<T = unknown>(content: string): T {
  if (!content.trim()) {
    throw new SerializationError(
      "Unable to parse content: content is empty",
      "unknown"
    )
  }

  try {
    return JSON.parse(content)
  } catch {
    // Not JSON - fall through to YAML, which accepts anything JSON.parse
    // rejects that is still valid YAML (including plain JSON).
  }

  try {
    return parseYaml(content) as T
  } catch (error) {
    const cause = error as Error
    throw new SerializationError(
      `Unable to parse content as JSON or YAML: ${cause.message}`,
      "unknown",
      cause
    )
  }
}
