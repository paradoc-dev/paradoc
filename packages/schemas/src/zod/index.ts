// Config
export { SCHEMA_VERSION, SCHEMA_BASE, SCHEMA_ROOT_ID, SCHEMA_VERSIONED_ID, schemaId } from './config';

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
	FormFieldsetSchema,
} from './module';

// Field types
export { FieldsetFieldSchema } from './artifacts/form/field';

// Shared
export { ArtifactSchema } from './artifacts/shared/base';
export { ContentRefSchema } from './artifacts/shared/content-ref';
export { LayerSchema, SignatureBlockSchema, SignatureBlockTypeSchema } from './artifacts/shared/layer';

// Primitives
export {
	AddressSchema,
	AttachmentSchema,
	BboxSchema,
	CoordinateSchema,
	DurationSchema,
	IdentificationSchema,
	MoneySchema,
	MetadataSchema,
	OrganizationSchema,
	PersonSchema,
	PhoneSchema,
	SignatureSchema,
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

export type {
	ScalarExpressionType,
	ObjectExpressionType,
	ExpressionType,
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
	GlobalArtifactOutputFormatSchema,
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
	GlobalArtifactOutputFormat,
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
export { ManifestSchema, ArtifactOutputFormatSchema } from './manifest';
export type { Manifest, ManifestRegistryEntry, ManifestArtifactConfig, ArtifactOutputFormat } from './manifest';
