// AUTO-GENERATED from artifacts/tax/w-9/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only tax/w-9

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
import { w9 } from "./w-9.js";

const happyPathInputs = {
  "parties": {
    "taxpayer": {
      "id": "taxpayer-0",
      "name": "Jane Q. Public"
    }
  },
  "fields": {
    "taxClassification": "individual_or_sole_proprietor",
    "ssn": "123-45-6789",
    "mailingAddress": {
      "line1": "1 Main St",
      "locality": "Springfield",
      "region": "IL",
      "postalCode": "62704",
      "country": "US"
    }
  }
} as const;

describe("w-9", () => {
  it("loads via para.form()", () => {
    expect(w9.isValid()).toBe(true);
  });

  it("accepts the bundled happy-path vector (llm.tin.individual-with-ssn-only)", () => {
    const parsed = w9.safeParseData(happyPathInputs as any);
    expect(parsed.success).toBe(true);
  });

  it("renders the markdown layer with the bundled resolver", async () => {
    const parsed = w9.safeParseData(happyPathInputs as any);
    if (!parsed.success) throw new Error("happy-path vector should parse");
    const filled = w9.fill(parsed.data, { rules: false });
    const output = await filled.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
