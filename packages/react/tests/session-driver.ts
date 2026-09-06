/**
 * A scripted session driver.
 *
 * The engine decides what to ask for next; this answers it from a script and
 * hands back the session the engine returned. The order is core's, resolved
 * from the artifact's own dependency graph, so a test that imposed its own
 * order would be testing the order rather than the fill.
 *
 * An optional field the script has no answer for is skipped, which is how a
 * fill of a form with a long optional tail (the W-9 has eleven) reaches `ready`
 * without inventing values nobody supplied.
 *
 * The clock is fixed, so a session is a pure function of the answers it was
 * given and two runs of the same script produce the same log.
 */

import {
  createParadocRuntime,
  deriveView,
  execute,
  project,
  sessionPayload,
  type ArtifactRuntime,
  type FormSession,
  type SessionPayload,
} from "@paradoc/sessions";

/** Fixed instant every event in a scripted fill is stamped with. */
export const SCRIPT_AT = "1970-01-01T00:00:00.000Z";

const ACTOR = { kind: "user" } as const;
const CLOCK = { now: () => SCRIPT_AT };

/** What a script answers: a value per field path, and a party per role. */
export interface FillScript {
  fields: Record<string, unknown>;
  parties: Record<string, unknown>;
}

/** A fresh, empty session for one artifact. */
export function emptySession(name: string): FormSession {
  return {
    formSessionId: name,
    chatId: name,
    artifactRef: { name },
    events: [],
    createdAt: SCRIPT_AT,
  };
}

/** The engine's runtime over a raw artifact definition. */
export function runtimeFor(spec: unknown): ArtifactRuntime {
  return createParadocRuntime(spec as Record<string, unknown>);
}

/** What one step of a fill did. */
export interface FillStep {
  session: FormSession;
  /** The field path answered, `party:<role>` for a party, `skip:<path>` for a skip. */
  did: string;
}

/**
 * Answers, or skips, whatever the session asks for next.
 *
 * Returns null when the session asks for nothing more, which is the end of the
 * fill. Throws when the engine rejects a value the script supplied: a script
 * whose own values do not validate is a broken script, and swallowing that
 * would make a fill look complete when it is not.
 */
export function fillStep(
  session: FormSession,
  runtime: ArtifactRuntime,
  script: FillScript
): FillStep | null {
  const view = deriveView(session, runtime);

  if (view.next) {
    const path = view.next.fieldPath;
    const value = script.fields[path];
    if (value === undefined && !view.next.required) {
      const skipped = execute(session, runtime, { kind: "skip", fieldPath: path }, ACTOR, CLOCK);
      if (!skipped.ok) throw new Error(`cannot skip "${path}": ${skipped.reason}`);
      return { session: skipped.session, did: `skip:${path}` };
    }
    const answered = execute(
      session,
      runtime,
      { kind: "answer", fieldPath: path, value, source: "user" },
      ACTOR,
      CLOCK
    );
    if (!answered.ok) throw new Error(`the script's "${path}" was rejected: ${answered.reason}`);
    return { session: answered.session, did: path };
  }

  if (view.nextParty) {
    const role = view.nextParty.roleId;
    const answered = execute(
      session,
      runtime,
      { kind: "answerParty", roleId: role, value: script.parties[role], source: "user" },
      ACTOR,
      CLOCK
    );
    if (!answered.ok) throw new Error(`the script's "${role}" party was rejected: ${answered.reason}`);
    return { session: answered.session, did: `party:${role}` };
  }

  return null;
}

/** What a completed scripted fill produced. */
export interface FilledSession {
  session: FormSession;
  runtime: ArtifactRuntime;
  /** What the fill did, in order, so a test can assert what was asked for. */
  order: string[];
  /** Everything answered, in the artifact's own shape. */
  payload: SessionPayload;
}

/** Runs a script to the end of the fill. */
export function fillBySession(name: string, spec: unknown, script: FillScript): FilledSession {
  const runtime = runtimeFor(spec);
  let session = emptySession(name);
  const order: string[] = [];

  for (let step = 0; step < 200; step++) {
    const done = fillStep(session, runtime, script);
    if (!done) {
      return { session, runtime, order, payload: sessionPayload(project(session.events)) };
    }
    session = done.session;
    order.push(done.did);
  }

  throw new Error(`the fill of "${name}" did not settle in 200 steps`);
}
