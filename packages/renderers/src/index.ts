/**
 * @paradoc/renderers
 *
 * Umbrella package for Paradoc renderers
 * Re-exports all renderers from @paradoc/renderer-docx, @paradoc/renderer-pdf, and @paradoc/renderer-text
 */
import type { PdfFieldInfo as BasePdfFieldInfo } from '@paradoc/renderer-pdf'

// Re-export from renderer-docx
export * from '@paradoc/renderer-docx'

// Re-export from renderer-pdf
export * from '@paradoc/renderer-pdf'
export type PdfFieldInfo = BasePdfFieldInfo

// Re-export from renderer-text
export * from '@paradoc/renderer-text'
