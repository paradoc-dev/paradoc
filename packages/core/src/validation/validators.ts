/**
 * Runtime Zod Validators
 *
 * These validators use Zod schemas from @paradoc/schemas for validation.
 * Each validator exposes a .errors property after validation for error access.
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
import type { ZodSchema, ZodError } from 'zod'

/**
 * Validation error format compatible with AJV
 */
export interface ValidatorError {
	instancePath: string
	message: string
	keyword: string
	params?: Record<string, unknown>
	data?: unknown
}

/**
 * Create a validator function from a Zod schema
 * The validator exposes .errors property after validation
 */
function createValidator<T>(
	schema: ZodSchema<T>
): ((data: unknown) => boolean) & { errors?: ValidatorError[] } {
	const fn = function (data: unknown): boolean {
		const result = schema.safeParse(data)

		if (result.success) {
			;(fn as { errors?: ValidatorError[] }).errors = undefined
			return true
		}

		// Map Zod errors to AJV-compatible format
		;(fn as { errors?: ValidatorError[] }).errors = mapZodErrors(result.error)
		return false
	} as ((data: unknown) => boolean) & { errors?: ValidatorError[] }

	return fn
}

/**
 * Map Zod errors to AJV-compatible format
 */
function mapZodErrors(error: ZodError): ValidatorError[] {
	return error.issues.map((issue) => {
		const path = issue.path.join('/')
		return {
			instancePath: path ? `/${path}` : '',
			message: issue.message,
			keyword: issue.code,
			params: 'expected' in issue ? { expected: issue.expected } : undefined,
			data: 'received' in issue ? issue.received : undefined,
		}
	})
}

// Artifacts
export const validateForm = createValidator(FormSchema)
export const validateDocument = createValidator(DocumentSchema)
export const validateBundle = createValidator(BundleSchema)
export const validateChecklist = createValidator(ChecklistSchema)

// Blocks (design-time form components)
export const validateFormField = createValidator(FormFieldSchema)
export const validateFormAnnex = createValidator(FormAnnexSchema)
export const validateFormParty = createValidator(FormPartySchema)
export const validateLayer = createValidator(LayerSchema)
export const validateChecklistItem = createValidator(ChecklistItemSchema)
export const validateBundleContentItem = createValidator(BundleContentItemSchema)

// Runtime types
export const validateSignature = createValidator(SignatureSchema)
export const validateAttachment = createValidator(AttachmentSchema)

// Primitives
export const validateAddress = createValidator(AddressSchema)
export const validateBbox = createValidator(BboxSchema)
export const validateCoordinate = createValidator(CoordinateSchema)
export const validateDuration = createValidator(DurationSchema)
export const validateIdentification = createValidator(IdentificationSchema)
export const validateMetadata = createValidator(MetadataSchema)
export const validateMoney = createValidator(MoneySchema)
export const validateOrganization = createValidator(OrganizationSchema)
export const validatePerson = createValidator(PersonSchema)
export const validatePhone = createValidator(PhoneSchema)

// Party data: a Person or Organization with the `id` the fill assigns it
export const validateRuntimeOrganization = createValidator(RuntimeOrganizationSchema)
export const validateRuntimePerson = createValidator(RuntimePersonSchema)
