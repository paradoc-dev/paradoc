import { CANONICAL_SHAPES, isCompositeType } from "@paradoc/core";

/** What value coercion needs to know about a field. */
export type CoercionTarget = {
	type?: string;
	/** A money field's declared ISO 4217 currency, if it declares one. */
	currency?: string;
};

export type CoercionOptions = {
	/**
	 * Calling code, such as `"+1"`, to put before a phone number given without
	 * one. Without it, a phone number must start with `+`.
	 */
	defaultCallingCode?: string;
};

const CALLING_CODE = /^\+[1-9]\d{0,2}$/;

/** Throws when an option could only produce wrong values. */
export function assertCoercionOptions(options: CoercionOptions): void {
	const code = options.defaultCallingCode;
	if (code !== undefined && !CALLING_CODE.test(code)) {
		throw new TypeError(`defaultCallingCode must be "+" and 1 to 3 digits, such as "+1"; got "${code}"`);
	}
}

/**
 * Coerce a value to the shape the field's schema expects, before the schema
 * validates it. A rule applies only when the input has one reading; anything
 * else is returned unchanged, so the validator rejects it with its own error.
 *
 * - number: a decimal string, with commas only as thousands groups.
 * - boolean: true/false, yes/no, y/n, 1/0 (any case).
 * - date, datetime, time: surrounding whitespace only. Core's temporal
 *   primitives decide what is valid; no other form is parsed.
 * - multiselect: a JSON array string.
 * - composite types (core's `CANONICAL_SHAPES`): a JSON object string; a
 *   string for a shape with one required string member (phone `number`,
 *   person and organization `name`); address key aliases.
 * - money: an amount with an optional ISO code (`"25"`, `"1,250.50 EUR"`).
 *   The currency is the code given or the field's declared currency, never
 *   an invented one.
 * - phone: E.164 from `+` and digits. A number with no `+` gets a calling
 *   code only from `options.defaultCallingCode`.
 */
export function coerceFieldValue(
	target: CoercionTarget | undefined,
	value: unknown,
	options: CoercionOptions = {},
): unknown {
	const type = target?.type;
	if (type === undefined || value === null || value === undefined) return value;

	if (type === "number" && typeof value === "string") {
		return parseDecimal(value) ?? value;
	}

	if (type === "boolean" && typeof value === "string") {
		const v = value.trim().toLowerCase();
		if (v === "true" || v === "yes" || v === "y" || v === "1") return true;
		if (v === "false" || v === "no" || v === "n" || v === "0") return false;
		return value;
	}

	if ((type === "date" || type === "datetime" || type === "time") && typeof value === "string") {
		return value.trim();
	}

	if (type === "multiselect" && typeof value === "string") {
		const parsed = parseJson(value, "[", "]");
		return Array.isArray(parsed) ? parsed : value;
	}

	if (!isCompositeType(type)) return value;

	let normalized: unknown = value;
	if (typeof normalized === "string") {
		const parsed = parseJson(normalized, "{", "}");
		if (isRecord(parsed)) normalized = parsed;
	}
	if (type === "money" && (typeof normalized === "string" || typeof normalized === "number")) {
		normalized = wrapMoney(normalized, target?.currency) ?? normalized;
	} else if (typeof normalized === "string") {
		const member = soleRequiredStringMember(type);
		if (member !== undefined) normalized = { [member]: normalized };
	}
	if (!isRecord(normalized)) return value;
	if (type === "address") return aliasAddressKeys(normalized);
	if (type === "phone") return normalizePhone(normalized, options);
	return normalized;
}

const DECIMAL = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

/** A decimal string as a number; commas only as thousands groups. */
function parseDecimal(raw: string): number | undefined {
	const trimmed = raw.trim();
	if (!DECIMAL.test(trimmed)) return undefined;
	const n = Number(trimmed.replace(/,/g, ""));
	return Number.isFinite(n) ? n : undefined;
}

function parseJson(raw: string, open: string, close: string): unknown {
	const trimmed = raw.trim();
	if (!trimmed.startsWith(open) || !trimmed.endsWith(close)) return undefined;
	try {
		return JSON.parse(trimmed);
	} catch {
		return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The shape's only required member, when there is exactly one and it is a string. */
function soleRequiredStringMember(type: keyof typeof CANONICAL_SHAPES): string | undefined {
	const required = CANONICAL_SHAPES[type].required;
	const [only] = required;
	return required.length === 1 && only?.jsType === "string" ? only.name : undefined;
}

const MONEY = /^(?:([A-Za-z]{3})\s+)?(\S+?)(?:\s+([A-Za-z]{3}))?$/;

/**
 * An amount, with an optional ISO code before or after it, as Money. The
 * currency is the code given, else the field's declared currency; with
 * neither, there is no Money to build.
 */
function wrapMoney(value: string | number, declared: string | undefined): Record<string, unknown> | undefined {
	if (typeof value === "number") {
		return Number.isFinite(value) && declared !== undefined ? { amount: value, currency: declared } : undefined;
	}
	const match = value.trim().match(MONEY);
	if (!match || (match[1] !== undefined && match[3] !== undefined)) return undefined;
	const amount = parseDecimal(match[2] ?? "");
	const currency = (match[1] ?? match[3])?.toUpperCase() ?? declared;
	if (amount === undefined || currency === undefined) return undefined;
	return { amount, currency };
}

/** E.164 from `+` and digits, or from the caller's default calling code. */
function normalizePhone(input: Record<string, unknown>, options: CoercionOptions): Record<string, unknown> {
	if (typeof input.number !== "string") return input;
	const trimmed = input.number.trim();
	const digits = trimmed.replace(/[\s().-]/g, "");
	let number: string | undefined;
	if (/^\+\d+$/.test(digits)) number = digits;
	else if (/^[1-9]\d*$/.test(digits) && options.defaultCallingCode !== undefined) {
		number = `${options.defaultCallingCode}${digits}`;
	}
	return number === undefined ? input : { ...input, number };
}

/**
 * Common alternate key names for the address shape's members. Aliases only
 * when the member itself is absent, so an input that already uses the
 * schema's names passes through unchanged.
 */
export const ADDRESS_ALIASES: Readonly<Record<string, string>> = {
	street: "line1",
	streetAddress: "line1",
	address1: "line1",
	street1: "line1",
	apt: "line2",
	suite: "line2",
	unit: "line2",
	address2: "line2",
	street2: "line2",
	city: "locality",
	town: "locality",
	state: "region",
	province: "region",
	zip: "postalCode",
	zipCode: "postalCode",
	zip_code: "postalCode",
	postal_code: "postalCode",
	postcode: "postalCode",
};

function aliasAddressKeys(input: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = { ...input };
	for (const [alias, member] of Object.entries(ADDRESS_ALIASES)) {
		if (alias in out && !(member in out)) {
			out[member] = out[alias];
			delete out[alias];
		}
	}
	return out;
}
