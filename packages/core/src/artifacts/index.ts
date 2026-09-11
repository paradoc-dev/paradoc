/**
 * Artifacts-2: Closure-based artifact implementations
 *
 * This module provides closure-based implementations of Paradoc artifacts,
 * replacing the class-based implementations with factory functions and composition.
 *
 * Key benefits:
 * - Reduced code duplication through shared render-layer and artifact-methods utilities
 * - Unified runtime objects (RuntimeDocument, RuntimeChecklist) instead of separate draft/final classes
 * - No class inheritance, just composition via withArtifactMethods()
 * - Smaller bundle size due to eliminated class overhead
 * - Complete independence from artifacts/ - no imports from class-based implementations
 */

// Shared utilities
export { withArtifactMethods, renderLayer, resolveLayerKey, resolveAndRenderLayer, UnboundResolverError } from './shared'
export type {
	ArtifactMethods,
	ArtifactInstanceOptions,
	ArtifactLayerRenderOptions,
	LayerRenderOptions,
	ResolverBindingSite,
} from './shared'
export type {
	RuntimeAsOfInput,
	RuntimeContext,
	RuntimeContextOptions,
	RuntimeCreationOptions,
} from './shared/runtime-context'

// Closure-based builders (independent from artifacts/)
export {
	// Field builders
	field,
	textField,
	booleanField,
	numberField,
	coordinateField,
	bboxField,
	moneyField,
	addressField,
	phoneField,
	durationField,
	emailField,
	uuidField,
	uriField,
	enumField,
	dateField,
	datetimeField,
	timeField,
	personField,
	organizationField,
	identificationField,
	multiselectField,
	percentageField,
	ratingField,
	fieldsetField,
	listField,
	// Party builder
	party,
	partyBuilder,
	// Layer builders
	layer,
	fileLayer,
	inlineLayer,
	layerBuilder,
	// Annex builder
	annex,
	annexBuilder,
} from './builders'

// Import builders for p namespace construction
import {
	field,
	party,
	layer,
	annex,
} from './builders'

export type {
	// Field builder types
	FieldAPI,
	TextFieldBuilder,
	BooleanFieldBuilder,
	NumberFieldBuilder,
	CoordinateFieldBuilder,
	BboxFieldBuilder,
	MoneyFieldBuilder,
	AddressFieldBuilder,
	PhoneFieldBuilder,
	DurationFieldBuilder,
	EmailFieldBuilder,
	UuidFieldBuilder,
	UriFieldBuilder,
	EnumFieldBuilder,
	DateFieldBuilder,
	DatetimeFieldBuilder,
	TimeFieldBuilder,
	PersonFieldBuilder,
	OrganizationFieldBuilder,
	IdentificationFieldBuilder,
	MultiselectFieldBuilder,
	PercentageFieldBuilder,
	RatingFieldBuilder,
	FieldsetFieldBuilder,
	ListFieldBuilder,
	// Party builder types
	PartyAPI,
	PartyBuilder,
	// Layer builder types
	LayerAPI,
	FileLayerBuilderType,
	InlineLayerBuilderType,
	LayerBuilderType,
	// Annex builder types
	AnnexAPI,
	AnnexBuilder,
} from './builders'

// Document artifact
export { document, runtimeDocumentFromJSON } from './document'
export type { DocumentInstance, RuntimeDocument, DraftDocument, FinalDocument, DocumentInput, RuntimeDocumentJSON, DocumentBuilderInterface } from './document'

// Checklist artifact
export { checklist, runtimeChecklistFromJSON, ChecklistValidationError } from './checklist'
export type {
	ChecklistInstance,
	RuntimeChecklist,
	DraftChecklist,
	CompletedChecklist,
	ChecklistInput,
	RuntimeChecklistJSON,
	InferChecklistPayload,
	ProgressiveChecklistPayload,
	ChecklistPath,
	ChecklistFillOptions,
	ChecklistUpdateOptions,
	ChecklistValidationResult,
	ChecklistFillTarget,
	ChecklistFillItemState,
	ChecklistFillState,
	ItemStatusToDataType,
	ItemsToDataType,
	ChecklistBuilderInterface,
} from './checklist'

// Form artifact
export { form, runtimeFormFromJSON, FormValidationError, FormRuleViolationError } from './form'
export { SealConfigError, buildSlotPlan, compileLegacySignatureSlots } from './form'
export type { SlotPlan } from './form'
export type { PlacementProvenance, SealPreparation } from './form'
export type {
	FormInstance,
	RuntimeForm,
	DraftForm,
	SignableForm,
	ExecutedForm,
	FormInput,
	RuntimeFormJSON,
	InferFormPayload,
	ProgressiveFormPayload,
	FormPath,
	ExtractFields,
	FieldKeys,
	PartyRoleKeys,
	CaptureOptions,
	SealOptions,
	FormBuilderInterface,
	SafeFillResult,
	FormValidationResult,
} from './form'

// Bundle artifact
export { bundle, runtimeBundleFromJSON } from './bundle'
export {
	assertBundleInclusionResolved,
	decisionForKey,
	evaluateBundleInclusion,
	includedRuntimeContents,
} from './bundle/inclusion'
export type {
	BundleBytesMember,
	BundleEvaluationMember,
	BundleInclusionDecision,
	BundleInclusionState,
	BundleInclusionStatus,
	BundleRuntimeMember,
} from './bundle/inclusion'
export type {
	BundleInstance,
	RuntimeBundle,
	DraftBundle,
	SignableBundle,
	ExecutedBundle,
	BundleInput,
	RuntimeBundleJSON,
	RuntimeInstance,
	RuntimeBundleContents,
	RuntimeBundleRenderOptions,
	RuntimeBundleRenderedOutput,
	RuntimeBundleRendered,
	BundleBuilderInterface,
} from './bundle'

// Import artifacts for p namespace
import { form } from './form'
import { document } from './document'
import { checklist } from './checklist'
import { bundle } from './bundle'

// Import load from serialization for p namespace
import { load, safeLoad } from '../serialization'

// Import primitives for p namespace top-level
import {
	address,
	attachment,
	bbox,
	coordinate,
	date,
	datetime,
	duration,
	identification,
	metadata,
	money,
	organization,
	percentage,
	person,
	phone,
	rating,
	signature,
	time,
} from '../primitives'

/**
 * The `p` namespace provides a unified API for building Paradoc artifacts.
 *
 * This is the recommended entry point. It exposes:
 * - Artifact builders: `p.form()`, `p.document()`, `p.checklist()`, `p.bundle()`
 * - Field builders: `p.field.*` (for composing fields in forms)
 * - Primitive parsers: `p.money(...)`, `p.percentage(...)`, etc. (for parsing/validating raw values)
 * - Loaders: `p.load()`, `p.safeLoad()` (for loading artifacts from JSON/YAML)
 *
 * @example Build a form
 * ```ts
 * import { p } from '@paradoc/core';
 *
 * const leaseForm = p.form()
 *   .name('lease-agreement')
 *   .parties({
 *     landlord: p.party().label('Landlord').signature({ required: true }),
 *     tenant: p.party().label('Tenant').signature({ required: true }),
 *   })
 *   .fields({
 *     address: p.field.address().label('Property Address').required(),
 *     monthlyRent: p.field.money().label('Monthly Rent').required(),
 *   })
 *   .build();
 * ```
 *
 * @example Parse primitives directly
 * ```ts
 * const pct = p.percentage(75.5);
 * const amount = p.money.parse(userInput);
 * ```
 */
export const p = {
	// Artifacts
	form,
	document,
	checklist,
	bundle,

	// Load artifacts from JSON/YAML strings
	load,
	safeLoad,

	// Party role builder
	party,

	// Field builders for all supported field types
	field: {
		...field,
		text: field.text,
		boolean: field.boolean,
		number: field.number,
		coordinate: field.coordinate,
		bbox: field.bbox,
		money: field.money,
		address: field.address,
		phone: field.phone,
		duration: field.duration,
		email: field.email,
		uuid: field.uuid,
		uri: field.uri,
		enum: field.enum,
		date: field.date,
		datetime: field.datetime,
		time: field.time,
		person: field.person,
		organization: field.organization,
		identification: field.identification,
		multiselect: field.multiselect,
		percentage: field.percentage,
		rating: field.rating,
		fieldset: field.fieldset,
	},

	// Annex/attachment slot builder
	annex,

	// Layer builders for content layers
	layer,

	// Primitive parsers at top level (callable with validation/parse methods attached)
	address,
	attachment,
	bbox,
	coordinate,
	date,
	datetime,
	duration,
	identification,
	metadata,
	money,
	organization,
	percentage,
	person,
	phone,
	rating,
	signature,
	time,
} as const

export type Paradoc = typeof p
