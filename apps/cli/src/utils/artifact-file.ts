import { assertCurrentSchemaVersion, parse } from '@paradoc/core'

/**
 * Parse an artifact file's content (JSON or YAML) and apply the schema
 * version rule for artifact files: `$schema` must name the current version.
 * An older file fails with an error that points to `paradoc migrate`.
 */
export function parseArtifactFile(raw: string): unknown {
  const parsed = parse(raw)
  assertCurrentSchemaVersion(parsed, { required: true })
  return parsed
}
