import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Form } from "@paradoc/types";
import { renderText } from "../src/render";
import { para } from "@paradoc/core";
import { textRenderer } from "../src/";
import { createFsResolver } from "@paradoc/resolvers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("@paradoc/renderer-text - README Examples", () => {
  describe("Lease Agreement - Automatic Field Serialization", () => {
    test("renders lease agreement using renderText() directly", () => {
      // Load the lease agreement template
      const templatePath = path.join(
        __dirname,
        "fixtures",
        "lease-agreement.md"
      );
      const template = fs.readFileSync(templatePath, "utf-8");

      // Define the form schema with field types
      const leaseFormSchema: Form = {
        kind: "form",
        name: "lease-agreement",
        title: "Lease Agreement",
        fields: {
          tenantName: {
            type: "person",
            label: "Tenant Name",
            required: true,
          },
          tenantAge: {
            type: "text",
            label: "Tenant Age",
            required: true,
          },
          monthlyRent: {
            type: "money",
            label: "Monthly Rent",
            required: true,
          },
        },
        layers: {},
      };

      // Render with automatic field type detection using renderText()
      const output = renderText({
        template,
        data: {
          tenantName: {
            firstName: "Sarah",
            lastName: "Johnson",
            name: "Sarah Johnson",
          },
          tenantAge: "28",
          monthlyRent: {
            amount: 1500,
            currency: "USD",
          },
        },
        form: leaseFormSchema,
      });

      // Verify automatic serialization worked
      expect(output).toContain("**Tenant Name:** Sarah Johnson");
      expect(output).toContain("**Tenant Age:** 28");
      expect(output).toContain("**Monthly Rent:** $1,500.00");
      expect(output).toContain("# Lease Agreement");
    });

    test("renders lease agreement using form builder API", async () => {
      const testData = {
        tenantName: {
          firstName: "Sarah",
          lastName: "Johnson",
          name: "Sarah Johnson",
        },
        tenantAge: "28",
        monthlyRent: {
          amount: 1500,
          currency: "USD",
        },
      };

      // Create form using the form builder API
      const leaseForm = para.form({
        kind: "form",
        name: "lease-agreement",
        title: "Lease Agreement",
        fields: {
          tenantName: {
            type: "person",
            label: "Tenant Name",
            required: true,
          },
          tenantAge: {
            type: "text",
            label: "Tenant Age",
            required: true,
          },
          monthlyRent: {
            type: "money",
            label: "Monthly Rent",
            required: true,
          },
        },
        defaultLayer: "markdown",
        layers: {
          markdown: {
            kind: "file",
            mimeType: "text/markdown",
            path: "fixtures/lease-agreement.md",
          },
        },
      });

      const resolver = createFsResolver({
        root: __dirname,
      });

      // Fill the form with data and render in a single chain
      const output = await leaseForm.fill({
        fields: testData,
      }).render({
        renderer: textRenderer(),
        layer: "markdown",
        resolver,
      });

      // Verify form builder approach works with automatic serialization
      expect(output).toContain("Sarah Johnson");
      expect(output).toContain("28");
      expect(output).toContain("$1,500.00");
    });

    test("renders text-based formats - markdown example", () => {
      const template = `# Invoice

**Client:** {{clientName}}

**Amount Due:** {{amountDue}}

Generated for markdown rendering.`;

      const invoiceForm: Form = {
        kind: "form",
        name: "invoice",
        title: "Invoice",
        fields: {
          clientName: { type: "person", label: "Client Name" },
          amountDue: { type: "money", label: "Amount Due" },
        },
        layers: {},
      };

      const output = renderText({
        template,
        data: {
          clientName: {
            firstName: "John",
            lastName: "Doe",
            name: "John Doe",
          },
          amountDue: {
            amount: 2500,
            currency: "USD",
          },
        },
        form: invoiceForm,
      });

      expect(output).toContain("# Invoice");
      expect(output).toContain("**Client:** John Doe");
      expect(output).toContain("**Amount Due:** $2,500.00");
    });

    test("renders text-based formats - HTML example", () => {
      const template = `
<html>
  <body>
    <h1>Quote</h1>
    <p>Recipient: {{recipientName}}</p>
    <p>Quote Amount: {{quoteAmount}}</p>
  </body>
</html>`;

      const quoteForm: Form = {
        kind: "form",
        name: "quote",
        title: "Quote",
        fields: {
          recipientName: { type: "person", label: "Recipient Name" },
          quoteAmount: { type: "money", label: "Quote Amount" },
        },
        layers: {},
      };

      const output = renderText({
        template,
        data: {
          recipientName: {
            firstName: "Alice",
            lastName: "Smith",
            name: "Alice Smith",
          },
          quoteAmount: {
            amount: 5000,
            currency: "USD",
          },
        },
        form: quoteForm,
      });

      expect(output).toContain("<h1>Quote</h1>");
      expect(output).toContain("Recipient: Alice Smith");
      expect(output).toContain("Quote Amount: $5,000.00");
    });

    test("preserves raw property access while providing automatic serialization", () => {
      const template = `
Tenant: {{tenantName}}
First Name: {{tenantName.firstName}}
Monthly Payment: {{monthlyRent}}
Currency: {{monthlyRent.currency}}`;

      const form: Form = {
        kind: "form",
        name: "lease",
        title: "Lease",
        fields: {
          tenantName: { type: "person", label: "Tenant Name" },
          monthlyRent: { type: "money", label: "Monthly Rent" },
        },
        layers: {},
      };

      const output = renderText({
        template,
        data: {
          tenantName: {
            firstName: "Bob",
            lastName: "Wilson",
            name: "Bob Wilson",
          },
          monthlyRent: {
            amount: 1200,
            currency: "USD",
          },
        },
        form,
      });

      // Verify automatic serialization of root objects and raw properties both work
      expect(output).toContain("Bob Wilson");
      expect(output).toContain("$1,200.00");

      // Verify raw property access still works
      expect(output).toContain("First Name: Bob");
      expect(output).toContain("Currency: USD");
    });
  });
});
