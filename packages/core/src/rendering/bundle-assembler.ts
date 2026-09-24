// packages/core/src/rendering/bundle-assembler.ts

import type { Bundle, Form, Document, Checklist } from '@paradoc/types'
import type { DraftForm } from '@/artifacts/form'
import type { DraftChecklist } from '@/artifacts/checklist'
import type { DraftDocument } from '@/artifacts/document'
import type { DraftBundle } from '@/artifacts/bundle'
import type { RendererRegistry } from './renderer-registry'
import { renderBundlePart, type AssemblyBytesEntry, type BundlePartOutput } from './bundle-part'
import {
  assertBundleInclusionResolved,
  evaluateBundleInclusion,
  type BundleEvaluationMember,
  type BundleInclusionState,
} from '@/artifacts/bundle/inclusion'
import { captureRuntimeContext, type RuntimeCreationOptions } from '@/artifacts/shared/runtime-context'

// ============================================================================
// Bundle Assembly API
// ============================================================================

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

/**
 * Entry for a bundle content key when assembling a bundle.
 *
 * Any {@link AssemblyContentEntry}, or a draft bundle nested in this one. A
 * nested bundle contributes every one of its parts, named as a folder under
 * its content key (`nested/docA`, file `nested/docA.pdf`), exactly as
 * `RuntimeBundle.render()` names them.
 */
export type BundleAssemblyEntry = AssemblyContentEntry | DraftBundle<Bundle>

/**
 * Options for the new bundle assembly API.
 *
 * `context.asOf` is the one clock include conditions read for `today()` and
 * `now()`; it defaults to the current instant.
 */
export interface BundleAssemblyOptions extends RuntimeCreationOptions {
  /**
   * Optional custom renderers keyed by MIME type. Supported layers render
   * automatically.
   *
   * There is no resolver here: each entry is an artifact instance that carries
   * the resolver bound when it was constructed.
   */
  renderers?: RendererRegistry

  /** Content entries keyed by bundle content key */
  contents: Record<string, BundleAssemblyEntry>
}

/** Output from a single assembled content item. */
export type AssembledBundleOutput = BundlePartOutput

/**
 * Result of assembling a bundle with the new API.
 */
export interface AssembledBundle {
  /** The original bundle */
  bundle: Bundle
  /**
   * Rendered outputs keyed by content key. A nested bundle's parts are keyed
   * as a folder under its content key, such as `nested/docA`.
   */
  outputs: Record<string, AssembledBundleOutput>
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
  const inclusionState: BundleInclusionState = evaluateBundleInclusion(
    bundle,
    contents as Record<string, BundleEvaluationMember>,
    captureRuntimeContext(options),
  )
  assertBundleInclusionResolved(inclusionState)
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

  // Each part renders the way it renders inside a runtime bundle.
  for (const [key, entry] of Object.entries(contents)) {
    if (inclusionState.excludedKeys.includes(key)) continue
    Object.assign(outputs, await renderBundlePart(key, entry, { renderers }))
  }

  return { bundle, outputs }
}
