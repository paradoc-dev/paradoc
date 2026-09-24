/**
 * Authoring validation of what an artifact's layers refer to: the default
 * layer, and each signature slot's party role, placement, and type. Every
 * problem here is one render or seal would hit, found from the definition
 * alone. Problems that depend on runtime options (a seal adapter, a renderer
 * override) are left to seal.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Layer } from '@paradoc/types'
import { textTemplateSigningDirectives, type SigningDirectiveUse } from '@paradoc/render/text'
import { hasSignatureSlots } from '@/artifacts/form/seal-slots'

/** An artifact that may declare layers, a default layer, and parties. */
interface LayeredArtifact {
  layers?: Record<string, Layer>
  defaultLayer?: string
  parties?: Record<string, { signature?: { required?: boolean } }>
}

/** Slot types 'flow' placement supports: the marks a signing directive draws. */
const FLOW_SLOT_TYPES: ReadonlySet<string> = new Set(['signature', 'initials'])

/**
 * Layers whose engines draw no flow marker: a PDF template has fixed
 * content, and core's seal passes signing markers to text renderers only.
 */
const NO_FLOW_LAYERS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
}
const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown', 'text/html'])

/**
 * Every 'flow' slot of a layer must be placed by a signing directive of its
 * type and location in the layer's template: seal() finds a flow slot only by
 * the marker that directive draws. A directive whose location is computed
 * could place any slot of its type, so it satisfies them all. Undefined
 * directives mean the template does not parse, which the template check
 * reports instead.
 */
export function flowPlacementIssues(key: string, layer: Layer, directives: SigningDirectiveUse[] | undefined): StandardSchemaV1.Issue[] {
  if (!directives) return []
  const issues: StandardSchemaV1.Issue[] = []
  for (const [slotId, slot] of Object.entries(layer.signatures ?? {})) {
    if (slot.placement !== 'flow' || !FLOW_SLOT_TYPES.has(slot.type)) continue
    const placed = directives.some((use) => use.directive === slot.type && (use.location === undefined || use.location === slotId))
    if (!placed) {
      issues.push({
        message: `Layer "${key}", slot "${slotId}": no {{${slot.type}(..., "${slotId}")}} in the template places this 'flow' slot`,
        path: ['layers', key, 'signatures', slotId],
      })
    }
  }
  return issues
}

function listed(names: string[]): string {
  return names.length > 0 ? names.map((name) => `"${name}"`).join(', ') : 'none'
}

/**
 * Check the default layer and every signature slot of an artifact's layers,
 * including that an inline template places each of its 'flow' slots.
 * `validateFileTemplates` checks the placement for file-backed templates.
 */
export function validateLayerReferences(artifact: LayeredArtifact): StandardSchemaV1.Issue[] {
  const layers = artifact.layers ?? {}
  const layerKeys = Object.keys(layers)
  const issues: StandardSchemaV1.Issue[] = []

  if (artifact.defaultLayer !== undefined && !Object.hasOwn(layers, artifact.defaultLayer)) {
    issues.push({
      message: `defaultLayer "${artifact.defaultLayer}" names no layer; declared layers: ${listed(layerKeys)}`,
      path: ['defaultLayer'],
    })
  }

  const parties = artifact.parties ?? {}
  const roles = Object.keys(parties)
  for (const [key, layer] of Object.entries(layers)) {
    if (!hasSignatureSlots(layer)) continue
    const slots = layer.signatures

    for (const [slotId, slot] of Object.entries(slots)) {
      const at = `Layer "${key}", slot "${slotId}"`
      const path = ['layers', key, 'signatures', slotId]
      if (!Object.hasOwn(parties, slot.party.role)) {
        issues.push({ message: `${at}: party role "${slot.party.role}" is not declared; declared roles: ${listed(roles)}`, path })
      }
      if (slot.placement !== 'flow') continue
      const engine = NO_FLOW_LAYERS[layer.mimeType.toLowerCase()]
      if (engine) {
        issues.push({ message: `${at}: 'flow' placement needs a text-template layer; ${engine} layers use absolute or anchor placement`, path })
      }
      if (!FLOW_SLOT_TYPES.has(slot.type)) {
        issues.push({ message: `${at}: 'flow' placement supports signature and initials, not "${slot.type}"`, path })
      }
    }

    if (layer.kind === 'inline' && TEXT_MIME_TYPES.has(layer.mimeType.toLowerCase())) {
      issues.push(...flowPlacementIssues(key, layer, textTemplateSigningDirectives(layer.text)))
    }

    const placedRoles = new Set(Object.values(slots).map((slot) => slot.party.role))
    for (const [role, party] of Object.entries(parties)) {
      if (party.signature?.required && !placedRoles.has(role)) {
        issues.push({
          message: `Layer "${key}": party role "${role}" requires a signature but no slot on this layer places it`,
          path: ['layers', key, 'signatures'],
        })
      }
    }
  }

  return issues
}
