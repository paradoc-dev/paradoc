import type { Money } from '@paradoc/types'

/** Value families understood by the public formatter contract. */
export const FORMAT_KINDS = [
	'money',
	'address',
	'phone',
	'person',
	'organization',
	'party',
	'coordinate',
	'bbox',
	'duration',
	'identification',
	'attachment',
	'signature',
	'date',
	'datetime',
	'time',
	'number',
	'percentage',
] as const

export type FormatKind = (typeof FORMAT_KINDS)[number]
export type NumericFormatKind = 'money' | 'number' | 'percentage'

type NumberOptionsBase = Omit<
	Intl.NumberFormatOptions,
	'style' | 'currency' | 'currencyDisplay' | 'currencySign' | 'unit' | 'unitDisplay'
>

/** Options for formatting a plain number. */
export type NumberFormatOptions = NumberOptionsBase

/** Options for formatting a monetary amount. */
export interface MoneyFormatOptions extends NumberOptionsBase {
	/** Use `none` when a template already prints its own currency symbol. */
	currencyDisplay?: Intl.NumberFormatOptions['currencyDisplay'] | 'none'
	currencySign?: Intl.NumberFormatOptions['currencySign']
}

/** Options for formatting a percentage-point value. */
export type PercentageFormatOptions = NumberOptionsBase

export type FormatOptionsByKind = {
	money: MoneyFormatOptions
	number: NumberFormatOptions
	percentage: PercentageFormatOptions
	address: Record<string, unknown>
	phone: Record<string, unknown>
	person: Record<string, unknown>
	organization: Record<string, unknown>
	party: Record<string, unknown>
	coordinate: Record<string, unknown>
	bbox: Record<string, unknown>
	duration: Record<string, unknown>
	identification: Record<string, unknown>
	attachment: Record<string, unknown>
	signature: Record<string, unknown>
	date: Record<string, unknown>
	datetime: Record<string, unknown>
	time: Record<string, unknown>
}

export type FormatInputByKind = {
	money: Money | Partial<Money> | Record<string, unknown> | null | undefined
	number: number | null | undefined
	percentage: number | null | undefined
	address: unknown
	phone: unknown
	person: unknown
	organization: unknown
	party: unknown
	coordinate: unknown
	bbox: unknown
	duration: unknown
	identification: unknown
	attachment: unknown
	signature: unknown
	date: unknown
	datetime: unknown
	time: unknown
}

/** Per-call locale settings can specialize a formatter without mutating it. */
export type FormatCallOptions<K extends FormatKind> = FormatOptionsByKind[K] & {
	locale?: string
	numberingSystem?: string
}

export interface FormatterMessages {
	/** Package-owned messages for a locale, keyed by the message name. */
	readonly [locale: string]: Readonly<Record<string, string>>
}

export type UnsupportedLocalePolicy = 'error' | 'fallback'

export interface FormatterOptions {
	/** Standard BCP 47 locale identifier. Defaults to `en-US`. */
	locale?: string
	/** Locale used only when `unsupportedLocale` is `fallback`. */
	fallbackLocale?: string
	/** How construction and per-call locale overrides handle unsupported locales. */
	unsupportedLocale?: UnsupportedLocalePolicy
	/** Explicit timezone retained for the temporal formatter slices. Defaults to UTC. */
	timeZone?: string
	/** Explicit calendar retained for the temporal formatter slices. Defaults to Gregorian. */
	calendar?: string
	/** Numbering system used by numeric and temporal formatters. */
	numberingSystem?: string
	/** Maximum number of Intl formatter configurations retained by this instance. */
	cacheSize?: number
	/** Base options for each implemented numeric value kind. */
	number?: NumberFormatOptions
	money?: MoneyFormatOptions
	percentage?: PercentageFormatOptions
	/** Caller-supplied package messages. The numeric slice does not require labels yet. */
	messages?: FormatterMessages
	overrides?: FormatterOverrides
}

export type NumericValueByKind = {
	number: number
	money: Money | Partial<Money> | Record<string, unknown>
	percentage: number
}

export interface FormatImplementationContext<K extends NumericFormatKind> {
	readonly kind: K
	readonly locale: string
	readonly options: FormatCallOptions<K>
	/** Call the implementation that was active before this override. */
	readonly delegate: (
		value?: NumericValueByKind[K],
		options?: FormatCallOptions<K>,
	) => string
}

export type FormatImplementation<K extends NumericFormatKind> = (
	value: NumericValueByKind[K],
	options: FormatCallOptions<K>,
	context: FormatImplementationContext<K>,
) => string

export type FormatterOverrides = Partial<{
	[K in NumericFormatKind]: FormatImplementation<K>
}>

export type FormatStatus =
	| 'formatted'
	| 'missing'
	| 'incomplete'
	| 'invalid'
	| 'unsupported'
	| 'error'

export interface FormatIssue {
	readonly code: string
	readonly message: string
	readonly path?: string
	readonly kind?: FormatKind | string
	readonly cause?: unknown
}

export interface FormattedResult {
	readonly success: true
	readonly status: 'formatted'
	readonly value: string
}

export interface UnformattedResult {
	readonly success: false
	readonly status: Exclude<FormatStatus, 'formatted'>
	readonly issues: readonly FormatIssue[]
}

export type FormatResult = FormattedResult | UnformattedResult

export interface FormatterCacheBucketStats {
	readonly size: number
	readonly hits: number
	readonly misses: number
	readonly limit: number
}

export interface FormatterCacheStats {
	readonly number: FormatterCacheBucketStats
	readonly money: FormatterCacheBucketStats
	readonly percentage: FormatterCacheBucketStats
}

export interface Formatter {
	readonly locale: string
	readonly timeZone: string
	readonly calendar: string
	readonly numberingSystem?: string
	readonly messages: FormatterMessages

	format<K extends FormatKind>(
		kind: K,
		value: FormatInputByKind[K],
		options?: FormatCallOptions<K>,
	): string
	safeFormat<K extends FormatKind>(
		kind: K,
		value: FormatInputByKind[K],
		options?: FormatCallOptions<K>,
	): FormatResult

	formatNumber(value: FormatInputByKind['number'], options?: FormatCallOptions<'number'>): string
	formatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): string
	formatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): string
	safeFormatNumber(value: FormatInputByKind['number'], options?: FormatCallOptions<'number'>): FormatResult
	safeFormatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): FormatResult
	safeFormatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): FormatResult

	/** Create an independent formatter with merged configuration. */
	compose(options?: FormatterOptions): Formatter
	withOverrides(overrides: FormatterOverrides): Formatter

	cacheStats(): FormatterCacheStats
}
