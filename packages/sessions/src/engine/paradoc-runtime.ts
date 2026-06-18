import { loadFromObject, isCompositeType } from "@paradoc/core";
import type { ArtifactRuntime, FillStateSnapshot } from "./types";

/**
 * Build an ArtifactRuntime backed by @paradoc/core.
 *
 * The artifact object is loaded once; per-call we run safePartialFill against
 * the current answers and ask the resulting DraftForm for its FillState. This
 * is the same pattern the legacy session.ts uses, just wrapped behind a tight
 * interface so the engine remains independent of core's evolving API.
 *
 * Performance: loadFromObject + safePartialFill is a few milliseconds for
 * typical artifacts; cheap enough to recompute on every command.
 */
export function createParadocRuntime(
	artifact: Record<string, unknown>,
): ArtifactRuntime {
	// Loaded once — pure design-time wrapper; doesn't capture answers.
	const instance = loadFromObject<"form">(artifact);

	const knownFieldPaths: Set<string> = collectFieldPaths(instance.fields);
	const knownPartyRoles: Set<string> = new Set(
		instance.parties ? Object.keys(instance.parties) : [],
	);
	const partyLabels: Record<string, string | undefined> = {};
	if (instance.parties) {
		for (const [roleId, partyDef] of Object.entries(
			instance.parties as Record<string, unknown>,
		)) {
			if (partyDef && typeof partyDef === "object") {
				const lbl = (partyDef as { label?: unknown }).label;
				partyLabels[roleId] = typeof lbl === "string" ? lbl : undefined;
			}
		}
	}

	function hasField(fieldPath: string): boolean {
		return knownFieldPaths.has(fieldPath);
	}

	function hasParty(roleId: string): boolean {
		return knownPartyRoles.has(roleId);
	}

	function getFillState(
		answers: Record<string, unknown>,
		parties: Record<string, unknown>,
	): FillStateSnapshot {
		const draft = instance.safePartialFill(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			answersToFormPayload(answers, parties) as any,
			{ validate: "none" },
		);
		if (!draft.success) {
			return { openRequired: [], openOptional: [], openRequiredParties: [] };
		}
		const fillState = draft.data.getFillState({ includeOptional: true });
		return {
			openRequired: fillState.openRequired
				.filter((item) => item.kind === "field")
				.map((item) => ({ fieldPath: item.key, order: item.order, status: item.status })),
			openOptional: fillState.openOptional
				.filter((item) => item.kind === "field")
				.map((item) => ({ fieldPath: item.key, order: item.order, status: item.status })),
			openRequiredParties: fillState.openRequired
				.filter((item) => item.kind === "party")
				.map((item) => ({
					roleId: item.key,
					...(partyLabels[item.key] !== undefined
						? { label: partyLabels[item.key] as string }
						: {}),
					order: item.order,
				})),
			// Canonical — no longer discarded: the full blocked + DAG-ordered candidates.
			blocked: fillState.blocked
				.filter((item) => item.kind === "field")
				.map((item) => ({ fieldPath: item.key, order: item.order, blockedBy: item.blockedBy })),
			candidates: fillState.candidates.map((c) => ({
				kind: c.kind,
				key: c.key,
				required: c.required,
				order: c.order,
			})),
		};
	}

	// Index field types once at runtime construction so validateField can
	// coerce string inputs to the canonical type the schema expects.
	const fieldTypes = new Map<string, string>();
	for (const f of listFieldsCached(instance.fields)) {
		if (f.type) fieldTypes.set(f.fieldPath, f.type);
	}

	function validateField(
		fieldPath: string,
		value: unknown,
	): ReturnType<ArtifactRuntime["validateField"]> {
		const coerced = coerceForFieldType(fieldTypes.get(fieldPath), value);
		const result = instance.validateFieldInput({ fieldPath, value: coerced });
		if (result.success) {
			// Hand back the coerced value so the engine persists it instead of
			// the user's raw string. Without this, e.g. "20" stays a string in
			// the event log even though it passes validation as a number — and
			// the next read (renderer) re-validates and fails.
			return { ok: true, value: coerced };
		}
		return {
			ok: false,
			issues: result.errors.map((e) => ({
				fieldPath: e.field,
				message: e.message,
			})),
		};
	}

	function validateParty(
		roleId: string,
		value: unknown,
	): ReturnType<ArtifactRuntime["validateParty"]> {
		const result = instance.validatePartyInput({ roleId, value });
		if (result.success) {
			// validatePartyInput returns NormalizedPartyInput; we just need the
			// runtime party object for downstream serialization.
			return { ok: true, value: result.value.party };
		}
		return {
			ok: false,
			issues: result.errors.map((e) => ({
				fieldPath: e.field,
				message: e.message,
			})),
		};
	}

	function listFields(): ReturnType<ArtifactRuntime["listFields"]> {
		const out: Array<{ fieldPath: string; required: boolean; type?: string }> = [];
		const walk = (fields: unknown, prefix: string) => {
			if (!fields || typeof fields !== "object") return;
			for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
				const path = prefix ? `${prefix}.${key}` : key;
				if (
					value &&
					typeof value === "object" &&
					"fields" in (value as Record<string, unknown>)
				) {
					walk((value as { fields: unknown }).fields, path);
				} else {
					const def = value as Record<string, unknown> | null;
					out.push({
						fieldPath: path,
						required: def?.required === true,
						type: typeof def?.type === "string" ? (def.type as string) : undefined,
					});
				}
			}
		};
		walk(instance.fields, "");
		return out;
	}

	function listParties(): ReturnType<ArtifactRuntime["listParties"]> {
		if (!instance.parties) return [];
		return Object.entries(instance.parties as Record<string, unknown>).map(
			([roleId, def]) => {
				const rec = (def as Record<string, unknown>) ?? {};
				const lbl = rec.label;
				const partyType = rec.partyType;
				return {
					roleId,
					...(typeof lbl === "string" ? { label: lbl } : {}),
					partyType:
						partyType === "person" ||
						partyType === "organization" ||
						partyType === "any"
							? (partyType as "person" | "organization" | "any")
							: "any",
				};
			},
		);
	}

	return {
		hasField,
		hasParty,
		getFillState,
		validateField,
		validateParty,
		listFields,
		listParties,
	};
}

/**
 * Walk an artifact's `fields` map and yield every leaf field path.
 *
 * Paradoc artifacts express nested fields via fieldsets; the recursive shape
 * mirrors the runtime shape. We collect dot-separated paths because that's
 * the convention used throughout @paradoc/core's APIs (validateFieldInput,
 * FillState keys, etc.).
 */
function collectFieldPaths(
	fields: unknown,
	prefix = "",
): Set<string> {
	const out = new Set<string>();
	if (!fields || typeof fields !== "object") return out;
	for (const [key, value] of Object.entries(
		fields as Record<string, unknown>,
	)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (
			value &&
			typeof value === "object" &&
			"fields" in (value as Record<string, unknown>)
		) {
			// Nested fieldset — recurse.
			for (const inner of collectFieldPaths(
				(value as { fields: unknown }).fields,
				path,
			)) {
				out.add(inner);
			}
		} else {
			out.add(path);
		}
	}
	return out;
}

/**
 * The engine stores answers as a flat {path: value} map; @paradoc/core's
 * safePartialFill wants a nested {fields: {...}} payload. This is a thin
 * un-flatten of dot-separated keys.
 */
function answersToFormPayload(
	answers: Record<string, unknown>,
	parties: Record<string, unknown> = {},
): { fields: Record<string, unknown>; parties: Record<string, unknown> } {
	const fields: Record<string, unknown> = {};
	for (const [path, value] of Object.entries(answers)) {
		setDeep(fields, path.split("."), value);
	}
	return { fields, parties };
}

function setDeep(
	target: Record<string, unknown>,
	segments: string[],
	value: unknown,
): void {
	let cursor = target;
	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i];
		if (seg === undefined) continue;
		const existing = cursor[seg];
		if (existing && typeof existing === "object" && !Array.isArray(existing)) {
			cursor = existing as Record<string, unknown>;
		} else {
			const next: Record<string, unknown> = {};
			cursor[seg] = next;
			cursor = next;
		}
	}
	const last = segments[segments.length - 1];
	if (last !== undefined) cursor[last] = value;
}

/**
 * Best-effort coercion of a user-supplied value to the canonical type the
 * field schema expects. Runs BEFORE the strict per-field validator so the
 * model isn't forced to coerce client-side for the easy cases.
 *
 * Rules are intentionally conservative — only apply when the intent is
 * unambiguous. When in doubt, return the value untouched and let the
 * validator surface a real error.
 *
 * Note: this handles *type* coercion (string→number, string→boolean,
 * string→date-ISO). It does NOT handle *unit* coercion (e.g. "5 kg" →
 * pounds) — that's an agent-side concern (D4.2) because the conversion
 * factor lives in the field's label/description, not the type.
 */
function coerceForFieldType(type: string | undefined, value: unknown): unknown {
	if (type === undefined || value === null || value === undefined) return value;

	// number: accept numeric strings, strip commas/whitespace, also handle
	// "20.5" and "-3". Refuse on anything that doesn't parse cleanly so
	// the validator still rejects "a few" etc. with a useful error.
	if (type === "number" && typeof value === "string") {
		const cleaned = value.trim().replace(/,/g, "");
		if (cleaned.length === 0) return value;
		const n = Number(cleaned);
		if (Number.isFinite(n)) return n;
		return value;
	}

	// boolean: yes/no/true/false/1/0, case-insensitive. Any other string
	// stays a string so the validator can complain.
	if (type === "boolean" && typeof value === "string") {
		const v = value.trim().toLowerCase();
		if (v === "true" || v === "yes" || v === "y" || v === "1") return true;
		if (v === "false" || v === "no" || v === "n" || v === "0") return false;
		return value;
	}

	// date: collapse common phrasings to YYYY-MM-DD via Date parsing.
	// We only coerce when the result is a valid Date — otherwise leave
	// it for the validator.
	if (type === "date" && typeof value === "string") {
		const d = new Date(value);
		if (!Number.isNaN(d.getTime())) {
			return d.toISOString().slice(0, 10);
		}
		return value;
	}

	// multiselect: accept a JSON-stringified array (e.g. '["a","b"]').
	// Belt-and-suspenders for the same class of bug we hit on objects —
	// some models stringify arrays even when the schema expects array.
	if (type === "multiselect" && typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			try {
				const parsed = JSON.parse(trimmed);
				if (Array.isArray(parsed)) return parsed;
			} catch {
				// fall through
			}
		}
		return value;
	}

	// Object-shaped types (address, phone, money, person, object). Handles
	// three input forms the model might produce:
	//   (a) JSON-stringified object → parse and use the resulting object.
	//   (b) Scalar (string or number) → wrap into the canonical object
	//       shape (e.g. "555-...", → { number: "555-..." } for phone).
	//   (c) Already an object → pass through; for `address`, normalize
	//       common alternate key names (city → locality, zip → postalCode).
	if (isObjectShapedType(type)) {
		let normalized: unknown = value;

		// (a) JSON-string → object
		if (typeof normalized === "string") {
			const trimmed = normalized.trim();
			if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
				try {
					const parsed = JSON.parse(trimmed);
					if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
						normalized = parsed;
					}
				} catch {
					// fall through
				}
			}
		}

		// (b) Scalar → wrapped object
		if (typeof normalized === "string" || typeof normalized === "number") {
			const wrapped = wrapScalarForCompositeType(type, normalized);
			if (wrapped !== null) normalized = wrapped;
		}

		// (c) Object → alias address keys; normalize phone numbers; others pass through
		if (
			normalized !== null &&
			typeof normalized === "object" &&
			!Array.isArray(normalized)
		) {
			if (type === "address") {
				return aliasAddressKeys(normalized as Record<string, unknown>);
			}
			if (type === "phone") {
				return normalizePhoneObject(normalized as Record<string, unknown>);
			}
			return normalized;
		}

		// Couldn't normalize — return original; the validator will reject.
		return value;
	}

	return value;
}

function isObjectShapedType(type: string): boolean {
	// Delegate to @paradoc/core's CANONICAL_SHAPES registry — single
	// source of truth. The `object` fallback catches loosely-typed
	// composite fields that don't have a named primitive type.
	return isCompositeType(type) || type === "object";
}

/**
 * Normalize the `number` slot of a phone object to E.164 international
 * format (the only format the validator accepts). If the user typed
 * raw digits or a domestic-format US number, prepend `+1`. If the
 * input already looks like E.164, strip non-digit noise.
 *
 * Defensive: never throws. If the input can't be normalized to a
 * plausible E.164 shape, leave it as-is and let the validator surface
 * the error.
 */
function normalizePhoneObject(
	input: Record<string, unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...input };
	if (typeof out.number === "string") {
		out.number = toE164(out.number);
	}
	return out;
}

function toE164(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.length === 0) return raw;
	if (trimmed.startsWith("+")) {
		// Already E.164-ish — strip non-digits after the +.
		const digits = trimmed.slice(1).replace(/\D/g, "");
		if (digits.length === 0) return raw;
		return `+${digits}`;
	}
	const digits = trimmed.replace(/\D/g, "");
	// 10 digits → assume US/Canada (NANP), prepend +1.
	if (digits.length === 10) return `+1${digits}`;
	// 11 digits starting with 1 → US/Canada with the country code already there.
	if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
	// Other lengths in the E.164 valid range → assume the digits ARE
	// country + national and just prepend +.
	if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
	// Outside plausible E.164 range — let the validator reject.
	return raw;
}

/**
 * Wrap a scalar value into the canonical object shape for a composite
 * primitive. Models occasionally hand us a raw string for a phone field
 * or a raw number for a money field — wrap before validation so the
 * intent is preserved. Returns null when no wrapping rule applies.
 *
 * Canonical shapes (from @paradoc/core):
 *   phone:  { number: string; type?: string; extension?: string }
 *   money:  { amount: number; currency: string }
 *   person: { name: string; firstName?: string; lastName?: string; ... }
 */
function wrapScalarForCompositeType(
	type: string,
	value: string | number,
): Record<string, unknown> | null {
	if (type === "phone" && typeof value === "string") {
		return { number: value };
	}
	if (type === "person" && typeof value === "string") {
		return { name: value };
	}
	if (type === "money") {
		if (typeof value === "number" && Number.isFinite(value)) {
			return { amount: value, currency: "USD" };
		}
		if (typeof value === "string") {
			// Strip currency symbols, commas, and whitespace; pull off
			// an optional leading or trailing 3-letter ISO currency code.
			const cleaned = value.trim().replace(/[$,]/g, "");
			const match = cleaned.match(
				/^(?:([A-Z]{3})\s+)?(-?\d+(?:\.\d+)?)\s*([A-Z]{3})?$/i,
			);
			if (match) {
				const code = (match[1] ?? match[3] ?? "USD").toUpperCase();
				const amount = Number(match[2]);
				if (Number.isFinite(amount)) return { amount, currency: code };
			}
		}
	}
	return null;
}

/**
 * Map common alternate property names to the canonical address shape used
 * across `@paradoc/core` (line1, line2, locality, region, postalCode,
 * country). One-directional: alias only when the canonical key is absent,
 * so an input that already speaks our schema is passed through unchanged.
 */
function aliasAddressKeys(
	input: Record<string, unknown>,
): Record<string, unknown> {
	const aliases: Record<string, string> = {
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
	const out: Record<string, unknown> = { ...input };
	for (const [alias, canonical] of Object.entries(aliases)) {
		if (alias in out && !(canonical in out)) {
			out[canonical] = out[alias];
			delete out[alias];
		}
	}
	return out;
}

/**
 * Internal use only: same walk as the public listFields() but reused at
 * construction time to build the type-index. Kept as a free function so
 * the runtime constructor can call it before the runtime object exists.
 */
function listFieldsCached(
	fields: unknown,
): Array<{ fieldPath: string; required: boolean; type?: string }> {
	const out: Array<{ fieldPath: string; required: boolean; type?: string }> = [];
	const walk = (node: unknown, prefix: string) => {
		if (!node || typeof node !== "object") return;
		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			const path = prefix ? `${prefix}.${key}` : key;
			if (
				value &&
				typeof value === "object" &&
				"fields" in (value as Record<string, unknown>)
			) {
				walk((value as { fields: unknown }).fields, path);
			} else {
				const def = value as Record<string, unknown> | null;
				out.push({
					fieldPath: path,
					required: def?.required === true,
					type: typeof def?.type === "string" ? (def.type as string) : undefined,
				});
			}
		}
	};
	walk(fields, "");
	return out;
}
