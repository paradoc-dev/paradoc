/**
 * Tests for renderDocx function
 */

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderDocx } from "../src/render";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("renderDocx", () => {
  const testData = {
    name: "Fluffy",
    species: "cat",
    weight: 12,
    hasVaccination: true,
  };

  test("renders DOCX template with pet data", async () => {
    const templatePath = path.join(__dirname, "fixtures", "pet-addendum.docx");

    if (!fs.existsSync(templatePath)) {
      // Skip test if template doesn't exist
      console.log("⚠️  No pet-addendum.docx found in tests/fixtures/");
      console.log("   Create a Word document with placeholders like:");
      console.log("   - {{name}}");
      console.log("   - {{species}}");
      console.log("   - {{weight}}");
      console.log("   - {{hasVaccination}}");
      return;
    }

    // Read template
    const template = fs.readFileSync(templatePath);
    expect(template).toBeDefined();
    expect(template.length).toBeGreaterThan(0);

    // Render
    const output = await renderDocx({
      template: new Uint8Array(template),
      data: testData,
    });
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);

    // Ensure output directory exists
    const outputDir = path.join(__dirname, "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output to file
    fs.writeFileSync(
      path.join(outputDir, "pet-addendum-rendered.docx"),
      output
    );
    console.log(
      "Rendered DOCX file written to output/pet-addendum-rendered.docx"
    );
  });
});
