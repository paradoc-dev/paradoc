/**
 * Tests for renderText function
 */

import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Form } from "@paradoc/types";
import { renderText } from "../src/render";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("renderText", () => {
  const testData = {
    name: "Fluffy",
    species: "cat",
    weight: 12,
    hasVaccination: true,
    fee: {
      amount: 100,
      currency: "USD",
    },
    ownerName: {
      name: "Jane Smith",
      title: "Dr.",
      firstName: "Jane",
      lastName: "Smith",
    },
    ownerPhone: {
      number: "+12175551234",
      extension: "123",
    },
    ownerAddress: {
      line1: "123 Main St",
      line2: "Apt 4B",
      locality: "Springfield",
      region: "IL",
      postalCode: "62701",
      country: "US",
    },
    clinicName: {
      name: "Happy Paws Clinic",
    },
    clinicPhone: {
      number: "+12175555678",
    },
    clinicAddress: {
      line1: "456 Oak Ave",
      locality: "Springfield",
      region: "IL",
      postalCode: "62702",
      country: "US",
    },
  };

  test("renders markdown template with pet data and automatic serialization", () => {
    const templatePath = path.join(__dirname, "fixtures", "pet-addendum.md");
    const template = fs.readFileSync(templatePath, "utf-8");

    // Create form schema for automatic serialization
    const form = {
      kind: "form",
      name: "Pet Form",
      fields: {
        name: { type: "text", label: "Name" } as any,
        species: { type: "text", label: "Species" } as any,
        weight: { type: "number", label: "Weight" } as any,
        hasVaccination: { type: "boolean", label: "Has Vaccination" } as any,
        fee: { type: "money", label: "Fee" } as any,
        ownerName: { type: "person", label: "Owner Name" } as any,
        ownerPhone: { type: "phone", label: "Owner Phone" } as any,
        ownerAddress: { type: "address", label: "Owner Address" } as any,
        clinicName: { type: "organization", label: "Clinic Name" } as any,
        clinicPhone: { type: "phone", label: "Clinic Phone" } as any,
        clinicAddress: { type: "address", label: "Clinic Address" } as any,
      },
      layers: {},
    } as Form;

    const output = renderText({ template, data: testData, form });
    console.log(output);

    // Basic pet info
    expect(output).toBeDefined();
    expect(output).toContain("Fluffy");
    expect(output).toContain("cat");
    expect(output).toContain("12");
    expect(output).toContain("true");

    // Automatically serialized Money field
    expect(output).toContain("$100.00");

    // Automatically serialized Person field
    expect(output).toContain("Jane Smith");

    // Automatically serialized Phone fields
    expect(output).toContain("+12175551234");
    expect(output).toContain("+12175555678");

    // Automatically serialized Address fields
    expect(output).toContain("123 Main St");
    expect(output).toContain("456 Oak Ave");

    // Automatically serialized Organization field
    expect(output).toContain("Happy Paws Clinic");
  });

  test("renders HTML template with pet data", () => {
    const templatePath = path.join(__dirname, "fixtures", "pet-addendum.html");
    const template = fs.readFileSync(templatePath, "utf-8");

    const output = renderText({ template, data: testData });

    expect(output).toBeDefined();
    expect(output).toContain("Fluffy");
    expect(output).toContain("cat");
    expect(output).toContain("12");
    expect(output).toContain("true");
  });

  test("renders plain text template with pet data and automatic serialization", () => {
    const templatePath = path.join(__dirname, "fixtures", "pet-addendum.txt");
    const template = fs.readFileSync(templatePath, "utf-8");

    // Create form schema for automatic serialization
    const form = {
      kind: "form",
      name: "Pet Form",
      fields: {
        name: { type: "text", label: "Name" } as any,
        species: { type: "text", label: "Species" } as any,
        weight: { type: "number", label: "Weight" } as any,
        hasVaccination: { type: "boolean", label: "Has Vaccination" } as any,
        fee: { type: "money", label: "Fee" } as any,
        ownerName: { type: "person", label: "Owner Name" } as any,
        ownerPhone: { type: "phone", label: "Owner Phone" } as any,
        ownerAddress: { type: "address", label: "Owner Address" } as any,
        clinicName: { type: "organization", label: "Clinic Name" } as any,
        clinicPhone: { type: "phone", label: "Clinic Phone" } as any,
        clinicAddress: { type: "address", label: "Clinic Address" } as any,
      },
      layers: {},
    } as Form;

    const output = renderText({ template, data: testData, form });
    console.log(output);

    // Basic pet info
    expect(output).toBeDefined();
    expect(output).toContain("Fluffy");
    expect(output).toContain("cat");
    expect(output).toContain("12");
    expect(output).toContain("true");

    // Automatically serialized fields
    expect(output).toContain("$100.00");
    expect(output).toContain("Jane Smith");
    expect(output).toContain("+12175551234");
  });

  test("automatically serializes all field types without explicit helpers when form schema is provided", () => {
    const template = `
**Money:** {{fee}}

**Person:** {{ownerName}}

**Phone:** {{ownerPhone}}

**Address:** {{ownerAddress}}

**Organization:** {{clinicName}}

**Raw property access:**
- Fee currency: {{fee.currency}}
- Owner first name: {{ownerName.firstName}}
- Phone number: {{ownerPhone.number}}
- Address city: {{ownerAddress.locality}}
- Clinic name: {{clinicName.name}}
`;

    // Create form schema with all field types
    const form = {
      kind: "form",
      name: "Pet Form",
      fields: {
        name: { type: "text", label: "Name" } as any,
        fee: { type: "money", label: "Fee" } as any,
        ownerName: { type: "person", label: "Owner Name" } as any,
        ownerPhone: { type: "phone", label: "Owner Phone" } as any,
        ownerAddress: { type: "address", label: "Owner Address" } as any,
        clinicName: { type: "organization", label: "Clinic Name" } as any,
        clinicPhone: { type: "phone", label: "Clinic Phone" } as any,
        clinicAddress: { type: "address", label: "Clinic Address" } as any,
      },
      layers: {},
    } as Form;

    const output = renderText({
      template,
      data: testData,
      form,
    });

    console.log("Automatic serialization output (all types):", output);

    // Money should be serialized
    expect(output).toContain("$100.00");
    expect(output).toContain("USD");

    // Person should be serialized (full name)
    expect(output).toContain("Jane Smith");

    // Phone should be serialized
    expect(output).toContain("+12175551234");

    // Address should be serialized
    expect(output).toContain("123 Main St");
    expect(output).toContain("Springfield");
    expect(output).toContain("IL");

    // Organization should be serialized
    expect(output).toContain("Happy Paws Clinic");

    // Raw property access should still work
    expect(output).toContain("Jane");
    expect(output).toContain("Springfield");
  });
});
