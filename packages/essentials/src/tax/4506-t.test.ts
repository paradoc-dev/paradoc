// AUTO-GENERATED from artifacts/tax/4506-t/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only tax/4506-t

import { describe, it, expect } from "vitest";
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

const regressionVectors: Array<{
  id: string;
  inputs: unknown;
  expected: {
    validation?: "pass" | "fail";
    state?: { fieldId: string; visible?: boolean; required?: boolean; complete?: boolean };
    rules?: Record<string, "pass" | "fail">;
  };
}> = [
  {
    "id": "llm.verification-of-nonfiling-no-taxformnumber",
    "inputs": {
      "parties": {
        "taxpayer": {
          "id": "taxpayer-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "taxpayerTin": "123-45-6789",
        "currentAddress": {
          "line1": "1 Example Way",
          "locality": "Springfield",
          "region": "IL",
          "postalCode": "62704",
          "country": "US"
        },
        "transcriptType": "verification_of_nonfiling",
        "period1": "2024-12-31",
        "attestationAck": true
      }
    },
    "expected": {
      "validation": "pass"
    }
  },
  {
    "id": "llm.customerfilenumber-over-max-length",
    "inputs": {
      "parties": {
        "taxpayer": {
          "id": "taxpayer-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "taxpayerTin": "123-45-6789",
        "currentAddress": {
          "line1": "1 Example Way",
          "locality": "Springfield",
          "region": "IL",
          "postalCode": "62704",
          "country": "US"
        },
        "customerFileNumber": "ABCD12345678",
        "transcriptType": "return_transcript",
        "taxFormNumber": "1040",
        "period1": "2024-12-31",
        "attestationAck": true
      }
    },
    "expected": {
      "validation": "fail"
    }
  },
  {
    "id": "synth.rule.taxpayertindistinctfromspouse.violate-spousetin-111-22-3333-taxpayertin-111-22-3333",
    "inputs": {
      "parties": {
        "taxpayer": {
          "id": "taxpayer-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        },
        "spouse": {
          "id": "spouse-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "taxpayerTin": "111-22-3333",
        "transcriptType": "return_transcript",
        "taxFormNumber": "x",
        "period1": "2024-01-01",
        "attestationAck": false,
        "spouseTin": "111-22-3333"
      }
    },
    "expected": {
      "validation": "pass",
      "rules": {
        "taxpayerTinDistinctFromSpouse": "fail"
      }
    }
  },
  {
    "id": "synth.required.taxformnumber.missing-transcripttype-return-transcript",
    "inputs": {
      "parties": {
        "taxpayer": {
          "id": "taxpayer-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        },
        "spouse": {
          "id": "spouse-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "taxpayerTin": "111-22-3333",
        "transcriptType": "return_transcript",
        "period1": "2024-01-01",
        "attestationAck": false
      }
    },
    "expected": {
      "state": {
        "fieldId": "taxFormNumber",
        "required": true
      }
    }
  }
];

describe("4506-t", () => {
  it("loads via p.form()", () => {
    expect(f4506T.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (llm.joint-return-happy-path)", () => {
    const result = f4506T.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  describe("representative canonical vectors", () => {
    for (const vector of regressionVectors) {
      it(vector.id, () => {
        const result = f4506T.safeFill(vector.inputs as any);
        const expectedValidation = vector.expected?.validation;
        const expectedState = "state" in vector.expected ? vector.expected.state : undefined;
        const expectedRules = "rules" in vector.expected ? vector.expected.rules : undefined;

        if (expectedValidation === "fail") {
          if (!result.success) {
            expect(result.success).toBe(false);
            return;
          }
          expect(result.data.validateRules().valid).toBe(false);
          return;
        }

        expect(result.success).toBe(true);
        if (!result.success) return;

        if (expectedState) {
          if ("visible" in expectedState) {
            expect(result.data.isFieldVisible(expectedState.fieldId)).toBe(expectedState.visible);
          }
          if ("required" in expectedState) {
            expect(result.data.isFieldRequired(expectedState.fieldId)).toBe(expectedState.required);
          }
          if ("complete" in expectedState) {
            expect(result.data.isValid()).toBe(expectedState.complete);
          }
        }

        if (expectedRules) {
          const rulesResult = result.data.validateRules();
          const fired = [...(rulesResult.errors ?? []), ...(rulesResult.warnings ?? [])];
          for (const [ruleId, outcome] of Object.entries(expectedRules)) {
            const didFire = fired.some((rule) => rule.ruleId === ruleId);
            if (outcome === "fail") expect(didFire, `expected rule ${ruleId} to fire`).toBe(true);
            if (outcome === "pass") expect(didFire, `expected rule ${ruleId} not to fire`).toBe(false);
          }
        }
      });
    }
  });

  it("renders the markdown layer on the bound resolver", async () => {
    const result = f4506T.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
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
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("renders the PDF layer through the default renderer", async () => {
    const result = f4506T.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const output = await result.data.render({ layer: "pdf" });
    expect(output).toBeInstanceOf(Uint8Array);
    if (!(output instanceof Uint8Array)) throw new Error("PDF renderer should return bytes");
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe("%PDF");
  });
});
