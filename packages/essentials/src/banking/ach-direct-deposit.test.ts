// AUTO-GENERATED from artifacts/banking/ach-direct-deposit/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-direct-deposit

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
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
      "name": "Jane Doe"
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

describe("ach-direct-deposit", () => {
  it("loads via para.form()", () => {
    expect(achDirectDeposit.isValid()).toBe(true);
  });

  it("accepts the bundled happy-path vector (llm.scenario.new-single-account-net)", () => {
    const parsed = achDirectDeposit.safeParseData(happyPathInputs as any);
    expect(parsed.success).toBe(true);
  });

  it("renders the markdown layer with the bundled resolver", async () => {
    const parsed = achDirectDeposit.safeParseData(happyPathInputs as any);
    if (!parsed.success) throw new Error("happy-path vector should parse");
    const filled = achDirectDeposit.fill(parsed.data, { rules: false });
    const output = await filled.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
