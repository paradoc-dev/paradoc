import type {
	DateFormatOptions,
	DatetimeFormatOptions,
	DurationFormatOptions,
	FormatIssue,
	FormatterMessages,
	TimeFormatOptions,
} from './types'

export type TemporalValueMode = 'calendar' | 'local' | 'instant'

export interface ParsedDateValue {
	readonly date: Date
	readonly mode: TemporalValueMode
}

export interface ParsedDatetimeValue {
	readonly date: Date
	readonly mode: Exclude<TemporalValueMode, 'calendar'>
}

export interface ParsedTimeValue {
	readonly date: Date
	readonly fractionDigits: number
}

export interface ParsedDurationValue {
	readonly years: number
	readonly months: number
	readonly weeks: number
	readonly days: number
	readonly hours: number
	readonly minutes: number
	readonly seconds: number
}

export interface TemporalValidationSuccess<T> {
	ok: true
	value: T
}

export interface TemporalValidationFailure {
	ok: false
	status: 'missing' | 'invalid'
	issues: readonly FormatIssue[]
}

export type TemporalValidation<T> = TemporalValidationSuccess<T> | TemporalValidationFailure

export class MissingTemporalMessageError extends Error {
	constructor(readonly key: string, readonly locale: string) {
		super(`No temporal message ${JSON.stringify(key)} is available for locale ${JSON.stringify(locale)}.`)
		this.name = 'MissingTemporalMessageError'
	}
}

export const BUILT_IN_TEMPORAL_MESSAGES: FormatterMessages = {
	'en-US': {
		'duration.year.one': '{value} year',
		'duration.year.other': '{value} years',
		'duration.month.one': '{value} month',
		'duration.month.other': '{value} months',
		'duration.week.one': '{value} week',
		'duration.week.other': '{value} weeks',
		'duration.day.one': '{value} day',
		'duration.day.other': '{value} days',
		'duration.hour.one': '{value} hour',
		'duration.hour.other': '{value} hours',
		'duration.minute.one': '{value} minute',
		'duration.minute.other': '{value} minutes',
		'duration.second.one': '{value} second',
		'duration.second.other': '{value} seconds',
	},
	'en-GB': {
		'duration.year.one': '{value} year',
		'duration.year.other': '{value} years',
		'duration.month.one': '{value} month',
		'duration.month.other': '{value} months',
		'duration.week.one': '{value} week',
		'duration.week.other': '{value} weeks',
		'duration.day.one': '{value} day',
		'duration.day.other': '{value} days',
		'duration.hour.one': '{value} hour',
		'duration.hour.other': '{value} hours',
		'duration.minute.one': '{value} minute',
		'duration.minute.other': '{value} minutes',
		'duration.second.one': '{value} second',
		'duration.second.other': '{value} seconds',
	},
	'de-DE': {
		'duration.year.one': '{value} Jahr',
		'duration.year.other': '{value} Jahre',
		'duration.month.one': '{value} Monat',
		'duration.month.other': '{value} Monate',
		'duration.week.one': '{value} Woche',
		'duration.week.other': '{value} Wochen',
		'duration.day.one': '{value} Tag',
		'duration.day.other': '{value} Tage',
		'duration.hour.one': '{value} Stunde',
		'duration.hour.other': '{value} Stunden',
		'duration.minute.one': '{value} Minute',
		'duration.minute.other': '{value} Minuten',
		'duration.second.one': '{value} Sekunde',
		'duration.second.other': '{value} Sekunden',
	},
	'fr-FR': {
		'duration.year.one': '{value} an',
		'duration.year.other': '{value} ans',
		'duration.month.one': '{value} mois',
		'duration.month.other': '{value} mois',
		'duration.week.one': '{value} semaine',
		'duration.week.other': '{value} semaines',
		'duration.day.one': '{value} jour',
		'duration.day.other': '{value} jours',
		'duration.hour.one': '{value} heure',
		'duration.hour.other': '{value} heures',
		'duration.minute.one': '{value} minute',
		'duration.minute.other': '{value} minutes',
		'duration.second.one': '{value} seconde',
		'duration.second.other': '{value} secondes',
	},
	'ar-SA': {
		'duration.year.one': '{value} سنة',
		'duration.year.two': '{value} سنتان',
		'duration.year.few': '{value} سنوات',
		'duration.year.many': '{value} سنة',
		'duration.year.other': '{value} سنة',
		'duration.month.one': '{value} شهر',
		'duration.month.two': '{value} شهران',
		'duration.month.few': '{value} أشهر',
		'duration.month.many': '{value} شهر',
		'duration.month.other': '{value} شهر',
		'duration.week.one': '{value} أسبوع',
		'duration.week.two': '{value} أسبوعان',
		'duration.week.few': '{value} أسابيع',
		'duration.week.many': '{value} أسبوع',
		'duration.week.other': '{value} أسبوع',
		'duration.day.one': '{value} يوم',
		'duration.day.two': '{value} يومان',
		'duration.day.few': '{value} أيام',
		'duration.day.many': '{value} يوم',
		'duration.day.other': '{value} يوم',
		'duration.hour.one': '{value} ساعة',
		'duration.hour.two': '{value} ساعتان',
		'duration.hour.few': '{value} ساعات',
		'duration.hour.many': '{value} ساعة',
		'duration.hour.other': '{value} ساعة',
		'duration.minute.one': '{value} دقيقة',
		'duration.minute.two': '{value} دقيقتان',
		'duration.minute.few': '{value} دقائق',
		'duration.minute.many': '{value} دقيقة',
		'duration.minute.other': '{value} دقيقة',
		'duration.second.one': '{value} ثانية',
		'duration.second.two': '{value} ثانيتان',
		'duration.second.few': '{value} ثوانٍ',
		'duration.second.many': '{value} ثانية',
		'duration.second.other': '{value} ثانية',
	},
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?$/
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/
const DURATION_PATTERN = /^P(?=\d|T\d)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(?:T(?=\d)(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$/

function issue(kind: string, code: string, message: string, path?: string): FormatIssue {
	return { kind, code, message, ...(path === undefined ? {} : { path }) }
}

function missing(kind: string): TemporalValidationFailure {
	return { ok: false, status: 'missing', issues: [issue(kind, 'missing_value', `${kind} value is missing.`)] }
}

function invalid(kind: string, message: string, path?: string, code = 'invalid_value'): TemporalValidationFailure {
	return { ok: false, status: 'invalid', issues: [issue(kind, code, message, path)] }
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) {
		const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
		return leap ? 29 : 28
	}
	return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function validDateParts(year: number, month: number, day: number): boolean {
	return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

function makeUtcDate(
	year: number,
	month: number,
	day: number,
	hour = 0,
	minute = 0,
	second = 0,
	millisecond = 0,
): Date {
	const result = new Date(0)
	result.setUTCFullYear(year, month - 1, day)
	result.setUTCHours(hour, minute, second, millisecond)
	return result
}

function parseOffset(value: string | undefined): number | undefined {
	if (value === undefined) return undefined
	if (value === 'Z') return 0
	const match = /^([+-])(\d{2}):?(\d{2})$/.exec(value)
	if (match === null) return undefined
	const hours = Number(match[2])
	const minutes = Number(match[3])
	if (minutes > 59 || hours > 23) return undefined
	const total = hours * 60 + minutes
	return match[1] === '-' ? -total : total
}

function parseDateTimeString(value: string):
	| { year: number; month: number; day: number; hour: number; minute: number; second: number; millisecond: number; offsetMinutes?: number; fractionDigits: number }
	| undefined {
	const match = DATETIME_PATTERN.exec(value)
	if (match === null) return undefined
	const offsetMinutes = parseOffset(match[8])
	if (match[8] !== undefined && offsetMinutes === undefined) return undefined
	const fraction = match[7] ?? ''
	return {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
		hour: Number(match[4]),
		minute: Number(match[5]),
		second: Number(match[6] ?? 0),
		millisecond: Number((fraction + '000').slice(0, 3)),
		offsetMinutes,
		fractionDigits: fraction.length,
	}
}

function hasInvalidOffset(value: string): boolean {
	const match = DATETIME_PATTERN.exec(value)
	return match !== null && match[8] !== undefined && parseOffset(match[8]) === undefined
}

function validClock(hour: number, minute: number, second: number): boolean {
	return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59
}

function makeInstant(parts: {
	year: number
	month: number
	day: number
	hour: number
	minute: number
	second: number
	millisecond: number
	offsetMinutes: number
}): Date {
	return new Date(makeUtcDate(
		parts.year,
		parts.month,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
		parts.millisecond,
	).getTime() - parts.offsetMinutes * 60_000)
}

export function validateDate(value: unknown): TemporalValidation<ParsedDateValue> {
	if (value === null || value === undefined) return missing('date')
	if (value instanceof Date) {
		return Number.isNaN(value.getTime())
			? invalid('date', 'Date object is invalid.')
			: { ok: true, value: { date: value, mode: 'instant' } }
	}
	if (typeof value !== 'string' || value.length === 0) return invalid('date', 'Date must be an ISO date, datetime, or valid Date object.')
	const dateMatch = DATE_PATTERN.exec(value)
	if (dateMatch !== null) {
		const year = Number(dateMatch[1])
		const month = Number(dateMatch[2])
		const day = Number(dateMatch[3])
		return validDateParts(year, month, day)
			? { ok: true, value: { date: makeUtcDate(year, month, day), mode: 'calendar' } }
			: invalid('date', `Date ${JSON.stringify(value)} names an impossible calendar day.`)
	}
	const parts = parseDateTimeString(value)
	if (hasInvalidOffset(value)) return invalid('date', `Datetime offset in ${JSON.stringify(value)} is invalid.`, 'offset', 'invalid_offset')
	if (parts === undefined || !validDateParts(parts.year, parts.month, parts.day) || !validClock(parts.hour, parts.minute, parts.second)) {
		return invalid('date', `Date ${JSON.stringify(value)} is not a valid ISO calendar value.`)
	}
	const date = parts.offsetMinutes === undefined
		? makeUtcDate(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond)
		: makeInstant({ ...parts, offsetMinutes: parts.offsetMinutes })
	return { ok: true, value: { date, mode: parts.offsetMinutes === undefined ? 'local' : 'instant' } }
}

export function validateDatetime(value: unknown): TemporalValidation<ParsedDatetimeValue> {
	if (value === null || value === undefined) return missing('datetime')
	if (value instanceof Date) {
		return Number.isNaN(value.getTime())
			? invalid('datetime', 'Date object is invalid.')
			: { ok: true, value: { date: value, mode: 'instant' } }
	}
	if (typeof value !== 'string' || value.length === 0) return invalid('datetime', 'Datetime must be an ISO datetime string or valid Date object.')
	const parts = parseDateTimeString(value)
	if (hasInvalidOffset(value)) return invalid('datetime', `Datetime offset in ${JSON.stringify(value)} is invalid.`, 'offset', 'invalid_offset')
	if (parts === undefined || !validDateParts(parts.year, parts.month, parts.day) || !validClock(parts.hour, parts.minute, parts.second)) {
		return invalid('datetime', `Datetime ${JSON.stringify(value)} is not a valid ISO datetime value.`)
	}
	const date = parts.offsetMinutes === undefined
		? makeUtcDate(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond)
		: makeInstant({ ...parts, offsetMinutes: parts.offsetMinutes })
	return { ok: true, value: { date, mode: parts.offsetMinutes === undefined ? 'local' : 'instant' } }
}

export function validateTime(value: unknown): TemporalValidation<ParsedTimeValue> {
	if (value === null || value === undefined) return missing('time')
	if (typeof value !== 'string' || value.length === 0) return invalid('time', 'Time must be an ISO time string.')
	const match = TIME_PATTERN.exec(value)
	if (match === null) return invalid('time', `Time ${JSON.stringify(value)} is not a valid 24-hour clock value.`)
	const hour = Number(match[1])
	const minute = Number(match[2])
	const second = Number(match[3] ?? 0)
	if (!validClock(hour, minute, second)) return invalid('time', `Time ${JSON.stringify(value)} is not a valid 24-hour clock value.`)
	return {
		ok: true,
		value: {
			date: makeUtcDate(1970, 1, 1, hour, minute, second, Number(((match[4] ?? '') + '000').slice(0, 3))),
			fractionDigits: match[4]?.length ?? 0,
		},
	}
}

export function validateDuration(value: unknown): TemporalValidation<ParsedDurationValue> {
	if (value === null || value === undefined) return missing('duration')
	if (typeof value !== 'string' || value.length === 0) return invalid('duration', 'Duration must be an ISO 8601 duration string.')
	const match = DURATION_PATTERN.exec(value)
	if (match === null) return invalid('duration', `Duration ${JSON.stringify(value)} is not a valid ISO 8601 duration.`)
	const parsed: ParsedDurationValue = {
		years: Number.parseInt(match[1]?.slice(0, -1) ?? '0', 10),
		months: Number.parseInt(match[2]?.slice(0, -1) ?? '0', 10),
		weeks: Number.parseInt(match[3]?.slice(0, -1) ?? '0', 10),
		days: Number.parseInt(match[4]?.slice(0, -1) ?? '0', 10),
		hours: Number.parseInt(match[5]?.slice(0, -1) ?? '0', 10),
		minutes: Number.parseInt(match[6]?.slice(0, -1) ?? '0', 10),
		seconds: Number.parseFloat(match[7]?.slice(0, -1) ?? '0'),
	}
	for (const [component, amount] of Object.entries(parsed)) {
		if (!Number.isFinite(amount)) {
			return invalid('duration', `Duration ${JSON.stringify(value)} contains an out-of-range ${component} component.`, component, 'invalid_number')
		}
	}
	return {
		ok: true,
		value: parsed,
	}
}

function findTemporalMessage(messages: FormatterMessages, locale: string, key: string): string | undefined {
	const exact = messages[locale]?.[key]
	if (exact !== undefined) return exact
	const language = locale.split('-')[0]
	const languageMessages = Object.entries(messages).find(([candidate]) => candidate.split('-')[0] === language)?.[1]
	return languageMessages?.[key]
}

export function resolveTemporalMessage(
	messages: FormatterMessages,
	locale: string,
	key: string,
	fallbackLocale?: string,
): string {
	const message = findTemporalMessage(messages, locale, key)
	if (message !== undefined) return message
	if (fallbackLocale !== undefined) {
		const fallbackMessage = findTemporalMessage(messages, fallbackLocale, key)
		if (fallbackMessage !== undefined) return fallbackMessage
	}
	throw new MissingTemporalMessageError(key, locale)
}

export function formatDurationValue(
	value: ParsedDurationValue,
	locale: string,
	numberingSystem: string | undefined,
	options: DurationFormatOptions,
	messages: FormatterMessages,
	getNumberFormat: (locale: string, numberingSystem: string | undefined, options: DurationFormatOptions) => Intl.NumberFormat,
	getPluralRules: (locale: string, options: object) => Intl.PluralRules,
	getListFormat: (locale: string) => Intl.ListFormat,
	fallbackLocale?: string,
): string {
	const parts: string[] = []
	const units: readonly [keyof ParsedDurationValue, string][] = [
		['years', 'year'],
		['months', 'month'],
		['weeks', 'week'],
		['days', 'day'],
		['hours', 'hour'],
		['minutes', 'minute'],
		['seconds', 'second'],
	]
	const numberFormat = getNumberFormat(locale, numberingSystem, {
		maximumFractionDigits: 9,
		...options,
	})
	const pluralRules = getPluralRules(locale, numberFormat.resolvedOptions())

	for (const [key, unit] of units) {
		const amount = value[key]
		if (amount === 0) continue
		const category = pluralRules.select(amount)
		const template = resolveTemporalMessage(messages, locale, `duration.${unit}.${category}`, fallbackLocale)
		const number = numberFormat.format(amount)
		parts.push(template.includes('{value}') ? template.replaceAll('{value}', number) : `${number} ${template}`)
	}

	if (parts.length === 0) {
		const template = resolveTemporalMessage(messages, locale, 'duration.second.other', fallbackLocale)
		const number = numberFormat.format(0)
		return template.includes('{value}') ? template.replaceAll('{value}', number) : `${number} ${template}`
	}

	return parts.length === 1 ? parts[0]! : getListFormat(locale).format(parts)
}

export type TemporalIntlOptions = DateFormatOptions | DatetimeFormatOptions | TimeFormatOptions

export function dateTimeDefaults(kind: 'date' | 'datetime' | 'time', options: TemporalIntlOptions): Intl.DateTimeFormatOptions {
	const raw = options as Intl.DateTimeFormatOptions & { timeZone?: string; calendar?: string }
	if (raw.dateStyle !== undefined || raw.timeStyle !== undefined) return raw
	const hasDateFields = ['weekday', 'year', 'month', 'day', 'dateStyle'].some((key) => raw[key as keyof typeof raw] !== undefined)
	const hasTimeFields = ['dayPeriod', 'hour', 'minute', 'second', 'timeStyle'].some((key) => raw[key as keyof typeof raw] !== undefined)
	const hasFractionalSecondDigits = raw.fractionalSecondDigits !== undefined
	const secondsForFraction = hasFractionalSecondDigits && raw.second === undefined && raw.timeStyle === undefined
		? { second: '2-digit' as const }
		: {}
	if (kind === 'date') {
		return hasDateFields ? raw : { year: 'numeric', month: 'short', day: 'numeric', ...raw }
	}
	if (kind === 'time') {
		return hasTimeFields
			? { ...secondsForFraction, ...raw }
			: { hour: 'numeric', minute: '2-digit', ...secondsForFraction, ...raw }
	}
	return {
		...(hasDateFields ? {} : { year: 'numeric' as const, month: 'short' as const, day: 'numeric' as const }),
		...(hasTimeFields ? {} : { hour: 'numeric' as const, minute: '2-digit' as const }),
		...secondsForFraction,
		...raw,
	}
}
