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

describe("ach-credit-authorization", () => {
  it("loads via para.form()", () => {
    expect(achCreditAuthorization.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (synth.required.payeephone.present-payeetype-organization)", () => {
    const result = achCreditAuthorization.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  it("renders the markdown layer on the bound resolver", async () => {
    const result = achCreditAuthorization.safeFill(happyPathInputs as any);
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
    const result = achCreditAuthorization.safeFill(happyPathInputs as any);
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
