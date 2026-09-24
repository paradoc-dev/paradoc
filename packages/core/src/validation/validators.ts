/**
 * Runtime Zod Validators
 *
 * Each validator checks a value against its schema in `@paradoc/schemas` and
 * returns a Standard Schema result: `{ value }`, or `{ issues }`.
 */

import {
	FormSchema,
	DocumentSchema,
	BundleSchema,
	ChecklistSchema,
	BundleContentItemSchema,
	ChecklistItemSchema,
	FormFieldSchema,
	FormAnnexSchema,
	FormPartySchema,
	LayerSchema,
	SignatureSchema,
	AttachmentSchema,
	AddressSchema,
	BboxSchema,
	CoordinateSchema,
	DurationSchema,
	IdentificationSchema,
	MetadataSchema,
	MoneySchema,
	OrganizationSchema,
	PersonSchema,
	PhoneSchema,
	RuntimeOrganizationSchema,
	RuntimePersonSchema,
} from '@paradoc/schemas'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
	Address,
	Attachment,
	Bbox,
	Bundle,
	BundleContentItem,
	Checklist,
	ChecklistItem,
	Coordinate,
	Document,
	Duration,
	Form,
	FormAnnex,
	FormField,
	FormParty,
	Identification,
	Layer,
	Metadata,
	Money,
	Organization,
	Person,
	Phone,
	Signature,
} from '@paradoc/types'
import type { ZodType } from 'zod'
import { findSchemaVersionError } from '@/serialization/schema-version'
import { zodIssues } from './zod-parser'

/** Checks a value against one schema. */
export type Validator<T> = (data: unknown) => StandardSchemaV1.Result<T>

function createValidator<T>(schema: ZodType): Validator<T> {
	return (data) => {
		const result = schema.safeParse(data)
		return result.success ? { value: result.data as T } : { issues: zodIssues(result.error) }
	}
}

/**
 * A validator for a whole artifact. It applies the one schema version rule
 * every artifact entry point applies: a `$schema` the artifact declares, on
 * the root or on an inline bundle part, must be current.
 */
function createArtifactValidator<T>(schema: ZodType): Validator<T> {
	const validateStructure = createValidator<T>(schema)
	return (data) => {
		const versionError = findSchemaVersionError(data, { required: false })
		if (versionError) return { issues: [{ message: versionError.message, path: [...versionError.path] }] }
		return validateStructure(data)
	}
}

// Artifacts
export const validateForm = createArtifactValidator<Form>(FormSchema)
export const validateDocument = createArtifactValidator<Document>(DocumentSchema)
export const validateBundle = createArtifactValidator<Bundle>(BundleSchema)
export const validateChecklist = createArtifactValidator<Checklist>(ChecklistSchema)

// Blocks (design-time form components)
export const validateFormField = createValidator<FormField>(FormFieldSchema)
export const validateFormAnnex = createValidator<FormAnnex>(FormAnnexSchema)
export const validateFormParty = createValidator<FormParty>(FormPartySchema)
export const validateLayer = createValidator<Layer>(LayerSchema)
export const validateChecklistItem = createValidator<ChecklistItem>(ChecklistItemSchema)
export const validateBundleContentItem = createValidator<BundleContentItem>(BundleContentItemSchema)

// Runtime types
export const validateSignature = createValidator<Signature>(SignatureSchema)
export const validateAttachment = createValidator<Attachment>(AttachmentSchema)

// Primitives
export const validateAddress = createValidator<Address>(AddressSchema)
export const validateBbox = createValidator<Bbox>(BboxSchema)
export const validateCoordinate = createValidator<Coordinate>(CoordinateSchema)
export const validateDuration = createValidator<Duration>(DurationSchema)
export const validateIdentification = createValidator<Identification>(IdentificationSchema)
export const validateMetadata = createValidator<Metadata>(MetadataSchema)
export const validateMoney = createValidator<Money>(MoneySchema)
export const validateOrganization = createValidator<Organization>(OrganizationSchema)
export const validatePerson = createValidator<Person>(PersonSchema)
export const validatePhone = createValidator<Phone>(PhoneSchema)

// Party data: a Person or Organization with the `id` the fill assigns it
export const validateRuntimeOrganization = createValidator<Organization & { id: string }>(RuntimeOrganizationSchema)
export const validateRuntimePerson = createValidator<Person & { id: string }>(RuntimePersonSchema)
