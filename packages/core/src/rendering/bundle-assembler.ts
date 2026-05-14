// packages/core/src/rendering/bundle-assembler.ts

import type {
  Bundle,
  Form,
  Document,
  Checklist,
  BinaryContent,
  Resolver,
  Layer,
  ParadocRenderer,
  RendererLayer,
} from '@paradoc/types'
import type { DraftForm } from '@/artifacts/form'
import type { DraftChecklist } from '@/artifacts/checklist'
import type { DraftDocument } from '@/artifacts/document'

/**
 * A resolved artifact loaded from a path or slug.
 * Note: Bundle is recursive, so a resolved Bundle may contain nested Bundles.
 */
export type ResolvedArtifact = Form | Document | Checklist | Bundle

/**
 * Extension of Resolver that can also resolve artifact definitions.
 *
 * Implementations handle:
 *  - Reading raw bytes (inherited from Resolver)
 *  - Loading and parsing YAML/JSON artifact files
 *  - Resolving slugs to artifacts (e.g., from a registry)
 */
export interface ArtifactResolver extends Resolver {
  /**
   * Load an artifact from a path.
   * The path is relative to some base directory or can be a URL.
   */
  loadArtifact(path: string): Promise<ResolvedArtifact>

  /**
   * Load an artifact by its slug (e.g., "@acme/forms/application").
   * This requires access to a registry or resolver service.
   */
  loadArtifactBySlug?(slug: string): Promise<ResolvedArtifact>
}

// ============================================================================
// Bundle Assembly API
// ============================================================================

/**
 * Renderer registry keyed by MIME type.
 *
 * @example
 * ```typescript
 * const renderers: RendererRegistry = {
 *   'text/markdown': textRenderer(),
 *   'application/pdf': pdfRenderer(),
 *   'text/html': textRenderer(),
 * }
 * ```
 */
export type RendererRegistry = Record<string, ParadocRenderer<RendererLayer, unknown>>

/**
 * Content entry for bundle assembly.
 * Accepts draft instances that have a targetLayer property.
 */
export type AssemblyContentEntry =
  | DraftForm<Form>
  | DraftChecklist<Checklist>
  | DraftDocument<Document>

/**
 * Options for the new bundle assembly API.
 */
export interface BundleAssemblyOptions {
  /** Resolver for file-based layers (optional if all layers are inline) */
  resolver?: Resolver | ArtifactResolver

  /** Renderers keyed by MIME type */
  renderers: RendererRegistry

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
 * Get layers record from a draft instance.
 */
function getLayersFromFilled(
  filled: AssemblyContentEntry
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
 * - Looks up renderers by the layer's MIME type
 *
 * @param bundle - The bundle to assemble
 * @param options - Assembly options with renderers and runtime content instances
 * @returns An AssembledBundle with rendered outputs for each content key
 *
 * @example
 * ```typescript
 * const filledLease = leaseForm.fill(leaseData)
 * const filledChecklist = checklist.fill(checklistData)
 * const filledDoc = disclosure.prepare()  // Uses defaultLayer
 *
 * const assembled = await assembleBundle(bundle, {
 *   resolver,
 *   renderers: {
 *     'text/markdown': textRenderer(),
 *     'application/pdf': pdfRenderer(),
 *   },
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
  const { resolver, renderers, contents } = options
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
    // Get target layer and its MIME type
    const targetLayer = filled.targetLayer
    const layers = getLayersFromFilled(filled)

    const layer = layers[targetLayer]
    if (!layer) {
      throw new Error(`Layer "${targetLayer}" not found for content "${key}"`)
    }

    const mimeType = layer.mimeType

    // Find renderer for this MIME type
    const renderer = renderers[mimeType]
    if (!renderer) {
      throw new Error(
        `No renderer for MIME type "${mimeType}". ` +
          `Registered renderers: ${Object.keys(renderers).join(', ')}`
      )
    }

    // Render the filled instance
    const renderOptions = {
      renderer,
      resolver,
    }

    const content = await filled.render(renderOptions)

    // Convert to binary if needed
    const binaryContent: BinaryContent =
      typeof content === 'string'
        ? new TextEncoder().encode(content)
        : (content as BinaryContent)

    outputs[key] = {
      content: binaryContent,
      mimeType,
      filename: `${key}.${getExtensionForMime(mimeType)}`,
    }
  }

  return { bundle, outputs }
}
