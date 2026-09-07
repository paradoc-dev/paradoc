// AUTO-GENERATED from artifacts/tax/4506-t/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only tax/4506-t

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
import { f4506T } from "./4506-t.js";

const happyPathInputs = {
  "parties": {
    "taxpayer": {
      "id": "taxpayer-0",
      "name": "Jane A Smith",
      "firstName": "Jane",
      "lastName": "Smith",
      "middleName": "A"
    },
    "spouse": {
      "id": "spouse-0",
      "name": "John B Smith",
      "firstName": "John",
      "lastName": "Smith",
      "middleName": "B"
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

  it("accepts the bundled passing vector (llm.joint-return-happy-path)", () => {
    const result = f4506T.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  it("renders the markdown layer on the bound resolver", async () => {
    const result = f4506T.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("still renders after a mutator reconstructs the form", async () => {
    const result = f4506T.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const mutated = result.data
      .addSigner("bound-resolver-check", { person: { name: "Bound Resolver Check" } });
    const output = await mutated.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
