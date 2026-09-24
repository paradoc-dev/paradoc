// sessions-004: date coercion stores a wrong date without an error.
// Input: dob "5"; dob "March 4, 2025". Run with TZ=Asia/Tokyo: the second case only fails east of UTC.
// Expected: "5" rejected (not a date); "March 4, 2025" -> 2025-03-04 or rejected. Actual: "2001-05-01"; "2025-03-03" in Tokyo.
import { expect, it } from "vitest";
import { createParadocRuntime } from "../../src/engine/paradoc-runtime";

const rt = () => createParadocRuntime(artifact({ fields: { dob: { type: "date" } } }));

it("sessions-004: bare number is not a date", () => {
  const r = rt().validateField("dob", "5");
  expect(r).toMatchObject({ ok: false });
});
it("sessions-004: long-form date keeps its calendar day in any time zone", () => {
  const r = rt().validateField("dob", "March 4, 2025");
  if (r.ok) expect(r.value).toBe("2025-03-04");
});

export function artifact(extra: Record<string, unknown>) {
  return {
    $schema: "https://schema.paradoc.dev/2026-09-24.json", kind: "form", name: "v", version: "1.0.0", title: "V",
    parties: {}, fields: {},
    layers: { composition: { kind: "file", mimeType: "text/plain", path: "v.txt" } }, defaultLayer: "composition",
    ...extra,
  };
}