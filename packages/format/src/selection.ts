import { resolveMessage } from './messages'
import type {
	BooleanFormatOptions,
	EnumFormatOptions,
	FormatIssue,
	FormatterMessages,
	MultiselectFormatOptions,
	NumberFormatOptions,
	RatingFormatOptions,
	SelectionListStyle,
	SelectionListType,
	SelectionFormatKind,
	SelectionOption,
	SelectionOptionValue,
} from './types'

export type SelectionStatus = 'missing' | 'incomplete' | 'invalid'

/** Any one kind's selection options, as `validateSelectionOptions` receives them. */
export type SelectionOptionsByKind =
	| BooleanFormatOptions
	| EnumFormatOptions
	| MultiselectFormatOptions
	| RatingFormatOptions

/**
 * The `unsupported` outcome a rating with no declared scale returns. A caller
 * that has a documented plain presentation keys its fallback off this code.
 */
export const MISSING_RATING_SCALE = 'missing_scale'

/**
 * The `unsupported` outcome a multiselect returns when the runtime carries no
 * list conjunction for the locale. A caller that has a documented plain join
 * keys its fallback off this code.
 */
export const UNSUPPORTED_LIST_JOIN = 'unsupported_list'

export interface SelectionValidationSuccess<T> {
	ok: true
	value: T
}

export interface SelectionValidationFailure {
	ok: false
	status: SelectionStatus
	issues: readonly FormatIssue[]
}

export type SelectionValidation<T> = SelectionValidationSuccess<T> | SelectionValidationFailure

/** What a selection formatter needs from the formatter that owns it. */
export interface SelectionFormattingContext {
	readonly locale: string
	readonly messages: FormatterMessages
	readonly fallbackLocale?: string
	readonly formatNumber: (value: number, options: NumberFormatOptions) => string
	/**
	 * Presents one option through the effective enum formatter, so an `enum`
	 * override reaches a multiselect's labels the way a `person` override
	 * reaches a person party.
	 */
	readonly formatEnum: (value: SelectionOptionValue, options: EnumFormatOptions) => string
	/** Returns the locale's list joiner, or `undefined` when the runtime has none for it. */
	readonly listFormat: (type: SelectionListType, style: SelectionListStyle) => Intl.ListFormat | undefined
}

export class MissingSelectionMessageError extends Error {
	constructor(readonly key: string, readonly locale: string) {
		super(`No selection message ${JSON.stringify(key)} is available for locale ${JSON.stringify(locale)}.`)
		this.name = 'MissingSelectionMessageError'
	}
}

/**
 * Raised when a selection value cannot be presented. `invalid` means the data
 * and the declaration have drifted apart; `unsupported` means the presentation
 * itself is unavailable, which is what a caller's documented fallback answers.
 */
export class SelectionFormatError extends Error {
	constructor(
		readonly status: 'invalid' | 'unsupported',
		readonly code: string,
		message: string,
	) {
		super(message)
		this.name = 'SelectionFormatError'
	}
}

export const BUILT_IN_SELECTION_MESSAGES: FormatterMessages = {
	'en-US': { 'boolean.true': 'Yes', 'boolean.false': 'No', 'rating.scale': '{value} of {max}' },
	'en-GB': { 'boolean.true': 'Yes', 'boolean.false': 'No', 'rating.scale': '{value} of {max}' },
	'de-DE': { 'boolean.true': 'Ja', 'boolean.false': 'Nein', 'rating.scale': '{value} von {max}' },
	'fr-FR': { 'boolean.true': 'Oui', 'boolean.false': 'Non', 'rating.scale': '{value} sur {max}' },
	'ar-SA': { 'boolean.true': 'نعم', 'boolean.false': 'لا', 'rating.scale': '{value} من {max}' },
}

const LIST_TYPES: readonly SelectionListType[] = ['conjunction', 'disjunction', 'unit']
const LIST_STYLES: readonly SelectionListStyle[] = ['long', 'short', 'narrow']
const UNKNOWN_OPTION_POLICIES = ['error', 'value'] as const
const RATING_DISPLAYS = ['scale', 'value'] as const

function isMissing(value: unknown): value is null | undefined {
	return value === null || value === undefined
}

function selectionIssue(kind: string, code: string, message: string, path?: string): FormatIssue {
	return { kind, code, message, ...(path === undefined ? {} : { path }) }
}

function isOptionValue(value: unknown): value is SelectionOptionValue {
	return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
}

export function validateBoolean(value: unknown): SelectionValidation<boolean> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [selectionIssue('boolean', 'missing_value', 'Boolean value is missing.')] }
	}
	if (typeof value !== 'boolean') {
		return { ok: false, status: 'invalid', issues: [selectionIssue('boolean', 'invalid_boolean', 'Boolean value must be true or false.')] }
	}
	return { ok: true, value }
}

export function validateEnumValue(value: unknown): SelectionValidation<SelectionOptionValue> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [selectionIssue('enum', 'missing_value', 'Enum value is missing.')] }
	}
	if (!isOptionValue(value)) {
		return { ok: false, status: 'invalid', issues: [selectionIssue('enum', 'invalid_enum', 'Enum value must be a string or a finite number.')] }
	}
	return { ok: true, value }
}

export function validateMultiselectValue(value: unknown): SelectionValidation<readonly SelectionOptionValue[]> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [selectionIssue('multiselect', 'missing_value', 'Multiselect value is missing.')] }
	}
	if (!Array.isArray(value)) {
		return { ok: false, status: 'invalid', issues: [selectionIssue('multiselect', 'invalid_multiselect', 'Multiselect value must be an array of selected option values.')] }
	}
	const issues: FormatIssue[] = []
	value.forEach((entry, index) => {
		if (!isOptionValue(entry)) {
			issues.push(selectionIssue('multiselect', 'invalid_member', 'Every selected value must be a string or a finite number.', `[${index}]`))
		}
	})
	if (issues.length > 0) return { ok: false, status: 'invalid', issues }
	return { ok: true, value: value as readonly SelectionOptionValue[] }
}

export function validateRating(value: unknown): SelectionValidation<number> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [selectionIssue('rating', 'missing_value', 'Rating value is missing.')] }
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return { ok: false, status: 'invalid', issues: [selectionIssue('rating', 'invalid_rating', 'Rating value must be a finite number.')] }
	}
	return { ok: true, value }
}

function validateBooleanOptions(options: BooleanFormatOptions): void {
	for (const key of ['trueLabel', 'falseLabel'] as const) {
		const label = options[key]
		if (label !== undefined && typeof label !== 'string') throw new Error(`The boolean ${key} must be a string.`)
	}
}

function validateOptionList(kind: 'enum' | 'multiselect', options: EnumFormatOptions): void {
	if (options.options !== undefined) {
		if (!Array.isArray(options.options)) throw new Error(`The ${kind} options must be an array of declared options.`)
		for (const option of options.options) {
			if (option === null || typeof option !== 'object' || !isOptionValue((option as SelectionOption).value)) {
				throw new Error(`Every ${kind} option must declare a string or finite number value.`)
			}
		}
	}
	if (options.unknownOption !== undefined && !UNKNOWN_OPTION_POLICIES.includes(options.unknownOption)) {
		throw new Error(`The ${kind} unknownOption policy must be error or value.`)
	}
}

function validateMultiselectOptions(options: MultiselectFormatOptions): void {
	validateOptionList('multiselect', options)
	if (options.listType !== undefined && !LIST_TYPES.includes(options.listType)) {
		throw new Error('The multiselect listType must be conjunction, disjunction, or unit.')
	}
	if (options.listStyle !== undefined && !LIST_STYLES.includes(options.listStyle)) {
		throw new Error('The multiselect listStyle must be long, short, or narrow.')
	}
}

function validateRatingOptions(options: RatingFormatOptions): void {
	if (options.max !== undefined && (typeof options.max !== 'number' || !Number.isFinite(options.max))) {
		throw new Error('The rating max must be a finite number.')
	}
	if (options.display !== undefined && !RATING_DISPLAYS.includes(options.display)) {
		throw new Error('The rating display must be scale or value.')
	}
}

/** Rejects selection configuration a formatter cannot act on, before any value reaches it. */
export function validateSelectionOptions(kind: SelectionFormatKind, options: SelectionOptionsByKind): void {
	if (kind === 'boolean') return validateBooleanOptions(options as BooleanFormatOptions)
	if (kind === 'enum') return validateOptionList('enum', options as EnumFormatOptions)
	if (kind === 'multiselect') return validateMultiselectOptions(options as MultiselectFormatOptions)
	return validateRatingOptions(options as RatingFormatOptions)
}

function selectionMessage(context: SelectionFormattingContext, key: string): string {
	return resolveMessage(
		context.messages,
		context.locale,
		key,
		context.fallbackLocale,
		(missingKey, locale) => new MissingSelectionMessageError(missingKey, locale),
	)
}

export function formatBooleanValue(
	value: boolean,
	options: BooleanFormatOptions,
	context: SelectionFormattingContext,
): string {
	const supplied = value ? options.trueLabel : options.falseLabel
	if (supplied !== undefined) return supplied
	return selectionMessage(context, value ? 'boolean.true' : 'boolean.false')
}

/**
 * Presents one selected value with the label its declared option carries. A
 * value no option declares is a fault by default, because printing it raw
 * hides an artifact whose data and declaration have drifted apart.
 */
export function formatEnumValue(
	value: SelectionOptionValue,
	options: EnumFormatOptions,
	kind: 'enum' | 'multiselect' = 'enum',
): string {
	const option = (options.options ?? []).find((candidate) => candidate.value === value)
	if (option !== undefined) return option.label ?? String(value)
	if ((options.unknownOption ?? 'error') === 'value') return String(value)
	throw new SelectionFormatError(
		'invalid',
		'unknown_option',
		`No declared ${kind} option carries the value ${JSON.stringify(value)}.`,
	)
}

export function formatMultiselectValue(
	value: readonly SelectionOptionValue[],
	options: MultiselectFormatOptions,
	context: SelectionFormattingContext,
): string {
	const labels = value.map((entry) => context.formatEnum(entry, options))
	const listFormat = context.listFormat(options.listType ?? 'conjunction', options.listStyle ?? 'long')
	if (listFormat === undefined) {
		throw new SelectionFormatError(
			'unsupported',
			UNSUPPORTED_LIST_JOIN,
			`Locale ${JSON.stringify(context.locale)} has no list conjunction in this runtime.`,
		)
	}
	return listFormat.format(labels)
}

/**
 * Presents a rating with the scale it was given on, so "4" cannot be read as
 * four out of ten. A rating whose field declares no scale is unsupported; the
 * caller decides whether to print the bare number instead.
 */
export function formatRatingValue(
	value: number,
	options: RatingFormatOptions,
	context: SelectionFormattingContext,
): string {
	const number = context.formatNumber(value, {})
	if ((options.display ?? 'scale') === 'value') return number
	if (options.max === undefined) {
		throw new SelectionFormatError('unsupported', MISSING_RATING_SCALE, 'The rating declares no maximum, so it has no scale to print.')
	}
	const template = selectionMessage(context, 'rating.scale')
	return template
		.replaceAll('{value}', number)
		.replaceAll('{max}', context.formatNumber(options.max, {}))
}
