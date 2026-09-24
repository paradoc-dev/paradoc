import { loadFromObject } from "@paradoc/core";
import { assertCoercionOptions, coerceFieldValue, type CoercionOptions, type CoercionTarget } from "./coerce";
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
 *
 * `options.defaultCallingCode` (for example `"+1"`) is the only source of a
 * country code for a phone number given without one; see `coerce.ts`.
 */
export function createParadocRuntime(
	artifact: Record<string, unknown>,
	options: CoercionOptions = {},
): ArtifactRuntime {
	assertCoercionOptions(options);
	// Loaded once — pure design-time wrapper; doesn't capture answers.
	const instance = loadFromObject<"form">(artifact);

	// One walk of the field tree: the public list, the path set, and the type
	// index all come from it, so they cannot disagree about list items.
	const fieldList = walkFields(instance.fields);
	const knownFieldPaths = new Set(fieldList.map((f) => f.fieldPath));
	const coercionTargets = new Map<string, CoercionTarget>(
		fieldList.map((f) => [f.fieldPath, f.target]),
	);

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
		const coerced = coerceFieldValue(
			coercionTargets.get(templateFieldPath(fieldPath)),
			value,
			options,
		);
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
		listFields: () =>
			fieldList.map(({ fieldPath, required, type }) => ({
				fieldPath,
				required,
				...(type !== undefined ? { type } : {}),
			})),
		listParties: () => partyList.map((p) => ({ ...p })),
		listAnnexes: () => annexList.map((a) => ({ ...a })),
	};
}

function issuesOf(errors: ReadonlyArray<{ field: string; message: string }>) {
	return errors.map((e) => ({ fieldPath: e.field, message: e.message }));
}

type FieldEntry = {
	fieldPath: string;
	required: boolean;
	type?: string;
	/** What value coercion needs to know about the field. */
	target: CoercionTarget;
};

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
	const type = typeof def?.type === "string" ? def.type : undefined;
	const currency = typeof def?.currency === "string" ? def.currency : undefined;
	return {
		fieldPath,
		required: def?.required === true,
		...(type !== undefined ? { type } : {}),
		target: {
			...(type !== undefined ? { type } : {}),
			...(currency !== undefined ? { currency } : {}),
		},
	};
}
