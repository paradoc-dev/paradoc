// AUTO-GENERATED from artifacts/banking/ach-credit-authorization/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-credit-authorization

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
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
      "name": "Test Party"
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
} as const;

describe("ach-credit-authorization", () => {
  it("loads via para.form()", () => {
    expect(achCreditAuthorization.isValid()).toBe(true);
  });

  it("accepts the bundled happy-path vector (synth.required.payeephone.missing-payeetype-organization)", () => {
    const parsed = achCreditAuthorization.safeParseData(happyPathInputs as any);
    expect(parsed.success).toBe(true);
  });

  it("renders the markdown layer with the bundled resolver", async () => {
    const parsed = achCreditAuthorization.safeParseData(happyPathInputs as any);
    if (!parsed.success) throw new Error("happy-path vector should parse");
    const filled = achCreditAuthorization.fill(parsed.data, { rules: false });
    const output = await filled.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
