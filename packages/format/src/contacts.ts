import type { Address, Organization, Person } from '@paradoc/types'

import { resolveMessage, type MessageContext } from './messages'
import { isMissing, isRecord, issue, statusForIssues, type Validation } from './shared'
import type {
	AddressFormatOptions,
	AddressLayoutContext,
	ContactFormatKind,
	FormatIssue,
	FormatOptionsByKind,
	FormatterMessages,
	PartyFormatOptions,
	PhoneFormatOptions,
} from './types'

export interface NormalizedPhone {
	readonly number: string
	readonly type?: string
	readonly extension?: string
}

export interface NormalizedAddress extends Address {
	readonly countryCode: string | undefined
}

export class UnsupportedAddressLayoutError extends Error {
	readonly country: string

	constructor(country: string) {
		super(`No country-specific address layout is available for ${JSON.stringify(country)}.`)
		this.name = 'UnsupportedAddressLayoutError'
		this.country = country
	}
}

const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
	US: 'US',
	USA: 'US',
	'UNITED STATES': 'US',
	'UNITED STATES OF AMERICA': 'US',
	GB: 'GB',
	UK: 'GB',
	'UNITED KINGDOM': 'GB',
	'GREAT BRITAIN': 'GB',
	DE: 'DE',
	GERMANY: 'DE',
	DEUTSCHLAND: 'DE',
	FR: 'FR',
	FRANCE: 'FR',
	SA: 'SA',
	'SAUDI ARABIA': 'SA',
}

const ORG_KEYS = new Set(['legalName', 'domicile', 'entityType', 'entityId', 'taxId'])
const PERSON_KEYS = new Set(['title', 'firstName', 'middleName', 'lastName', 'suffix'])

export const BUILT_IN_CONTACT_MESSAGES: FormatterMessages = {
	'en-US': {
		'phone.extension': 'ext.',
		'organization.legalName': 'Legal name',
		'organization.entityType': 'Entity type',
		'organization.entityId': 'Entity ID',
		'organization.taxId': 'Tax ID',
		'organization.domicile': 'Domicile',
	},
	'en-GB': {
		'phone.extension': 'ext.',
		'organization.legalName': 'Legal name',
		'organization.entityType': 'Entity type',
		'organization.entityId': 'Entity ID',
		'organization.taxId': 'Tax ID',
		'organization.domicile': 'Domicile',
	},
	'de-DE': {
		'phone.extension': 'Durchwahl',
		'organization.legalName': 'Rechtlicher Name',
		'organization.entityType': 'Rechtsform',
		'organization.entityId': 'Unternehmens-ID',
		'organization.taxId': 'Steuer-ID',
		'organization.domicile': 'Sitz',
	},
	'fr-FR': {
		'phone.extension': 'poste',
		'organization.legalName': 'Nom légal',
		'organization.entityType': 'Forme juridique',
		'organization.entityId': "ID de l'entreprise",
		'organization.taxId': 'N° fiscal',
		'organization.domicile': 'Domicile',
	},
	'ar-SA': {
		'phone.extension': 'تحويلة',
		'organization.legalName': 'الاسم القانوني',
		'organization.entityType': 'نوع الكيان',
		'organization.entityId': 'معرّف الكيان',
		'organization.taxId': 'الرقم الضريبي',
		'organization.domicile': 'الموطن',
	},
}

function stringMember(
	kind: string,
	object: Record<string, unknown>,
	key: string,
	issues: FormatIssue[],
	options: { required?: boolean; minLength?: number; maxLength: number },
): string | undefined {
	const value = object[key]
	if (isMissing(value)) {
		if (options.required) issues.push(issue(kind, 'missing_member', `${key} is required.`, key))
		return undefined
	}
	const minLength = options.minLength ?? 1
	if (typeof value !== 'string' || value.trim().length < minLength || value.length > options.maxLength) {
		issues.push(issue(kind, 'invalid_member', `${key} must be a string of ${minLength} to ${options.maxLength} characters.`, key))
		return undefined
	}
	return value
}

export function normalizeCountry(value: string): string | undefined {
	const normalized = value.trim().toUpperCase()
	return COUNTRY_ALIASES[normalized] ?? (/^[A-Z]{2}$/.test(normalized) ? normalized : undefined)
}

export function validateAddress(value: unknown): Validation<NormalizedAddress> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('address', 'missing_value', 'Address value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('address', 'invalid_object', 'Address value must be an object.')] }
	}

	const issues: FormatIssue[] = []
	const line1 = stringMember('address', value, 'line1', issues, { required: true, maxLength: 200 })
	const line2 = stringMember('address', value, 'line2', issues, { maxLength: 200 })
	const locality = stringMember('address', value, 'locality', issues, { required: true, maxLength: 200 })
	const region = stringMember('address', value, 'region', issues, { required: true, maxLength: 100 })
	const postalCode = stringMember('address', value, 'postalCode', issues, { required: true, maxLength: 20 })
	const country = stringMember('address', value, 'country', issues, { required: true, minLength: 2, maxLength: 100 })

	if (postalCode !== undefined && !/^[A-Z0-9\s-]{3,20}$/.test(postalCode)) {
		issues.push(issue('address', 'invalid_member', 'postalCode must contain only uppercase letters, numbers, spaces, or hyphens.', 'postalCode'))
	}
	if (issues.length > 0) {
		return { ok: false, status: statusForIssues(issues), issues }
	}

	return {
		ok: true,
		value: {
			line1: line1 as string,
			...(line2 === undefined ? {} : { line2 }),
			locality: locality as string,
			region: region as string,
			postalCode: postalCode as string,
			country: country as string,
			countryCode: normalizeCountry(country as string),
		},
	}
}

function validatePhoneNumber(number: unknown, issues: FormatIssue[], path = 'number'): string | undefined {
	if (isMissing(number)) {
		issues.push(issue('phone', 'missing_member', 'Phone number is required.', path))
		return undefined
	}
	if (typeof number !== 'string' || !/^\+[1-9]\d{1,14}$/.test(number) || number.length < 8) {
		issues.push(issue('phone', 'invalid_member', 'Phone number must use canonical E.164 syntax with at most 15 digits.', path))
		return undefined
	}
	return number
}

export function validatePhone(value: unknown): Validation<NormalizedPhone> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('phone', 'missing_value', 'Phone value is missing.')] }
	}
	if (typeof value === 'string') {
		const issues: FormatIssue[] = []
		const number = validatePhoneNumber(value, issues, 'number')
		return issues.length > 0
			? { ok: false, status: 'invalid', issues }
			: { ok: true, value: { number: number as string } }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('phone', 'invalid_object', 'Phone value must be an E.164 string or object.')] }
	}

	const issues: FormatIssue[] = []
	const number = validatePhoneNumber(value.number, issues)
	let type: string | undefined
	if (!isMissing(value.type)) {
		if (typeof value.type !== 'string' || value.type.trim().length === 0 || value.type.length > 50) {
			issues.push(issue('phone', 'invalid_member', 'Phone type must be a non-empty string of at most 50 characters.', 'type'))
		} else {
			type = value.type
		}
	}
	let extension: string | undefined
	if (!isMissing(value.extension)) {
		if (typeof value.extension !== 'string' || value.extension.length < 1 || value.extension.length > 20) {
			issues.push(issue('phone', 'invalid_member', 'Phone extension must be a non-empty string of at most 20 characters.', 'extension'))
		} else {
			extension = value.extension
		}
	}
	if (issues.length > 0) return { ok: false, status: statusForIssues(issues), issues }
	return {
		ok: true,
		value: {
			number: number as string,
			...(type === undefined ? {} : { type }),
			...(extension === undefined ? {} : { extension }),
		},
	}
}

type PersonValue = Person | Partial<Person> | Record<string, unknown>

export function validatePerson(value: unknown): Validation<PersonValue> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('person', 'missing_value', 'Person value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('person', 'invalid_object', 'Person value must be an object.')] }
	}

	const issues: FormatIssue[] = []
	const name = stringMember('person', value, 'name', issues, { maxLength: 200 })
	const title = stringMember('person', value, 'title', issues, { maxLength: 50 })
	const firstName = stringMember('person', value, 'firstName', issues, { maxLength: 100 })
	const middleName = stringMember('person', value, 'middleName', issues, { maxLength: 100 })
	const lastName = stringMember('person', value, 'lastName', issues, { maxLength: 100 })
	const suffix = stringMember('person', value, 'suffix', issues, { maxLength: 50 })
	const hasName = name !== undefined || [title, firstName, middleName, lastName, suffix].some((part) => part !== undefined)
	if (!hasName && issues.length === 0) {
		issues.push(issue('person', 'missing_member', 'Person requires a name or at least one name component.'))
	}
	if (issues.length > 0) return { ok: false, status: statusForIssues(issues), issues }
	return { ok: true, value: value as PersonValue }
}

type OrganizationValue = Organization | Partial<Organization> | Record<string, unknown>

export function validateOrganization(value: unknown): Validation<OrganizationValue> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('organization', 'missing_value', 'Organization value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('organization', 'invalid_object', 'Organization value must be an object.')] }
	}

	const issues: FormatIssue[] = []
	const name = stringMember('organization', value, 'name', issues, { required: true, maxLength: 200 })
	const legalName = stringMember('organization', value, 'legalName', issues, { maxLength: 200 })
	const domicile = stringMember('organization', value, 'domicile', issues, { maxLength: 100 })
	const entityType = stringMember('organization', value, 'entityType', issues, { maxLength: 100 })
	const entityId = stringMember('organization', value, 'entityId', issues, { maxLength: 100 })
	const taxId = stringMember('organization', value, 'taxId', issues, { maxLength: 100 })
	if (issues.length > 0) return { ok: false, status: statusForIssues(issues), issues }
	return { ok: true, value: { name: name as string, ...(legalName === undefined ? {} : { legalName }), ...(domicile === undefined ? {} : { domicile }), ...(entityType === undefined ? {} : { entityType }), ...(entityId === undefined ? {} : { entityId }), ...(taxId === undefined ? {} : { taxId }) } }
}

export type PartyIdentity = 'person' | 'organization'

export type PartyIdentityResolution = PartyIdentity | 'ambiguous' | undefined

/** A party checked against the identity it resolves to. */
export interface ValidatedParty {
	readonly value: Record<string, unknown>
	readonly identity: PartyIdentity
}

/**
 * Infers a party's identity from the members it carries. A member whose value
 * is `null` or `undefined` is not carried: form state often keeps a cleared
 * member as `undefined`.
 */
export function inferPartyIdentity(value: Record<string, unknown>, options: PartyFormatOptions): PartyIdentityResolution {
	if (options.partyType !== undefined) return options.partyType
	const hasOrganizationIdentity = [...ORG_KEYS].some((key) => !isMissing(value[key]))
	const hasPersonIdentity = [...PERSON_KEYS].some((key) => !isMissing(value[key]))
	if (hasOrganizationIdentity && hasPersonIdentity) return 'ambiguous'
	if (hasOrganizationIdentity) return 'organization'
	if (hasPersonIdentity) return 'person'
	return undefined
}

export function validateParty(value: unknown, options: PartyFormatOptions): Validation<ValidatedParty> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('party', 'missing_value', 'Party value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('party', 'invalid_object', 'Party value must be an object.')] }
	}
	const identity = inferPartyIdentity(value, options)
	if (identity === undefined || identity === 'ambiguous') {
		return { ok: false, status: 'invalid', issues: [issue('party', 'ambiguous_identity', 'Party identity is ambiguous; supply a person or organization member or partyType option.')] }
	}
	const validation = identity === 'person' ? validatePerson(value) : validateOrganization(value)
	if (!validation.ok) {
		return {
			ok: false,
			status: validation.status,
			issues: validation.issues.map((item) => ({ ...item, kind: 'party', path: item.path === undefined ? identity : `${identity}.${item.path}` })),
		}
	}
	return { ok: true, value: { value, identity } }
}

export function formatAddress(
	address: NormalizedAddress,
	options: AddressFormatOptions,
	context: AddressLayoutContext,
): string {
	const countryCode = address.countryCode
	if (options.layout === 'generic') return genericAddress(address)
	const custom = Object.entries(options.countryLayouts ?? {}).find(([country]) => country.toUpperCase() === countryCode)?.[1]
	if (custom !== undefined) return custom(address, context)
	if (countryCode === undefined || COUNTRY_LAYOUTS[countryCode] === undefined) {
		throw new UnsupportedAddressLayoutError(address.country)
	}
	return COUNTRY_LAYOUTS[countryCode](address, context)
}

function genericAddress(address: NormalizedAddress): string {
	return [address.line1, address.line2, address.locality, address.region, address.postalCode, address.country]
		.filter((part): part is string => typeof part === 'string' && part.length > 0)
		.join(', ')
}

function countryAddress(parts: readonly (string | undefined)[]): string {
	return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(', ')
}

const COUNTRY_LAYOUTS: Readonly<Record<string, (address: NormalizedAddress, context: AddressLayoutContext) => string>> = {
	US: (address) => countryAddress([address.line1, address.line2, address.locality, `${address.region} ${address.postalCode}`, address.country]),
	GB: (address) => countryAddress([address.line1, address.line2, address.locality, address.region, address.postalCode, address.country]),
	DE: (address) => countryAddress([address.line1, address.line2, `${address.postalCode} ${address.locality}`, address.region, address.country]),
	FR: (address) => countryAddress([address.line1, address.line2, `${address.postalCode} ${address.locality}`, address.region, address.country]),
	SA: (address) => countryAddress([address.line1, address.line2, `${address.postalCode} ${address.locality}`, address.region, address.country]),
}

export function formatPhone(phone: NormalizedPhone, options: PhoneFormatOptions, context: MessageContext): string {
	if (phone.extension === undefined) return phone.number
	const label = options.extensionLabel ?? resolveMessage(context, 'phone.extension')
	return `${phone.number} ${label} ${phone.extension}`
}

export function formatPerson(person: PersonValue): string {
	const value = person as Record<string, unknown>
	if (typeof value.name === 'string' && value.name.length > 0) return value.name
	return ['title', 'firstName', 'middleName', 'lastName', 'suffix']
		.map((key) => value[key])
		.filter((part): part is string => typeof part === 'string' && part.length > 0)
		.join(' ')
}

export function formatOrganization(organization: OrganizationValue, context: MessageContext): string {
	const value = organization as Record<string, unknown>
	const details: string[] = []
	if (typeof value.legalName === 'string' && value.legalName !== value.name) details.push(`${resolveMessage(context, 'organization.legalName')}: ${value.legalName}`)
	if (typeof value.entityType === 'string') details.push(`${resolveMessage(context, 'organization.entityType')}: ${value.entityType}`)
	if (typeof value.entityId === 'string') details.push(`${resolveMessage(context, 'organization.entityId')}: ${value.entityId}`)
	if (typeof value.taxId === 'string') details.push(`${resolveMessage(context, 'organization.taxId')}: ${value.taxId}`)
	if (typeof value.domicile === 'string') details.push(`${resolveMessage(context, 'organization.domicile')}: ${value.domicile}`)
	return details.length === 0 ? String(value.name) : `${String(value.name)} (${details.join(', ')})`
}

export function validateAddressOptions(options: AddressFormatOptions): void {
	if (options.layout !== undefined && options.layout !== 'country' && options.layout !== 'generic') {
		throw new Error('Address layout must be "country" or "generic".')
	}
	if (options.countryLayouts !== undefined) {
		if (!isRecord(options.countryLayouts)) throw new Error('Address countryLayouts must be an object.')
		for (const [country, formatter] of Object.entries(options.countryLayouts)) {
			if (!/^[A-Z]{2}$/.test(country.toUpperCase()) || typeof formatter !== 'function') {
				throw new Error('Address countryLayouts keys must be ISO alpha-2 codes with function values.')
			}
		}
	}
}

export function validatePhoneOptions(options: PhoneFormatOptions): void {
	if (options.extensionLabel !== undefined && (typeof options.extensionLabel !== 'string' || options.extensionLabel.trim().length === 0)) {
		throw new Error('Phone extensionLabel must be a non-empty string.')
	}
}

export function validatePartyOptions(options: PartyFormatOptions): void {
	if (options.partyType !== undefined && options.partyType !== 'person' && options.partyType !== 'organization') {
		throw new Error('Party partyType must be "person" or "organization".')
	}
}

/** Rejects contact options a formatter cannot act on. Person and organization take none. */
export function validateContactOptions<K extends ContactFormatKind>(kind: K, options: FormatOptionsByKind[K]): void {
	if (kind === 'address') validateAddressOptions(options as AddressFormatOptions)
	if (kind === 'phone') validatePhoneOptions(options as PhoneFormatOptions)
	if (kind === 'party') validatePartyOptions(options as PartyFormatOptions)
}
