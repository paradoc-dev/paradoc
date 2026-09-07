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
	formatAddress,
	formatMoney,
	formatNumber,
	formatPercentage,
	formatOrganization,
	formatParty,
	formatPerson,
	formatPhone,
	formatValue,
	safeFormatAddress,
	safeFormatMoney,
	safeFormatNumber,
	safeFormatOrganization,
	safeFormatParty,
	safeFormatPerson,
	safeFormatPhone,
	safeFormatPercentage,
	safeFormatValue,
} from './formatter'

export { FormatConfigurationError, FormatError, isFormatError } from './errors'

export {
	FORMAT_KINDS,
	type AddressFormatOptions,
	type AddressLayoutContext,
	type AddressLayoutFormatter,
	type AddressLayoutPolicy,
	type FormatCallOptions,
	type ContactFormatImplementation,
	type ContactFormatImplementationContext,
	type ContactFormatKind,
	type ContactValueByKind,
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
	type OrganizationFormatOptions,
	type NumericFormatKind,
	type NumericValueByKind,
	type PartyFormatOptions,
	type PersonFormatOptions,
	type PhoneFormatOptions,
	type PercentageFormatOptions,
	type UnformattedResult,
	type UnsupportedLocalePolicy,
} from './types'
