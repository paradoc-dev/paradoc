import type { Address, Duration, Money, Organization, Party, Person, Phone } from '@paradoc/types'

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
export type ContactFormatKind = 'address' | 'phone' | 'person' | 'organization' | 'party'
export type TemporalFormatKind = 'date' | 'datetime' | 'time' | 'duration'

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

export type AddressLayoutPolicy = 'country' | 'generic'

export interface AddressLayoutContext {
	readonly locale: string
	readonly options: AddressFormatOptions
}

/** A caller-provided layout for one normalized ISO 3166-1 country code. */
export type AddressLayoutFormatter = (address: Address, context: AddressLayoutContext) => string

/** Options for postal address presentation. */
export interface AddressFormatOptions {
	/** Use country-specific layouts by default, or an explicit component-preserving generic layout. */
	layout?: AddressLayoutPolicy
	/** Additional or replacement layouts keyed by ISO 3166-1 alpha-2 country code. */
	countryLayouts?: Readonly<Record<string, AddressLayoutFormatter>>
}

/** Options for phone presentation. */
export interface PhoneFormatOptions {
	/** Override the package-owned extension label for this call or formatter. */
	extensionLabel?: string
}

/** Options for person presentation. */
export type PersonFormatOptions = Record<string, never>

/** Options for organization presentation. */
export type OrganizationFormatOptions = Record<string, never>

/** Options for party dispatch when shape alone is not enough to identify an identity. */
export interface PartyFormatOptions {
	/** Explicitly identify a party whose fields do not carry a distinguishing identity member. */
	partyType?: 'person' | 'organization'
}

/** Shared temporal policy options. */
export interface TemporalFormatOptions {
	/** Override the formatter's timezone for instant-bearing values. */
	timeZone?: string
	/** Override the formatter's calendar for this call. */
	calendar?: string
}

/** Options for calendar-date presentation. */
export type DateFormatOptions = Omit<Intl.DateTimeFormatOptions, 'calendar' | 'numberingSystem' | 'timeZone'> & TemporalFormatOptions

/** Options for datetime presentation. */
export type DatetimeFormatOptions = Omit<Intl.DateTimeFormatOptions, 'calendar' | 'numberingSystem' | 'timeZone'> & TemporalFormatOptions

/** Options for time-of-day presentation. */
export type TimeFormatOptions = Omit<Intl.DateTimeFormatOptions, 'calendar' | 'numberingSystem' | 'timeZone'> & TemporalFormatOptions

/** Options for localized ISO 8601 duration presentation. */
export type DurationFormatOptions = Omit<
	Intl.NumberFormatOptions,
	'style' | 'currency' | 'currencyDisplay' | 'currencySign' | 'unit' | 'unitDisplay'
>

export type FormatOptionsByKind = {
	money: MoneyFormatOptions
	number: NumberFormatOptions
	percentage: PercentageFormatOptions
	address: AddressFormatOptions
	phone: PhoneFormatOptions
	person: PersonFormatOptions
	organization: OrganizationFormatOptions
	party: PartyFormatOptions
	coordinate: Record<string, unknown>
	bbox: Record<string, unknown>
	duration: DurationFormatOptions
	identification: Record<string, unknown>
	attachment: Record<string, unknown>
	signature: Record<string, unknown>
	date: DateFormatOptions
	datetime: DatetimeFormatOptions
	time: TimeFormatOptions
}

export type FormatInputByKind = {
	money: Money | Partial<Money> | Record<string, unknown> | null | undefined
	number: number | null | undefined
	percentage: number | null | undefined
	address: Address | Partial<Address> | Record<string, unknown> | null | undefined
	phone: Phone | Partial<Phone> | string | Record<string, unknown> | null | undefined
	person: Person | Partial<Person> | Record<string, unknown> | null | undefined
	organization: Organization | Partial<Organization> | Record<string, unknown> | null | undefined
	party: Party | Partial<Person> | Partial<Organization> | Record<string, unknown> | null | undefined
	coordinate: unknown
	bbox: unknown
	duration: Duration | string | null | undefined
	identification: unknown
	attachment: unknown
	signature: unknown
	date: string | Date | null | undefined
	datetime: string | Date | null | undefined
	time: string | null | undefined
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
	/** Locale used for unsupported runtime locales and as an explicit fallback for missing package messages. */
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
	/** Caller-supplied package messages, merged with the initial built-in locale resources. */
	messages?: FormatterMessages
	address?: AddressFormatOptions
	phone?: PhoneFormatOptions
	person?: PersonFormatOptions
	organization?: OrganizationFormatOptions
	party?: PartyFormatOptions
	date?: DateFormatOptions
	datetime?: DatetimeFormatOptions
	time?: TimeFormatOptions
	duration?: DurationFormatOptions
	overrides?: FormatterOverrides
}

export type NumericValueByKind = {
	number: number
	money: Money | Partial<Money> | Record<string, unknown>
	percentage: number
}

export type ContactValueByKind = {
	address: FormatInputByKind['address']
	phone: FormatInputByKind['phone']
	person: FormatInputByKind['person']
	organization: FormatInputByKind['organization']
	party: FormatInputByKind['party']
}

export type TemporalValueByKind = {
	date: string | Date
	datetime: string | Date
	time: string
	duration: Duration | string
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

export interface ContactFormatImplementationContext<K extends ContactFormatKind> {
	readonly kind: K
	readonly locale: string
	readonly options: FormatCallOptions<K>
	/** Call the implementation that was active before this override. */
	readonly delegate: (
		value?: ContactValueByKind[K],
		options?: FormatCallOptions<K>,
	) => string
}

export type ContactFormatImplementation<K extends ContactFormatKind> = (
	value: ContactValueByKind[K],
	options: FormatCallOptions<K>,
	context: ContactFormatImplementationContext<K>,
) => string

export interface TemporalFormatImplementationContext<K extends TemporalFormatKind> {
	readonly kind: K
	readonly locale: string
	readonly options: FormatCallOptions<K>
	/** Call the implementation that was active before this override. */
	readonly delegate: (
		value?: TemporalValueByKind[K],
		options?: FormatCallOptions<K>,
	) => string
}

export type TemporalFormatImplementation<K extends TemporalFormatKind> = (
	value: TemporalValueByKind[K],
	options: FormatCallOptions<K>,
	context: TemporalFormatImplementationContext<K>,
) => string

export type FormatterOverrides = Partial<{
	[K in NumericFormatKind]: FormatImplementation<K>
}> & Partial<{
	[K in ContactFormatKind]: ContactFormatImplementation<K>
}> & Partial<{
	[K in TemporalFormatKind]: TemporalFormatImplementation<K>
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
	formatAddress(value: FormatInputByKind['address'], options?: FormatCallOptions<'address'>): string
	formatPhone(value: FormatInputByKind['phone'], options?: FormatCallOptions<'phone'>): string
	formatPerson(value: FormatInputByKind['person'], options?: FormatCallOptions<'person'>): string
	formatOrganization(value: FormatInputByKind['organization'], options?: FormatCallOptions<'organization'>): string
	formatParty(value: FormatInputByKind['party'], options?: FormatCallOptions<'party'>): string
	formatDate(value: FormatInputByKind['date'], options?: FormatCallOptions<'date'>): string
	formatDatetime(value: FormatInputByKind['datetime'], options?: FormatCallOptions<'datetime'>): string
	formatTime(value: FormatInputByKind['time'], options?: FormatCallOptions<'time'>): string
	formatDuration(value: FormatInputByKind['duration'], options?: FormatCallOptions<'duration'>): string
	safeFormatNumber(value: FormatInputByKind['number'], options?: FormatCallOptions<'number'>): FormatResult
	safeFormatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): FormatResult
	safeFormatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): FormatResult
	safeFormatAddress(value: FormatInputByKind['address'], options?: FormatCallOptions<'address'>): FormatResult
	safeFormatPhone(value: FormatInputByKind['phone'], options?: FormatCallOptions<'phone'>): FormatResult
	safeFormatPerson(value: FormatInputByKind['person'], options?: FormatCallOptions<'person'>): FormatResult
	safeFormatOrganization(value: FormatInputByKind['organization'], options?: FormatCallOptions<'organization'>): FormatResult
	safeFormatParty(value: FormatInputByKind['party'], options?: FormatCallOptions<'party'>): FormatResult
	safeFormatDate(value: FormatInputByKind['date'], options?: FormatCallOptions<'date'>): FormatResult
	safeFormatDatetime(value: FormatInputByKind['datetime'], options?: FormatCallOptions<'datetime'>): FormatResult
	safeFormatTime(value: FormatInputByKind['time'], options?: FormatCallOptions<'time'>): FormatResult
	safeFormatDuration(value: FormatInputByKind['duration'], options?: FormatCallOptions<'duration'>): FormatResult

	/** Create an independent formatter with merged configuration. */
	compose(options?: FormatterOptions): Formatter
	withOverrides(overrides: FormatterOverrides): Formatter

	cacheStats(): FormatterCacheStats
}
