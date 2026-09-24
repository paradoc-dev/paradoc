import { z } from 'zod';

// Artifacts
import { FormSchema } from './artifacts/form';
import { DocumentSchema } from './artifacts/document';
import { BundleSchema, BundleContentItemSchema } from './artifacts/bundle';
import { ChecklistSchema, ChecklistItemSchema } from './artifacts/checklist';

// Form blocks (design-time)
import { FormFieldSchema, FieldsetFieldSchema } from './artifacts/form/field';
import { ListFieldSchema } from './artifacts/form/list';
import { FormAnnexSchema } from './artifacts/form/annex';
import { FormPartySchema } from './artifacts/form/party';

// Shared
import { ContentRefSchema } from './artifacts/shared/content-ref';
import { LayerSchema } from './artifacts/shared/layer';

// Primitives
import { AddressSchema } from './primitives/address';
import { AttachmentSchema } from './primitives/attachment';
import { BboxSchema } from './primitives/bbox';
import { CoordinateSchema } from './primitives/coordinate';
import { DurationSchema } from './primitives/duration';
import { IdentificationSchema } from './primitives/identification';
import { MoneySchema } from './primitives/money';
import { MetadataSchema } from './primitives/metadata';
import { OrganizationSchema } from './primitives/organization';
import { PersonSchema } from './primitives/person';
import { PhoneSchema } from './primitives/phone';
import { SignatureSchema } from './primitives/signature';

// Expressions
import { CondExprSchema } from './artifacts/expressions/cond-expr';
import { DefsSectionSchema } from './artifacts/expressions/defs-section';

// Rules
import { ValidationRuleSchema, RuleSeveritySchema } from './artifacts/rules/validation-rule';
import { RulesSectionSchema } from './artifacts/rules/rules-section';

/**
 * Paradoc Schema Registry
 *
 * This registry contains all Paradoc schemas with their metadata (id, title, description).
 * Use z.toJSONSchema(ParadocRegistry) to generate JSON Schema with proper $refs.
 */
export const ParadocRegistry = z.globalRegistry;

/**
 * Register a schema under its id. `add` replaces a schema's metadata, so the
 * title and description its `.meta()` set are carried over with the id.
 */
function register(schema: z.ZodType, id: string): void {
	ParadocRegistry.add(schema, { ...schema.meta(), id });
}

// Register all schemas with their IDs for $ref generation
register(FormSchema, 'Form');
register(DocumentSchema, 'Document');
register(BundleSchema, 'Bundle');
register(ChecklistSchema, 'Checklist');
register(BundleContentItemSchema, 'BundleContentItem');
register(ChecklistItemSchema, 'ChecklistItem');

register(FormFieldSchema, 'FormField');
// FieldsetFieldSchema and ListFieldSchema set their id in their own .meta().
register(FormAnnexSchema, 'FormAnnex');
register(FormPartySchema, 'FormParty');

// Note: ContentRefSchema is NOT registered separately because ArtifactSchema already
// includes it as a field. Registering it separately causes Zod v4 $ref bugs.
// The layer's own metadata carries the font and format rules' JSON Schema form.
register(LayerSchema, 'Layer');

register(AddressSchema, 'Address');
register(AttachmentSchema, 'Attachment');
register(BboxSchema, 'Bbox');
register(CoordinateSchema, 'Coordinate');
register(DurationSchema, 'Duration');
register(IdentificationSchema, 'Identification');
register(MoneySchema, 'Money');
register(MetadataSchema, 'Metadata');
register(OrganizationSchema, 'Organization');
register(PersonSchema, 'Person');
register(PhoneSchema, 'Phone');
register(SignatureSchema, 'Signature');

register(CondExprSchema, 'CondExpr');
register(DefsSectionSchema, 'DefsSection');

// Note: RulesSectionSchema is NOT registered separately because FormSchema already
// includes it as a field. Registering it separately causes Zod v4 $ref bugs.
// The rules section is inlined as part of FormSchema.

/**
 * Paradoc root schema - union of all artifact types
 */
export const ParadocSchema = z.union([
	FormSchema,
	DocumentSchema,
	ChecklistSchema,
	BundleSchema,
]).meta({
	title: 'Paradoc',
	description: 'Root schema for any Paradoc artifact document',
});

register(ParadocSchema, 'Paradoc');

// Export all schemas for direct import
export {
	// Artifacts
	FormSchema,
	DocumentSchema,
	BundleSchema,
	ChecklistSchema,
	BundleContentItemSchema,
	ChecklistItemSchema,

	// Form blocks
	FormFieldSchema,
	FieldsetFieldSchema,
	ListFieldSchema,
	FormAnnexSchema,
	FormPartySchema,

	// Shared
	ContentRefSchema,
	LayerSchema,

	// Primitives
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

	// Expressions
	CondExprSchema,
	DefsSectionSchema,

	// Rules
	ValidationRuleSchema,
	RuleSeveritySchema,
	RulesSectionSchema,
};
