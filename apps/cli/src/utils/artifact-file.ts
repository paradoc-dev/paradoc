import { assertCurrentSchemaVersion, parse, validate, type Artifact } from '@paradoc/core'

export type ArtifactSourceFormat = 'json' | 'yaml'

export interface ArtifactFileReference {
  path: string
  checksum?: string
  propertyPath: string[]
}

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

/** Parse and structurally validate one artifact source. */
export function loadValidatedArtifact(raw: string): Artifact {
  const result = validate(parseArtifactFile(raw))
  if (result.issues) {
    const details = result.issues.map((issue) => {
      const location = issue.path?.length ? issue.path.map(String).join('.') : 'root'
      return `${location}: ${issue.message}`
    }).join(', ')
    throw new Error(`Invalid artifact: ${details}`)
  }
  return result.value as Artifact
}

/** Infer the serialized artifact format from its file name. */
export function artifactSourceFormatOf(filePath: string): ArtifactSourceFormat {
  return /\.ya?ml$/i.test(filePath) ? 'yaml' : 'json'
}

/** Resolve an artifact/data output format from flags, a file name, and a fallback. */
export function outputFormatOf(options: {
  json?: boolean
  yaml?: boolean
  filePath?: string
  fallback?: ArtifactSourceFormat
}): ArtifactSourceFormat {
  if (options.json) return 'json'
  if (options.yaml) return 'yaml'
  if (options.filePath) return artifactSourceFormatOf(options.filePath)
  return options.fallback ?? 'json'
}

/** Walk every local file referenced by an artifact, including nested inline bundles. */
export function* fileReferencesOf(artifact: Artifact, prefix: string[] = []): Generator<ArtifactFileReference> {
  if ('layers' in artifact && artifact.layers) {
    for (const [key, layer] of Object.entries(artifact.layers)) {
      if (layer.kind !== 'file') continue
      yield { path: layer.path, checksum: layer.checksum, propertyPath: [...prefix, 'layers', key] }
      if (layer.font) {
        yield { path: layer.font.path, checksum: layer.font.checksum, propertyPath: [...prefix, 'layers', key, 'font'] }
      }
    }
  }

  const record = artifact as unknown as Record<string, unknown>
  for (const field of ['instructions', 'agentInstructions'] as const) {
    const ref = record[field] as { kind?: string; path?: string; checksum?: string } | undefined
    if (ref?.kind === 'file' && ref.path) {
      yield { path: ref.path, checksum: ref.checksum, propertyPath: [...prefix, field] }
    }
  }

  if (artifact.kind === 'bundle') {
    for (const [index, item] of artifact.contents.entries()) {
      if (item.type === 'path') {
        yield { path: item.path, propertyPath: [...prefix, 'contents', String(index)] }
      } else if (item.type === 'inline') {
        yield* fileReferencesOf(item.artifact, [...prefix, 'contents', String(index), 'artifact'])
      }
    }
  }
}
