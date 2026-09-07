import type {
	FormatIssue,
	FormatResult,
	Formatter,
	FormatterProgressivePolicy,
	Form,
	FormField,
	FormAnnex,
	DefsSection,
	Bindings,
} from '@paradoc/types'
import { pathSegments } from '../path'

/** Explicit policy for rendering a value that is missing or incomplete. */
export type ProgressiveFormattingOptions = FormatterProgressivePolicy

export interface FieldFormattingOptions {
	/** Enable placeholders for missing/incomplete values for a progressive preview. */
	progressive?: ProgressiveFormattingOptions
}

type RecordValue = Record<string, unknown>

const rawValues = new WeakMap<FormattedFieldValue, unknown>()
const renderedValues = new WeakMap<FormattedFieldValue, string>()

/**
 * A template value that keeps its source value for logic/property access while
 * supplying the selected formatter's text for interpolation.
 */
export class FormattedFieldValue {
	constructor(value: unknown, text: string) {
		if (value !== null && typeof value === 'object') {
			for (const [key, member] of Object.entries(value)) {
				if (key === 'toString' || key === '__proto__' || key === 'constructor' || key === 'prototype') continue
				Object.defineProperty(this, key, { configurable: false, enumerable: true, value: member, writable: false })
			}
		}
		rawValues.set(this, value)
		renderedValues.set(this, text)
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

function callFormatter(
	formatter: Formatter,
	path: string,
	fieldType: string,
	value: unknown,
	call: () => FormatResult,
	options?: FieldFormattingOptions,
): unknown {
	try {
		return presentResult(call(), value, path, fieldType, options)
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

function messageFor(formatter: Formatter, key: string, path: string): string {
	const findMessage = (locale: string | undefined): string | undefined => {
		if (!locale) return undefined
		const exact = formatter.messages[locale]?.[key]
		if (exact !== undefined) return exact
		const language = locale.split('-')[0]
		return Object.entries(formatter.messages).find(([candidate]) => candidate.split('-')[0] === language)?.[1]?.[key]
	}

	const message = findMessage(formatter.locale) ?? findMessage(formatter.fallbackLocale)
	if (message !== undefined) return message
	throw new ArtifactFieldFormatError(path, 'boolean', 'unsupported', [{
		code: 'missing_message',
		message: `No ${JSON.stringify(key)} message is available for locale ${JSON.stringify(formatter.locale)}.`,
		path,
		kind: 'boolean',
	}])
}

function enumLabel(field: Extract<FormField, { type: 'enum' }>, value: unknown, path: string): string {
	if (typeof value !== 'string' && typeof value !== 'number') {
		throw formatIssue(path, field.type, 'invalid_value', 'Expected a string or number enum value.')
	}
	const option = field.enum.find((candidate) => candidate.value === value)
	if (!option) throw formatIssue(path, field.type, 'invalid_value', `Unknown enum value ${JSON.stringify(value)}.`)
	return option.label ?? String(value)
}

function multiselectLabel(field: Extract<FormField, { type: 'multiselect' }>, value: unknown, path: string): string {
	if (!Array.isArray(value)) throw formatIssue(path, field.type, 'invalid_value', 'Expected an array of multiselect values.')
	return value.map((entry) => {
		if (typeof entry !== 'string' && typeof entry !== 'number') {
			throw formatIssue(path, field.type, 'invalid_value', 'Expected string or number multiselect values.')
		}
		const option = field.enum.find((candidate) => candidate.value === entry)
		if (!option) throw formatIssue(path, field.type, 'invalid_value', `Unknown multiselect value ${JSON.stringify(entry)}.`)
		return option.label ?? String(entry)
	}).join(', ')
}

function formatBoolean(formatter: Formatter, value: unknown, path: string): unknown {
	if (typeof value !== 'boolean') throw formatIssue(path, 'boolean', 'invalid_value', 'Expected a boolean value.')
	return new FormattedFieldValue(value, messageFor(formatter, value ? 'boolean.true' : 'boolean.false', path))
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
			case 'money': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatMoney(recordInput(value, path, field.type)), options)
			case 'address': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatAddress(recordInput(value, path, field.type)), options)
			case 'phone': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatPhone(typeof value === 'string' ? value : recordInput(value, path, field.type)), options)
			case 'person': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatPerson(recordInput(value, path, field.type)), options)
			case 'organization': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatOrganization(recordInput(value, path, field.type)), options)
			case 'coordinate': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatCoordinate(recordInput(value, path, field.type)), options)
			case 'bbox': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatBbox(recordInput(value, path, field.type)), options)
			case 'duration': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatDuration(stringInput(value, path, field.type)), options)
			case 'identification': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatIdentification(recordInput(value, path, field.type)), options)
			case 'date': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatDate(dateInput(value, path, field.type)), options)
			case 'datetime': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatDatetime(dateInput(value, path, field.type)), options)
			case 'time': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatTime(stringInput(value, path, field.type)), options)
			case 'number': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatNumber(numberInput(value, path, field.type)), options)
			case 'percentage': return callFormatter(formatter, path, field.type, value, () => formatter.safeFormatPercentage(numberInput(value, path, field.type)), options)
			case 'boolean': return formatBoolean(formatter, value, path)
			case 'enum': return new FormattedFieldValue(value, enumLabel(field, value, path))
			case 'multiselect': return new FormattedFieldValue(value, multiselectLabel(field, value, path))
			case 'text':
			case 'email':
			case 'uuid':
			case 'uri': return stringInput(value, path, field.type)
			case 'rating': return numberInput(value, path, field.type)
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

function formatFieldValue(
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

function formatDefinitionValue(
	formatter: Formatter,
	type: string,
	value: unknown,
	path: string,
	options?: FieldFormattingOptions,
): unknown {
	if (isMissing(value)) return missingValue(value, path, type, options)
	try {
		switch (type) {
			case 'money': return callFormatter(formatter, path, type, value, () => formatter.safeFormatMoney(recordInput(value, path, type)), options)
			case 'address': return callFormatter(formatter, path, type, value, () => formatter.safeFormatAddress(recordInput(value, path, type)), options)
			case 'phone': return callFormatter(formatter, path, type, value, () => formatter.safeFormatPhone(typeof value === 'string' ? value : recordInput(value, path, type)), options)
			case 'person': return callFormatter(formatter, path, type, value, () => formatter.safeFormatPerson(recordInput(value, path, type)), options)
			case 'organization': return callFormatter(formatter, path, type, value, () => formatter.safeFormatOrganization(recordInput(value, path, type)), options)
			case 'party': return callFormatter(formatter, path, type, value, () => formatter.safeFormatParty(recordInput(value, path, type)), options)
			case 'coordinate': return callFormatter(formatter, path, type, value, () => formatter.safeFormatCoordinate(recordInput(value, path, type)), options)
			case 'bbox': return callFormatter(formatter, path, type, value, () => formatter.safeFormatBbox(recordInput(value, path, type)), options)
			case 'duration': return callFormatter(formatter, path, type, value, () => formatter.safeFormatDuration(stringInput(value, path, type)), options)
			case 'identification': return callFormatter(formatter, path, type, value, () => formatter.safeFormatIdentification(recordInput(value, path, type)), options)
			case 'attachment': return callFormatter(formatter, path, type, value, () => formatter.safeFormatAttachment(recordInput(value, path, type)), options)
			case 'signature': return callFormatter(formatter, path, type, value, () => formatter.safeFormatSignature(recordInput(value, path, type)), options)
			case 'date': return callFormatter(formatter, path, type, value, () => formatter.safeFormatDate(dateInput(value, path, type)), options)
			case 'datetime': return callFormatter(formatter, path, type, value, () => formatter.safeFormatDatetime(dateInput(value, path, type)), options)
			case 'time': return callFormatter(formatter, path, type, value, () => formatter.safeFormatTime(stringInput(value, path, type)), options)
			case 'number':
			case 'rating': return callFormatter(formatter, path, type, value, () => formatter.safeFormatNumber(numberInput(value, path, type)), options)
			case 'integer': {
				const number = numberInput(value, path, type)
				if (!Number.isInteger(number)) throw formatIssue(path, type, 'invalid_value', 'Expected an integer value.')
				return callFormatter(formatter, path, type, value, () => formatter.safeFormatNumber(number), options)
			}
			case 'percentage': return callFormatter(formatter, path, type, value, () => formatter.safeFormatPercentage(numberInput(value, path, type)), options)
			case 'boolean': return formatBoolean(formatter, value, path)
			case 'string': return stringInput(value, path, type)
			default: throw new ArtifactFieldFormatError(path, type, 'unsupported', [{ code: 'unsupported_type', message: `Unsupported computed value type ${JSON.stringify(type)}.`, path, kind: type }])
		}
	} catch (error) {
		if (error instanceof ArtifactFieldFormatError) throw error
		throw new ArtifactFieldFormatError(path, type, 'error', [{ code: 'computed_format_error', message: error instanceof Error ? error.message : 'Unexpected computed value formatting failure.', path, kind: type, cause: error }], error)
	}
}

function formatParties(
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
	return callFormatter(formatter, path, 'party', value, () => formatter.safeFormatParty(party, partyType === 'person' || partyType === 'organization' ? { partyType } : undefined), options)
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
		else result[key] = callFormatter(formatter, path, 'attachment', annexValue, () => formatter.safeFormatAttachment(recordInput(annexValue, path, 'attachment')), options)
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
