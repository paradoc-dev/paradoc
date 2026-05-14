import type { Checklist, ChecklistItem, Form, FormParty, RuntimeParty } from '@paradoc/types'
import type { ValidationError } from '@/types'
import { compile } from '@/inference'
import { jsonSchemaToZod, mapZodIssueToValidationError } from './data'
import { validatePartyForRole, validatePartyId } from './party'

type JsonSchemaObject = Record<string, unknown>

export type ProgressiveValidationResult<T> =
	| { success: true; value: T; errors: null }
	| { success: false; value: null; errors: ValidationError[] }

export interface FieldInputValidationInput {
	fieldPath: string | string[]
	value: unknown
}

export interface PartyInputValidationInput {
	roleId: string
	index?: number
	value: unknown
}

export interface AnnexInputValidationInput {
	annexId: string
	value: unknown
}

export interface ChecklistItemInputValidationInput {
	itemId: string
	value: unknown
}

export interface NormalizedPartyInput {
	roleId: string
	index: number
	party: RuntimeParty
}

function success<T>(value: T): ProgressiveValidationResult<T> {
	return {
		success: true,
		value,
		errors: null,
	}
}

function failure<T>(errors: ValidationError[]): ProgressiveValidationResult<T> {
	return {
		success: false,
		value: null,
		errors,
	}
}

function createValidationError(field: string, message: string): ValidationError {
	return {
		field,
		message,
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFieldPathSegments(fieldPath: string | string[]): string[] {
	if (Array.isArray(fieldPath)) {
		return fieldPath
			.map((segment) => segment.trim())
			.filter((segment) => segment.length > 0)
	}

	return fieldPath
		.split('.')
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0)
}

function getFormFieldsSchema(form: Form): JsonSchemaObject | null {
	const schema = compile(form) as JsonSchemaObject
	const properties = isRecord(schema.properties)
		? (schema.properties as Record<string, unknown>)
		: null
	if (!properties) return null
	const fieldsSchema = properties.fields
	return isRecord(fieldsSchema) ? fieldsSchema : null
}

function getSchemaAtPath(rootSchema: JsonSchemaObject, path: string[]): JsonSchemaObject | null {
	let currentSchema: JsonSchemaObject = rootSchema

	for (const segment of path) {
		const properties = isRecord(currentSchema.properties)
			? (currentSchema.properties as Record<string, unknown>)
			: null
		if (!properties) {
			return null
		}

		const nextSchema = properties[segment]
		if (!isRecord(nextSchema)) {
			return null
		}
		currentSchema = nextSchema
	}

	return currentSchema
}

function makeSchemaOptionalRecursively(schema: JsonSchemaObject): JsonSchemaObject {
	const nextSchema: JsonSchemaObject = { ...schema }

	if ('required' in nextSchema) {
		delete nextSchema.required
	}

	if (isRecord(nextSchema.properties)) {
		nextSchema.properties = Object.fromEntries(
			Object.entries(nextSchema.properties).map(([key, value]) => {
				if (!isRecord(value)) {
					return [key, value]
				}
				return [key, makeSchemaOptionalRecursively(value)]
			}),
		)
	}

	if (isRecord(nextSchema.items)) {
		nextSchema.items = makeSchemaOptionalRecursively(nextSchema.items)
	}

	if (Array.isArray(nextSchema.anyOf)) {
		nextSchema.anyOf = nextSchema.anyOf.map((value) =>
			isRecord(value) ? makeSchemaOptionalRecursively(value) : value,
		)
	}

	if (Array.isArray(nextSchema.oneOf)) {
		nextSchema.oneOf = nextSchema.oneOf.map((value) =>
			isRecord(value) ? makeSchemaOptionalRecursively(value) : value,
		)
	}

	return nextSchema
}

function collectUnknownKeysForObjectSchema(
	schema: JsonSchemaObject,
	value: unknown,
	pathPrefix: string[] = [],
): ValidationError[] {
	if (!isRecord(value)) return []
	if (schema.type !== 'object') return []

	const properties = isRecord(schema.properties)
		? (schema.properties as Record<string, unknown>)
		: null
	if (!properties) return []

	const errors: ValidationError[] = []
	for (const [key, nestedValue] of Object.entries(value)) {
		const nestedSchema = properties[key]
		if (!isRecord(nestedSchema)) {
			const fieldPath = ['fields', ...pathPrefix].join('.')
			errors.push(createValidationError(fieldPath, `Unknown field(s): ${key}`))
			continue
		}
		errors.push(
			...collectUnknownKeysForObjectSchema(
				nestedSchema,
				nestedValue,
				[...pathPrefix, key],
			),
		)
	}

	return errors
}

function getPartyDefinition(form: Form, roleId: string): FormParty | null {
	const formParties = form.parties ?? {}
	const partyDef = formParties[roleId]
	return partyDef ?? null
}

function normalizePartyInput(
	roleId: string,
	index: number,
	value: unknown,
	formParty: FormParty,
): ProgressiveValidationResult<RuntimeParty> {
	const fieldPath = `parties.${roleId}[${index}]`

	if (!Number.isInteger(index) || index < 0) {
		return failure([
			createValidationError(fieldPath, `Invalid party index "${index}". Index must be a non-negative integer.`),
		])
	}

	if (!isRecord(value)) {
		return failure([createValidationError(fieldPath, 'Party value must be an object.')])
	}

	const expectedPartyId = `${roleId}-${index}`
	const currentPartyId = value.id

	if (currentPartyId !== undefined && typeof currentPartyId !== 'string') {
		return failure([createValidationError(`${fieldPath}.id`, 'Party id must be a string when provided.')])
	}

	if (typeof currentPartyId === 'string' && currentPartyId !== expectedPartyId) {
		return failure([
			createValidationError(
				`${fieldPath}.id`,
				`Party ID "${currentPartyId}" does not match expected "${expectedPartyId}".`,
			),
		])
	}

	const idValidation = validatePartyId(expectedPartyId, roleId)
	if (!idValidation.success) {
		return failure(
			idValidation.errors.map((message) =>
				createValidationError(`${fieldPath}.id`, message),
			),
		)
	}

	const normalizedParty = { ...value, id: expectedPartyId }
	const partyValidation = validatePartyForRole(normalizedParty, formParty)
	if (!partyValidation.success) {
		return failure([
			createValidationError(
				fieldPath,
				partyValidation.error || `Invalid party data for role "${roleId}".`,
			),
		])
	}

	return success(normalizedParty as RuntimeParty)
}

function getChecklistItemDefinitions(checklist: Checklist): Map<string, ChecklistItem> {
	const map = new Map<string, ChecklistItem>()
	for (const item of checklist.items ?? []) {
		map.set(item.id, item)
	}
	return map
}

function validateChecklistItemValue(
	itemId: string,
	value: unknown,
	itemDef: ChecklistItem,
): ProgressiveValidationResult<boolean | string> {
	const status = itemDef.status ?? { kind: 'boolean' as const }
	const fieldPath = `items.${itemId}`

	if (status.kind === 'boolean') {
		if (typeof value !== 'boolean') {
			return failure([
				createValidationError(
					fieldPath,
					`Invalid value for item "${itemId}": expected boolean, got ${typeof value}.`,
				),
			])
		}
		return success(value)
	}

	if (status.kind === 'enum') {
		if (typeof value !== 'string') {
			return failure([
				createValidationError(
					fieldPath,
					`Invalid value for item "${itemId}": expected string, got ${typeof value}.`,
				),
			])
		}
		const validValues = status.options.map((option) => option.value)
		if (!validValues.includes(value)) {
			return failure([
				createValidationError(
					fieldPath,
					`Invalid value for item "${itemId}": "${value}" is not in [${validValues.join(', ')}].`,
				),
			])
		}
		return success(value)
	}

	return failure([createValidationError(fieldPath, `Unsupported item status kind for "${itemId}".`)])
}

/**
 * Validate a single form field input at `fields.<path>`.
 */
export function validateFieldInput(
	form: Form,
	input: FieldInputValidationInput,
): ProgressiveValidationResult<unknown> {
	const fieldPathSegments = toFieldPathSegments(input.fieldPath)
	if (fieldPathSegments.length === 0) {
		return failure([createValidationError('fields', 'fieldPath is required.')])
	}

	const fieldsSchema = getFormFieldsSchema(form)
	if (!fieldsSchema) {
		return failure([createValidationError('fields', 'Form has no fields schema to validate against.')])
	}

	const targetSchema = getSchemaAtPath(fieldsSchema, fieldPathSegments)
	if (!targetSchema) {
		return failure([
			createValidationError(
				`fields.${fieldPathSegments.join('.')}`,
				`Unknown field path "${fieldPathSegments.join('.')}".`,
			),
		])
	}

	const parsed = jsonSchemaToZod(targetSchema).safeParse(input.value)
	if (parsed.success) {
		return success(parsed.data)
	}

	return failure(
		parsed.error.issues.map((issue) =>
			mapZodIssueToValidationError(issue, ['fields', ...fieldPathSegments]),
		),
	)
}

/**
 * Validate a partial fields patch object without requiring unrelated fields.
 */
export function validateFieldsPatch(
	form: Form,
	fields: unknown,
): ProgressiveValidationResult<Record<string, unknown>> {
	const fieldsSchema = getFormFieldsSchema(form)
	if (!fieldsSchema) {
		return failure([createValidationError('fields', 'Form has no fields schema to validate against.')])
	}

	const unknownFieldErrors = collectUnknownKeysForObjectSchema(fieldsSchema, fields)
	if (unknownFieldErrors.length > 0) {
		return failure(unknownFieldErrors)
	}

	const partialSchema = makeSchemaOptionalRecursively(fieldsSchema)
	const parsed = jsonSchemaToZod(partialSchema).safeParse(fields)
	if (parsed.success) {
		return success(parsed.data as Record<string, unknown>)
	}

	return failure(
		parsed.error.issues.map((issue) =>
			mapZodIssueToValidationError(issue, ['fields']),
		),
	)
}

/**
 * Validate a single party input for a role/index and normalize party id.
 */
export function validatePartyInput(
	form: Form,
	input: PartyInputValidationInput,
): ProgressiveValidationResult<NormalizedPartyInput> {
	const roleId = input.roleId.trim()
	if (roleId.length === 0) {
		return failure([createValidationError('parties', 'roleId is required.')])
	}

	const formParty = getPartyDefinition(form, roleId)
	if (!formParty) {
		return failure([createValidationError(`parties.${roleId}`, `Unknown party role "${roleId}".`)])
	}

	const index = input.index ?? 0
	const max = formParty.max ?? 1
	if (max <= 1 && index !== 0) {
		return failure([
			createValidationError(
				`parties.${roleId}[${index}]`,
				`Role "${roleId}" accepts a single party; only index 0 is valid.`,
			),
		])
	}
	if (max > 1 && index >= max) {
		return failure([
			createValidationError(
				`parties.${roleId}[${index}]`,
				`Role "${roleId}" allows at most ${max} parties. Highest valid index is ${max - 1}.`,
			),
		])
	}

	const normalized = normalizePartyInput(roleId, index, input.value, formParty)
	if (!normalized.success) {
		return normalized
	}

	return success({
		roleId,
		index,
		party: normalized.value,
	})
}

/**
 * Validate a partial parties patch object without requiring unrelated roles.
 */
export function validatePartiesPatch(
	form: Form,
	parties: unknown,
): ProgressiveValidationResult<Record<string, RuntimeParty | RuntimeParty[]>> {
	if (!isRecord(parties)) {
		return failure([createValidationError('parties', 'Parties patch must be an object.')])
	}

	const formParties = form.parties ?? {}
	const normalizedParties: Record<string, RuntimeParty | RuntimeParty[]> = {}
	const errors: ValidationError[] = []

	for (const [roleId, partyValue] of Object.entries(parties)) {
		const formParty = formParties[roleId]
		if (!formParty) {
			errors.push(createValidationError(`parties.${roleId}`, `Unknown party role "${roleId}".`))
			continue
		}

		const max = formParty.max ?? 1
		if (max > 1) {
			if (!Array.isArray(partyValue)) {
				errors.push(
					createValidationError(
						`parties.${roleId}`,
						`Role "${roleId}" expects an array of parties (max=${max}).`,
					),
				)
				continue
			}
			if (partyValue.length > max) {
				errors.push(
					createValidationError(
						`parties.${roleId}`,
						`Role "${roleId}" allows at most ${max} parties, but received ${partyValue.length}.`,
					),
				)
				continue
			}

			const normalizedRoleParties: RuntimeParty[] = []
			for (const [index, singleParty] of partyValue.entries()) {
				const normalized = normalizePartyInput(roleId, index, singleParty, formParty)
				if (!normalized.success) {
					errors.push(...normalized.errors)
					continue
				}
				normalizedRoleParties.push(normalized.value)
			}
			if (normalizedRoleParties.length === partyValue.length) {
				normalizedParties[roleId] = normalizedRoleParties
			}
			continue
		}

		const normalized = normalizePartyInput(roleId, 0, partyValue, formParty)
		if (!normalized.success) {
			errors.push(...normalized.errors)
			continue
		}
		normalizedParties[roleId] = normalized.value
	}

	if (errors.length > 0) {
		return failure(errors)
	}

	return success(normalizedParties)
}

/**
 * Validate a single annex input key/value.
 */
export function validateAnnexInput(
	form: Form,
	input: AnnexInputValidationInput,
): ProgressiveValidationResult<unknown> {
	const annexId = input.annexId.trim()
	if (annexId.length === 0) {
		return failure([createValidationError('annexes', 'annexId is required.')])
	}

	const annexDefinitions = form.annexes ?? {}
	const allowAdditionalAnnexes = form.allowAdditionalAnnexes === true
	if (!annexDefinitions[annexId] && !allowAdditionalAnnexes) {
		return failure([createValidationError(`annexes.${annexId}`, `Unknown annex "${annexId}".`)])
	}

	return success(input.value)
}

/**
 * Validate a partial annexes patch object.
 */
export function validateAnnexesPatch(
	form: Form,
	annexes: unknown,
): ProgressiveValidationResult<Record<string, unknown>> {
	if (!isRecord(annexes)) {
		return failure([createValidationError('annexes', 'Annexes patch must be an object.')])
	}

	const annexDefinitions = form.annexes ?? {}
	const allowAdditionalAnnexes = form.allowAdditionalAnnexes === true
	const errors: ValidationError[] = []

	for (const annexId of Object.keys(annexes)) {
		if (!annexDefinitions[annexId] && !allowAdditionalAnnexes) {
			errors.push(createValidationError(`annexes.${annexId}`, `Unknown annex "${annexId}".`))
		}
	}

	if (errors.length > 0) {
		return failure(errors)
	}

	return success(annexes)
}

/**
 * Validate a single checklist item input.
 */
export function validateChecklistItemInput(
	checklist: Checklist,
	input: ChecklistItemInputValidationInput,
): ProgressiveValidationResult<boolean | string> {
	const itemId = input.itemId.trim()
	if (itemId.length === 0) {
		return failure([createValidationError('items', 'itemId is required.')])
	}

	const itemDefinitions = getChecklistItemDefinitions(checklist)
	const itemDef = itemDefinitions.get(itemId)
	if (!itemDef) {
		const validItemIds = Array.from(itemDefinitions.keys())
		return failure([
			createValidationError(
				`items.${itemId}`,
				`Unknown item "${itemId}". Valid item IDs are: [${validItemIds.join(', ')}].`,
			),
		])
	}

	return validateChecklistItemValue(itemId, input.value, itemDef)
}

/**
 * Validate a partial checklist items patch object.
 */
export function validateChecklistItemsPatch(
	checklist: Checklist,
	items: unknown,
): ProgressiveValidationResult<Record<string, boolean | string>> {
	if (!isRecord(items)) {
		return failure([createValidationError('items', 'Items patch must be an object.')])
	}

	const itemDefinitions = getChecklistItemDefinitions(checklist)
	const normalizedItems: Record<string, boolean | string> = {}
	const errors: ValidationError[] = []

	for (const [itemId, value] of Object.entries(items)) {
		const itemDef = itemDefinitions.get(itemId)
		if (!itemDef) {
			const validItemIds = Array.from(itemDefinitions.keys())
			errors.push(
				createValidationError(
					`items.${itemId}`,
					`Unknown item "${itemId}". Valid item IDs are: [${validItemIds.join(', ')}].`,
				),
			)
			continue
		}

		const validation = validateChecklistItemValue(itemId, value, itemDef)
		if (!validation.success) {
			errors.push(...validation.errors)
			continue
		}
		normalizedItems[itemId] = validation.value
	}

	if (errors.length > 0) {
		return failure(errors)
	}

	return success(normalizedItems)
}
