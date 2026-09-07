import { BoundedCache, DEFAULT_CACHE_SIZE, MAX_CACHE_SIZE, stableSerialize } from './cache'
import {
	BUILT_IN_CONTACT_MESSAGES,
	MissingContactMessageError,
	UnsupportedAddressLayoutError,
	formatAddress as formatContactAddress,
	formatOrganization as formatContactOrganization,
	formatPerson as formatContactPerson,
	formatPhone as formatContactPhone,
	inferPartyIdentity,
	validateAddress,
	validateContactOptions,
	validateOrganization,
	validateParty,
	validatePerson,
	validatePhone,
	type ContactValidation,
} from './contacts'
import {
	BUILT_IN_TEMPORAL_MESSAGES,
	MissingTemporalMessageError,
	dateTimeDefaults,
	formatDurationValue,
	validateDate,
	validateDatetime,
	validateDuration,
	validateTime,
	type TemporalValidation,
} from './temporal'
import {
	BUILT_IN_CAPTURE_MESSAGES,
	MissingCaptureMessageError,
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
	type CaptureValidation,
} from './captures'
import { BUILT_IN_FIELD_MESSAGES } from './field-messages'
import { FormatConfigurationError, FormatError } from './errors'
import {
	FORMAT_KINDS,
	type CaptureFormatImplementation,
	type CaptureFormatImplementationContext,
	type CaptureFormatKind,
	type CaptureValueByKind,
	type AddressFormatOptions,
	type ContactFormatImplementation,
	type ContactFormatImplementationContext,
	type ContactFormatKind,
	type ContactValueByKind,
	type FormatCallOptions,
	type FormatImplementation,
	type FormatImplementationContext,
	type FormatInputByKind,
	type FormatIssue,
	type FormatKind,
	type FormatOptionsByKind,
	type FormatResult,
	type Formatter,
	type FormatterCacheStats,
	type FormatterMessages,
	type FormatterOptions,
	type FormatterOverrides,
	type MoneyFormatOptions,
	type NumericFormatKind,
	type NumericValueByKind,
	type NumberFormatOptions,
	type PercentageFormatOptions,
	type TemporalFormatImplementation,
	type TemporalFormatImplementationContext,
	type TemporalFormatKind,
	type TemporalValueByKind,
} from './types'

const DEFAULT_LOCALE = 'en-US'
const DEFAULT_TIME_ZONE = 'UTC'
const DEFAULT_CALENDAR = 'gregory'
const NUMERIC_KINDS: readonly NumericFormatKind[] = ['number', 'money', 'percentage']
const CONTACT_KINDS: readonly ContactFormatKind[] = ['address', 'phone', 'person', 'organization', 'party']
const TEMPORAL_KINDS: readonly TemporalFormatKind[] = ['date', 'datetime', 'time', 'duration']
const CAPTURE_KINDS: readonly CaptureFormatKind[] = ['coordinate', 'bbox', 'identification', 'attachment', 'signature']

type NumericImplementationMap = {
	[K in NumericFormatKind]: FormatImplementation<K>
}

type NumericChainMap = {
	[K in NumericFormatKind]: ChainEntry<K>
}

interface ChainEntry<K extends NumericFormatKind> {
	readonly implementation: FormatImplementation<K>
	readonly previous?: ChainEntry<K>
}

type ContactImplementationMap = {
	[K in ContactFormatKind]: ContactFormatImplementation<K>
}

type ContactChainMap = {
	[K in ContactFormatKind]: ContactChainEntry<K>
}

interface ContactChainEntry<K extends ContactFormatKind> {
	readonly implementation: ContactFormatImplementation<K>
	readonly previous?: ContactChainEntry<K>
}

type TemporalImplementationMap = {
	[K in TemporalFormatKind]: TemporalFormatImplementation<K>
}

type TemporalChainMap = {
	[K in TemporalFormatKind]: TemporalChainEntry<K>
}

interface TemporalChainEntry<K extends TemporalFormatKind> {
	readonly implementation: TemporalFormatImplementation<K>
	readonly previous?: TemporalChainEntry<K>
}

type CaptureImplementationMap = {
	[K in CaptureFormatKind]: CaptureFormatImplementation<K>
}

type CaptureChainMap = {
	[K in CaptureFormatKind]: CaptureChainEntry<K>
}

interface CaptureChainEntry<K extends CaptureFormatKind> {
	readonly implementation: CaptureFormatImplementation<K>
	readonly previous?: CaptureChainEntry<K>
}

interface FormatterConfig {
	readonly locale: string
	readonly fallbackLocale?: string
	readonly unsupportedLocale: 'error' | 'fallback'
	readonly timeZone: string
	readonly calendar: string
	readonly numberingSystem?: string
	readonly cacheSize: number
	readonly number: NumberFormatOptions
	readonly money: MoneyFormatOptions
	readonly percentage: PercentageFormatOptions
	readonly address: AddressFormatOptions
	readonly phone: FormatOptionsByKind['phone']
	readonly person: FormatOptionsByKind['person']
	readonly organization: FormatOptionsByKind['organization']
	readonly party: FormatOptionsByKind['party']
	readonly date: FormatOptionsByKind['date']
	readonly datetime: FormatOptionsByKind['datetime']
	readonly time: FormatOptionsByKind['time']
	readonly duration: FormatOptionsByKind['duration']
	readonly coordinate: FormatOptionsByKind['coordinate']
	readonly bbox: FormatOptionsByKind['bbox']
	readonly identification: FormatOptionsByKind['identification']
	readonly attachment: FormatOptionsByKind['attachment']
	readonly signature: FormatOptionsByKind['signature']
	readonly messages: FormatterMessages
}

interface ValidationSuccess<T> {
	ok: true
	value: T
}

interface ValidationFailure {
	ok: false
	status: 'missing' | 'incomplete' | 'invalid'
	issues: readonly FormatIssue[]
}

type Validation<T> = ValidationSuccess<T> | ValidationFailure

interface ResolvedCall<K extends NumericFormatKind> {
	readonly locale: string
	readonly numberingSystem?: string
	readonly options: FormatCallOptions<K>
}

interface ResolvedContactCall<K extends ContactFormatKind> {
	readonly locale: string
	readonly options: FormatCallOptions<K>
}

interface ResolvedTemporalCall<K extends TemporalFormatKind> {
	readonly locale: string
	readonly timeZone: string
	readonly calendar: string
	readonly numberingSystem?: string
	readonly options: FormatCallOptions<K>
}

interface ResolvedCaptureCall<K extends CaptureFormatKind> {
	readonly locale: string
	readonly timeZone?: string
	readonly calendar?: string
	readonly numberingSystem?: string
	readonly options: FormatCallOptions<K>
}

class FormatProblem extends Error {
	constructor(
		readonly status: 'missing' | 'incomplete' | 'invalid' | 'unsupported' | 'error',
		readonly kind: FormatKind | string,
		readonly issues: readonly FormatIssue[],
	) {
		super(issues[0]?.message ?? `Unable to format ${kind}`)
		this.name = 'FormatProblem'
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissing(value: unknown): value is null | undefined {
	return value === null || value === undefined
}

function issue(
	kind: FormatKind | string,
	code: string,
	message: string,
	path?: string,
	cause?: unknown,
): FormatIssue {
	return { code, message, kind, ...(path === undefined ? {} : { path }), ...(cause === undefined ? {} : { cause }) }
}

function formatted(value: string): FormatResult {
	return { success: true, status: 'formatted', value }
}

function failed(
	status: Exclude<FormatProblem['status'], 'formatted'>,
	issues: readonly FormatIssue[],
): FormatResult {
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

function validateTimeZone(timeZone: string, locale: string): void {
	try {
		new Intl.DateTimeFormat(locale, { timeZone }).format()
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
		throw new FormatConfigurationError(`Locale ${JSON.stringify(requested)} is not supported by this runtime.`)
	}
	if (fallbackLocale === undefined) {
		throw new FormatConfigurationError(
			`Locale ${JSON.stringify(requested)} is unsupported and no fallbackLocale was supplied.`,
		)
	}
	const fallback = canonicalLocale(fallbackLocale)
	if (!supportedLocale(fallback)) {
		throw new FormatConfigurationError(`Fallback locale ${JSON.stringify(fallbackLocale)} is not supported by this runtime.`)
	}
	return fallback
}

function resolveCacheSize(value: number | undefined): number {
	const cacheSize = value ?? DEFAULT_CACHE_SIZE
	if (!Number.isInteger(cacheSize) || cacheSize < 1 || cacheSize > MAX_CACHE_SIZE) {
		throw new FormatConfigurationError(`cacheSize must be an integer between 1 and ${MAX_CACHE_SIZE}.`)
	}
	return cacheSize
}

function mergeOptions<K extends FormatKind>(
	base: FormatOptionsByKind[K],
	addition: FormatCallOptions<K> | undefined,
): FormatCallOptions<K> {
	return Object.freeze({ ...base, ...(addition ?? {}) }) as FormatCallOptions<K>
}

function mergeConfig(base: FormatterConfig, addition: FormatterOptions): FormatterOptions {
	return {
		locale: addition.locale ?? base.locale,
		fallbackLocale: addition.fallbackLocale ?? base.fallbackLocale,
		unsupportedLocale: addition.unsupportedLocale ?? base.unsupportedLocale,
		timeZone: addition.timeZone ?? base.timeZone,
		calendar: addition.calendar ?? base.calendar,
		numberingSystem: addition.numberingSystem ?? base.numberingSystem,
		cacheSize: addition.cacheSize ?? base.cacheSize,
		number: { ...base.number, ...(addition.number ?? {}) },
		money: { ...base.money, ...(addition.money ?? {}) },
		percentage: { ...base.percentage, ...(addition.percentage ?? {}) },
		address: {
			...base.address,
			...(addition.address ?? {}),
			countryLayouts: {
				...(base.address.countryLayouts ?? {}),
				...(addition.address?.countryLayouts ?? {}),
			},
		},
		phone: { ...base.phone, ...(addition.phone ?? {}) },
		person: { ...base.person, ...(addition.person ?? {}) },
		organization: { ...base.organization, ...(addition.organization ?? {}) },
		party: { ...base.party, ...(addition.party ?? {}) },
		date: { ...base.date, ...(addition.date ?? {}) },
		datetime: { ...base.datetime, ...(addition.datetime ?? {}) },
		time: { ...base.time, ...(addition.time ?? {}) },
		duration: { ...base.duration, ...(addition.duration ?? {}) },
		coordinate: { ...base.coordinate, ...(addition.coordinate ?? {}) },
		bbox: { ...base.bbox, ...(addition.bbox ?? {}) },
		identification: { ...base.identification, ...(addition.identification ?? {}) },
		attachment: { ...base.attachment, ...(addition.attachment ?? {}) },
		signature: { ...base.signature, ...(addition.signature ?? {}) },
		messages: mergeMessages(base.messages, addition.messages),
	}
}

function validateNumber(value: unknown): Validation<number> {
	if (isMissing(value)) {
		return {
			ok: false,
			status: 'missing',
			issues: [issue('number', 'missing_value', 'Number value is missing.')],
		}
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return {
			ok: false,
			status: 'invalid',
			issues: [issue('number', 'invalid_number', 'Number value must be a finite number.')],
		}
	}
	return { ok: true, value }
}

function validatePercentage(value: unknown): Validation<number> {
	if (isMissing(value)) {
		return {
			ok: false,
			status: 'missing',
			issues: [issue('percentage', 'missing_value', 'Percentage value is missing.')],
		}
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

function validateMoney(value: unknown): Validation<{ amount: number; currency: string }> {
	if (isMissing(value)) {
		return {
			ok: false,
			status: 'missing',
			issues: [issue('money', 'missing_value', 'Money value is missing.')],
		}
	}
	if (!isRecord(value)) {
		return {
			ok: false,
			status: 'invalid',
			issues: [issue('money', 'invalid_object', 'Money value must be an object with amount and currency.')],
		}
	}

	const amount = value.amount
	const currency = value.currency
	const amountMissing = isMissing(amount)
	const currencyMissing = isMissing(currency)
	const issues: FormatIssue[] = []

	if (amountMissing) {
		issues.push(issue('money', 'missing_member', 'Money amount is required.', 'amount'))
	} else if (typeof amount !== 'number' || !Number.isFinite(amount)) {
		issues.push(issue('money', 'invalid_member', 'Money amount must be a finite number.', 'amount'))
	}

	if (currencyMissing) {
		issues.push(issue('money', 'missing_member', 'Money currency is required; no default currency is applied.', 'currency'))
	} else if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
		issues.push(issue('money', 'invalid_member', 'Money currency must be an uppercase ISO 4217 alpha-3 code.', 'currency'))
	}

	if (issues.length > 0) {
		const hasInvalid = issues.some((item) => item.code === 'invalid_member')
		const status = hasInvalid ? 'invalid' : 'incomplete'
		return { ok: false, status, issues }
	}

	return { ok: true, value: { amount: amount as number, currency: currency as string } }
}

function validateNumericValue<K extends NumericFormatKind>(kind: K, value: unknown): Validation<NumericValueByKind[K]> {
	if (kind === 'number') return validateNumber(value) as Validation<NumericValueByKind[K]>
	if (kind === 'percentage') return validatePercentage(value) as Validation<NumericValueByKind[K]>
	return validateMoney(value) as Validation<NumericValueByKind[K]>
}

function stripLocaleOptions<K extends NumericFormatKind>(options: FormatCallOptions<K>): {
	readonly locale?: string
	readonly numberingSystem?: string
	readonly intl: Record<string, unknown>
} {
	const { locale, numberingSystem, ...intl } = options as FormatCallOptions<K> & Record<string, unknown>
	return { locale, numberingSystem, intl }
}

function asIntlOptions(value: Record<string, unknown>): Intl.NumberFormatOptions {
	return value as Intl.NumberFormatOptions
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

function buildMoneyIntlOptions(options: Record<string, unknown>, currency: string): Record<string, unknown> {
	const currencyDisplay = (options.currencyDisplay as MoneyFormatOptions['currencyDisplay'] | undefined) ?? 'symbol'
	const { currencyDisplay: _currencyDisplay, currencySign: _currencySign, ...numberOptions } = options
	if (currencyDisplay === 'none') return { ...numberOptions }
	return {
		...numberOptions,
		style: 'currency',
		currency,
		currencyDisplay,
		...(_currencySign === undefined ? {} : { currencySign: _currencySign }),
	}
}

function validateIntlOptions(
	kind: NumericFormatKind,
	locale: string,
	numberingSystem: string | undefined,
	options: Record<string, unknown>,
): void {
	const intlOptions = kind === 'money'
		? buildMoneyIntlOptions(options, 'USD')
		: kind === 'percentage'
			? buildPercentageIntlOptions(options)
			: options
	try {
		new Intl.NumberFormat(locale, {
			...asIntlOptions(intlOptions),
			...(numberingSystem === undefined ? {} : { numberingSystem }),
		})
	} catch (error) {
		throw new FormatConfigurationError(
			`Invalid ${kind} formatting options for locale ${JSON.stringify(locale)}: ${error instanceof Error ? error.message : 'unknown option error'}.`,
			{ cause: error },
		)
	}
}

function stripTemporalPolicyOptions(options: Record<string, unknown>): Record<string, unknown> {
	const { locale: _locale, numberingSystem: _numberingSystem, timeZone: _timeZone, calendar: _calendar, ...intl } = options
	return intl
}

function validateTemporalIntlOptions(
	kind: 'date' | 'datetime' | 'time',
	locale: string,
	numberingSystem: string | undefined,
	calendar: string,
	timeZone: string,
	options: Record<string, unknown>,
): void {
	try {
		const intlOptions = dateTimeDefaults(kind, stripTemporalPolicyOptions(options) as never)
		new Intl.DateTimeFormat(locale, {
			...intlOptions,
			calendar,
			timeZone,
			...(numberingSystem === undefined ? {} : { numberingSystem }),
		})
	} catch (error) {
		throw new FormatConfigurationError(
			`Invalid ${kind} formatting options for locale ${JSON.stringify(locale)}: ${error instanceof Error ? error.message : 'unknown option error'}.`,
			{ cause: error },
		)
	}
}

function validateDurationIntlOptions(
	locale: string,
	numberingSystem: string | undefined,
	options: Record<string, unknown>,
): void {
	try {
		new Intl.NumberFormat(locale, {
			...options,
			...(numberingSystem === undefined ? {} : { numberingSystem }),
		})
	} catch (error) {
		throw new FormatConfigurationError(
			`Invalid duration formatting options for locale ${JSON.stringify(locale)}: ${error instanceof Error ? error.message : 'unknown option error'}.`,
			{ cause: error },
		)
	}
}

function optionError(kind: NumericFormatKind, error: unknown): FormatProblem {
	return new FormatProblem(
		'invalid',
		kind,
		[issue(kind, 'invalid_options', error instanceof Error ? error.message : 'Invalid formatting options.', undefined, error)],
	)
}

function temporalOptionError(kind: TemporalFormatKind, error: unknown): FormatProblem {
	return new FormatProblem(
		'invalid',
		kind,
		[issue(kind, 'invalid_options', error instanceof Error ? error.message : 'Invalid temporal formatting options.', undefined, error)],
	)
}

function isNumericKind(kind: FormatKind | string): kind is NumericFormatKind {
	return NUMERIC_KINDS.includes(kind as NumericFormatKind)
}

function isContactKind(kind: FormatKind | string): kind is ContactFormatKind {
	return CONTACT_KINDS.includes(kind as ContactFormatKind)
}

function isTemporalKind(kind: FormatKind | string): kind is TemporalFormatKind {
	return TEMPORAL_KINDS.includes(kind as TemporalFormatKind)
}

function isCaptureKind(kind: FormatKind | string): kind is CaptureFormatKind {
	return CAPTURE_KINDS.includes(kind as CaptureFormatKind)
}

function createConfig(options: FormatterOptions): FormatterConfig {
	const policy = options.unsupportedLocale ?? 'error'
	const requestedLocale = options.locale ?? DEFAULT_LOCALE
	const fallbackLocale = options.fallbackLocale === undefined
		? undefined
		: canonicalLocale(options.fallbackLocale)
	const locale = resolveConfiguredLocale(requestedLocale, policy, fallbackLocale)
	const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE
	const calendar = options.calendar ?? DEFAULT_CALENDAR

	validateNumberingSystem(options.numberingSystem)
	validateCalendar(calendar)
	validateTimeZone(timeZone, locale)
	if (fallbackLocale !== undefined && !supportedLocale(fallbackLocale)) {
		throw new FormatConfigurationError(`Fallback locale ${JSON.stringify(fallbackLocale)} is not supported by this runtime.`)
	}
	if (policy === 'fallback' && options.fallbackLocale === undefined && !supportedLocale(canonicalLocale(requestedLocale))) {
		throw new FormatConfigurationError('unsupportedLocale: fallback requires fallbackLocale.')
	}
	const numberOptions = options.number ?? {}
	const moneyOptions = options.money ?? {}
	const percentageOptions = options.percentage ?? {}
	const addressOptions = options.address ?? {}
	const phoneOptions = options.phone ?? {}
	const personOptions = options.person ?? {}
	const organizationOptions = options.organization ?? {}
	const partyOptions = options.party ?? {}
	const coordinateOptions = options.coordinate ?? {}
	const bboxOptions = options.bbox ?? {}
	const identificationOptions = options.identification ?? {}
	const attachmentOptions = options.attachment ?? {}
	const signatureOptions = options.signature ?? {}
	validateIntlOptions('number', locale, options.numberingSystem, numberOptions)
	validateIntlOptions('money', locale, options.numberingSystem, moneyOptions as Record<string, unknown>)
	validateIntlOptions('percentage', locale, options.numberingSystem, percentageOptions)
	validateTemporalIntlOptions('date', locale, options.numberingSystem, calendar, timeZone, (options.date ?? {}) as Record<string, unknown>)
	validateTemporalIntlOptions('datetime', locale, options.numberingSystem, calendar, timeZone, (options.datetime ?? {}) as Record<string, unknown>)
	validateTemporalIntlOptions('time', locale, options.numberingSystem, calendar, timeZone, (options.time ?? {}) as Record<string, unknown>)
	validateDurationIntlOptions(locale, options.numberingSystem, (options.duration ?? {}) as Record<string, unknown>)
	validateIntlOptions('number', locale, options.numberingSystem, coordinateOptions as Record<string, unknown>)
	validateIntlOptions('number', locale, options.numberingSystem, bboxOptions as Record<string, unknown>)
	validateTemporalIntlOptions('date', locale, options.numberingSystem, calendar, timeZone, identificationOptions as Record<string, unknown>)
	validateTemporalIntlOptions('date', locale, options.numberingSystem, calendar, timeZone, signatureOptions as Record<string, unknown>)
	try {
		validateContactOptions(addressOptions, phoneOptions, personOptions, organizationOptions, partyOptions)
	} catch (error) {
		throw new FormatConfigurationError(error instanceof Error ? error.message : 'Invalid contact formatting options.', { cause: error })
	}

	return {
		locale,
		fallbackLocale,
		unsupportedLocale: policy,
		timeZone,
		calendar,
		numberingSystem: options.numberingSystem,
		cacheSize: resolveCacheSize(options.cacheSize),
		number: cloneAndFreeze(options.number ?? {}),
		money: cloneAndFreeze(options.money ?? {}),
		percentage: cloneAndFreeze(options.percentage ?? {}),
		address: cloneAndFreeze(addressOptions),
		phone: cloneAndFreeze(phoneOptions),
		person: cloneAndFreeze(personOptions),
		organization: cloneAndFreeze(organizationOptions),
		party: cloneAndFreeze(partyOptions),
		date: cloneAndFreeze(options.date ?? {}),
		datetime: cloneAndFreeze(options.datetime ?? {}),
		time: cloneAndFreeze(options.time ?? {}),
		duration: cloneAndFreeze(options.duration ?? {}),
		coordinate: cloneAndFreeze(coordinateOptions),
		bbox: cloneAndFreeze(bboxOptions),
		identification: cloneAndFreeze(identificationOptions),
		attachment: cloneAndFreeze(attachmentOptions),
		signature: cloneAndFreeze(signatureOptions),
		messages: mergeMessages(
			mergeMessages(
				mergeMessages(mergeMessages(BUILT_IN_CONTACT_MESSAGES, BUILT_IN_TEMPORAL_MESSAGES), BUILT_IN_CAPTURE_MESSAGES),
				BUILT_IN_FIELD_MESSAGES,
			),
			options.messages,
		),
	}
}

/**
 * Immutable formatter implementation shared by numeric and contact value
 * families. Later value-family slices extend the same typed chains.
 */
class FormatterImpl implements Formatter {
	readonly locale: string
	readonly fallbackLocale?: string
	readonly timeZone: string
	readonly calendar: string
	readonly numberingSystem?: string
	readonly messages: FormatterMessages

	private readonly config: FormatterConfig
	private readonly numberCache: BoundedCache<Intl.NumberFormat>
	private readonly moneyCache: BoundedCache<Intl.NumberFormat>
	private readonly percentageCache: BoundedCache<Intl.NumberFormat>
	private readonly dateCache: BoundedCache<Intl.DateTimeFormat>
	private readonly datetimeCache: BoundedCache<Intl.DateTimeFormat>
	private readonly timeCache: BoundedCache<Intl.DateTimeFormat>
	private readonly timeZoneCache: BoundedCache<Intl.DateTimeFormat>
	private readonly durationCache: BoundedCache<Intl.NumberFormat>
	private readonly durationPluralCache: BoundedCache<Intl.PluralRules>
	private readonly durationListCache: BoundedCache<Intl.ListFormat>
	private readonly baseImplementations: NumericImplementationMap
	private readonly chains: NumericChainMap
	private readonly baseContactImplementations: ContactImplementationMap
	private readonly contactChains: ContactChainMap
	private readonly baseTemporalImplementations: TemporalImplementationMap
	private readonly temporalChains: TemporalChainMap
	private readonly baseCaptureImplementations: CaptureImplementationMap
	private readonly captureChains: CaptureChainMap
	private readonly numericLayers: readonly { kind: NumericFormatKind; implementation: FormatImplementation<NumericFormatKind> }[]
	private readonly contactLayers: readonly { kind: ContactFormatKind; implementation: ContactFormatImplementation<ContactFormatKind> }[]
	private readonly temporalLayers: readonly { kind: TemporalFormatKind; implementation: TemporalFormatImplementation<TemporalFormatKind> }[]
	private readonly captureLayers: readonly { kind: CaptureFormatKind; implementation: CaptureFormatImplementation<CaptureFormatKind> }[]

	constructor(
		options: FormatterOptions = {},
		numericLayers: readonly { kind: NumericFormatKind; implementation: FormatImplementation<NumericFormatKind> }[] = [],
		contactLayers: readonly { kind: ContactFormatKind; implementation: ContactFormatImplementation<ContactFormatKind> }[] = [],
		temporalLayers: readonly { kind: TemporalFormatKind; implementation: TemporalFormatImplementation<TemporalFormatKind> }[] = [],
		captureLayers: readonly { kind: CaptureFormatKind; implementation: CaptureFormatImplementation<CaptureFormatKind> }[] = [],
	) {
		this.config = createConfig(options)
		this.locale = this.config.locale
		this.fallbackLocale = this.config.fallbackLocale
		this.timeZone = this.config.timeZone
		this.calendar = this.config.calendar
		this.numberingSystem = this.config.numberingSystem
		this.messages = this.config.messages
		this.numberCache = new BoundedCache(this.config.cacheSize)
		this.moneyCache = new BoundedCache(this.config.cacheSize)
		this.percentageCache = new BoundedCache(this.config.cacheSize)
		this.dateCache = new BoundedCache(this.config.cacheSize)
		this.datetimeCache = new BoundedCache(this.config.cacheSize)
		this.timeCache = new BoundedCache(this.config.cacheSize)
		this.timeZoneCache = new BoundedCache(this.config.cacheSize)
		this.durationCache = new BoundedCache(this.config.cacheSize)
		this.durationPluralCache = new BoundedCache(this.config.cacheSize)
		this.durationListCache = new BoundedCache(this.config.cacheSize)
		this.baseImplementations = {
			number: (value, options) => this.formatPlainNumber(value, options),
			money: (value, options) => this.formatMoneyValue(value as { amount: number; currency: string }, options),
			percentage: (value, options) => this.formatPercentageValue(value, options),
		}
		this.baseContactImplementations = {
			address: (value, options, context) => this.formatAddressValue(value, options, context),
			phone: (value, options, context) => this.formatPhoneValue(value, options, context),
			person: (value) => this.formatPersonValue(value),
			organization: (value, _options, context) => this.formatOrganizationValue(value, context),
			party: (value, options, context) => this.formatPartyValue(value, options, context),
		}
		this.baseTemporalImplementations = {
			date: (value, options) => this.formatDateValue(value, options),
			datetime: (value, options) => this.formatDatetimeValue(value, options),
			time: (value, options) => this.formatTimeValue(value, options),
			duration: (value, options) => this.formatDurationValue(value, options),
		}
		this.baseCaptureImplementations = {
			coordinate: (value, options, context) => this.formatCoordinateValue(value, options, context),
			bbox: (value, options, context) => this.formatBboxValue(value, options, context),
			identification: (value, options, context) => this.formatIdentificationValue(value, options, context),
			attachment: (value, options, context) => this.formatAttachmentValue(value, options, context),
			signature: (value, options, context) => this.formatSignatureValue(value, options, context),
		}
		const optionLayers: { kind: NumericFormatKind; implementation: FormatImplementation<NumericFormatKind> }[] = []
		for (const kind of NUMERIC_KINDS) {
			const implementation = options.overrides?.[kind] as FormatImplementation<NumericFormatKind> | undefined
			if (implementation !== undefined) optionLayers.push({ kind, implementation })
		}
		this.numericLayers = [...numericLayers, ...optionLayers]
		this.contactLayers = [...contactLayers, ...this.contactOptionLayers(options.overrides)]
		this.temporalLayers = [...temporalLayers, ...this.temporalOptionLayers(options.overrides)]
		this.captureLayers = [...captureLayers, ...this.captureOptionLayers(options.overrides)]
		this.chains = {
			number: { implementation: this.baseImplementations.number },
			money: { implementation: this.baseImplementations.money },
			percentage: { implementation: this.baseImplementations.percentage },
		}
		this.contactChains = {
			address: { implementation: this.baseContactImplementations.address },
			phone: { implementation: this.baseContactImplementations.phone },
			person: { implementation: this.baseContactImplementations.person },
			organization: { implementation: this.baseContactImplementations.organization },
			party: { implementation: this.baseContactImplementations.party },
		}
		this.temporalChains = {
			date: { implementation: this.baseTemporalImplementations.date },
			datetime: { implementation: this.baseTemporalImplementations.datetime },
			time: { implementation: this.baseTemporalImplementations.time },
			duration: { implementation: this.baseTemporalImplementations.duration },
		}
		this.captureChains = {
			coordinate: { implementation: this.baseCaptureImplementations.coordinate },
			bbox: { implementation: this.baseCaptureImplementations.bbox },
			identification: { implementation: this.baseCaptureImplementations.identification },
			attachment: { implementation: this.baseCaptureImplementations.attachment },
			signature: { implementation: this.baseCaptureImplementations.signature },
		}
		for (const layer of this.numericLayers) this.addLayer(layer.kind, layer.implementation)
		for (const layer of this.contactLayers) this.addContactLayer(layer.kind, layer.implementation)
		for (const layer of this.temporalLayers) this.addTemporalLayer(layer.kind, layer.implementation)
		for (const layer of this.captureLayers) this.addCaptureLayer(layer.kind, layer.implementation)
	}

	private contactOptionLayers(overrides: FormatterOverrides | undefined): { kind: ContactFormatKind; implementation: ContactFormatImplementation<ContactFormatKind> }[] {
		if (overrides === undefined) return []
		const layers: { kind: ContactFormatKind; implementation: ContactFormatImplementation<ContactFormatKind> }[] = []
		for (const kind of CONTACT_KINDS) {
			const implementation = overrides[kind] as ContactFormatImplementation<ContactFormatKind> | undefined
			if (implementation !== undefined) layers.push({ kind, implementation })
		}
		return layers
	}

	private temporalOptionLayers(overrides: FormatterOverrides | undefined): { kind: TemporalFormatKind; implementation: TemporalFormatImplementation<TemporalFormatKind> }[] {
		if (overrides === undefined) return []
		const layers: { kind: TemporalFormatKind; implementation: TemporalFormatImplementation<TemporalFormatKind> }[] = []
		for (const kind of TEMPORAL_KINDS) {
			const implementation = overrides[kind] as TemporalFormatImplementation<TemporalFormatKind> | undefined
			if (implementation !== undefined) layers.push({ kind, implementation })
		}
		return layers
	}

	private captureOptionLayers(overrides: FormatterOverrides | undefined): { kind: CaptureFormatKind; implementation: CaptureFormatImplementation<CaptureFormatKind> }[] {
		if (overrides === undefined) return []
		const layers: { kind: CaptureFormatKind; implementation: CaptureFormatImplementation<CaptureFormatKind> }[] = []
		for (const kind of CAPTURE_KINDS) {
			const implementation = overrides[kind] as CaptureFormatImplementation<CaptureFormatKind> | undefined
			if (implementation !== undefined) layers.push({ kind, implementation })
		}
		return layers
	}

	private addLayer(kind: NumericFormatKind, implementation: FormatImplementation<NumericFormatKind>): void {
		if (typeof implementation !== 'function') {
			throw new FormatConfigurationError(`Override for ${kind} must be a function.`)
		}
		const previous = this.chains[kind] as unknown as ChainEntry<NumericFormatKind>
		;(this.chains as Record<NumericFormatKind, ChainEntry<NumericFormatKind>>)[kind] = {
			implementation,
			previous,
		}
	}

	private addContactLayer(kind: ContactFormatKind, implementation: ContactFormatImplementation<ContactFormatKind>): void {
		if (typeof implementation !== 'function') {
			throw new FormatConfigurationError(`Override for ${kind} must be a function.`)
		}
		const previous = this.contactChains[kind] as unknown as ContactChainEntry<ContactFormatKind>
		;(this.contactChains as Record<ContactFormatKind, ContactChainEntry<ContactFormatKind>>)[kind] = {
			implementation,
			previous,
		}
	}

	private addTemporalLayer(kind: TemporalFormatKind, implementation: TemporalFormatImplementation<TemporalFormatKind>): void {
		if (typeof implementation !== 'function') {
			throw new FormatConfigurationError(`Override for ${kind} must be a function.`)
		}
		const previous = this.temporalChains[kind] as unknown as TemporalChainEntry<TemporalFormatKind>
		;(this.temporalChains as Record<TemporalFormatKind, TemporalChainEntry<TemporalFormatKind>>)[kind] = {
			implementation,
			previous,
		}
	}

	private addCaptureLayer(kind: CaptureFormatKind, implementation: CaptureFormatImplementation<CaptureFormatKind>): void {
		if (typeof implementation !== 'function') {
			throw new FormatConfigurationError(`Override for ${kind} must be a function.`)
		}
		const previous = this.captureChains[kind] as unknown as CaptureChainEntry<CaptureFormatKind>
		;(this.captureChains as Record<CaptureFormatKind, CaptureChainEntry<CaptureFormatKind>>)[kind] = {
			implementation,
			previous,
		}
	}

	private resolveCall<K extends NumericFormatKind>(
		kind: K,
		options: FormatCallOptions<K> | undefined,
	): ResolvedCall<K> {
		const merged = mergeOptions(this.config[kind] as FormatOptionsByKind[K], options)
		const { locale: requestedLocale, numberingSystem } = stripLocaleOptions(merged)
		const locale = resolveConfiguredLocale(
			requestedLocale ?? this.locale,
			this.config.unsupportedLocale,
			this.config.fallbackLocale,
		)
		const selectedNumberingSystem = numberingSystem ?? this.numberingSystem
		validateNumberingSystem(selectedNumberingSystem)
		return { locale, numberingSystem: selectedNumberingSystem, options: merged }
	}

	private resolveContactCall<K extends ContactFormatKind>(
		kind: K,
		options: FormatCallOptions<K> | undefined,
	): ResolvedContactCall<K> {
		let merged = mergeOptions(this.config[kind] as FormatOptionsByKind[K], options)
		const addressCallOptions = options as FormatCallOptions<'address'> | undefined
		if (kind === 'address' && addressCallOptions?.countryLayouts !== undefined) {
			merged = Object.freeze({
				...merged,
				countryLayouts: {
					...(this.config.address.countryLayouts ?? {}),
					...addressCallOptions.countryLayouts,
				},
			}) as FormatCallOptions<K>
		}
		const { locale: requestedLocale } = merged as FormatCallOptions<K> & { locale?: string }
		const locale = resolveConfiguredLocale(
			requestedLocale ?? this.locale,
			this.config.unsupportedLocale,
			this.config.fallbackLocale,
		)
		try {
			if (kind === 'address') validateContactOptions(merged as FormatCallOptions<'address'>, {}, {}, {}, {})
			if (kind === 'phone') validateContactOptions({}, merged as FormatCallOptions<'phone'>, {}, {}, {})
			if (kind === 'party') validateContactOptions({}, {}, {}, {}, merged as FormatCallOptions<'party'>)
		} catch (error) {
			throw new FormatConfigurationError(error instanceof Error ? error.message : `Invalid ${kind} formatting options.`, { cause: error })
		}
		return { locale, options: merged }
	}

	private resolveTemporalCall<K extends TemporalFormatKind>(
		kind: K,
		options: FormatCallOptions<K> | undefined,
	): ResolvedTemporalCall<K> {
		const merged = mergeOptions(this.config[kind] as FormatOptionsByKind[K], options)
		const raw = merged as FormatCallOptions<K> & {
			locale?: string
			numberingSystem?: string
			timeZone?: string
			calendar?: string
		}
		const locale = resolveConfiguredLocale(
			raw.locale ?? this.locale,
			this.config.unsupportedLocale,
			this.config.fallbackLocale,
			)
			const numberingSystem = raw.numberingSystem ?? this.numberingSystem
		const calendar = raw.calendar ?? this.calendar
		const timeZone = raw.timeZone ?? this.timeZone
		validateNumberingSystem(numberingSystem)
		validateCalendar(calendar)
		this.validateTimeZone(timeZone, locale)
		return { locale, numberingSystem, calendar, timeZone, options: merged }
	}

	private resolveCaptureCall<K extends CaptureFormatKind>(
		kind: K,
		options: FormatCallOptions<K> | undefined,
	): ResolvedCaptureCall<K> {
		const merged = mergeOptions(this.config[kind] as FormatOptionsByKind[K], options)
		const raw = merged as FormatCallOptions<K> & {
			locale?: string
			numberingSystem?: string
			timeZone?: string
			calendar?: string
		}
		const locale = resolveConfiguredLocale(
			raw.locale ?? this.locale,
			this.config.unsupportedLocale,
			this.config.fallbackLocale,
		)
		const numberingSystem = raw.numberingSystem ?? this.numberingSystem
		validateNumberingSystem(numberingSystem)
		const { locale: _locale, numberingSystem: _numberingSystem, timeZone: _timeZone, calendar: _calendar, ...intl } = raw
		if (kind === 'coordinate' || kind === 'bbox') {
			validateIntlOptions('number', locale, numberingSystem, intl as Record<string, unknown>)
			return { locale, numberingSystem, options: merged }
		}
		const calendar = raw.calendar ?? this.calendar
		const timeZone = raw.timeZone ?? this.timeZone
		validateCalendar(calendar)
		this.validateTimeZone(timeZone, locale)
		validateTemporalIntlOptions('date', locale, numberingSystem, calendar, timeZone, intl as Record<string, unknown>)
		return { locale, numberingSystem, calendar, timeZone, options: merged }
	}

	private validateTimeZone(timeZone: string, locale: string): void {
		const key = this.cacheKey(locale, undefined, { timeZone })
		if (this.timeZoneCache.get(key) !== undefined) return
		try {
			const validator = new Intl.DateTimeFormat(locale, { timeZone })
			this.timeZoneCache.set(key, validator)
		} catch (error) {
			throw new FormatConfigurationError(`Unsupported timezone ${JSON.stringify(timeZone)}.`, { cause: error })
		}
	}

	private stripTemporalOptions<K extends TemporalFormatKind>(options: FormatCallOptions<K>): Record<string, unknown> {
		const { locale: _locale, numberingSystem: _numberingSystem, timeZone: _timeZone, calendar: _calendar, ...intl } = options as FormatCallOptions<K> & Record<string, unknown>
		return intl
	}

	private cacheKey(locale: string, numberingSystem: string | undefined, options: Record<string, unknown>): string {
		return stableSerialize({ locale, numberingSystem, options })
	}

	private getNumberFormat(
		cache: BoundedCache<Intl.NumberFormat>,
		locale: string,
		numberingSystem: string | undefined,
		options: Record<string, unknown>,
	): Intl.NumberFormat {
		const key = this.cacheKey(locale, numberingSystem, options)
		const existing = cache.get(key)
		if (existing !== undefined) return existing

		const formatter = new Intl.NumberFormat(locale, {
			...asIntlOptions(options),
			...(numberingSystem === undefined ? {} : { numberingSystem }),
		})
		cache.set(key, formatter)
		return formatter
	}

	private getDateTimeFormat(
		cache: BoundedCache<Intl.DateTimeFormat>,
		locale: string,
		numberingSystem: string | undefined,
		calendar: string,
		timeZone: string,
		options: Intl.DateTimeFormatOptions,
	): Intl.DateTimeFormat {
		const key = this.cacheKey(locale, numberingSystem, { calendar, timeZone, ...options })
		const existing = cache.get(key)
		if (existing !== undefined) return existing
		const formatter = new Intl.DateTimeFormat(locale, {
			...options,
			calendar,
			timeZone,
			...(numberingSystem === undefined ? {} : { numberingSystem }),
		})
		cache.set(key, formatter)
		return formatter
	}

	private getDurationNumberFormat(
		locale: string,
		numberingSystem: string | undefined,
		options: FormatOptionsByKind['duration'],
	): Intl.NumberFormat {
		const key = this.cacheKey(locale, numberingSystem, options)
		const existing = this.durationCache.get(key)
		if (existing !== undefined) return existing
		const formatter = new Intl.NumberFormat(locale, {
			...options,
			...(numberingSystem === undefined ? {} : { numberingSystem }),
		})
		this.durationCache.set(key, formatter)
		return formatter
	}

	private getDurationPluralRules(locale: string, options: object): Intl.PluralRules {
		const key = this.cacheKey(locale, undefined, options as Record<string, unknown>)
		const existing = this.durationPluralCache.get(key)
		if (existing !== undefined) return existing
		const pluralRules = new Intl.PluralRules(locale, options as Intl.PluralRulesOptions)
		this.durationPluralCache.set(key, pluralRules)
		return pluralRules
	}

	private getDurationListFormat(locale: string): Intl.ListFormat {
		const key = this.cacheKey(locale, undefined, { style: 'long', type: 'unit' })
		const existing = this.durationListCache.get(key)
		if (existing !== undefined) return existing
		const listFormat = new Intl.ListFormat(locale, { style: 'long', type: 'unit' })
		this.durationListCache.set(key, listFormat)
		return listFormat
	}

	private formatPlainNumber(value: number, options: FormatCallOptions<'number'>): string {
		const resolved = this.resolveCall('number', options)
		const { intl } = stripLocaleOptions(resolved.options)
		try {
			return this.getNumberFormat(this.numberCache, resolved.locale, resolved.numberingSystem, intl).format(value)
		} catch (error) {
			throw optionError('number', error)
		}
	}

	private formatMoneyValue(value: { amount: number; currency: string }, options: FormatCallOptions<'money'>): string {
		const resolved = this.resolveCall('money', options)
		const { intl } = stripLocaleOptions(resolved.options)
		const intlOptions = buildMoneyIntlOptions(intl, value.currency)
		try {
			return this.getNumberFormat(this.moneyCache, resolved.locale, resolved.numberingSystem, intlOptions).format(
			value.amount,
			)
		} catch (error) {
			throw optionError('money', error)
		}
	}

	private formatPercentageValue(value: number, options: FormatCallOptions<'percentage'>): string {
		const resolved = this.resolveCall('percentage', options)
		const { intl } = stripLocaleOptions(resolved.options)
		try {
			const percentageOptions = buildPercentageIntlOptions(intl)
			const formatter = this.getNumberFormat(this.percentageCache, resolved.locale, resolved.numberingSystem, {
				...percentageOptions,
			})
			return formatter.format(value / 100)
		} catch (error) {
			throw optionError('percentage', error)
		}
	}

	private formatDateValue(value: TemporalValueByKind['date'], options: FormatCallOptions<'date'>): string {
		const validation = validateDate(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'date', validation.issues)
		const resolved = this.resolveTemporalCall('date', options)
		const intlOptions = dateTimeDefaults('date', this.stripTemporalOptions(resolved.options) as never)
		const timeZone = validation.value.mode === 'instant' ? resolved.timeZone : 'UTC'
		try {
			return this.getDateTimeFormat(this.dateCache, resolved.locale, resolved.numberingSystem, resolved.calendar, timeZone, intlOptions).format(validation.value.date)
		} catch (error) {
			throw temporalOptionError('date', error)
		}
	}

	private formatDatetimeValue(value: TemporalValueByKind['datetime'], options: FormatCallOptions<'datetime'>): string {
		const validation = validateDatetime(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'datetime', validation.issues)
		const resolved = this.resolveTemporalCall('datetime', options)
		const intlOptions = dateTimeDefaults('datetime', this.stripTemporalOptions(resolved.options) as never)
		const timeZone = validation.value.mode === 'instant' ? resolved.timeZone : 'UTC'
		try {
			return this.getDateTimeFormat(this.datetimeCache, resolved.locale, resolved.numberingSystem, resolved.calendar, timeZone, intlOptions).format(validation.value.date)
		} catch (error) {
			throw temporalOptionError('datetime', error)
		}
	}

	private formatTimeValue(value: TemporalValueByKind['time'], options: FormatCallOptions<'time'>): string {
		const validation = validateTime(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'time', validation.issues)
		const resolved = this.resolveTemporalCall('time', options)
		const intlOptions = dateTimeDefaults('time', this.stripTemporalOptions(resolved.options) as never)
		try {
			return this.getDateTimeFormat(this.timeCache, resolved.locale, resolved.numberingSystem, resolved.calendar, 'UTC', intlOptions).format(validation.value.date)
		} catch (error) {
			throw temporalOptionError('time', error)
		}
	}

	private formatDurationValue(value: TemporalValueByKind['duration'], options: FormatCallOptions<'duration'>): string {
		const validation = validateDuration(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'duration', validation.issues)
		const resolved = this.resolveTemporalCall('duration', options)
		try {
			return formatDurationValue(
				validation.value,
				resolved.locale,
				resolved.numberingSystem,
				this.stripTemporalOptions(resolved.options) as FormatOptionsByKind['duration'],
				this.messages,
				(locale, numberingSystem, durationOptions) => this.getDurationNumberFormat(locale, numberingSystem, durationOptions),
				(locale, pluralOptions) => this.getDurationPluralRules(locale, pluralOptions),
				(locale) => this.getDurationListFormat(locale),
				this.config.fallbackLocale,
			)
		} catch (error) {
			if (error instanceof MissingTemporalMessageError) {
				throw new FormatProblem('unsupported', 'duration', [issue('duration', 'missing_message', error.message, undefined, error)])
			}
			throw temporalOptionError('duration', error)
		}
	}

	private formatAddressValue(
		value: ContactValueByKind['address'],
		options: FormatCallOptions<'address'>,
		context: ContactFormatImplementationContext<'address'>,
	): string {
		const validation = validateAddress(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'address', validation.issues)
		try {
			return formatContactAddress(validation.value, options, { locale: context.locale, options })
		} catch (error) {
			if (error instanceof UnsupportedAddressLayoutError) {
				throw new FormatProblem('unsupported', 'address', [issue('address', 'unsupported_country_layout', error.message, 'country', error)])
			}
			throw error
		}
	}

	private formatPhoneValue(
		value: ContactValueByKind['phone'],
		options: FormatCallOptions<'phone'>,
		context: ContactFormatImplementationContext<'phone'>,
	): string {
		const validation = validatePhone(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'phone', validation.issues)
		try {
			return formatContactPhone(validation.value, options, { locale: context.locale, messages: this.messages })
		} catch (error) {
			if (error instanceof MissingContactMessageError) {
				throw new FormatProblem('unsupported', 'phone', [issue('phone', 'missing_message', error.message, undefined, error)])
			}
			throw error
		}
	}

	private formatPersonValue(value: ContactValueByKind['person']): string {
		const validation = validatePerson(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'person', validation.issues)
		return formatContactPerson(validation.value)
	}

	private formatOrganizationValue(
		value: ContactValueByKind['organization'],
		context: ContactFormatImplementationContext<'organization'>,
	): string {
		const validation = validateOrganization(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'organization', validation.issues)
		try {
			return formatContactOrganization(validation.value, { locale: context.locale, messages: this.messages })
		} catch (error) {
			if (error instanceof MissingContactMessageError) {
				throw new FormatProblem('unsupported', 'organization', [issue('organization', 'missing_message', error.message, undefined, error)])
			}
			throw error
		}
	}

	private formatPartyValue(
		value: ContactValueByKind['party'],
		options: FormatCallOptions<'party'>,
		context: ContactFormatImplementationContext<'party'>,
	): string {
		const validation = validateParty(value, options)
		if (!validation.ok) throw new FormatProblem(validation.status, 'party', validation.issues)
		const childOptions = { locale: context.locale } as FormatCallOptions<'person'> & FormatCallOptions<'organization'>
		const identity = inferPartyIdentity(validation.value, options)
		if (identity === 'person') {
			return this.invokeContact(
				this.contactChains.person as ContactChainEntry<'person'>,
				'person',
				validation.value as ContactValueByKind['person'],
				childOptions as FormatCallOptions<'person'>,
				context.locale,
			)
		}
		if (identity !== 'organization') {
			throw new FormatProblem('invalid', 'party', [issue('party', 'ambiguous_identity', 'Party identity is ambiguous; supply a person or organization member or partyType option.')])
		}
		return this.invokeContact(
			this.contactChains.organization as ContactChainEntry<'organization'>,
			'organization',
			validation.value as ContactValueByKind['organization'],
			childOptions as FormatCallOptions<'organization'>,
			context.locale,
		)
	}

	private captureFormattingContext(locale: string): CaptureFormattingContext {
		return {
			locale,
			messages: this.messages,
			fallbackLocale: this.config.fallbackLocale,
			formatNumber: (value, options) => {
				const resolved = this.resolveCall('number', { ...options, locale } as FormatCallOptions<'number'>)
				const output = this.invoke(this.chains.number, 'number', value, resolved.options, resolved.locale)
				if (typeof output !== 'string') throw new Error('A nested number formatter implementation must return a string.')
				return output
			},
			formatCoordinate: (value, options) => {
				const resolved = this.resolveCaptureCall('coordinate', { ...options, locale } as FormatCallOptions<'coordinate'>)
				const output = this.invokeCapture(this.captureChains.coordinate, 'coordinate', value, resolved.options, resolved.locale)
				if (typeof output !== 'string') throw new Error('A nested coordinate formatter implementation must return a string.')
				return output
			},
			formatDate: (value, options) => {
				const resolved = this.resolveTemporalCall('date', { ...options, locale } as FormatCallOptions<'date'>)
				const output = this.invokeTemporal(this.temporalChains.date, 'date', value, resolved.options, resolved.locale)
				if (typeof output !== 'string') throw new Error('A nested date formatter implementation must return a string.')
				return output
			},
		}
	}

	private formatCoordinateValue(
		value: CaptureValueByKind['coordinate'],
		options: FormatCallOptions<'coordinate'>,
		context: CaptureFormatImplementationContext<'coordinate'>,
	): string {
		const validation = validateCoordinate(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'coordinate', validation.issues)
		return formatCoordinateValue(validation.value, options, this.captureFormattingContext(context.locale))
	}

	private formatBboxValue(
		value: CaptureValueByKind['bbox'],
		options: FormatCallOptions<'bbox'>,
		context: CaptureFormatImplementationContext<'bbox'>,
	): string {
		const validation = validateBbox(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'bbox', validation.issues)
		return formatBboxValue(validation.value, options, this.captureFormattingContext(context.locale))
	}

	private formatIdentificationValue(
		value: CaptureValueByKind['identification'],
		options: FormatCallOptions<'identification'>,
		context: CaptureFormatImplementationContext<'identification'>,
	): string {
		const validation = validateIdentification(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'identification', validation.issues)
		try {
			return formatIdentificationValue(validation.value, options, this.captureFormattingContext(context.locale))
		} catch (error) {
			if (error instanceof MissingCaptureMessageError) {
				throw new FormatProblem('unsupported', 'identification', [issue('identification', 'missing_message', error.message, undefined, error)])
			}
			throw error
		}
	}

	private formatAttachmentValue(
		value: CaptureValueByKind['attachment'],
		options: FormatCallOptions<'attachment'>,
		context: CaptureFormatImplementationContext<'attachment'>,
	): string {
		const validation = validateAttachment(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'attachment', validation.issues)
		return formatAttachmentValue(validation.value, options, this.captureFormattingContext(context.locale))
	}

	private formatSignatureValue(
		value: CaptureValueByKind['signature'],
		options: FormatCallOptions<'signature'>,
		context: CaptureFormatImplementationContext<'signature'>,
	): string {
		const validation = validateSignature(value)
		if (!validation.ok) throw new FormatProblem(validation.status, 'signature', validation.issues)
		try {
			return formatSignatureValue(validation.value, options, this.captureFormattingContext(context.locale))
		} catch (error) {
			if (error instanceof MissingCaptureMessageError) {
				throw new FormatProblem('unsupported', 'signature', [issue('signature', 'missing_message', error.message, undefined, error)])
			}
			throw error
		}
	}

	private invoke<K extends NumericFormatKind>(
		entry: ChainEntry<K>,
		kind: K,
		value: NumericValueByKind[K],
		options: FormatCallOptions<K>,
		locale: string,
	): string {
		const validation = validateNumericValue(kind, value)
		if (!validation.ok) throw new FormatProblem(validation.status, kind, validation.issues)
		const validatedValue = validation.value
		const delegate = (nextValue = validatedValue, nextOptions = options): string => {
			const delegatedOptions = Object.freeze({ ...options, ...nextOptions }) as FormatCallOptions<K>
			const resolved = this.resolveCall(kind, delegatedOptions)
			const delegatedValidation = validateNumericValue(kind, nextValue)
			if (!delegatedValidation.ok) {
				throw new FormatProblem(delegatedValidation.status, kind, delegatedValidation.issues)
			}
			const delegatedValue = delegatedValidation.value
			if (entry.previous === undefined) {
				return this.baseImplementations[kind](delegatedValue, resolved.options, {
					kind,
					locale: resolved.locale,
					options: resolved.options,
					delegate: () => {
						throw new FormatError('error', kind, [issue(kind, 'invalid_delegate', 'Formatter delegation has no previous implementation.')])
					},
				})
			}
			return this.invoke(entry.previous, kind, delegatedValue, resolved.options, resolved.locale)
		}
		const context: FormatImplementationContext<K> = { kind, locale, options, delegate }
		return entry.implementation(validatedValue, options, context)
	}

	private validateContactValue<K extends ContactFormatKind>(
		kind: K,
		value: unknown,
		options: FormatCallOptions<K>,
	): ContactValidation<ContactValueByKind[K]> {
		if (kind === 'address') return validateAddress(value) as ContactValidation<ContactValueByKind[K]>
		if (kind === 'phone') return validatePhone(value) as ContactValidation<ContactValueByKind[K]>
		if (kind === 'person') return validatePerson(value) as ContactValidation<ContactValueByKind[K]>
		if (kind === 'organization') return validateOrganization(value) as ContactValidation<ContactValueByKind[K]>
		return validateParty(value, options as FormatCallOptions<'party'>) as ContactValidation<ContactValueByKind[K]>
	}

	private invokeContact<K extends ContactFormatKind>(
		entry: ContactChainEntry<K>,
		kind: K,
		value: ContactValueByKind[K],
		options: FormatCallOptions<K>,
		locale: string,
	): string {
		const validation = this.validateContactValue(kind, value, options)
		if (!validation.ok) throw new FormatProblem(validation.status, kind, validation.issues)
		const validatedValue = validation.value
		const delegate = (nextValue = validatedValue, nextOptions = options): string => {
			const delegatedOptions = Object.freeze({ ...options, ...nextOptions }) as FormatCallOptions<K>
			const resolved = this.resolveContactCall(kind, delegatedOptions)
			const delegatedValidation = this.validateContactValue(kind, nextValue, delegatedOptions)
			if (!delegatedValidation.ok) {
				throw new FormatProblem(delegatedValidation.status, kind, delegatedValidation.issues)
			}
			if (entry.previous === undefined) {
				return this.baseContactImplementations[kind](delegatedValidation.value, resolved.options, {
					kind,
					locale: resolved.locale,
					options: resolved.options,
					delegate: () => {
						throw new FormatError('error', kind, [issue(kind, 'invalid_delegate', 'Formatter delegation has no previous implementation.')])
					},
				} as ContactFormatImplementationContext<K>)
			}
			return this.invokeContact(entry.previous, kind, delegatedValidation.value, resolved.options, resolved.locale)
		}
		const context: ContactFormatImplementationContext<K> = { kind, locale, options, delegate }
		return entry.implementation(validatedValue, options, context)
	}

	private validateTemporalValue<K extends TemporalFormatKind>(
		kind: K,
		value: unknown,
	): TemporalValidation<TemporalValueByKind[K]> {
		const validation = kind === 'date'
			? validateDate(value)
			: kind === 'datetime'
				? validateDatetime(value)
				: kind === 'time'
					? validateTime(value)
					: validateDuration(value)
		if (!validation.ok) return validation
		return { ok: true, value: value as TemporalValueByKind[K] }
	}

	private invokeTemporal<K extends TemporalFormatKind>(
		entry: TemporalChainEntry<K>,
		kind: K,
		value: TemporalValueByKind[K],
		options: FormatCallOptions<K>,
		locale: string,
	): string {
		const validation = this.validateTemporalValue(kind, value)
		if (!validation.ok) throw new FormatProblem(validation.status, kind, validation.issues)
		const validatedValue = validation.value
		const delegate = (nextValue = validatedValue, nextOptions = options): string => {
			const delegatedOptions = Object.freeze({ ...options, ...nextOptions }) as FormatCallOptions<K>
			const resolved = this.resolveTemporalCall(kind, delegatedOptions)
			const delegatedValidation = this.validateTemporalValue(kind, nextValue)
			if (!delegatedValidation.ok) throw new FormatProblem(delegatedValidation.status, kind, delegatedValidation.issues)
			if (entry.previous === undefined) {
				return this.baseTemporalImplementations[kind](delegatedValidation.value, resolved.options, {
					kind,
					locale: resolved.locale,
					options: resolved.options,
					delegate: () => {
						throw new FormatError('error', kind, [issue(kind, 'invalid_delegate', 'Formatter delegation has no previous implementation.')])
					},
				} as TemporalFormatImplementationContext<K>)
			}
			return this.invokeTemporal(entry.previous, kind, delegatedValidation.value, resolved.options, resolved.locale)
		}
		const context: TemporalFormatImplementationContext<K> = { kind, locale, options, delegate }
		return entry.implementation(validatedValue, options, context)
	}

	private validateCaptureValue<K extends CaptureFormatKind>(
		kind: K,
		value: unknown,
	): CaptureValidation<CaptureValueByKind[K]> {
		if (kind === 'coordinate') return validateCoordinate(value) as CaptureValidation<CaptureValueByKind[K]>
		if (kind === 'bbox') return validateBbox(value) as CaptureValidation<CaptureValueByKind[K]>
		if (kind === 'identification') return validateIdentification(value) as CaptureValidation<CaptureValueByKind[K]>
		if (kind === 'attachment') return validateAttachment(value) as CaptureValidation<CaptureValueByKind[K]>
		return validateSignature(value) as CaptureValidation<CaptureValueByKind[K]>
	}

	private invokeCapture<K extends CaptureFormatKind>(
		entry: CaptureChainEntry<K>,
		kind: K,
		value: CaptureValueByKind[K],
		options: FormatCallOptions<K>,
		locale: string,
	): string {
		const validation = this.validateCaptureValue(kind, value)
		if (!validation.ok) throw new FormatProblem(validation.status, kind, validation.issues)
		const validatedValue = validation.value
		const delegate = (nextValue = validatedValue, nextOptions = options): string => {
			const delegatedOptions = Object.freeze({ ...options, ...nextOptions }) as FormatCallOptions<K>
			const resolved = this.resolveCaptureCall(kind, delegatedOptions)
			const delegatedValidation = this.validateCaptureValue(kind, nextValue)
			if (!delegatedValidation.ok) throw new FormatProblem(delegatedValidation.status, kind, delegatedValidation.issues)
			if (entry.previous === undefined) {
				return this.baseCaptureImplementations[kind](delegatedValidation.value, resolved.options, {
					kind,
					locale: resolved.locale,
					options: resolved.options,
					delegate: () => {
						throw new FormatError('error', kind, [issue(kind, 'invalid_delegate', 'Formatter delegation has no previous implementation.')])
					},
				} as CaptureFormatImplementationContext<K>)
			}
			return this.invokeCapture(entry.previous, kind, delegatedValidation.value, resolved.options, resolved.locale)
		}
		const context: CaptureFormatImplementationContext<K> = { kind, locale, options, delegate }
		return entry.implementation(validatedValue, options, context)
	}

	private evaluate(kind: FormatKind | string, value: unknown, options: unknown): FormatResult {
		if (!FORMAT_KINDS.includes(kind as FormatKind)) {
			return failed('unsupported', [issue(kind, 'unknown_kind', `Unknown format kind ${JSON.stringify(kind)}.`)])
		}
		if (!isNumericKind(kind) && !isContactKind(kind) && !isTemporalKind(kind) && !isCaptureKind(kind)) {
			return failed('unsupported', [issue(kind, 'unsupported_kind', `Formatting ${kind} values is not implemented in this formatter.`)])
		}

		try {
			if (isContactKind(kind)) {
				const typedOptions = options === undefined ? undefined : options as FormatCallOptions<typeof kind>
				const resolved = this.resolveContactCall(kind, typedOptions)
				const output = this.invokeContact(
					this.contactChains[kind] as ContactChainEntry<typeof kind>,
					kind,
					value as ContactValueByKind[typeof kind],
					resolved.options,
					resolved.locale,
				)
				if (typeof output !== 'string') {
					return failed('error', [issue(kind, 'implementation_output', 'A formatter implementation must return a string.')])
				}
				return formatted(output)
			}
			if (isTemporalKind(kind)) {
				const typedOptions = options === undefined ? undefined : options as FormatCallOptions<typeof kind>
				const resolved = this.resolveTemporalCall(kind, typedOptions)
				const output = this.invokeTemporal(
					this.temporalChains[kind] as TemporalChainEntry<typeof kind>,
					kind,
					value as TemporalValueByKind[typeof kind],
					resolved.options,
					resolved.locale,
				)
				if (typeof output !== 'string') {
					return failed('error', [issue(kind, 'implementation_output', 'A formatter implementation must return a string.')])
				}
				return formatted(output)
			}
			if (isCaptureKind(kind)) {
				const typedOptions = options === undefined ? undefined : options as FormatCallOptions<typeof kind>
				const resolved = this.resolveCaptureCall(kind, typedOptions)
				const output = this.invokeCapture(
					this.captureChains[kind] as CaptureChainEntry<typeof kind>,
					kind,
					value as CaptureValueByKind[typeof kind],
					resolved.options,
					resolved.locale,
				)
				if (typeof output !== 'string') {
					return failed('error', [issue(kind, 'implementation_output', 'A formatter implementation must return a string.')])
				}
				return formatted(output)
			}
			const typedOptions = options === undefined ? undefined : options as FormatCallOptions<typeof kind>
			const resolved = this.resolveCall(kind, typedOptions)
			const validation = kind === 'number'
				? validateNumber(value)
				: kind === 'percentage'
					? validatePercentage(value)
					: validateMoney(value)
			if (!validation.ok) return failed(validation.status, validation.issues)

			const output = this.invoke(
				this.chains[kind] as ChainEntry<typeof kind>,
				kind,
				validation.value as NumericValueByKind[typeof kind],
				resolved.options,
				resolved.locale,
			)
			if (typeof output !== 'string') {
				return failed('error', [issue(kind, 'implementation_output', 'A formatter implementation must return a string.')])
			}
			return formatted(output)
		} catch (error) {
			if (error instanceof FormatProblem) return failed(error.status, error.issues)
			if (error instanceof FormatConfigurationError) {
				return failed('unsupported', [issue(kind, 'unsupported_configuration', error.message, undefined, error)])
			}
			return failed('error', [issue(kind, 'implementation_error', error instanceof Error ? error.message : 'Unexpected formatter failure.', undefined, error)])
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

	compose(options: FormatterOptions = {}): Formatter {
		const { overrides: _overrides, ...withoutOverrides } = options
		const merged = mergeConfig(this.config, withoutOverrides)
		const next = new FormatterImpl(merged, this.numericLayers, this.contactLayers, this.temporalLayers, this.captureLayers)
		if (options.overrides !== undefined) return next.withOverrides(options.overrides)
		return next
	}

	withOverrides(overrides: FormatterOverrides): Formatter {
		const additions: { kind: NumericFormatKind; implementation: FormatImplementation<NumericFormatKind> }[] = []
		for (const kind of NUMERIC_KINDS) {
			const implementation = overrides[kind] as FormatImplementation<NumericFormatKind> | undefined
			if (implementation !== undefined) additions.push({ kind, implementation })
		}
		const contactAdditions: { kind: ContactFormatKind; implementation: ContactFormatImplementation<ContactFormatKind> }[] = []
		for (const kind of CONTACT_KINDS) {
			const implementation = overrides[kind] as ContactFormatImplementation<ContactFormatKind> | undefined
			if (implementation !== undefined) contactAdditions.push({ kind, implementation })
		}
		const temporalAdditions: { kind: TemporalFormatKind; implementation: TemporalFormatImplementation<TemporalFormatKind> }[] = []
		for (const kind of TEMPORAL_KINDS) {
			const implementation = overrides[kind] as TemporalFormatImplementation<TemporalFormatKind> | undefined
			if (implementation !== undefined) temporalAdditions.push({ kind, implementation })
		}
		const captureAdditions: { kind: CaptureFormatKind; implementation: CaptureFormatImplementation<CaptureFormatKind> }[] = []
		for (const kind of CAPTURE_KINDS) {
			const implementation = overrides[kind] as CaptureFormatImplementation<CaptureFormatKind> | undefined
			if (implementation !== undefined) captureAdditions.push({ kind, implementation })
		}
		const next = new FormatterImpl(
			this.config,
			[...this.numericLayers, ...additions],
			[...this.contactLayers, ...contactAdditions],
			[...this.temporalLayers, ...temporalAdditions],
			[...this.captureLayers, ...captureAdditions],
		)
		return next
	}

	cacheStats(): FormatterCacheStats {
		return {
			number: this.numberCache.snapshot(),
			money: this.moneyCache.snapshot(),
			percentage: this.percentageCache.snapshot(),
		}
	}
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
