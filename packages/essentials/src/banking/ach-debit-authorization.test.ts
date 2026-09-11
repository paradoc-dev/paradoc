// AUTO-GENERATED from artifacts/banking/ach-debit-authorization/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-debit-authorization

import { describe, it, expect } from "vitest";
import { achDebitAuthorization } from "./ach-debit-authorization.js";

const happyPathInputs = {
  "parties": {
    "originator": {
      "id": "originator-0",
      "legalName": "Acme Lending LLC",
      "name": "Acme"
    },
    "payer": {
      "id": "payer-0",
      "name": "Jane Doe",
      "firstName": "Jane",
      "lastName": "Doe"
    }
  },
  "fields": {
    "originatorAddress": {
      "line1": "1 Acme Way",
      "locality": "NYC",
      "region": "NY",
      "postalCode": "10001",
      "country": "US"
    },
    "originatorPhone": {
      "number": "+12125550100"
    },
    "originatorEmail": "ach@acme.example",
    "payerType": "individual",
    "payerAddress": {
      "line1": "5 Main St",
      "locality": "Boston",
      "region": "MA",
      "postalCode": "02101",
      "country": "US"
    },
    "payerPhone": {
      "number": "+16175550123"
    },
    "payerEmail": "jane@example.com",
    "payerBankName": "First Bank",
    "accountType": "checking",
    "payerRoutingNumber": "111000025",
    "payerAccountNumber": "1234567890",
    "voidedCheckAttached": true,
    "paymentMode": "one_time",
    "amount": {
      "amount": 100,
      "currency": "USD"
    },
    "paymentDate": "2026-06-15",
    "paymentMemo": "Loan payment June 2026",
    "referenceNumber": "LN-12345"
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
    "id": "llm.scenario.recurring-monthly-fixed-individual",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "legalName": "Acme Lending LLC",
          "name": "Acme"
        },
        "payer": {
          "id": "payer-0",
          "name": "Jane Doe",
          "firstName": "Jane",
          "lastName": "Doe"
        }
      },
      "fields": {
        "originatorAddress": {
          "line1": "1 Acme Way",
          "locality": "NYC",
          "region": "NY",
          "postalCode": "10001",
          "country": "US"
        },
        "originatorPhone": {
          "number": "+12125550100"
        },
        "originatorEmail": "ach@acme.example",
        "payerType": "individual",
        "payerAddress": {
          "line1": "5 Main St",
          "locality": "Boston",
          "region": "MA",
          "postalCode": "02101",
          "country": "US"
        },
        "payerPhone": {
          "number": "+16175550123"
        },
        "payerEmail": "jane@example.com",
        "payerBankName": "First Bank",
        "accountType": "checking",
        "payerRoutingNumber": "111000025",
        "payerAccountNumber": "1234567890",
        "voidedCheckAttached": true,
        "paymentMode": "recurring",
        "amount": {
          "amount": 50,
          "currency": "USD"
        },
        "amountMode": "fixed",
        "frequency": "monthly",
        "dayOfMonth": 15,
        "startDate": "2026-06-15",
        "endCondition": "until_cancelled",
        "referenceNumber": "LN-12345"
      }
    },
    "expected": {
      "validation": "pass"
    }
  },
  {
    "id": "llm.rule.amountRangeOrder.violate-max-lt-min",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "legalName": "Acme Lending LLC",
          "name": "Acme"
        },
        "payer": {
          "id": "payer-0",
          "name": "Jane Doe",
          "firstName": "Jane",
          "lastName": "Doe"
        }
      },
      "fields": {
        "originatorAddress": {
          "line1": "1 Acme Way",
          "locality": "NYC",
          "region": "NY",
          "postalCode": "10001",
          "country": "US"
        },
        "originatorPhone": {
          "number": "+12125550100"
        },
        "originatorEmail": "ach@acme.example",
        "payerType": "individual",
        "payerAddress": {
          "line1": "5 Main St",
          "locality": "Boston",
          "region": "MA",
          "postalCode": "02101",
          "country": "US"
        },
        "payerPhone": {
          "number": "+16175550123"
        },
        "payerEmail": "jane@example.com",
        "payerBankName": "First Bank",
        "accountType": "checking",
        "payerRoutingNumber": "111000025",
        "payerAccountNumber": "1234567890",
        "voidedCheckAttached": true,
        "paymentMode": "recurring",
        "amountMode": "variable",
        "amountRangeMin": {
          "amount": 200,
          "currency": "USD"
        },
        "amountRangeMax": {
          "amount": 50,
          "currency": "USD"
        },
        "amountSource": "monthly invoice",
        "frequency": "monthly",
        "dayOfMonth": 15,
        "startDate": "2026-06-01",
        "endCondition": "until_cancelled"
      }
    },
    "expected": {
      "validation": "fail",
      "rules": {
        "amountRangeOrder": "fail"
      }
    }
  },
  {
    "id": "llm.rule.semiMonthlyDistinct.violate-same-day",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "legalName": "Acme Lending LLC",
          "name": "Acme"
        },
        "payer": {
          "id": "payer-0",
          "name": "Jane Doe",
          "firstName": "Jane",
          "lastName": "Doe"
        }
      },
      "fields": {
        "originatorAddress": {
          "line1": "1 Acme Way",
          "locality": "NYC",
          "region": "NY",
          "postalCode": "10001",
          "country": "US"
        },
        "originatorPhone": {
          "number": "+12125550100"
        },
        "originatorEmail": "ach@acme.example",
        "payerType": "individual",
        "payerAddress": {
          "line1": "5 Main St",
          "locality": "Boston",
          "region": "MA",
          "postalCode": "02101",
          "country": "US"
        },
        "payerPhone": {
          "number": "+16175550123"
        },
        "payerEmail": "jane@example.com",
        "payerBankName": "First Bank",
        "accountType": "checking",
        "payerRoutingNumber": "111000025",
        "payerAccountNumber": "1234567890",
        "voidedCheckAttached": true,
        "paymentMode": "recurring",
        "amount": {
          "amount": 100,
          "currency": "USD"
        },
        "amountMode": "fixed",
        "frequency": "semi_monthly",
        "semiMonthlyDay1": 15,
        "semiMonthlyDay2": 15,
        "startDate": "2026-06-01",
        "endCondition": "until_cancelled"
      }
    },
    "expected": {
      "validation": "fail",
      "rules": {
        "semiMonthlyDistinct": "fail"
      }
    }
  },
  {
    "id": "synth.required.payerphone.missing-payertype-organization",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "payer": {
          "id": "payer-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "originatorAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payerType": "organization",
        "payerAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payerEmail": "test@example.com",
        "payerBankName": "x",
        "accountType": "checking",
        "payerRoutingNumber": "111111111",
        "payerAccountNumber": "xxxx",
        "paymentMode": "one_time",
        "amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "paymentDate": "2024-01-01",
        "amountMode": "fixed",
        "frequency": "weekly",
        "startDate": "2024-01-01",
        "amountSource": "x",
        "dayOfMonth": 1,
        "semiMonthlyDay1": 1,
        "semiMonthlyDay2": 1,
        "dayOfWeek": "monday",
        "quarterMonth": "first",
        "quarterDay": 1,
        "annualMonth": "january",
        "annualDay": 1,
        "frequencyOther": "x",
        "endCondition": "until_cancelled",
        "endDate": "2024-01-01",
        "debitCount": 1
      }
    },
    "expected": {
      "state": {
        "fieldId": "payerPhone",
        "required": true
      }
    }
  },
  {
    "id": "synth.visible.amount.on-amountmode-null-paymentmode-one-time",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "payer": {
          "id": "payer-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "originatorAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payerType": "individual",
        "payerAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payerPhone": {
          "number": "+15555550100"
        },
        "payerEmail": "test@example.com",
        "payerBankName": "x",
        "accountType": "checking",
        "payerRoutingNumber": "111111111",
        "payerAccountNumber": "xxxx",
        "paymentMode": "one_time",
        "amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "paymentDate": "2024-01-01",
        "frequency": "weekly",
        "startDate": "2024-01-01",
        "amountSource": "x",
        "dayOfMonth": 1,
        "semiMonthlyDay1": 1,
        "semiMonthlyDay2": 1,
        "dayOfWeek": "monday",
        "quarterMonth": "first",
        "quarterDay": 1,
        "annualMonth": "january",
        "annualDay": 1,
        "frequencyOther": "x",
        "endCondition": "until_cancelled",
        "endDate": "2024-01-01",
        "debitCount": 1
      }
    },
    "expected": {
      "state": {
        "fieldId": "amount",
        "visible": true
      }
    }
  },
  {
    "id": "synth.visible.amount.off-amountmode-null-paymentmode-recurring",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "payer": {
          "id": "payer-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        }
      },
      "fields": {
        "originatorAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payerType": "individual",
        "payerAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payerPhone": {
          "number": "+15555550100"
        },
        "payerEmail": "test@example.com",
        "payerBankName": "x",
        "accountType": "checking",
        "payerRoutingNumber": "111111111",
        "payerAccountNumber": "xxxx",
        "paymentMode": "recurring",
        "amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "paymentDate": "2024-01-01",
        "frequency": "weekly",
        "startDate": "2024-01-01",
        "amountSource": "x",
        "dayOfMonth": 1,
        "semiMonthlyDay1": 1,
        "semiMonthlyDay2": 1,
        "dayOfWeek": "monday",
        "quarterMonth": "first",
        "quarterDay": 1,
        "annualMonth": "january",
        "annualDay": 1,
        "frequencyOther": "x",
        "endCondition": "until_cancelled",
        "endDate": "2024-01-01",
        "debitCount": 1
      }
    },
    "expected": {
      "state": {
        "fieldId": "amount",
        "visible": false
      }
    }
  }
];

describe("ach-debit-authorization", () => {
  it("loads via p.form()", () => {
    expect(achDebitAuthorization.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (llm.scenario.one-time-individual-happy-path)", () => {
    const result = achDebitAuthorization.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  describe("representative canonical vectors", () => {
    for (const vector of regressionVectors) {
      it(vector.id, () => {
        const result = achDebitAuthorization.safeFill(vector.inputs as any);
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
    const result = achDebitAuthorization.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("still renders after a mutator reconstructs the form", async () => {
    const result = achDebitAuthorization.safeFill(happyPathInputs as any);
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
    const result = achDebitAuthorization.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const output = await result.data.render({ layer: "pdf" });
    expect(output).toBeInstanceOf(Uint8Array);
    if (!(output instanceof Uint8Array)) throw new Error("PDF renderer should return bytes");
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe("%PDF");
  });
});
