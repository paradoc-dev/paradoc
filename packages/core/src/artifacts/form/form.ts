/**
 * Form Artifact - Closure-based implementation
 *
 * This replaces the class-based FormInstance, DraftForm, SignableForm, and ExecutedForm
 * with a single file using closures and composition.
 */

import type {
	Form,
	FormField,
	FieldsetField,
	ListField,
	FormAnnex,
	FormParty,
	Layer,
	SignatureBlock,
	AnchorBlock,
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
	SealAdapter,
	SealLocator,
	SealingRequest,
	SignatureSlot,
	DefsSection,
	Expression,
	ContentRef,
	Resolver,
	ParadocRenderer,
} from '@paradoc/types'
import { renderLayer as createRenderer } from '@paradoc/render'
import { FieldType, flattenPdf, locate as locatePlacements, pageTextRuns } from '@paradoc/render/pdf'
import { encode as encodeMarker } from '@paradoc/render/pdf'
import type { TextSignatureOptions } from '@paradoc/render/text'
import { SealConfigError, buildSlotPlan, compileLegacySignatureSlots, hasSignatureSlots } from './seal-slots'
import type { PlacementProvenance, SealPreparation } from './seal-slots'
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
import { evaluatePartyRequiredness } from '@/validation/party'
import { toYAML } from '@/serialization/serialization'
import { deepClone, deepReadonlyClone } from '@/utils/clone'
import {
	assertValidArtifactDefinition,
	snapshotArtifactDefinition,
	withArtifactMethods,
	type ArtifactMethods,
} from '../shared/artifact-methods'
import { layer as layerBuilder, type FileLayerBuilderType, type InlineLayerBuilderType } from '@/artifacts/builders/layer'
import { type Buildable, resolveBuildable } from '@/artifacts/shared/buildable'
import type {
	DeepPartial,
	FieldsToDataType,
	InferFormPayload as InferredFormPayload,
	ProgressiveFormPayload as InferredProgressiveFormPayload,
} from '@/inference'
import type { FormRuntimeState, FieldRuntimeState, AnnexRuntimeState, FormRulesValidationResult } from '@/logic'
import { buildFormContext, evaluateFormDefs, evaluateFormRules } from '@/logic'
import type { RuntimeFormRenderOptions, RenderOptions, RendererLayer } from '@/types'
import { buildRendererLayer, selectLayerRenderer } from '../shared/render-layer'
import type { ArtifactInstanceOptions } from '../shared/render-layer'
import type { RendererRegistry } from '@/rendering/renderer-registry'
import {
	createSealPass,
	locateFlowMarkers,
	selectSealRenderer,
	signingMarkersFor,
	type SealRenderer,
} from './seal-renderer'
import type {
	PartialFillOptions,
	UpdateOptions,
	FillTargetOptions,
	FillTarget,
	FillState,
} from '@/fill-state/types'
import { computeFillState, getAvailableFillTargets, getNextFillTarget } from '@/fill-state/engine'

// ============================================================================
// Type Inference for Form Payloads
// ============================================================================

/**
 * Helper to extract the form schema from either a raw Form or FormInstance.
 * FormInstance exposes its form definition through the shared _data property.
 */
type ExtractFormSchema<T> = T extends { _data: infer S }
	? S
	: T extends { _schema: infer S }
		? S
		: T

type AddFormDefinition<
	Existing extends Record<string, unknown>,
	K extends string,
	Definition,
	DynamicDefinition,
> = string extends K
	? Existing extends Record<string, never>
		? Record<string, DynamicDefinition>
		: Existing & Record<string, DynamicDefinition>
	: Existing extends Record<string, never>
		? { [P in K]: Definition }
		: Existing & { [P in K]: Definition }

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

export interface SealOptions {
	/**
	 * Adapter required when the target layer is not already a PDF.
	 *
	 * Not required for a layer whose registered renderer produces the PDF
	 * itself. A React composition is that case: its renderer writes PDF bytes,
	 * so there is nothing left to convert.
	 */
	adapter?: SealAdapter
	/**
	 * Resolves anchor-block positions against the converted PDF when the
	 * adapter returns no signature map. Lets pure byte converters (such as the
	 * hosted converter) seal anchor-based layers.
	 */
	locate?: SealLocator
	/**
	 * Custom renderer override for the layer being sealed.
	 *
	 * Honoured on every pass except a flow one: flow placement is core writing
	 * an invisible marker into the text it renders, and an override is opaque to
	 * that, so `prepareSeal` and `seal` refuse the combination rather than
	 * dropping the markers. See `renderers` for the whole order.
	 */
	renderer?: ParadocRenderer<RendererLayer, string | Uint8Array>
	/**
	 * Renderers keyed by layer MIME type, the same registry `render` takes.
	 *
	 * **Which renderer the seal runs, in order.**
	 *
	 * 1. A renderer registered for a React layer's MIME type. It is handed the
	 *    flow markers and writes the PDF itself, so it wins over `renderer` and
	 *    needs no `adapter`.
	 * 2. Core's own text renderer, whenever the layer places a slot in flow.
	 *    Nothing else can inject core's markers, so neither `renderer` nor an
	 *    entry here is consulted; an override alongside flow placement is a
	 *    `SealConfigError` before anything renders.
	 * 3. Otherwise `renderer`, then an entry here for the layer's MIME type,
	 *    then core's own — the order `render` itself uses.
	 */
	renderers?: RendererRegistry
}

/**
 * Infers the full payload type for filling a form.
 * Works with both raw Form types and FormInstance types.
 * Fields, parties, and annexes are required if defined in the form, optional otherwise.
 */
export type InferFormPayload<F> = InferredFormPayload<F>
export type ProgressiveFormPayload<F> = InferredProgressiveFormPayload<F>

function isMergeRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Merge a progressive patch into an existing value. Objects merge recursively,
 * arrays replace the previous value, and undefined never acts as a deletion
 * sentinel. Cloning keeps the runtime form immutable across updates.
 */
function mergePatchValues<T>(current: T, patch: unknown): T {
	if (patch === undefined) return deepClone(current)
	if (Array.isArray(patch)) return deepClone(patch) as T
	if (isMergeRecord(patch)) {
		const result = (isMergeRecord(current) ? deepClone(current) : {}) as Record<string, unknown>
		for (const [key, value] of Object.entries(patch)) {
			if (value === undefined) continue
			result[key] = mergePatchValues(result[key], value)
		}
		return result as T
	}
	return deepClone(patch) as T
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

interface CompleteFormData {
	fields: Record<string, unknown>
	parties: Record<string, Party | Party[]>
	annexes: Record<string, unknown>
}

/**
 * Remove declared requiredness from the value schema. Requiredness is a
 * runtime concern for forms: visibility and required expressions are resolved
 * against the current payload before missing values are reported.
 */
function makeRuntimeOptionalField(field: FormField): FormField {
	if (field.type === 'fieldset') {
		const fieldset = field as FieldsetField
		return {
			...fieldset,
			required: false,
			fields: makeRuntimeOptionalFields(fieldset.fields)!,
		}
	}

	if (field.type === 'list') {
		const list = field as ListField
		return {
			...list,
			required: false,
			item: makeRuntimeOptionalField(list.item),
		}
	}

	return { ...field, required: false }
}

function makeRuntimeOptionalFields(
	fields: Record<string, FormField> | undefined,
): Record<string, FormField> | undefined {
	if (!fields) return fields

	return Object.fromEntries(
		Object.entries(fields).map(([fieldId, field]) => [fieldId, makeRuntimeOptionalField(field)]),
	) as Record<string, FormField>
}

function makeRuntimeOptionalForm(formDef: Form): Form {
	return {
		...formDef,
		fields: makeRuntimeOptionalFields(formDef.fields),
		parties: formDef.parties
			? Object.fromEntries(
				Object.entries(formDef.parties).map(([roleId, party]) => [roleId, { ...party, required: false }]),
			) as Form['parties']
			: formDef.parties,
		annexes: formDef.annexes
			? Object.fromEntries(
				Object.entries(formDef.annexes).map(([annexId, annex]) => [annexId, { ...annex, required: false }]),
			) as Form['annexes']
			: formDef.annexes,
	}
}

function createMissingValueError(kind: 'field' | 'annex', key: string): ValidationError {
	const label = kind === 'field' ? 'field' : 'annex'
	return {
		field: `${kind === 'field' ? 'fields' : 'annexes'}.${key}`,
		message: `Missing required ${label}: ${kind === 'field' ? 'fields' : 'annexes'}.${key}`,
	}
}

/**
 * Validate every form payload section, then apply the role-specific party
 * checks that are not represented by the compiled payload schema.
 */
function validateCompleteFormData(
	formDef: Form,
	data: CompleteFormData,
	options?: { applyDefaults?: boolean },
): CompleteFormData {
	// Schema validation checks every supplied value, but does not decide which
	// values are required. That decision comes from the evaluated runtime state.
	const result = validateFormData(
		makeRuntimeOptionalForm(formDef),
		data as unknown as Record<string, unknown>,
		options,
	)
	if (!result.success) {
		throw new FormValidationError(result.errors)
	}

	const validated = result.data as Partial<CompleteFormData>
	const fields = validated.fields ?? data.fields
	const parties = validated.parties ?? data.parties
	const annexes = validated.annexes ?? data.annexes
	const runtimeResult = evaluateFormDefs(formDef, { fields, parties })
	const runtimeState = 'value' in runtimeResult
		? runtimeResult.value
		: { fields: new Map(), annexes: new Map(), defsValues: new Map() }
	const fillState = computeFillState(formDef, fields, parties, annexes, runtimeState)
	const missingValues = fillState.openRequired
		.filter((item) => item.kind === 'field' || item.kind === 'annex')
		.map((item) => createMissingValueError(item.kind === 'field' ? 'field' : 'annex', item.key))
	if (missingValues.length > 0) {
		throw new FormValidationError(missingValues)
	}

	const partyContext = buildFormContext(formDef, { fields, parties })

	for (const [roleId, formParty] of Object.entries(formDef.parties ?? {})) {
		const partyResult = validatePartiesForRole(
			parties[roleId],
			{ ...formParty, required: evaluatePartyRequiredness(formParty, partyContext) },
			roleId,
		)
		if (!partyResult.success) {
			throw new FormValidationError(
				partyResult.errors.map((message) => ({ field: `parties.${roleId}`, message })),
			)
		}
	}

	return {
		fields,
		parties,
		annexes,
	}
}

function collectRuntimeValidationErrors(formDef: Form, data: CompleteFormData): ValidationError[] {
	try {
		validateCompleteFormData(formDef, data)
		return []
	} catch (error) {
		if (error instanceof FormValidationError) {
			return error.errors
		}
		return [{
			field: 'root',
			message: error instanceof Error ? error.message : String(error),
		}]
	}
}

/**
 * Validate a complete fields section without requiring unrelated payload
 * sections such as parties or annexes.
 */
function validateFieldsOnly(formDef: Form, fields: Record<string, unknown>): Record<string, unknown> {
	const fieldsOnlyForm = { ...formDef, parties: undefined, annexes: undefined } as Form
	const result = validateFormData(fieldsOnlyForm, { fields }, { applyDefaults: false })
	if (!result.success) {
		throw new FormValidationError(result.errors)
	}

	return (result.data as { fields: Record<string, unknown> }).fields
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
	/** True when the current values are valid and all error-severity rules pass. */
	valid: boolean
	/** Value, constraint, and effective-requiredness errors. */
	errors: ValidationError[]
	/** Full rule evaluation results. */
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
	partialFill(seed?: ProgressiveFormPayload<F>, options?: PartialFillOptions): DraftForm<F>

	/**
	 * Safely create a DraftForm from partial data, returning a result object.
	 */
	safePartialFill(seed?: ProgressiveFormPayload<F>, options?: PartialFillOptions): SafePartialFillResult<F>

	/**
	 * Render form content directly.
	 */
	render<Output = string | Uint8Array>(options?: RenderOptions<Output>): Promise<Output>

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
	render<Output = string | Uint8Array>(options?: RuntimeFormRenderOptions<Output>): Promise<Output>
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
	readonly canonicalPdfBytes: undefined

	// Field Mutation
	setField<K extends FieldKeys<F>>(fieldId: K, value: ExtractFields<F>[K]): DraftForm<F>
	updateFields(partial: DeepPartial<ExtractFields<F>>): DraftForm<F>

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
	update(patch: ProgressiveFormPayload<F>, options?: UpdateOptions): DraftForm<F>

	/**
	 * Safely merge a patch, returning a result object instead of throwing.
	 */
	safeUpdate(patch: ProgressiveFormPayload<F>, options?: UpdateOptions): SafePartialFillResult<F>

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
	seal(options?: SealOptions | Sealer): Promise<SignableForm<F>>

	/**
	 * Resolve the signature map and the exact converted PDF it describes,
	 * without flattening, hashing, or changing phase. Requires a layer that
	 * declares unified signature slots (`signatures`).
	 */
	prepareSeal(options?: SealOptions): Promise<SealPreparation>

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
	/** Exact flattened PDF bytes covered by canonicalPdfHash. */
	readonly canonicalPdfBytes: Uint8Array | undefined

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
	readonly canonicalPdfBytes: Uint8Array | undefined

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

/** A Map snapshot whose mutators cannot alter a runtime state's public view. */
class RuntimeStateMap<K, V> extends Map<K, V> {
	constructor(entries: Iterable<readonly [K, V]>) {
		super()
		for (const [key, value] of entries) Map.prototype.set.call(this, key, value)
	}

	set(): this {
		throw new TypeError('Runtime state snapshots are read-only')
	}

	delete(): boolean {
		throw new TypeError('Runtime state snapshots are read-only')
	}

	clear(): void {
		throw new TypeError('Runtime state snapshots are read-only')
	}
}

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
	/**
	 * Reads the bytes of file-backed layers. Bound when the form is
	 * constructed and spread forward by every mutator, so a form that renders
	 * or seals a file-backed layer keeps that ability through every
	 * transition. See `ArtifactInstanceOptions`.
	 */
	resolver?: Resolver
	captures?: SignatureCapture[]
	witnesses?: WitnessParty[]
	attestations?: Attestation[]
	signatureMap?: SigningField[]
	canonicalPdfHash?: string
	canonicalPdfBytes?: Uint8Array
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
		fields: fieldsInput,
		parties: partiesInput,
		annexes: annexesInput,
		signers: signersInput,
		signatories: signatoriesInput,
		targetLayer,
		resolver,
		phase,
		captures: capturesInput,
		witnesses: witnessesInput,
		attestations: attestationsInput,
		executedAt,
		signatureMap: signatureMapInput,
		canonicalPdfHash,
		canonicalPdfBytes: canonicalPdfBytesInput,
	} = config
	assertValidArtifactDefinition(formDef)

	// Runtime state is owned by the instance. Guarded mutation methods create a
	// new instance, so cloning at this boundary prevents aliases from the
	// caller's input or a previous instance from bypassing those methods.
	const fieldValues = deepClone(fieldsInput)
	const partyValues = deepClone(partiesInput)
	const annexValues = deepClone(annexesInput)
	const signerValues = deepClone(signersInput)
	const signatoryValues = deepClone(signatoriesInput)
	const captures = deepClone(capturesInput ?? [])
	const witnesses = deepClone(witnessesInput ?? [])
	const attestations = deepClone(attestationsInput ?? [])
	const signatureMap = signatureMapInput === undefined ? undefined : deepClone(signatureMapInput)
	const canonicalPdfBytes = canonicalPdfBytesInput === undefined ? undefined : deepClone(canonicalPdfBytesInput)
	config = {
		...config,
		fields: fieldValues,
		parties: partyValues,
		annexes: annexValues,
		signers: signerValues,
		signatories: signatoryValues,
		captures,
		witnesses,
		attestations,
		signatureMap,
		canonicalPdfBytes,
	} as RuntimeFormConfig<F>

	// These views are detached from the closure state and frozen deeply where
	// the value type permits it. Internal rendering, validation, and transitions
	// continue to use the private values above.
	const fieldsView = deepReadonlyClone(fieldValues)
	const partiesView = deepReadonlyClone(partyValues)
	const annexesView = deepReadonlyClone(annexValues)
	const signersView = deepReadonlyClone(signerValues)
	const signatoriesView = deepReadonlyClone(signatoryValues)
	const capturesView = deepReadonlyClone(captures)
	const witnessesView = deepReadonlyClone(witnesses)
	const attestationsView = deepReadonlyClone(attestations)
	const signatureMapView = signatureMap === undefined ? undefined : deepReadonlyClone(signatureMap)
	const canonicalPdfBytesView = canonicalPdfBytes === undefined ? undefined : deepReadonlyClone(canonicalPdfBytes)

	// Cached runtime state
	let _runtimeState: FormRuntimeState | null = null
	let _runtimeStateView: FormRuntimeState | null = null

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
			const result = evaluateFormDefs(formDef, {
				fields: fieldValues,
				parties: partyValues,
				witnesses: witnesses.map((witness) => witness.party),
			})
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

	const getRuntimeStateView = (): FormRuntimeState => {
		if (!_runtimeStateView) {
			const state = getRuntimeState()
			_runtimeStateView = {
				fields: new RuntimeStateMap(
					[...state.fields].map(([fieldId, fieldState]) => [fieldId, deepReadonlyClone(fieldState)] as const),
				),
				annexes: new RuntimeStateMap(
					[...state.annexes].map(([annexId, annexState]) => [annexId, deepReadonlyClone(annexState)] as const),
				),
				defsValues: new RuntimeStateMap(
					[...state.defsValues].map(([key, value]) => [key, deepReadonlyClone(value)] as const),
				),
			}
		}
		return _runtimeStateView
	}

	const augmentPartiesForRender = (): Record<string, Party | Party[]> => {
		const augmented: Record<string, Party | Party[]> = {}

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
		get fields() {
			return fieldsView
		},
		get parties() {
			return partiesView
		},
		get annexes() {
			return annexesView
		},
		get signers() {
			return signersView
		},
		get signatories() {
			return signatoriesView
		},
		get captures() {
			return capturesView
		},
		get witnesses() {
			return witnessesView
		},
		get attestations() {
			return attestationsView
		},
		executedAt,
		get signatureMap() {
			return signatureMapView
		},
		canonicalPdfHash,
		get canonicalPdfBytes() {
			return canonicalPdfBytesView
		},

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
			return fieldsView[fieldId] as ExtractFields<F>[K] | undefined
		},

		getAllFields(): ExtractFields<F> {
			return fieldsView as ExtractFields<F>
		},

		// ============================================================================
		// Field Mutation (draft only)
		// ============================================================================

		setField<K extends FieldKeys<F>>(fieldId: K, value: ExtractFields<F>[K]): RuntimeForm<F> {
			ensureDraft('setField')
			const newFields = { ...fieldValues, [fieldId]: value }
			return createRuntimeForm({
				...config,
				fields: validateFieldsOnly(formDef, newFields),
			})
		},

		updateFields(partial: DeepPartial<ExtractFields<F>>): RuntimeForm<F> {
			ensureDraft('updateFields')
			const newFields = mergePatchValues(fieldValues, partial)
			return createRuntimeForm({
				...config,
				fields: validateFieldsOnly(formDef, newFields),
			})
		},

		// ============================================================================
		// Party Access
		// ============================================================================

		getParty<R extends PartyRoleKeys<F>>(roleId: R): Party | Party[] | undefined {
			validateRoleId(roleId)
			return partiesView[roleId]
		},

		getParties<R extends PartyRoleKeys<F>>(roleId: R): Party[] {
			validateRoleId(roleId)
			const parties = partiesView[roleId]
			return deepReadonlyClone((Array.isArray(parties) ? parties : parties ? [parties] : []) as Party[])
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
			return signersView[signerId]
		},

		hasSigner(signerId: string): boolean {
			return signerValues[signerId] !== undefined
		},

		getSignerAdoptedSignature(signerId: string): AdoptedSignature | undefined {
			return signersView[signerId]?.adopted?.signature
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
			return deepReadonlyClone(signatoriesView[roleId]?.[partyId] ?? [])
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
			return annexesView[annexId]
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

		update(patch: ProgressiveFormPayload<F>, options?: UpdateOptions): DraftForm<F> {
			ensureDraft('update')
			const validate = options?.validate ?? 'patch'
			const checkRules = options?.rules === true

			const patchFields = (patch as Record<string, unknown>).fields as Record<string, unknown> | undefined
			const patchParties = (patch as Record<string, unknown>).parties as Record<string, Party | Party[]> | undefined
			const patchAnnexes = (patch as Record<string, unknown>).annexes as Record<string, unknown> | undefined

			let validatedFields = mergePatchValues(fieldValues, patchFields)
			let validatedParties = mergePatchValues(partyValues, patchParties)
			let validatedAnnexes = mergePatchValues(annexValues, patchAnnexes)

			if (validate === 'patch') {
				if (patchFields !== undefined) {
					const fieldResult = validateProgressiveFieldsPatch(formDef, patchFields)
					if (!fieldResult.success) {
						throw new FormValidationError(fieldResult.errors)
					}
					validatedFields = mergePatchValues(fieldValues, fieldResult.value)
				}
				if (patchParties !== undefined) {
					const partyResult = validateProgressivePartiesPatch(formDef, patchParties)
					if (!partyResult.success) {
						throw new FormValidationError(partyResult.errors)
					}
					validatedParties = mergePatchValues(partyValues, partyResult.value)
				}
				if (patchAnnexes !== undefined) {
					const annexResult = validateProgressiveAnnexesPatch(formDef, patchAnnexes)
					if (!annexResult.success) {
						throw new FormValidationError(annexResult.errors)
					}
					validatedAnnexes = mergePatchValues(annexValues, annexResult.value)
				}
			} else if (validate === 'full') {
				const validated = validateCompleteFormData(formDef, {
					fields: validatedFields,
					parties: validatedParties,
					annexes: validatedAnnexes,
				}, { applyDefaults: false })
				validatedFields = validated.fields
				validatedParties = validated.parties
				validatedAnnexes = validated.annexes
			}

			const draft = createRuntimeForm<F>({
				...config,
				fields: validatedFields,
				parties: validatedParties,
				annexes: validatedAnnexes,
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

		safeUpdate(patch: ProgressiveFormPayload<F>, options?: UpdateOptions): SafePartialFillResult<F> {
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
			return computeFillState(formDef, fieldValues, partyValues, annexValues, state, options, witnesses.map((witness) => witness.party))
		},

		getNextFillTarget(options?: FillTargetOptions): FillTarget | null {
			const state = getRuntimeState()
			return getNextFillTarget(formDef, fieldValues, partyValues, annexValues, state, options, witnesses.map((witness) => witness.party))
		},

		getAvailableFillTargets(options?: FillTargetOptions): FillTarget[] {
			const state = getRuntimeState()
			return getAvailableFillTargets(formDef, fieldValues, partyValues, annexValues, state, options, witnesses.map((witness) => witness.party))
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
			return capturesView.find(
				(c) =>
					c.role === role && c.partyId === partyId && c.signerId === signerId && c.locationId === locationId && c.type === type,
			)
		},

		getCapturesForLocation(locationId: string): SignatureCapture[] {
			return deepReadonlyClone(capturesView.filter((c) => c.locationId === locationId))
		},

		getCapturesForParty(roleId: string, partyId: string): SignatureCapture[] {
			return deepReadonlyClone(capturesView.filter((c) => c.role === roleId && c.partyId === partyId))
		},

		getCapturesForSigner(signerId: string): SignatureCapture[] {
			return deepReadonlyClone(capturesView.filter((c) => c.signerId === signerId))
		},

		// ============================================================================
		// Witness Methods (signable only)
		// ============================================================================

		getWitness(witnessId: string): WitnessParty | undefined {
			return witnessesView.find((w) => w.id === witnessId)
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
			return deepReadonlyClone(attestationsView.filter((a) => a.witnessId === witnessId))
		},

		getAttestationsForParty<R extends PartyRoleKeys<F>>(roleId: R, partyId: string, signerId?: string): Attestation[] {
			validateRoleId(roleId)
			return deepReadonlyClone(attestationsView.filter((a) =>
				a.attestsTo.some(
					(t) => t.roleId === roleId && t.partyId === partyId && (signerId === undefined || t.signerId === signerId),
				),
			))
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
			return getRuntimeStateView()
		},

		getFieldState(fieldId: string): FieldRuntimeState | undefined {
			const fieldState = getRuntimeState().fields.get(fieldId)
			return fieldState === undefined ? undefined : deepReadonlyClone(fieldState)
		},

		isFieldVisible(fieldId: string): boolean {
			return runtime.getFieldState(fieldId)?.visible ?? true
		},

		isFieldRequired(fieldId: string): boolean {
			return runtime.getFieldState(fieldId)?.required ?? false
		},

		getAnnexState(annexId: string): AnnexRuntimeState | undefined {
			const annexState = getRuntimeState().annexes.get(annexId)
			return annexState === undefined ? undefined : deepReadonlyClone(annexState)
		},

		getLogicValue(key: string): unknown {
			const value = getRuntimeState().defsValues.get(key)
			return value === undefined ? undefined : deepReadonlyClone(value)
		},

		validateRules(): FormRulesValidationResult {
			const state = getRuntimeState()
			const context = buildFormContext(formDef, {
				fields: fieldValues,
				parties: partyValues,
				witnesses: witnesses.map((witness) => witness.party),
			})
			return evaluateFormRules(formDef, fieldValues, state.defsValues, context)
		},

		getVisibleFields(): FieldRuntimeState[] {
			const state = getRuntimeState()
			const result: FieldRuntimeState[] = []
			for (const [_fieldId, fieldState] of state.fields) {
				if (fieldState.visible) {
					result.push(deepReadonlyClone(fieldState))
				}
			}
			return deepReadonlyClone(result)
		},

		getRequiredVisibleFields(): FieldRuntimeState[] {
			const state = getRuntimeState()
			const result: FieldRuntimeState[] = []
			for (const [_fieldId, fieldState] of state.fields) {
				if (fieldState.visible && fieldState.required) {
					result.push(deepReadonlyClone(fieldState))
				}
			}
			return deepReadonlyClone(result)
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
			const errors = collectRuntimeValidationErrors(formDef, {
				fields: fieldValues,
				parties: partyValues,
				annexes: annexValues,
			})
			return { valid: errors.length === 0 && rules.valid, errors, rules }
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

		// NOTE: keep the pipeline below in sync with seal()'s slot branch; they
		// unify once the legacy block modes retire at the next major.
		async prepareSeal(input: SealOptions = {}): Promise<SealPreparation> {
			ensureDraft('prepareSeal')
			const options = input
			const layerSpec = formDef.layers?.[targetLayer]
			if (!layerSpec) throw new Error(`Cannot prepare seal: target layer "${targetLayer}" was not found`)
			const declaredSlots = hasSignatureSlots(layerSpec) ? layerSpec.signatures : undefined
			const legacySlots = declaredSlots ? undefined : compileLegacySignatureSlots(layerSpec)
			if (!declaredSlots && !legacySlots) {
				throw new Error(
					'prepareSeal requires a layer with signature slots (`signatures`) or legacy signatureBlocks/anchorBlocks.',
				)
			}
			// A layer whose registered renderer writes the PDF needs no converter:
			// there is nothing left to convert.
			const sealRenderer = selectSealRenderer(layerSpec, options.renderers)
			if (layerSpec.mimeType !== 'application/pdf' && !options.adapter && !sealRenderer) {
				throw new SealConfigError(
					`Cannot prepare seal for ${layerSpec.mimeType} without a converter. Pass a SealAdapter (adapter option); PDF layers prepare locally.`,
					['missing converter'],
				)
			}
			const plan = buildSlotPlan({
				formDef,
				slots: declaredSlots ?? legacySlots!,
				partyValues,
				signatoryValues,
				legacy: !declaredSlots,
			})
			if (plan.flow.length > 0) {
				const problems: string[] = []
				for (const field of plan.flow) {
					if (field.type !== 'signature' && field.type !== 'initials') {
						problems.push(`slot "${field.id}" has placement 'flow' with type "${field.type}"; flow supports signature and initials`)
					}
				}
				if (layerSpec.mimeType === 'application/pdf') {
					problems.push("'flow' placement needs a text-template layer; PDF layers use absolute or anchor placement")
				}
				// An override is opaque: core cannot inject a marker into it. A
				// registered renderer is not — it is handed the markers and draws
				// them itself — so the incompatibility is the override's alone.
				if (options.renderer && !sealRenderer) {
					problems.push("'flow' placement is incompatible with a custom renderer override; core must inject markers during rendering")
				}
				if (problems.length > 0) {
					throw new SealConfigError(`Cannot prepare seal: ${problems.join('; ')}`, problems)
				}
			}

			const SIGNATURE_UNDERSCORES = '________________'
			const INITIALS_UNDERSCORES = '______'
			const flowById = new Map(plan.flow.map((field) => [field.id, field]))
			const textOptions = (withMarkers: boolean): TextSignatureOptions => ({
				format: 'text',
				placeholder: {
					signature: (context) => {
						const field = withMarkers ? flowById.get(context.locationId) : undefined
						const prefix = field && field.type === 'signature' ? encodeMarker(field.signerIndex, FieldType.SIGNATURE) : ''
						return prefix + SIGNATURE_UNDERSCORES
					},
					initials: (context) => {
						const field = withMarkers ? flowById.get(context.locationId) : undefined
						const prefix = field && field.type === 'initials' ? encodeMarker(field.signerIndex, FieldType.INITIALS) : ''
						return prefix + INITIALS_UNDERSCORES
					},
				},
			})
			const prepareRequest: SealingRequest<F> = {
				form: formDef,
				fields: fieldValues,
				parties: partyValues,
				signers: signerValues,
				signatories: signatoryValues,
				targetLayer,
				...(plan.anchors.length > 0 && { anchorFields: plan.anchors.map((entry) => entry.field) }),
			}

			const pass = createSealPass({
				layerSpec,
				flow: plan.flow.length > 0,
				sealRenderer,
				markers: signingMarkersFor(declaredSlots ?? legacySlots!, plan.flow),
				textRenderer: (withMarkers) => createRenderer({ textSignatureOptions: textOptions(withMarkers) }),
				override: options.renderer,
				renderers: options.renderers,
				render: (renderer) =>
					runtime.render<string | Uint8Array>({
						renderer,
						layer: targetLayer,
					}),
				convert: async (content) =>
					(
						await options.adapter!.convert({
							...prepareRequest,
							document: { content, mimeType: layerSpec.mimeType },
						})
					).pdf,
			})

			const provenance: Record<string, PlacementProvenance> = {}
			const map: SigningField[] = [...plan.resolved]
			for (const field of plan.resolved) provenance[field.id] = 'declared'
			const flowResolved: SigningField[] = []
			let pdf: Uint8Array

			if (layerSpec.mimeType === 'application/pdf') {
				const document = await pass.render(false)
				if (typeof document === 'string') throw new Error('PDF renderer returned text instead of binary content.')
				pdf = document
			} else {
				if (plan.flow.length > 0) {
					const markerHits = await locateFlowMarkers(await pass.pdf(true), plan.flow)
					const markersById = new Map(markerHits.map((hit) => [hit.id, hit]))
					for (const field of plan.flow) {
						const hit = markersById.get(field.id)
						if (!hit) throw new Error(`Marker for flow slot "${field.id}" was not found in the converted PDF.`)
						flowResolved.push({ ...field, page: hit.page, x: hit.x, y: hit.y, width: hit.width, height: hit.height })
					}
				}
				pdf = await pass.pdf(false)
				if (flowResolved.length > 0) {
					const cleanPages = await pageTextRuns(pdf)
					for (const field of flowResolved) {
						const page = cleanPages[field.page - 1]
						if (!page) throw new Error(`Flow slot "${field.id}" resolved to page ${field.page}, which the clean render does not have.`)
						const pageHeight = page.mediaBox[3] - page.mediaBox[1]
						const expectedRawY = pageHeight - field.y - field.height + page.mediaBox[1]
						const expectedX = field.x + page.mediaBox[0]
						const near = page.runs.some(
							(run) =>
								Math.abs(run.y - expectedRawY) <= 3 &&
								run.text.includes('_') &&
								run.x - 3 <= expectedX &&
								expectedX <= run.x + run.width + 3,
						)
						if (!near) {
							throw new Error(
								`Flow slot "${field.id}" drifted between the marker pass and the clean render (page ${field.page}). ` +
								'The marker run likely changed a line wrap; use anchor placement for this slot or widen its placeholder.',
							)
						}
					}
				}
			}

			for (const field of flowResolved) {
				map.push(field)
				provenance[field.id] = 'marker'
			}
			if (plan.anchors.length > 0) {
				const slotLocator = options.locate ?? { locate: locatePlacements }
				const hits = await slotLocator.locate(
					pdf,
					plan.anchors.map((entry) => ({
						id: entry.field.id,
						kind: 'anchor' as const,
						text: entry.text,
						...(entry.occurrence !== undefined && { occurrence: entry.occurrence }),
					})),
				)
				const hitsById = new Map(hits.map((hit) => [hit.id, hit]))
				for (const entry of plan.anchors) {
					const hit = hitsById.get(entry.field.id)
					if (!hit) throw new Error(`Locator did not resolve anchor slot "${entry.field.id}".`)
					map.push({ ...entry.field, page: hit.page, x: hit.x + entry.offsetX, y: hit.y + entry.offsetY })
					provenance[entry.field.id] = 'anchor'
				}
			}
			map.sort((a, b) => a.signerIndex - b.signerIndex)

			return { pdf, signatureMap: map, provenance, warnings: [...plan.skipped] }
		},

		async seal(input: SealOptions | Sealer = {}): Promise<RuntimeForm<F>> {
			ensureDraft('seal')
			const legacyAdapter = 'seal' in input ? input : undefined
			const options = (legacyAdapter ? {} : input) as SealOptions
			const layerSpec = formDef.layers?.[targetLayer]
			if (!layerSpec) throw new Error(`Cannot seal: target layer "${targetLayer}" was not found`)

			// A layer whose registered renderer writes the PDF is sealed through
			// that renderer and needs no adapter. For every other layer the
			// override and the registry apply in `render`'s own order, except on
			// a flow pass, which only core's text renderer can produce.
			const sealRenderer = selectSealRenderer(layerSpec, options.renderers)
			/** One seal pass over the target layer. See `createSealPass`. */
			const sealPassFor = (
				request: SealingRequest<F>,
				flow: readonly SigningField[],
				slots: Record<string, SignatureSlot>,
				textRenderer: (withMarkers: boolean) => SealRenderer,
			) =>
				createSealPass({
					layerSpec,
					flow: flow.length > 0,
					sealRenderer,
					markers: signingMarkersFor(slots, flow),
					textRenderer,
					override: options.renderer,
					renderers: options.renderers,
					render: (renderer) =>
						runtime.render<string | Uint8Array>({
							renderer,
							layer: targetLayer,
						}),
					convert: async (content) =>
						(
							await options.adapter!.convert({
								...request,
								document: { content, mimeType: layerSpec.mimeType },
							})
						).pdf,
				})

			const finalizePdf = async (
				pdf: Uint8Array,
				signatureMap: SigningField[] = [],
			): Promise<import('@paradoc/types').SealingResult> => {
				const canonicalPdfBytes = await flattenPdf(pdf)
				const digest = await globalThis.crypto.subtle.digest(
					'SHA-256',
					Uint8Array.from(canonicalPdfBytes).buffer,
				)
				const canonicalPdfHash = `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
				return { signatureMap, canonicalPdfHash, canonicalPdfBytes }
			}

			const runSealer = async (request: SealingRequest<F>) => {
				if (legacyAdapter) return legacyAdapter.seal(request)
				if (layerSpec.mimeType !== 'application/pdf' && !options.adapter && !sealRenderer) {
					throw new Error(
						`Cannot seal ${layerSpec.mimeType} without an adapter. ` +
						'PDF layers seal locally; other MIME types require a seal adapter, ' +
						'unless a renderer registered for the type produces the PDF itself.',
					)
				}
				// No flow slots on this path, so nothing needs core's marker
				// injection: the override and the registry apply in render's order.
				const pass = sealPassFor(request, [], {}, () => createRenderer())
				if (sealRenderer) return finalizePdf(await pass.pdf(false))
				const document = await pass.render(false)
				if (layerSpec.mimeType === 'application/pdf') {
					if (typeof document === 'string') throw new Error('PDF renderer returned text instead of binary content.')
					return finalizePdf(document)
				}
				if (!options.adapter) throw new Error('Seal adapter was not resolved.')
				// The adapter's own signature map is kept here, which is why this
				// converts itself rather than going through `pass.pdf`.
				const converted = await options.adapter.convert({
					...request,
					document: { content: document, mimeType: layerSpec.mimeType },
				})
				return finalizePdf(converted.pdf, converted.signatureMap)
			}

			// Unified slot mode: the layer declares `signatures`. One engine for
			// every placement strategy; legacy signatureBlocks/anchorBlocks keep
			// their original paths below during the deprecation window.
			if (hasSignatureSlots(layerSpec)) {
				if (layerSpec.mimeType !== 'application/pdf' && !options.adapter && !legacyAdapter && !sealRenderer) {
					throw new SealConfigError(
						`Cannot seal ${layerSpec.mimeType} without a converter. Pass a SealAdapter (adapter option); PDF layers seal locally.`,
						['missing converter'],
					)
				}
				const plan = buildSlotPlan({
					formDef,
					slots: layerSpec.signatures,
					partyValues,
					signatoryValues,
				})
				if (plan.flow.length > 0) {
					const problems: string[] = []
					for (const field of plan.flow) {
						if (field.type !== 'signature' && field.type !== 'initials') {
							problems.push(`slot "${field.id}" has placement 'flow' with type "${field.type}"; flow supports signature and initials`)
						}
					}
					if (layerSpec.mimeType === 'application/pdf') {
						problems.push("'flow' placement needs a text-template layer; PDF layers use absolute or anchor placement")
					}
					// See prepareSeal: an override is opaque to the marker
					// injection, a registered renderer is handed the markers.
					if (options.renderer && !sealRenderer) {
						problems.push("'flow' placement is incompatible with a custom renderer override; core must inject markers during rendering")
					}
					if (!options.adapter && !sealRenderer) {
						problems.push("'flow' placement requires a SealAdapter (converter)")
					}
					if (problems.length > 0) {
						throw new SealConfigError(`Cannot seal: ${problems.join('; ')}`, problems)
					}
				}

				const slotRequest: SealingRequest<F> = {
					form: formDef,
					fields: fieldValues,
					parties: partyValues,
					signers: signerValues,
					signatories: signatoryValues,
					targetLayer,
					...(plan.anchors.length > 0 && { anchorFields: plan.anchors.map((entry) => entry.field) }),
				}
				// The flow path renders twice: pass one carries invisible markers to
				// locate placeholders in the converted PDF; pass two renders clean and
				// becomes the canonical document. Both passes share identical visible
				// placeholders, so located coordinates transfer to the clean PDF.
				const SIGNATURE_UNDERSCORES = '________________'
				const INITIALS_UNDERSCORES = '______'
				const slotTextOptions = (withMarkers: boolean): TextSignatureOptions => {
					const flowById = new Map(plan.flow.map((field) => [field.id, field]))
					return {
						format: 'text',
						placeholder: {
							signature: (context) => {
								const field = withMarkers ? flowById.get(context.locationId) : undefined
								const prefix = field && field.type === 'signature' ? encodeMarker(field.signerIndex, FieldType.SIGNATURE) : ''
								return prefix + SIGNATURE_UNDERSCORES
							},
							initials: (context) => {
								const field = withMarkers ? flowById.get(context.locationId) : undefined
								const prefix = field && field.type === 'initials' ? encodeMarker(field.signerIndex, FieldType.INITIALS) : ''
								return prefix + INITIALS_UNDERSCORES
							},
						},
					}
				}
				const slotTextOptionsRenderer = (withMarkers: boolean) =>
					createRenderer({ textSignatureOptions: slotTextOptions(withMarkers) })
				const slotPass = sealPassFor(slotRequest, plan.flow, layerSpec.signatures, slotTextOptionsRenderer)

				let slotResult: import('@paradoc/types').SealingResult
				const flowResolved: SigningField[] = []
				if (plan.flow.length > 0) {
					const markerHits = await locateFlowMarkers(await slotPass.pdf(true), plan.flow)
					const markersById = new Map(markerHits.map((hit) => [hit.id, hit]))
					for (const field of plan.flow) {
						const hit = markersById.get(field.id)
						if (!hit) throw new Error(`Marker for flow slot "${field.id}" was not found in the converted PDF.`)
						flowResolved.push({ ...field, page: hit.page, x: hit.x, y: hit.y, width: hit.width, height: hit.height })
					}

					const cleanPdf = await slotPass.pdf(false)

					// Marker glyphs occupy width, so wraps or page breaks can shift
					// between passes. Verify each resolved box still points at a text
					// run in the clean PDF; drift becomes a loud error, never a
					// silently misplaced signature.
					const cleanPages = await pageTextRuns(cleanPdf)
					for (const field of flowResolved) {
						const page = cleanPages[field.page - 1]
						if (!page) throw new Error(`Flow slot "${field.id}" resolved to page ${field.page}, which the clean render does not have.`)
						const pageHeight = page.mediaBox[3] - page.mediaBox[1]
						const expectedRawY = pageHeight - field.y - field.height + page.mediaBox[1]
						const expectedX = field.x + page.mediaBox[0]
						// The clean render merges the label and placeholder into one text
						// run, so the box must fall INSIDE a run on the same line that
						// still carries the placeholder underscores.
						const near = page.runs.some(
							(run) =>
								Math.abs(run.y - expectedRawY) <= 3 &&
								run.text.includes('_') &&
								run.x - 3 <= expectedX &&
								expectedX <= run.x + run.width + 3,
						)
						if (!near) {
							throw new Error(
								`Flow slot "${field.id}" drifted between the marker pass and the clean render (page ${field.page}). ` +
								'The marker run likely changed a line wrap; use anchor placement for this slot or widen its placeholder.',
							)
						}
					}

					slotResult = await finalizePdf(cleanPdf)
				} else {
					slotResult = await runSealer(slotRequest)
				}

				const slotMap = [...plan.resolved, ...flowResolved]
				if (plan.anchors.length > 0) {
					if (!slotResult.canonicalPdfBytes) {
						throw new Error('Cannot locate anchor positions: the seal result carries no canonical PDF bytes.')
					}
					const slotLocator = options.locate ?? { locate: locatePlacements }
					const hits = await slotLocator.locate(
						slotResult.canonicalPdfBytes,
						plan.anchors.map((entry) => ({
							id: entry.field.id,
							kind: 'anchor' as const,
							text: entry.text,
							...(entry.occurrence !== undefined && { occurrence: entry.occurrence }),
						})),
					)
					const hitsById = new Map(hits.map((hit) => [hit.id, hit]))
					for (const entry of plan.anchors) {
						const hit = hitsById.get(entry.field.id)
						if (!hit) throw new Error(`Locator did not resolve anchor slot "${entry.field.id}".`)
						slotMap.push({
							...entry.field,
							page: hit.page,
							x: hit.x + entry.offsetX,
							y: hit.y + entry.offsetY,
						})
					}
				}
				slotMap.sort((a, b) => a.signerIndex - b.signerIndex)

				return createRuntimeForm({
					...config,
					phase: 'signable',
					captures: [],
					witnesses: [],
					attestations: [],
					signatureMap: slotMap,
					canonicalPdfHash: slotResult.canonicalPdfHash,
					canonicalPdfBytes: slotResult.canonicalPdfBytes,
					executedAt: undefined,
				})
			}

			// Check if layer has pre-defined signatureBlocks
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

				const result = await runSealer(request)

				return createRuntimeForm({
					...config,
					phase: 'signable',
					captures: [],
					witnesses: [],
					attestations: [],
					signatureMap,
					canonicalPdfHash: result.canonicalPdfHash,
					canonicalPdfBytes: result.canonicalPdfBytes,
					executedAt: undefined,
				})
			}

			// Anchor mode: Build signatureMap hints from anchor blocks, let adapter resolve positions
			const hasAnchorBlocks = layerSpec?.anchorBlocks &&
				Object.keys(layerSpec.anchorBlocks).length > 0

			if (hasAnchorBlocks) {
				if (!options.adapter && !legacyAdapter) {
					throw new Error('Cannot seal anchor-based signature fields without an adapter that resolves their final PDF positions.')
				}
				const anchorBlocks = layerSpec!.anchorBlocks!
				const anchorFields: SigningField[] = []
				let anchorSignerIndex = 0

				// Build signerMap (same logic as definition mode)
				const anchorSignerMap = new Map<string, string>() // key: "role:index" -> signerId

				for (const [roleId, roleSignatories] of Object.entries(signatoryValues)) {
					const parties = partyValues[roleId]
					const partyArray = Array.isArray(parties) ? parties : parties ? [parties] : []

					for (let i = 0; i < partyArray.length; i++) {
						const party = partyArray[i] as { id?: string }
						const partyId = party.id ?? `${roleId}-${i}`
						const partySignatories = roleSignatories[partyId] ?? []
						if (partySignatories.length > 0) {
							anchorSignerMap.set(`${roleId}:${i}`, partySignatories[0]!.signerId)
						}
					}
				}

				// Build anchor-based SigningField hints (coordinates are placeholder zeros;
				// the Sealer adapter is responsible for resolving actual positions from anchor text)
				for (const [locationId, block] of Object.entries(anchorBlocks as Record<string, AnchorBlock>)) {
					const partyRole = block.partyRole
					const partyIndex = block.partyIndex ?? 0

					// Skip blocks without a party role binding
					if (!partyRole) continue

					// Check if the party exists at this index
					const parties = partyValues[partyRole]
					const partyArray = Array.isArray(parties) ? parties : parties ? [parties] : []
					if (partyIndex >= partyArray.length) continue

					// Get the signer for this party
					const signerId = anchorSignerMap.get(`${partyRole}:${partyIndex}`)
					if (!signerId) continue

					// Map SignatureBlockType to SigningFieldType
					const fieldType: SigningFieldType = block.type === 'date' ? 'date_signed' : block.type

					const anchorField: SigningField = {
						id: locationId,
						signerIndex: anchorSignerIndex++,
						signerId,
						type: fieldType,
						// Placeholder coordinates: adapter resolves these from anchor.text
						page: 1,
						x: 0,
						y: 0,
						width: block.width,
						height: block.height,
						anchor: block.anchor,
						...(block.required !== undefined && { required: block.required }),
						...(block.label && { label: block.label }),
					}

					anchorFields.push(anchorField)
				}

				if (anchorFields.length === 0) {
					throw new Error(
						'Cannot seal: no anchor blocks could be mapped to signatories. ' +
						'Ensure parties have signatories assigned.',
					)
				}

				const anchorRequest: SealingRequest<F> = {
					form: formDef,
					fields: fieldValues,
					parties: partyValues,
					signers: signerValues,
					signatories: signatoryValues,
					targetLayer,
					anchorFields,
				}

				const anchorResult = await runSealer(anchorRequest)
				let anchorMap = anchorResult.signatureMap
				const adapterResolved = anchorMap && anchorMap.length === anchorFields.length
				// The built-in locator resolves anchors against the converted PDF, so
				// pure byte converters work with zero configuration. Passing `locate`
				// overrides it (custom tiers, hosted resolution).
				const anchorLocator = options.locate ?? { locate: locatePlacements }
				if (!adapterResolved) {
					if (!anchorResult.canonicalPdfBytes) {
						throw new Error('Cannot locate anchor positions: the seal result carries no canonical PDF bytes.')
					}
					const hits = await anchorLocator.locate(
						anchorResult.canonicalPdfBytes,
						anchorFields.map((field) => ({ id: field.id, kind: 'anchor' as const, text: field.anchor!.text })),
					)
					const hitsById = new Map(hits.map((hit) => [hit.id, hit]))
					anchorMap = anchorFields.map((field) => {
						const hit = hitsById.get(field.id)
						if (!hit) throw new Error(`Locator did not resolve anchor field "${field.id}".`)
						return {
							...field,
							page: hit.page,
							x: hit.x + (field.anchor?.offsetX ?? 0),
							y: hit.y + (field.anchor?.offsetY ?? 0),
						}
					})
				}
				if (!anchorMap || anchorMap.length !== anchorFields.length) {
					throw new Error(
						'Seal adapter did not resolve every anchor-based signature field to final PDF coordinates. ' +
						'Pass a locate option to override the built-in locator when the adapter is a pure converter.',
					)
				}

				return createRuntimeForm({
					...config,
					phase: 'signable',
					captures: [],
					witnesses: [],
					attestations: [],
					signatureMap: anchorMap,
					canonicalPdfHash: anchorResult.canonicalPdfHash,
					canonicalPdfBytes: anchorResult.canonicalPdfBytes,
					executedAt: undefined,
				})
			}

			// Undeclared-field mode: seal without a precomputed signature map
			// Validation 1: Check layer is PDF-convertible
			if (
				layerSpec.mimeType !== 'application/pdf'
				&& !PDF_CONVERTIBLE_LAYERS.includes(targetLayer as (typeof PDF_CONVERTIBLE_LAYERS)[number])
			) {
				throw new Error(
					`Cannot seal: layer "${targetLayer}" has no signatureBlocks, no anchorBlocks, and is not PDF-convertible. ` +
					`Add signatureBlocks or anchorBlocks to the layer, or use a supported layer: ${PDF_CONVERTIBLE_LAYERS.join(', ')}`,
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

			const result = await runSealer(request)

			return createRuntimeForm({
				...config,
				phase: 'signable',
				captures: [],
				witnesses: [],
				attestations: [],
				signatureMap: result.signatureMap,
				canonicalPdfHash: result.canonicalPdfHash,
				canonicalPdfBytes: result.canonicalPdfBytes,
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
			return signersView[field.signerId]
		},

		getFieldsForSigner(signerId: string): SigningField[] {
			if (!signatureMap) return deepReadonlyClone([])
			return deepReadonlyClone(signatureMapView!.filter((f) => f.signerId === signerId))
		},

		// ============================================================================
		// Rendering
		// ============================================================================

		async render<Output = string | Uint8Array>(options: RuntimeFormRenderOptions<Output> = {}): Promise<Output> {
			const { renderer: rendererOverride, renderers, layer: layerKey, bindings: optionsBindings } = options

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

			const renderer = selectLayerRenderer<Output>(key, layerSpec, rendererOverride, renderers)

			let bindings: Record<string, string> | undefined = layerSpec.bindings

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
				...(Object.keys(annexValues).length > 0 && { annexes: annexValues }),
				...(Object.keys(signerValues).length > 0 && { _signers: signerValues }),
				...(captures.length > 0 && { _captures: captures }),
				...(Object.keys(defsValuesObj).length > 0 && { defs: defsValuesObj }),
				...(executedAt && { _executedAt: executedAt }),
			}

			const template = await buildRendererLayer(key, layerSpec, bindings, resolver, 'artifact')

			// Parties travel beside the fields, where `FormData` declares them. A
			// template that names `parties.landlord` still reads them: the text,
			// PDF and DOCX renderers take them from either place, and one place
			// is enough.
			return await renderer.render({
				template,
				form: formDef,
				data: {
					fields: fullData,
					...(Object.keys(augmentedParties).length > 0 && { parties: augmentedParties }),
				},
				bindings,
			}) as Output
		},

		// ============================================================================
		// Serialization
		// ============================================================================

		toJSON(): RuntimeFormJSON<F> {
			if (phase === 'draft') {
				return {
					phase: 'draft',
					form: formDef,
					fields: deepClone(fieldValues),
					parties: deepClone(partyValues),
					annexes: deepClone(annexValues),
					signers: deepClone(signerValues),
					signatories: deepClone(signatoryValues),
					targetLayer,
				}
			}
			if (phase === 'signable') {
				return {
					phase: 'signable',
					form: formDef,
					fields: deepClone(fieldValues),
					parties: deepClone(partyValues),
					annexes: deepClone(annexValues),
					signers: deepClone(signerValues),
					signatories: deepClone(signatoryValues),
					captures: deepClone(captures),
					witnesses: deepClone(witnesses),
					attestations: deepClone(attestations),
					targetLayer,
					...(signatureMap && { signatureMap: deepClone(signatureMap) }),
					...(canonicalPdfHash && { canonicalPdfHash }),
				}
			}
			return {
				phase: 'executed',
				form: formDef,
				fields: deepClone(fieldValues),
				parties: deepClone(partyValues),
				annexes: deepClone(annexValues),
				signers: deepClone(signerValues),
				signatories: deepClone(signatoryValues),
				captures: deepClone(captures),
				witnesses: deepClone(witnesses),
				attestations: deepClone(attestations),
				targetLayer,
				executedAt: executedAt!,
			}
		},

		toYAML(): string {
			return toYAML(runtime.toJSON())
		},

		clone(): RuntimeForm<F> {
			// The resolver is behavior, not data: it is carried across rather
			// than cloned, because `structuredClone` cannot copy a function.
			const { resolver: _bound, ...cloneable } = config
			return createRuntimeForm({ ...structuredClone(cloneable), resolver } as RuntimeFormConfig<F>)
		},
	}

	// Cast to RuntimeForm<F> - the overloads will narrow this appropriately for consumers
	return runtime as unknown as RuntimeForm<F>
}

/**
 * Load a RuntimeForm from JSON.
 *
 * A resolver is behavior, not data, so it is not in the JSON: bind it here to
 * give the rehydrated form its file-backed layers back.
 */
export function runtimeFormFromJSON<F extends Form>(
	json: RuntimeFormJSON<F>,
	options?: ArtifactInstanceOptions,
): RuntimeForm<F> {
	// Type assertion needed because TypeScript can't narrow the config type based on json.phase alone
	// The RuntimeFormJSON union already constrains the valid combinations
	const config = {
		form: snapshotArtifactDefinition(json.form),
		fields: json.fields,
		parties: json.parties,
		annexes: json.annexes,
		signers: json.signers,
		signatories: json.signatories,
		targetLayer: json.targetLayer,
		resolver: options?.resolver,
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
function createFormInstance<F extends Form>(formDef: F, options?: ArtifactInstanceOptions): FormInstance<F> {
	const artifactMethods = withArtifactMethods(formDef)
	const resolver = options?.resolver

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
			assertValidArtifactDefinition(formDef)
			const checkRules = options?.rules !== false

			// Normalize data
			const fields = data.fields ?? {}
			const parties = data.parties ?? {}
			const annexes = data.annexes ?? {}
			const signers = data.signers ?? {}
			const signatories = data.signatories ?? {}

			const validated = validateCompleteFormData(formDef, { fields, parties, annexes })

			const targetLayer = formDef.defaultLayer || (formDef.layers ? Object.keys(formDef.layers)[0] : '') || ''

			const draft = createRuntimeForm({
				form: snapshotArtifactDefinition(formDef),
				fields: validated.fields,
				parties: validated.parties,
				annexes: validated.annexes,
				signers,
				signatories,
				targetLayer,
				resolver,
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

		partialFill(seed?: ProgressiveFormPayload<F>, options?: PartialFillOptions): DraftForm<F> {
			assertValidArtifactDefinition(formDef)
			const validate = options?.validate ?? 'patch'
			const checkRules = options?.rules === true

			const fields = (seed as Record<string, unknown> | undefined)?.fields ?? {}
			const parties = (seed as Record<string, unknown> | undefined)?.parties ?? {}
			const annexes = (seed as Record<string, unknown> | undefined)?.annexes ?? {}
			const signers = (seed as Record<string, unknown> | undefined)?.signers ?? {}
			const signatories = (seed as Record<string, unknown> | undefined)?.signatories ?? {}
			let validatedFields = mergePatchValues({}, fields as Record<string, unknown>)
			let validatedParties = mergePatchValues({}, parties as Record<string, Party | Party[]>)
			let validatedAnnexes = mergePatchValues({}, annexes as Record<string, unknown>)

			// Validate based on mode
			if (validate === 'patch') {
				if (Object.keys(fields as Record<string, unknown>).length > 0) {
					const fieldResult = validateProgressiveFieldsPatch(formDef, fields)
					if (!fieldResult.success) {
						throw new FormValidationError(fieldResult.errors)
					}
					validatedFields = mergePatchValues({}, fieldResult.value)
				}
				if (Object.keys(parties as Record<string, unknown>).length > 0) {
					const partyResult = validateProgressivePartiesPatch(formDef, parties)
					if (!partyResult.success) {
						throw new FormValidationError(partyResult.errors)
					}
					validatedParties = mergePatchValues({}, partyResult.value)
				}
				if (Object.keys(annexes as Record<string, unknown>).length > 0) {
					const annexResult = validateProgressiveAnnexesPatch(formDef, annexes)
					if (!annexResult.success) {
						throw new FormValidationError(annexResult.errors)
					}
					validatedAnnexes = mergePatchValues({}, annexResult.value)
				}
			} else if (validate === 'full') {
				const validated = validateCompleteFormData(formDef, {
					fields: fields as Record<string, unknown>,
					parties: parties as Record<string, Party | Party[]>,
					annexes: annexes as Record<string, unknown>,
				})
				validatedFields = validated.fields
				validatedParties = validated.parties
				validatedAnnexes = validated.annexes
			}
			// validate === 'none' → skip

			const targetLayer = formDef.defaultLayer || (formDef.layers ? Object.keys(formDef.layers)[0] : '') || ''

			const draft = createRuntimeForm({
				form: snapshotArtifactDefinition(formDef),
				fields: validatedFields,
				parties: validatedParties,
				annexes: validatedAnnexes,
				signers: signers as Record<string, Signer>,
				signatories: signatories as Record<string, Record<string, PartySignatory[]>>,
				targetLayer,
				resolver,
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

		safePartialFill(seed?: ProgressiveFormPayload<F>, options?: PartialFillOptions): SafePartialFillResult<F> {
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

		async render<Output = string | Uint8Array>(options: RenderOptions<Output> = {}): Promise<Output> {
			assertValidArtifactDefinition(formDef)
			const { renderer: rendererOverride, renderers, data = {}, layer: layerKey, bindings: optionsBindings } = options

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

			const renderer = selectLayerRenderer<Output>(key, layerSpec, rendererOverride, renderers)

			let bindings: Record<string, string> | undefined = layerSpec.bindings

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

			const template = await buildRendererLayer(key, layerSpec, bindings, resolver, 'artifact')

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
			}) as Output
		},

		clone(): FormInstance<F> {
			return createFormInstance(structuredClone(formDef), options)
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
	field<const K extends string, const D extends Buildable<FormField>>(
		id: K,
		fieldDef: D,
	): FormBuilderInterface<AddFormDefinition<TFields, K, D extends { build(): infer T extends FormField } ? T : D extends FormField ? D : FormField, FormField>, TParties, TAnnexes>
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
			signatureBlocks?: Record<string, SignatureBlock>
			anchorBlocks?: Record<string, AnchorBlock>
			signatures?: Record<string, SignatureSlot>
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
			signatureBlocks?: Record<string, SignatureBlock>
			anchorBlocks?: Record<string, AnchorBlock>
			signatures?: Record<string, SignatureSlot>
		},
	): FormBuilderInterface<TFields, TParties, TAnnexes>
	defaultLayer(key: string): FormBuilderInterface<TFields, TParties, TAnnexes>
	annex<const K extends string, const D extends Buildable<FormAnnex>>(
		annexId: K,
		annexDef: D,
	): FormBuilderInterface<TFields, TParties, AddFormDefinition<TAnnexes, K, D extends { build(): infer T extends FormAnnex } ? T : D extends FormAnnex ? D : FormAnnex, FormAnnex>>
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
	party<const K extends string, const D extends Buildable<FormParty>>(
		roleId: K,
		partyDef: D,
	): FormBuilderInterface<TFields, AddFormDefinition<TParties, K, D extends { build(): infer T extends FormParty } ? T : D extends FormParty ? D : FormParty, FormParty>, TAnnexes>
	parties<const P extends Record<string, Buildable<FormParty>>>(
		partiesObj: P,
	): FormBuilderInterface<
		TFields,
		{
			[K in keyof P]: P[K] extends Buildable<infer T extends FormParty> ? T : P[K] extends FormParty ? P[K] : FormParty
		},
		TAnnexes
	>
	build(options?: ArtifactInstanceOptions): FormInstance<
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

		field<const K extends string, const D extends Buildable<FormField>>(id: K, fieldDef: D) {
			const fields = (_def.fields as Record<string, Buildable<FormField>>) || {}
			fields[id] = fieldDef
			_def.fields = fields
			return builder as unknown as FormBuilderInterface<
				AddFormDefinition<TFields, K, D extends { build(): infer T extends FormField } ? T : D extends FormField ? D : FormField, FormField>,
				TParties,
				TAnnexes
			>
		},

		fields<const F extends Record<string, Buildable<FormField>>>(fieldsObj: F) {
			_def.fields = { ...fieldsObj }
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

		annex<const K extends string, const D extends Buildable<FormAnnex>>(annexId: K, annexDef: D) {
			const annexes = (_def.annexes as Record<string, FormAnnex>) || {}
			annexes[annexId] = parseFormAnnex(resolveBuildable(annexDef))
			_def.annexes = annexes
			return builder as unknown as FormBuilderInterface<
				TFields,
				TParties,
				AddFormDefinition<TAnnexes, K, D extends { build(): infer T extends FormAnnex } ? T : D extends FormAnnex ? D : FormAnnex, FormAnnex>
			>
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

		party<const K extends string, const D extends Buildable<FormParty>>(roleId: K, partyDef: D) {
			const parties = (_def.parties as Record<string, FormParty>) || {}
			parties[roleId] = parseFormParty(resolveBuildable(partyDef))
			_def.parties = parties
			return builder as unknown as FormBuilderInterface<
				TFields,
				AddFormDefinition<TParties, K, D extends { build(): infer T extends FormParty } ? T : D extends FormParty ? D : FormParty, FormParty>,
				TAnnexes
			>
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

		build(options?: ArtifactInstanceOptions) {
			const cleaned: Record<string, unknown> = { ...(_def as object) }
			const fields = _def.fields as Record<string, Buildable<FormField>> | undefined
			if (fields) {
				cleaned.fields = Object.fromEntries(
					Object.entries(fields).map(([id, fieldDef]) => [id, parseFormField(resolveBuildable(fieldDef))]),
				)
			}
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
				options,
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
	<const T extends FormInput>(input: T, options?: ArtifactInstanceOptions): FormInstance<T & { kind: 'form' }>
	from(input: unknown, options?: ArtifactInstanceOptions): FormInstance<Form>
	safeFrom(
		input: unknown,
		options?: ArtifactInstanceOptions,
	): { success: true; data: FormInstance<Form> } | { success: false; error: Error }
}

function formImpl(): FormBuilderInterface
function formImpl<const T extends FormInput>(input: T, options?: ArtifactInstanceOptions): FormInstance<T & { kind: 'form' }>
function formImpl<const T extends FormInput>(
	input?: T,
	options?: ArtifactInstanceOptions,
): FormBuilderInterface | FormInstance<T & { kind: 'form' }> {
	if (input !== undefined) {
		const withKind = { ...input, kind: 'form' as const }
		const parsed = parseForm(withKind) as T & { kind: 'form' }
		return createFormInstance(parsed, options)
	}
	return createFormBuilder()
}

export const form: FormAPI = Object.assign(formImpl, {
	from: (input: unknown, options?: ArtifactInstanceOptions): FormInstance<Form> => {
		const parsed = parseForm(input) as Form
		return createFormInstance(parsed, options)
	},
	safeFrom: (
		input: unknown,
		options?: ArtifactInstanceOptions,
	): { success: true; data: FormInstance<Form> } | { success: false; error: Error } => {
		try {
			const parsed = parseForm(input) as Form
			return { success: true, data: createFormInstance(parsed, options) }
		} catch (err) {
			return { success: false, error: err as Error }
		}
	},
})
