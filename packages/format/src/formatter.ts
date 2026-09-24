import { BoundedCache, DEFAULT_CACHE_SIZE, MAX_CACHE_SIZE, stableSerialize } from './cache'
import {
	BUILT_IN_CONTACT_MESSAGES,
	UnsupportedAddressLayoutError,
	formatAddress as formatContactAddress,
	formatOrganization as formatContactOrganization,
	formatPerson as formatContactPerson,
	formatPhone as formatContactPhone,
	validateAddress,
	validateContactOptions,
	validateOrganization,
	validateParty,
	validatePerson,
	validatePhone,
	type NormalizedAddress,
	type NormalizedPhone,
	type ValidatedParty,
} from './contacts'
import {
	BUILT_IN_TEMPORAL_MESSAGES,
	dateTimeDefaults,
	formatDurationValue,
	validateDate,
	validateDatetime,
	validateDuration,
	validateTime,
	type ParsedDateValue,
	type ParsedDatetimeValue,
	type ParsedDurationValue,
	type ParsedTimeValue,
} from './temporal'
import {
	BUILT_IN_CAPTURE_MESSAGES,
	formatAttachmentValue,
	formatBboxValue,
	formatCoordinateValue,
	formatIdentificationValue,
	formatSignatureValue,
	validateAttachment,
	validateBbox,
	validateCoordinate,
	validateIdentification,
	validateSignature,
	type CaptureFormattingContext,
} from './captures'
import {
	BUILT_IN_SELECTION_MESSAGES,
	SelectionFormatError,
	formatBooleanValue,
	formatEnumValue,
	formatMultiselectValue,
	formatRatingValue,
	validateBoolean,
	validateEnumValue,
	validateMultiselectValue,
	validateRating,
	validateSelectionOptions,
	type SelectionFormattingContext,
} from './selection'
import { MissingMessageError, type MessageContext } from './messages'
import { FormatConfigurationError, FormatError, UnsupportedLocaleError } from './errors'
import { isMissing, isRecord, issue, type Validation } from './shared'
import {
	FORMAT_KINDS,
	FORMAT_KIND_FAMILIES,
	isFormatKind,
	type AddressFormatOptions,
	type Attachment,
	type Bbox,
	type Coordinate,
	type FormatCallOptions,
	type FormatInputByKind,
	type FormatIssue,
	type FormatKind,
	type FormatOptionsByKind,
	type FormatResult,
	type FormatStatus,
	type Formatter,
	type FormatterCacheBucket,
	type FormatterCacheStats,
	type FormatterMessages,
	type FormatterOptions,
	type FormatterOverrides,
	type Identification,
	type MoneyFormatOptions,
	type NumericFormatKind,
	type SelectionFormatKind,
	type SelectionListStyle,
	type SelectionListType,
	type SelectionOptionValue,
	type Signature,
} from './types'

const DEFAULT_LOCALE = 'en-US'
const DEFAULT_TIME_ZONE = 'UTC'
const DEFAULT_CALENDAR = 'gregory'

/** Options as one chain step carries them, whatever the kind. */
type CallOptions = Readonly<Record<string, unknown>>

/** The context every override receives, whatever the kind. */
interface ImplementationContext {
	readonly kind: FormatKind
	readonly locale: string
	readonly options: CallOptions
	readonly delegate: (value?: unknown, options?: CallOptions) => string
}

/** An override as the chain stores it. `FormatterOverrides` types it per kind. */
type Implementation = (value: unknown, options: CallOptions, context: ImplementationContext) => string

interface Layer {
	readonly kind: FormatKind
	readonly implementation: Implementation
}

/** One override in a kind's chain. A missing `previous` is the base implementation. */
interface ChainEntry {
	readonly implementation: Implementation
	readonly previous?: ChainEntry
}

/** The locale, numbering system, calendar, and timezone one call formats under. */
interface CallPolicy {
	readonly locale: string
	readonly numberingSystem?: string
	readonly calendar: string
	readonly timeZone: string
}

interface ResolvedCall {
	readonly options: CallOptions
	readonly policy: CallPolicy
}

/**
 * A checked value. Overrides receive `value`, the input as the public types
 * describe it; the base implementation formats `parsed`.
 */
interface CheckedValue {
	readonly value: unknown
	readonly parsed: unknown
}

type KindOptions = { readonly [K in FormatKind]: FormatOptionsByKind[K] }

interface FormatterConfig extends KindOptions {
	readonly locale: string
	readonly fallbackLocale?: string
	readonly unsupportedLocale: 'error' | 'fallback'
	readonly timeZone: string
	readonly calendar: string
	readonly numberingSystem?: string
	readonly cacheSize: number
	readonly messages: FormatterMessages
}

interface CachedByBucket {
	number: Intl.NumberFormat
	money: Intl.NumberFormat
	percentage: Intl.NumberFormat
	date: Intl.DateTimeFormat
	datetime: Intl.DateTimeFormat
	time: Intl.DateTimeFormat
	timeZone: Intl.DateTimeFormat
	duration: Intl.NumberFormat
	durationPlural: Intl.PluralRules
	durationList: Intl.ListFormat
	selectionList: Intl.ListFormat
}

type FormatterCaches = { readonly [B in FormatterCacheBucket]: BoundedCache<CachedByBucket[B]> }

const CACHE_BUCKETS: readonly FormatterCacheBucket[] = [
	'number',
	'money',
	'percentage',
	'date',
	'datetime',
	'time',
	'timeZone',
	'duration',
	'durationPlural',
	'durationList',
	'selectionList',
]

function formatted(value: string): FormatResult {
	return { success: true, status: 'formatted', value }
}

function failed(status: Exclude<FormatStatus, 'formatted'>, issues: readonly FormatIssue[]): FormatResult {
	return { success: false, status, issues }
}

function cloneAndFreeze<T>(value: T): T {
	if (value === null || typeof value !== 'object') return value
	if (Array.isArray(value)) {
		return Object.freeze(value.map((item) => cloneAndFreeze(item))) as T
	}

	const result: Record<string, unknown> = {}
	for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
		result[key] = cloneAndFreeze(item)
	}
	return Object.freeze(result) as T
}

function mergeMessages(
	base: FormatterMessages | undefined,
	addition: FormatterMessages | undefined,
): FormatterMessages {
	const result: Record<string, Readonly<Record<string, string>>> = {}
	for (const [locale, messages] of Object.entries(base ?? {})) {
		result[locale] = { ...messages }
	}
	for (const [locale, messages] of Object.entries(addition ?? {})) {
		result[locale] = { ...(result[locale] ?? {}), ...messages }
	}
	return cloneAndFreeze(result)
}

function canonicalLocale(locale: string): string {
	if (typeof locale !== 'string' || locale.trim().length === 0) {
		throw new FormatConfigurationError('Locale must be a non-empty BCP 47 language tag.')
	}
	try {
		return Intl.getCanonicalLocales(locale)[0] ?? locale
	} catch (error) {
		throw new FormatConfigurationError(`Invalid locale ${JSON.stringify(locale)}.`, { cause: error })
	}
}

function supportedLocale(locale: string): boolean {
	try {
		return Intl.NumberFormat.supportedLocalesOf([locale]).length > 0
	} catch {
		return false
	}
}

function supportedValue(kind: 'calendar' | 'numberingSystem', value: string): boolean {
	const supportedValuesOf = Intl.supportedValuesOf
	if (typeof supportedValuesOf === 'function') {
		return supportedValuesOf(kind).includes(value)
	}
	return true
}

function validateNumberingSystem(numberingSystem: string | undefined): void {
	if (numberingSystem === undefined) return
	if (!/^[a-z0-9]{3,8}$/i.test(numberingSystem) || !supportedValue('numberingSystem', numberingSystem)) {
		throw new FormatConfigurationError(`Unsupported numbering system ${JSON.stringify(numberingSystem)}.`)
	}
}

function validateCalendar(calendar: string): void {
	if (!/^[a-z0-9-]+$/i.test(calendar) || !supportedValue('calendar', calendar)) {
		throw new FormatConfigurationError(`Unsupported calendar ${JSON.stringify(calendar)}.`)
	}
}

/** Builds a formatter for a timezone, which is how a timezone name is checked. */
function timeZoneFormat(timeZone: string, locale: string): Intl.DateTimeFormat {
	try {
		return new Intl.DateTimeFormat(locale, { timeZone })
	} catch (error) {
		throw new FormatConfigurationError(`Unsupported timezone ${JSON.stringify(timeZone)}.`, { cause: error })
	}
}

function resolveConfiguredLocale(
	requested: string,
	policy: 'error' | 'fallback',
	fallbackLocale: string | undefined,
): string {
	const locale = canonicalLocale(requested)
	if (supportedLocale(locale)) return locale
	if (policy !== 'fallback') {
		throw new UnsupportedLocaleError(`Locale ${JSON.stringify(requested)} is not supported by this runtime.`)
	}
	if (fallbackLocale === undefined) {
		throw new UnsupportedLocaleError(
			`Locale ${JSON.stringify(requested)} is unsupported and no fallbackLocale was supplied.`,
		)
	}
	return fallbackLocale
}

function resolveCacheSize(value: number | undefined): number {
	const cacheSize = value ?? DEFAULT_CACHE_SIZE
	if (!Number.isInteger(cacheSize) || cacheSize < 1 || cacheSize > MAX_CACHE_SIZE) {
		throw new FormatConfigurationError(`cacheSize must be an integer between 1 and ${MAX_CACHE_SIZE}.`)
	}
	return cacheSize
}

/** The options Intl reads, without the policy members the formatter resolves itself. */
function intlOptions(options: CallOptions): Record<string, unknown> {
	const { locale: _locale, numberingSystem: _numberingSystem, timeZone: _timeZone, calendar: _calendar, ...intl } = options
	return intl
}

/**
 * Layers one kind's options over another's. Address `countryLayouts` merge by
 * country, so a layout added later never drops the layouts already in place.
 */
function mergeKindOptions(kind: FormatKind, base: CallOptions, addition: CallOptions | undefined): CallOptions {
	const merged: Record<string, unknown> = { ...base, ...(addition ?? {}) }
	if (kind === 'address' && addition?.countryLayouts !== undefined) {
		merged.countryLayouts = { ...((base.countryLayouts as object | undefined) ?? {}), ...(addition.countryLayouts as object) }
	}
	return Object.freeze(merged)
}

function mergeConfig(base: FormatterConfig, addition: FormatterOptions): FormatterOptions {
	const kinds: Record<string, unknown> = {}
	for (const kind of FORMAT_KINDS) {
		kinds[kind] = mergeKindOptions(kind, base[kind] as CallOptions, addition[kind] as CallOptions | undefined)
	}
	return {
		locale: addition.locale ?? base.locale,
		fallbackLocale: addition.fallbackLocale ?? base.fallbackLocale,
		unsupportedLocale: addition.unsupportedLocale ?? base.unsupportedLocale,
		timeZone: addition.timeZone ?? base.timeZone,
		calendar: addition.calendar ?? base.calendar,
		numberingSystem: addition.numberingSystem ?? base.numberingSystem,
		cacheSize: addition.cacheSize ?? base.cacheSize,
		...(kinds as KindOptions),
		messages: mergeMessages(base.messages, addition.messages),
	}
}

function validateNumber(value: unknown): Validation<number> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('number', 'missing_value', 'Number value is missing.')] }
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return { ok: false, status: 'invalid', issues: [issue('number', 'invalid_number', 'Number value must be a finite number.')] }
	}
	return { ok: true, value }
}

function validatePercentage(value: unknown): Validation<number> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('percentage', 'missing_value', 'Percentage value is missing.')] }
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return {
			ok: false,
			status: 'invalid',
			issues: [issue('percentage', 'invalid_percentage', 'Percentage value must be a finite number of percentage points.')],
		}
	}
	return { ok: true, value }
}

interface MoneyValue {
	readonly amount: number
	readonly currency: string
}

function validateMoney(value: unknown): Validation<MoneyValue> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('money', 'missing_value', 'Money value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('money', 'invalid_object', 'Money value must be an object with amount and currency.')] }
	}

	const amount = value.amount
	const currency = value.currency
	const issues: FormatIssue[] = []

	if (isMissing(amount)) {
		issues.push(issue('money', 'missing_member', 'Money amount is required.', 'amount'))
	} else if (typeof amount !== 'number' || !Number.isFinite(amount)) {
		issues.push(issue('money', 'invalid_member', 'Money amount must be a finite number.', 'amount'))
	}

	if (isMissing(currency)) {
		issues.push(issue('money', 'missing_member', 'Money currency is required; no default currency is applied.', 'currency'))
	} else if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
		issues.push(issue('money', 'invalid_member', 'Money currency must be an uppercase ISO 4217 alpha-3 code.', 'currency'))
	}

	if (issues.length > 0) {
		const status = issues.some((item) => item.code === 'invalid_member') ? 'invalid' : 'incomplete'
		return { ok: false, status, issues }
	}

	return { ok: true, value: { amount: amount as number, currency: currency as string } }
}

/** A value whose checked form is also what overrides receive. */
function checked<T>(validation: Validation<T>): Validation<CheckedValue> {
	return validation.ok ? { ok: true, value: { value: validation.value, parsed: validation.value } } : validation
}

/** A value overrides receive as given, while the base implementation formats its parsed form. */
function checkedInput<T>(input: unknown, validation: Validation<T>): Validation<CheckedValue> {
	return validation.ok ? { ok: true, value: { value: input, parsed: validation.value } } : validation
}

/** Checks a value once, before any implementation in its kind's chain sees it. */
const VALUE_CHECKS: { readonly [K in FormatKind]: (value: unknown, options: CallOptions) => Validation<CheckedValue> } = {
	number: (value) => checked(validateNumber(value)),
	money: (value) => checked(validateMoney(value)),
	percentage: (value) => checked(validatePercentage(value)),
	address: (value) => checked(validateAddress(value)),
	phone: (value) => checked(validatePhone(value)),
	person: (value) => checked(validatePerson(value)),
	organization: (value) => checked(validateOrganization(value)),
	party: (value, options) => {
		const validation = validateParty(value, options as FormatOptionsByKind['party'])
		return validation.ok ? { ok: true, value: { value: validation.value.value, parsed: validation.value } } : validation
	},
	date: (value) => checkedInput(value, validateDate(value)),
	datetime: (value) => checkedInput(value, validateDatetime(value)),
	time: (value) => checkedInput(value, validateTime(value)),
	duration: (value) => checkedInput(value, validateDuration(value)),
	coordinate: (value) => checked(validateCoordinate(value)),
	bbox: (value) => checked(validateBbox(value)),
	identification: (value) => checked(validateIdentification(value)),
	attachment: (value) => checked(validateAttachment(value)),
	signature: (value) => checked(validateSignature(value)),
	boolean: (value) => checked(validateBoolean(value)),
	enum: (value) => checked(validateEnumValue(value)),
	multiselect: (value) => checked(validateMultiselectValue(value)),
	rating: (value) => checked(validateRating(value)),
}

function buildPercentageIntlOptions(options: Record<string, unknown>): Record<string, unknown> {
	const percentageOptions: Record<string, unknown> = {
		...options,
		style: 'percent',
	}
	if (
		percentageOptions.minimumFractionDigits === undefined &&
		percentageOptions.maximumFractionDigits === undefined &&
		percentageOptions.maximumSignificantDigits === undefined &&
		percentageOptions.minimumSignificantDigits === undefined
	) {
		percentageOptions.maximumFractionDigits = 2
	}
	return percentageOptions
}

const DIGIT_OPTIONS = [
	'minimumFractionDigits',
	'maximumFractionDigits',
	'minimumSignificantDigits',
	'maximumSignificantDigits',
] as const

const currencyDigitCache = new Map<string, { minimumFractionDigits: number; maximumFractionDigits: number }>()

/** The fraction digits a currency is written with, such as 2 for USD and 0 for JPY. */
function currencyFractionDigits(currency: string): { minimumFractionDigits: number; maximumFractionDigits: number } {
	const cached = currencyDigitCache.get(currency)
	if (cached) return cached
	const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = new Intl.NumberFormat('en', {
		style: 'currency',
		currency,
	}).resolvedOptions()
	const digits = { minimumFractionDigits, maximumFractionDigits }
	currencyDigitCache.set(currency, digits)
	return digits
}

function buildMoneyIntlOptions(options: Record<string, unknown>, currency: string): Record<string, unknown> {
	const currencyDisplay = (options.currencyDisplay as MoneyFormatOptions['currencyDisplay'] | undefined) ?? 'symbol'
	const { currencyDisplay: _currencyDisplay, currencySign, ...numberOptions } = options
	if (currencyDisplay === 'none') {
		// Dropping the symbol does not change the amount: it keeps the
		// currency's own fraction digits unless the caller sets digits.
		const setsDigits = DIGIT_OPTIONS.some((key) => numberOptions[key] !== undefined)
		return setsDigits ? { ...numberOptions } : { ...currencyFractionDigits(currency), ...numberOptions }
	}
	return {
		...numberOptions,
		style: 'currency',
		currency,
		currencyDisplay,
		...(currencySign === undefined ? {} : { currencySign }),
	}
}

function numericIntlOptions(kind: NumericFormatKind, options: Record<string, unknown>, currency: string): Record<string, unknown> {
	if (kind === 'money') return buildMoneyIntlOptions(options, currency)
	if (kind === 'percentage') return buildPercentageIntlOptions(options)
	return options
}

/** Builds an Intl object, reporting a constructor failure as an option error. */
function intlFor<T>(kind: FormatKind, locale: string, create: () => T): T {
	try {
		return create()
	} catch (error) {
		throw new FormatConfigurationError(
			`Invalid ${kind} formatting options for locale ${JSON.stringify(locale)}: ${error instanceof Error ? error.message : 'unknown option error'}.`,
			{ cause: error },
		)
	}
}

function createNumberFormat(kind: FormatKind, policy: CallPolicy, options: Record<string, unknown>): Intl.NumberFormat {
	return intlFor(kind, policy.locale, () => new Intl.NumberFormat(policy.locale, {
		...(options as Intl.NumberFormatOptions),
		...(policy.numberingSystem === undefined ? {} : { numberingSystem: policy.numberingSystem }),
	}))
}

function createDateTimeFormat(
	kind: FormatKind,
	policy: CallPolicy,
	timeZone: string,
	options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
	return intlFor(kind, policy.locale, () => new Intl.DateTimeFormat(policy.locale, {
		...options,
		calendar: policy.calendar,
		timeZone,
		...(policy.numberingSystem === undefined ? {} : { numberingSystem: policy.numberingSystem }),
	}))
}

/** Rejects an option the given check refuses, as a configuration error. */
function guardOptions(kind: FormatKind, check: () => void): void {
	try {
		check()
	} catch (error) {
		throw new FormatConfigurationError(error instanceof Error ? error.message : `Invalid ${kind} formatting options.`, { cause: error })
	}
}

function createConfig(options: FormatterOptions): FormatterConfig {
	const policy = options.unsupportedLocale ?? 'error'
	const fallbackLocale = options.fallbackLocale === undefined
		? undefined
		: canonicalLocale(options.fallbackLocale)
	if (fallbackLocale !== undefined && !supportedLocale(fallbackLocale)) {
		throw new UnsupportedLocaleError(`Fallback locale ${JSON.stringify(options.fallbackLocale)} is not supported by this runtime.`)
	}
	const locale = resolveConfiguredLocale(options.locale ?? DEFAULT_LOCALE, policy, fallbackLocale)
	const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE
	const calendar = options.calendar ?? DEFAULT_CALENDAR

	validateNumberingSystem(options.numberingSystem)
	validateCalendar(calendar)
	timeZoneFormat(timeZone, locale)

	const kinds: Record<string, unknown> = {}
	for (const kind of FORMAT_KINDS) kinds[kind] = cloneAndFreeze(options[kind] ?? {})

	return {
		locale,
		fallbackLocale,
		unsupportedLocale: policy,
		timeZone,
		calendar,
		numberingSystem: options.numberingSystem,
		cacheSize: resolveCacheSize(options.cacheSize),
		...(kinds as KindOptions),
		messages: mergeMessages(
			mergeMessages(
				mergeMessages(mergeMessages(BUILT_IN_CONTACT_MESSAGES, BUILT_IN_TEMPORAL_MESSAGES), BUILT_IN_CAPTURE_MESSAGES),
				BUILT_IN_SELECTION_MESSAGES,
			),
			options.messages,
		),
	}
}

function overrideLayers(overrides: FormatterOverrides | undefined): Layer[] {
	if (overrides === undefined) return []
	const layers: Layer[] = []
	for (const kind of FORMAT_KINDS) {
		const implementation: unknown = overrides[kind]
		if (implementation === undefined) continue
		if (typeof implementation !== 'function') {
			throw new FormatConfigurationError(`Override for ${kind} must be a function.`)
		}
		layers.push({ kind, implementation: implementation as Implementation })
	}
	return layers
}

/**
 * Immutable formatter shared by every value family. Each kind has one chain:
 * overrides in the order they were added, ending in the base implementation.
 */
class FormatterImpl implements Formatter {
	readonly locale: string
	readonly fallbackLocale?: string
	readonly timeZone: string
	readonly calendar: string
	readonly numberingSystem?: string
	readonly messages: FormatterMessages

	private readonly config: FormatterConfig
	private readonly caches: FormatterCaches
	private readonly layers: readonly Layer[]
	private readonly chains: Partial<Record<FormatKind, ChainEntry>>

	constructor(options: FormatterOptions = {}, layers: readonly Layer[] = []) {
		this.config = createConfig(options)
		this.locale = this.config.locale
		this.fallbackLocale = this.config.fallbackLocale
		this.timeZone = this.config.timeZone
		this.calendar = this.config.calendar
		this.numberingSystem = this.config.numberingSystem
		this.messages = this.config.messages
		const caches: Record<string, BoundedCache<unknown>> = {}
		for (const bucket of CACHE_BUCKETS) caches[bucket] = new BoundedCache(this.config.cacheSize)
		this.caches = caches as FormatterCaches

		// A nested call formats with exactly these options, so checking them
		// here also checks every value family that formats through another.
		for (const kind of FORMAT_KINDS) this.checkConfiguredOptions(kind)

		this.layers = [...layers, ...overrideLayers(options.overrides)]
		const chains: Partial<Record<FormatKind, ChainEntry>> = {}
		for (const layer of this.layers) {
			chains[layer.kind] = { implementation: layer.implementation, previous: chains[layer.kind] }
		}
		this.chains = chains
	}

	private checkConfiguredOptions(kind: FormatKind): void {
		const { options, policy } = this.resolve(kind, this.config[kind] as CallOptions, false)
		const intl = intlOptions(options)
		if (kind === 'number' || kind === 'money' || kind === 'percentage') {
			createNumberFormat(kind, policy, numericIntlOptions(kind, intl, 'USD'))
		} else if (kind === 'date' || kind === 'datetime' || kind === 'time') {
			createDateTimeFormat(kind, policy, policy.timeZone, dateTimeDefaults(kind, intl as never))
		} else if (kind === 'duration') {
			createNumberFormat(kind, policy, intl)
		}
	}

	/**
	 * Resolves the options and policy of one call. A top-level call inherits the
	 * kind's formatter-level options. A nested call and a delegation do not: they
	 * carry options that were already resolved, so they never pick up a sibling
	 * kind's formatter-level options.
	 */
	private resolve(kind: FormatKind, options: CallOptions | undefined, inherit: boolean): ResolvedCall {
		const merged = inherit ? mergeKindOptions(kind, this.config[kind] as CallOptions, options) : Object.freeze({ ...(options ?? {}) })
		const locale = resolveConfiguredLocale(
			(merged.locale as string | undefined) ?? this.locale,
			this.config.unsupportedLocale,
			this.config.fallbackLocale,
		)
		const policy: CallPolicy = {
			locale,
			numberingSystem: (merged.numberingSystem as string | undefined) ?? this.numberingSystem,
			calendar: (merged.calendar as string | undefined) ?? this.calendar,
			timeZone: (merged.timeZone as string | undefined) ?? this.timeZone,
		}
		this.checkOptions(kind, merged, policy)
		return { options: merged, policy }
	}

	/** Rejects call options a kind cannot act on, before any value reaches it. */
	private checkOptions(kind: FormatKind, options: CallOptions, policy: CallPolicy): void {
		validateNumberingSystem(policy.numberingSystem)
		const family = FORMAT_KIND_FAMILIES[kind]
		if (family === 'temporal') {
			this.checkCalendarAndTimeZone(policy)
		} else if (kind === 'coordinate' || kind === 'bbox') {
			createNumberFormat(kind, policy, intlOptions(options))
		} else if (kind === 'identification' || kind === 'signature') {
			this.checkCalendarAndTimeZone(policy)
			createDateTimeFormat(kind, policy, policy.timeZone, dateTimeDefaults('date', intlOptions(options) as never))
		} else if (family === 'contact') {
			guardOptions(kind, () => validateContactOptions(kind as 'address', options as FormatOptionsByKind['address']))
		} else if (family === 'selection') {
			guardOptions(kind, () => validateSelectionOptions(kind as SelectionFormatKind, options as FormatOptionsByKind['boolean']))
		}
	}

	private checkCalendarAndTimeZone(policy: CallPolicy): void {
		validateCalendar(policy.calendar)
		this.cached('timeZone', { locale: policy.locale, timeZone: policy.timeZone }, () => timeZoneFormat(policy.timeZone, policy.locale))
	}

	private cached<B extends FormatterCacheBucket>(bucket: B, key: Record<string, unknown>, create: () => CachedByBucket[B]): CachedByBucket[B] {
		const cache = this.caches[bucket] as BoundedCache<CachedByBucket[B]>
		const serialized = stableSerialize(key)
		const existing = cache.get(serialized)
		if (existing !== undefined) return existing
		const created = create()
		cache.set(serialized, created)
		return created
	}

	private numberFormat(bucket: 'number' | 'money' | 'percentage' | 'duration', kind: FormatKind, policy: CallPolicy, options: Record<string, unknown>): Intl.NumberFormat {
		return this.cached(
			bucket,
			{ locale: policy.locale, numberingSystem: policy.numberingSystem, options },
			() => createNumberFormat(kind, policy, options),
		)
	}

	private dateTimeFormat(
		bucket: 'date' | 'datetime' | 'time',
		kind: FormatKind,
		policy: CallPolicy,
		timeZone: string,
		options: Intl.DateTimeFormatOptions,
	): Intl.DateTimeFormat {
		return this.cached(
			bucket,
			{ locale: policy.locale, numberingSystem: policy.numberingSystem, options: { calendar: policy.calendar, timeZone, ...options } },
			() => createDateTimeFormat(kind, policy, timeZone, options),
		)
	}

	private messageContext(locale: string): MessageContext {
		return { locale, messages: this.messages, fallbackLocale: this.fallbackLocale }
	}

	/**
	 * Runs one step of a kind's chain. The value is checked once per step, so a
	 * delegation that passes a new value is checked too.
	 */
	private invoke(kind: FormatKind, entry: ChainEntry | undefined, value: unknown, call: ResolvedCall): string {
		const validation = VALUE_CHECKS[kind](value, call.options)
		if (!validation.ok) throw new FormatError(validation.status, kind, validation.issues)
		if (entry === undefined) return this.base(kind, validation.value.parsed, call)

		const current = validation.value.value
		const delegate = (nextValue: unknown = current, nextOptions?: CallOptions): string =>
			this.invoke(kind, entry.previous, nextValue, this.resolve(kind, mergeKindOptions(kind, call.options, nextOptions), false))
		const output: unknown = entry.implementation(current, call.options, {
			kind,
			locale: call.policy.locale,
			options: call.options,
			delegate,
		})
		if (typeof output !== 'string') {
			throw new FormatError('error', kind, [issue(kind, 'implementation_output', 'A formatter implementation must return a string.')])
		}
		return output
	}

	/** Formats a value one family formats through another kind, such as a signature's date. */
	private nested(kind: FormatKind, value: unknown, options: CallOptions): string {
		return this.invoke(kind, this.chains[kind], value, this.resolve(kind, options, false))
	}

	private base(kind: FormatKind, parsed: unknown, call: ResolvedCall): string {
		const { options, policy } = call
		switch (kind) {
			case 'number':
			case 'money':
			case 'percentage':
				return this.formatNumeric(kind, parsed as number | MoneyValue, call)
			case 'date':
			case 'datetime': {
				const value = parsed as ParsedDateValue | ParsedDatetimeValue
				const timeZone = value.mode === 'instant' ? policy.timeZone : 'UTC'
				return this.dateTimeFormat(kind, kind, policy, timeZone, dateTimeDefaults(kind, intlOptions(options) as never)).format(value.date)
			}
			case 'time':
				return this.dateTimeFormat('time', kind, policy, 'UTC', dateTimeDefaults('time', intlOptions(options) as never))
					.format((parsed as ParsedTimeValue).date)
			case 'duration':
				return formatDurationValue(parsed as ParsedDurationValue, intlOptions(options), {
					...this.messageContext(policy.locale),
					numberFormat: (durationOptions) => this.numberFormat('duration', kind, policy, durationOptions as Record<string, unknown>),
					pluralRules: (pluralOptions) => this.cached('durationPlural', { locale: policy.locale, options: pluralOptions }, () => new Intl.PluralRules(policy.locale, pluralOptions)),
					listFormat: () => this.cached('durationList', { locale: policy.locale }, () => new Intl.ListFormat(policy.locale, { style: 'long', type: 'unit' })),
				})
			case 'address':
				return formatContactAddress(parsed as NormalizedAddress, options as AddressFormatOptions, {
					locale: policy.locale,
					options: options as AddressFormatOptions,
				})
			case 'phone':
				return formatContactPhone(parsed as NormalizedPhone, options, this.messageContext(policy.locale))
			case 'person':
				return formatContactPerson(parsed as Record<string, unknown>)
			case 'organization':
				return formatContactOrganization(parsed as Record<string, unknown>, this.messageContext(policy.locale))
			case 'party': {
				const party = parsed as ValidatedParty
				return this.nested(party.identity, party.value, { locale: policy.locale })
			}
			case 'coordinate':
				return formatCoordinateValue(parsed as Coordinate, options, this.captureContext(policy))
			case 'bbox':
				return formatBboxValue(parsed as Bbox, options, this.captureContext(policy))
			case 'identification':
				return formatIdentificationValue(parsed as Identification, options, this.captureContext(policy))
			case 'attachment':
				return formatAttachmentValue(parsed as Attachment)
			case 'signature':
				return formatSignatureValue(parsed as Signature, options, this.captureContext(policy))
			case 'boolean':
				return formatBooleanValue(parsed as boolean, options, this.selectionContext(policy))
			case 'enum':
				return formatEnumValue(parsed as SelectionOptionValue, options)
			case 'multiselect':
				return formatMultiselectValue(parsed as readonly SelectionOptionValue[], options, this.selectionContext(policy))
			case 'rating':
				return formatRatingValue(parsed as number, options, this.selectionContext(policy))
		}
	}

	private formatNumeric(kind: NumericFormatKind, value: number | MoneyValue, call: ResolvedCall): string {
		const money = kind === 'money' ? value as MoneyValue : undefined
		const options = numericIntlOptions(kind, intlOptions(call.options), money?.currency ?? 'USD')
		const amount = money === undefined ? value as number : money.amount
		return this.numberFormat(kind, kind, call.policy, options).format(kind === 'percentage' ? amount / 100 : amount)
	}

	private captureContext(policy: CallPolicy): CaptureFormattingContext {
		const { locale } = policy
		return {
			...this.messageContext(locale),
			formatNumber: (value, options) => this.nested('number', value, { ...options, locale }),
			formatCoordinate: (value, options) => this.nested('coordinate', value, { ...options, locale }),
			formatDate: (value, options) => this.nested('date', value, { ...options, locale }),
		}
	}

	private selectionContext(policy: CallPolicy): SelectionFormattingContext {
		const { locale, numberingSystem } = policy
		return {
			...this.messageContext(locale),
			formatNumber: (value, options) => this.nested('number', value, {
				...options,
				locale,
				...(numberingSystem === undefined ? {} : { numberingSystem }),
			}),
			formatEnum: (value, options) => this.nested('enum', value, { ...options, locale }),
			listFormat: (type, style) => this.selectionListFormat(locale, type, style),
		}
	}

	private selectionListFormat(locale: string, type: SelectionListType, style: SelectionListStyle): Intl.ListFormat | undefined {
		if (typeof Intl.ListFormat !== 'function' || Intl.ListFormat.supportedLocalesOf([locale]).length === 0) return undefined
		return this.cached('selectionList', { locale, type, style }, () => new Intl.ListFormat(locale, { type, style }))
	}

	private evaluate(kind: FormatKind | string, value: unknown, options: unknown): FormatResult {
		if (!isFormatKind(kind)) {
			return failed('unsupported', [issue(kind, 'unknown_kind', `Unknown format kind ${JSON.stringify(kind)}.`)])
		}
		try {
			return formatted(this.invoke(kind, this.chains[kind], value, this.resolve(kind, options as CallOptions | undefined, true)))
		} catch (error) {
			return failure(kind, error)
		}
	}

	format<K extends FormatKind>(kind: K, value: FormatInputByKind[K], options?: FormatCallOptions<K>): string {
		const result = this.safeFormat(kind, value, options)
		if (result.success) return result.value
		throw new FormatError(result.status, kind, result.issues)
	}

	safeFormat<K extends FormatKind>(kind: K, value: FormatInputByKind[K], options?: FormatCallOptions<K>): FormatResult {
		return this.evaluate(kind, value, options)
	}

	formatNumber(value: FormatInputByKind['number'], options?: FormatCallOptions<'number'>): string {
		return this.format('number', value, options)
	}

	formatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): string {
		return this.format('money', value, options)
	}

	formatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): string {
		return this.format('percentage', value, options)
	}

	formatAddress(value: FormatInputByKind['address'], options?: FormatCallOptions<'address'>): string {
		return this.format('address', value, options)
	}

	formatPhone(value: FormatInputByKind['phone'], options?: FormatCallOptions<'phone'>): string {
		return this.format('phone', value, options)
	}

	formatPerson(value: FormatInputByKind['person'], options?: FormatCallOptions<'person'>): string {
		return this.format('person', value, options)
	}

	formatOrganization(value: FormatInputByKind['organization'], options?: FormatCallOptions<'organization'>): string {
		return this.format('organization', value, options)
	}

	formatParty(value: FormatInputByKind['party'], options?: FormatCallOptions<'party'>): string {
		return this.format('party', value, options)
	}

	formatDate(value: FormatInputByKind['date'], options?: FormatCallOptions<'date'>): string {
		return this.format('date', value, options)
	}

	formatDatetime(value: FormatInputByKind['datetime'], options?: FormatCallOptions<'datetime'>): string {
		return this.format('datetime', value, options)
	}

	formatTime(value: FormatInputByKind['time'], options?: FormatCallOptions<'time'>): string {
		return this.format('time', value, options)
	}

	formatDuration(value: FormatInputByKind['duration'], options?: FormatCallOptions<'duration'>): string {
		return this.format('duration', value, options)
	}

	formatCoordinate(value: FormatInputByKind['coordinate'], options?: FormatCallOptions<'coordinate'>): string {
		return this.format('coordinate', value, options)
	}

	formatBbox(value: FormatInputByKind['bbox'], options?: FormatCallOptions<'bbox'>): string {
		return this.format('bbox', value, options)
	}

	formatIdentification(value: FormatInputByKind['identification'], options?: FormatCallOptions<'identification'>): string {
		return this.format('identification', value, options)
	}

	formatAttachment(value: FormatInputByKind['attachment'], options?: FormatCallOptions<'attachment'>): string {
		return this.format('attachment', value, options)
	}

	formatSignature(value: FormatInputByKind['signature'], options?: FormatCallOptions<'signature'>): string {
		return this.format('signature', value, options)
	}

	formatBoolean(value: FormatInputByKind['boolean'], options?: FormatCallOptions<'boolean'>): string {
		return this.format('boolean', value, options)
	}

	formatEnum(value: FormatInputByKind['enum'], options?: FormatCallOptions<'enum'>): string {
		return this.format('enum', value, options)
	}

	formatMultiselect(value: FormatInputByKind['multiselect'], options?: FormatCallOptions<'multiselect'>): string {
		return this.format('multiselect', value, options)
	}

	formatRating(value: FormatInputByKind['rating'], options?: FormatCallOptions<'rating'>): string {
		return this.format('rating', value, options)
	}

	safeFormatNumber(value: FormatInputByKind['number'], options?: FormatCallOptions<'number'>): FormatResult {
		return this.safeFormat('number', value, options)
	}

	safeFormatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): FormatResult {
		return this.safeFormat('money', value, options)
	}

	safeFormatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): FormatResult {
		return this.safeFormat('percentage', value, options)
	}

	safeFormatAddress(value: FormatInputByKind['address'], options?: FormatCallOptions<'address'>): FormatResult {
		return this.safeFormat('address', value, options)
	}

	safeFormatPhone(value: FormatInputByKind['phone'], options?: FormatCallOptions<'phone'>): FormatResult {
		return this.safeFormat('phone', value, options)
	}

	safeFormatPerson(value: FormatInputByKind['person'], options?: FormatCallOptions<'person'>): FormatResult {
		return this.safeFormat('person', value, options)
	}

	safeFormatOrganization(value: FormatInputByKind['organization'], options?: FormatCallOptions<'organization'>): FormatResult {
		return this.safeFormat('organization', value, options)
	}

	safeFormatParty(value: FormatInputByKind['party'], options?: FormatCallOptions<'party'>): FormatResult {
		return this.safeFormat('party', value, options)
	}

	safeFormatDate(value: FormatInputByKind['date'], options?: FormatCallOptions<'date'>): FormatResult {
		return this.safeFormat('date', value, options)
	}

	safeFormatDatetime(value: FormatInputByKind['datetime'], options?: FormatCallOptions<'datetime'>): FormatResult {
		return this.safeFormat('datetime', value, options)
	}

	safeFormatTime(value: FormatInputByKind['time'], options?: FormatCallOptions<'time'>): FormatResult {
		return this.safeFormat('time', value, options)
	}

	safeFormatDuration(value: FormatInputByKind['duration'], options?: FormatCallOptions<'duration'>): FormatResult {
		return this.safeFormat('duration', value, options)
	}

	safeFormatCoordinate(value: FormatInputByKind['coordinate'], options?: FormatCallOptions<'coordinate'>): FormatResult {
		return this.safeFormat('coordinate', value, options)
	}

	safeFormatBbox(value: FormatInputByKind['bbox'], options?: FormatCallOptions<'bbox'>): FormatResult {
		return this.safeFormat('bbox', value, options)
	}

	safeFormatIdentification(value: FormatInputByKind['identification'], options?: FormatCallOptions<'identification'>): FormatResult {
		return this.safeFormat('identification', value, options)
	}

	safeFormatAttachment(value: FormatInputByKind['attachment'], options?: FormatCallOptions<'attachment'>): FormatResult {
		return this.safeFormat('attachment', value, options)
	}

	safeFormatSignature(value: FormatInputByKind['signature'], options?: FormatCallOptions<'signature'>): FormatResult {
		return this.safeFormat('signature', value, options)
	}

	safeFormatBoolean(value: FormatInputByKind['boolean'], options?: FormatCallOptions<'boolean'>): FormatResult {
		return this.safeFormat('boolean', value, options)
	}

	safeFormatEnum(value: FormatInputByKind['enum'], options?: FormatCallOptions<'enum'>): FormatResult {
		return this.safeFormat('enum', value, options)
	}

	safeFormatMultiselect(value: FormatInputByKind['multiselect'], options?: FormatCallOptions<'multiselect'>): FormatResult {
		return this.safeFormat('multiselect', value, options)
	}

	safeFormatRating(value: FormatInputByKind['rating'], options?: FormatCallOptions<'rating'>): FormatResult {
		return this.safeFormat('rating', value, options)
	}


	compose(options: FormatterOptions = {}): Formatter {
		const { overrides, ...withoutOverrides } = options
		return new FormatterImpl({ ...mergeConfig(this.config, withoutOverrides), overrides }, this.layers)
	}

	withOverrides(overrides: FormatterOverrides): Formatter {
		return new FormatterImpl(this.config, [...this.layers, ...overrideLayers(overrides)])
	}

	cacheStats(): FormatterCacheStats {
		const stats: Record<string, unknown> = {}
		for (const bucket of CACHE_BUCKETS) stats[bucket] = this.caches[bucket].snapshot()
		return stats as FormatterCacheStats
	}
}

/**
 * Maps a failure to a result. A bad option is `invalid`, like a bad value. A
 * gap in the runtime or the resources (locale data, a message, an address
 * layout) is `unsupported`: the input is right and a caller can fall back.
 */
function failure(kind: FormatKind, error: unknown): FormatResult {
	if (error instanceof FormatError) return failed(error.status, error.issues)
	if (error instanceof SelectionFormatError) return failed(error.status, [issue(kind, error.code, error.message)])
	if (error instanceof MissingMessageError) return failed('unsupported', [issue(kind, 'missing_message', error.message, undefined, error)])
	if (error instanceof UnsupportedAddressLayoutError) {
		return failed('unsupported', [issue(kind, 'unsupported_country_layout', error.message, 'country', error)])
	}
	if (error instanceof UnsupportedLocaleError) return failed('unsupported', [issue(kind, 'unsupported_locale', error.message, undefined, error)])
	if (error instanceof FormatConfigurationError) return failed('invalid', [issue(kind, 'invalid_options', error.message, undefined, error)])
	return failed('error', [issue(kind, 'implementation_error', error instanceof Error ? error.message : 'Unexpected formatter failure.', undefined, error)])
}

export function createFormatter(options: FormatterOptions = {}): Formatter {
	return new FormatterImpl(options)
}

export const defaultFormatter: Formatter = createFormatter()

export function formatNumber(value: FormatInputByKind['number'], options?: FormatCallOptions<'number'>): string {
	return defaultFormatter.formatNumber(value, options)
}

export function formatAddress(value: FormatInputByKind['address'], options?: FormatCallOptions<'address'>): string {
	return defaultFormatter.formatAddress(value, options)
}

export function formatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): string {
	return defaultFormatter.formatMoney(value, options)
}

export function formatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): string {
	return defaultFormatter.formatPercentage(value, options)
}

export function formatPhone(value: FormatInputByKind['phone'], options?: FormatCallOptions<'phone'>): string {
	return defaultFormatter.formatPhone(value, options)
}

export function formatPerson(value: FormatInputByKind['person'], options?: FormatCallOptions<'person'>): string {
	return defaultFormatter.formatPerson(value, options)
}

export function formatOrganization(value: FormatInputByKind['organization'], options?: FormatCallOptions<'organization'>): string {
	return defaultFormatter.formatOrganization(value, options)
}

export function formatParty(value: FormatInputByKind['party'], options?: FormatCallOptions<'party'>): string {
	return defaultFormatter.formatParty(value, options)
}

export function formatDate(value: FormatInputByKind['date'], options?: FormatCallOptions<'date'>): string {
	return defaultFormatter.formatDate(value, options)
}

export function formatDatetime(value: FormatInputByKind['datetime'], options?: FormatCallOptions<'datetime'>): string {
	return defaultFormatter.formatDatetime(value, options)
}

export function formatTime(value: FormatInputByKind['time'], options?: FormatCallOptions<'time'>): string {
	return defaultFormatter.formatTime(value, options)
}

export function formatDuration(value: FormatInputByKind['duration'], options?: FormatCallOptions<'duration'>): string {
	return defaultFormatter.formatDuration(value, options)
}

export function formatCoordinate(value: FormatInputByKind['coordinate'], options?: FormatCallOptions<'coordinate'>): string {
	return defaultFormatter.formatCoordinate(value, options)
}

export function formatBbox(value: FormatInputByKind['bbox'], options?: FormatCallOptions<'bbox'>): string {
	return defaultFormatter.formatBbox(value, options)
}

export function formatIdentification(value: FormatInputByKind['identification'], options?: FormatCallOptions<'identification'>): string {
	return defaultFormatter.formatIdentification(value, options)
}

export function formatAttachment(value: FormatInputByKind['attachment'], options?: FormatCallOptions<'attachment'>): string {
	return defaultFormatter.formatAttachment(value, options)
}

export function formatSignature(value: FormatInputByKind['signature'], options?: FormatCallOptions<'signature'>): string {
	return defaultFormatter.formatSignature(value, options)
}

export function formatBoolean(value: FormatInputByKind['boolean'], options?: FormatCallOptions<'boolean'>): string {
	return defaultFormatter.formatBoolean(value, options)
}

export function formatEnum(value: FormatInputByKind['enum'], options?: FormatCallOptions<'enum'>): string {
	return defaultFormatter.formatEnum(value, options)
}

export function formatMultiselect(value: FormatInputByKind['multiselect'], options?: FormatCallOptions<'multiselect'>): string {
	return defaultFormatter.formatMultiselect(value, options)
}

export function formatRating(value: FormatInputByKind['rating'], options?: FormatCallOptions<'rating'>): string {
	return defaultFormatter.formatRating(value, options)
}

export function formatValue<K extends FormatKind>(
	kind: K,
	value: FormatInputByKind[K],
	options?: FormatCallOptions<K>,
): string {
	return defaultFormatter.format(kind, value, options)
}

export function safeFormatValue<K extends FormatKind>(
	kind: K,
	value: FormatInputByKind[K],
	options?: FormatCallOptions<K>,
): FormatResult {
	return defaultFormatter.safeFormat(kind, value, options)
}

export function safeFormatNumber(value: FormatInputByKind['number'], options?: FormatCallOptions<'number'>): FormatResult {
	return defaultFormatter.safeFormatNumber(value, options)
}

export function safeFormatAddress(value: FormatInputByKind['address'], options?: FormatCallOptions<'address'>): FormatResult {
	return defaultFormatter.safeFormatAddress(value, options)
}

export function safeFormatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): FormatResult {
	return defaultFormatter.safeFormatMoney(value, options)
}

export function safeFormatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): FormatResult {
	return defaultFormatter.safeFormatPercentage(value, options)
}

export function safeFormatPhone(value: FormatInputByKind['phone'], options?: FormatCallOptions<'phone'>): FormatResult {
	return defaultFormatter.safeFormatPhone(value, options)
}

export function safeFormatPerson(value: FormatInputByKind['person'], options?: FormatCallOptions<'person'>): FormatResult {
	return defaultFormatter.safeFormatPerson(value, options)
}

export function safeFormatOrganization(value: FormatInputByKind['organization'], options?: FormatCallOptions<'organization'>): FormatResult {
	return defaultFormatter.safeFormatOrganization(value, options)
}

export function safeFormatParty(value: FormatInputByKind['party'], options?: FormatCallOptions<'party'>): FormatResult {
	return defaultFormatter.safeFormatParty(value, options)
}

export function safeFormatDate(value: FormatInputByKind['date'], options?: FormatCallOptions<'date'>): FormatResult {
	return defaultFormatter.safeFormatDate(value, options)
}

export function safeFormatDatetime(value: FormatInputByKind['datetime'], options?: FormatCallOptions<'datetime'>): FormatResult {
	return defaultFormatter.safeFormatDatetime(value, options)
}

export function safeFormatTime(value: FormatInputByKind['time'], options?: FormatCallOptions<'time'>): FormatResult {
	return defaultFormatter.safeFormatTime(value, options)
}

export function safeFormatDuration(value: FormatInputByKind['duration'], options?: FormatCallOptions<'duration'>): FormatResult {
	return defaultFormatter.safeFormatDuration(value, options)
}

export function safeFormatCoordinate(value: FormatInputByKind['coordinate'], options?: FormatCallOptions<'coordinate'>): FormatResult {
	return defaultFormatter.safeFormatCoordinate(value, options)
}

export function safeFormatBbox(value: FormatInputByKind['bbox'], options?: FormatCallOptions<'bbox'>): FormatResult {
	return defaultFormatter.safeFormatBbox(value, options)
}

export function safeFormatIdentification(value: FormatInputByKind['identification'], options?: FormatCallOptions<'identification'>): FormatResult {
	return defaultFormatter.safeFormatIdentification(value, options)
}

export function safeFormatAttachment(value: FormatInputByKind['attachment'], options?: FormatCallOptions<'attachment'>): FormatResult {
	return defaultFormatter.safeFormatAttachment(value, options)
}

export function safeFormatSignature(value: FormatInputByKind['signature'], options?: FormatCallOptions<'signature'>): FormatResult {
	return defaultFormatter.safeFormatSignature(value, options)
}

export function safeFormatBoolean(value: FormatInputByKind['boolean'], options?: FormatCallOptions<'boolean'>): FormatResult {
	return defaultFormatter.safeFormatBoolean(value, options)
}

export function safeFormatEnum(value: FormatInputByKind['enum'], options?: FormatCallOptions<'enum'>): FormatResult {
	return defaultFormatter.safeFormatEnum(value, options)
}

export function safeFormatMultiselect(value: FormatInputByKind['multiselect'], options?: FormatCallOptions<'multiselect'>): FormatResult {
	return defaultFormatter.safeFormatMultiselect(value, options)
}

export function safeFormatRating(value: FormatInputByKind['rating'], options?: FormatCallOptions<'rating'>): FormatResult {
	return defaultFormatter.safeFormatRating(value, options)
}
