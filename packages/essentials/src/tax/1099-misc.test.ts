// AUTO-GENERATED from artifacts/tax/1099-misc/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only tax/1099-misc

import { describe, it, expect } from "vitest";
import { f1099MISC } from "./1099-misc.js";

const happyPathInputs = {
  "parties": {
    "payer": {
      "id": "payer-0",
      "name": "Acme Consulting LLC",
      "legalName": "Acme Consulting LLC"
    },
    "recipient": {
      "id": "recipient-0",
      "name": "Jane R. Smith",
      "firstName": "Jane",
      "lastName": "Smith",
      "middleName": "R."
    }
  },
  "fields": {
    "void": false,
    "corrected": false,
    "calendarYear": "2024",
    "payerAddress": {
      "line1": "100 Industrial Way",
      "line2": "Suite 200",
      "locality": "Springfield",
      "region": "IL",
      "postalCode": "62704",
      "country": "US"
    },
    "payerPhone": {
      "number": "+12175550142"
    },
    "payerTin": "12-3456789",
    "recipientTin": "987-65-4321",
    "recipientAddress": {
      "line1": "42 Elm Street",
      "locality": "Champaign",
      "region": "IL",
      "postalCode": "61820",
      "country": "US"
    },
    "accountNumber": "ACCT-2024-0042",
    "secondTinNotice": false,
    "rents": {
      "amount": 12000,
      "currency": "USD"
    },
    "fatcaFilingRequirement": false,
    "directSales5kOrMore": false,
    "state1TaxWithheld": {
      "amount": 250,
      "currency": "USD"
    },
    "state1PayerStateNo": "IL / 12-3456789",
    "state1Income": {
      "amount": 12000,
      "currency": "USD"
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
    "id": "llm.happy-path-business-recipient",
    "inputs": {
      "parties": {
        "payer": {
          "id": "payer-0",
          "name": "Acme Consulting LLC",
          "legalName": "Acme Consulting LLC"
        },
        "recipient": {
          "id": "recipient-0",
          "name": "Smith & Co Partners LLC",
          "legalName": "Smith & Co Partners LLC"
        }
      },
      "fields": {
        "void": false,
        "corrected": false,
        "calendarYear": "2024",
        "payerAddress": {
          "line1": "100 Industrial Way",
          "line2": "Suite 200",
          "locality": "Springfield",
          "region": "IL",
          "postalCode": "62704",
          "country": "US"
        },
        "payerPhone": {
          "number": "+12175550142"
        },
        "payerTin": "12-3456789",
        "recipientTin": "98-7654321",
        "recipientAddress": {
          "line1": "42 Elm Street",
          "locality": "Champaign",
          "region": "IL",
          "postalCode": "61820",
          "country": "US"
        },
        "secondTinNotice": false,
        "grossProceedsAttorney": {
          "amount": 50000,
          "currency": "USD"
        },
        "fatcaFilingRequirement": false,
        "directSales5kOrMore": false
      }
    },
    "expected": {
      "validation": "pass"
    }
  },
  {
    "id": "synth.rule.voidcorrectedexclusivity.violate-corrected-true-void-true",
    "inputs": {
      "parties": {
        "payer": {
          "id": "payer-0",
          "name": "Test Party",
          "legalName": "Test Party"
        },
        "recipient": {
          "id": "recipient-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "calendarYear": "1111",
        "payerAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payerTin": "111-22-3333",
        "recipientTin": "111-22-3333",
        "recipientAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "accountNumber": "x",
        "corrected": true,
        "void": true
      }
    },
    "expected": {
      "validation": "fail",
      "rules": {
        "voidCorrectedExclusivity": "fail"
      }
    }
  },
  {
    "id": "synth.required.accountnumber.missing-fatcafilingrequirement-true",
    "inputs": {
      "parties": {
        "payer": {
          "id": "payer-0",
          "name": "Test Party",
          "legalName": "Test Party"
        },
        "recipient": {
          "id": "recipient-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "calendarYear": "1111",
        "payerAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payerTin": "111-22-3333",
        "recipientTin": "111-22-3333",
        "recipientAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "fatcaFilingRequirement": true
      }
    },
    "expected": {
      "state": {
        "fieldId": "accountNumber",
        "required": true
      }
    }
  }
];

describe("1099-misc", () => {
  it("loads via para.form()", () => {
    expect(f1099MISC.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (llm.happy-path-individual-recipient)", () => {
    const result = f1099MISC.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  describe("representative canonical vectors", () => {
    for (const vector of regressionVectors) {
      it(vector.id, () => {
        const result = f1099MISC.safeFill(vector.inputs as any);
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
    const result = f1099MISC.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("still renders after a mutator reconstructs the form", async () => {
    const result = f1099MISC.safeFill(happyPathInputs as any);
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
    const result = f1099MISC.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const output = await result.data.render({ layer: "pdfCopyA" });
    expect(output).toBeInstanceOf(Uint8Array);
    if (!(output instanceof Uint8Array)) throw new Error("PDF renderer should return bytes");
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe("%PDF");
  });
});
