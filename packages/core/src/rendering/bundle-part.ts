// packages/core/src/rendering/bundle-part.ts

import type {
  BinaryContent,
  Bundle,
  Checklist,
  Document,
  Form,
  Formatter,
  FormatterProgressivePolicy,
  Layer,
} from '@paradoc/types'
import type { RuntimeForm } from '@/artifacts/form'
import type { RuntimeChecklist } from '@/artifacts/checklist'
import type { RuntimeDocument } from '@/artifacts/document'
import type { RuntimeBundle } from '@/artifacts/bundle'
import type { RendererRegistry } from './renderer-registry'
import { getExtensionForMime, nestPartOutputs, normalizeMimeType, producedMimeType } from './part-mime'

/**
 * Content a bundle part carries as bytes rather than as an artifact to render.
 *
 * An annex is the case this exists for: a certificate, a scan, a statement the
 * packet includes but nothing in Paradoc produced. It has no layer, no fields
 * and nothing to fill, so it arrives already final and assembly passes it
 * through.
 */
export interface AssemblyBytesEntry {
  /** Literal `"bytes"` discriminator. */
  kind: 'bytes'
  /** The content itself. */
  content: BinaryContent
  /** What the content is. `application/pdf` is the only kind a packet can paint. */
  mimeType: string
  /** Name to carry it under. Defaults to the content key plus the type's extension. */
  filename?: string
}

/** One rendered bundle part. */
export interface BundlePartOutput {
  /** The rendered content. */
  content: BinaryContent
  /** The MIME type of the rendered content, lowercased. */
  mimeType: string
  /** Suggested filename with extension. */
  filename: string
}

/** Anything a bundle part can be: an artifact instance in any phase, a nested bundle, or bytes. */
export type BundlePartEntry =
  | RuntimeForm<Form>
  | RuntimeChecklist<Checklist>
  | RuntimeDocument<Document>
  | RuntimeBundle<Bundle>
  | AssemblyBytesEntry

/** What every part render receives. */
export interface BundlePartRenderOptions {
  /** Renderers keyed by layer MIME type, passed to every member. */
  renderers?: RendererRegistry
  /** Formatter policy applied to every member render. */
  formatter?: Formatter
  /** Missing/incomplete value policy for progressive previews. */
  progressive?: FormatterProgressivePolicy
}

/** True when the entry carries its content rather than an artifact to render. */
export function isAssemblyBytesEntry(entry: object): entry is AssemblyBytesEntry {
  return 'kind' in entry && entry.kind === 'bytes'
}

/**
 * Render one bundle entry into the parts it contributes.
 *
 * A form, checklist or document is one part under its content key, rendered
 * through its own `render` with the same `renderers`, `formatter` and
 * `progressive` whatever its kind, so each member chooses its renderer the way
 * a direct render does. Bytes pass through. A nested bundle contributes every
 * one of its parts, named as a folder under its key.
 *
 * Every part's MIME type is lowercased, and its filename takes the extension
 * of that type unless a bytes entry names its own.
 */
export async function renderBundlePart(
  key: string,
  entry: BundlePartEntry,
  options: BundlePartRenderOptions = {},
): Promise<Record<string, BundlePartOutput>> {
  if (isAssemblyBytesEntry(entry)) {
    const mimeType = normalizeMimeType(entry.mimeType)
    return {
      [key]: {
        content: entry.content,
        mimeType,
        filename: entry.filename ?? `${key}.${getExtensionForMime(mimeType)}`,
      },
    }
  }

  // A nested bundle has no layer of its own: its parts are its contents.
  if ('bundle' in entry) {
    const nested = await entry.render(options)
    return nestPartOutputs(key, nested.outputs)
  }

  const { layers, targetLayer } = partLayers(entry)
  if (Object.keys(layers).length === 0) {
    throw new Error(`Content "${key}" declares no layer to render`)
  }
  const layer = layers[targetLayer]
  if (!layer) {
    throw new Error(`Layer "${targetLayer}" not found for content "${key}"`)
  }

  const renderOptions = { ...options, layer: targetLayer }
  const content: unknown = await entry.render(renderOptions)

  const binary: BinaryContent =
    typeof content === 'string' ? new TextEncoder().encode(content) : (content as BinaryContent)

  // The part is named after what it is, not after the module that drew it.
  const produced = producedMimeType(layer.mimeType)
  return {
    [key]: {
      content: binary,
      mimeType: produced,
      filename: `${key}.${getExtensionForMime(produced)}`,
    },
  }
}

/** The layers an artifact part declares and the one it renders. */
function partLayers(
  entry: RuntimeForm<Form> | RuntimeChecklist<Checklist> | RuntimeDocument<Document>,
): { layers: Record<string, Layer>; targetLayer: string } {
  const definition = 'form' in entry ? entry.form : 'checklist' in entry ? entry.checklist : entry.document
  return { layers: definition.layers ?? {}, targetLayer: entry.targetLayer }
}
