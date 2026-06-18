import { project } from "../event-log/projector";
import type { ProjectedSession } from "../event-log/types";
import type { ArtifactRuntime, FormSession } from "./types";

/**
 * Lifecycle phase of a session, derived from (projection × fillState).
 *
 *   collecting-required → required fields remain (excluding deferred)
 *   revisit-deferred    → required is empty AND deferred is non-empty
 *   collecting-optional → deferred is empty AND optional remains (excluding skipped)
 *   ready               → all of the above empty, awaiting render
 *   rendered            → DocumentRendered event observed
 *   abandoned           → SessionAbandoned event observed
 */
export type Phase =
	| "collecting-required"
	| "revisit-deferred"
	| "collecting-optional"
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
	progress: ProgressSummary;
	/** All pending party roles (declaration order); `nextParty` is the head. */
	pendingParties: Array<{ roleId: string; label?: string }>;
	/** Per-field status overview (declaration order). */
	fieldIndex: FieldIndexEntry[];
	/** Per-party status overview (declaration order). */
	partyIndex: PartyIndexEntry[];
};

export type FieldIndexEntry = {
	fieldPath: string;
	required: boolean;
	status: "answered" | "deferred" | "skipped" | "pending" | "hidden";
	type?: string;
	valuePreview?: string;
};

export type PartyIndexEntry = {
	roleId: string;
	label?: string;
	partyType: "person" | "organization" | "any";
	status: "answered" | "pending";
};

function answersOf(projected: ProjectedSession): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [path, ans] of Object.entries(projected.answers)) {
		out[path] = ans.value;
	}
	return out;
}

function partiesOf(projected: ProjectedSession): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const ans of Object.values(projected.parties)) {
		out[ans.roleId] = ans.party;
	}
	return out;
}

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
			progress: zeroProgress(projected),
			pendingParties: [],
			fieldIndex: [],
			partyIndex: [],
		};
	}
	if (projected.status === "abandoned") {
		return {
			projected,
			phase: "abandoned",
			next: null,
			nextParty: null,
			progress: zeroProgress(projected),
			pendingParties: [],
			fieldIndex: [],
			partyIndex: [],
		};
	}

	const fillState = runtime.getFillState(
		answersOf(projected),
		partiesOf(projected),
	);

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

	const progress: ProgressSummary = {
		answered: Object.keys(projected.answers).length,
		requiredTotal:
			fillState.openRequired.length +
			countAnsweredRequired(projected, fillState),
		requiredRemaining: openRequiredNonDeferred.length,
		optionalTotal: fillState.openOptional.length + countAnsweredOptional(projected, fillState),
		optionalRemaining: openOptionalNonSkipped.length,
		deferredCount: projected.deferred.size,
		skippedCount: projected.skipped.size,
	};

	let phase: Phase;
	let next: FieldTarget | null = null;
	let nextParty: PartyTarget | null = null;
	const pendingParties = fillState.openRequiredParties;

	// Pick the next required-and-non-deferred item across BOTH fields and
	// parties, ordered by core's single canonical candidate sequence (DAG order:
	// prerequisites first, then declaration order within a rank). Falls back to
	// declaration order when a fake runtime doesn't supply candidates.
	const candidateRank = new Map<string, number>();
	(fillState.candidates ?? []).forEach((c, i) => candidateRank.set(c.key, i));
	const rankOf = (key: string, order: number): number =>
		candidateRank.has(key) ? (candidateRank.get(key) as number) : order + 1_000_000;

	const interleaved: Array<
		| { kind: "field"; order: number; fieldPath: string }
		| { kind: "party"; order: number; roleId: string; label?: string }
	> = [
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
	].sort(
		(a, b) =>
			rankOf(a.kind === "field" ? a.fieldPath : a.roleId, a.order) -
			rankOf(b.kind === "field" ? b.fieldPath : b.roleId, b.order),
	);

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

	const fieldIndex = buildFieldIndex(runtime, projected, fillState);
	const partyIndex = buildPartyIndex(runtime, projected, fillState);

	return {
		projected,
		phase,
		next,
		nextParty,
		progress,
		pendingParties,
		fieldIndex,
		partyIndex,
	};
}

/**
 * Walk every field defined on the artifact and assign a status:
 *   - "answered" — has a value in the projection
 *   - "deferred" / "skipped" — user opted out (and not answered)
 *   - "pending" — currently visible per fillState, awaiting input
 *   - "hidden" — defined but not visible right now (conditional predicate excludes)
 */
function buildFieldIndex(
	runtime: ArtifactRuntime,
	projected: ProjectedSession,
	fillState: ReturnType<ArtifactRuntime["getFillState"]>,
): FieldIndexEntry[] {
	const visible = new Set([
		...fillState.openRequired.map((f) => f.fieldPath),
		...fillState.openOptional.map((f) => f.fieldPath),
	]);
	return runtime.listFields().map((f) => {
		const answer = projected.answers[f.fieldPath];
		let status: FieldIndexEntry["status"];
		let valuePreview: string | undefined;
		if (answer) {
			status = "answered";
			valuePreview = previewValue(answer.value);
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
			...(f.type !== undefined ? { type: f.type } : {}),
			...(valuePreview !== undefined ? { valuePreview } : {}),
		};
	});
}

function buildPartyIndex(
	runtime: ArtifactRuntime,
	projected: ProjectedSession,
	_fillState: ReturnType<ArtifactRuntime["getFillState"]>,
): PartyIndexEntry[] {
	const answeredRoleIds = new Set(
		Object.values(projected.parties).map((p) => p.roleId),
	);
	return runtime.listParties().map((p) => ({
		roleId: p.roleId,
		...(p.label !== undefined ? { label: p.label } : {}),
		partyType: p.partyType,
		status: answeredRoleIds.has(p.roleId) ? "answered" : "pending",
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

/**
 * Number of answered fields that, ignoring the current answer, would have
 * been required. Used for `requiredTotal` accounting. We approximate by
 * counting answers whose paths are NOT presently in openOptional (i.e. they
 * were either required or are not currently visible — close enough for a
 * progress indicator).
 */
function countAnsweredRequired(
	projected: ProjectedSession,
	fillState: ReturnType<ArtifactRuntime["getFillState"]>,
): number {
	let n = 0;
	const optionalPaths = new Set(
		fillState.openOptional.map((f) => f.fieldPath),
	);
	for (const path of Object.keys(projected.answers)) {
		if (!optionalPaths.has(path)) n += 1;
	}
	return n;
}

function countAnsweredOptional(
	projected: ProjectedSession,
	fillState: ReturnType<ArtifactRuntime["getFillState"]>,
): number {
	let n = 0;
	const optionalPaths = new Set(
		fillState.openOptional.map((f) => f.fieldPath),
	);
	for (const path of Object.keys(projected.answers)) {
		if (optionalPaths.has(path)) n += 1;
	}
	return n;
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
