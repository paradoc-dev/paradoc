// AUTO-GENERATED from artifacts/employment/i-9/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only employment/i-9

import { describe, it, expect } from "vitest";
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

const regressionVectors: Array<{
  id: string;
  inputs: unknown;
  expected: {
    validation?: "pass" | "fail";
    state?: { fieldId: string; visible?: boolean; required?: boolean; complete?: boolean };
    rules?: Record<string, "pass" | "fail">;
  };
}> = [
  {
    "id": "llm.list_b_and_c.minimal-pass",
    "inputs": {
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
        "documentRoute": "list_b_and_c",
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
        "preparerAssistanceUsed": false,
        "listBDocumentTitle": "Driver's License",
        "listBIssuingAuthority": "State of Illinois DMV",
        "listCDocumentTitle": "Social Security Card",
        "listCIssuingAuthority": "Social Security Administration"
      }
    },
    "expected": {
      "validation": "pass"
    }
  },
  {
    "id": "synth.enum.citizenshipstatus.invalid",
    "inputs": {
      "parties": {
        "employee": {
          "id": "employee-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        },
        "employer": {
          "id": "employer-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "preparer": [
          {
            "id": "preparer-0",
            "name": "Test Party",
            "firstName": "Test",
            "lastName": "Party"
          }
        ]
      },
      "fields": {
        "employeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "employeeDateOfBirth": "2024-01-01",
        "employeeSsn": "111111111",
        "citizenshipStatus": "__invalid__",
        "lprUscisOrANumber": "x",
        "workAuthDocumentType": "uscis_a_number",
        "workAuthUscisANumber": "x",
        "workAuthI94Number": "x",
        "workAuthForeignPassport": "x",
        "documentRoute": "list_a",
        "listADocument1Title": "x",
        "listADocument1IssuingAuthority": "x",
        "listBDocumentTitle": "x",
        "listBIssuingAuthority": "x",
        "listCDocumentTitle": "x",
        "listCIssuingAuthority": "x",
        "firstDayOfEmployment": "2024-01-01",
        "employerRepresentativeName": "x",
        "employerBusinessAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "preparer1Address": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        }
      }
    },
    "expected": {
      "validation": "fail"
    }
  },
  {
    "id": "llm.list_a.required-doc1-title-missing",
    "inputs": {
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
    },
    "expected": {
      "state": {
        "fieldId": "listADocument1Title",
        "required": true
      }
    }
  },
  {
    "id": "synth.visible.lpruscisoranumber.on-citizenshipstatus-lawful-permanent-resident",
    "inputs": {
      "parties": {
        "employee": {
          "id": "employee-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        },
        "employer": {
          "id": "employer-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "preparer": [
          {
            "id": "preparer-0",
            "name": "Test Party",
            "firstName": "Test",
            "lastName": "Party"
          }
        ]
      },
      "fields": {
        "employeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "employeeDateOfBirth": "2024-01-01",
        "employeeSsn": "111111111",
        "citizenshipStatus": "lawful_permanent_resident",
        "lprUscisOrANumber": "x",
        "workAuthDocumentType": "uscis_a_number",
        "workAuthUscisANumber": "x",
        "workAuthI94Number": "x",
        "workAuthForeignPassport": "x",
        "documentRoute": "list_a",
        "listADocument1Title": "x",
        "listADocument1IssuingAuthority": "x",
        "listBDocumentTitle": "x",
        "listBIssuingAuthority": "x",
        "listCDocumentTitle": "x",
        "listCIssuingAuthority": "x",
        "firstDayOfEmployment": "2024-01-01",
        "employerRepresentativeName": "x",
        "employerBusinessAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "preparer1Address": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        }
      }
    },
    "expected": {
      "state": {
        "fieldId": "lprUscisOrANumber",
        "visible": true
      }
    }
  },
  {
    "id": "synth.visible.lpruscisoranumber.off-citizenshipstatus-us-citizen",
    "inputs": {
      "parties": {
        "employee": {
          "id": "employee-0",
          "name": "Test Party",
          "firstName": "Test",
          "lastName": "Party"
        },
        "employer": {
          "id": "employer-0",
          "name": "Test Party",
          "entityType": "llc"
        },
        "preparer": [
          {
            "id": "preparer-0",
            "name": "Test Party",
            "firstName": "Test",
            "lastName": "Party"
          }
        ]
      },
      "fields": {
        "employeeAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "employeeDateOfBirth": "2024-01-01",
        "employeeSsn": "111111111",
        "citizenshipStatus": "us_citizen",
        "lprUscisOrANumber": "x",
        "workAuthDocumentType": "uscis_a_number",
        "workAuthUscisANumber": "x",
        "workAuthI94Number": "x",
        "workAuthForeignPassport": "x",
        "documentRoute": "list_a",
        "listADocument1Title": "x",
        "listADocument1IssuingAuthority": "x",
        "listBDocumentTitle": "x",
        "listBIssuingAuthority": "x",
        "listCDocumentTitle": "x",
        "listCIssuingAuthority": "x",
        "firstDayOfEmployment": "2024-01-01",
        "employerRepresentativeName": "x",
        "employerBusinessAddress": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        },
        "preparer1Address": {
          "line1": "100 Test St",
          "locality": "TestCity",
          "region": "TS",
          "postalCode": "00000",
          "country": "US"
        }
      }
    },
    "expected": {
      "state": {
        "fieldId": "lprUscisOrANumber",
        "visible": false
      }
    }
  }
];

describe("i-9", () => {
  it("loads via para.form()", () => {
    expect(i9.isValid()).toBe(true);
  });

  it("accepts the bundled passing vector (llm.list_a.minimal-pass)", () => {
    const result = i9.safeFill(happyPathInputs as any);
    expect(result.success).toBe(true);
  });

  describe("representative canonical vectors", () => {
    for (const vector of regressionVectors) {
      it(vector.id, () => {
        const result = i9.safeFill(vector.inputs as any);
        const expectedValidation = vector.expected?.validation;
        const expectedState = "state" in vector.expected ? vector.expected.state : undefined;
        const expectedRules = "rules" in vector.expected ? vector.expected.rules : undefined;

        if (expectedValidation === "fail") {
          if (!result.success) {
            expect(result.success).toBe(false);
            return;
          }
          expect(result.data.validateRules().valid).toBe(false);
          return;
        }

        expect(result.success).toBe(true);
        if (!result.success) return;

        if (expectedState) {
          if ("visible" in expectedState) {
            expect(result.data.isFieldVisible(expectedState.fieldId)).toBe(expectedState.visible);
          }
          if ("required" in expectedState) {
            expect(result.data.isFieldRequired(expectedState.fieldId)).toBe(expectedState.required);
          }
          if ("complete" in expectedState) {
            expect(result.data.isValid()).toBe(expectedState.complete);
          }
        }

        if (expectedRules) {
          const rulesResult = result.data.validateRules();
          const fired = [...(rulesResult.errors ?? []), ...(rulesResult.warnings ?? [])];
          for (const [ruleId, outcome] of Object.entries(expectedRules)) {
            const didFire = fired.some((rule) => rule.ruleId === ruleId);
            if (outcome === "fail") expect(didFire, `expected rule ${ruleId} to fire`).toBe(true);
            if (outcome === "pass") expect(didFire, `expected rule ${ruleId} not to fire`).toBe(false);
          }
        }
      });
    }
  });

  it("renders the markdown layer on the bound resolver", async () => {
    const result = i9.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const filled = result.data;
    const output = await filled.render({
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
      layer: "markdown",
    });
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("renders the PDF layer through the default renderer", async () => {
    const result = i9.safeFill(happyPathInputs as any);
    if (!result.success) throw new Error("passing vector should be accepted");
    const output = await result.data.render({ layer: "pdf" });
    expect(output).toBeInstanceOf(Uint8Array);
    if (!(output instanceof Uint8Array)) throw new Error("PDF renderer should return bytes");
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe("%PDF");
  });
});
