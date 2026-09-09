// AUTO-GENERATED from artifacts/banking/ach-bank-account-info/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-bank-account-info

import { describe, it, expect } from "vitest";
import { achBankAccountInfo } from "./ach-bank-account-info.js";

const happyPathInputs = {
  "parties": {
    "requestor": {
      "id": "requestor-0",
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
    "actionType": "new",
    "accountHolderType": "organization",
    "orgEntityType": "sole_prop",
    "bankName": "x",
    "routingNumber": "111111111",
    "accountNumber": "xxxx",
    "accountType": "checking"
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
    "id": "synth.required.orgentitytype.not-required-accountholdertype-individual",
    "inputs": {
      "parties": {
        "requestor": {
          "id": "requestor-0",
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
        "actionType": "new",
        "accountHolderType": "individual",
        "bankName": "x",
        "routingNumber": "111111111",
        "accountNumber": "xxxx",
        "accountType": "checking"
      }
    },
    "expected": {
      "validation": "pass"
    }
  },
  {
    "id": "synth.enum.actiontype.invalid",
    "inputs": {
      "parties": {
        "requestor": {
          "id": "requestor-0",
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
        "actionType": "__invalid__",
        "accountHolderType": "individual",
        "orgEntityType": "sole_prop",
        "bankName": "x",
        "routingNumber": "111111111",
        "accountNumber": "xxxx",
        "accountType": "checking"
      }
    },
    "expected": {
      "validation": "fail"
    }
  },
  {
    "id": "synth.rule.individualfieldsonlywhenindividual.violate-accountholdertype-organization-individualemail-null-individualphone-null-individualssn-111-22-3333",
    "inputs": {
      "parties": {
        "requestor": {
          "id": "requestor-0",
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
        "actionType": "new",
        "accountHolderType": "organization",
        "orgEntityType": "sole_prop",
        "bankName": "x",
        "routingNumber": "111111111",
        "accountNumber": "xxxx",
        "accountType": "checking",
        "individualSsn": "111-22-3333"
      }
    },
    "expected": {
      "validation": "pass",
      "rules": {
        "individualFieldsOnlyWhenIndividual": "fail"
      }
    }
  },
  {
    "id": "synth.required.orgentitytype.missing-accountholdertype-organization",
    "inputs": {
      "parties": {
        "requestor": {
          "id": "requestor-0",
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
        "actionType": "new",
        "accountHolderType": "organization",
        "bankName": "x",
        "routingNumber": "111111111",
        "accountNumber": "xxxx",
        "accountType": "checking"
      }
    },
    "expected": {
      "state": {
        "fieldId": "orgEntityType",
        "required": true
      }
    }
  },
  {
    "id": "synth.visible.individualssn.on-accountholdertype-individual",
    "inputs": {
      "parties": {
        "requestor": {
          "id": "requestor-0",
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
        "actionType": "new",
        "accountHolderType": "individual",
        "orgEntityType": "sole_prop",
        "bankName": "x",
        "routingNumber": "111111111",
        "accountNumber": "xxxx",
        "accountType": "checking",
        "individualSsn": "111-22-3333"
      }
    },
    "expected": {
      "state": {
        "fieldId": "individualSsn",
        "visible": true
      }
    }
  },
  {
    "id": "synth.visible.individualssn.off-accountholdertype-organization",
    "inputs": {
      "parties": {
        "requestor": {
          "id": "requestor-0",
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
        "actionType": "new",
        "accountHolderType": "organization",
        "orgEntityType": "sole_prop",
        "bankName": "x",
        "routingNumber": "111111111",
        "accountNumber": "xxxx",
        "accountType": "checking"
      }
    },
    "expected": {
      "state": {
        "fieldId": "individualSsn",
        "visible": false
      }
    }
  }
];

describe("ach-bank-account-info", () => {
  it("loads via para.form()", () => {
    expect(achBankAccountInfo.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (synth.required.orgentitytype.present-accountholdertype-organization)", () => {
    const result = achBankAccountInfo.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  describe("representative canonical vectors", () => {
    for (const vector of regressionVectors) {
      it(vector.id, () => {
        const result = achBankAccountInfo.safeFill(vector.inputs as any);
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
    const result = achBankAccountInfo.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("still renders after a mutator reconstructs the form", async () => {
    const result = achBankAccountInfo.safeFill(happyPathInputs as any);
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
    const result = achBankAccountInfo.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const output = await result.data.render({ layer: "pdf" });
    expect(output).toBeInstanceOf(Uint8Array);
    if (!(output instanceof Uint8Array)) throw new Error("PDF renderer should return bytes");
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe("%PDF");
  });
});
