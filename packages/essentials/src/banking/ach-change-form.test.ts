// AUTO-GENERATED from artifacts/banking/ach-change-form/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-change-form

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
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
      "name": "Test Party"
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

describe("ach-change-form", () => {
  it("loads via para.form()", () => {
    expect(achChangeForm.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (synth.required.accountholderphone.present-accountholdertype-organization)", () => {
    const result = achChangeForm.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  it("renders the markdown layer on the bound resolver", async () => {
    const result = achChangeForm.safeFill(happyPathInputs as any);
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
    const result = achChangeForm.safeFill(happyPathInputs as any);
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
