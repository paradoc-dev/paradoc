/**
 * Closure-based builders for artifacts.
 *
 * This module provides all form-related builders using the closure/object pattern
 * instead of JavaScript classes. This makes artifacts completely independent
 * from the class-based artifacts/ implementation.
 */

// Re-export all builders
export {
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
	type FieldAPI,
	type TextFieldBuilder,
	type BooleanFieldBuilder,
	type NumberFieldBuilder,
	type CoordinateFieldBuilder,
	type BboxFieldBuilder,
	type MoneyFieldBuilder,
	type AddressFieldBuilder,
	type PhoneFieldBuilder,
	type DurationFieldBuilder,
	type EmailFieldBuilder,
	type UuidFieldBuilder,
	type UriFieldBuilder,
	type EnumFieldBuilder,
	type DateFieldBuilder,
	type DatetimeFieldBuilder,
	type TimeFieldBuilder,
	type PersonFieldBuilder,
	type OrganizationFieldBuilder,
	type IdentificationFieldBuilder,
	type MultiselectFieldBuilder,
	type PercentageFieldBuilder,
	type RatingFieldBuilder,
	type FieldsetFieldBuilder,
} from './field';

export {
	party,
	partyBuilder,
	type PartyAPI,
	type PartyBuilder,
} from './party';

export {
	fieldset,
	fieldsetBuilder,
	type FieldsetAPI,
	type FieldsetBuilder,
} from './fieldset';

export {
	layer,
	fileLayer,
	inlineLayer,
	layerBuilder,
	type LayerAPI,
	type FileLayerBuilderType,
	type InlineLayerBuilderType,
	type LayerBuilderType,
} from './layer';

export {
	annex,
	annexBuilder,
	type AnnexAPI,
	type AnnexBuilder,
} from './annex';

// Note: The complete `open` namespace is exported from artifacts/index.ts
// which includes form, document, checklist, and bundle in addition to these builders
