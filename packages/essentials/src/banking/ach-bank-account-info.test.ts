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
      "name": "Test Party"
    }
  },
  "fields": {
    "actionType": "new",
    "accountHolderType": "individual",
    "orgEntityType": "sole_prop",
    "bankName": "x",
    "routingNumber": "111111111",
    "accountNumber": "xxxx",
    "accountType": "checking",
    "individualSsn": "111-22-3333"
  }
} as const;

describe("ach-bank-account-info", () => {
  it("loads via para.form()", () => {
    expect(achBankAccountInfo.isValid()).toBe(true);
  });

  it("accepts the bundled happy-path vector (synth.visible.individualssn.on-accountholdertype-individual)", () => {
    const parsed = achBankAccountInfo.safeParseData(happyPathInputs as any);
    expect(parsed.success).toBe(true);
  });

  it("renders the markdown layer with the bundled resolver", async () => {
    const parsed = achBankAccountInfo.safeParseData(happyPathInputs as any);
    if (!parsed.success) throw new Error("happy-path vector should parse");
    const filled = achBankAccountInfo.fill(parsed.data, { rules: false });
    const output = await filled.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
