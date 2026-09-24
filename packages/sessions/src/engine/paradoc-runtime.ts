import { loadFromObject, isCompositeType } from "@paradoc/core";
import { templateFieldPath, unflattenPaths } from "./payload";
import type { ArtifactRuntime, FillStateSnapshot } from "./types";

/**
 * Build an ArtifactRuntime backed by @paradoc/core.
 *
 * The artifact object is loaded once; per-call we run safeFill against
 * the current answers and ask the resulting DraftForm for its FillState. This
 * is the same pattern the legacy session.ts uses, just wrapped behind a tight
 * interface so the engine remains independent of core's evolving API.
 *
 * Performance: loadFromObject + safeFill is a few milliseconds for
 * typical artifacts; cheap enough to recompute on every command.
 */
export function createParadocRuntime(
	artifact: Record<string, unknown>,
): ArtifactRuntime {
	// Loaded once — pure design-time wrapper; doesn't capture answers.
	const instance = loadFromObject<"form">(artifact);

	// One walk of the field tree: the public list, the path set, and the type
	// index all come from it, so they cannot disagree about list items.
	const fieldList = walkFields(instance.fields);
	const knownFieldPaths = new Set(fieldList.map((f) => f.fieldPath));
	const fieldTypes = new Map<string, string>();
	for (const f of fieldList) {
		if (f.type) fieldTypes.set(f.fieldPath, f.type);
	}

	const partyList = Object.entries(instance.parties ?? {}).map(([roleId, def]) => ({
		roleId,
		...(def.label ? { label: def.label } : {}),
		partyType: def.partyType ?? ("any" as const),
		max: def.max ?? 1,
	}));
	const partyLabels = new Map(partyList.map((p) => [p.roleId, p.label]));

	const annexList = Object.entries(instance.annexes ?? {}).map(([annexId, def]) => ({
		annexId,
		...(def.title ? { label: def.title } : {}),
	}));
	const annexLabels = new Map(annexList.map((a) => [a.annexId, a.label]));

	function hasField(fieldPath: string): boolean {
		return knownFieldPaths.has(templateFieldPath(fieldPath));
	}

	function hasParty(roleId: string): boolean {
		return partyLabels.has(roleId);
	}

	function hasAnnex(annexId: string): boolean {
		return annexLabels.has(annexId);
	}

	function getFillState(
		answers: Record<string, unknown>,
		parties: Record<string, unknown>,
		annexes: Record<string, unknown>,
	): FillStateSnapshot {
		const draft = instance.safeFill(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ fields: unflattenPaths(answers), parties, annexes } as any,
		);
		if (!draft.success) {
			return {
				resolved: false,
				diagnostics: [draft.error.message],
				openRequired: [],
				openOptional: [],
				done: [],
				openRequiredParties: [],
				openRequiredAnnexes: [],
				openOptionalAnnexes: [],
			};
		}
		const runtimeState = draft.data.runtimeState;
		const fillState = draft.data.getFillState({ includeOptional: true });
		type Item = (typeof fillState.done)[number];
		const fields = (items: Item[]) =>
			items
				.filter((item) => item.kind === "field")
				.map((item) => ({ fieldPath: item.key, order: item.order, status: item.status }));
		const annexItems = (items: Item[]) =>
			items
				.filter((item) => item.kind === "annex")
				.map((item) => {
					const label = annexLabels.get(item.key);
					return { annexId: item.key, ...(label !== undefined ? { label } : {}), order: item.order };
				});
		return {
			resolved: runtimeState.resolved,
			...(runtimeState.issues.length > 0
				? { diagnostics: runtimeState.issues.map((issue) => issue.message) }
				: {}),
			openRequired: fields(fillState.openRequired),
			openOptional: fields(fillState.openOptional),
			done: fields(fillState.done),
			openRequiredParties: fillState.openRequired
				.filter((item) => item.kind === "party")
				.map((item) => {
					const label = partyLabels.get(item.key);
					return { roleId: item.key, ...(label !== undefined ? { label } : {}), order: item.order };
				}),
			openRequiredAnnexes: annexItems(fillState.openRequired),
			openOptionalAnnexes: annexItems(fillState.openOptional),
			candidates: fillState.candidates.map((c) => ({
				kind: c.kind,
				key: c.key,
				required: c.required,
				order: c.order,
			})),
		};
	}

	function validateField(
		fieldPath: string,
		value: unknown,
	): ReturnType<ArtifactRuntime["validateField"]> {
		const coerced = coerceForFieldType(fieldTypes.get(templateFieldPath(fieldPath)), value);
		const result = instance.validateFieldInput({ fieldPath, value: coerced });
		if (result.success) {
			// Persist the value core's schema produced, not the input: e.g. "20"
			// is stored as the number 20, and any normalization core applies
			// reaches the event log.
			return { ok: true, value: result.value };
		}
		return { ok: false, issues: issuesOf(result.errors) };
	}

	function validateParty(
		roleId: string,
		value: unknown,
		index: number,
	): ReturnType<ArtifactRuntime["validateParty"]> {
		const result = instance.validatePartyInput({ roleId, index, value });
		if (result.success) {
			// validatePartyInput returns NormalizedPartyInput; we just need the
			// runtime party object for downstream serialization.
			return { ok: true, value: result.value.party };
		}
		return { ok: false, issues: issuesOf(result.errors) };
	}

	function validateAnnex(
		annexId: string,
		value: unknown,
	): ReturnType<ArtifactRuntime["validateAnnex"]> {
		const result = instance.validateAnnexInput({ annexId, value });
		if (result.success) return { ok: true, value: result.value };
		return { ok: false, issues: issuesOf(result.errors) };
	}

	return {
		hasField,
		hasParty,
		hasAnnex,
		getFillState,
		validateField,
		validateParty,
		validateAnnex,
		listFields: () => fieldList.map((f) => ({ ...f })),
		listParties: () => partyList.map((p) => ({ ...p })),
		listAnnexes: () => annexList.map((a) => ({ ...a })),
	};
}

function issuesOf(errors: ReadonlyArray<{ field: string; message: string }>) {
	return errors.map((e) => ({ fieldPath: e.field, message: e.message }));
}

type FieldEntry = { fieldPath: string; required: boolean; type?: string };

/**
 * Walk an artifact's `fields` map and yield every field path, in declaration
 * order, with the dot-separated form @paradoc/core's APIs use
 * (validateFieldInput, FillState keys). A fieldset is walked, not listed; a
 * list is listed and its item paths follow under `[]` (`items[].name`, or
 * `tags[]` for a list of scalars).
 */
function walkFields(fields: unknown, prefix = ""): FieldEntry[] {
	const out: FieldEntry[] = [];
	if (!fields || typeof fields !== "object") return out;
	for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
		const path = prefix ? `${prefix}.${key}` : key;
		const def = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
		if (def && "fields" in def) {
			out.push(...walkFields(def.fields, path));
			continue;
		}
		out.push(entryOf(path, def));
		if (def?.type !== "list") continue;
		const item = def.item && typeof def.item === "object" ? (def.item as Record<string, unknown>) : null;
		if (item && "fields" in item) out.push(...walkFields(item.fields, `${path}[]`));
		else if (item) out.push(entryOf(`${path}[]`, item));
	}
	return out;
}

function entryOf(fieldPath: string, def: Record<string, unknown> | null): FieldEntry {
	return {
		fieldPath,
		required: def?.required === true,
		...(typeof def?.type === "string" ? { type: def.type } : {}),
	};
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
