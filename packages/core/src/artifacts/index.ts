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
export { withArtifactMethods, renderLayer, resolveLayerKey, resolveAndRenderLayer } from './shared'
export type { ArtifactMethods, LayerRenderOptions } from './shared'

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
	// Party builder
	party,
	partyBuilder,
	// Fieldset builder
	fieldset,
	fieldsetBuilder,
	// Layer builders
	layer,
	fileLayer,
	inlineLayer,
	layerBuilder,
	// Annex builder
	annex,
	annexBuilder,
} from './builders'

// Import builders for para namespace construction
import {
	field,
	party,
	fieldset,
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
	// Party builder types
	PartyAPI,
	PartyBuilder,
	// Fieldset builder types
	FieldsetAPI,
	FieldsetBuilder,
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
export { checklist, runtimeChecklistFromJSON } from './checklist'
export type {
	ChecklistInstance,
	RuntimeChecklist,
	DraftChecklist,
	CompletedChecklist,
	ChecklistInput,
	RuntimeChecklistJSON,
	InferChecklistPayload,
	ItemStatusToDataType,
	ItemsToDataType,
	ChecklistBuilderInterface,
} from './checklist'

// Form artifact
export { form, runtimeFormFromJSON, FormValidationError, FormRuleViolationError } from './form'
export type {
	FormInstance,
	RuntimeForm,
	DraftForm,
	SignableForm,
	ExecutedForm,
	FormInput,
	RuntimeFormJSON,
	InferFormPayload,
	ExtractFields,
	FieldKeys,
	PartyRoleKeys,
	CaptureOptions,
	FormBuilderInterface,
	FillValidationOptions,
	SafeFillResult,
	SafePartialFillResult,
	FormValidationResult,
} from './form'

// Bundle artifact
export { bundle, runtimeBundleFromJSON } from './bundle'
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

// Import artifacts for para namespace
import { form } from './form'
import { document } from './document'
import { checklist } from './checklist'
import { bundle } from './bundle'

// Import load from serialization for para namespace
import { load, safeLoad } from '../serialization'

// Import primitives for para namespace top-level
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
 * The `para` namespace provides a unified API for building Paradoc artifacts.
 *
 * This is the recommended entry point. It exposes:
 * - Artifact builders: `para.form()`, `para.document()`, `para.checklist()`, `para.bundle()`
 * - Field builders: `para.field.*` (for composing fields in forms)
 * - Primitive parsers: `para.money(...)`, `para.percentage(...)`, etc. (for parsing/validating raw values)
 * - Loaders: `para.load()`, `para.safeLoad()` (for loading artifacts from JSON/YAML)
 *
 * @example Build a form
 * ```ts
 * import { para } from '@paradoc/core';
 *
 * const leaseForm = para.form()
 *   .name('lease-agreement')
 *   .parties({
 *     landlord: para.party().label('Landlord').signature({ required: true }),
 *     tenant: para.party().label('Tenant').signature({ required: true }),
 *   })
 *   .fields({
 *     address: para.field.address().label('Property Address').required(),
 *     monthlyRent: para.field.money().label('Monthly Rent').required(),
 *   })
 *   .build();
 * ```
 *
 * @example Parse primitives directly
 * ```ts
 * const pct = para.percentage(75.5);
 * const amount = para.money.parse(userInput);
 * ```
 */
export const para = {
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

	// Fieldset builder for grouping fields
	fieldset,

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

export type Paradoc = typeof para
