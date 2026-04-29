/**
 * Runtime types for filled/executed Paradoc artifacts.
 * These types are used when forms are filled with data, not when defining form schemas.
 */

import type { Person, Organization, Attachment, Signature } from "../schemas/primitives";
import type { SigningField } from "./signing.js";

/**
 * Party
 *
 * A party is either a Person or an Organization.
 * Used as the base type for parties in filled forms.
 */
export type Party = Person | Organization;

/**
 * RuntimeParty
 *
 * Party (Person or Organization) with required ID for runtime execution context.
 * The ID is user-supplied and can be any format (UUID, email, etc.).
 * Used for signature and witness tracking.
 */
export type RuntimeParty = (Person | Organization) & {
	/** Unique identifier for this party in the execution context. */
	id: string;
};

/**
 * WitnessParty
 *
 * A witness who can attest to signatures. Includes identity, optional notary status.
 * Witnesses are always individuals (Person), never organizations.
 */
export interface WitnessParty {
	/** Unique identifier for this witness. */
	id: string;
	/** The witness identity (always a Person). */
	party: Person;
	/** Whether this witness is a notary public. */
	notary?: boolean;
}

/**
 * AdoptedSignature
 *
 * Reusable signature or initials image.
 * "Adopted" means the signer has approved this image to represent their signature/initials.
 */
export interface AdoptedSignature {
	/** Base64-encoded signature image or data URI. */
	image?: string;
	/** Method used to create this signature. */
	method: 'drawn' | 'typed' | 'uploaded' | 'certificate';
}

/**
 * Signer
 *
 * A person registered to sign documents, with their adopted signature/initials.
 * Signers are global - one person can sign for multiple parties.
 *
 * Examples:
 * - Jane Smith signing for herself as tenant
 * - Jane Smith signing as Managing Member for ABC LLC
 * - Jane Smith signing for both (same signer, multiple parties)
 */
export interface Signer {
	/** The person's identity. Always a Person, never an Organization. */
	person: Person;
	/** Adopted signature and initials for this signer. */
	adopted?: {
		signature?: AdoptedSignature;
		initials?: AdoptedSignature;
	};
}

/**
 * PartySignatory
 *
 * Links a signer to a party, specifying the capacity in which they sign.
 */
export interface PartySignatory {
	/** Reference to a signer ID in the signers registry. */
	signerId: string;
	/** Capacity in which they sign (CEO, Managing Member, Attorney-in-fact, etc.). */
	capacity?: string;
}

/**
 * SignatureCapture
 *
 * Records a signature/initials capture event at a specific template location.
 * Links to a signer's adopted signature or includes an override image.
 */
export interface SignatureCapture {
	/** The role ID of the party (e.g., "landlord", "tenant"). */
	role: string;
	/** The party ID (user-supplied, any format). */
	partyId: string;
	/** The signer ID (references signers registry). */
	signerId: string;
	/** Unique identifier for this location in the template. */
	locationId: string;
	/** Whether this is a full signature or initials. */
	type: 'signature' | 'initials';
	/** ISO 8601 date-time when the capture occurred. */
	timestamp: string;
	/** Override image (if different from signer's adopted signature). */
	image?: string;
	/** Override method (if different from signer's adopted signature). */
	method?: 'drawn' | 'typed' | 'uploaded' | 'certificate';
}

/**
 * AttestationTarget
 *
 * Identifies a specific signature being witnessed.
 */
export interface AttestationTarget {
	/** The role ID of the party being witnessed. */
	roleId: string;
	/** The party ID whose signature is being witnessed. */
	partyId: string;
	/** The signer ID whose signature is being witnessed. */
	signerId: string;
	/** The specific capture location being witnessed. */
	locationId?: string;
}

/**
 * Attestation
 *
 * A witness attestation containing the witness signature and the parties being witnessed.
 * Either witnessId (reference) or witness (inline) should be provided.
 */
export interface Attestation {
	/** Reference to a pre-declared witness by ID. */
	witnessId?: string;
	/** Inline witness definition. */
	witness?: WitnessParty;
	/** The witness's signature. */
	signature: Signature;
	/** The party signatures this attestation witnesses. */
	attestsTo: AttestationTarget[];
}

/**
 * Runtime form data payload for rendering.
 * Contains all data captured when filling out a form.
 */
export interface FormData {
	/** Field values keyed by field identifier. */
	fields: Record<string, unknown>;
	/** Party data keyed by role identifier. */
	parties?: Record<string, Party | Party[]>;
	/**
	 * Global registry of signers with their adopted signatures.
	 * Keyed by signer ID. One signer can sign for multiple parties.
	 */
	signers?: Record<string, Signer>;
	/**
	 * Maps parties to their signatories.
	 * Structure: role → partyId → array of signatories.
	 *
	 * For Person parties:
	 *   - Omitted or empty: person signs for themselves (signerId = partyId convention)
	 *   - Array with entry: delegate signs instead
	 *
	 * For Organization parties:
	 *   - Omitted or empty: org issues without personal signature
	 *   - Array with entries: named signer(s) sign for org
	 */
	signatories?: Record<string, Record<string, PartySignatory[]>>;
	/** Signature captures at specific template locations. */
	captures?: SignatureCapture[];
	/** Attached documents keyed by annex identifier (the key from form.annexes). */
	annexes?: Record<string, Attachment>;
}

/**
 * Runtime checklist data payload for rendering.
 * Contains status values for checklist items.
 */
export interface ChecklistData {
	/** Status values keyed by item ID. Boolean for toggle, string for enum. */
	items: Record<string, boolean | string>;
}

// =============================================================================
// Signature Rendering Context Types
// =============================================================================

/**
 * Context passed to placeholder render functions.
 * Used when signature/initials have NOT yet been captured.
 */
export interface SignaturePlaceholderContext {
	/** The role ID (e.g., "landlord", "tenant"). */
	role: string;
	/** The party ID. */
	partyId: string;
	/** The signer ID. */
	signerId: string;
	/** The template location ID. */
	locationId: string;
	/** The party data if available. */
	party?: RuntimeParty;
	/** The signer data if available. */
	signer?: Signer;
	/** The capacity in which the signer signs for this party (CEO, Managing Member, etc.). */
	capacity?: string;
}

/**
 * Context passed to captured render functions.
 * Used when signature/initials HAVE been captured.
 */
export interface SignatureCapturedContext {
	/** The role ID (e.g., "landlord", "tenant"). */
	role: string;
	/** The party ID. */
	partyId: string;
	/** The signer ID. */
	signerId: string;
	/** The template location ID. */
	locationId: string;
	/** The party data if available. */
	party?: RuntimeParty;
	/** The signer data if available. */
	signer?: Signer;
	/** The capacity in which the signer signs for this party (CEO, Managing Member, etc.). */
	capacity?: string;
	/** The capture event data. */
	capture: SignatureCapture;
}

/**
 * A placeholder value can be a static string or a function that receives context.
 */
export type SignaturePlaceholderValue = string | ((ctx: SignaturePlaceholderContext) => string);

/**
 * A captured value can be a static string or a function that receives context.
 */
export type SignatureCapturedValue = string | ((ctx: SignatureCapturedContext) => string);

// =============================================================================
// Form Lifecycle Phase Types
// =============================================================================

/**
 * FormPhase
 *
 * Discriminator for form lifecycle phases.
 * - draft: Form is being filled with data, parties, annexes, signers
 * - signable: Form data is frozen, signatures can be captured
 * - executed: Form is fully executed, all data frozen
 */
export type FormPhase = 'draft' | 'signable' | 'executed';

/**
 * DraftFormJSON
 *
 * Serialization format for a form in the draft phase.
 * All data is mutable. Signatures cannot be captured yet.
 *
 * @typeParam F - The form definition type
 */
export interface DraftFormJSON<F = unknown> {
	/** Phase discriminator - always 'draft' for this type. */
	phase: 'draft';
	/** The embedded form definition. */
	form: F;
	/** Field values keyed by field identifier. */
	fields: Record<string, unknown>;
	/** Party data keyed by role identifier. */
	parties: Record<string, Party | Party[]>;
	/** Annex data keyed by annex identifier. */
	annexes: Record<string, unknown>;
	/** Global registry of signers with their adopted signatures. */
	signers: Record<string, Signer>;
	/** Maps parties to their signatories. Structure: role → partyId → signatories. */
	signatories: Record<string, Record<string, PartySignatory[]>>;
	/** Target layer key for rendering. */
	targetLayer: string;
}

/**
 * SignableFormJSON
 *
 * Serialization format for a form in the signable phase.
 * Form data, parties, annexes, signers are frozen.
 * Signatures can be captured (append-only).
 *
 * @typeParam F - The form definition type
 */
export interface SignableFormJSON<F = unknown> {
	/** Phase discriminator - always 'signable' for this type. */
	phase: 'signable';
	/** The embedded form definition (frozen). */
	form: F;
	/** Field values keyed by field identifier (frozen). */
	fields: Record<string, unknown>;
	/** Party data keyed by role identifier (frozen). */
	parties: Record<string, Party | Party[]>;
	/** Annex data keyed by annex identifier (frozen). */
	annexes: Record<string, unknown>;
	/** Global registry of signers with their adopted signatures (frozen). */
	signers: Record<string, Signer>;
	/** Maps parties to their signatories (frozen). */
	signatories: Record<string, Record<string, PartySignatory[]>>;
	/** Signature captures at specific template locations (append-only). */
	captures: SignatureCapture[];
	/** Declared witnesses available for attestations (append-only). */
	witnesses: WitnessParty[];
	/** Witness attestations to party signatures (append-only). */
	attestations: Attestation[];
	/** Target layer key for rendering. */
	targetLayer: string;
	// === Formal Signing Fields (Optional) ===
	/** Signing field coordinates for e-signing services. Present when prepared for formal signing. */
	signatureMap?: SigningField[];
	/** SHA-256 hash of the canonical PDF for integrity verification. Present when prepared for formal signing. */
	canonicalPdfHash?: string;
}

/**
 * ExecutedFormJSON
 *
 * Serialization format for a fully executed form.
 * All data is frozen and immutable. Form execution is complete.
 *
 * @typeParam F - The form definition type
 */
export interface ExecutedFormJSON<F = unknown> {
	/** Phase discriminator - always 'executed' for this type. */
	phase: 'executed';
	/** The embedded form definition (frozen). */
	form: F;
	/** Field values keyed by field identifier (frozen). */
	fields: Record<string, unknown>;
	/** Party data keyed by role identifier (frozen). */
	parties: Record<string, Party | Party[]>;
	/** Annex data keyed by annex identifier (frozen). */
	annexes: Record<string, unknown>;
	/** Global registry of signers with their adopted signatures (frozen). */
	signers: Record<string, Signer>;
	/** Maps parties to their signatories (frozen). */
	signatories: Record<string, Record<string, PartySignatory[]>>;
	/** Signature captures at specific template locations (frozen). */
	captures: SignatureCapture[];
	/** Declared witnesses available for attestations (frozen). */
	witnesses: WitnessParty[];
	/** Witness attestations to party signatures (frozen). */
	attestations: Attestation[];
	/** Target layer key for rendering. */
	targetLayer: string;
	/** ISO 8601 date-time when the form was executed. */
	executedAt: string;
}

/**
 * AnyFormJSON
 *
 * Union type of all form JSON formats for type-safe phase handling.
 *
 * @typeParam F - The form definition type
 */
export type AnyFormJSON<F = unknown> = DraftFormJSON<F> | SignableFormJSON<F> | ExecutedFormJSON<F>;

// =============================================================================
// Checklist Lifecycle Phase Types
// =============================================================================

/**
 * ChecklistPhase
 *
 * Discriminator for checklist lifecycle phases.
 * - draft: Checklist items can be changed
 * - completed: All items are frozen, checklist is finalized
 */
export type ChecklistPhase = 'draft' | 'completed';

/**
 * DraftChecklistJSON
 *
 * Serialization format for a checklist in the draft phase.
 * Item statuses can be mutated.
 *
 * @typeParam C - The checklist definition type
 */
export interface DraftChecklistJSON<C = unknown> {
	/** Phase discriminator - always 'draft' for this type. */
	phase: 'draft';
	/** The embedded checklist definition. */
	checklist: C;
	/** Item status values keyed by item ID. */
	items: Record<string, boolean | string>;
	/** Target layer key for rendering. */
	targetLayer: string;
}

/**
 * CompletedChecklistJSON
 *
 * Serialization format for a completed checklist.
 * All item statuses are frozen and immutable.
 *
 * @typeParam C - The checklist definition type
 */
export interface CompletedChecklistJSON<C = unknown> {
	/** Phase discriminator - always 'completed' for this type. */
	phase: 'completed';
	/** The embedded checklist definition (frozen). */
	checklist: C;
	/** Item status values keyed by item ID (frozen). */
	items: Record<string, boolean | string>;
	/** Target layer key for rendering. */
	targetLayer: string;
	/** ISO 8601 date-time when the checklist was completed. */
	completedAt: string;
}

/**
 * AnyChecklistJSON
 *
 * Union type of all checklist JSON formats for type-safe phase handling.
 *
 * @typeParam C - The checklist definition type
 */
export type AnyChecklistJSON<C = unknown> = DraftChecklistJSON<C> | CompletedChecklistJSON<C>;

// =============================================================================
// Document Lifecycle Phase Types
// =============================================================================

/**
 * DocumentPhase
 *
 * Discriminator for document lifecycle phases.
 * - draft: Document layer selection can be changed
 * - final: Document is finalized, layer selection frozen
 */
export type DocumentPhase = 'draft' | 'final';

/**
 * DraftDocumentJSON
 *
 * Serialization format for a document in the draft phase.
 * Layer selection can be changed.
 *
 * @typeParam D - The document definition type
 */
export interface DraftDocumentJSON<D = unknown> {
	/** Phase discriminator - always 'draft' for this type. */
	phase: 'draft';
	/** The embedded document definition. */
	document: D;
	/** Target layer key for rendering. */
	targetLayer: string;
}

/**
 * FinalDocumentJSON
 *
 * Serialization format for a finalized document.
 * Layer selection is frozen and immutable.
 *
 * @typeParam D - The document definition type
 */
export interface FinalDocumentJSON<D = unknown> {
	/** Phase discriminator - always 'final' for this type. */
	phase: 'final';
	/** The embedded document definition (frozen). */
	document: D;
	/** Target layer key for rendering (frozen). */
	targetLayer: string;
	/** ISO 8601 date-time when the document was finalized. */
	finalizedAt: string;
}

/**
 * AnyDocumentJSON
 *
 * Union type of all document JSON formats for type-safe phase handling.
 *
 * @typeParam D - The document definition type
 */
export type AnyDocumentJSON<D = unknown> = DraftDocumentJSON<D> | FinalDocumentJSON<D>;

// =============================================================================
// Bundle Lifecycle Phase Types
// =============================================================================

/**
 * BundlePhase
 *
 * Discriminator for bundle lifecycle phases.
 * - draft: Bundle contents can be added, modified, or removed
 * - signable: Contents frozen, forms can have signatures captured
 * - executed: All contents frozen, bundle execution complete
 */
export type BundlePhase = 'draft' | 'signable' | 'executed';

/**
 * RuntimeContentJSON
 *
 * Serialized representation of a runtime content item within a bundle.
 * This is the JSON format for individual items (forms, checklists, documents).
 */
export interface RuntimeContentJSON {
	/** The kind of artifact (form, checklist, document, bundle). */
	kind: 'form' | 'checklist' | 'document' | 'bundle';
	/** The artifact definition. */
	artifact: unknown;
	/** The target layer for rendering. */
	targetLayer: string;
	/** Runtime data (for forms and checklists). */
	data?: unknown;
	/** Current phase of this content item. */
	phase?: string;
}

/**
 * DraftBundleJSON
 *
 * Serialization format for a bundle in the draft phase.
 * Contents can be added, modified, or removed.
 *
 * @typeParam B - The bundle definition type
 */
export interface DraftBundleJSON<B = unknown> {
	/** Phase discriminator - always 'draft' for this type. */
	phase: 'draft';
	/** The embedded bundle definition. */
	bundle: B;
	/** Runtime content instances keyed by content key. */
	contents: Record<string, RuntimeContentJSON>;
}

/**
 * SignableBundleJSON
 *
 * Serialization format for a bundle in the signable phase.
 * Contents are frozen, but forms within can have signatures captured.
 *
 * @typeParam B - The bundle definition type
 */
export interface SignableBundleJSON<B = unknown> {
	/** Phase discriminator - always 'signable' for this type. */
	phase: 'signable';
	/** The embedded bundle definition (frozen). */
	bundle: B;
	/** Runtime content instances keyed by content key (frozen). */
	contents: Record<string, RuntimeContentJSON>;
}

/**
 * ExecutedBundleJSON
 *
 * Serialization format for a fully executed bundle.
 * All contents are frozen and immutable.
 *
 * @typeParam B - The bundle definition type
 */
export interface ExecutedBundleJSON<B = unknown> {
	/** Phase discriminator - always 'executed' for this type. */
	phase: 'executed';
	/** The embedded bundle definition (frozen). */
	bundle: B;
	/** Runtime content instances keyed by content key (frozen). */
	contents: Record<string, RuntimeContentJSON>;
	/** ISO 8601 date-time when the bundle was executed. */
	executedAt: string;
}

/**
 * AnyBundleJSON
 *
 * Union type of all bundle JSON formats for type-safe phase handling.
 *
 * @typeParam B - The bundle definition type
 */
export type AnyBundleJSON<B = unknown> = DraftBundleJSON<B> | SignableBundleJSON<B> | ExecutedBundleJSON<B>;

// =============================================================================
// Sealing Types (E-Signing Integration)
// =============================================================================

export type {
	SigningFieldType,
	SigningField,
	SealingRequest,
	SealingResult,
	Sealer,
	// Legacy aliases (deprecated)
	FormalSigningRequest,
	FormalSigningResponse,
	FormalSigningAdapter,
} from './signing.js';
