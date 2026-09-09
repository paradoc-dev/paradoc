// AUTO-GENERATED from artifacts/tax/w-9/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only tax/w-9

import { describe, it, expect } from "vitest";
import { w9 } from "./w-9.js";

const happyPathInputs = {
  "parties": {
    "taxpayer": {
      "id": "taxpayer-0",
      "name": "Jane Q. Public",
      "firstName": "Jane",
      "lastName": "Public",
      "middleName": "Q."
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
    "id": "llm.tin.individual-with-ein-only",
    "inputs": {
      "parties": {
        "taxpayer": {
          "id": "taxpayer-0",
          "name": "Sole Prop Sam",
          "firstName": "Sole",
          "lastName": "Sam",
          "middleName": "Prop"
        }
      },
      "fields": {
        "taxClassification": "individual_or_sole_proprietor",
        "ein": "12-3456789",
        "mailingAddress": {
          "line1": "1 Main St",
          "locality": "Springfield",
          "region": "IL",
          "postalCode": "62704",
          "country": "US"
        }
      }
    },
    "expected": {
      "validation": "pass",
      "rules": {
        "nonEntityNeedsOneTin": "pass",
        "entityMustUseEin": "pass"
      }
    }
  },
  {
    "id": "llm.tin.individual-with-both",
    "inputs": {
      "parties": {
        "taxpayer": {
          "id": "taxpayer-0",
          "name": "Jane Q. Public",
          "firstName": "Jane",
          "lastName": "Public",
          "middleName": "Q."
        }
      },
      "fields": {
        "taxClassification": "individual_or_sole_proprietor",
        "ssn": "123-45-6789",
        "ein": "12-3456789",
        "mailingAddress": {
          "line1": "1 Main St",
          "locality": "Springfield",
          "region": "IL",
          "postalCode": "62704",
          "country": "US"
        }
      }
    },
    "expected": {
      "validation": "fail",
      "rules": {
        "nonEntityNeedsOneTin": "fail"
      }
    }
  },
  {
    "id": "llm.tin.individual-with-neither",
    "inputs": {
      "parties": {
        "taxpayer": {
          "id": "taxpayer-0",
          "name": "Jane Q. Public",
          "firstName": "Jane",
          "lastName": "Public",
          "middleName": "Q."
        }
      },
      "fields": {
        "taxClassification": "individual_or_sole_proprietor",
        "mailingAddress": {
          "line1": "1 Main St",
          "locality": "Springfield",
          "region": "IL",
          "postalCode": "62704",
          "country": "US"
        }
      }
    },
    "expected": {
      "validation": "fail",
      "rules": {
        "nonEntityNeedsOneTin": "fail"
      }
    }
  },
  {
    "id": "synth.required.llctype.missing-taxclassification-llc",
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
        "taxClassification": "llc",
        "otherDescription": "x",
        "mailingAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        }
      }
    },
    "expected": {
      "state": {
        "fieldId": "llcType",
        "required": true
      }
    }
  },
  {
    "id": "synth.visible.llctype.on-taxclassification-llc",
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
        "taxClassification": "llc",
        "llcType": "c",
        "otherDescription": "x",
        "mailingAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        }
      }
    },
    "expected": {
      "state": {
        "fieldId": "llcType",
        "visible": true
      }
    }
  },
  {
    "id": "synth.visible.llctype.off-taxclassification-individual-or-sole-proprietor",
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
        "taxClassification": "individual_or_sole_proprietor",
        "llcType": "c",
        "otherDescription": "x",
        "mailingAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        }
      }
    },
    "expected": {
      "state": {
        "fieldId": "llcType",
        "visible": false
      }
    }
  }
];

describe("w-9", () => {
  it("loads via para.form()", () => {
    expect(w9.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (llm.tin.individual-with-ssn-only)", () => {
    const result = w9.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  describe("representative canonical vectors", () => {
    for (const vector of regressionVectors) {
      it(vector.id, () => {
        const result = w9.safeFill(vector.inputs as any);
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
    const result = w9.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("still renders after a mutator reconstructs the form", async () => {
    const result = w9.safeFill(happyPathInputs as any);
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
    const result = w9.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const output = await result.data.render({ layer: "pdf" });
    expect(output).toBeInstanceOf(Uint8Array);
    if (!(output instanceof Uint8Array)) throw new Error("PDF renderer should return bytes");
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe("%PDF");
  });
});
