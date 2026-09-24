// sessions-002: a required, unfilled annex is dropped by the core adapter.
// Input: artifact with required field `name` (answered) and required annex `proof`.
// Expected: phase is not "ready" while the annex is open. Actual: phase "ready".
import { expect, it } from "vitest";
import { createParadocRuntime } from "../../src/engine/paradoc-runtime";
import type { FormSession } from "../../src/engine/types";
import { execute } from "../../src/engine/execute";
import { deriveView } from "../../src/engine/derive";

it("sessions-002: required annex keeps the session out of ready", () => {
  const runtime = createParadocRuntime(artifact({ fields: { name: { type: "text", required: true } }, annexes: { proof: { required: true } } }));
  const r = execute(session(), runtime, { kind: "answer", fieldPath: "name", value: "Ada", source: "user" }, { kind: "user" });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(deriveView(r.session, runtime).phase).not.toBe("ready");
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
