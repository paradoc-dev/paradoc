// AUTO-GENERATED from artifacts/banking/ach-change-form/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-change-form

import { describe, it, expect } from "vitest";
import { achChangeForm } from "./ach-change-form.js";

const happyPathInputs = {
  "parties": {
    "originator": {
      "id": "originator-0",
      "name": "Test Party",
      "entityType": "llc"
    },
    "accountHolder": {
      "id": "accountHolder-0",
      "name": "Test Party",
      "legalName": "Test Party"
    }
  },
  "fields": {
    "accountHolderType": "organization",
    "accountHolderAddress": {
      "line1": "100 Test St",
      "locality": "TestCity",
      "region": "TS",
      "postalCode": "00000",
      "country": "US"
    },
    "accountHolderPhone": {
      "number": "+15555550100"
    },
    "accountHolderEmail": "test@example.com",
    "oldAccountLast4": "1111",
    "changeType": "update_account_info",
    "changeOtherDescription": "x",
    "newBankName": "x",
    "newRoutingNumber": "111111111",
    "newAccountNumber": "xxxx",
    "newAccountType": "checking",
    "newAmount": {
      "amount": 0.01,
      "currency": "USD"
    },
    "newFrequency": "weekly",
    "effectiveDate": "2024-01-01"
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
    "id": "synth.required.accountholderphone.not-required-accountholdertype-individual",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "accountHolder": {
          "id": "accountHolder-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "accountHolderType": "individual",
        "accountHolderAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "accountHolderEmail": "test@example.com",
        "oldAccountLast4": "1111",
        "changeType": "update_account_info",
        "changeOtherDescription": "x",
        "newBankName": "x",
        "newRoutingNumber": "111111111",
        "newAccountNumber": "xxxx",
        "newAccountType": "checking",
        "newAmount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "newFrequency": "weekly",
        "effectiveDate": "2024-01-01"
      }
    },
    "expected": {
      "validation": "pass"
    }
  },
  {
    "id": "synth.enum.accountholdertype.invalid",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "accountHolder": {
          "id": "accountHolder-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "accountHolderType": "__invalid__",
        "accountHolderAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "accountHolderPhone": {
          "number": "+15555550100"
        },
        "accountHolderEmail": "test@example.com",
        "oldAccountLast4": "1111",
        "changeType": "update_account_info",
        "changeOtherDescription": "x",
        "newBankName": "x",
        "newRoutingNumber": "111111111",
        "newAccountNumber": "xxxx",
        "newAccountType": "checking",
        "newAmount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "newFrequency": "weekly",
        "effectiveDate": "2024-01-01"
      }
    },
    "expected": {
      "validation": "fail"
    }
  },
  {
    "id": "synth.required.accountholderphone.missing-accountholdertype-organization",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "accountHolder": {
          "id": "accountHolder-0",
          "name": "Test Party",
          "legalName": "Test Party"
        }
      },
      "fields": {
        "accountHolderType": "organization",
        "accountHolderAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "accountHolderEmail": "test@example.com",
        "oldAccountLast4": "1111",
        "changeType": "update_account_info",
        "changeOtherDescription": "x",
        "newBankName": "x",
        "newRoutingNumber": "111111111",
        "newAccountNumber": "xxxx",
        "newAccountType": "checking",
        "newAmount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "newFrequency": "weekly",
        "effectiveDate": "2024-01-01"
      }
    },
    "expected": {
      "state": {
        "fieldId": "accountHolderPhone",
        "required": true
      }
    }
  },
  {
    "id": "synth.visible.changeotherdescription.on-changetype-other",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "accountHolder": {
          "id": "accountHolder-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "accountHolderType": "individual",
        "accountHolderAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "accountHolderPhone": {
          "number": "+15555550100"
        },
        "accountHolderEmail": "test@example.com",
        "oldAccountLast4": "1111",
        "changeType": "other",
        "changeOtherDescription": "x",
        "newBankName": "x",
        "newRoutingNumber": "111111111",
        "newAccountNumber": "xxxx",
        "newAccountType": "checking",
        "newAmount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "newFrequency": "weekly",
        "effectiveDate": "2024-01-01"
      }
    },
    "expected": {
      "state": {
        "fieldId": "changeOtherDescription",
        "visible": true
      }
    }
  },
  {
    "id": "synth.visible.changeotherdescription.off-changetype-update-account-info",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "accountHolder": {
          "id": "accountHolder-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "accountHolderType": "individual",
        "accountHolderAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "accountHolderPhone": {
          "number": "+15555550100"
        },
        "accountHolderEmail": "test@example.com",
        "oldAccountLast4": "1111",
        "changeType": "update_account_info",
        "changeOtherDescription": "x",
        "newBankName": "x",
        "newRoutingNumber": "111111111",
        "newAccountNumber": "xxxx",
        "newAccountType": "checking",
        "newAmount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "newFrequency": "weekly",
        "effectiveDate": "2024-01-01"
      }
    },
    "expected": {
      "state": {
        "fieldId": "changeOtherDescription",
        "visible": false
      }
    }
  }
];

describe("ach-change-form", () => {
  it("loads via p.form()", () => {
    expect(achChangeForm.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (synth.required.accountholderphone.present-accountholdertype-organization)", () => {
    const result = achChangeForm.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  describe("representative canonical vectors", () => {
    for (const vector of regressionVectors) {
      it(vector.id, () => {
        const result = achChangeForm.safeFill(vector.inputs as any);
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
    const result = achChangeForm.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("still renders after a mutator reconstructs the form", async () => {
    const result = achChangeForm.safeFill(happyPathInputs as any);
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
    const result = achChangeForm.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const output = await result.data.render({ layer: "pdf" });
    expect(output).toBeInstanceOf(Uint8Array);
    if (!(output instanceof Uint8Array)) throw new Error("PDF renderer should return bytes");
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe("%PDF");
  });
});
