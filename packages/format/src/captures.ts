import type { Attachment, Bbox, Coordinate, Identification, Signature } from '@paradoc/types'

import { resolveMessage, type MessageContext } from './messages'
import { isMissing, isRecord, issue, statusForIssues, type Validation } from './shared'
import { validateDate, validateDatetime } from './temporal'
import type {
	BboxFormatOptions,
	CoordinateFormatOptions,
	DateFormatOptions,
	FormatIssue,
	FormatterMessages,
	IdentificationFormatOptions,
	NumberFormatOptions,
	SignatureFormatOptions,
} from './types'

/**
 * What a capture formatter needs from the formatter that owns it. Each nested
 * call formats with the options it is given and never inherits the nested
 * kind's formatter-level options.
 */
export interface CaptureFormattingContext extends MessageContext {
	readonly formatNumber: (value: number, options: NumberFormatOptions) => string
	readonly formatCoordinate: (value: Coordinate, options: CoordinateFormatOptions) => string
	readonly formatDate: (value: string, options: DateFormatOptions) => string
}

export const BUILT_IN_CAPTURE_MESSAGES: FormatterMessages = {
	'en-US': {
		'identification.issueDate': 'issued {value}',
		'identification.expiryDate': 'expires {value}',
		'signature.type.signature': 'Signature',
		'signature.type.initials': 'Initials',
		'signature.method.drawn': 'drawn',
		'signature.method.typed': 'typed',
		'signature.method.uploaded': 'uploaded',
		'signature.method.certificate': 'certificate',
		'signature.on': 'on',
	},
	'en-GB': {
		'identification.issueDate': 'issued {value}',
		'identification.expiryDate': 'expires {value}',
		'signature.type.signature': 'Signature',
		'signature.type.initials': 'Initials',
		'signature.method.drawn': 'drawn',
		'signature.method.typed': 'typed',
		'signature.method.uploaded': 'uploaded',
		'signature.method.certificate': 'certificate',
		'signature.on': 'on',
	},
	'de-DE': {
		'identification.issueDate': 'ausgestellt {value}',
		'identification.expiryDate': 'gültig bis {value}',
		'signature.type.signature': 'Unterschrift',
		'signature.type.initials': 'Initialen',
		'signature.method.drawn': 'gezeichnet',
		'signature.method.typed': 'getippt',
		'signature.method.uploaded': 'hochgeladen',
		'signature.method.certificate': 'Zertifikat',
		'signature.on': 'am',
	},
	'fr-FR': {
		'identification.issueDate': 'délivré le {value}',
		'identification.expiryDate': 'expire le {value}',
		'signature.type.signature': 'Signature',
		'signature.type.initials': 'Initiales',
		'signature.method.drawn': 'dessinée',
		'signature.method.typed': 'saisie',
		'signature.method.uploaded': 'téléversée',
		'signature.method.certificate': 'certificat',
		'signature.on': 'le',
	},
	'ar-SA': {
		'identification.issueDate': 'صدر في {value}',
		'identification.expiryDate': 'ينتهي في {value}',
		'signature.type.signature': 'توقيع',
		'signature.type.initials': 'الأحرف الأولى',
		'signature.method.drawn': 'مرسوم',
		'signature.method.typed': 'مكتوب',
		'signature.method.uploaded': 'مرفوع',
		'signature.method.certificate': 'شهادة',
		'signature.on': 'في',
	},
}

function stringMember(
	kind: string,
	object: Record<string, unknown>,
	key: string,
	issues: FormatIssue[],
	options: { required?: boolean; maxLength: number },
): string | undefined {
	const value = object[key]
	if (isMissing(value)) {
		if (options.required) issues.push(issue(kind, 'missing_member', `${key} is required.`, key))
		return undefined
	}
	if (typeof value !== 'string' || value.trim().length === 0 || value.length > options.maxLength) {
		issues.push(issue(kind, 'invalid_member', `${key} must be a non-empty string of at most ${options.maxLength} characters.`, key))
		return undefined
	}
	return value
}

function numberMember(
	kind: string,
	object: Record<string, unknown>,
	key: string,
	issues: FormatIssue[],
	minimum: number,
	maximum: number,
): number | undefined {
	const value = object[key]
	if (isMissing(value)) {
		issues.push(issue(kind, 'missing_member', `${key} is required.`, key))
		return undefined
	}
	if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
		issues.push(issue(kind, 'invalid_member', `${key} must be a finite number between ${minimum} and ${maximum}.`, key))
		return undefined
	}
	return value
}

export function validateCoordinate(value: unknown): Validation<Coordinate> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('coordinate', 'missing_value', 'Coordinate value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('coordinate', 'invalid_object', 'Coordinate value must be an object.')] }
	}
	const issues: FormatIssue[] = []
	const lat = numberMember('coordinate', value, 'lat', issues, -90, 90)
	const lon = numberMember('coordinate', value, 'lon', issues, -180, 180)
	if (issues.length > 0) return { ok: false, status: statusForIssues(issues), issues }
	return { ok: true, value: { lat: lat as number, lon: lon as number } }
}

function prefixIssues(prefix: string, issues: readonly FormatIssue[], kind: string): FormatIssue[] {
	return issues.map((item) => ({
		...item,
		kind,
		path: item.path === undefined ? prefix : `${prefix}.${item.path}`,
	}))
}

export function validateBbox(value: unknown): Validation<Bbox> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('bbox', 'missing_value', 'Bbox value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('bbox', 'invalid_object', 'Bbox value must be an object.')] }
	}

	const issues: FormatIssue[] = []
	let southWest: Coordinate | undefined
	let northEast: Coordinate | undefined
	if (isMissing(value.southWest)) {
		issues.push(issue('bbox', 'missing_member', 'southWest is required.', 'southWest'))
	} else {
		const validation = validateCoordinate(value.southWest)
		if (validation.ok) southWest = validation.value
		else issues.push(...prefixIssues('southWest', validation.issues, 'bbox'))
	}
	if (isMissing(value.northEast)) {
		issues.push(issue('bbox', 'missing_member', 'northEast is required.', 'northEast'))
	} else {
		const validation = validateCoordinate(value.northEast)
		if (validation.ok) northEast = validation.value
		else issues.push(...prefixIssues('northEast', validation.issues, 'bbox'))
	}

	if (southWest !== undefined && northEast !== undefined) {
		if (southWest.lat >= northEast.lat) {
			issues.push(issue('bbox', 'invalid_bounds', 'southWest latitude must be less than northEast latitude.', 'southWest.lat'))
		}
		if (southWest.lon >= northEast.lon) {
			issues.push(issue('bbox', 'invalid_bounds', 'southWest longitude must be less than northEast longitude.', 'southWest.lon'))
		}
	}
	if (issues.length > 0) return { ok: false, status: statusForIssues(issues), issues }
	return { ok: true, value: { southWest: southWest as Coordinate, northEast: northEast as Coordinate } }
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SIGNATURE_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?Z$/

function validateIdentificationDate(value: unknown, key: 'issueDate' | 'expiryDate', issues: FormatIssue[]): string | undefined {
	if (isMissing(value)) return undefined
	if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value) || !validateDate(value).ok) {
		issues.push(issue('identification', 'invalid_member', `${key} must be a valid ISO calendar date.`, key))
		return undefined
	}
	return value
}

export function validateIdentification(value: unknown): Validation<Identification> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('identification', 'missing_value', 'Identification value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('identification', 'invalid_object', 'Identification value must be an object.')] }
	}
	const issues: FormatIssue[] = []
	const type = stringMember('identification', value, 'type', issues, { required: true, maxLength: 50 })
	const number = stringMember('identification', value, 'number', issues, { required: true, maxLength: 100 })
	const issuer = stringMember('identification', value, 'issuer', issues, { maxLength: 100 })
	const issueDate = validateIdentificationDate(value.issueDate, 'issueDate', issues)
	const expiryDate = validateIdentificationDate(value.expiryDate, 'expiryDate', issues)
	if (issues.length > 0) return { ok: false, status: statusForIssues(issues), issues }
	return {
		ok: true,
		value: {
			type: type as string,
			number: number as string,
			...(issuer === undefined ? {} : { issuer }),
			...(issueDate === undefined ? {} : { issueDate }),
			...(expiryDate === undefined ? {} : { expiryDate }),
		},
	}
}

export function validateAttachment(value: unknown): Validation<Attachment> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('attachment', 'missing_value', 'Attachment value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('attachment', 'invalid_object', 'Attachment value must be an object.')] }
	}
	const issues: FormatIssue[] = []
	const name = stringMember('attachment', value, 'name', issues, { required: true, maxLength: 255 })
	const mimeType = stringMember('attachment', value, 'mimeType', issues, { required: true, maxLength: 100 })
	const checksum = value.checksum
	if (!isMissing(checksum) && (typeof checksum !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(checksum))) {
		issues.push(issue('attachment', 'invalid_member', 'checksum must be a lowercase SHA-256 digest.', 'checksum'))
	}
	if (issues.length > 0) return { ok: false, status: statusForIssues(issues), issues }
	return {
		ok: true,
		value: {
			name: name as string,
			mimeType: mimeType as string,
			...(checksum === undefined ? {} : { checksum: checksum as string }),
		},
	}
}

const SIGNATURE_METHODS = ['drawn', 'typed', 'uploaded', 'certificate'] as const
const SIGNATURE_TYPES = ['signature', 'initials'] as const

export function validateSignature(value: unknown): Validation<Signature> {
	if (isMissing(value)) {
		return { ok: false, status: 'missing', issues: [issue('signature', 'missing_value', 'Signature value is missing.')] }
	}
	if (!isRecord(value)) {
		return { ok: false, status: 'invalid', issues: [issue('signature', 'invalid_object', 'Signature value must be an object.')] }
	}
	const issues: FormatIssue[] = []
	const timestampValue = value.timestamp
	let timestamp: string | undefined
	if (isMissing(timestampValue)) {
		issues.push(issue('signature', 'missing_member', 'timestamp is required.', 'timestamp'))
	} else if (typeof timestampValue !== 'string' || timestampValue.length === 0 || !SIGNATURE_TIMESTAMP_PATTERN.test(timestampValue)) {
		issues.push(issue('signature', 'invalid_member', 'timestamp must be a UTC ISO datetime string using a T separator and Z offset.', 'timestamp'))
	} else {
		const temporal = validateDatetime(timestampValue)
		if (!temporal.ok) {
			for (const item of temporal.issues) {
				issues.push({
					...item,
					kind: 'signature',
					path: `timestamp${item.path === undefined ? '' : `.${item.path}`}`,
				})
			}
		} else {
			timestamp = timestampValue
		}
	}

	const methodValue = value.method
	let method: Signature['method'] | undefined
	if (isMissing(methodValue)) {
		issues.push(issue('signature', 'missing_member', 'method is required.', 'method'))
	} else if (typeof methodValue !== 'string' || !(SIGNATURE_METHODS as readonly string[]).includes(methodValue)) {
		issues.push(issue('signature', 'invalid_member', 'method must be drawn, typed, uploaded, or certificate.', 'method'))
	} else {
		method = methodValue as Signature['method']
	}

	const typeValue = value.type
	let type: Signature['type'] = 'signature'
	if (!isMissing(typeValue)) {
		if (typeof typeValue !== 'string' || !(SIGNATURE_TYPES as readonly string[]).includes(typeValue)) {
			issues.push(issue('signature', 'invalid_member', 'type must be signature or initials.', 'type'))
		} else {
			type = typeValue as Signature['type']
		}
	}

	const image = value.image
	if (!isMissing(image) && (typeof image !== 'string' || image.length === 0)) {
		issues.push(issue('signature', 'invalid_member', 'image must be a non-empty string.', 'image'))
	}
	const metadata = value.metadata
	if (!isMissing(metadata) && !isRecord(metadata)) {
		issues.push(issue('signature', 'invalid_member', 'metadata must be an object.', 'metadata'))
	}

	if (issues.length > 0) return { ok: false, status: statusForIssues(issues), issues }
	return {
		ok: true,
		value: {
			timestamp: timestamp as string,
			method: method as Signature['method'],
			type,
			...(image === undefined ? {} : { image: image as string }),
			...(metadata === undefined ? {} : { metadata: metadata as Record<string, unknown> }),
		},
	}
}

function interpolate(message: string, value: string): string {
	return message.includes('{value}') ? message.replaceAll('{value}', value) : `${message} ${value}`
}

export function formatCoordinateValue(
	value: Coordinate,
	options: CoordinateFormatOptions,
	context: CaptureFormattingContext,
): string {
	const numberOptions = { maximumFractionDigits: 9, ...options }
	return `${context.formatNumber(value.lat, numberOptions)}; ${context.formatNumber(value.lon, numberOptions)}`
}

export function formatBboxValue(value: Bbox, options: BboxFormatOptions, context: CaptureFormattingContext): string {
	return [
		context.formatCoordinate(value.southWest, options),
		context.formatCoordinate(value.northEast, options),
	].join(' | ')
}

export function formatIdentificationValue(
	value: Identification,
	options: IdentificationFormatOptions,
	context: CaptureFormattingContext,
): string {
	const details: string[] = []
	if (value.issuer !== undefined) details.push(value.issuer)
	if (value.issueDate !== undefined) {
		const date = context.formatDate(value.issueDate, options)
		details.push(interpolate(resolveMessage(context, 'identification.issueDate'), date))
	}
	if (value.expiryDate !== undefined) {
		const date = context.formatDate(value.expiryDate, options)
		details.push(interpolate(resolveMessage(context, 'identification.expiryDate'), date))
	}
	return `${value.type}: ${value.number}${details.length === 0 ? '' : ` (${details.join(', ')})`}`
}

export function formatAttachmentValue(value: Attachment): string {
	return `${value.name} (${value.mimeType})`
}

export function formatSignatureValue(
	value: Signature,
	options: SignatureFormatOptions,
	context: CaptureFormattingContext,
): string {
	const type = resolveMessage(context, `signature.type.${value.type ?? 'signature'}`)
	const method = resolveMessage(context, `signature.method.${value.method}`)
	const on = resolveMessage(context, 'signature.on')
	const date = context.formatDate(value.timestamp, options)
	return `${type} (${method}) ${on} ${date}`
}
