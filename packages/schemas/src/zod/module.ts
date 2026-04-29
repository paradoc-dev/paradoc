import { z } from 'zod';

// Artifacts
import { FormSchema } from './artifacts/form';
import { DocumentSchema } from './artifacts/document';
import { BundleSchema, BundleContentItemSchema } from './artifacts/bundle';
import { ChecklistSchema, ChecklistItemSchema } from './artifacts/checklist';

// Form blocks (design-time)
import { FormFieldSchema, FieldsetFieldSchema } from './artifacts/form/field';
import { FormAnnexSchema } from './artifacts/form/annex';
import { FormPartySchema } from './artifacts/form/party';
import { FormFieldsetSchema } from './artifacts/form/fieldset';

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

// Register all schemas with their IDs for $ref generation
ParadocRegistry.add(FormSchema, { id: 'Form' });
ParadocRegistry.add(DocumentSchema, { id: 'Document' });
ParadocRegistry.add(BundleSchema, { id: 'Bundle' });
ParadocRegistry.add(ChecklistSchema, { id: 'Checklist' });
ParadocRegistry.add(BundleContentItemSchema, { id: 'BundleContentItem' });
ParadocRegistry.add(ChecklistItemSchema, { id: 'ChecklistItem' });

ParadocRegistry.add(FormFieldSchema, { id: 'FormField' });
// FieldsetFieldSchema already has id via .meta({ id: 'FieldsetField' }) - no need to add again
ParadocRegistry.add(FormAnnexSchema, { id: 'FormAnnex' });
ParadocRegistry.add(FormPartySchema, { id: 'FormParty' });
ParadocRegistry.add(FormFieldsetSchema, { id: 'FormFieldset' });

// Note: ContentRefSchema is NOT registered separately because ArtifactSchema already
// includes it as a field. Registering it separately causes Zod v4 $ref bugs.
ParadocRegistry.add(LayerSchema, { id: 'Layer' });

ParadocRegistry.add(AddressSchema, { id: 'Address' });
ParadocRegistry.add(AttachmentSchema, { id: 'Attachment' });
ParadocRegistry.add(BboxSchema, { id: 'Bbox' });
ParadocRegistry.add(CoordinateSchema, { id: 'Coordinate' });
ParadocRegistry.add(DurationSchema, { id: 'Duration' });
ParadocRegistry.add(IdentificationSchema, { id: 'Identification' });
ParadocRegistry.add(MoneySchema, { id: 'Money' });
ParadocRegistry.add(MetadataSchema, { id: 'Metadata' });
ParadocRegistry.add(OrganizationSchema, { id: 'Organization' });
ParadocRegistry.add(PersonSchema, { id: 'Person' });
ParadocRegistry.add(PhoneSchema, { id: 'Phone' });
ParadocRegistry.add(SignatureSchema, { id: 'Signature' });

ParadocRegistry.add(CondExprSchema, { id: 'CondExpr' });
ParadocRegistry.add(DefsSectionSchema, { id: 'DefsSection' });

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

ParadocRegistry.add(ParadocSchema, { id: 'Paradoc' });

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
	FormAnnexSchema,
	FormPartySchema,
	FormFieldsetSchema,

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
