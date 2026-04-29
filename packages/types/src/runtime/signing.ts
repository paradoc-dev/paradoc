/**
 * Sealing Types for E-Signing Integration
 *
 * These types enable SignableForm to work with external e-signing services
 * (DocuSign, Dropbox Sign, Adobe Sign, etc.) by providing signature field
 * coordinates and PDF hashing.
 *
 * "Sealing" refers to creating the canonical PDF and extracting signature
 * field positions for e-signing ceremonies.
 */

import type { Form } from '../schemas/artifacts'
import type { Party, Signer, PartySignatory } from './index'

// ============================================================================
// Signing Field Types
// ============================================================================

/**
 * SigningFieldType
 *
 * The type of field that can be placed on a document for e-signing.
 */
export type SigningFieldType = 'signature' | 'initials' | 'date_signed'

/**
 * SigningField
 *
 * Unified field schema for e-signing that adapts to all vendors.
 * Contains positioning information for placing signature fields on a PDF.
 *
 * Coordinates use PDF standard: points from origin, where 1 point = 1/72 inch.
 */
export interface SigningField {
	/** Unique identifier for this field. */
	id: string
	/** 0-based index into the signers array (for ordering). */
	signerIndex: number
	/** Reference to signer ID in the signers registry. */
	signerId: string
	/** Type of signing field. */
	type: SigningFieldType
	/** 1-based page number where this field appears. */
	page: number
	/** X coordinate in points from left edge of page. */
	x: number
	/** Y coordinate in points from top edge of page. */
	y: number
	/** Width of the field in points. */
	width: number
	/** Height of the field in points. */
	height: number
	/** Alternative positioning using text anchor. */
	anchor?: {
		/** Text string to search for in the document. */
		text: string
		/** Horizontal offset from anchor in points. */
		offsetX: number
		/** Vertical offset from anchor in points. */
		offsetY: number
	}
	/** Whether this field is required. Defaults to true. */
	required?: boolean
	/** Human-readable label for the field. */
	label?: string
}

// ============================================================================
// Sealing Request/Result Types
// ============================================================================

/**
 * SealingRequest
 *
 * Request payload sent to a Sealer to create the canonical PDF.
 * Contains all the form data and party information needed to render and analyze the document.
 *
 * @typeParam F - The form definition type
 */
export interface SealingRequest<F extends Form = Form> {
	/** The form definition. */
	form: F
	/** Field values keyed by field identifier. */
	fields: Record<string, unknown>
	/** Party data keyed by role identifier. */
	parties: Record<string, Party | Party[]>
	/** Global registry of signers with their adopted signatures. */
	signers: Record<string, Signer>
	/** Maps parties to their signatories. Structure: role -> partyId -> signatories. */
	signatories: Record<string, Record<string, PartySignatory[]>>
	/** Target layer key for rendering (e.g., 'docx', 'markdown'). */
	targetLayer: string
	/** Optional configuration for PDF generation. */
	options?: {
		/** Renderer to use for PDF conversion. */
		renderer?: 'puppeteer' | 'libreoffice'
		/** Output format (currently only PDF supported). */
		format?: 'pdf'
	}
}

/**
 * SealingResult
 *
 * Result from a Sealer after creating the canonical PDF.
 * Contains the signature field coordinates and PDF hash for verification.
 */
export interface SealingResult {
	/** Array of signing fields with their coordinates on the PDF. */
	signatureMap: SigningField[]
	/** SHA-256 hash of the canonical PDF for integrity verification. */
	canonicalPdfHash: string
	/** Optional URL to the stored canonical PDF. */
	canonicalPdfUrl?: string
	/** Optional bytes of the canonical PDF. */
	canonicalPdfBytes?: Uint8Array
}

// ============================================================================
// Adapter Interface
// ============================================================================

/**
 * Sealer
 *
 * Interface for adapters that create canonical PDFs for e-signing.
 * Implementations handle:
 * - Rendering the form to PDF (for templates like markdown/docx)
 * - Extracting signature field coordinates
 * - Computing the canonical PDF hash
 * - Optionally storing the PDF
 *
 * @example
 * ```typescript
 * const adapter: Sealer = {
 *   async seal(request) {
 *     // 1. Render form to PDF using targetLayer
 *     // 2. Extract signature locations from PDF
 *     // 3. Compute SHA-256 hash
 *     // 4. Upload to storage (optional)
 *     return {
 *       signatureMap: [...],
 *       canonicalPdfHash: 'sha256:abc123...',
 *       canonicalPdfUrl: 'https://storage.example.com/forms/abc123.pdf'
 *     }
 *   }
 * }
 * ```
 */
export interface Sealer {
	/**
	 * Create the canonical PDF and extract signature field positions.
	 *
	 * @param request - The request containing form data and configuration
	 * @returns Promise resolving to signature field coordinates and PDF hash
	 */
	seal<F extends Form>(request: SealingRequest<F>): Promise<SealingResult>
}

// ============================================================================
// Legacy Aliases (deprecated)
// ============================================================================

/** @deprecated Use SealingRequest instead */
export type FormalSigningRequest<F extends Form = Form> = SealingRequest<F>

/** @deprecated Use SealingResult instead */
export type FormalSigningResponse = SealingResult

/** @deprecated Use Sealer instead */
export type FormalSigningAdapter = Sealer
