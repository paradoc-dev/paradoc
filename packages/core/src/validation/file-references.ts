/**
 * Authoring check that every file an artifact refers to can be read.
 *
 * File-backed layers, `instructions` and `agentInstructions` name files that
 * render, seal, or an agent reads later. `validateLayers()` reads each through
 * the resolver, so a missing file is an error before anything needs it. A
 * React layer's path names a module to import, not content to read, so it is
 * not read here.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ContentRef, Layer, Resolver } from '@paradoc/types'
import { isReactLayerMimeType } from '@paradoc/schemas'

const CONTENT_FIELDS = ['instructions', 'agentInstructions'] as const

interface FileReferencingArtifact {
  layers?: Record<string, Layer>
  instructions?: ContentRef
  agentInstructions?: ContentRef
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Report each file-backed layer, `instructions`, or `agentInstructions` the resolver cannot read. */
export async function validateFileReferences(artifact: unknown, resolver: Resolver): Promise<StandardSchemaV1.Issue[]> {
  if (typeof artifact !== 'object' || artifact === null) return []
  const record = artifact as FileReferencingArtifact
  const issues: StandardSchemaV1.Issue[] = []
  for (const [key, layer] of Object.entries(record.layers ?? {})) {
    if (layer.kind !== 'file' || isReactLayerMimeType(layer.mimeType)) continue
    try {
      await resolver.read(layer.path)
    } catch (error) {
      issues.push({ message: `Layer "${key}" could not be read from "${layer.path}": ${reason(error)}`, path: ['layers', key] })
    }
  }
  for (const field of CONTENT_FIELDS) {
    const ref = record[field]
    if (ref?.kind !== 'file') continue
    try {
      await resolver.read(ref.path)
    } catch (error) {
      issues.push({ message: `${field} could not be read from "${ref.path}": ${reason(error)}`, path: [field] })
    }
  }
  return issues
}
