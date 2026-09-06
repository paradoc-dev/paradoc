// packages/core/src/rendering/bundle-assembler.ts

import type {
  Bundle,
  Form,
  Document,
  Checklist,
  BinaryContent,
  Layer,
} from '@paradoc/types'
import type { DraftForm } from '@/artifacts/form'
import type { DraftChecklist } from '@/artifacts/checklist'
import type { DraftDocument } from '@/artifacts/document'
import { renderLayer } from '@paradoc/render'
import { findRegisteredRenderer, isReactLayerMimeType, type RendererRegistry } from './renderer-registry'

// ============================================================================
// Bundle Assembly API
// ============================================================================

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

/**
 * Content entry for bundle assembly.
 *
 * Either a draft instance, which assembly renders through its target layer, or
 * bytes that are already the content.
 */
export type AssemblyContentEntry =
  | DraftForm<Form>
  | DraftChecklist<Checklist>
  | DraftDocument<Document>
  | AssemblyBytesEntry

/** True when the entry carries its content rather than an artifact to render. */
export function isAssemblyBytesEntry(entry: AssemblyContentEntry): entry is AssemblyBytesEntry {
  return 'kind' in entry && entry.kind === 'bytes'
}

/**
 * Options for the new bundle assembly API.
 */
export interface BundleAssemblyOptions {
  /**
   * Optional custom renderers keyed by MIME type. Supported layers render
   * automatically.
   *
   * There is no resolver here: each entry is an artifact instance that carries
   * the resolver bound when it was constructed.
   */
  renderers?: RendererRegistry

  /** Content entries keyed by bundle content key */
  contents: Record<string, AssemblyContentEntry>
}

/**
 * Output from a single assembled content item.
 */
export interface AssembledBundleOutput {
  /** The rendered content (string or binary) */
  content: BinaryContent
  /** The MIME type of the rendered content */
  mimeType: string
  /** Suggested filename with extension */
  filename: string
}

/**
 * Result of assembling a bundle with the new API.
 */
export interface AssembledBundle {
  /** The original bundle */
  bundle: Bundle
  /** Rendered outputs keyed by content key */
  outputs: Record<string, AssembledBundleOutput>
}

/**
 * Get the appropriate file extension for a MIME type.
 */
function getExtensionForMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'text/markdown': 'md',
    'text/html': 'html',
    'text/plain': 'txt',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/json': 'json',
    'text/yaml': 'yaml',
    'application/yaml': 'yaml',
  }

  return mimeToExt[mimeType] ?? 'bin'
}

/**
 * The MIME type of what a layer's renderer actually produced.
 *
 * A layer's declared type describes its source, and for most layers the source
 * and the output are the same thing. A React layer is the exception: it is a
 * `text/tsx` pointer at a composition, and the renderer registered for it
 * writes a PDF. The layer's own type would name the packet's part after the
 * module that drew it, so the produced type is asked for separately.
 */
export function producedMimeType(layerMimeType: string): string {
  return isReactLayerMimeType(layerMimeType) ? 'application/pdf' : layerMimeType
}

/**
 * Get layers record from a draft instance.
 */
function getLayersFromFilled(
  filled: DraftForm<Form> | DraftChecklist<Checklist> | DraftDocument<Document>
): Record<string, Layer> {
  // Use duck typing to check which type we have
  if ('form' in filled) {
    // DraftForm
    const form = (filled as DraftForm<Form>).form
    return form.layers ?? {}
  } else if ('checklist' in filled) {
    // DraftChecklist
    const checklist = (filled as DraftChecklist<Checklist>).checklist
    return checklist.layers ?? {}
  } else if ('document' in filled) {
    // DraftDocument
    const document = (filled as DraftDocument<Document>).document
    return document.layers ?? {}
  }
  return {}
}

/**
 * Assemble a bundle by rendering runtime instances with their target layers.
 *
 * This is the cleaner API for bundle assembly that:
 * - Accepts runtime instances (RuntimeForm, RuntimeChecklist, RuntimeDocument)
 * - Uses the targetLayer property to determine which layer to render
 * - Selects the built-in renderer from each layer's MIME type
 * - Accepts optional MIME-specific custom renderer overrides
 *
 * @param bundle - The bundle to assemble
 * @param options - Assembly options with runtime content instances and optional overrides
 * @returns An AssembledBundle with rendered outputs for each content key
 *
 * @example
 * ```typescript
 * const filledLease = leaseForm.fill(leaseData)
 * const filledChecklist = checklist.fill(checklistData)
 * const filledDoc = disclosure.prepare()  // Uses defaultLayer
 *
 * const assembled = await assembleBundle(bundle, {
 *   contents: {
 *     leaseAgreement: filledLease,
 *     checklist: filledChecklist,
 *     disclosure: filledDoc,
 *   },
 * })
 *
 * // Access outputs
 * for (const [key, output] of Object.entries(assembled.outputs)) {
 *   console.log(`${key}: ${output.mimeType} (${output.content.length} bytes)`)
 * }
 * ```
 */
export async function assembleBundle(
  bundle: Bundle,
  options: BundleAssemblyOptions
): Promise<AssembledBundle> {
  const { renderers, contents } = options
  const outputs: Record<string, AssembledBundleOutput> = {}

  // Validate all content keys exist in bundle
  for (const key of Object.keys(contents)) {
    const bundleContent = bundle.contents.find((c) => c.key === key)
    if (!bundleContent) {
      throw new Error(
        `Content key "${key}" not found in bundle. ` +
          `Available keys: ${bundle.contents.map((c) => c.key).join(', ')}`
      )
    }
  }

  // Process each content entry
  for (const [key, filled] of Object.entries(contents)) {
    if (isAssemblyBytesEntry(filled)) {
      outputs[key] = {
        content: filled.content,
        mimeType: filled.mimeType,
        filename: filled.filename ?? `${key}.${getExtensionForMime(filled.mimeType)}`,
      }
      continue
    }

    // Get target layer and its MIME type
    const targetLayer = filled.targetLayer
    const layers = getLayersFromFilled(filled)

    const layer = layers[targetLayer]
    if (!layer) {
      throw new Error(`Layer "${targetLayer}" not found for content "${key}"`)
    }

    const mimeType = layer.mimeType

    const renderer = findRegisteredRenderer(renderers, mimeType) ?? renderLayer()

    const content = await filled.render({ renderer })

    // Convert to binary if needed
    const binaryContent: BinaryContent =
      typeof content === 'string'
        ? new TextEncoder().encode(content)
        : (content as BinaryContent)

    // The part is named after what it is, not after the module that drew it.
    const produced = producedMimeType(mimeType)
    outputs[key] = {
      content: binaryContent,
      mimeType: produced,
      filename: `${key}.${getExtensionForMime(produced)}`,
    }
  }

  return { bundle, outputs }
}
