// AUTO-GENERATED from artifacts/employment/i-9/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only employment/i-9

import { describe, it, expect } from "vitest";
import { textRenderer } from "@paradoc/sdk";
import { i9 } from "./i-9.js";

const happyPathInputs = {
  "parties": {
    "employee": {
      "id": "employee-0",
      "firstName": "Jordan",
      "middleName": "M",
      "lastName": "Rivera",
      "name": "Jordan Rivera",
      "signature": {
        "signedAt": "2026-04-15T09:00:00Z"
      }
    },
    "employer": {
      "id": "employer-0",
      "name": "Acme Manufacturing LLC",
      "legalName": "Acme Manufacturing LLC",
      "entityType": "llc",
      "signature": {
        "signedAt": "2026-04-15T14:00:00Z"
      }
    },
    "preparer": []
  },
  "fields": {
    "employeeAddress": {
      "line1": "123 Main St",
      "locality": "Springfield",
      "region": "IL",
      "postalCode": "62704",
      "country": "US"
    },
    "employeeDateOfBirth": "1990-06-15",
    "citizenshipStatus": "us_citizen",
    "documentRoute": "list_a",
    "listADocument1IssuingAuthority": "U.S. Department of State",
    "firstDayOfEmployment": "2026-04-15",
    "employerRepresentativeName": "Patricia Chen, HR Director",
    "employerBusinessAddress": {
      "line1": "500 Industrial Way",
      "locality": "Springfield",
      "region": "IL",
      "postalCode": "62701",
      "country": "US"
    },
    "alternativeProcedureUsed": false,
    "employerEverifyEnrolled": false,
    "preparerAssistanceUsed": false
  }
} as const;

describe("i-9", () => {
  it("loads via para.form()", () => {
    expect(i9.isValid()).toBe(true);
  });

  it("accepts the bundled happy-path vector (llm.list_a.required-doc1-title-missing)", () => {
    const parsed = i9.safeParseData(happyPathInputs as any);
    expect(parsed.success).toBe(true);
  });

  it("renders the markdown layer with the bundled resolver", async () => {
    const parsed = i9.safeParseData(happyPathInputs as any);
    if (!parsed.success) throw new Error("happy-path vector should parse");
    const filled = i9.fill(parsed.data, { rules: false });
    const output = await filled.render({
      renderer: textRenderer(),
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
