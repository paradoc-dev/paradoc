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
	FormFieldsetSchema,
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

// Map schema names from $defs (PascalCase) to validator keys (camelCase)
const schemaNameMap: Record<string, string> = {
	// Artifacts
	Form: 'form',
	Document: 'document',
	Bundle: 'bundle',
	BundleContentItem: 'bundleContentItem',
	Checklist: 'checklist',
	ChecklistItem: 'checklistItem',
	// Blocks (design-time form components)
	FormField: 'formField',
	FormAnnex: 'formAnnex',
	FormFieldset: 'formFieldset',
	FormParty: 'formParty',
	Layer: 'layer',
	// Runtime types
	Signature: 'signature',
	Attachment: 'attachment',
	// Primitives
	Address: 'address',
	Bbox: 'bbox',
	Coordinate: 'coordinate',
	Duration: 'duration',
	Identification: 'identification',
	Metadata: 'metadata',
	Money: 'money',
	Organization: 'organization',
	Person: 'person',
	Phone: 'phone',
}

// Schema map for getValidatorErrors lookup
const schemaMap: Record<string, ZodSchema> = {
	Form: FormSchema,
	Document: DocumentSchema,
	Bundle: BundleSchema,
	BundleContentItem: BundleContentItemSchema,
	Checklist: ChecklistSchema,
	ChecklistItem: ChecklistItemSchema,
	FormField: FormFieldSchema,
	FormAnnex: FormAnnexSchema,
	FormFieldset: FormFieldsetSchema,
	FormParty: FormPartySchema,
	Layer: LayerSchema,
	Signature: SignatureSchema,
	Attachment: AttachmentSchema,
	Address: AddressSchema,
	Bbox: BboxSchema,
	Coordinate: CoordinateSchema,
	Duration: DurationSchema,
	Identification: IdentificationSchema,
	Metadata: MetadataSchema,
	Money: MoneySchema,
	Organization: OrganizationSchema,
	Person: PersonSchema,
	Phone: PhoneSchema,
}

// Validator cache for getValidatorErrors
const validatorCache = new Map<string, ReturnType<typeof createValidator>>()

function getCachedValidator(schemaName: string): ReturnType<typeof createValidator> | undefined {
	if (!validatorCache.has(schemaName)) {
		const schema = schemaMap[schemaName]
		if (schema) {
			validatorCache.set(schemaName, createValidator(schema))
		}
	}
	return validatorCache.get(schemaName)
}

// Artifacts
export const validateForm = createValidator(FormSchema)
export const validateDocument = createValidator(DocumentSchema)
export const validateBundle = createValidator(BundleSchema)
export const validateChecklist = createValidator(ChecklistSchema)

// Blocks (design-time form components)
export const validateFormField = createValidator(FormFieldSchema)
export const validateFormAnnex = createValidator(FormAnnexSchema)
export const validateFormFieldset = createValidator(FormFieldsetSchema)
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

/**
 * Get errors for a validator by schema name
 * This accesses the .errors property on the cached validator
 */
export function getValidatorErrors(validatorName: string): ValidatorError[] | null | undefined {
	const schemaName = Object.entries(schemaNameMap).find(([, key]) => key === validatorName)?.[0]
	if (!schemaName) return null
	const validator = getCachedValidator(schemaName)
	return validator?.errors || null
}
