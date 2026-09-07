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
    "listADocument1Title": "U.S. Passport",
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

  it("accepts the bundled passing vector (llm.list_a.minimal-pass)", () => {
    const result = i9.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  it("renders the markdown layer on the bound resolver", async () => {
    const result = i9.safeFill(happyPathInputs as any);
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
    const result = i9.safeFill(happyPathInputs as any);
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
