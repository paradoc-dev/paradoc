// AUTO-GENERATED from artifacts/tax/1099-misc/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only tax/1099-misc

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
import { f1099MISC } from "./1099-misc.js";

const happyPathInputs = {
  "parties": {
    "payer": {
      "id": "payer-0",
      "name": "Acme Consulting LLC"
    },
    "recipient": {
      "id": "recipient-0",
      "name": "Jane R. Smith"
    }
  },
  "fields": {
    "void": false,
    "corrected": false,
    "calendarYear": "2024",
    "payerAddress": {
      "line1": "100 Industrial Way",
      "line2": "Suite 200",
      "locality": "Springfield",
      "region": "IL",
      "postalCode": "62704",
      "country": "US"
    },
    "payerPhone": {
      "number": "+12175550142"
    },
    "payerTin": "12-3456789",
    "recipientTin": "987-65-4321",
    "recipientAddress": {
      "line1": "42 Elm Street",
      "locality": "Champaign",
      "region": "IL",
      "postalCode": "61820",
      "country": "US"
    },
    "accountNumber": "ACCT-2024-0042",
    "secondTinNotice": false,
    "rents": {
      "amount": 12000,
      "currency": "USD"
    },
    "fatcaFilingRequirement": false,
    "directSales5kOrMore": false,
    "state1TaxWithheld": {
      "amount": 250,
      "currency": "USD"
    },
    "state1PayerStateNo": "IL / 12-3456789",
    "state1Income": {
      "amount": 12000,
      "currency": "USD"
    }
  }
} as const;

describe("1099-misc", () => {
  it("loads via para.form()", () => {
    expect(f1099MISC.isValid()).toBe(true);
  });

  it("accepts the bundled happy-path vector (llm.happy-path-individual-recipient)", () => {
    const parsed = f1099MISC.safeParseData(happyPathInputs as any);
    expect(parsed.success).toBe(true);
  });

  it("renders the markdown layer with the bundled resolver", async () => {
    const parsed = f1099MISC.safeParseData(happyPathInputs as any);
    if (!parsed.success) throw new Error("happy-path vector should parse");
    const filled = f1099MISC.fill(parsed.data, { rules: false });
    const output = await filled.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
