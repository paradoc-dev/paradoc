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

  it("accepts the bundled happy-path vector (synth.required.accountholderphone.missing-accountholdertype-organization)", () => {
    const parsed = achChangeForm.safeParseData(happyPathInputs as any);
    expect(parsed.success).toBe(true);
  });

  it("renders the markdown layer with the bundled resolver", async () => {
    const parsed = achChangeForm.safeParseData(happyPathInputs as any);
    if (!parsed.success) throw new Error("happy-path vector should parse");
    const filled = achChangeForm.fill(parsed.data, { rules: false });
    const output = await filled.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
