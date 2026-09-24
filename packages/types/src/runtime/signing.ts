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
import type { RuntimeParty, Signer, PartySignatory } from './index'

// ============================================================================
// Signing Field Types
// ============================================================================

/**
 * SigningFieldType
 *
 * The type of field that can be placed on a document for e-signing.
 *
 * - 'signature' / 'initials': glyph capture (image)
 * - 'date_signed': signing date (rendered from capture timestamp)
 * - 'capacity': signer's role/title (rendered from PartySignatory.capacity or capture text)
 * - 'printed_name': typed-out name (rendered from Signer.person.name or capture text)
 */
export type SigningFieldType = 'signature' | 'initials' | 'date_signed' | 'capacity' | 'printed_name'

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
 * Request core builds for a seal: the form, its values, and the target layer.
 * A `SealAdapter` receives it, with the rendered document, as a `SealAdapterRequest`.
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
	parties: Record<string, RuntimeParty | RuntimeParty[]>
	/** Global registry of signers with their adopted signatures. */
	signers: Record<string, Signer>
	/** Maps parties to their signatories. Structure: role -> partyId -> signatories. */
	signatories: Record<string, Record<string, PartySignatory[]>>
	/** Target layer key for rendering (e.g., 'docx', 'markdown'). */
	targetLayer: string
	/**
	 * Signature fields placed by anchor text, still awaiting position resolution.
	 * Present when at least one `signatures` slot bound to a filled party uses
	 * `placement.anchor`. Absent when no such slot resolves.
	 * Each field carries its signer binding and anchor info; page/x/y are
	 * placeholders. Core resolves positions by locating the anchor text in the
	 * converted PDF (the `locate` option overrides the locator).
	 */
	anchorFields?: SigningField[]
}

/**
 * SealingResult
 *
 * The canonical PDF a seal produces.
 * Contains the signature field coordinates and PDF hash for verification.
 */
export interface SealingResult {
	/** Array of signing fields with their coordinates on the PDF. */
	signatureMap: SigningField[]
	/** SHA-256 hash of the canonical PDF for integrity verification. */
	canonicalPdfHash: string
	/** Optional bytes of the canonical PDF. */
	canonicalPdfBytes?: Uint8Array
}

/** A rendered native layer supplied to a non-PDF sealing adapter. */
export interface SealAdapterDocument {
	content: string | Uint8Array
	mimeType: string
}

/** Input to an adapter that converts a rendered layer into a PDF. */
export interface SealAdapterRequest<F extends Form = Form> extends SealingRequest<F> {
	document: SealAdapterDocument
}

/** Adapter output. Core flattens and hashes these PDF bytes after conversion. */
export interface SealAdapterResult {
	pdf: Uint8Array
	/** Resolved fields for anchor/extraction modes, when applicable. */
	signatureMap?: SigningField[]
}

/** Converts a rendered non-PDF document into PDF for the common sealing pipeline. */
export interface SealAdapter {
	convert<F extends Form>(request: SealAdapterRequest<F>): Promise<SealAdapterResult>
}

// ============================================================================
// Placement Locator
// ============================================================================

/** A placement query resolved against converted PDF bytes. */
export interface AnchorLocateQuery {
	id: string
	kind: 'anchor'
	/** Literal document text to find. Must be unique unless `occurrence` picks one. */
	text: string
	/** 1-based match index in reading order when the text appears more than once. */
	occurrence?: number
}

/** A resolved placement in PDF points, y measured from the top page edge. */
export interface LocateHit {
	id: string
	/** 1-based page number. */
	page: number
	x: number
	y: number
	width: number
	height: number
}

/**
 * Resolves placement queries against a converted PDF. Implementations must be
 * all-or-nothing: throw when any query cannot be resolved deterministically.
 */
export interface SealLocator {
	locate(pdf: Uint8Array, queries: AnchorLocateQuery[]): Promise<LocateHit[]>
}
