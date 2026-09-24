// sessions-007: revising a prefilled value keeps source "prefill".
// Input: PrefillApplied (unlocked) for `name` = "Pre", then a `revise` command to "Mine" by the user.
// Expected: answers.name.source === "user". Actual: "prefill".
import { expect, it } from "vitest";
import { createParadocRuntime } from "../../src/engine/paradoc-runtime";
import type { FormSession } from "../../src/engine/types";
import { execute } from "../../src/engine/execute";
import { project } from "../../src/event-log/projector";
import type { SessionEvent } from "../../src/event-log/types";

it("sessions-007: user revision of a prefilled field is user-sourced", () => {
  const runtime = createParadocRuntime(artifact({ fields: { name: { type: "text", required: true } } }));
  const s = session();
  s.events.push({ v: 1, t: "PrefillApplied", at: "2026-01-01T00:00:01.000Z", by: { kind: "system", reason: "prefill" }, values: { name: "Pre" }, sources: { name: "prefill" }, lockedPaths: [] } as SessionEvent);
  const r = execute(s, runtime, { kind: "revise", fieldPath: "name", value: "Mine", source: "user" }, { kind: "user" });
  expect(r.ok ? "ok" : r.code).toBe("ok");
  if (!r.ok) return;
  const a = project(r.session.events).answers.name;
  expect(a?.value).toBe("Mine");
  expect(a?.source).toBe("user");
});

export function artifact(extra: Record<string, unknown>) {
  return {
    $schema: "https://schema.paradoc.dev/2026-09-24.json", kind: "form", name: "v", version: "1.0.0", title: "V",
    parties: {}, fields: {},
    layers: { composition: { kind: "file", mimeType: "text/plain", path: "v.txt" } }, defaultLayer: "composition",
    ...extra,
  };
}
export function session(): FormSession {
  return { formSessionId: "fs", chatId: "c", artifactRef: { name: "v" }, events: [], createdAt: "2026-01-01T00:00:00.000Z" };
}
