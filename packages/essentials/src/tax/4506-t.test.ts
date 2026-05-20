// AUTO-GENERATED from artifacts/tax/4506-t/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only tax/4506-t

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
import { f4506T } from "./4506-t.js";

const happyPathInputs = {
  "parties": {
    "taxpayer": {
      "id": "taxpayer-0",
      "name": "Jane A Smith"
    },
    "spouse": {
      "id": "spouse-0",
      "name": "John B Smith"
    }
  },
  "fields": {
    "taxpayerTin": "123-45-6789",
    "spouseTin": "987-65-4321",
    "currentAddress": {
      "line1": "100 Main St",
      "locality": "Springfield",
      "region": "IL",
      "postalCode": "62704",
      "country": "US"
    },
    "transcriptType": "return_transcript",
    "taxFormNumber": "1040",
    "period1": "2024-12-31",
    "attestationAck": true
  }
} as const;

describe("4506-t", () => {
  it("loads via para.form()", () => {
    expect(f4506T.isValid()).toBe(true);
  });

  it("accepts the bundled happy-path vector (llm.joint-return-happy-path)", () => {
    const parsed = f4506T.safeParseData(happyPathInputs as any);
    expect(parsed.success).toBe(true);
  });

  it("renders the markdown layer with the bundled resolver", async () => {
    const parsed = f4506T.safeParseData(happyPathInputs as any);
    if (!parsed.success) throw new Error("happy-path vector should parse");
    const filled = f4506T.fill(parsed.data, { rules: false });
    const output = await filled.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
