// sessions-001: answering a party of a repeatable role (max: 3) makes the session permanently unresolved.
// Input: witness role max 3; answerParty index 0 (then index 1); also single role with index 1.
// Expected: view stays resolved and `answer name` succeeds; out-of-range index rejected.
// Actual: phase "unresolved", answer -> unresolved-state; index 1 on a single role accepted.
import { describe, expect, it } from "vitest";
import { createParadocRuntime } from "../../src/engine/paradoc-runtime";
import type { FormSession } from "../../src/engine/types";
import { execute } from "../../src/engine/execute";
import { deriveView } from "../../src/engine/derive";

const rt = () => createParadocRuntime(artifact({
  parties: { witness: { label: "Witness", partyType: "person", min: 0, max: 3 }, signer: { label: "Signer", partyType: "person" } },
  fields: { name: { type: "text", required: true } },
}));

describe("sessions-001", () => {
  it("repeatable role answered once keeps the session resolved", () => {
    const runtime = rt();
    const r = execute(session(), runtime, { kind: "answerParty", roleId: "witness", index: 0, value: { name: "Ada" }, source: "user" }, { kind: "user" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const view = deriveView(r.session, runtime);
    expect(view.phase).not.toBe("unresolved");
    const a = execute(r.session, runtime, { kind: "answer", fieldPath: "name", value: "X", source: "user" }, { kind: "user" });
    expect(a.ok ? "ok" : a.code).toBe("ok");
  });
  it("repeatable role answered at index 0 and 1 keeps the session resolved", () => {
    const runtime = rt();
    let s = session();
    for (const index of [0, 1]) {
      const r = execute(s, runtime, { kind: "answerParty", roleId: "witness", index, value: { name: `W${index}` }, source: "user" }, { kind: "user" });
      expect(r.ok).toBe(true);
      if (r.ok) s = r.session;
    }
    expect(deriveView(s, runtime).phase).not.toBe("unresolved");
  });
  it("single role rejects index 1", () => {
    const r = execute(session(), rt(), { kind: "answerParty", roleId: "signer", index: 1, value: { name: "Ada" }, source: "user" }, { kind: "user" });
    expect(r.ok).toBe(false);
  });
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
