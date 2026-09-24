// sessions-006: phone coercion adds +1 to any 10-digit number and + to any national number.
// Input: "9876543210" (Indian mobile), "020 7946 0958" (UK national).
// Expected: not stored as a different country's number. Actual: "+19876543210" accepted. The UK case is rejected by the E.164 pattern (not a silent bug).
import { expect, it } from "vitest";
import { createParadocRuntime } from "../../src/engine/paradoc-runtime";

const rt = () => createParadocRuntime(artifact({ fields: { tel: { type: "phone" } } }));

it("sessions-006: 10-digit number without a country code is not assumed US", () => {
  const r = rt().validateField("tel", "9876543210");
  expect(r.ok ? (r.value as { number: string }).number : "rejected").not.toBe("+19876543210");
});
it("sessions-006: national number with a trunk 0 is not turned into +0...", () => {
  const r = rt().validateField("tel", "020 7946 0958");
  expect(r.ok ? (r.value as { number: string }).number : "rejected").not.toBe("+02079460958");
});

export function artifact(extra: Record<string, unknown>) {
  return {
    $schema: "https://schema.paradoc.dev/2026-09-24.json", kind: "form", name: "v", version: "1.0.0", title: "V",
    parties: {}, fields: {},
    layers: { composition: { kind: "file", mimeType: "text/plain", path: "v.txt" } }, defaultLayer: "composition",
    ...extra,
  };
}