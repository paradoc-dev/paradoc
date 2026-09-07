// AUTO-GENERATED from artifacts/banking/ach-bank-account-info/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-bank-account-info

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
import { achBankAccountInfo } from "./ach-bank-account-info.js";

const happyPathInputs = {
  "parties": {
    "requestor": {
      "id": "requestor-0",
      "name": "Test Party",
      "entityType": "llc"
    },
    "accountHolder": {
      "id": "accountHolder-0",
      "name": "Test Party",
      "legalName": "Test Party"
    }
  },
  "fields": {
    "actionType": "new",
    "accountHolderType": "organization",
    "orgEntityType": "sole_prop",
    "bankName": "x",
    "routingNumber": "111111111",
    "accountNumber": "xxxx",
    "accountType": "checking"
  }
} as const;

describe("ach-bank-account-info", () => {
  it("loads via para.form()", () => {
    expect(achBankAccountInfo.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (synth.required.orgentitytype.present-accountholdertype-organization)", () => {
    const result = achBankAccountInfo.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  it("renders the markdown layer on the bound resolver", async () => {
    const result = achBankAccountInfo.safeFill(happyPathInputs as any);
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
    const result = achBankAccountInfo.safeFill(happyPathInputs as any);
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
