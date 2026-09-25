import { assertCurrentSchemaVersion, parse, toYAML, validate, type Artifact } from '@paradoc/core'
import { parseDocument } from 'yaml'
import type { LocalFileSystem } from './local-fs.js'

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

/** Serialize a newly-created artifact in the requested source format. */
export function serializeArtifactFile(value: unknown, format: ArtifactSourceFormat): string {
  return format === 'yaml' ? toYAML(value) : `${JSON.stringify(value, null, 2)}\n`
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

/** Validate and write an edited artifact while retaining YAML comments. */
export async function writeArtifactEdit(
  storage: LocalFileSystem,
  filePath: string,
  original: string,
  artifact: Artifact
): Promise<void> {
  const validation = validate(artifact)
  if (validation.issues) {
    const details = validation.issues.map((issue) => {
      const location = issue.path?.length ? issue.path.map(String).join('.') : 'root'
      return `${location}: ${issue.message}`
    }).join(', ')
    throw new Error(`Edited artifact is invalid: ${details}`)
  }

  if (artifactSourceFormatOf(filePath) === 'json') {
    await storage.writeFile(filePath, serializeArtifactFile(artifact, 'json'))
    return
  }

  const document = parseDocument(original)
  syncYamlDocument(document, document.toJS(), artifact, [])
  await storage.writeFile(filePath, document.toString())
}

function syncYamlDocument(
  document: ReturnType<typeof parseDocument>,
  before: unknown,
  after: unknown,
  path: (string | number)[]
): void {
  if (isRecord(before) && isRecord(after)) {
    for (const key of Object.keys(before)) {
      if (!(key in after)) document.deleteIn([...path, key])
    }
    for (const [key, value] of Object.entries(after)) {
      if (!(key in before)) document.setIn([...path, key], value)
      else syncYamlDocument(document, before[key], value, [...path, key])
    }
    return
  }
  if (!Object.is(before, after)) document.setIn(path, after)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
