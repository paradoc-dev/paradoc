import { resolveMessage, type MessageContext } from './messages'
import { isMissing, issue, type Validation } from './shared'
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
	EnumOption,
	EnumOptionValue,
} from './types'

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

/**
 * What a selection formatter needs from the formatter that owns it. Each
 * nested call formats with the options it is given and never inherits the
 * nested kind's formatter-level options.
 */
export interface SelectionFormattingContext extends MessageContext {
	readonly formatNumber: (value: number, options: NumberFormatOptions) => string
	/**
	 * Presents one option through the effective enum formatter, so an `enum`
	 * override reaches a multiselect's labels the way a `person` override
	 * reaches a person party.
	 */
	readonly formatEnum: (value: EnumOptionValue, options: EnumFormatOptions) => string
	/** Returns the locale's list joiner, or `undefined` when the runtime has none for it. */
	readonly listFormat: (type: SelectionListType, style: SelectionListStyle) => Intl.ListFormat | undefined
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

function isOptionValue(value: unknown): value is EnumOptionValue {
	return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
}

export function validateBoolean(value: unknown): Validation<boolean> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('boolean', 'missing_value', 'Boolean value is missing.')] }
	}
	if (typeof value !== 'boolean') {
		return { ok: false, status: 'invalid', issues: [issue('boolean', 'invalid_boolean', 'Boolean value must be true or false.')] }
	}
	return { ok: true, value }
}

export function validateEnumValue(value: unknown): Validation<EnumOptionValue> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('enum', 'missing_value', 'Enum value is missing.')] }
	}
	if (!isOptionValue(value)) {
		return { ok: false, status: 'invalid', issues: [issue('enum', 'invalid_enum', 'Enum value must be a string or a finite number.')] }
	}
	return { ok: true, value }
}

export function validateMultiselectValue(value: unknown): Validation<readonly EnumOptionValue[]> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('multiselect', 'missing_value', 'Multiselect value is missing.')] }
	}
	if (!Array.isArray(value)) {
		return { ok: false, status: 'invalid', issues: [issue('multiselect', 'invalid_multiselect', 'Multiselect value must be an array of selected option values.')] }
	}
	const issues: FormatIssue[] = []
	value.forEach((entry, index) => {
		if (!isOptionValue(entry)) {
			issues.push(issue('multiselect', 'invalid_member', 'Every selected value must be a string or a finite number.', `[${index}]`))
		}
	})
	if (issues.length > 0) return { ok: false, status: 'invalid', issues }
	return { ok: true, value: value as readonly EnumOptionValue[] }
}

export function validateRating(value: unknown): Validation<number> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('rating', 'missing_value', 'Rating value is missing.')] }
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return { ok: false, status: 'invalid', issues: [issue('rating', 'invalid_rating', 'Rating value must be a finite number.')] }
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
			if (option === null || typeof option !== 'object' || !isOptionValue((option as EnumOption).value)) {
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

export function formatBooleanValue(
	value: boolean,
	options: BooleanFormatOptions,
	context: SelectionFormattingContext,
): string {
	const supplied = value ? options.trueLabel : options.falseLabel
	if (supplied !== undefined) return supplied
	return resolveMessage(context, value ? 'boolean.true' : 'boolean.false')
}

/**
 * Presents one selected value with the label its declared option carries. A
 * value no option declares is a fault by default, because printing it raw
 * hides an artifact whose data and declaration have drifted apart.
 */
export function formatEnumValue(
	value: EnumOptionValue,
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
	value: readonly EnumOptionValue[],
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
	const template = resolveMessage(context, 'rating.scale')
	return template
		.replaceAll('{value}', number)
		.replaceAll('{max}', context.formatNumber(options.max, {}))
}
