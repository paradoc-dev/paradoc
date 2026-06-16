import { project } from "../event-log/projector";
import type {
	Actor,
	SessionEvent,
} from "../event-log/types";
import type {
	ArtifactRuntime,
	Command,
	CommandErrorCode,
	CommandResult,
	ExecuteOptions,
	FormSession,
} from "./types";

function defaultNow(): string {
	return new Date().toISOString();
}

function reject(code: CommandErrorCode, reason: string): CommandResult {
	return { ok: false, code, reason };
}

function appendEvents(
	session: FormSession,
	emitted: SessionEvent[],
): FormSession {
	return {
		...session,
		events: [...session.events, ...emitted],
	};
}

/**
 * The single mutation point for FormSessions.
 *
 * Pure: given the same inputs (including an injected `now`), returns the same
 * output. No IO, no global state. The caller is responsible for persisting
 * the returned session.
 *
 * Enforces all command pre-conditions against the current projection and the
 * artifact runtime. Emits one or more events on success; rejects with a
 * typed error code on failure.
 */
export function execute(
	session: FormSession,
	runtime: ArtifactRuntime,
	cmd: Command,
	actor: Actor,
	options: ExecuteOptions = {},
): CommandResult {
	const now = options.now ?? defaultNow;

	if (
		options.expectedEventCount !== undefined &&
		options.expectedEventCount !== session.events.length
	) {
		return reject(
			"stale-state",
			`expected ${options.expectedEventCount} events, found ${session.events.length}`,
		);
	}

	const projected = project(session.events);
	if (projected.status === "abandoned" || projected.status === "rendered") {
		// Lifecycle terminal — no commands except inspect/validate are allowed.
		// We allow `validate` so the agent can still report state; everything
		// else is rejected.
		if (cmd.kind !== "validate") {
			return reject(
				"session-not-active",
				`session is ${projected.status} — no further commands accepted`,
			);
		}
	}

	switch (cmd.kind) {
		case "answer": {
			if (!runtime.hasField(cmd.fieldPath)) {
				return reject(
					"field-not-found",
					`field ${cmd.fieldPath} does not exist on the artifact`,
				);
			}
			const fillState = runtime.getFillState(answersOf(projected), partiesOf(projected));
			const visible =
				fillState.openRequired.some((f) => f.fieldPath === cmd.fieldPath) ||
				fillState.openOptional.some((f) => f.fieldPath === cmd.fieldPath) ||
				cmd.fieldPath in projected.answers;
			if (!visible) {
				return reject(
					"field-not-visible",
					`field ${cmd.fieldPath} is not currently visible`,
				);
			}
			if (cmd.fieldPath in projected.answers) {
				return reject(
					"field-already-answered",
					`field ${cmd.fieldPath} is already answered — use revise`,
				);
			}
			const validation = runtime.validateField(cmd.fieldPath, cmd.value);
			if (!validation.ok) {
				return reject(
					"invalid-value",
					validation.issues.map((i) => i.message).join("; ") ||
						"value rejected by field schema",
				);
			}
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "FieldAnswered",
					at: now(),
					by: actor,
					fieldPath: cmd.fieldPath,
					value: validation.value,
					source: cmd.source,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "revise": {
			if (!runtime.hasField(cmd.fieldPath)) {
				return reject(
					"field-not-found",
					`field ${cmd.fieldPath} does not exist on the artifact`,
				);
			}
			const existing = projected.answers[cmd.fieldPath];
			if (!existing) {
				return reject(
					"field-not-answered",
					`field ${cmd.fieldPath} has no value to revise — use answer`,
				);
			}
			const validation = runtime.validateField(cmd.fieldPath, cmd.value);
			if (!validation.ok) {
				return reject(
					"invalid-value",
					validation.issues.map((i) => i.message).join("; ") ||
						"value rejected by field schema",
				);
			}
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "FieldRevised",
					at: now(),
					by: actor,
					fieldPath: cmd.fieldPath,
					previous: existing.value,
					value: validation.value,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "clear": {
			const existing = projected.answers[cmd.fieldPath];
			if (!existing) {
				return reject(
					"field-not-answered",
					`field ${cmd.fieldPath} has no value to clear`,
				);
			}
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "FieldCleared",
					at: now(),
					by: actor,
					fieldPath: cmd.fieldPath,
					previous: existing.value,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "defer": {
			if (!runtime.hasField(cmd.fieldPath)) {
				return reject(
					"field-not-found",
					`field ${cmd.fieldPath} does not exist on the artifact`,
				);
			}
			if (cmd.fieldPath in projected.answers) {
				return reject(
					"field-already-answered",
					`cannot defer ${cmd.fieldPath}: already answered — clear first`,
				);
			}
			if (projected.deferred.has(cmd.fieldPath)) {
				return reject(
					"field-already-deferred",
					`${cmd.fieldPath} is already deferred`,
				);
			}
			const fillState = runtime.getFillState(answersOf(projected), partiesOf(projected));
			const visible =
				fillState.openRequired.some((f) => f.fieldPath === cmd.fieldPath) ||
				fillState.openOptional.some((f) => f.fieldPath === cmd.fieldPath);
			if (!visible) {
				return reject(
					"field-not-visible",
					`field ${cmd.fieldPath} is not currently visible`,
				);
			}
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "FieldDeferred",
					at: now(),
					by: actor,
					fieldPath: cmd.fieldPath,
					...(cmd.note !== undefined ? { note: cmd.note } : {}),
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "undefer": {
			if (!projected.deferred.has(cmd.fieldPath)) {
				return reject(
					"field-not-deferred",
					`${cmd.fieldPath} is not currently deferred`,
				);
			}
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "FieldUndeferred",
					at: now(),
					by: actor,
					fieldPath: cmd.fieldPath,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "skip": {
			if (!runtime.hasField(cmd.fieldPath)) {
				return reject(
					"field-not-found",
					`field ${cmd.fieldPath} does not exist on the artifact`,
				);
			}
			if (cmd.fieldPath in projected.answers) {
				return reject(
					"field-already-answered",
					`cannot skip ${cmd.fieldPath}: already answered`,
				);
			}
			if (projected.skipped.has(cmd.fieldPath)) {
				return reject(
					"field-already-skipped",
					`${cmd.fieldPath} is already skipped`,
				);
			}
			const fillState = runtime.getFillState(answersOf(projected), partiesOf(projected));
			const inRequired = fillState.openRequired.some(
				(f) => f.fieldPath === cmd.fieldPath,
			);
			const inOptional = fillState.openOptional.some(
				(f) => f.fieldPath === cmd.fieldPath,
			);
			if (!inRequired && !inOptional) {
				return reject(
					"field-not-visible",
					`field ${cmd.fieldPath} is not currently visible`,
				);
			}
			if (inRequired) {
				return reject(
					"field-required",
					`cannot skip ${cmd.fieldPath}: it is currently required — defer instead`,
				);
			}
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "FieldSkipped",
					at: now(),
					by: actor,
					fieldPath: cmd.fieldPath,
					...(cmd.note !== undefined ? { note: cmd.note } : {}),
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "unskip": {
			if (!projected.skipped.has(cmd.fieldPath)) {
				return reject(
					"field-not-skipped",
					`${cmd.fieldPath} is not currently skipped`,
				);
			}
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "FieldUnskipped",
					at: now(),
					by: actor,
					fieldPath: cmd.fieldPath,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "present": {
			if (!runtime.hasField(cmd.fieldPath)) {
				return reject(
					"field-not-found",
					`field ${cmd.fieldPath} does not exist on the artifact`,
				);
			}
			const fillState = runtime.getFillState(answersOf(projected), partiesOf(projected));
			const visible =
				fillState.openRequired.some((f) => f.fieldPath === cmd.fieldPath) ||
				fillState.openOptional.some((f) => f.fieldPath === cmd.fieldPath);
			if (!visible) {
				return reject(
					"field-not-visible",
					`field ${cmd.fieldPath} is not currently visible`,
				);
			}
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "FieldPresented",
					at: now(),
					by: actor,
					fieldPath: cmd.fieldPath,
					presentation: cmd.presentation,
					turn: projected.currentTurn + 1,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "answerParty": {
			if (!runtime.hasParty(cmd.roleId)) {
				return reject(
					"party-not-found",
					`party role ${cmd.roleId} does not exist on the artifact`,
				);
			}
			const validation = runtime.validateParty(cmd.roleId, cmd.value);
			if (!validation.ok) {
				return reject(
					"invalid-value",
					validation.issues.map((i) => i.message).join("; ") ||
						"party value rejected by schema",
				);
			}
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "PartyAnswered",
					at: now(),
					by: actor,
					roleId: cmd.roleId,
					index: cmd.index ?? 0,
					party: validation.value,
					source: cmd.source,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "validate": {
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "ValidationRan",
					at: now(),
					valid: cmd.valid,
					errors: cmd.errors,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "render": {
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "DocumentRendered",
					at: now(),
					renderRef: cmd.renderRef,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		case "abandon": {
			const emitted: SessionEvent[] = [
				{
					v: 1,
					t: "SessionAbandoned",
					at: now(),
					by: actor,
				},
			];
			return { ok: true, session: appendEvents(session, emitted), emitted };
		}

		default: {
			const _exhaustive: never = cmd;
			void _exhaustive;
			return reject("invalid-value", "unknown command");
		}
	}
}

/**
 * Reduce the projection's answer map to a plain {path: value} record for
 * passing to the artifact runtime.
 */
function answersOf(
	projected: ReturnType<typeof project>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [path, ans] of Object.entries(projected.answers)) {
		out[path] = ans.value;
	}
	return out;
}

function partiesOf(
	projected: ReturnType<typeof project>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const ans of Object.values(projected.parties)) {
		// One-off-per-role assumption for v2 (no repeatable parties yet) —
		// last-write-wins per roleId.
		out[ans.roleId] = ans.party;
	}
	return out;
}
