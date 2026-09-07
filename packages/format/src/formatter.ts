import { BoundedCache, DEFAULT_CACHE_SIZE, MAX_CACHE_SIZE, stableSerialize } from './cache'
import { FormatConfigurationError, FormatError } from './errors'
import {
	FORMAT_KINDS,
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
} from './types'

const DEFAULT_LOCALE = 'en-US'
const DEFAULT_TIME_ZONE = 'UTC'
const DEFAULT_CALENDAR = 'gregory'
const NUMERIC_KINDS: readonly NumericFormatKind[] = ['number', 'money', 'percentage']

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

function mergeOptions<K extends NumericFormatKind>(
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

function optionError(kind: NumericFormatKind, error: unknown): FormatProblem {
	return new FormatProblem(
		'invalid',
		kind,
		[issue(kind, 'invalid_options', error instanceof Error ? error.message : 'Invalid formatting options.', undefined, error)],
	)
}

function isNumericKind(kind: FormatKind | string): kind is NumericFormatKind {
	return NUMERIC_KINDS.includes(kind as NumericFormatKind)
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
	validateIntlOptions('number', locale, options.numberingSystem, numberOptions)
	validateIntlOptions('money', locale, options.numberingSystem, moneyOptions as Record<string, unknown>)
	validateIntlOptions('percentage', locale, options.numberingSystem, percentageOptions)

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
		messages: cloneAndFreeze(options.messages ?? {}),
	}
}

/**
 * The first public formatter slice. Numeric implementations live here while
 * the same immutable/composable contract is extended by later value-family
 * tickets.
 */
class FormatterImpl implements Formatter {
	readonly locale: string
	readonly timeZone: string
	readonly calendar: string
	readonly numberingSystem?: string
	readonly messages: FormatterMessages

	private readonly config: FormatterConfig
	private readonly numberCache: BoundedCache<Intl.NumberFormat>
	private readonly moneyCache: BoundedCache<Intl.NumberFormat>
	private readonly percentageCache: BoundedCache<Intl.NumberFormat>
	private readonly baseImplementations: NumericImplementationMap
	private readonly chains: NumericChainMap
	private readonly layers: readonly { kind: NumericFormatKind; implementation: FormatImplementation<NumericFormatKind> }[]

	constructor(options: FormatterOptions = {}, layers: readonly { kind: NumericFormatKind; implementation: FormatImplementation<NumericFormatKind> }[] = []) {
		this.config = createConfig(options)
		this.locale = this.config.locale
		this.timeZone = this.config.timeZone
		this.calendar = this.config.calendar
		this.numberingSystem = this.config.numberingSystem
		this.messages = this.config.messages
		this.numberCache = new BoundedCache(this.config.cacheSize)
		this.moneyCache = new BoundedCache(this.config.cacheSize)
		this.percentageCache = new BoundedCache(this.config.cacheSize)
		this.baseImplementations = {
			number: (value, options) => this.formatPlainNumber(value, options),
			money: (value, options) => this.formatMoneyValue(value as { amount: number; currency: string }, options),
			percentage: (value, options) => this.formatPercentageValue(value, options),
		}
		const optionLayers: { kind: NumericFormatKind; implementation: FormatImplementation<NumericFormatKind> }[] = []
		for (const kind of NUMERIC_KINDS) {
			const implementation = options.overrides?.[kind] as FormatImplementation<NumericFormatKind> | undefined
			if (implementation !== undefined) optionLayers.push({ kind, implementation })
		}
		this.layers = [...layers, ...optionLayers]
		this.chains = {
			number: { implementation: this.baseImplementations.number },
			money: { implementation: this.baseImplementations.money },
			percentage: { implementation: this.baseImplementations.percentage },
		}
		for (const layer of this.layers) this.addLayer(layer.kind, layer.implementation)
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

	private resolveCall<K extends NumericFormatKind>(
		kind: K,
		options: FormatCallOptions<K> | undefined,
	): ResolvedCall<K> {
		const merged = mergeOptions(this.config[kind], options)
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

	private evaluate(kind: FormatKind | string, value: unknown, options: unknown): FormatResult {
		if (!FORMAT_KINDS.includes(kind as FormatKind)) {
			return failed('unsupported', [issue(kind, 'unknown_kind', `Unknown format kind ${JSON.stringify(kind)}.`)])
		}
		if (!isNumericKind(kind)) {
			return failed('unsupported', [issue(kind, 'unsupported_kind', `Formatting ${kind} values is not implemented in this formatter.`)])
		}

		try {
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

	safeFormatNumber(value: FormatInputByKind['number'], options?: FormatCallOptions<'number'>): FormatResult {
		return this.safeFormat('number', value, options)
	}

	safeFormatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): FormatResult {
		return this.safeFormat('money', value, options)
	}

	safeFormatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): FormatResult {
		return this.safeFormat('percentage', value, options)
	}

	compose(options: FormatterOptions = {}): Formatter {
		const { overrides: _overrides, ...withoutOverrides } = options
		const merged = mergeConfig(this.config, withoutOverrides)
		const next = new FormatterImpl(merged, this.layers)
		if (options.overrides !== undefined) return next.withOverrides(options.overrides)
		return next
	}

	withOverrides(overrides: FormatterOverrides): Formatter {
		const additions: { kind: NumericFormatKind; implementation: FormatImplementation<NumericFormatKind> }[] = []
		for (const kind of NUMERIC_KINDS) {
			const implementation = overrides[kind] as FormatImplementation<NumericFormatKind> | undefined
			if (implementation !== undefined) additions.push({ kind, implementation })
		}
		const next = new FormatterImpl(this.config, [...this.layers, ...additions])
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

export function formatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): string {
	return defaultFormatter.formatMoney(value, options)
}

export function formatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): string {
	return defaultFormatter.formatPercentage(value, options)
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

export function safeFormatMoney(value: FormatInputByKind['money'], options?: FormatCallOptions<'money'>): FormatResult {
	return defaultFormatter.safeFormatMoney(value, options)
}

export function safeFormatPercentage(value: FormatInputByKind['percentage'], options?: FormatCallOptions<'percentage'>): FormatResult {
	return defaultFormatter.safeFormatPercentage(value, options)
}
