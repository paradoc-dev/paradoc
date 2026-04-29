import { z } from 'zod'
import type { Form } from '@paradoc/types'
import { compile, type InferFormPayload } from '@/inference'
import { deepClone } from '@/utils/clone'
import { createSafeRegex } from '@/utils/safe-pattern'

// Re-export types from centralized types.ts
export type { ValidationError, ValidationSuccess, ValidationFailure, ValidationResult, InstanceTemplate } from '@/types'

// Import types for internal use
import type { ValidationError, ValidationResult, InstanceTemplate } from '@/types'

/**
 * Build a Zod schema from a compiled JSON Schema
 * This is a simplified conversion for common form field patterns
 */
export function jsonSchemaToZod(jsonSchema: Record<string, unknown>): z.ZodType {
	const type = jsonSchema.type as string | undefined

	if (type === 'object') {
		const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined
		const required = jsonSchema.required as string[] | undefined

		if (!properties) {
			return z.record(z.string(), z.unknown())
		}

		const shape: Record<string, z.ZodType> = {}
		for (const [key, propSchema] of Object.entries(properties)) {
			let fieldSchema = jsonSchemaToZod(propSchema)
			if (!required?.includes(key)) {
				fieldSchema = fieldSchema.optional()
			}
			shape[key] = fieldSchema
		}

		return z.object(shape).passthrough()
	}

	if (type === 'array') {
		const items = jsonSchema.items as Record<string, unknown> | undefined
		if (items) {
			return z.array(jsonSchemaToZod(items))
		}
		return z.array(z.unknown())
	}

	if (type === 'string') {
		let schema: z.ZodType = z.string()
		const format = jsonSchema.format as string | undefined
		const minLength = jsonSchema.minLength as number | undefined
		const maxLength = jsonSchema.maxLength as number | undefined
		const pattern = jsonSchema.pattern as string | undefined

		if (format === 'email') {
			schema = z.email()
		} else if (format === 'uri' || format === 'url') {
			schema = z.url()
		} else if (format === 'date') {
			schema = z.iso.date()
		} else if (format === 'date-time') {
			schema = z.iso.datetime()
		} else {
			if (minLength !== undefined) {
				schema = (schema as z.ZodString).min(minLength)
			}
			if (maxLength !== undefined) {
				schema = (schema as z.ZodString).max(maxLength)
			}
			if (pattern !== undefined) {
				// Use safe regex to prevent ReDoS attacks from malicious patterns
				schema = (schema as z.ZodString).regex(createSafeRegex(pattern))
			}
		}
		return schema
	}

	if (type === 'number' || type === 'integer') {
		let schema = z.number()
		const minimum = jsonSchema.minimum as number | undefined
		const maximum = jsonSchema.maximum as number | undefined

		if (minimum !== undefined) {
			schema = schema.min(minimum)
		}
		if (maximum !== undefined) {
			schema = schema.max(maximum)
		}
		if (type === 'integer') {
			schema = schema.int()
		}
		return schema
	}

	if (type === 'boolean') {
		return z.boolean()
	}

	if (type === 'null') {
		return z.null()
	}

	// Handle union types (anyOf, oneOf)
	const anyOf = jsonSchema.anyOf as Record<string, unknown>[] | undefined
	const oneOf = jsonSchema.oneOf as Record<string, unknown>[] | undefined
	const unionTypes = anyOf || oneOf

	if (unionTypes && unionTypes.length > 0) {
		const schemas = unionTypes.map((s) => jsonSchemaToZod(s))
		if (schemas.length === 1) {
			return schemas[0]!
		}
		if (schemas.length >= 2) {
			return z.union([schemas[0]!, schemas[1]!, ...schemas.slice(2)])
		}
	}

	// Handle const
	if ('const' in jsonSchema) {
		return z.literal(jsonSchema.const as string | number | boolean)
	}

	// Handle enum
	const enumValues = jsonSchema.enum as (string | number)[] | undefined
	if (enumValues && enumValues.length > 0) {
		if (typeof enumValues[0] === 'string') {
			return z.enum(enumValues as [string, ...string[]])
		}
		if (enumValues.length >= 2) {
			const literals = enumValues.map((v) => z.literal(v))
			return z.union([literals[0]!, literals[1]!, ...literals.slice(2)])
		}
		return z.literal(enumValues[0])
	}

	// Default fallback
	return z.unknown()
}

/**
 * Apply defaults from JSON Schema to data
 */
export function applyDefaults(
	data: Record<string, unknown>,
	jsonSchema: Record<string, unknown>
): Record<string, unknown> {
	const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined
	if (!properties) return data

	const result = { ...data }

	for (const [key, propSchema] of Object.entries(properties)) {
		if (result[key] === undefined && 'default' in propSchema) {
			result[key] = propSchema.default
		} else if (result[key] && typeof result[key] === 'object' && propSchema.type === 'object') {
			result[key] = applyDefaults(result[key] as Record<string, unknown>, propSchema)
		}
	}

	return result
}

/**
 * Map a single Zod issue to ValidationError format.
 */
export function mapZodIssueToValidationError(
	issue: z.ZodIssue,
	pathPrefix: Array<string | number> = []
): ValidationError {
	const fullPath = [...pathPrefix, ...issue.path]
	const field = fullPath.join('.') || 'root'
	let message = issue.message

	// Enhance error messages based on code
	// Zod 4 has different issue codes than Zod 3
	if (issue.code === 'invalid_type') {
		const invalidTypeIssue = issue as { expected?: string; received?: string }
		// Check for undefined - Zod 4 may report as 'undefined' string or include it in the message
		const isUndefined =
			invalidTypeIssue.received === 'undefined' ||
			message.includes('received undefined')
		if (isUndefined) {
			message = `Missing required field: ${field}`
		} else if (invalidTypeIssue.expected && invalidTypeIssue.received) {
			message = `Expected type ${invalidTypeIssue.expected}, received ${invalidTypeIssue.received}`
		}
	} else if (issue.code === 'too_small') {
		const tooSmallIssue = issue as { minimum?: number; type?: string }
		if (tooSmallIssue.minimum !== undefined) {
			message = `Must be at least ${tooSmallIssue.minimum}`
		}
	} else if (issue.code === 'too_big') {
		const tooBigIssue = issue as { maximum?: number; type?: string }
		if (tooBigIssue.maximum !== undefined) {
			message = `Must be at most ${tooBigIssue.maximum}`
		}
	} else if (issue.code === 'invalid_format') {
		const formatIssue = issue as { format?: string }
		if (formatIssue.format === 'email') {
			message = 'Invalid email format'
		} else if (formatIssue.format === 'url' || formatIssue.format === 'uri') {
			message = 'Invalid URL format'
		} else if (formatIssue.format === 'regex') {
			message = 'Does not match required pattern'
		}
	} else if (issue.code === 'invalid_value') {
		const valueIssue = issue as { values?: unknown[] }
		if (valueIssue.values) {
			message = `Must be one of: ${valueIssue.values.join(', ')}`
		}
	} else if (issue.code === 'invalid_union') {
		const unionIssue = issue as { errors?: Array<Array<{ values?: unknown[] }>> }
		const unionValues = unionIssue.errors
			?.flatMap((branch) => branch)
			.flatMap((nestedIssue) =>
				Array.isArray(nestedIssue.values) ? nestedIssue.values : [],
			)
		const uniqueValues = Array.from(new Set(unionValues))
		if (uniqueValues.length > 0) {
			message = `Must be one of: ${uniqueValues.join(', ')}`
		}
	} else if (issue.code === 'unrecognized_keys') {
		const keysIssue = issue as { keys?: string[] }
		if (keysIssue.keys) {
			message = `Unknown field(s): ${keysIssue.keys.join(', ')}`
		}
	}

	return {
		field,
		message,
		value: undefined, // Zod doesn't provide the invalid value directly
	}
}

/**
 * Map Zod issues array to ValidationError format.
 */
export function mapZodIssuesToValidationErrors(
	issues: z.ZodIssue[],
	pathPrefix: Array<string | number> = []
): ValidationError[] {
	return issues.map((issue) => mapZodIssueToValidationError(issue, pathPrefix))
}

/**
 * Validate user-submitted data against a form definition
 *
 * @param form - The form definition (artifact schema)
 * @param data - The data payload to validate
 * @returns Validation result with success status, data (with defaults applied), and errors
 */
export function validateFormData<F extends Form>(
	form: F,
	data: Record<string, unknown>
): ValidationResult<InferFormPayload<F>> {
	// Compile the form to a JSON Schema
	const jsonSchema = compile(form)

	// Deep clone data to avoid mutating the original
	// Handle null/undefined gracefully by defaulting to empty object
	let dataCopy = data != null ? deepClone(data) : {}

	// Apply defaults from schema
	dataCopy = applyDefaults(dataCopy, jsonSchema)

	// Build Zod schema from JSON Schema
	const zodSchema = jsonSchemaToZod(jsonSchema)

	// Validate the data
	const result = zodSchema.safeParse(dataCopy)

	if (result.success) {
		return {
			success: true,
			data: dataCopy as InferFormPayload<F>,
			errors: null,
		}
	}

	const errors = mapZodIssuesToValidationErrors(result.error.issues)

	return {
		success: false,
		data: null,
		errors,
	}
}

/**
 * Validate an instance template against a form definition
 *
 * This function validates both fields and annexes according to the form's schema.
 * It uses the same validation logic as validateFormData but with proper InstanceTemplate typing.
 *
 * @param form - The form definition (artifact schema)
 * @param instance - The instance template to validate
 * @returns Validation result with success status, data (with defaults applied), and errors
 */
export function validateInstance<F extends Form>(
	form: F,
	instance: InstanceTemplate
): ValidationResult<InferFormPayload<F>> {
	// InstanceTemplate extends Record<string, unknown> so it's compatible
	// with validateFormData which expects { fields: {...}, annexes: {...} }
	return validateFormData(form, instance)
}
