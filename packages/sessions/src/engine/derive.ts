import { project } from "../event-log/projector";
import type { ProjectedSession } from "../event-log/types";
import { fillStateOf, templateFieldPath } from "./payload";
import type { ArtifactRuntime, FormSession } from "./types";

/**
 * Lifecycle phase of a session, derived from (projection × fillState).
 *
 *   collecting-required → required fields remain (excluding deferred)
 *   revisit-deferred    → required is empty AND deferred is non-empty
 *   collecting-optional → deferred is empty AND optional remains (excluding skipped)
 *   unresolved          → host could not resolve visibility/requiredness
 *   ready               → all of the above empty, awaiting render
 *   rendered            → DocumentRendered event observed
 *   abandoned           → SessionAbandoned event observed
 */
export type Phase =
	| "collecting-required"
	| "revisit-deferred"
	| "collecting-optional"
	| "unresolved"
	| "ready"
	| "rendered"
	| "abandoned";

export type FieldTarget = {
	fieldPath: string;
	required: boolean;
	deferred: boolean;
};

/**
 * Party target — used when the next thing to ask is a party. Kept separate
 * from FieldTarget because parties are collected via plain-text conversation,
 * not rendered UI.
 */
export type PartyTarget = {
	roleId: string;
	label?: string;
};

/** Annex target — used when the next thing to collect is an attachment. */
export type AnnexTarget = {
	annexId: string;
	label?: string;
};

export type ProgressSummary = {
	answered: number;
	requiredTotal: number;
	requiredRemaining: number;
	optionalTotal: number;
	optionalRemaining: number;
	deferredCount: number;
	skippedCount: number;
};

export type SessionView = {
	projected: ProjectedSession;
	phase: Phase;
	/** The next field to ask, if the next item to collect is a field. */
	next: FieldTarget | null;
	/** The next party to ask, if the next item to collect is a party. */
	nextParty: PartyTarget | null;
	/** The next annex to attach, if the next item to collect is an annex. */
	nextAnnex: AnnexTarget | null;
	progress: ProgressSummary;
	/** All pending party roles (declaration order); `nextParty` is the head. */
	pendingParties: Array<{ roleId: string; label?: string }>;
	/** All required annexes still unattached (declaration order). */
	pendingAnnexes: AnnexTarget[];
	/** Per-field status overview (declaration order). */
	fieldIndex: FieldIndexEntry[];
	/** Per-party status overview (declaration order). */
	partyIndex: PartyIndexEntry[];
	/** Per-annex status overview (declaration order). */
	annexIndex: AnnexIndexEntry[];
};

export type FieldIndexEntry = {
	fieldPath: string;
	required: boolean;
	status: "answered" | "deferred" | "skipped" | "pending" | "hidden";
	/** True when prefill locked this field; `answer`, `revise`, and `clear` reject it with `field-locked`. */
	locked: boolean;
	type?: string;
	valuePreview?: string;
};

export type PartyIndexEntry = {
	roleId: string;
	label?: string;
	partyType: "person" | "organization" | "any";
	status: "answered" | "pending";
	/** How many parties the role accepts; the next `answerParty` index is `filled`. */
	max: number;
	/** How many parties of the role are answered (indices `0..filled-1`). */
	filled: number;
};

export type AnnexIndexEntry = {
	annexId: string;
	label?: string;
	/** `pending` means visible and unattached; `pendingAnnexes` lists the required ones. */
	status: "answered" | "pending" | "hidden";
};

/**
 * Pure: given a session and the artifact runtime, compute everything the
 * agent (or UI) needs to decide what to do next. Recomputed on every read;
 * never cached on the session.
 */
export function deriveView(
	session: FormSession,
	runtime: ArtifactRuntime,
): SessionView {
	const projected = project(session.events);

	if (projected.status === "rendered") {
		return {
			projected,
			phase: "rendered",
			next: null,
			nextParty: null,
			nextAnnex: null,
			progress: zeroProgress(projected),
			pendingParties: [],
			pendingAnnexes: [],
			fieldIndex: [],
			partyIndex: [],
			annexIndex: [],
		};
	}
	if (projected.status === "abandoned") {
		return {
			projected,
			phase: "abandoned",
			next: null,
			nextParty: null,
			nextAnnex: null,
			progress: zeroProgress(projected),
			pendingParties: [],
			pendingAnnexes: [],
			fieldIndex: [],
			partyIndex: [],
			annexIndex: [],
		};
	}

	const fillState = fillStateOf(projected, runtime);
	if (fillState.resolved !== true) {
		return {
			projected,
			phase: "unresolved",
			next: null,
			nextParty: null,
			nextAnnex: null,
			progress: zeroProgress(projected),
			pendingParties: [],
			pendingAnnexes: [],
			fieldIndex: buildFieldIndex(runtime, projected, fillState),
			partyIndex: buildPartyIndex(runtime, projected),
			annexIndex: buildAnnexIndex(runtime, projected, fillState),
		};
	}

	const openRequiredNonDeferred = fillState.openRequired.filter(
		(f) => !projected.deferred.has(f.fieldPath),
	);
	const openOptionalNonSkipped = fillState.openOptional.filter(
		(f) => !projected.skipped.has(f.fieldPath) && !projected.deferred.has(f.fieldPath),
	);
	const deferredVisible = [
		...fillState.openRequired.filter((f) => projected.deferred.has(f.fieldPath)),
		...fillState.openOptional.filter((f) => projected.deferred.has(f.fieldPath)),
	];

	// Totals come from core's buckets: an answered field is in `done` with its
	// current status, so a hidden answer counts toward neither total.
	const progress: ProgressSummary = {
		answered: Object.keys(projected.answers).length,
		requiredTotal:
			fillState.openRequired.length +
			fillState.done.filter((f) => f.status === "required").length,
		requiredRemaining: openRequiredNonDeferred.length,
		optionalTotal:
			fillState.openOptional.length +
			fillState.done.filter((f) => f.status === "optional").length,
		optionalRemaining: openOptionalNonSkipped.length,
		deferredCount: projected.deferred.size,
		skippedCount: projected.skipped.size,
	};

	let phase: Phase;
	let next: FieldTarget | null = null;
	let nextParty: PartyTarget | null = null;
	let nextAnnex: AnnexTarget | null = null;
	const pendingParties = fillState.openRequiredParties;
	const pendingAnnexes = fillState.openRequiredAnnexes.map((a) => ({
		annexId: a.annexId,
		...(a.label !== undefined ? { label: a.label } : {}),
	}));

	// Pick the next required-and-non-deferred item across fields, parties, and
	// annexes, ordered by core's single canonical candidate sequence (DAG order:
	// prerequisites first, then declaration order within a rank). Falls back to
	// declaration order when a fake runtime doesn't supply candidates.
	const candidateRank = new Map<string, number>();
	(fillState.candidates ?? []).forEach((c, i) => candidateRank.set(c.key, i));
	const rankOf = (key: string, order: number): number =>
		candidateRank.has(key) ? (candidateRank.get(key) as number) : order + 1_000_000;

	type Interleaved =
		| { kind: "field"; order: number; fieldPath: string }
		| { kind: "party"; order: number; roleId: string; label?: string }
		| { kind: "annex"; order: number; annexId: string; label?: string };
	const keyOf = (item: Interleaved): string =>
		item.kind === "field" ? item.fieldPath : item.kind === "party" ? item.roleId : item.annexId;
	const interleaved: Interleaved[] = [
		...openRequiredNonDeferred.map((f) => ({
			kind: "field" as const,
			order: f.order,
			fieldPath: f.fieldPath,
		})),
		...pendingParties.map((p) => ({
			kind: "party" as const,
			order: p.order,
			roleId: p.roleId,
			...(p.label !== undefined ? { label: p.label } : {}),
		})),
		...fillState.openRequiredAnnexes.map((a) => ({
			kind: "annex" as const,
			order: a.order,
			annexId: a.annexId,
			...(a.label !== undefined ? { label: a.label } : {}),
		})),
	].sort((a, b) => rankOf(keyOf(a), a.order) - rankOf(keyOf(b), b.order));

	if (interleaved.length > 0) {
		phase = "collecting-required";
		const head = interleaved[0];
		if (head?.kind === "field") {
			next = { fieldPath: head.fieldPath, required: true, deferred: false };
		} else if (head?.kind === "party") {
			nextParty = {
				roleId: head.roleId,
				...(head.label !== undefined ? { label: head.label } : {}),
			};
		} else if (head?.kind === "annex") {
			nextAnnex = {
				annexId: head.annexId,
				...(head.label !== undefined ? { label: head.label } : {}),
			};
		}
	} else if (deferredVisible.length > 0) {
		phase = "revisit-deferred";
		const target = deferredVisible[0];
		if (target) {
			const isRequired = fillState.openRequired.some(
				(f) => f.fieldPath === target.fieldPath,
			);
			next = {
				fieldPath: target.fieldPath,
				required: isRequired,
				deferred: true,
			};
		}
	} else if (openOptionalNonSkipped.length > 0) {
		phase = "collecting-optional";
		const target = openOptionalNonSkipped[0];
		if (target) {
			next = { fieldPath: target.fieldPath, required: false, deferred: false };
		}
	} else {
		phase = "ready";
		next = null;
	}

	return {
		projected,
		phase,
		next,
		nextParty,
		nextAnnex,
		progress,
		pendingParties,
		pendingAnnexes,
		fieldIndex: buildFieldIndex(runtime, projected, fillState),
		partyIndex: buildPartyIndex(runtime, projected),
		annexIndex: buildAnnexIndex(runtime, projected, fillState),
	};
}

/**
 * Walk every field defined on the artifact and assign a status:
 *   - "answered" — has a value in the projection
 *   - "deferred" / "skipped" — user opted out (and not answered)
 *   - "pending" — currently visible per fillState, awaiting input
 *   - "hidden" — defined but not visible right now (conditional predicate excludes)
 * and a `locked` flag from the prefill's locked paths, independent of status.
 *
 * A list item path (`items[].name`) takes the status of its rows: answered
 * when any row's value is, pending when any row is visible.
 */
function buildFieldIndex(
	runtime: ArtifactRuntime,
	projected: ProjectedSession,
	fillState: ReturnType<ArtifactRuntime["getFillState"]>,
): FieldIndexEntry[] {
	const visible = new Set(
		[...fillState.openRequired, ...fillState.openOptional].map((f) =>
			templateFieldPath(f.fieldPath),
		),
	);
	const answeredRows = new Map<string, unknown>();
	for (const [path, answer] of Object.entries(projected.answers)) {
		const template = templateFieldPath(path);
		if (template !== path && !answeredRows.has(template)) {
			answeredRows.set(template, answer.value);
		}
	}
	return runtime.listFields().map((f) => {
		const answer = projected.answers[f.fieldPath];
		let status: FieldIndexEntry["status"];
		let valuePreview: string | undefined;
		if (answer) {
			status = "answered";
			valuePreview = previewValue(answer.value);
		} else if (answeredRows.has(f.fieldPath)) {
			status = "answered";
		} else if (projected.deferred.has(f.fieldPath)) {
			status = "deferred";
		} else if (projected.skipped.has(f.fieldPath)) {
			status = "skipped";
		} else if (visible.has(f.fieldPath)) {
			status = "pending";
		} else {
			status = "hidden";
		}
		return {
			fieldPath: f.fieldPath,
			required: f.required,
			status,
			locked: projected.lockedPaths.has(f.fieldPath),
			...(f.type !== undefined ? { type: f.type } : {}),
			...(valuePreview !== undefined ? { valuePreview } : {}),
		};
	});
}

function buildPartyIndex(
	runtime: ArtifactRuntime,
	projected: ProjectedSession,
): PartyIndexEntry[] {
	const filledByRole = new Map<string, number>();
	for (const p of Object.values(projected.parties)) {
		filledByRole.set(p.roleId, (filledByRole.get(p.roleId) ?? 0) + 1);
	}
	return runtime.listParties().map((p) => {
		const filled = filledByRole.get(p.roleId) ?? 0;
		return {
			roleId: p.roleId,
			...(p.label !== undefined ? { label: p.label } : {}),
			partyType: p.partyType,
			status: filled > 0 ? "answered" : "pending",
			max: p.max,
			filled,
		};
	});
}

function buildAnnexIndex(
	runtime: ArtifactRuntime,
	projected: ProjectedSession,
	fillState: ReturnType<ArtifactRuntime["getFillState"]>,
): AnnexIndexEntry[] {
	const open = new Set(
		[...fillState.openRequiredAnnexes, ...fillState.openOptionalAnnexes].map((a) => a.annexId),
	);
	return runtime.listAnnexes().map((a) => ({
		annexId: a.annexId,
		...(a.label !== undefined ? { label: a.label } : {}),
		status:
			a.annexId in projected.annexes
				? "answered"
				: open.has(a.annexId)
					? "pending"
					: "hidden",
	}));
}

function previewValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value.length > 60 ? `${value.slice(0, 57)}...` : value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	try {
		const json = JSON.stringify(value);
		return json.length > 60 ? `${json.slice(0, 57)}...` : json;
	} catch {
		return "[unserializable]";
	}
}

function zeroProgress(projected: ProjectedSession): ProgressSummary {
	return {
		answered: Object.keys(projected.answers).length,
		requiredTotal: 0,
		requiredRemaining: 0,
		optionalTotal: 0,
		optionalRemaining: 0,
		deferredCount: projected.deferred.size,
		skippedCount: projected.skipped.size,
	};
}
