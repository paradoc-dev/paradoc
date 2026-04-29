/**
 * Tests for renderText with bindings support
 */

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Form } from "@paradoc/types";
import { renderText } from "../src/render";
import { applyBindings } from "../src/utils/bindings";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("applyBindings", () => {
  test("maps template field names to form field names", () => {
    const data = {
      name: "Fluffy",
      species: "cat",
      weight: 12,
      hasVaccination: true,
    };

    const bindings = {
      pet_name: "name",
      pet_species: "species",
      pet_weight: "weight",
      is_vaccinated: "hasVaccination",
    };

    const result = applyBindings(data, bindings);

    // Original data is preserved
    expect(result.name).toBe("Fluffy");
    expect(result.species).toBe("cat");
    expect(result.weight).toBe(12);
    expect(result.hasVaccination).toBe(true);

    // Bound fields are added
    expect(result.pet_name).toBe("Fluffy");
    expect(result.pet_species).toBe("cat");
    expect(result.pet_weight).toBe(12);
    expect(result.is_vaccinated).toBe(true);
  });

  test("handles nested paths", () => {
    const data = {
      owner: {
        name: "Jane Smith",
        contact: {
          phone: "+12175551234",
        },
      },
    };

    const bindings = {
      owner_name: "owner.name",
      owner_phone: "owner.contact.phone",
    };

    const result = applyBindings(data, bindings);

    expect(result.owner_name).toBe("Jane Smith");
    expect(result.owner_phone).toBe("+12175551234");
  });

  test("skips undefined values", () => {
    const data = {
      name: "Fluffy",
    };

    const bindings = {
      pet_name: "name",
      pet_species: "species", // doesn't exist in data
    };

    const result = applyBindings(data, bindings);

    expect(result.pet_name).toBe("Fluffy");
    expect(result).not.toHaveProperty("pet_species");
  });
});

describe("renderText with bindings", () => {
  const testData = {
    name: "Fluffy",
    species: "cat",
    weight: 12,
    hasVaccination: true,
    ownerName: "Jane Smith",
    ownerPhone: "+12175551234",
  };

  const bindings = {
    pet_name: "name",
    pet_species: "species",
    pet_weight: "weight",
    is_vaccinated: "hasVaccination",
    owner_name: "ownerName",
    owner_phone: "ownerPhone",
  };

  test("renders template with bound field names", () => {
    const templatePath = path.join(
      __dirname,
      "fixtures",
      "pet-addendum-bindings.txt"
    );
    const template = fs.readFileSync(templatePath, "utf-8");

    const output = renderText({
      template,
      data: testData,
      bindings,
    });

    // Bound field names should be resolved
    expect(output).toContain("Fluffy");
    expect(output).toContain("cat");
    expect(output).toContain("12");
    expect(output).toContain("true");
    expect(output).toContain("Jane Smith");
    expect(output).toContain("+12175551234");
  });

  test("renders inline template with bindings", () => {
    const template = `
Pet: {{pet_name}} ({{pet_species}})
Weight: {{pet_weight}} lbs
Vaccinated: {{is_vaccinated}}
`;

    const output = renderText({
      template,
      data: testData,
      bindings,
    });

    expect(output).toContain("Pet: Fluffy (cat)");
    expect(output).toContain("Weight: 12 lbs");
    expect(output).toContain("Vaccinated: true");
  });

  test("renders with bindings and form schema for automatic serialization", () => {
    const template = `
Pet: {{pet_name}}
Fee: {{pet_fee}}
`;

    const testDataWithFee = {
      name: "Fluffy",
      fee: { amount: 100, currency: "USD" },
    };

    const form = {
      kind: "form",
      name: "Pet Form",
      fields: {
        name: { type: "text", label: "Name" } as any,
        fee: { type: "money", label: "Fee" } as any,
      },
      layers: {},
    } as Form;

    const bindingsWithFee = {
      pet_name: "name",
      pet_fee: "fee",
    };

    const output = renderText({
      template,
      data: testDataWithFee,
      form,
      bindings: bindingsWithFee,
    });

    expect(output).toContain("Pet: Fluffy");
    expect(output).toContain("$100.00");
  });

  test("original field names still work alongside bound names", () => {
    const template = `
Original: {{name}}
Bound: {{pet_name}}
`;

    const output = renderText({
      template,
      data: testData,
      bindings,
    });

    expect(output).toContain("Original: Fluffy");
    expect(output).toContain("Bound: Fluffy");
  });
});
