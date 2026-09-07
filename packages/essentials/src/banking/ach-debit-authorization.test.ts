// AUTO-GENERATED from artifacts/banking/ach-debit-authorization/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-debit-authorization

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
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
      "name": "Jane Doe"
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

describe("ach-debit-authorization", () => {
  it("loads via para.form()", () => {
    expect(achDebitAuthorization.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (llm.scenario.one-time-individual-happy-path)", () => {
    const result = achDebitAuthorization.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  it("renders the markdown layer on the bound resolver", async () => {
    const result = achDebitAuthorization.safeFill(happyPathInputs as any);
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
    const result = achDebitAuthorization.safeFill(happyPathInputs as any);
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
