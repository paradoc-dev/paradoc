/**
 * The projection from a session's event log to an artifact payload.
 *
 * A session stores what it was told: one answer per field path, flat, with the
 * path dotted. Everything downstream of a session wants the artifact's own
 * shape instead — nested fields and parties by role — because that is what
 * `safeFill` takes, what a renderer takes, and what a document
 * composition binds to.
 *
 * That translation is one function and lives here so there is one of it. The
 * engine's own `ArtifactRuntime` uses it to ask core for a fill state, and a
 * caller showing the answers as a document uses the same one, so a session on
 * screen and the session core evaluates can never be shaped differently.
 *
 * It is a projection, not a fill: the payload is whatever has been answered so
 * far, and no field is invented, defaulted, or computed. A value derived from
 * other answers belongs to whoever derives it, and asking a session for one
 * would put a computed value in an event log that is supposed to record only
 * what was said.
 */

import type { ProjectedSession } from "../event-log/types";
import type { ArtifactRuntime, FillStateSnapshot } from "./types";

/** An artifact payload: nested fields, parties by role, and annexes by id. */
export type SessionPayload = {
	fields: Record<string, unknown>;
	parties: Record<string, unknown>;
	annexes: Record<string, unknown>;
};

/**
 * A projected session's answers, unwrapped from their provenance and left flat.
 *
 * One loop, shared. `deriveView` asks core for a fill state with the flat map
 * and `payloadFields` nests the same map, so the two can never disagree about
 * what has been answered.
 */
export function flatAnswers(projected: ProjectedSession): Record<string, unknown> {
	const flat: Record<string, unknown> = {};
	for (const [path, answer] of Object.entries(projected.answers)) {
		flat[path] = answer.value;
	}
	return flat;
}

/**
 * Nests a flat map of dotted and indexed paths.
 *
 * `{"a.b": 1}` becomes `{a: {b: 1}}`, while
 * `{"items[0].name": "Ada"}` becomes `{items: [{name: "Ada"}]}`. A segment
 * already holding a non-container is replaced, because two answers that
 * disagree about whether a path is a leaf are a caller error either way and
 * the later one is the one the log ends on.
 */
export function unflattenPaths(flat: Record<string, unknown>): Record<string, unknown> {
	const nested: Record<string, unknown> = {};
	for (const [path, value] of Object.entries(flat)) {
		setDeep(nested, parsePath(path), value);
	}
	return nested;
}

/** A concrete path with its list indices replaced by `[]`: `items[0].name` → `items[].name`. */
export function templateFieldPath(path: string): string {
	return path.replace(/\[\d+\]/g, "[]");
}

type PathSegment = string | number;

/** Parse the session engine's field path form without changing domain keys. */
function parsePath(path: string): PathSegment[] {
	const segments: PathSegment[] = [];
	let cursor = 0;
	while (cursor < path.length) {
		if (path[cursor] === ".") {
			cursor += 1;
			continue;
		}
		if (path[cursor] === "[") {
			const close = path.indexOf("]", cursor + 1);
			const indexText = close < 0 ? "" : path.slice(cursor + 1, close);
			if (close < 0 || !/^\d+$/.test(indexText)) {
				// Invalid paths are not expected from the session engine. Keeping
				// the raw path as one key makes this projection deterministic if a
				// corrupt event is encountered, without guessing an array shape.
				return [path];
			}
			segments.push(Number(indexText));
			cursor = close + 1;
			continue;
		}

		let end = cursor;
		while (end < path.length && path[end] !== "." && path[end] !== "[") {
			end += 1;
		}
		const segment = path.slice(cursor, end);
		if (segment.length === 0) return [path];
		segments.push(segment);
		cursor = end;
	}
	return segments.length > 0 ? segments : [path];
}

function setDeep(
	target: Record<string, unknown> | unknown[],
	segments: PathSegment[],
	value: unknown,
): void {
	let cursor: Record<string, unknown> | unknown[] = target;
	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i];
		if (seg === undefined) continue;
		const container = cursor as { [key: string]: unknown; [index: number]: unknown };
		const existing = container[seg];
		if (existing && typeof existing === "object") {
			// Answers may already contain a canonical object/array for a parent
			// path (for example `groups`). Clone each container on the path
			// before writing a later indexed child so projection never mutates
			// the value held by the event log.
			const copy = Array.isArray(existing)
				? [...existing]
				: { ...(existing as Record<string, unknown>) };
			container[seg] = copy;
			cursor = copy;
		} else {
			const next: Record<string, unknown> | unknown[] =
				typeof segments[i + 1] === "number" ? [] : {};
			container[seg] = next;
			cursor = next;
		}
	}
	const last = segments[segments.length - 1];
	if (last !== undefined) {
		(cursor as { [key: string]: unknown; [index: number]: unknown })[last] = value;
	}
}

/** The answers of a projected session, unwrapped and nested. */
export function payloadFields(projected: ProjectedSession): Record<string, unknown> {
	return unflattenPaths(flatAnswers(projected));
}

/**
 * The parties of a projected session, keyed by role.
 *
 * The log keys a party `roleId#index`, because a role may be filled more than
 * once. An artifact payload keys by role alone, in the shape the role declares:
 * a role with `max > 1` is always the array of its parties in index order, even
 * when one is filled, and a single-party role is that party. A role nobody has
 * filled is absent.
 */
export function payloadParties(
	projected: ProjectedSession,
	runtime: Pick<ArtifactRuntime, "listParties">,
): Record<string, unknown> {
	const maxByRole = new Map(runtime.listParties().map((role) => [role.roleId, role.max]));
	const byRole = new Map<string, Array<{ index: number; party: unknown }>>();
	for (const answer of Object.values(projected.parties)) {
		const filled = byRole.get(answer.roleId) ?? [];
		filled.push({ index: answer.index, party: answer.party });
		byRole.set(answer.roleId, filled);
	}

	const parties: Record<string, unknown> = {};
	for (const [roleId, filled] of byRole) {
		filled.sort((a, b) => a.index - b.index);
		const repeatable = (maxByRole.get(roleId) ?? 1) > 1;
		parties[roleId] = repeatable ? filled.map((entry) => entry.party) : filled[0]!.party;
	}
	return parties;
}

/** The attached annexes of a projected session, keyed by annex id. */
export function payloadAnnexes(projected: ProjectedSession): Record<string, unknown> {
	const annexes: Record<string, unknown> = {};
	for (const [annexId, answer] of Object.entries(projected.annexes)) {
		annexes[annexId] = answer.attachment;
	}
	return annexes;
}

/**
 * Core's fill state for a projected session: the flat answers with parties and
 * annexes in their payload shape.
 */
export function fillStateOf(
	projected: ProjectedSession,
	runtime: Pick<ArtifactRuntime, "getFillState" | "listParties">,
): FillStateSnapshot {
	return runtime.getFillState(
		flatAnswers(projected),
		payloadParties(projected, runtime),
		payloadAnnexes(projected),
	);
}

/**
 * Everything a session has been told, in the artifact's own shape.
 *
 * Take it from `deriveView(...).projected`, or from `project(session.events)`
 * when the view is not needed, with the session's runtime (it says which roles
 * take an array). It is valid at every point of a fill, not only at the end:
 * an unanswered field, party, or annex is simply absent.
 */
export function sessionPayload(
	projected: ProjectedSession,
	runtime: Pick<ArtifactRuntime, "listParties">,
): SessionPayload {
	return {
		fields: payloadFields(projected),
		parties: payloadParties(projected, runtime),
		annexes: payloadAnnexes(projected),
	};
}
