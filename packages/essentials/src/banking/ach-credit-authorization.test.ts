// AUTO-GENERATED from artifacts/banking/ach-credit-authorization/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-credit-authorization

import { describe, it, expect } from "vitest";
import { achCreditAuthorization } from "./ach-credit-authorization.js";

const happyPathInputs = {
  "parties": {
    "originator": {
      "id": "originator-0",
      "name": "Test Party",
      "entityType": "llc"
    },
    "payee": {
      "id": "payee-0",
      "name": "Test Party",
      "legalName": "Test Party"
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
    "payeeType": "organization",
    "payeeAddress": {
      "line1": "100 Test St",
      "locality": "TestCity",
      "region": "TS",
      "postalCode": "00000",
      "country": "US"
    },
    "payeePhone": {
      "number": "+15555550100"
    },
    "payeeEmail": "test@example.com",
    "payeeBankName": "x",
    "accountType": "checking",
    "payeeRoutingNumber": "111111111",
    "payeeAccountNumber": "xxxx",
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
    "creditCount": 1
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
    "id": "synth.required.payeephone.not-required-payeetype-individual",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "payee": {
          "id": "payee-0",
          "name": "Test Party",
          "legalName": "Test Party"
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
        "payeeType": "individual",
        "payeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payeeEmail": "test@example.com",
        "payeeBankName": "x",
        "accountType": "checking",
        "payeeRoutingNumber": "111111111",
        "payeeAccountNumber": "xxxx",
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
        "creditCount": 1
      }
    },
    "expected": {
      "validation": "pass"
    }
  },
  {
    "id": "synth.rule.enddateafterstart.violate-endcondition-end-date-enddate-2024-01-01-paymentmode-recurring-startdate-2024-01-01",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "payee": {
          "id": "payee-0",
          "name": "Test Party",
          "legalName": "Test Party"
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
        "payeeType": "individual",
        "payeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payeePhone": {
          "number": "+15555550100"
        },
        "payeeEmail": "test@example.com",
        "payeeBankName": "x",
        "accountType": "checking",
        "payeeRoutingNumber": "111111111",
        "payeeAccountNumber": "xxxx",
        "paymentMode": "recurring",
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
        "endCondition": "end_date",
        "endDate": "2024-01-01",
        "creditCount": 1
      }
    },
    "expected": {
      "validation": "fail",
      "rules": {
        "endDateAfterStart": "fail"
      }
    }
  },
  {
    "id": "synth.rule.semimonthlydistinct.violate-frequency-semi-monthly-paymentmode-recurring-semimonthlyday1-1-semimonthlyday2-1",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "payee": {
          "id": "payee-0",
          "name": "Test Party",
          "legalName": "Test Party"
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
        "payeeType": "individual",
        "payeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payeePhone": {
          "number": "+15555550100"
        },
        "payeeEmail": "test@example.com",
        "payeeBankName": "x",
        "accountType": "checking",
        "payeeRoutingNumber": "111111111",
        "payeeAccountNumber": "xxxx",
        "paymentMode": "recurring",
        "amount": {
          "amount": 0.01,
          "currency": "USD"
        },
        "paymentDate": "2024-01-01",
        "amountMode": "fixed",
        "frequency": "semi_monthly",
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
        "creditCount": 1
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
    "id": "synth.required.payeephone.missing-payeetype-organization",
    "inputs": {
      "parties": {
        "originator": {
          "id": "originator-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "payee": {
          "id": "payee-0",
          "name": "Test Party",
          "legalName": "Test Party"
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
        "payeeType": "organization",
        "payeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payeeEmail": "test@example.com",
        "payeeBankName": "x",
        "accountType": "checking",
        "payeeRoutingNumber": "111111111",
        "payeeAccountNumber": "xxxx",
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
        "creditCount": 1
      }
    },
    "expected": {
      "state": {
        "fieldId": "payeePhone",
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
        "payee": {
          "id": "payee-0",
          "name": "Test Party",
          "legalName": "Test Party"
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
        "payeeType": "individual",
        "payeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payeePhone": {
          "number": "+15555550100"
        },
        "payeeEmail": "test@example.com",
        "payeeBankName": "x",
        "accountType": "checking",
        "payeeRoutingNumber": "111111111",
        "payeeAccountNumber": "xxxx",
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
        "creditCount": 1
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
        "payee": {
          "id": "payee-0",
          "name": "Test Party",
          "legalName": "Test Party"
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
        "payeeType": "individual",
        "payeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "payeePhone": {
          "number": "+15555550100"
        },
        "payeeEmail": "test@example.com",
        "payeeBankName": "x",
        "accountType": "checking",
        "payeeRoutingNumber": "111111111",
        "payeeAccountNumber": "xxxx",
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
        "creditCount": 1
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

describe("ach-credit-authorization", () => {
  it("loads via p.form()", () => {
    expect(achCreditAuthorization.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (synth.required.payeephone.present-payeetype-organization)", () => {
    const result = achCreditAuthorization.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  describe("representative canonical vectors", () => {
    for (const vector of regressionVectors) {
      it(vector.id, () => {
        const result = achCreditAuthorization.safeFill(vector.inputs as any);
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
    const result = achCreditAuthorization.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("still renders after a mutator reconstructs the form", async () => {
    const result = achCreditAuthorization.safeFill(happyPathInputs as any);
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
    const result = achCreditAuthorization.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const output = await result.data.render({ layer: "pdf" });
    expect(output).toBeInstanceOf(Uint8Array);
    if (!(output instanceof Uint8Array)) throw new Error("PDF renderer should return bytes");
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe("%PDF");
  });
});
