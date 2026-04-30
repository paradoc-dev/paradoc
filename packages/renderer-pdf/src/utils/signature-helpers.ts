/**
 * Signature and initials options for PDF rendering.
 *
 * Note: Full signature helper implementation for PDF (embedding images)
 * is deferred for a future task. This file defines the options interface
 * for consistency with other renderers.
 */

import type {
  SignaturePlaceholderValue,
  SignatureCapturedValue,
} from '@paradoc/types'

/**
 * Options for signature rendering in PDF templates
 */
export interface PdfSignatureOptions {
  /** Placeholder options (before capture) */
  placeholder?: {
    /** Placeholder for signature. String or function. */
    signature?: SignaturePlaceholderValue
    /** Placeholder for initials. String or function. */
    initials?: SignaturePlaceholderValue
    /** Placeholder for signer capacity (role/title). String or function. */
    capacity?: SignaturePlaceholderValue
    /** Placeholder for printed name. String or function. */
    printedName?: SignaturePlaceholderValue
  }

  /** Captured options (after capture) */
  captured?: {
    /** Text/rendering for captured signature. String or function. */
    signature?: SignatureCapturedValue
    /** Text/rendering for captured initials. String or function. */
    initials?: SignatureCapturedValue
    /** Text/rendering for captured capacity. String or function. */
    capacity?: SignatureCapturedValue
    /** Text/rendering for captured printed name. String or function. */
    printedName?: SignatureCapturedValue
  }
}

const DEFAULT_PLACEHOLDER_SIGNATURE = '_____________________________'
const DEFAULT_PLACEHOLDER_INITIALS = '______'
const DEFAULT_PLACEHOLDER_CAPACITY = '________________'
const DEFAULT_PLACEHOLDER_PRINTED_NAME = '_______________________'
const DEFAULT_CAPTURED_SIGNATURE = '[Signed]'
const DEFAULT_CAPTURED_INITIALS = '[Initialed]'

/**
 * Resolved PDF signature options with all defaults applied.
 */
export interface ResolvedPdfSignatureOptions {
  placeholder: {
    signature: string
    initials: string
    capacity: string
    printedName: string
  }
  captured: {
    signature: string
    initials: string
    capacity: string
    printedName: string
  }
}

/**
 * Get resolved PDF signature options with defaults applied.
 * Note: This resolves static string defaults only. Function values
 * will be resolved at render time when party/signer context is available.
 */
export function resolvePdfSignatureOptions(
  options: PdfSignatureOptions = {}
): PdfSignatureOptions {
  return {
    placeholder: {
      signature: options.placeholder?.signature ?? DEFAULT_PLACEHOLDER_SIGNATURE,
      initials: options.placeholder?.initials ?? DEFAULT_PLACEHOLDER_INITIALS,
      capacity: options.placeholder?.capacity ?? DEFAULT_PLACEHOLDER_CAPACITY,
      printedName: options.placeholder?.printedName ?? DEFAULT_PLACEHOLDER_PRINTED_NAME,
    },
    captured: {
      signature: options.captured?.signature ?? DEFAULT_CAPTURED_SIGNATURE,
      initials: options.captured?.initials ?? DEFAULT_CAPTURED_INITIALS,
      capacity: options.captured?.capacity ?? DEFAULT_PLACEHOLDER_CAPACITY,
      printedName: options.captured?.printedName ?? DEFAULT_PLACEHOLDER_PRINTED_NAME,
    },
  }
}
