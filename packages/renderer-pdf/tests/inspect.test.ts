/**
 * Tests for inspectAcroFormFields function
 */

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectAcroFormFields } from "../src/inspect";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("inspectAcroFormFields", () => {
  test("inspects fields in pet-addendum.pdf", async () => {
    const templatePath = path.join(__dirname, "fixtures", "pet-addendum.pdf");

    if (!fs.existsSync(templatePath)) {
      console.log("⚠️  No pet-addendum.pdf found in tests/fixtures/");
      console.log("   Run: node tests/create-pdf-fixture.mjs");
      return;
    }

    // Read template
    const template = fs.readFileSync(templatePath);
    expect(template).toBeDefined();
    expect(template.length).toBeGreaterThan(0);

    // Inspect fields
    const fields = await inspectAcroFormFields(new Uint8Array(template));

    console.log("\n=== pet-addendum.pdf fields ===");
    console.log(JSON.stringify(fields, null, 2));
  });

  test("inspects fields in pet-addendum-2.pdf", async () => {
    const templatePath = path.join(__dirname, "fixtures", "pet-addendum-2.pdf");

    if (!fs.existsSync(templatePath)) {
      console.log("⚠️  No pet-addendum-2.pdf found in tests/fixtures/");
      return;
    }

    // Read template
    const template = fs.readFileSync(templatePath);
    expect(template).toBeDefined();
    expect(template.length).toBeGreaterThan(0);

    // Inspect fields
    const fields = await inspectAcroFormFields(new Uint8Array(template));

    console.log("\n=== pet-addendum-2.pdf fields ===");
    console.log(JSON.stringify(fields, null, 2));
  });
});
