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
  }

  /** Captured options (after capture) */
  captured?: {
    /** Text/rendering for captured signature. String or function. */
    signature?: SignatureCapturedValue
    /** Text/rendering for captured initials. String or function. */
    initials?: SignatureCapturedValue
  }
}

const DEFAULT_PLACEHOLDER_SIGNATURE = '_____________________________'
const DEFAULT_PLACEHOLDER_INITIALS = '______'
const DEFAULT_CAPTURED_SIGNATURE = '[Signed]'
const DEFAULT_CAPTURED_INITIALS = '[Initialed]'

/**
 * Resolved PDF signature options with all defaults applied.
 */
export interface ResolvedPdfSignatureOptions {
  placeholder: {
    signature: string
    initials: string
  }
  captured: {
    signature: string
    initials: string
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
    },
    captured: {
      signature: options.captured?.signature ?? DEFAULT_CAPTURED_SIGNATURE,
      initials: options.captured?.initials ?? DEFAULT_CAPTURED_INITIALS,
    },
  }
}
