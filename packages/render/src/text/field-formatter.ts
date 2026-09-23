import type {
	FormatIssue,
	FormatResult,
	Formatter,
	FormatterProgressivePolicy,
	SelectionOption,
	SelectionOptionValue,
	Form,
	FormField,
	FormAnnex,
	DefsSection,
	Bindings,
} from '@paradoc/types'
import { MISSING_RATING_SCALE, UNSUPPORTED_LIST_JOIN } from '@paradoc/format'
import { pathSegments } from '../path'

/** Explicit policy for rendering a value that is missing or incomplete. */
export type ProgressiveFormattingOptions = FormatterProgressivePolicy

export interface FieldFormattingOptions {
	/** Enable placeholders for missing/incomplete values for a progressive preview. */
	progressive?: ProgressiveFormattingOptions
	/**
	 * What a choice prints: its option label (the default) or its option value.
	 * A PDF box writes the value, the code the form expects, such as "C" or "5".
	 */
	choices?: 'label' | 'value'
}

type RecordValue = Record<string, unknown>

const rawValues = new WeakMap<FormattedFieldValue, unknown>()
const renderedValues = new WeakMap<FormattedFieldValue, string>()
const recordedIssues = new WeakMap<FormattedFieldValue, readonly FormatIssue[]>()

/**
 * A template value that keeps its source value for logic/property access while
 * supplying the selected formatter's text for interpolation.
 */
export class FormattedFieldValue {
	constructor(value: unknown, text: string, issues?: readonly FormatIssue[]) {
		if (value !== null && typeof value === 'object') {
			for (const [key, member] of Object.entries(value)) {
				if (key === 'toString' || key === '__proto__' || key === 'constructor' || key === 'prototype') continue
				Object.defineProperty(this, key, { configurable: false, enumerable: true, value: member, writable: false })
			}
		}
		rawValues.set(this, value)
		renderedValues.set(this, text)
		if (issues !== undefined && issues.length > 0) recordedIssues.set(this, issues)
	}

	get raw(): unknown {
		return rawValues.get(this)
	}

	toString(): string {
		return renderedValues.get(this) ?? ''
	}
}

export function unwrapFormattedValue(value: unknown): unknown {
	return value instanceof FormattedFieldValue ? value.raw : value
}

/**
 * The outcome a formatted value fell back from, if it fell back at all. A
 * rating with no declared scale and a locale with no list conjunction still
 * print, and this is where the formatter's structured reason is kept.
 */
export function formattedValueIssues(value: unknown): readonly FormatIssue[] {
	return (value instanceof FormattedFieldValue ? recordedIssues.get(value) : undefined) ?? []
}

/** Raised when a declared artifact value cannot be presented. */
export class ArtifactFieldFormatError extends Error {
	readonly path: string
	readonly fieldType: string
	readonly status: string
	readonly issues: readonly FormatIssue[]

	constructor(
		path: string,
		fieldType: string,
		status: string,
		issues: readonly FormatIssue[],
		cause?: unknown,
	) {
		const detail = issues.map((entry) => entry.message).join('; ') || `Unable to format ${fieldType}.`
		super(`Cannot format ${path} (${fieldType}, ${status}): ${detail}`, cause instanceof Error ? { cause } : undefined)
		this.name = 'ArtifactFieldFormatError'
		this.path = path
		this.fieldType = fieldType
		this.status = status
		this.issues = issues
	}
}

function isRecord(value: unknown): value is RecordValue {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissing(value: unknown): value is null | undefined {
	return value === null || value === undefined
}

function childPath(path: string, segment: string | number): string {
	return typeof segment === 'number' ? `${path}[${segment}]` : `${path}.${segment}`
}

function formatIssue(path: string, fieldType: string, code: string, message: string): ArtifactFieldFormatError {
	return new ArtifactFieldFormatError(path, fieldType, 'invalid', [{ code, message, path, kind: fieldType }])
}

function progressiveText(options: FieldFormattingOptions | undefined, status: 'missing' | 'incomplete'): string | undefined {
	if (!options?.progressive) return undefined
	return status === 'missing'
		? options.progressive.missing ?? '—'
		: options.progressive.incomplete ?? '…'
}

function missingValue(value: unknown, path: string, fieldType: string, options?: FieldFormattingOptions): unknown {
	const text = progressiveText(options, 'missing')
	return text === undefined ? value : new FormattedFieldValue(value, text)
}

function presentIssuePath(path: string, issuePath: string | undefined): string {
	if (!issuePath) return path
	if (issuePath === path || issuePath.startsWith(`${path}.`) || issuePath.startsWith(`${path}[`)) return issuePath
	return issuePath.startsWith('[') ? `${path}${issuePath}` : `${path}.${issuePath}`
}

function presentIssues(issues: readonly FormatIssue[], path: string, fieldType: string): FormatIssue[] {
	return issues.map((issue) => ({
		...issue,
		path: presentIssuePath(path, issue.path),
		kind: issue.kind ?? fieldType,
	}))
}

function presentResult(
	result: FormatResult,
	value: unknown,
	path: string,
	fieldType: string,
	options?: FieldFormattingOptions,
): unknown {
	if (result.success) return new FormattedFieldValue(value, result.value)
	if (result.status === 'missing') return missingValue(value, path, fieldType, options)
	if (result.status === 'incomplete') {
		const text = progressiveText(options, 'incomplete')
		if (text !== undefined) return new FormattedFieldValue(value, text)
	}
	throw new ArtifactFieldFormatError(path, fieldType, result.status, presentIssues(result.issues, path, fieldType))
}

function guardFormatting<T>(path: string, fieldType: string, run: () => T): T {
	try {
		return run()
	} catch (error) {
		if (error instanceof ArtifactFieldFormatError) throw error
		throw new ArtifactFieldFormatError(path, fieldType, 'error', [{
			code: 'formatter_error',
			message: error instanceof Error ? error.message : 'Unexpected formatter failure.',
			path,
			kind: fieldType,
			cause: error,
		}], error)
	}
}

function callFormatter(
	path: string,
	fieldType: string,
	value: unknown,
	call: () => FormatResult,
	options?: FieldFormattingOptions,
): unknown {
	return guardFormatting(path, fieldType, () => presentResult(call(), value, path, fieldType, options))
}

/**
 * Formats a value whose presentation the runtime may not carry, substituting
 * the documented plain form and keeping the formatter's reason on the result.
 * A rating whose field declares no scale and a locale with no list conjunction
 * are gaps in what can be said, not faults in the document, so the value still
 * prints; an invalid value is still refused.
 */
interface FallbackFormatting {
	/** The formatter's `unsupported` code this fallback answers, and only that code. */
	readonly code: string
	/** The documented plain presentation to substitute. */
	readonly substitute: () => FormatResult
	readonly options?: FieldFormattingOptions
}

function callFormatterWithFallback(
	path: string,
	fieldType: string,
	value: unknown,
	call: () => FormatResult,
	fallback: FallbackFormatting,
): unknown {
	return guardFormatting(path, fieldType, () => {
		const result = call()
		const fellShort = !result.success && result.status === 'unsupported' && result.issues.some((entry) => entry.code === fallback.code)
		if (!fellShort) return presentResult(result, value, path, fieldType, fallback.options)
		const substitute = fallback.substitute()
		if (!substitute.success) return presentResult(substitute, value, path, fieldType, fallback.options)
		return new FormattedFieldValue(value, substitute.value, result.issues)
	})
}

function recordInput(value: unknown, path: string, fieldType: string): RecordValue {
	if (isRecord(value)) return value
	throw formatIssue(path, fieldType, 'invalid_value', `Expected an object for ${fieldType}.`)
}

function dateInput(value: unknown, path: string, fieldType: string): string | Date {
	if (typeof value === 'string' || value instanceof Date) return value
	throw formatIssue(path, fieldType, 'invalid_value', `Expected an ISO string or Date for ${fieldType}.`)
}

function stringInput(value: unknown, path: string, fieldType: string): string {
	if (typeof value === 'string') return value
	throw formatIssue(path, fieldType, 'invalid_value', `Expected a string for ${fieldType}.`)
}

function numberInput(value: unknown, path: string, fieldType: string): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value
	throw formatIssue(path, fieldType, 'invalid_value', `Expected a finite number for ${fieldType}.`)
}

function booleanInput(value: unknown, path: string, fieldType: string): boolean {
	if (typeof value === 'boolean') return value
	throw formatIssue(path, fieldType, 'invalid_value', 'Expected a boolean value.')
}

function optionInput(value: unknown, path: string, fieldType: string): SelectionOptionValue {
	if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) return value
	throw formatIssue(path, fieldType, 'invalid_value', `Expected a string or number ${fieldType} value.`)
}

function optionListInput(value: unknown, path: string, fieldType: string): readonly SelectionOptionValue[] {
	if (!Array.isArray(value)) throw formatIssue(path, fieldType, 'invalid_value', `Expected an array of ${fieldType} values.`)
	return value.map((entry) => optionInput(entry, path, fieldType))
}

/**
 * The documented fallback for a runtime whose locale data carries no list
 * conjunction: the same option labels, joined with a comma. It asks the
 * formatter for each label, so the labels are still the formatter's.
 */
function commaJoinedLabels(
	formatter: Formatter,
	values: readonly SelectionOptionValue[],
	options: readonly SelectionOption[],
): FormatResult {
	const labels: string[] = []
	for (const value of values) {
		const result = formatter.safeFormatEnum(value, { options })
		if (!result.success) return result
		labels.push(result.value)
	}
	return { success: true, status: 'formatted', value: labels.join(', ') }
}

function formatLeaf(
	formatter: Formatter,
	field: FormField,
	value: unknown,
	path: string,
	options?: FieldFormattingOptions,
): unknown {
	if (isMissing(value)) return missingValue(value, path, field.type, options)
	if ((field.type as string) === 'string') return stringInput(value, path, 'string')

	try {
		switch (field.type) {
			case 'money': return callFormatter(path, field.type, value, () => formatter.safeFormatMoney(recordInput(value, path, field.type)), options)
			case 'address': return callFormatter(path, field.type, value, () => formatter.safeFormatAddress(recordInput(value, path, field.type)), options)
			case 'phone': return callFormatter(path, field.type, value, () => formatter.safeFormatPhone(typeof value === 'string' ? value : recordInput(value, path, field.type)), options)
			case 'person': return callFormatter(path, field.type, value, () => formatter.safeFormatPerson(recordInput(value, path, field.type)), options)
			case 'organization': return callFormatter(path, field.type, value, () => formatter.safeFormatOrganization(recordInput(value, path, field.type)), options)
			case 'coordinate': return callFormatter(path, field.type, value, () => formatter.safeFormatCoordinate(recordInput(value, path, field.type)), options)
			case 'bbox': return callFormatter(path, field.type, value, () => formatter.safeFormatBbox(recordInput(value, path, field.type)), options)
			case 'duration': return callFormatter(path, field.type, value, () => formatter.safeFormatDuration(stringInput(value, path, field.type)), options)
			case 'identification': return callFormatter(path, field.type, value, () => formatter.safeFormatIdentification(recordInput(value, path, field.type)), options)
			case 'date': return callFormatter(path, field.type, value, () => formatter.safeFormatDate(dateInput(value, path, field.type)), options)
			case 'datetime': return callFormatter(path, field.type, value, () => formatter.safeFormatDatetime(dateInput(value, path, field.type)), options)
			case 'time': return callFormatter(path, field.type, value, () => formatter.safeFormatTime(stringInput(value, path, field.type)), options)
			case 'number': return callFormatter(path, field.type, value, () => formatter.safeFormatNumber(numberInput(value, path, field.type)), options)
			case 'percentage': return callFormatter(path, field.type, value, () => formatter.safeFormatPercentage(numberInput(value, path, field.type)), options)
			case 'boolean': return callFormatter(path, field.type, value, () => formatter.safeFormatBoolean(booleanInput(value, path, field.type)), options)
			case 'enum': if (options?.choices === 'value') {
				const choice = optionInput(value, path, field.type)
				return new FormattedFieldValue(value, String(choice))
			}
				return callFormatter(path, field.type, value, () => formatter.safeFormatEnum(optionInput(value, path, field.type), { options: field.enum }), options)
			case 'multiselect': if (options?.choices === 'value') {
				return new FormattedFieldValue(value, optionListInput(value, path, field.type).map(String).join(', '))
			}
				return callFormatterWithFallback(
				path,
				field.type,
				value,
				() => formatter.safeFormatMultiselect(optionListInput(value, path, field.type), { options: field.enum }),
				{
					code: UNSUPPORTED_LIST_JOIN,
					substitute: () => commaJoinedLabels(formatter, optionListInput(value, path, field.type), field.enum),
					options,
				},
			)
			case 'text':
			case 'email':
			case 'uuid':
			case 'uri': return stringInput(value, path, field.type)
			// An absent `max` is left out, so a formatter-level rating scale still applies.
			case 'rating': return callFormatterWithFallback(
				path,
				field.type,
				value,
				() => formatter.safeFormatRating(numberInput(value, path, field.type), field.max === undefined ? {} : { max: field.max }),
				{
					code: MISSING_RATING_SCALE,
					substitute: () => formatter.safeFormatNumber(numberInput(value, path, field.type)),
					options,
				},
			)
		}
	} catch (error) {
		if (error instanceof ArtifactFieldFormatError) throw error
		throw new ArtifactFieldFormatError(path, field.type, 'error', [{
			code: 'field_format_error',
			message: error instanceof Error ? error.message : 'Unexpected field formatting failure.',
			path,
			kind: field.type,
			cause: error,
		}], error)
	}
}

export function formatFieldValue(
	formatter: Formatter,
	field: FormField,
	value: unknown,
	path: string,
	options?: FieldFormattingOptions,
): unknown {
	if (field.type === 'list') {
		if (isMissing(value)) return missingValue(value, path, field.type, options)
		if (!Array.isArray(value)) throw formatIssue(path, field.type, 'invalid_value', 'Expected an array for a list field.')
		return value.map((item, index) => formatFieldValue(formatter, field.item, item, childPath(path, index), options))
	}

	if (field.type === 'fieldset') {
		if (isMissing(value)) return missingValue(value, path, field.type, options)
		if (!isRecord(value)) throw formatIssue(path, field.type, 'invalid_value', 'Expected an object for a fieldset.')
		const result: RecordValue = { ...value }
		for (const [key, child] of Object.entries(field.fields)) {
			if (Object.prototype.hasOwnProperty.call(value, key) || options?.progressive) {
				result[key] = formatFieldValue(formatter, child, value[key], childPath(path, key), options)
			}
		}
		return result
	}

	return formatLeaf(formatter, field, value, path, options)
}

export function formatDefinitionValue(
	formatter: Formatter,
	type: string,
	value: unknown,
	path: string,
	options?: FieldFormattingOptions,
): unknown {
	if (isMissing(value)) return missingValue(value, path, type, options)
	try {
		switch (type) {
			case 'money': return callFormatter(path, type, value, () => formatter.safeFormatMoney(recordInput(value, path, type)), options)
			case 'address': return callFormatter(path, type, value, () => formatter.safeFormatAddress(recordInput(value, path, type)), options)
			case 'phone': return callFormatter(path, type, value, () => formatter.safeFormatPhone(typeof value === 'string' ? value : recordInput(value, path, type)), options)
			case 'person': return callFormatter(path, type, value, () => formatter.safeFormatPerson(recordInput(value, path, type)), options)
			case 'organization': return callFormatter(path, type, value, () => formatter.safeFormatOrganization(recordInput(value, path, type)), options)
			case 'party': return callFormatter(path, type, value, () => formatter.safeFormatParty(recordInput(value, path, type)), options)
			case 'coordinate': return callFormatter(path, type, value, () => formatter.safeFormatCoordinate(recordInput(value, path, type)), options)
			case 'bbox': return callFormatter(path, type, value, () => formatter.safeFormatBbox(recordInput(value, path, type)), options)
			case 'duration': return callFormatter(path, type, value, () => formatter.safeFormatDuration(stringInput(value, path, type)), options)
			case 'identification': return callFormatter(path, type, value, () => formatter.safeFormatIdentification(recordInput(value, path, type)), options)
			case 'attachment': return callFormatter(path, type, value, () => formatter.safeFormatAttachment(recordInput(value, path, type)), options)
			case 'signature': return callFormatter(path, type, value, () => formatter.safeFormatSignature(recordInput(value, path, type)), options)
			case 'date': return callFormatter(path, type, value, () => formatter.safeFormatDate(dateInput(value, path, type)), options)
			case 'datetime': return callFormatter(path, type, value, () => formatter.safeFormatDatetime(dateInput(value, path, type)), options)
			case 'time': return callFormatter(path, type, value, () => formatter.safeFormatTime(stringInput(value, path, type)), options)
			case 'number': return callFormatter(path, type, value, () => formatter.safeFormatNumber(numberInput(value, path, type)), options)
			// A computed value carries no field, so only a formatter-level scale can apply.
			case 'rating': return callFormatterWithFallback(
				path,
				type,
				value,
				() => formatter.safeFormatRating(numberInput(value, path, type)),
				{
					code: MISSING_RATING_SCALE,
					substitute: () => formatter.safeFormatNumber(numberInput(value, path, type)),
					options,
				},
			)
			case 'integer': {
				const number = numberInput(value, path, type)
				if (!Number.isInteger(number)) throw formatIssue(path, type, 'invalid_value', 'Expected an integer value.')
				return callFormatter(path, type, value, () => formatter.safeFormatNumber(number), options)
			}
			case 'percentage': return callFormatter(path, type, value, () => formatter.safeFormatPercentage(numberInput(value, path, type)), options)
			case 'boolean': return callFormatter(path, type, value, () => formatter.safeFormatBoolean(booleanInput(value, path, type)), options)
			case 'string': return stringInput(value, path, type)
			default: throw new ArtifactFieldFormatError(path, type, 'unsupported', [{ code: 'unsupported_type', message: `Unsupported computed value type ${JSON.stringify(type)}.`, path, kind: type }])
		}
	} catch (error) {
		if (error instanceof ArtifactFieldFormatError) throw error
		throw new ArtifactFieldFormatError(path, type, 'error', [{ code: 'computed_format_error', message: error instanceof Error ? error.message : 'Unexpected computed value formatting failure.', path, kind: type, cause: error }], error)
	}
}

export function formatParties(
	formatter: Formatter,
	form: Form,
	value: unknown,
	path: string,
	options?: FieldFormattingOptions,
	role?: string,
): unknown {
	if (isMissing(value)) return missingValue(value, path, 'party', options)
	if (Array.isArray(value)) return value.map((entry, index) => formatParties(formatter, form, entry, childPath(path, index), options, role))
	const party = recordInput(value, path, 'party')
	const partyType = role ? form.parties?.[role]?.partyType : undefined
	return callFormatter(path, 'party', value, () => formatter.safeFormatParty(party, partyType === 'person' || partyType === 'organization' ? { partyType } : undefined), options)
}

function formatAnnexes(
	formatter: Formatter,
	form: Form,
	value: unknown,
	options?: FieldFormattingOptions,
): unknown {
	if (!isRecord(value)) {
		if (isMissing(value)) return options?.progressive ? {} : value
		throw formatIssue('annexes', 'attachment', 'invalid_value', 'Expected annexes to be an object.')
	}
	const result: RecordValue = { ...value }
	for (const [key, annexValue] of Object.entries(value)) {
		const path = `annexes.${key}`
		const definition: FormAnnex | undefined = form.annexes?.[key]
		if (!definition && !form.allowAdditionalAnnexes) throw formatIssue(path, 'attachment', 'unknown_path', `Unknown annex ${JSON.stringify(key)}.`)
		if (isMissing(annexValue)) result[key] = missingValue(annexValue, path, 'attachment', options)
		else result[key] = callFormatter(path, 'attachment', annexValue, () => formatter.safeFormatAttachment(recordInput(annexValue, path, 'attachment')), options)
	}
	for (const key of Object.keys(form.annexes ?? {})) {
		if (!Object.prototype.hasOwnProperty.call(result, key) && options?.progressive) {
			result[key] = missingValue(undefined, `annexes.${key}`, 'attachment', options)
		}
	}
	return result
}

function formatDefs(
	formatter: Formatter,
	definitions: DefsSection | undefined,
	values: unknown,
	options?: FieldFormattingOptions,
): unknown {
	if (!isRecord(values)) {
		if (isMissing(values)) return values
		throw formatIssue('defs', 'computed', 'invalid_value', 'Expected computed values to be an object.')
	}
	const result: RecordValue = { ...values }
	for (const [key, definition] of Object.entries(definitions ?? {})) {
		if (Object.prototype.hasOwnProperty.call(values, key)) {
			result[key] = formatDefinitionValue(formatter, definition.type, values[key], `defs.${key}`, options)
		} else if (options?.progressive) {
			result[key] = missingValue(undefined, `defs.${key}`, definition.type, options)
		}
	}
	for (const key of Object.keys(values)) {
		if (!definitions?.[key]) throw formatIssue(`defs.${key}`, 'computed', 'unknown_path', `Unknown computed value ${JSON.stringify(key)}.`)
	}
	return result
}

/** Apply one formatter to all declared field-aware values in a text render payload. */
export function formatFieldData(
	data: RecordValue,
	form: Form,
	formatter: Formatter,
	options?: FieldFormattingOptions,
): RecordValue {
	const result: RecordValue = { ...data }
	for (const [key, field] of Object.entries(form.fields ?? {})) {
		if (Object.prototype.hasOwnProperty.call(data, key) || options?.progressive) {
			result[key] = formatFieldValue(formatter, field, data[key], `fields.${key}`, options)
		}
	}

	if (Object.prototype.hasOwnProperty.call(data, 'parties') || (options?.progressive && form.parties)) {
		const parties = data.parties
		if (!isMissing(parties) && !isRecord(parties)) throw formatIssue('parties', 'party', 'invalid_value', 'Expected parties to be an object.')
		const partyValues: RecordValue = isRecord(parties) ? parties : {}
		const formattedParties: RecordValue = { ...partyValues }
		for (const [role, value] of Object.entries(partyValues)) {
			if (!form.parties?.[role]) throw formatIssue(`parties.${role}`, 'party', 'unknown_path', `Unknown party role ${JSON.stringify(role)}.`)
			formattedParties[role] = formatParties(formatter, form, value, `parties.${role}`, options, role)
		}
		for (const role of Object.keys(form.parties ?? {})) {
			if (!Object.prototype.hasOwnProperty.call(formattedParties, role) && options?.progressive) {
				formattedParties[role] = formatParties(formatter, form, undefined, `parties.${role}`, options, role)
			}
		}
		result.parties = formattedParties
	}

	if (Object.prototype.hasOwnProperty.call(data, 'defs')) result.defs = formatDefs(formatter, form.defs, data.defs, options)
	if (Object.prototype.hasOwnProperty.call(data, 'defs') === false && options?.progressive && form.defs) {
		result.defs = formatDefs(formatter, form.defs, {}, options)
	}
	if (Object.prototype.hasOwnProperty.call(data, 'annexes') || (options?.progressive && form.annexes)) {
		result.annexes = formatAnnexes(formatter, form, data.annexes, options)
	}
	return result
}

const metadataRoots = new Set([
	'parties',
	'defs',
	'annexes',
	'schema',
	'_signers',
	'_captures',
	'_executedAt',
	'title',
	'description',
	'items',
])

function isIndex(segment: string): boolean {
	return /^\d+$/.test(segment) && Number.isSafeInteger(Number(segment))
}

const anyPath = Symbol('any-path')
interface PathObjectNode {
	readonly [segment: string]: PathNode
}

type PathNode = PathObjectNode | typeof anyPath

const leafPath: PathNode = Object.freeze({})
const blockedPathSegments = new Set(['__proto__', 'prototype', 'constructor'])

function objectPath(entries: Record<string, PathNode>): PathNode {
	return Object.freeze(entries)
}

function mergePaths(...nodes: PathNode[]): PathNode {
	if (nodes.some((node) => node === anyPath)) return anyPath
	return objectPath(Object.assign({}, ...nodes))
}

const moneyPath = objectPath({ amount: leafPath, currency: leafPath })
const addressPath = objectPath({
	line1: leafPath,
	line2: leafPath,
	locality: leafPath,
	region: leafPath,
	postalCode: leafPath,
	country: leafPath,
})
const phonePath = objectPath({ number: leafPath, type: leafPath, extension: leafPath })
const personPath = objectPath({ name: leafPath, title: leafPath, firstName: leafPath, middleName: leafPath, lastName: leafPath, suffix: leafPath })
const organizationPath = objectPath({
	name: leafPath,
	legalName: leafPath,
	domicile: leafPath,
	entityType: leafPath,
	entityId: leafPath,
	taxId: leafPath,
})
const coordinatePath = objectPath({ lat: leafPath, lon: leafPath })
const bboxPath = objectPath({
	southWest: coordinatePath,
	northEast: coordinatePath,
})
const identificationPath = objectPath({
	type: leafPath,
	number: leafPath,
	issuer: leafPath,
	issueDate: leafPath,
	expiryDate: leafPath,
})
const attachmentPath = objectPath({ name: leafPath, mimeType: leafPath, checksum: leafPath })
const signaturePath = objectPath({ image: leafPath, timestamp: leafPath, method: leafPath, type: leafPath, metadata: anyPath })
const signerPath = objectPath({
	signerId: leafPath,
	capacity: leafPath,
	_role: leafPath,
	_partyId: leafPath,
	id: leafPath,
	signer: objectPath({
		id: leafPath,
		person: personPath,
		adopted: objectPath({ signature: signaturePath, initials: signaturePath }),
	}),
})
const partyRuntimePath = objectPath({
	id: leafPath,
	_role: leafPath,
	signatories: objectPath({ '#': signerPath }),
	_captures: anyPath,
	_signers: anyPath,
})

const pathNodesByType: Readonly<Record<string, PathNode>> = {
	money: moneyPath,
	address: addressPath,
	phone: phonePath,
	person: personPath,
	organization: organizationPath,
	party: mergePaths(personPath, organizationPath, partyRuntimePath),
	coordinate: coordinatePath,
	bbox: bboxPath,
	identification: identificationPath,
	attachment: attachmentPath,
	signature: signaturePath,
	string: leafPath,
	text: leafPath,
	email: leafPath,
	uuid: leafPath,
	uri: leafPath,
	duration: leafPath,
	date: leafPath,
	datetime: leafPath,
	time: leafPath,
	number: leafPath,
	integer: leafPath,
	percentage: leafPath,
	rating: leafPath,
	boolean: leafPath,
	enum: leafPath,
	multiselect: leafPath,
}

function pathNodeForType(type: string): PathNode | undefined {
	return pathNodesByType[type]
}

function hasOwn(value: unknown, key: string): boolean {
	return value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key)
}

function validatePathSyntax(path: string): boolean {
	if (!path || path.startsWith('.') || path.endsWith('.') || path.includes('..')) return false
	return path.split('.').every((segment) => /^[^.[\]]+(?:\[\d+\])*$/.test(segment))
}

function validatePathNode(node: PathNode, segments: readonly string[], index: number, path: string, fieldType: string): void {
	if (index >= segments.length || node === anyPath) return
	const segment = segments[index]!
	if (blockedPathSegments.has(segment)) {
		throw formatIssue(path, fieldType, 'unknown_path', `Blocked path segment ${JSON.stringify(segment)}.`)
	}

	let child: PathNode | undefined
	if (Object.prototype.hasOwnProperty.call(node, segment)) {
		child = node[segment]
	} else if (Object.prototype.hasOwnProperty.call(node, '#')) {
		if (!isIndex(segment)) {
			throw formatIssue(path, fieldType, 'unknown_path', `Expected a safe numeric index before ${JSON.stringify(segment)}.`)
		}
		child = node['#']
	} else if (Object.prototype.hasOwnProperty.call(node, '*')) {
		child = node['*']
	}

	if (!child) {
		throw formatIssue(path, fieldType, 'unknown_path', `Unknown ${fieldType} member ${JSON.stringify(segment)}.`)
	}
	validatePathNode(child, segments, index + 1, path, fieldType)
}

function validateDeclaredField(field: FormField, segments: readonly string[], index: number, path: string): void {
	if (index >= segments.length) return
	const segment = segments[index]!
	if (field.type === 'list') {
		if (!isIndex(segment)) throw formatIssue(path, field.type, 'unknown_path', `Expected a list index before ${JSON.stringify(segment)}.`)
		return validateDeclaredField(field.item, segments, index + 1, path)
	}
	if (field.type === 'fieldset') {
		const child = hasOwn(field.fields, segment) ? field.fields[segment] : undefined
		if (!child) throw formatIssue(path, field.type, 'unknown_path', `Unknown nested field ${JSON.stringify(segment)}.`)
		return validateDeclaredField(child, segments, index + 1, path)
	}
	const node = pathNodeForType(field.type)
	if (!node) throw formatIssue(path, field.type, 'unsupported_path', `Unsupported field type ${JSON.stringify(field.type)}.`)
	validatePathNode(node, segments, index, path, field.type)
}

function validatePartyPath(form: Form, segments: readonly string[], path: string): void {
	const role = segments[0]
	const definition = role && hasOwn(form.parties, role) ? form.parties?.[role] : undefined
	if (!role || !definition) throw formatIssue(path, 'party', 'unknown_path', `Unknown party role ${JSON.stringify(role)}.`)
	if (segments.length === 1) return

	const max = definition.max ?? 1
	const segment = segments[1]!
	const indexed = isIndex(segment)
	const isCollection = max > 1
	if (indexed) {
		if (!isCollection) throw formatIssue(path, 'party', 'unknown_path', `Party role ${JSON.stringify(role)} does not accept an index.`)
		if (Number(segment) >= max) throw formatIssue(path, 'party', 'unknown_path', `Party index ${segment} is outside the declared maximum of ${max}.`)
		if (segments.length === 2) return
		validatePathNode(partyPathNode(definition.partyType), segments, 2, path, 'party')
		return
	}
	if (isCollection) throw formatIssue(path, 'party', 'unknown_path', `Party role ${JSON.stringify(role)} requires an index.`)
	validatePathNode(partyPathNode(definition.partyType), segments, 1, path, 'party')
}

function partyPathNode(partyType: string | undefined): PathNode {
	const identity = partyType === 'person'
		? personPath
		: partyType === 'organization'
			? organizationPath
			: mergePaths(personPath, organizationPath)
	return mergePaths(identity, partyRuntimePath)
}

function validateBindingPath(form: Form, sourcePath: string, bindingKey: string): void {
	const path = sourcePath.startsWith('fields.') ? sourcePath.slice('fields.'.length) : sourcePath
	if (!validatePathSyntax(path)) throw formatIssue(`bindings.${bindingKey}`, 'path', 'unknown_path', `Malformed field path ${JSON.stringify(sourcePath)}.`)
	const segments = pathSegments(path)
	if (segments.length === 0) throw formatIssue(`bindings.${bindingKey}`, 'path', 'unknown_path', `Unknown field path ${JSON.stringify(sourcePath)}.`)
	const root = segments[0]!
	if (root === 'parties') {
		validatePartyPath(form, segments.slice(1), sourcePath)
		return
	}
	if (root === 'defs') {
		const definitionKey = segments[1]
		const definition = definitionKey && hasOwn(form.defs, definitionKey) ? form.defs?.[definitionKey] : undefined
		if (!definition) throw formatIssue(sourcePath, 'computed', 'unknown_path', `Unknown computed value ${JSON.stringify(definitionKey)}.`)
		if (segments.length > 2) {
			const node = pathNodeForType(definition.type)
			if (!node) throw formatIssue(sourcePath, 'computed', 'unsupported_path', `Unsupported computed value type ${JSON.stringify(definition.type)}.`)
			validatePathNode(node, segments, 2, sourcePath, definition.type)
		}
		return
	}
	if (root === 'annexes') {
		const annex = segments[1]
		if (!annex || (!hasOwn(form.annexes, annex) && !form.allowAdditionalAnnexes)) {
			throw formatIssue(sourcePath, 'attachment', 'unknown_path', `Unknown annex ${JSON.stringify(annex)}.`)
		}
		if (segments.length > 2) validatePathNode(attachmentPath, segments, 2, sourcePath, 'attachment')
		return
	}
	const field = form.fields?.[root]
	if (field) {
		validateDeclaredField(field, segments, 1, sourcePath)
		return
	}
	if (metadataRoots.has(root)) return
	throw formatIssue(sourcePath, 'path', 'unknown_path', `Unknown field path ${JSON.stringify(sourcePath)}.`)
}

/** Validate renderer binding sources against the declared artifact shape. */
export function validateFieldBindings(form: Form, bindings: Bindings): void {
	for (const [bindingKey, sourcePath] of Object.entries(bindings)) {
		validateBindingPath(form, sourcePath, bindingKey)
	}
}
