// AUTO-GENERATED from artifacts/banking/ach-direct-deposit/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-direct-deposit

import { describe, it, expect } from "vitest";
import { achDirectDeposit } from "./ach-direct-deposit.js";

const happyPathInputs = {
  "parties": {
    "employer": {
      "id": "employer-0",
      "legalName": "Acme Corp",
      "name": "Acme"
    },
    "employee": {
      "id": "employee-0",
      "name": "Jane Doe",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  },
  "fields": {
    "employeeAddress": {
      "line1": "5 Main St",
      "locality": "Boston",
      "region": "MA",
      "postalCode": "02101",
      "country": "US"
    },
    "actionType": "new",
    "account1BankName": "First Bank",
    "account1RoutingNumber": "111000025",
    "account1AccountNumber": "1234567890",
    "account1AccountType": "checking",
    "account1AllotmentType": "net_remainder",
    "account1VoidedCheckAttached": true
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
    "id": "llm.scenario.new-two-account-split-fixed-plus-remainder",
    "inputs": {
      "parties": {
        "employer": {
          "id": "employer-0",
          "legalName": "Acme Corp",
          "name": "Acme"
        },
        "employee": {
          "id": "employee-0",
          "name": "Jane Doe",
          "firstName": "Jane",
          "lastName": "Doe"
        }
      },
      "fields": {
        "employeeAddress": {
          "line1": "5 Main St",
          "locality": "Boston",
          "region": "MA",
          "postalCode": "02101",
          "country": "US"
        },
        "actionType": "new",
        "account1BankName": "First Bank",
        "account1RoutingNumber": "111000025",
        "account1AccountNumber": "1234567890",
        "account1AccountType": "checking",
        "account1AllotmentType": "net_remainder",
        "account2Enabled": true,
        "account2BankName": "Vanguard",
        "account2RoutingNumber": "031176110",
        "account2AccountNumber": "9876543210",
        "account2AccountType": "savings",
        "account2AllotmentType": "fixed_amount",
        "account2Amount": {
          "amount": 200,
          "currency": "USD"
        }
      }
    },
    "expected": {
      "validation": "pass"
    }
  },
  {
    "id": "llm.rule.percentSumWithinHundred.violate-over-100",
    "inputs": {
      "parties": {
        "employer": {
          "id": "employer-0",
          "legalName": "Acme Corp",
          "name": "Acme"
        },
        "employee": {
          "id": "employee-0",
          "name": "Jane Doe",
          "firstName": "Jane",
          "lastName": "Doe"
        }
      },
      "fields": {
        "employeeAddress": {
          "line1": "5 Main St",
          "locality": "Boston",
          "region": "MA",
          "postalCode": "02101",
          "country": "US"
        },
        "actionType": "new",
        "account1BankName": "First Bank",
        "account1RoutingNumber": "111000025",
        "account1AccountNumber": "1234567890",
        "account1AccountType": "checking",
        "account1AllotmentType": "percent",
        "account1Percent": 70,
        "account2Enabled": true,
        "account2BankName": "First Bank",
        "account2RoutingNumber": "111000025",
        "account2AccountNumber": "1234567891",
        "account2AccountType": "savings",
        "account2AllotmentType": "percent",
        "account2Percent": 50,
        "account3Enabled": true,
        "account3BankName": "First Bank",
        "account3RoutingNumber": "111000025",
        "account3AccountNumber": "1234567892",
        "account3AccountType": "checking",
        "account3AllotmentType": "net_remainder"
      }
    },
    "expected": {
      "validation": "fail",
      "rules": {
        "percentSumWithinHundred": "fail"
      }
    }
  },
  {
    "id": "synth.rule.exactlyonenetremainder.violate-account1allotmenttype-percent-account2allotmenttype-fixed-amount-account2enabled-false-account3allotmenttype-fixed-amount-account3enabled-true-account4allotmenttype-net-remainder-account4enabled-false",
    "inputs": {
      "parties": {
        "employer": {
          "id": "employer-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "employee": {
          "id": "employee-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "employeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "actionType": "new",
        "account1BankName": "x",
        "account1RoutingNumber": "111111111",
        "account1AccountNumber": "xxxx",
        "account1AccountType": "checking",
        "account1AllotmentType": "percent",
        "account1Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account1Percent": 1,
        "account2BankName": "x",
        "account2RoutingNumber": "111111111",
        "account2AccountNumber": "xxxx",
        "account2AccountType": "checking",
        "account2AllotmentType": "fixed_amount",
        "account2Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account2Percent": 1,
        "account3BankName": "x",
        "account3RoutingNumber": "111111111",
        "account3AccountNumber": "xxxx",
        "account3AccountType": "checking",
        "account3AllotmentType": "fixed_amount",
        "account3Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account3Percent": 1,
        "account4BankName": "x",
        "account4RoutingNumber": "111111111",
        "account4AccountNumber": "xxxx",
        "account4AccountType": "checking",
        "account4AllotmentType": "net_remainder",
        "account4Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account4Percent": 1,
        "account2Enabled": false,
        "account3Enabled": true,
        "account4Enabled": false
      }
    },
    "expected": {
      "validation": "fail",
      "rules": {
        "exactlyOneNetRemainder": "fail"
      }
    }
  },
  {
    "id": "synth.required.account1bankname.missing-actiontype-new",
    "inputs": {
      "parties": {
        "employer": {
          "id": "employer-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "employee": {
          "id": "employee-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "employeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "actionType": "new",
        "account1RoutingNumber": "111111111",
        "account1AccountNumber": "xxxx",
        "account1AccountType": "checking",
        "account1AllotmentType": "fixed_amount",
        "account1Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account1Percent": 1,
        "account2BankName": "x",
        "account2RoutingNumber": "111111111",
        "account2AccountNumber": "xxxx",
        "account2AccountType": "checking",
        "account2AllotmentType": "fixed_amount",
        "account2Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account2Percent": 1,
        "account3BankName": "x",
        "account3RoutingNumber": "111111111",
        "account3AccountNumber": "xxxx",
        "account3AccountType": "checking",
        "account3AllotmentType": "fixed_amount",
        "account3Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account3Percent": 1,
        "account4BankName": "x",
        "account4RoutingNumber": "111111111",
        "account4AccountNumber": "xxxx",
        "account4AccountType": "checking",
        "account4AllotmentType": "fixed_amount",
        "account4Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account4Percent": 1
      }
    },
    "expected": {
      "state": {
        "fieldId": "account1BankName",
        "required": true
      }
    }
  },
  {
    "id": "synth.visible.account1amount.on-account1allotmenttype-fixed-amount-actiontype-new",
    "inputs": {
      "parties": {
        "employer": {
          "id": "employer-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "employee": {
          "id": "employee-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "employeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "actionType": "new",
        "account1BankName": "x",
        "account1RoutingNumber": "111111111",
        "account1AccountNumber": "xxxx",
        "account1AccountType": "checking",
        "account1AllotmentType": "fixed_amount",
        "account1Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account1Percent": 1,
        "account2BankName": "x",
        "account2RoutingNumber": "111111111",
        "account2AccountNumber": "xxxx",
        "account2AccountType": "checking",
        "account2AllotmentType": "fixed_amount",
        "account2Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account2Percent": 1,
        "account3BankName": "x",
        "account3RoutingNumber": "111111111",
        "account3AccountNumber": "xxxx",
        "account3AccountType": "checking",
        "account3AllotmentType": "fixed_amount",
        "account3Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account3Percent": 1,
        "account4BankName": "x",
        "account4RoutingNumber": "111111111",
        "account4AccountNumber": "xxxx",
        "account4AccountType": "checking",
        "account4AllotmentType": "fixed_amount",
        "account4Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account4Percent": 1
      }
    },
    "expected": {
      "state": {
        "fieldId": "account1Amount",
        "visible": true
      }
    }
  },
  {
    "id": "synth.visible.account1amount.off-account1allotmenttype-null-actiontype-new",
    "inputs": {
      "parties": {
        "employer": {
          "id": "employer-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "employee": {
          "id": "employee-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "employeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "actionType": "new",
        "account1BankName": "x",
        "account1RoutingNumber": "111111111",
        "account1AccountNumber": "xxxx",
        "account1AccountType": "checking",
        "account1Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account1Percent": 1,
        "account2BankName": "x",
        "account2RoutingNumber": "111111111",
        "account2AccountNumber": "xxxx",
        "account2AccountType": "checking",
        "account2AllotmentType": "fixed_amount",
        "account2Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account2Percent": 1,
        "account3BankName": "x",
        "account3RoutingNumber": "111111111",
        "account3AccountNumber": "xxxx",
        "account3AccountType": "checking",
        "account3AllotmentType": "fixed_amount",
        "account3Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account3Percent": 1,
        "account4BankName": "x",
        "account4RoutingNumber": "111111111",
        "account4AccountNumber": "xxxx",
        "account4AccountType": "checking",
        "account4AllotmentType": "fixed_amount",
        "account4Amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "account4Percent": 1
      }
    },
    "expected": {
      "state": {
        "fieldId": "account1Amount",
        "visible": false
      }
    }
  }
];

describe("ach-direct-deposit", () => {
  it("loads via para.form()", () => {
    expect(achDirectDeposit.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (llm.scenario.new-single-account-net)", () => {
    const result = achDirectDeposit.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  describe("representative canonical vectors", () => {
    for (const vector of regressionVectors) {
      it(vector.id, () => {
        const result = achDirectDeposit.safeFill(vector.inputs as any);
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
    const result = achDirectDeposit.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("still renders after a mutator reconstructs the form", async () => {
    const result = achDirectDeposit.safeFill(happyPathInputs as any);
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
    const result = achDirectDeposit.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const output = await result.data.render({ layer: "pdf" });
    expect(output).toBeInstanceOf(Uint8Array);
    if (!(output instanceof Uint8Array)) throw new Error("PDF renderer should return bytes");
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe("%PDF");
  });
});
