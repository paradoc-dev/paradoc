/**
 * Tests for renderDocx with bindings support
 */

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderDocx } from "../src/render";
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

describe("renderDocx with bindings", () => {
  const testData = {
    petName: "Fluffy",
    petSpecies: "cat",
    petWeight: 12,
    isVaccinated: true,
  };

  // Bindings map template field names (in DOCX) to form data field names
  const bindings = {
    name: "petName",
    species: "petSpecies",
    weight: "petWeight",
    hasVaccination: "isVaccinated",
  };

  test("renders DOCX template with bindings", async () => {
    const templatePath = path.join(__dirname, "fixtures", "pet-addendum.docx");

    if (!fs.existsSync(templatePath)) {
      console.log("⚠️  No pet-addendum.docx found in tests/fixtures/");
      console.log("   Skipping bindings test for DOCX renderer");
      return;
    }

    // Read template
    const template = fs.readFileSync(templatePath);
    expect(template).toBeDefined();
    expect(template.length).toBeGreaterThan(0);

    // Render with bindings
    // The template uses {{name}}, {{species}}, etc.
    // But our data uses petName, petSpecies, etc.
    // Bindings map: { name: 'petName', species: 'petSpecies', ... }
    const output = await renderDocx({
      template: new Uint8Array(template),
      data: testData,
      bindings,
    });

    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);

    // Ensure output directory exists
    const outputDir = path.join(__dirname, "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output to file for manual inspection
    fs.writeFileSync(
      path.join(outputDir, "pet-addendum-bindings-rendered.docx"),
      output
    );
    console.log(
      "Rendered DOCX file with bindings written to output/pet-addendum-bindings-rendered.docx"
    );
  });

  test("renders without bindings (original field names)", async () => {
    const templatePath = path.join(__dirname, "fixtures", "pet-addendum.docx");

    if (!fs.existsSync(templatePath)) {
      console.log("⚠️  No pet-addendum.docx found in tests/fixtures/");
      return;
    }

    // Read template
    const template = fs.readFileSync(templatePath);

    // Render without bindings (data fields match template fields)
    const directData = {
      name: "Buddy",
      species: "dog",
      weight: 25,
      hasVaccination: false,
    };

    const output = await renderDocx({
      template: new Uint8Array(template),
      data: directData,
    });

    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
  });
});
