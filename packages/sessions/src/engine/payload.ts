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

/** An artifact payload: nested fields, and parties by role. */
export type SessionPayload = {
	fields: Record<string, unknown>;
	parties: Record<string, unknown>;
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
 * Nests a flat map of dotted paths.
 *
 * `{"a.b": 1}` becomes `{a: {b: 1}}`. A segment already holding a non-object is
 * replaced, because two answers that disagree about whether a path is a leaf
 * are a caller error either way and the later one is the one the log ends on.
 */
export function unflattenPaths(flat: Record<string, unknown>): Record<string, unknown> {
	const nested: Record<string, unknown> = {};
	for (const [path, value] of Object.entries(flat)) {
		setDeep(nested, path.split("."), value);
	}
	return nested;
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

/** The answers of a projected session, unwrapped and nested. */
export function payloadFields(projected: ProjectedSession): Record<string, unknown> {
	return unflattenPaths(flatAnswers(projected));
}

/**
 * The parties of a projected session, keyed by role.
 *
 * The log keys a party `roleId#index`, because a role may be filled more than
 * once. An artifact payload keys by role alone, so a role filled once is that
 * party and a role filled more than once is the array of them in index order.
 * That is the shape `Party | Party[]` every consumer already reads.
 */
export function payloadParties(projected: ProjectedSession): Record<string, unknown> {
	const byRole = new Map<string, Array<{ index: number; party: unknown }>>();
	for (const answer of Object.values(projected.parties)) {
		const filled = byRole.get(answer.roleId) ?? [];
		filled.push({ index: answer.index, party: answer.party });
		byRole.set(answer.roleId, filled);
	}

	const parties: Record<string, unknown> = {};
	for (const [roleId, filled] of byRole) {
		filled.sort((a, b) => a.index - b.index);
		parties[roleId] =
			filled.length === 1 ? filled[0]!.party : filled.map((entry) => entry.party);
	}
	return parties;
}

/**
 * Everything a session has been told, in the artifact's own shape.
 *
 * Take it from `deriveView(...).projected`, or from `project(session.events)`
 * when the view is not needed. It is valid at every point of a fill, not only
 * at the end: an unanswered field is simply absent.
 */
export function sessionPayload(projected: ProjectedSession): SessionPayload {
	return { fields: payloadFields(projected), parties: payloadParties(projected) };
}
