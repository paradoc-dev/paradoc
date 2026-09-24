// Config
export {
	SCHEMA_VERSIONS,
	SCHEMA_VERSION,
	SCHEMA_BASE,
	SCHEMA_ROOT_ID,
	SCHEMA_VERSIONED_ID,
	schemaId,
	schemaVersionUrl,
	isSchemaVersion,
	readSchemaAddress,
} from './config';
export type { SchemaVersion, SchemaAddress } from './config';

// Module and Registry
export { ParadocSchema, ParadocRegistry } from './module';

// Artifacts
export {
	FormSchema,
	DocumentSchema,
	BundleSchema,
	ChecklistSchema,
	BundleContentItemSchema,
	ChecklistItemSchema,
} from './module';

// Form blocks
export {
	FormFieldSchema,
	FormAnnexSchema,
	FormPartySchema,
} from './module';

// Field types
export { FieldsetFieldSchema, FORM_FIELD_TYPES } from './artifacts/form/field';
export type { FormFieldType } from './artifacts/form/field';
export { ListFieldSchema } from './artifacts/form/list';
export {
	FieldPatternSchema,
	MAX_PATTERN_LENGTH,
	describePatternProblem,
	findPatternProblem,
} from './artifacts/form/pattern';
export type { PatternProblem } from './artifacts/form/pattern';

// Shared
export { ArtifactSchema } from './artifacts/shared/base';
export { ContentRefSchema } from './artifacts/shared/content-ref';
export { LayerSchema, SignatureSlotSchema, SignatureSlotTypeSchema } from './artifacts/shared/layer';
export {
	DOCX_MIME_TYPE,
	isDocxMimeType,
	isPdfMimeType,
	isReactLayerMimeType,
	isTextTemplateMimeType,
	TEXT_TEMPLATE_MIME_TYPES,
	LAYER_BINDINGS_RULE,
	REACT_LAYER_MIME_PATTERN,
	REACT_LAYER_MIME_TYPES,
	REACT_LAYER_RULE,
	REACT_LAYER_FORM_ONLY_RULE,
} from './artifacts/shared/layer';

// Primitives
export {
	AddressSchema,
	AttachmentSchema,
	BboxSchema,
	ChecksumSchema,
	CoordinateSchema,
	DurationSchema,
	ISO_8601_DURATION_PATTERN,
	ISO_8601_DURATION_REGEX,
	IdentificationSchema,
	CurrencyCodeSchema,
	MoneySchema,
	MetadataSchema,
	OrganizationSchema,
	PersonSchema,
	PhoneSchema,
	RuntimeOrganizationSchema,
	RuntimePersonSchema,
	SignatureSchema,
	ARTIFACT_NAME_PATTERN,
	ARTIFACT_REFERENCE_PATTERN,
	ARTIFACT_VERSION_PATTERN,
	REGISTRY_NAMESPACE_PATTERN,
} from './primitives';

// Expressions
export {
	CondExprSchema,
	DefsSectionSchema,
	ExpressionSchema,
	SCALAR_EXPRESSION_TYPES,
	OBJECT_EXPRESSION_TYPES,
	ALL_EXPRESSION_TYPES,
} from './artifacts/expressions';

// Rules (form-level validation)
export {
	ValidationRuleSchema,
	RuleSeveritySchema,
	RulesSectionSchema,
} from './artifacts/rules';

// Registry schemas
export {
	GlobalConfigSchema,
	GlobalDefaultsSchema,
	ArtifactOutputFormatSchema,
	RegistryCacheConfigSchema,
	RegistryEntrySchema,
	RegistryEntryObjectSchema,
	LockFileSchema,
	LockedArtifactSchema,
	LockedLayerSchema,
	RegistryIndexSchema,
	RegistryItemSummarySchema,
	RegistryItemSchema,
	RegistryLayerSchema,
	RegistryInlineLayerSchema,
	RegistryFileLayerSchema,
} from './registry';

export type {
	GlobalConfig,
	GlobalDefaults,
	ArtifactOutputFormat,
	RegistryCacheConfig,
	RegistryEntry,
	RegistryEntryObject,
	LockFile,
	LockedArtifact,
	LockedLayer,
	RegistryIndex,
	RegistryItemSummary,
	RegistryItem,
	RegistryLayer,
	RegistryInlineLayer,
	RegistryFileLayer,
} from './registry';

// Manifest
export { ManifestSchema } from './manifest';
export type { Manifest, ManifestArtifactConfig } from './manifest';
