/**
 * Form Artifact - Closure-based implementation
 *
 * This replaces the class-based FormInstance, DraftForm, SignableForm, and ExecutedForm
 * with a single file using closures and composition.
 */

import type {
	Form,
	FormField,
	FormAnnex,
	FormParty,
	Layer,
	Metadata,
	Party,
	RuntimeParty,
	Signer,
	PartySignatory,
	SignatureCapture,
	WitnessParty,
	Attestation,
	AdoptedSignature,
	SigningField,
	SigningFieldType,
	DraftFormJSON,
	SignableFormJSON,
	ExecutedFormJSON,
	Sealer,
	SealingRequest,
	DefsSection,
	Expression,
	Attachment,
	ContentRef,
} from '@paradoc/types'
import {
	parseForm,
	parseFormField,
	parseFormAnnex,
	parseFormParty,
	parseLayer,
} from '@/validation/artifact-parsers'
import {
	validateFormData,
	validatePartiesForRole,
	validateFieldInput as validateProgressiveFieldInput,
	validateFieldsPatch as validateProgressiveFieldsPatch,
	validatePartyInput as validateProgressivePartyInput,
	validatePartiesPatch as validateProgressivePartiesPatch,
	validateAnnexInput as validateProgressiveAnnexInput,
	validateAnnexesPatch as validateProgressiveAnnexesPatch,
	type ValidationResult,
	type ValidationError,
	type ProgressiveValidationResult,
	type FieldInputValidationInput,
	type PartyInputValidationInput,
	type AnnexInputValidationInput,
	type NormalizedPartyInput,
} from '@/validation'
import { toYAML } from '@/serialization/serialization'
import { withArtifactMethods, type ArtifactMethods } from '../shared/artifact-methods'
import { layer as layerBuilder, type FileLayerBuilderType, type InlineLayerBuilderType } from '@/artifacts/builders/layer'
import { type Buildable, resolveBuildable } from '@/artifacts/shared/buildable'
import type { FieldsToDataType } from '@/inference'
import type { FormRuntimeState, FieldRuntimeState, AnnexRuntimeState, FormRulesValidationResult } from '@/logic'
import { evaluateFormDefs, evaluateFormRules } from '@/logic'
import type { RuntimeFormRenderOptions, RenderOptions, RendererLayer } from '@/types'
import type {
	PartialFillOptions,
	UpdateOptions,
	FillTargetOptions,
	FillTarget,
	FillState,
} from '@/fill-state/types'
import { computeFillState, computeRuntimeState, getAvailableFillTargets, getNextFillTarget } from '@/fill-state/engine'

// ============================================================================
// Type Inference for Form Payloads
// ============================================================================

/**
 * Helper to extract the form schema from either a raw Form or FormInstance.
 * FormInstance has a _schema property containing the form definition.
 */
type ExtractFormSchema<T> = T extends { _schema: infer S } ? S : T

/**
 * Extracts the fields record type from a form payload.
 * Works with both raw Form types and FormInstance types.
 */
export type ExtractFields<F> = ExtractFormSchema<F> extends { fields: infer Fields }
	? Fields extends Record<string, FormField>
		? FieldsToDataType<Fields>
		: Record<string, unknown>
	: Record<string, unknown>

/**
 * Extracts field keys from a form type.
 */
export type FieldKeys<F> = keyof ExtractFields<F> & string

/**
 * Extracts party role keys from a form type.
 */
export type PartyRoleKeys<F> = ExtractFormSchema<F> extends { parties: infer P }
	? P extends Record<string, FormParty>
		? keyof P & string
		: string
	: string

/**
 * Extracts parties record type with actual keys from a form type.
 */
type ExtractParties<F> = ExtractFormSchema<F> extends { parties: infer P }
	? P extends Record<string, FormParty>
		? { [K in keyof P]: RuntimeParty | RuntimeParty[] }
		: Record<string, RuntimeParty | RuntimeParty[]>
	: Record<string, RuntimeParty | RuntimeParty[]>

/**
 * Extracts annexes record type with actual keys from a form type.
 */
type ExtractAnnexes<F> = ExtractFormSchema<F> extends { annexes: infer A }
	? A extends Record<string, unknown>
		? { [K in keyof A]: Partial<Attachment> }
		: Record<string, Partial<Attachment>>
	: Record<string, Partial<Attachment>>

/**
 * Helper to check if a form has fields defined.
 */
type HasDefinedFields<F> = ExtractFormSchema<F> extends { fields: infer Fields }
	? Fields extends Record<string, FormField>
		? keyof Fields extends never
			? false
			: true
		: false
	: false

/**
 * Helper to check if a form has parties defined.
 */
type HasDefinedParties<F> = ExtractFormSchema<F> extends { parties: infer P }
	? P extends Record<string, FormParty>
		? keyof P extends never
			? false
			: true
		: false
	: false

/**
 * Helper to check if a form has annexes defined.
 */
type HasDefinedAnnexes<F> = ExtractFormSchema<F> extends { annexes: infer A }
	? A extends Record<string, unknown>
		? keyof A extends never
			? false
			: true
		: false
	: false

/**
 * Conditionally add fields property based on form definition.
 */
type FieldsPayload<F> = HasDefinedFields<F> extends true
	? { fields: ExtractFields<F> }
	: { fields?: ExtractFields<F> }

/**
 * Conditionally add parties property based on form definition.
 */
type PartiesPayload<F> = HasDefinedParties<F> extends true
	? { parties: ExtractParties<F> }
	: { parties?: ExtractParties<F> }

/**
 * Conditionally add annexes property based on form definition.
 */
type AnnexesPayload<F> = HasDefinedAnnexes<F> extends true
	? { annexes: ExtractAnnexes<F> }
	: { annexes?: ExtractAnnexes<F> }

/**
 * Infers the full payload type for filling a form.
 * Works with both raw Form types and FormInstance types.
 * Fields, parties, and annexes are required if defined in the form, optional otherwise.
 */
export type InferFormPayload<F> = FieldsPayload<F> &
	PartiesPayload<F> &
	AnnexesPayload<F> & {
		signers?: Record<string, Signer>
		signatories?: Record<string, Record<string, PartySignatory[]>>
	}

// ============================================================================
// Types
// ============================================================================

/**
 * Form input type for direct creation (kind is optional)
 */
export type FormInput = Omit<Form, 'kind'> & { kind?: 'form' }

/**
 * Capture options for signatures
 */
export interface CaptureOptions {
	/** For 'signature' / 'initials' captures: glyph image (data URI or base64). */
	image?: string
	/** For 'capacity' / 'printed_name' captures: typed text value. */
	text?: string
	method?: 'drawn' | 'typed' | 'uploaded' | 'certificate'
	timestamp?: string
}

/**
 * RuntimeForm JSON representation (union of all phases)
 */
export type RuntimeFormJSON<F extends Form> = DraftFormJSON<F> | SignableFormJSON<F> | ExecutedFormJSON<F>

/**
 * Custom error class for data validation failures
 */
export class FormValidationError extends Error {
	readonly errors: ValidationError[]

	constructor(errors: ValidationError[]) {
		super(`Form data validation failed: ${errors.map((e) => e.message).join(', ')}`)
		this.name = 'FormValidationError'
		this.errors = errors
	}
}

/**
 * Custom error class for rule validation failures
 */
export class FormRuleViolationError extends Error {
	readonly ruleResult: FormRulesValidationResult

	constructor(result: FormRulesValidationResult) {
		super(`Form rules validation failed: ${result.errors.map((e) => e.message || e.ruleId).join(', ')}`)
		this.name = 'FormRuleViolationError'
		this.ruleResult = result
	}
}

/**
 * Options for fill() and safeFill().
 */
export interface FillValidationOptions {
	/** Whether to validate rules after filling. Defaults to true. */
	rules?: boolean
}

/**
 * Comprehensive validation result returned by DraftForm.validate().
 */
export interface FormValidationResult {
	/** True if all error-severity rules passed (warnings don't block). Always true if no rules defined. */
	valid: boolean
	/** Full rule evaluation results */
	rules: FormRulesValidationResult
}

/**
 * Result of safeFill() — success means data valid AND rules pass.
 */
export type SafeFillResult<F extends Form> =
	| { success: true; data: DraftForm<F>; rules: FormRulesValidationResult }
	| { success: false; error: Error; data?: DraftForm<F>; rules?: FormRulesValidationResult }

/**
 * Result of safePartialFill() — success means provided data is valid.
 */
export type SafePartialFillResult<F extends Form> =
	| { success: true; data: DraftForm<F> }
	| { success: false; error: Error }

/**
 * FormInstance - design-time wrapper for Form artifacts
 */
export interface FormInstance<F extends Form> extends ArtifactMethods<F> {
	/** Form defs section */
	readonly defs: F extends { defs: infer L } ? L : DefsSection | undefined

	/** Form fields */
	readonly fields: F extends { fields: infer Flds } ? Flds : Record<string, FormField> | undefined

	/** Form layers */
	readonly layers: F extends { layers: infer Lyrs } ? Lyrs : Record<string, Layer> | undefined

	/** Default layer key */
	readonly defaultLayer: F extends { defaultLayer: infer DL } ? DL : string | undefined

	/** Form annexes */
	readonly annexes: F extends { annexes: infer Anx } ? Anx : Record<string, FormAnnex> | undefined

	/** Allow additional annexes */
	readonly allowAdditionalAnnexes: F extends { allowAdditionalAnnexes: infer AAA } ? AAA : boolean | undefined

	/** Form parties */
	readonly parties: F extends { parties: infer Pts } ? Pts : Record<string, FormParty> | undefined

	/**
	 * Validates data payload against this form.
	 * @throws FormValidationError if validation fails
	 */
	parseData(data: Record<string, unknown>): InferFormPayload<F>

	/**
	 * Validates data payload against this form.
	 * Returns a result object instead of throwing.
	 */
	safeParseData(data: Record<string, unknown>): ValidationResult<InferFormPayload<F>>

	/**
	 * Validate a single field input against a `fields.<path>` schema.
	 */
	validateFieldInput(input: FieldInputValidationInput): ProgressiveValidationResult<unknown>

	/**
	 * Validate a partial fields patch without requiring unrelated fields.
	 */
	validateFieldsPatch(fields: unknown): ProgressiveValidationResult<Record<string, unknown>>

	/**
	 * Validate one party value for a role/index and normalize party ID.
	 */
	validatePartyInput(input: PartyInputValidationInput): ProgressiveValidationResult<NormalizedPartyInput>

	/**
	 * Validate a partial parties patch without requiring unrelated roles.
	 */
	validatePartiesPatch(parties: unknown): ProgressiveValidationResult<Record<string, RuntimeParty | RuntimeParty[]>>

	/**
	 * Validate one annex value against configured annex keys.
	 */
	validateAnnexInput(input: AnnexInputValidationInput): ProgressiveValidationResult<unknown>

	/**
	 * Validate a partial annexes patch against configured annex keys.
	 */
	validateAnnexesPatch(annexes: unknown): ProgressiveValidationResult<Record<string, unknown>>

	/**
	 * Create a RuntimeForm in draft phase with data.
	 * By default validates both data and rules.
	 * @throws FormValidationError if data validation fails
	 * @throws FormRuleViolationError if rules validation fails (when rules option is true)
	 */
	fill(data: InferFormPayload<F>, options?: FillValidationOptions): DraftForm<F>

	/**
	 * Safely create a RuntimeForm, returning a result object instead of throwing.
	 * By default validates both data and rules.
	 * success is true only when data is valid AND all error-severity rules pass.
	 * When data is valid but rules fail, the result includes `data` (the DraftForm) for inspection.
	 */
	safeFill(data: InferFormPayload<F>, options?: FillValidationOptions): SafeFillResult<F>

	/**
	 * Create a DraftForm from partial (or empty) data for progressive filling.
	 * Uses patch validation by default — only validates provided fields.
	 * @throws FormValidationError if validation fails (when validate is "patch" or "full")
	 */
	partialFill(seed?: Partial<InferFormPayload<F>>, options?: PartialFillOptions): DraftForm<F>

	/**
	 * Safely create a DraftForm from partial data, returning a result object.
	 */
	safePartialFill(seed?: Partial<InferFormPayload<F>>, options?: PartialFillOptions): SafePartialFillResult<F>

	/**
	 * Render form content directly.
	 */
	render<Output>(options: RenderOptions<Output>): Promise<Output>

	/**
	 * Create an exact copy of this instance.
	 */
	clone(): FormInstance<F>
}

// ============================================================================
// Phase-Specific Interfaces (Discriminated Union)
// ============================================================================

/**
 * Base interface with shared read-only properties and methods (all phases)
 */
interface RuntimeFormBase<F extends Form> {
	/** Embedded form definition */
	readonly form: F

	/** Target layer key */
	readonly targetLayer: string

	/** Field values */
	readonly fields: Record<string, unknown>

	/** Party data indexed by role ID */
	readonly parties: Record<string, Party | Party[]>

	/** Annex data indexed by annex ID */
	readonly annexes: Record<string, unknown>

	/** Global registry of signers */
	readonly signers: Record<string, Signer>

	/** Maps parties to their signatories */
	readonly signatories: Record<string, Record<string, PartySignatory[]>>

	// Convenience getters
	readonly name: string
	readonly version: string | undefined
	readonly title: string | undefined

	// Field Access
	getField<K extends FieldKeys<F>>(fieldId: K): ExtractFields<F>[K] | undefined
	getAllFields(): ExtractFields<F>

	// Party Access
	getParty<R extends PartyRoleKeys<F>>(roleId: R): Party | Party[] | undefined
	getParties<R extends PartyRoleKeys<F>>(roleId: R): Party[]
	getPartyCount<R extends PartyRoleKeys<F>>(roleId: R): number

	// Signer Access
	getSigner(signerId: string): Signer | undefined
	hasSigner(signerId: string): boolean
	getSignerAdoptedSignature(signerId: string): AdoptedSignature | undefined

	// Signatory Access
	getSignatories<R extends PartyRoleKeys<F>>(roleId: R, partyId: string): PartySignatory[]

	// Annex Access
	getAnnex(annexId: string): unknown

	// Status Methods
	getSignatureStatus<R extends PartyRoleKeys<F>>(roleId: R): {
		required: number
		collected: number
		complete: boolean
		parties: Array<{ partyId: string; hasSignatory: boolean; hasCapture: boolean; witnessed: boolean }>
	}
	getOverallSignatureStatus(): {
		roles: Record<string, { required: number; collected: number; complete: boolean }>
		complete: boolean
		totalRequired: number
		totalCollected: number
	}

	// Runtime State (Logic Evaluation)
	readonly runtimeState: FormRuntimeState
	getFieldState(fieldId: string): FieldRuntimeState | undefined
	isFieldVisible(fieldId: string): boolean
	isFieldRequired(fieldId: string): boolean
	isFieldDisabled(fieldId: string): boolean
	getVisibleFields(): FieldRuntimeState[]
	getRequiredVisibleFields(): FieldRuntimeState[]
	getAnnexState(annexId: string): AnnexRuntimeState | undefined
	isAnnexVisible(annexId: string): boolean
	isAnnexRequired(annexId: string): boolean
	getLogicValue(key: string): unknown

	// Rules Validation
	validateRules(): FormRulesValidationResult

	// Validation
	/** Returns true if all error-severity rules pass. Always true if no rules defined. */
	isValid(): boolean
	/** Returns comprehensive validation result including rule details. */
	validate(): FormValidationResult

	// Serialization
	render<Output>(options: RuntimeFormRenderOptions<Output>): Promise<Output>
	toJSON(): RuntimeFormJSON<F>
	toYAML(): string
}

/**
 * Draft phase - can modify fields, parties, signers, annexes
 */
export interface DraftForm<F extends Form> extends RuntimeFormBase<F> {
	/** Phase discriminator */
	readonly phase: 'draft'

	/** No captures in draft */
	readonly captures: []

	/** No witnesses in draft */
	readonly witnesses: []

	/** No attestations in draft */
	readonly attestations: []

	/** No execution timestamp in draft */
	readonly executedAt: undefined

	/** No signature map in draft */
	readonly signatureMap: undefined

	/** No canonical hash in draft */
	readonly canonicalPdfHash: undefined

	// Field Mutation
	setField<K extends FieldKeys<F>>(fieldId: K, value: ExtractFields<F>[K]): DraftForm<F>
	updateFields(partial: Partial<ExtractFields<F>>): DraftForm<F>

	// Party Mutation
	setParty<R extends PartyRoleKeys<F>>(roleId: R, party: Party | Party[]): DraftForm<F>
	addParty<R extends PartyRoleKeys<F>>(roleId: R, party: Party): DraftForm<F>
	removeParty<R extends PartyRoleKeys<F>>(roleId: R, index: number): DraftForm<F>

	// Signer Mutation
	addSigner(signerId: string, signer: Signer): DraftForm<F>
	removeSigner(signerId: string): DraftForm<F>

	// Signatory Mutation
	addSignatory<R extends PartyRoleKeys<F>>(roleId: R, partyId: string, signatory: PartySignatory): DraftForm<F>

	// Annex Mutation
	setAnnex(annexId: string, annexData: unknown): DraftForm<F>

	// Progressive Fill
	/**
	 * Merge a patch into current data and return a new DraftForm.
	 * @throws FormValidationError if validation fails
	 */
	update(patch: Partial<InferFormPayload<F>>, options?: UpdateOptions): DraftForm<F>

	/**
	 * Safely merge a patch, returning a result object instead of throwing.
	 */
	safeUpdate(patch: Partial<InferFormPayload<F>>, options?: UpdateOptions): SafePartialFillResult<F>

	/**
	 * Compute the full fill state: open/blocked/done items, candidates, summary.
	 */
	getFillState(options?: FillTargetOptions): FillState

	/**
	 * Get the next recommended fill target, or null if all required are done.
	 */
	getNextFillTarget(options?: FillTargetOptions): FillTarget | null

	/**
	 * Get all available fill targets in declaration order.
	 */
	getAvailableFillTargets(options?: FillTargetOptions): FillTarget[]

	// Layer Management
	setTargetLayer<K extends keyof F['layers'] & string>(layer: K): DraftForm<F>

	// Phase Transitions (draft → signable)
	prepareForSigning(): SignableForm<F>
	seal(adapter: Sealer): Promise<SignableForm<F>>

	// Formal signing helpers (always false in draft)
	readonly isFormal: false
	getSignerForField(fieldId: string): undefined
	getFieldsForSigner(signerId: string): []

	// Clone
	clone(): DraftForm<F>
}

/**
 * Signable phase - can capture signatures, add witnesses, attestations
 */
export interface SignableForm<F extends Form> extends RuntimeFormBase<F> {
	/** Phase discriminator */
	readonly phase: 'signable'

	/** Signature captures */
	readonly captures: SignatureCapture[]

	/** Declared witnesses */
	readonly witnesses: WitnessParty[]

	/** Witness attestations */
	readonly attestations: Attestation[]

	/** No execution timestamp in signable */
	readonly executedAt: undefined

	/** Signing field coordinates (when formal) */
	readonly signatureMap: SigningField[] | undefined

	/** SHA-256 hash of canonical PDF (when formal) */
	readonly canonicalPdfHash: string | undefined

	// Capture Methods
	captureSignature(role: string, partyId: string, signerId: string, locationId: string, options?: CaptureOptions): SignableForm<F>
	captureInitials(role: string, partyId: string, signerId: string, locationId: string, options?: CaptureOptions): SignableForm<F>
	captureCapacity(role: string, partyId: string, signerId: string, locationId: string, text: string, options?: Omit<CaptureOptions, 'text'>): SignableForm<F>
	capturePrintedName(role: string, partyId: string, signerId: string, locationId: string, text: string, options?: Omit<CaptureOptions, 'text'>): SignableForm<F>
	getCapture(role: string, partyId: string, signerId: string, locationId: string, type: 'signature' | 'initials' | 'capacity' | 'printed_name'): SignatureCapture | undefined
	getCapturesForLocation(locationId: string): SignatureCapture[]
	getCapturesForParty(roleId: string, partyId: string): SignatureCapture[]
	getCapturesForSigner(signerId: string): SignatureCapture[]

	// Witness Methods
	getWitness(witnessId: string): WitnessParty | undefined
	hasWitness(witnessId: string): boolean
	addWitness(witness: WitnessParty): SignableForm<F>

	// Attestation Methods
	getAttestationsByWitness(witnessId: string): Attestation[]
	getAttestationsForParty<R extends PartyRoleKeys<F>>(roleId: R, partyId: string, signerId?: string): Attestation[]
	addAttestation(attestation: Attestation): SignableForm<F>

	// Layer Management (read-only in signable - can still set but returns same phase)
	setTargetLayer<K extends keyof F['layers'] & string>(layer: K): SignableForm<F>

	// Phase Transition (signable → executed)
	finalize(): ExecutedForm<F>

	// Formal signing helpers
	readonly isFormal: boolean
	getSignerForField(fieldId: string): Signer | undefined
	getFieldsForSigner(signerId: string): SigningField[]

	// Clone
	clone(): SignableForm<F>
}

/**
 * Executed phase - immutable, read-only
 */
export interface ExecutedForm<F extends Form> extends RuntimeFormBase<F> {
	/** Phase discriminator */
	readonly phase: 'executed'

	/** Signature captures */
	readonly captures: SignatureCapture[]

	/** Declared witnesses */
	readonly witnesses: WitnessParty[]

	/** Witness attestations */
	readonly attestations: Attestation[]

	/** Execution timestamp (always defined) */
	readonly executedAt: string

	/** Signing field coordinates (when formal) */
	readonly signatureMap: SigningField[] | undefined

	/** SHA-256 hash of canonical PDF (when formal) */
	readonly canonicalPdfHash: string | undefined

	// Capture read-only access
	getCapture(role: string, partyId: string, signerId: string, locationId: string, type: 'signature' | 'initials' | 'capacity' | 'printed_name'): SignatureCapture | undefined
	getCapturesForLocation(locationId: string): SignatureCapture[]
	getCapturesForParty(roleId: string, partyId: string): SignatureCapture[]
	getCapturesForSigner(signerId: string): SignatureCapture[]

	// Witness read-only access
	getWitness(witnessId: string): WitnessParty | undefined
	hasWitness(witnessId: string): boolean

	// Attestation read-only access
	getAttestationsByWitness(witnessId: string): Attestation[]
	getAttestationsForParty<R extends PartyRoleKeys<F>>(roleId: R, partyId: string, signerId?: string): Attestation[]

	// Formal signing helpers
	readonly isFormal: boolean
	getSignerForField(fieldId: string): Signer | undefined
	getFieldsForSigner(signerId: string): SigningField[]

	// Clone
	clone(): ExecutedForm<F>
}

/**
 * RuntimeForm - discriminated union of all phases
 */
export type RuntimeForm<F extends Form> = DraftForm<F> | SignableForm<F> | ExecutedForm<F>

// ============================================================================
// Constants
// ============================================================================

const PDF_CONVERTIBLE_LAYERS = ['docx', 'markdown', 'html', 'text'] as const

// ============================================================================
// RuntimeForm Factory
// ============================================================================

interface RuntimeFormConfigBase<F extends Form> {
	form: F
	fields: Record<string, unknown>
	parties: Record<string, Party | Party[]>
	annexes: Record<string, unknown>
	signers: Record<string, Signer>
	signatories: Record<string, Record<string, PartySignatory[]>>
	targetLayer: string
	captures?: SignatureCapture[]
	witnesses?: WitnessParty[]
	attestations?: Attestation[]
	signatureMap?: SigningField[]
	canonicalPdfHash?: string
}

interface RuntimeFormConfigDraft<F extends Form> extends RuntimeFormConfigBase<F> {
	phase: 'draft'
	executedAt?: undefined
}

interface RuntimeFormConfigSignable<F extends Form> extends RuntimeFormConfigBase<F> {
	phase: 'signable'
	executedAt?: undefined
}

interface RuntimeFormConfigExecuted<F extends Form> extends RuntimeFormConfigBase<F> {
	phase: 'executed'
	executedAt: string
}

type RuntimeFormConfig<F extends Form> =
	| RuntimeFormConfigDraft<F>
	| RuntimeFormConfigSignable<F>
	| RuntimeFormConfigExecuted<F>

/**
 * Creates a RuntimeForm object (replaces DraftForm, SignableForm, ExecutedForm classes)
 * Uses function overloads for correct return type narrowing.
 */
function createRuntimeForm<F extends Form>(config: RuntimeFormConfigDraft<F>): DraftForm<F>
function createRuntimeForm<F extends Form>(config: RuntimeFormConfigSignable<F>): SignableForm<F>
function createRuntimeForm<F extends Form>(config: RuntimeFormConfigExecuted<F>): ExecutedForm<F>
function createRuntimeForm<F extends Form>(config: RuntimeFormConfig<F>): RuntimeForm<F>
function createRuntimeForm<F extends Form>(config: RuntimeFormConfig<F>): RuntimeForm<F> {
	const {
		form: formDef,
		fields: fieldValues,
		parties: partyValues,
		annexes: annexValues,
		signers: signerValues,
		signatories: signatoryValues,
		targetLayer,
		phase,
		captures = [],
		witnesses = [],
		attestations = [],
		executedAt,
		signatureMap,
		canonicalPdfHash,
	} = config

	// Cached runtime state
	let _runtimeState: FormRuntimeState | null = null

	// Helper functions
	const validateRoleId = (roleId: string): void => {
		const formParties = formDef.parties ?? {}
		if (!(roleId in formParties)) {
			const validRoles = Object.keys(formParties)
			throw new Error(`Role "${roleId}" not found in form. Valid roles: ${validRoles.join(', ') || 'none'}`)
		}
	}

	const getPartiesInternal = (roleId: string): Party[] => {
		const p = partyValues[roleId]
		if (!p) return []
		return Array.isArray(p) ? p : [p]
	}

	const ensureDraft = (operation: string): void => {
		if (phase !== 'draft') {
			throw new Error(`Cannot ${operation}: form is in ${phase} phase (only draft phase allows modifications)`)
		}
	}

	const ensureSignable = (operation: string): void => {
		if (phase !== 'signable') {
			throw new Error(`Cannot ${operation}: form is in ${phase} phase (only signable phase allows this)`)
		}
	}

	const getRuntimeState = (): FormRuntimeState => {
		if (!_runtimeState) {
			const result = evaluateFormDefs(formDef, { fields: fieldValues })
			if ('value' in result) {
				_runtimeState = result.value
			} else {
				_runtimeState = {
					fields: new Map(),
					annexes: new Map(),
					defsValues: new Map(),
				}
			}
		}
		return _runtimeState
	}

	const augmentPartiesForRender = (): Record<string, unknown> => {
		const augmented: Record<string, unknown> = {}

		for (const [roleId, partyOrParties] of Object.entries(partyValues)) {
			const roleSignatories = signatoryValues[roleId] ?? {}

			if (Array.isArray(partyOrParties)) {
				augmented[roleId] = partyOrParties.map((party) => {
					const partyId = (party as { id?: string }).id
					return augmentParty(party, roleId, partyId, roleSignatories)
				})
			} else {
				const partyId = (partyOrParties as { id?: string }).id
				augmented[roleId] = augmentParty(partyOrParties, roleId, partyId, roleSignatories)
			}
		}

		return augmented
	}

	const augmentParty = (
		party: Party,
		roleId: string,
		partyId: string | undefined,
		roleSignatories: Record<string, PartySignatory[]>,
	): Party & { _role: string; signatories: Array<PartySignatory & { signer: Signer; _role: string; _partyId: string }> } => {
		const partySignatories = partyId ? (roleSignatories[partyId] ?? []) : []

		const resolvedSignatories = partySignatories.map((signatory) => ({
			...signatory,
			signer: signerValues[signatory.signerId]!,
			_role: roleId,
			_partyId: partyId ?? '',
		}))

		return {
			...party,
			_role: roleId,
			signatories: resolvedSignatories,
		}
	}

	// Note: This object is typed as a union to allow all methods to be defined.
	// The overloads on createRuntimeForm ensure consumers get the correct phase-specific type.
	// Runtime checks (ensureDraft, ensureSignable) enforce correct behavior.
	const runtime = {
		phase,
		form: formDef,
		targetLayer,
		fields: fieldValues,
		parties: partyValues,
		annexes: annexValues,
		signers: signerValues,
		signatories: signatoryValues,
		captures,
		witnesses,
		attestations,
		executedAt,
		signatureMap,
		canonicalPdfHash,

		// Convenience getters
		get name() {
			return formDef.name
		},
		get version() {
			return formDef.version
		},
		get title() {
			return formDef.title
		},

		// ============================================================================
		// Field Access
		// ============================================================================

		getField<K extends FieldKeys<F>>(fieldId: K): ExtractFields<F>[K] | undefined {
			return fieldValues[fieldId] as ExtractFields<F>[K] | undefined
		},

		getAllFields(): ExtractFields<F> {
			return fieldValues as ExtractFields<F>
		},

		// ============================================================================
		// Field Mutation (draft only)
		// ============================================================================

		setField<K extends FieldKeys<F>>(fieldId: K, value: ExtractFields<F>[K]): RuntimeForm<F> {
			ensureDraft('setField')
			const newFields = { ...fieldValues, [fieldId]: value }
			// Validate
			const result = validateFormData(formDef, { fields: newFields })
			if (!result.success) {
				throw new FormValidationError(result.errors)
			}
			return createRuntimeForm({
				...config,
				fields: (result.data as { fields: Record<string, unknown> }).fields,
			})
		},

		updateFields(partial: Partial<ExtractFields<F>>): RuntimeForm<F> {
			ensureDraft('updateFields')
			const newFields = { ...fieldValues, ...partial }
			const result = validateFormData(formDef, { fields: newFields })
			if (!result.success) {
				throw new FormValidationError(result.errors)
			}
			return createRuntimeForm({
				...config,
				fields: (result.data as { fields: Record<string, unknown> }).fields,
			})
		},

		// ============================================================================
		// Party Access
		// ============================================================================

		getParty<R extends PartyRoleKeys<F>>(roleId: R): Party | Party[] | undefined {
			validateRoleId(roleId)
			return partyValues[roleId]
		},

		getParties<R extends PartyRoleKeys<F>>(roleId: R): Party[] {
			validateRoleId(roleId)
			return getPartiesInternal(roleId)
		},

		getPartyCount<R extends PartyRoleKeys<F>>(roleId: R): number {
			validateRoleId(roleId)
			return getPartiesInternal(roleId).length
		},

		// ============================================================================
		// Party Mutation (draft only)
		// ============================================================================

		setParty<R extends PartyRoleKeys<F>>(roleId: R, party: Party | Party[]): RuntimeForm<F> {
			ensureDraft('setParty')
			validateRoleId(roleId)
			return createRuntimeForm({
				...config,
				parties: { ...partyValues, [roleId]: party },
			})
		},

		addParty<R extends PartyRoleKeys<F>>(roleId: R, party: Party): RuntimeForm<F> {
			ensureDraft('addParty')
			validateRoleId(roleId)
			const currentParties = getPartiesInternal(roleId)
			return createRuntimeForm({
				...config,
				parties: { ...partyValues, [roleId]: [...currentParties, party] },
			})
		},

		removeParty<R extends PartyRoleKeys<F>>(roleId: R, index: number): RuntimeForm<F> {
			ensureDraft('removeParty')
			validateRoleId(roleId)
			const currentParties = getPartiesInternal(roleId)

			if (index < 0 || index >= currentParties.length) {
				throw new Error(`Invalid party index ${index} for role "${roleId}". Valid indices: 0-${currentParties.length - 1}`)
			}

			const newParties = [...currentParties]
			newParties.splice(index, 1)

			const newPartiesRecord = { ...partyValues }
			if (newParties.length === 0) {
				delete newPartiesRecord[roleId]
			} else if (newParties.length === 1) {
				newPartiesRecord[roleId] = newParties[0]!
			} else {
				newPartiesRecord[roleId] = newParties
			}

			return createRuntimeForm({
				...config,
				parties: newPartiesRecord,
			})
		},

		// ============================================================================
		// Signer Access/Mutation
		// ============================================================================

		getSigner(signerId: string): Signer | undefined {
			return signerValues[signerId]
		},

		hasSigner(signerId: string): boolean {
			return signerValues[signerId] !== undefined
		},

		getSignerAdoptedSignature(signerId: string): AdoptedSignature | undefined {
			return signerValues[signerId]?.adopted?.signature
		},

		addSigner(signerId: string, signer: Signer): RuntimeForm<F> {
			ensureDraft('addSigner')
			if (signerValues[signerId]) {
				throw new Error(`Signer with ID "${signerId}" already exists`)
			}
			return createRuntimeForm({
				...config,
				signers: { ...signerValues, [signerId]: signer },
			})
		},

		removeSigner(signerId: string): RuntimeForm<F> {
			ensureDraft('removeSigner')
			const newSigners = { ...signerValues }
			delete newSigners[signerId]

			// Remove signatories referencing this signer
			const newSignatories: Record<string, Record<string, PartySignatory[]>> = {}
			for (const [roleId, roleSignatories] of Object.entries(signatoryValues)) {
				newSignatories[roleId] = {}
				for (const [partyId, signatoryList] of Object.entries(roleSignatories)) {
					const filtered = signatoryList.filter((s) => s.signerId !== signerId)
					if (filtered.length > 0) {
						newSignatories[roleId][partyId] = filtered
					}
				}
				if (Object.keys(newSignatories[roleId]).length === 0) {
					delete newSignatories[roleId]
				}
			}

			return createRuntimeForm({
				...config,
				signers: newSigners,
				signatories: newSignatories,
			})
		},

		// ============================================================================
		// Signatory Access/Mutation
		// ============================================================================

		getSignatories<R extends PartyRoleKeys<F>>(roleId: R, partyId: string): PartySignatory[] {
			validateRoleId(roleId)
			return signatoryValues[roleId]?.[partyId] ?? []
		},

		addSignatory<R extends PartyRoleKeys<F>>(roleId: R, partyId: string, signatory: PartySignatory): RuntimeForm<F> {
			ensureDraft('addSignatory')
			validateRoleId(roleId)
			if (!signerValues[signatory.signerId]) {
				throw new Error(`Signer with ID "${signatory.signerId}" not found in registry`)
			}
			const currentSignatories = signatoryValues[roleId]?.[partyId] ?? []
			const newSignatories: Record<string, Record<string, PartySignatory[]>> = {
				...signatoryValues,
				[roleId]: {
					...signatoryValues[roleId],
					[partyId]: [...currentSignatories, signatory],
				},
			}
			return createRuntimeForm({
				...config,
				signatories: newSignatories,
			})
		},

		// ============================================================================
		// Annex Access/Mutation
		// ============================================================================

		getAnnex(annexId: string): unknown {
			return annexValues[annexId]
		},

		setAnnex(annexId: string, annexData: unknown): RuntimeForm<F> {
			ensureDraft('setAnnex')
			return createRuntimeForm({
				...config,
				annexes: { ...annexValues, [annexId]: annexData },
			})
		},

		// ============================================================================
		// Progressive Fill Methods (draft only)
		// ============================================================================

		update(patch: Partial<InferFormPayload<F>>, options?: UpdateOptions): DraftForm<F> {
			ensureDraft('update')
			const validate = options?.validate ?? 'patch'
			const checkRules = options?.rules === true

			const patchFields = (patch as Record<string, unknown>).fields as Record<string, unknown> | undefined
			const patchParties = (patch as Record<string, unknown>).parties as Record<string, Party | Party[]> | undefined
			const patchAnnexes = (patch as Record<string, unknown>).annexes as Record<string, unknown> | undefined

			const mergedFields = { ...fieldValues, ...patchFields }
			const mergedParties = { ...partyValues, ...patchParties }
			const mergedAnnexes = { ...annexValues, ...patchAnnexes }

			if (validate === 'patch') {
				if (patchFields && Object.keys(patchFields).length > 0) {
					const fieldResult = validateProgressiveFieldsPatch(formDef, patchFields)
					if (!fieldResult.success) {
						throw new FormValidationError(fieldResult.errors)
					}
				}
				if (patchParties && Object.keys(patchParties).length > 0) {
					const partyResult = validateProgressivePartiesPatch(formDef, patchParties)
					if (!partyResult.success) {
						throw new FormValidationError(partyResult.errors)
					}
				}
				if (patchAnnexes && Object.keys(patchAnnexes).length > 0) {
					const annexResult = validateProgressiveAnnexesPatch(formDef, patchAnnexes)
					if (!annexResult.success) {
						throw new FormValidationError(annexResult.errors)
					}
				}
			} else if (validate === 'full') {
				const fieldData = { fields: mergedFields, ...(Object.keys(mergedAnnexes).length > 0 ? { annexes: mergedAnnexes } : {}) }
				const result = validateFormData(formDef, fieldData)
				if (!result.success) {
					throw new FormValidationError(result.errors)
				}
			}

			const draft = createRuntimeForm<F>({
				...config,
				fields: mergedFields,
				parties: mergedParties,
				annexes: mergedAnnexes,
				phase: 'draft',
				executedAt: undefined,
			})

			if (checkRules) {
				const ruleResult = draft.validateRules()
				if (!ruleResult.valid) {
					throw new FormRuleViolationError(ruleResult)
				}
			}

			return draft
		},

		safeUpdate(patch: Partial<InferFormPayload<F>>, options?: UpdateOptions): SafePartialFillResult<F> {
			ensureDraft('safeUpdate')
			try {
				const draft = runtime.update(patch, { ...options, rules: false })

				if (options?.rules === true) {
					const ruleResult = draft.validateRules()
					if (!ruleResult.valid) {
						return { success: false, error: new FormRuleViolationError(ruleResult) }
					}
				}

				return { success: true, data: draft }
			} catch (err) {
				return { success: false, error: err as Error }
			}
		},

		getFillState(options?: FillTargetOptions): FillState {
			const state = getRuntimeState()
			return computeFillState(formDef, fieldValues, partyValues, annexValues, state, options)
		},

		getNextFillTarget(options?: FillTargetOptions): FillTarget | null {
			const state = getRuntimeState()
			return getNextFillTarget(formDef, fieldValues, partyValues, annexValues, state, options)
		},

		getAvailableFillTargets(options?: FillTargetOptions): FillTarget[] {
			const state = getRuntimeState()
			return getAvailableFillTargets(formDef, fieldValues, partyValues, annexValues, state, options)
		},

		// ============================================================================
		// Capture Methods (signable only)
		// ============================================================================

		captureSignature(
			role: string,
			partyId: string,
			signerId: string,
			locationId: string,
			options?: CaptureOptions,
		): RuntimeForm<F> {
			ensureSignable('captureSignature')
			if (!signerValues[signerId]) {
				throw new Error(`Signer with ID "${signerId}" not found in registry`)
			}
			const capture: SignatureCapture = {
				role,
				partyId,
				signerId,
				locationId,
				type: 'signature',
				timestamp: options?.timestamp ?? new Date().toISOString(),
				...(options?.image && { image: options.image }),
				...(options?.method && { method: options.method }),
			}
			return createRuntimeForm({
				...config,
				captures: [...captures, capture],
			})
		},

		captureInitials(
			role: string,
			partyId: string,
			signerId: string,
			locationId: string,
			options?: CaptureOptions,
		): RuntimeForm<F> {
			ensureSignable('captureInitials')
			if (!signerValues[signerId]) {
				throw new Error(`Signer with ID "${signerId}" not found in registry`)
			}
			const capture: SignatureCapture = {
				role,
				partyId,
				signerId,
				locationId,
				type: 'initials',
				timestamp: options?.timestamp ?? new Date().toISOString(),
				...(options?.image && { image: options.image }),
				...(options?.method && { method: options.method }),
			}
			return createRuntimeForm({
				...config,
				captures: [...captures, capture],
			})
		},

		captureCapacity(
			role: string,
			partyId: string,
			signerId: string,
			locationId: string,
			text: string,
			options?: Omit<CaptureOptions, 'text'>,
		): RuntimeForm<F> {
			ensureSignable('captureCapacity')
			if (!signerValues[signerId]) {
				throw new Error(`Signer with ID "${signerId}" not found in registry`)
			}
			const capture: SignatureCapture = {
				role,
				partyId,
				signerId,
				locationId,
				type: 'capacity',
				text,
				timestamp: options?.timestamp ?? new Date().toISOString(),
				...(options?.method && { method: options.method }),
			}
			return createRuntimeForm({
				...config,
				captures: [...captures, capture],
			})
		},

		capturePrintedName(
			role: string,
			partyId: string,
			signerId: string,
			locationId: string,
			text: string,
			options?: Omit<CaptureOptions, 'text'>,
		): RuntimeForm<F> {
			ensureSignable('capturePrintedName')
			if (!signerValues[signerId]) {
				throw new Error(`Signer with ID "${signerId}" not found in registry`)
			}
			const capture: SignatureCapture = {
				role,
				partyId,
				signerId,
				locationId,
				type: 'printed_name',
				text,
				timestamp: options?.timestamp ?? new Date().toISOString(),
				...(options?.method && { method: options.method }),
			}
			return createRuntimeForm({
				...config,
				captures: [...captures, capture],
			})
		},

		getCapture(
			role: string,
			partyId: string,
			signerId: string,
			locationId: string,
			type: 'signature' | 'initials' | 'capacity' | 'printed_name',
		): SignatureCapture | undefined {
			return captures.find(
				(c) =>
					c.role === role && c.partyId === partyId && c.signerId === signerId && c.locationId === locationId && c.type === type,
			)
		},

		getCapturesForLocation(locationId: string): SignatureCapture[] {
			return captures.filter((c) => c.locationId === locationId)
		},

		getCapturesForParty(roleId: string, partyId: string): SignatureCapture[] {
			return captures.filter((c) => c.role === roleId && c.partyId === partyId)
		},

		getCapturesForSigner(signerId: string): SignatureCapture[] {
			return captures.filter((c) => c.signerId === signerId)
		},

		// ============================================================================
		// Witness Methods (signable only)
		// ============================================================================

		getWitness(witnessId: string): WitnessParty | undefined {
			return witnesses.find((w) => w.id === witnessId)
		},

		hasWitness(witnessId: string): boolean {
			return witnesses.some((w) => w.id === witnessId)
		},

		addWitness(witness: WitnessParty): RuntimeForm<F> {
			ensureSignable('addWitness')
			if (witnesses.some((w) => w.id === witness.id)) {
				throw new Error(`Witness with ID "${witness.id}" already exists`)
			}
			return createRuntimeForm({
				...config,
				witnesses: [...witnesses, witness],
			})
		},

		// ============================================================================
		// Attestation Methods (signable only)
		// ============================================================================

		getAttestationsByWitness(witnessId: string): Attestation[] {
			return attestations.filter((a) => a.witnessId === witnessId)
		},

		getAttestationsForParty<R extends PartyRoleKeys<F>>(roleId: R, partyId: string, signerId?: string): Attestation[] {
			validateRoleId(roleId)
			return attestations.filter((a) =>
				a.attestsTo.some(
					(t) => t.roleId === roleId && t.partyId === partyId && (signerId === undefined || t.signerId === signerId),
				),
			)
		},

		addAttestation(attestation: Attestation): RuntimeForm<F> {
			ensureSignable('addAttestation')
			if (attestation.witnessId && !witnesses.some((w) => w.id === attestation.witnessId)) {
				throw new Error(`Witness with ID "${attestation.witnessId}" not found`)
			}
			return createRuntimeForm({
				...config,
				attestations: [...attestations, attestation],
			})
		},

		// ============================================================================
		// Status Methods
		// ============================================================================

		getSignatureStatus<R extends PartyRoleKeys<F>>(roleId: R): {
			required: number
			collected: number
			complete: boolean
			parties: Array<{ partyId: string; hasSignatory: boolean; hasCapture: boolean; witnessed: boolean }>
		} {
			validateRoleId(roleId)
			const roleParties = getPartiesInternal(roleId)
			const roleSignatories = signatoryValues[roleId] ?? {}

			const formParty = formDef.parties?.[roleId]
			const signatureRequired = formParty?.signature?.required ?? false

			const partyStatuses = roleParties.map((party, index) => {
				const partyId = (party as { id?: string }).id ?? `${roleId}-${index}`
				const partySignatories = roleSignatories[partyId] ?? []
				const hasSignatory = partySignatories.length > 0
				const hasCapture = partySignatories.some((s) =>
					captures.some(
						(c) => c.role === roleId && c.partyId === partyId && c.signerId === s.signerId && c.type === 'signature',
					),
				)
				const witnessed = attestations.some((a) => a.attestsTo.some((t) => t.roleId === roleId && t.partyId === partyId))
				return { partyId, hasSignatory, hasCapture, witnessed }
			})

			const required = signatureRequired ? roleParties.length : 0
			const collected = partyStatuses.filter((p) => p.hasCapture).length

			return {
				required,
				collected,
				complete: collected >= required,
				parties: partyStatuses,
			}
		},

		getOverallSignatureStatus(): {
			roles: Record<string, { required: number; collected: number; complete: boolean }>
			complete: boolean
			totalRequired: number
			totalCollected: number
		} {
			const formParties = formDef.parties ?? {}

			const roles: Record<string, { required: number; collected: number; complete: boolean }> = {}
			let totalRequired = 0
			let totalCollected = 0

			for (const roleId of Object.keys(formParties)) {
				const status = runtime.getSignatureStatus(roleId as PartyRoleKeys<F>)
				roles[roleId] = {
					required: status.required,
					collected: status.collected,
					complete: status.complete,
				}
				totalRequired += status.required
				totalCollected += status.collected
			}

			return {
				roles,
				complete: totalCollected >= totalRequired,
				totalRequired,
				totalCollected,
			}
		},

		// ============================================================================
		// Runtime State (Logic Evaluation)
		// ============================================================================

		get runtimeState(): FormRuntimeState {
			return getRuntimeState()
		},

		getFieldState(fieldId: string): FieldRuntimeState | undefined {
			return getRuntimeState().fields.get(fieldId)
		},

		isFieldVisible(fieldId: string): boolean {
			return runtime.getFieldState(fieldId)?.visible ?? true
		},

		isFieldRequired(fieldId: string): boolean {
			return runtime.getFieldState(fieldId)?.required ?? false
		},

		getAnnexState(annexId: string): AnnexRuntimeState | undefined {
			return getRuntimeState().annexes.get(annexId)
		},

		getLogicValue(key: string): unknown {
			return getRuntimeState().defsValues.get(key)
		},

		validateRules(): FormRulesValidationResult {
			const state = getRuntimeState()
			// Build a simple context for rule evaluation
			// The buildFormContext creates nested fields.fieldId structure
			// We need to also pass the flat field values and defs values
			const context: import('@/logic').EvaluationContext = {
				fields: {},
			}
			// Build fields context for the evaluator
			for (const [fieldId, value] of Object.entries(fieldValues)) {
				context.fields[fieldId] = value
			}
			return evaluateFormRules(formDef, fieldValues, state.defsValues, context)
		},

		getVisibleFields(): FieldRuntimeState[] {
			const state = getRuntimeState()
			const result: FieldRuntimeState[] = []
			for (const [_fieldId, fieldState] of state.fields) {
				if (fieldState.visible) {
					result.push(fieldState)
				}
			}
			return result
		},

		getRequiredVisibleFields(): FieldRuntimeState[] {
			const state = getRuntimeState()
			const result: FieldRuntimeState[] = []
			for (const [_fieldId, fieldState] of state.fields) {
				if (fieldState.visible && fieldState.required) {
					result.push(fieldState)
				}
			}
			return result
		},

		isAnnexVisible(annexId: string): boolean {
			return runtime.getAnnexState(annexId)?.visible ?? true
		},

		isAnnexRequired(annexId: string): boolean {
			return runtime.getAnnexState(annexId)?.required ?? false
		},

		isFieldDisabled(fieldId: string): boolean {
			return runtime.getFieldState(fieldId)?.disabled ?? false
		},

		// ============================================================================
		// Validation
		// ============================================================================

		isValid(): boolean {
			return runtime.validate().valid
		},

		validate(): FormValidationResult {
			const rules = runtime.validateRules()
			return { valid: rules.valid, rules }
		},

		// ============================================================================
		// Layer Management
		// ============================================================================

		setTargetLayer<K extends keyof F['layers'] & string>(layer: K): RuntimeForm<F> {
			const layers = formDef.layers ?? {}
			if (!(layer in layers)) {
				throw new Error(`Layer "${layer}" not found in form. Available layers: ${Object.keys(layers).join(', ') || 'none'}`)
			}
			return createRuntimeForm({
				...config,
				targetLayer: layer,
			})
		},

		// ============================================================================
		// Phase Transitions
		// ============================================================================

		prepareForSigning(): RuntimeForm<F> {
			ensureDraft('prepareForSigning')
			return createRuntimeForm({
				...config,
				phase: 'signable',
				captures: [],
				witnesses: [],
				attestations: [],
				executedAt: undefined,
			})
		},

		async seal(adapter: Sealer): Promise<RuntimeForm<F>> {
			ensureDraft('seal')

			// Check if layer has pre-defined signatureBlocks
			const layerSpec = formDef.layers?.[targetLayer]
			const hasDefinedBlocks = layerSpec?.signatureBlocks &&
				Object.keys(layerSpec.signatureBlocks).length > 0

			if (hasDefinedBlocks) {
				// Definition mode: Build signatureMap from pre-defined blocks
				const signatureBlocks = layerSpec!.signatureBlocks!
				const signatureMap: SigningField[] = []
				let signerIndex = 0

				// Build a map of signerIds for each role/partyIndex combination
				const signerMap = new Map<string, string>() // key: "role:index" -> signerId

				for (const [roleId, roleSignatories] of Object.entries(signatoryValues)) {
					const parties = partyValues[roleId]
					const partyArray = Array.isArray(parties) ? parties : parties ? [parties] : []

					for (let i = 0; i < partyArray.length; i++) {
						const party = partyArray[i] as { id?: string }
						const partyId = party.id ?? `${roleId}-${i}`
						const partySignatories = roleSignatories[partyId] ?? []
						if (partySignatories.length > 0) {
							// Use the first signatory's signerId for this party
							signerMap.set(`${roleId}:${i}`, partySignatories[0]!.signerId)
						}
					}
				}

				// Convert each signature block to a SigningField
				for (const [locationId, block] of Object.entries(signatureBlocks)) {
					const partyRole = block.partyRole
					const partyIndex = block.partyIndex ?? 0

					// Skip blocks without a party role binding
					if (!partyRole) continue

					// Check if the party exists at this index
					const parties = partyValues[partyRole]
					const partyArray = Array.isArray(parties) ? parties : parties ? [parties] : []
					if (partyIndex >= partyArray.length) {
						// Party at this index doesn't exist, skip this block
						continue
					}

					// Get the signer for this party
					const signerId = signerMap.get(`${partyRole}:${partyIndex}`)
					if (!signerId) {
						// No signatory assigned to this party, skip
						continue
					}

					// Map SignatureBlockType to SigningFieldType
					const fieldType: SigningFieldType = block.type === 'date' ? 'date_signed' : block.type

					const signingField: SigningField = {
						id: locationId,
						signerIndex: signerIndex++,
						signerId,
						type: fieldType,
						page: block.page,
						x: block.x,
						y: block.y,
						width: block.width,
						height: block.height,
						...(block.required !== undefined && { required: block.required }),
						...(block.label && { label: block.label }),
					}

					signatureMap.push(signingField)
				}

				if (signatureMap.length === 0) {
					throw new Error(
						'Cannot seal: no signature blocks could be mapped to signatories. ' +
						'Ensure parties have signatories assigned.',
					)
				}

				// Call adapter to compute canonical PDF hash
				const request: SealingRequest<F> = {
					form: formDef,
					fields: fieldValues,
					parties: partyValues,
					signers: signerValues,
					signatories: signatoryValues,
					targetLayer,
				}

				const result = await adapter.seal(request)

				return createRuntimeForm({
					...config,
					phase: 'signable',
					captures: [],
					witnesses: [],
					attestations: [],
					signatureMap,
					canonicalPdfHash: result.canonicalPdfHash,
					executedAt: undefined,
				})
			}

			// Extraction mode: Use adapter to extract from placeholders
			// Validation 1: Check layer is PDF-convertible
			if (!PDF_CONVERTIBLE_LAYERS.includes(targetLayer as (typeof PDF_CONVERTIBLE_LAYERS)[number])) {
				throw new Error(
					`Cannot seal: layer "${targetLayer}" has no signatureBlocks and is not PDF-convertible. ` +
					`Either add signatureBlocks to the layer or use a supported layer: ${PDF_CONVERTIBLE_LAYERS.join(', ')}`,
				)
			}

			// Validation 2: Check parties exist
			if (Object.keys(partyValues).length === 0) {
				throw new Error('Cannot seal: form has no parties')
			}

			// Validation 3: Check at least one required signature exists
			const formParties = formDef.parties ?? {}
			const hasRequiredSignature = Object.entries(formParties).some(([roleId, partyDef]) => {
				if (!partyDef.signature?.required) return false
				const roleSignatories = signatoryValues[roleId] ?? {}
				return Object.values(roleSignatories).some((signatories) => signatories.length > 0)
			})

			if (!hasRequiredSignature) {
				throw new Error(
					'Cannot seal: no party has a required signature. Ensure parties are assigned and have signatories configured.',
				)
			}

			const request: SealingRequest<F> = {
				form: formDef,
				fields: fieldValues,
				parties: partyValues,
				signers: signerValues,
				signatories: signatoryValues,
				targetLayer,
			}

			const result = await adapter.seal(request)

			return createRuntimeForm({
				...config,
				phase: 'signable',
				captures: [],
				witnesses: [],
				attestations: [],
				signatureMap: result.signatureMap,
				canonicalPdfHash: result.canonicalPdfHash,
				executedAt: undefined,
			})
		},

		finalize(): RuntimeForm<F> {
			ensureSignable('finalize')
			return createRuntimeForm({
				...config,
				phase: 'executed',
				executedAt: new Date().toISOString(),
			})
		},

		// ============================================================================
		// Formal Signing Helpers
		// ============================================================================

		get isFormal(): boolean {
			return signatureMap !== undefined && canonicalPdfHash !== undefined
		},

		getSignerForField(fieldId: string): Signer | undefined {
			if (!signatureMap) return undefined
			const field = signatureMap.find((f) => f.id === fieldId)
			if (!field) return undefined
			return signerValues[field.signerId]
		},

		getFieldsForSigner(signerId: string): SigningField[] {
			if (!signatureMap) return []
			return signatureMap.filter((f) => f.signerId === signerId)
		},

		// ============================================================================
		// Rendering
		// ============================================================================

		async render<Output>(options: RuntimeFormRenderOptions<Output>): Promise<Output> {
			const { renderer, resolver, layer: layerKey, bindings: optionsBindings } = options

			if (!formDef.layers) {
				throw new Error('Form has no layers defined')
			}

			const key = layerKey || targetLayer || formDef.defaultLayer || Object.keys(formDef.layers)[0]
			if (!key) {
				throw new Error('No layer key provided and no defaultLayer set.')
			}

			const layerSpec = formDef.layers[key]
			if (!layerSpec) {
				throw new Error(`Layer "${key}" not found. Available layers: ${Object.keys(formDef.layers).join(', ')}`)
			}

			// Determine content based on layer spec type
			let layerContent: string | Uint8Array | Buffer
			let bindings: Record<string, string> | undefined

			if (layerSpec.kind === 'inline') {
				layerContent = layerSpec.text
				bindings = layerSpec.bindings
			} else if (layerSpec.kind === 'file') {
				if (resolver) {
					const bytes = await resolver.read(layerSpec.path)
					if (layerSpec.mimeType.startsWith('text/') || layerSpec.mimeType === 'application/json') {
						layerContent = new TextDecoder().decode(bytes)
					} else {
						layerContent = bytes
					}
				} else {
					throw new Error(`Layer "${key}" is file-backed but no resolver was provided.`)
				}
				bindings = layerSpec.bindings
			} else {
				throw new Error('Unknown layer spec kind')
			}

			// Resolve bindingsFrom reference if no direct bindings
			if (!bindings && layerSpec.bindingsFrom) {
				const refLayer = formDef.layers[layerSpec.bindingsFrom]
				if (!refLayer) {
					throw new Error(`bindingsFrom "${layerSpec.bindingsFrom}" references unknown layer. Available: ${Object.keys(formDef.layers).join(', ')}`)
				}
				bindings = refLayer.bindings
			}

			// Merge caller-provided bindings (override layer-spec bindings)
			if (optionsBindings) {
				bindings = { ...bindings, ...optionsBindings }
			}

			const augmentedParties = augmentPartiesForRender()

			// Build defs values object
			const defsValuesObj: Record<string, unknown> = {}
			for (const [k, v] of getRuntimeState().defsValues) {
				defsValuesObj[k] = v
			}

			const fullData = {
				schema: {
					name: formDef.name,
					version: formDef.version,
					title: formDef.title,
					description: formDef.description,
					code: formDef.code,
					releaseDate: formDef.releaseDate,
					metadata: formDef.metadata,
				},
				...fieldValues,
				...(Object.keys(augmentedParties).length > 0 && { parties: augmentedParties }),
				...(Object.keys(annexValues).length > 0 && { annexes: annexValues }),
				...(Object.keys(signerValues).length > 0 && { _signers: signerValues }),
				...(captures.length > 0 && { _captures: captures }),
				...(Object.keys(defsValuesObj).length > 0 && { defs: defsValuesObj }),
				...(executedAt && { _executedAt: executedAt }),
			}

			const template: RendererLayer = {
				type: 'text',
				content: layerContent,
				mimeType: layerSpec.mimeType,
				...(bindings && { bindings }),
			}

			return await renderer.render({
				template,
				form: formDef,
				data: { fields: fullData },
				bindings,
			})
		},

		// ============================================================================
		// Serialization
		// ============================================================================

		toJSON(): RuntimeFormJSON<F> {
			if (phase === 'draft') {
				return {
					phase: 'draft',
					form: formDef,
					fields: fieldValues,
					parties: partyValues,
					annexes: annexValues,
					signers: signerValues,
					signatories: signatoryValues,
					targetLayer,
				}
			}
			if (phase === 'signable') {
				return {
					phase: 'signable',
					form: formDef,
					fields: fieldValues,
					parties: partyValues,
					annexes: annexValues,
					signers: signerValues,
					signatories: signatoryValues,
					captures,
					witnesses,
					attestations,
					targetLayer,
					...(signatureMap && { signatureMap }),
					...(canonicalPdfHash && { canonicalPdfHash }),
				}
			}
			return {
				phase: 'executed',
				form: formDef,
				fields: fieldValues,
				parties: partyValues,
				annexes: annexValues,
				signers: signerValues,
				signatories: signatoryValues,
				captures,
				witnesses,
				attestations,
				targetLayer,
				executedAt: executedAt!,
			}
		},

		toYAML(): string {
			return toYAML(runtime.toJSON())
		},

		clone(): RuntimeForm<F> {
			return createRuntimeForm(structuredClone(config))
		},
	}

	// Cast to RuntimeForm<F> - the overloads will narrow this appropriately for consumers
	return runtime as unknown as RuntimeForm<F>
}

/**
 * Load a RuntimeForm from JSON
 */
export function runtimeFormFromJSON<F extends Form>(json: RuntimeFormJSON<F>): RuntimeForm<F> {
	// Type assertion needed because TypeScript can't narrow the config type based on json.phase alone
	// The RuntimeFormJSON union already constrains the valid combinations
	const config = {
		form: json.form,
		fields: json.fields,
		parties: json.parties,
		annexes: json.annexes,
		signers: json.signers,
		signatories: json.signatories,
		targetLayer: json.targetLayer,
		phase: json.phase,
		captures: 'captures' in json ? json.captures : [],
		witnesses: 'witnesses' in json ? json.witnesses : [],
		attestations: 'attestations' in json ? json.attestations : [],
		executedAt: 'executedAt' in json ? json.executedAt : undefined,
		signatureMap: 'signatureMap' in json ? json.signatureMap : undefined,
		canonicalPdfHash: 'canonicalPdfHash' in json ? json.canonicalPdfHash : undefined,
	} as RuntimeFormConfig<F>
	return createRuntimeForm(config)
}

// ============================================================================
// FormInstance Factory
// ============================================================================

/**
 * Creates a FormInstance object (replaces FormInstance class)
 */
function createFormInstance<F extends Form>(formDef: F): FormInstance<F> {
	const artifactMethods = withArtifactMethods(formDef)

	const instance: FormInstance<F> = {
		...artifactMethods,

		// Form-specific properties (type assertions needed for conditional types)
		defs: formDef.defs as FormInstance<F>['defs'],
		fields: formDef.fields as FormInstance<F>['fields'],
		layers: formDef.layers as FormInstance<F>['layers'],
		defaultLayer: formDef.defaultLayer as FormInstance<F>['defaultLayer'],
		annexes: formDef.annexes as FormInstance<F>['annexes'],
		allowAdditionalAnnexes: formDef.allowAdditionalAnnexes as FormInstance<F>['allowAdditionalAnnexes'],
		parties: formDef.parties as FormInstance<F>['parties'],

		parseData(data: Record<string, unknown>): InferFormPayload<F> {
			const result = instance.safeParseData(data)
			if (!result.success) {
				throw new FormValidationError(result.errors)
			}
			return result.data
		},

			safeParseData(data: Record<string, unknown>): ValidationResult<InferFormPayload<F>> {
				return validateFormData(formDef, data) as ValidationResult<InferFormPayload<F>>
			},

			validateFieldInput(input: FieldInputValidationInput): ProgressiveValidationResult<unknown> {
				return validateProgressiveFieldInput(formDef, input)
			},

			validateFieldsPatch(fields: unknown): ProgressiveValidationResult<Record<string, unknown>> {
				return validateProgressiveFieldsPatch(formDef, fields)
			},

			validatePartyInput(input: PartyInputValidationInput): ProgressiveValidationResult<NormalizedPartyInput> {
				return validateProgressivePartyInput(formDef, input)
			},

			validatePartiesPatch(parties: unknown): ProgressiveValidationResult<Record<string, RuntimeParty | RuntimeParty[]>> {
				return validateProgressivePartiesPatch(formDef, parties)
			},

			validateAnnexInput(input: AnnexInputValidationInput): ProgressiveValidationResult<unknown> {
				return validateProgressiveAnnexInput(formDef, input)
			},

			validateAnnexesPatch(annexes: unknown): ProgressiveValidationResult<Record<string, unknown>> {
				return validateProgressiveAnnexesPatch(formDef, annexes)
			},

			fill(data: InferFormPayload<F>, options?: FillValidationOptions): DraftForm<F> {
			const checkRules = options?.rules !== false

			// Normalize data
			const fields = data.fields ?? {}
			const parties = data.parties ?? {}
			const annexes = data.annexes ?? {}
			const signers = data.signers ?? {}
			const signatories = data.signatories ?? {}

			// Validate field data
			const fieldData = { fields, ...(Object.keys(annexes).length > 0 ? { annexes } : {}) }
			const result = validateFormData(formDef, fieldData)
			if (!result.success) {
				throw new FormValidationError(result.errors)
			}

			// Validate party data format (object vs array based on max)
			const formParties = formDef.parties ?? {}
			for (const [roleId, formParty] of Object.entries(formParties)) {
				const partyData = parties[roleId as keyof typeof parties]
				const partyResult = validatePartiesForRole(partyData, formParty, roleId)
				if (!partyResult.success) {
					throw new FormValidationError(
						partyResult.errors.map((msg) => ({ field: `parties.${roleId}`, message: msg }))
					)
				}
			}

			const targetLayer = formDef.defaultLayer || (formDef.layers ? Object.keys(formDef.layers)[0] : '') || ''

			const draft = createRuntimeForm({
				form: formDef,
				fields: (result.data as { fields: Record<string, unknown> }).fields,
				parties,
				annexes,
				signers,
				signatories,
				targetLayer,
				phase: 'draft',
			})

			if (checkRules) {
				const ruleResult = draft.validateRules()
				if (!ruleResult.valid) {
					throw new FormRuleViolationError(ruleResult)
				}
			}

			return draft
		},

		safeFill(data: InferFormPayload<F>, options?: FillValidationOptions): SafeFillResult<F> {
			const checkRules = options?.rules !== false

			// Try to create the draft
			let draft: DraftForm<F>
			try {
				draft = instance.fill(data, { rules: false })
			} catch (err) {
				return { success: false, error: err as Error }
			}

			// If rules checking is disabled, return success
			if (!checkRules) {
				const rules = { valid: true, rules: [], errors: [], warnings: [] } as FormRulesValidationResult
				return { success: true, data: draft, rules }
			}

			// Validate rules
			const ruleResult = draft.validateRules()
			if (!ruleResult.valid) {
				return { success: false, error: new FormRuleViolationError(ruleResult), data: draft, rules: ruleResult }
			}

			return { success: true, data: draft, rules: ruleResult }
		},

		partialFill(seed?: Partial<InferFormPayload<F>>, options?: PartialFillOptions): DraftForm<F> {
			const validate = options?.validate ?? 'patch'
			const checkRules = options?.rules === true

			const fields = (seed as Record<string, unknown> | undefined)?.fields ?? {}
			const parties = (seed as Record<string, unknown> | undefined)?.parties ?? {}
			const annexes = (seed as Record<string, unknown> | undefined)?.annexes ?? {}
			const signers = (seed as Record<string, unknown> | undefined)?.signers ?? {}
			const signatories = (seed as Record<string, unknown> | undefined)?.signatories ?? {}

			// Validate based on mode
			if (validate === 'patch') {
				if (Object.keys(fields as Record<string, unknown>).length > 0) {
					const fieldResult = validateProgressiveFieldsPatch(formDef, fields)
					if (!fieldResult.success) {
						throw new FormValidationError(fieldResult.errors)
					}
				}
				if (Object.keys(parties as Record<string, unknown>).length > 0) {
					const partyResult = validateProgressivePartiesPatch(formDef, parties)
					if (!partyResult.success) {
						throw new FormValidationError(partyResult.errors)
					}
				}
				if (Object.keys(annexes as Record<string, unknown>).length > 0) {
					const annexResult = validateProgressiveAnnexesPatch(formDef, annexes)
					if (!annexResult.success) {
						throw new FormValidationError(annexResult.errors)
					}
				}
			} else if (validate === 'full') {
				const fieldData = { fields, ...(Object.keys(annexes as Record<string, unknown>).length > 0 ? { annexes } : {}) }
				const result = validateFormData(formDef, fieldData)
				if (!result.success) {
					throw new FormValidationError(result.errors)
				}
			}
			// validate === 'none' → skip

			const targetLayer = formDef.defaultLayer || (formDef.layers ? Object.keys(formDef.layers)[0] : '') || ''

			const draft = createRuntimeForm({
				form: formDef,
				fields: fields as Record<string, unknown>,
				parties: parties as Record<string, Party | Party[]>,
				annexes: annexes as Record<string, unknown>,
				signers: signers as Record<string, Signer>,
				signatories: signatories as Record<string, Record<string, PartySignatory[]>>,
				targetLayer,
				phase: 'draft',
			})

			if (checkRules) {
				const ruleResult = draft.validateRules()
				if (!ruleResult.valid) {
					throw new FormRuleViolationError(ruleResult)
				}
			}

			return draft
		},

		safePartialFill(seed?: Partial<InferFormPayload<F>>, options?: PartialFillOptions): SafePartialFillResult<F> {
			try {
				const draft = instance.partialFill(seed, { ...options, rules: false })

				if (options?.rules === true) {
					const ruleResult = draft.validateRules()
					if (!ruleResult.valid) {
						return { success: false, error: new FormRuleViolationError(ruleResult) }
					}
				}

				return { success: true, data: draft }
			} catch (err) {
				return { success: false, error: err as Error }
			}
		},

		async render<Output>(options: RenderOptions<Output>): Promise<Output> {
			const { renderer, resolver, data = {}, layer: layerKey, bindings: optionsBindings } = options

			if (!formDef.layers) {
				throw new Error('Form has no layers defined')
			}

			const key = layerKey || formDef.defaultLayer || Object.keys(formDef.layers)[0]
			if (!key) {
				throw new Error('No layer key provided and no defaultLayer set.')
			}

			const layerSpec = formDef.layers[key]
			if (!layerSpec) {
				throw new Error(`Layer "${key}" not found. Available layers: ${Object.keys(formDef.layers).join(', ')}`)
			}

			let layerContent: string | Uint8Array | Buffer
			let bindings: Record<string, string> | undefined

			if (layerSpec.kind === 'inline') {
				layerContent = layerSpec.text
				bindings = layerSpec.bindings
			} else if (layerSpec.kind === 'file') {
				if (resolver) {
					const bytes = await resolver.read(layerSpec.path)
					if (layerSpec.mimeType.startsWith('text/') || layerSpec.mimeType === 'application/json') {
						layerContent = new TextDecoder().decode(bytes)
					} else {
						layerContent = bytes
					}
				} else {
					throw new Error(`Layer "${key}" is file-backed but no resolver was provided.`)
				}
				bindings = layerSpec.bindings
			} else {
				throw new Error('Unknown layer spec kind')
			}

			// Resolve bindingsFrom reference if no direct bindings
			if (!bindings && layerSpec.bindingsFrom) {
				const refLayer = formDef.layers[layerSpec.bindingsFrom]
				if (!refLayer) {
					throw new Error(`bindingsFrom "${layerSpec.bindingsFrom}" references unknown layer. Available: ${Object.keys(formDef.layers).join(', ')}`)
				}
				bindings = refLayer.bindings
			}

			// Merge caller-provided bindings (override layer-spec bindings)
			if (optionsBindings) {
				bindings = { ...bindings, ...optionsBindings }
			}

			const template: RendererLayer = {
				type: 'text',
				content: layerContent,
				mimeType: layerSpec.mimeType,
				...(bindings && { bindings }),
			}

			// Build FormData payload
			let formData: { fields: Record<string, unknown> }
			if (data && typeof data === 'object' && 'fields' in data && typeof (data as { fields?: unknown }).fields === 'object') {
				formData = data as { fields: Record<string, unknown> }
			} else {
				formData = { fields: (data ?? {}) as Record<string, unknown> }
			}

			return await renderer.render({
				template,
				form: formDef,
				data: formData,
				bindings,
			})
		},

		clone(): FormInstance<F> {
			return createFormInstance(structuredClone(formDef))
		},
	}

	return instance
}

// ============================================================================
// FormBuilder
// ============================================================================

export interface FormBuilderInterface<
	TFields extends Record<string, FormField> = Record<string, never>,
	TParties extends Record<string, FormParty> = Record<string, never>,
	TAnnexes extends Record<string, FormAnnex> = Record<string, never>,
> {
	from(formValue: Form): FormBuilderInterface<TFields, TParties, TAnnexes>
	name(value: string): FormBuilderInterface<TFields, TParties, TAnnexes>
	version(value?: string): FormBuilderInterface<TFields, TParties, TAnnexes>
	title(value?: string): FormBuilderInterface<TFields, TParties, TAnnexes>
	description(value: string): FormBuilderInterface<TFields, TParties, TAnnexes>
	code(value: string): FormBuilderInterface<TFields, TParties, TAnnexes>
	language(value: string): FormBuilderInterface<TFields, TParties, TAnnexes>
	releaseDate(value: string): FormBuilderInterface<TFields, TParties, TAnnexes>
	metadata(value: Metadata): FormBuilderInterface<TFields, TParties, TAnnexes>
	instructions(value: ContentRef): FormBuilderInterface<TFields, TParties, TAnnexes>
	agentInstructions(value: ContentRef): FormBuilderInterface<TFields, TParties, TAnnexes>
	defs(defsDef: DefsSection): FormBuilderInterface<TFields, TParties, TAnnexes>
	def(name: string, expression: string | Expression): FormBuilderInterface<TFields, TParties, TAnnexes>
	field(id: string, fieldDef: Buildable<FormField>): FormBuilderInterface<TFields, TParties, TAnnexes>
	fields<const F extends Record<string, Buildable<FormField>>>(
		fieldsObj: F,
	): FormBuilderInterface<
		{
			[K in keyof F]: F[K] extends { build(): infer T extends FormField } ? T : F[K] extends FormField ? F[K] : FormField
		},
		TParties,
		TAnnexes
	>
	layers(value: Record<string, Layer | FileLayerBuilderType | InlineLayerBuilderType>): FormBuilderInterface<TFields, TParties, TAnnexes>
	layer(key: string, layerDef: Layer | FileLayerBuilderType | InlineLayerBuilderType): FormBuilderInterface<TFields, TParties, TAnnexes>
	inlineLayer(
		key: string,
		layer: {
			mimeType: string
			text: string
			title?: string
			description?: string
			bindings?: Record<string, string>
		},
	): FormBuilderInterface<TFields, TParties, TAnnexes>
	fileLayer(
		key: string,
		layer: {
			mimeType: string
			path: string
			title?: string
			description?: string
			checksum?: string
			bindings?: Record<string, string>
		},
	): FormBuilderInterface<TFields, TParties, TAnnexes>
	defaultLayer(key: string): FormBuilderInterface<TFields, TParties, TAnnexes>
	annex(annexId: string, annexDef: Buildable<FormAnnex>): FormBuilderInterface<TFields, TParties, TAnnexes>
	annexes<const A extends Record<string, Buildable<FormAnnex>>>(
		annexesRecord: A,
	): FormBuilderInterface<
		TFields,
		TParties,
		{
			[K in keyof A]: A[K] extends Buildable<infer T extends FormAnnex> ? T : A[K] extends FormAnnex ? A[K] : FormAnnex
		}
	>
	allowAdditionalAnnexes(value: boolean): FormBuilderInterface<TFields, TParties, TAnnexes>
	party(roleId: string, partyDef: Buildable<FormParty>): FormBuilderInterface<TFields, TParties, TAnnexes>
	parties<const P extends Record<string, Buildable<FormParty>>>(
		partiesObj: P,
	): FormBuilderInterface<
		TFields,
		{
			[K in keyof P]: P[K] extends Buildable<infer T extends FormParty> ? T : P[K] extends FormParty ? P[K] : FormParty
		},
		TAnnexes
	>
	build(): FormInstance<
		Omit<Form, 'fields' | 'parties' | 'annexes'> & {
			fields: TFields
			parties: TParties extends Record<string, never> ? undefined : TParties
			annexes: TAnnexes extends Record<string, never> ? undefined : TAnnexes
		}
	>
}

/**
 * Creates a FormBuilder (closure-based)
 */
function createFormBuilder<
	TFields extends Record<string, FormField> = Record<string, never>,
	TParties extends Record<string, FormParty> = Record<string, never>,
	TAnnexes extends Record<string, FormAnnex> = Record<string, never>,
>(): FormBuilderInterface<TFields, TParties, TAnnexes> {
	const _def: Record<string, unknown> = {
		kind: 'form',
		name: '',
		version: undefined,
		title: undefined,
		description: undefined,
		code: undefined,
		language: undefined,
		releaseDate: undefined,
		metadata: {},
		instructions: undefined,
		agentInstructions: undefined,
		defs: undefined,
		fields: undefined,
		layers: undefined,
		defaultLayer: undefined,
		annexes: undefined,
		allowAdditionalAnnexes: undefined,
		parties: undefined,
	}

	const builder: FormBuilderInterface<TFields, TParties, TAnnexes> = {
		from(formValue: Form) {
			const parsed = parseForm(formValue)
			_def.kind = 'form'
			_def.name = parsed.name
			_def.version = parsed.version
			_def.title = parsed.title
			_def.description = parsed.description
			_def.code = parsed.code
			_def.language = parsed.language
			_def.releaseDate = parsed.releaseDate
			_def.metadata = parsed.metadata ? { ...parsed.metadata } : {}
			_def.instructions = parsed.instructions
			_def.agentInstructions = parsed.agentInstructions
			_def.defs = parsed.defs ? { ...parsed.defs } : undefined
			_def.fields = parsed.fields
				? Object.fromEntries(Object.entries(parsed.fields).map(([id, field]) => [id, parseFormField(field)]))
				: undefined
			_def.layers = parsed.layers
				? Object.fromEntries(Object.entries(parsed.layers).map(([key, layer]) => [key, parseLayer(layer)]))
				: undefined
			_def.defaultLayer = parsed.defaultLayer
			_def.annexes = parsed.annexes
				? Object.fromEntries(Object.entries(parsed.annexes).map(([key, annexItem]) => [key, parseFormAnnex(annexItem)]))
				: undefined
			_def.allowAdditionalAnnexes = parsed.allowAdditionalAnnexes
			_def.parties = parsed.parties
				? Object.fromEntries(Object.entries(parsed.parties).map(([roleId, p]) => [roleId, parseFormParty(p)]))
				: undefined
			return builder
		},

		name(value: string) {
			_def.name = value
			return builder
		},

		version(value?: string) {
			_def.version = value
			return builder
		},

		title(value?: string) {
			_def.title = value
			return builder
		},

		description(value: string) {
			_def.description = value
			return builder
		},

		code(value: string) {
			_def.code = value
			return builder
		},

		language(value: string) {
			_def.language = value
			return builder
		},

		releaseDate(value: string) {
			_def.releaseDate = value
			return builder
		},

		metadata(value: Metadata) {
			_def.metadata = value
			return builder
		},

		instructions(value: ContentRef) {
			_def.instructions = value
			return builder
		},

		agentInstructions(value: ContentRef) {
			_def.agentInstructions = value
			return builder
		},

		defs(defsDef: DefsSection) {
			_def.defs = defsDef
			return builder
		},

		def(name: string, expression: string | Expression) {
			const defs = (_def.defs as DefsSection) || {}
			if (typeof expression === 'string') {
				defs[name] = { type: 'boolean', value: expression }
			} else {
				defs[name] = expression
			}
			_def.defs = defs
			return builder
		},

		field(id: string, fieldDef: Buildable<FormField>) {
			const fields = (_def.fields as Record<string, FormField>) || {}
			fields[id] = parseFormField(resolveBuildable(fieldDef))
			_def.fields = fields
			return builder
		},

		fields<const F extends Record<string, Buildable<FormField>>>(fieldsObj: F) {
			const parsed: Record<string, FormField> = {}
			for (const [id, fieldDef] of Object.entries(fieldsObj)) {
				parsed[id] = parseFormField(resolveBuildable(fieldDef as Buildable<FormField>))
			}
			_def.fields = parsed
			return builder as unknown as FormBuilderInterface<
				{
					[K in keyof F]: F[K] extends { build(): infer T extends FormField } ? T : F[K] extends FormField ? F[K] : FormField
				},
				TParties,
				TAnnexes
			>
		},

		layers(value: Record<string, Layer | FileLayerBuilderType | InlineLayerBuilderType>) {
			const parsed: Record<string, Layer> = {}
			for (const [key, layerValue] of Object.entries(value)) {
				const resolved = layerBuilder.isBuilder(layerValue) ? layerBuilder.resolve(layerValue) : layerValue
				parsed[key] = parseLayer(resolved)
			}
			_def.layers = parsed
			return builder
		},

		layer(key: string, layerDef: Layer | FileLayerBuilderType | InlineLayerBuilderType) {
			const layers = (_def.layers as Record<string, Layer>) || {}
			const resolved = layerBuilder.isBuilder(layerDef) ? layerBuilder.resolve(layerDef) : layerDef
			layers[key] = parseLayer(resolved)
			_def.layers = layers
			return builder
		},

		inlineLayer(
			key: string,
			layer: {
				mimeType: string
				text: string
				title?: string
				description?: string
				bindings?: Record<string, string>
			},
		) {
			return builder.layer(key, { kind: 'inline', ...layer })
		},

		fileLayer(
			key: string,
			layer: {
				mimeType: string
				path: string
				title?: string
				description?: string
				checksum?: string
				bindings?: Record<string, string>
			},
		) {
			return builder.layer(key, { kind: 'file', ...layer })
		},

		defaultLayer(key: string) {
			_def.defaultLayer = key
			return builder
		},

		annex(annexId: string, annexDef: Buildable<FormAnnex>) {
			const annexes = (_def.annexes as Record<string, FormAnnex>) || {}
			annexes[annexId] = parseFormAnnex(resolveBuildable(annexDef))
			_def.annexes = annexes
			return builder
		},

		annexes<const A extends Record<string, Buildable<FormAnnex>>>(annexesRecord: A) {
			const parsed: Record<string, FormAnnex> = {}
			for (const [key, annexDef] of Object.entries(annexesRecord)) {
				parsed[key] = parseFormAnnex(resolveBuildable(annexDef))
			}
			_def.annexes = parsed
			return builder as unknown as FormBuilderInterface<
				TFields,
				TParties,
				{
					[K in keyof A]: A[K] extends Buildable<infer T extends FormAnnex> ? T : A[K] extends FormAnnex ? A[K] : FormAnnex
				}
			>
		},

		allowAdditionalAnnexes(value: boolean) {
			_def.allowAdditionalAnnexes = value
			return builder
		},

		party(roleId: string, partyDef: Buildable<FormParty>) {
			const parties = (_def.parties as Record<string, FormParty>) || {}
			parties[roleId] = parseFormParty(resolveBuildable(partyDef))
			_def.parties = parties
			return builder
		},

		parties<const P extends Record<string, Buildable<FormParty>>>(partiesObj: P) {
			const parsed: Record<string, FormParty> = {}
			for (const [roleId, partyDef] of Object.entries(partiesObj)) {
				parsed[roleId] = parseFormParty(resolveBuildable(partyDef))
			}
			_def.parties = parsed
			return builder as unknown as FormBuilderInterface<
				TFields,
				{
					[K in keyof P]: P[K] extends Buildable<infer T extends FormParty> ? T : P[K] extends FormParty ? P[K] : FormParty
				},
				TAnnexes
			>
		},

		build() {
			const cleaned: Record<string, unknown> = { ...(_def as object) }
			for (const key of Object.keys(cleaned)) {
				if (cleaned[key] === undefined) {
					delete cleaned[key]
				}
			}
			const result = parseForm(cleaned)
			return createFormInstance(
				result as Omit<Form, 'fields' | 'parties' | 'annexes'> & {
					fields: TFields
					parties: TParties extends Record<string, never> ? undefined : TParties
					annexes: TAnnexes extends Record<string, never> ? undefined : TAnnexes
				},
			)
		},
	}

	return builder
}

// ============================================================================
// Form API
// ============================================================================

type FormAPI = {
	(): FormBuilderInterface
	<const T extends FormInput>(input: T): FormInstance<T & { kind: 'form' }>
	from(input: unknown): FormInstance<Form>
	safeFrom(input: unknown): { success: true; data: FormInstance<Form> } | { success: false; error: Error }
}

function formImpl(): FormBuilderInterface
function formImpl<const T extends FormInput>(input: T): FormInstance<T & { kind: 'form' }>
function formImpl<const T extends FormInput>(input?: T): FormBuilderInterface | FormInstance<T & { kind: 'form' }> {
	if (input !== undefined) {
		const withKind = { ...input, kind: 'form' as const }
		const parsed = parseForm(withKind) as T & { kind: 'form' }
		return createFormInstance(parsed)
	}
	return createFormBuilder()
}

export const form: FormAPI = Object.assign(formImpl, {
	from: (input: unknown): FormInstance<Form> => {
		const parsed = parseForm(input) as Form
		return createFormInstance(parsed)
	},
	safeFrom: (input: unknown): { success: true; data: FormInstance<Form> } | { success: false; error: Error } => {
		try {
			const parsed = parseForm(input) as Form
			return { success: true, data: createFormInstance(parsed) }
		} catch (err) {
			return { success: false, error: err as Error }
		}
	},
})
