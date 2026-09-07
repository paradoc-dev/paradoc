/**
 * @paradoc/format
 *
 * Immutable, locale-aware presentation of structured artifact values.
 *
 * This package owns display formatting only. It does not parse localized
 * input, serialize stored artifacts, convert currencies, or apply business
 * validation rules.
 */

export {
	defaultFormatter,
	createFormatter,
	formatMoney,
	formatNumber,
	formatPercentage,
	formatValue,
	safeFormatMoney,
	safeFormatNumber,
	safeFormatPercentage,
	safeFormatValue,
} from './formatter'

export { FormatConfigurationError, FormatError, isFormatError } from './errors'

export {
	FORMAT_KINDS,
	type FormatCallOptions,
	type FormatImplementation,
	type FormatImplementationContext,
	type FormatInputByKind,
	type FormatIssue,
	type FormatKind,
	type FormatOptionsByKind,
	type FormatResult,
	type FormatStatus,
	type FormattedResult,
	type Formatter,
	type FormatterCacheBucketStats,
	type FormatterCacheStats,
	type FormatterMessages,
	type FormatterOptions,
	type FormatterOverrides,
	type MoneyFormatOptions,
	type NumberFormatOptions,
	type NumericFormatKind,
	type NumericValueByKind,
	type PercentageFormatOptions,
	type UnformattedResult,
	type UnsupportedLocalePolicy,
} from './types'
