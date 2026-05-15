/**
 * Tests for README examples in @paradoc/core
 * Verifies all code examples from the README work correctly
 */

import { describe, test, expect } from "vitest";
import {
  para,
  type InferFormPayload,
  type MoneyField,
  type AddressField,
  type UuidField,
} from "../src";

describe("@paradoc/core - README Examples", () => {
  describe("Define forms with parties, fields, and validation rules", () => {
    test("creates residential lease agreement form", () => {
      const leaseAgreement = para
        .form()
        .name("residential-lease-agreement")
        .version("1.0.0")
        .title("Residential Lease Agreement")
        .defaultLayer("markdown")
        .layers({
          markdown: para
            .layer()
            .file()
            .mimeType("text/markdown")
            .path("fixtures/lease-agreement.md"),
        })
        .parties({
          landlord: para
            .party()
            .label("Landlord")
            .signature({ required: true }),
          tenant: para
            .party()
            .label("Tenant")
            .multiple(true)
            .min(1)
            .max(4)
            .signature({ required: true }),
        })
        .fields({
          leaseId: { type: "uuid", label: "Lease ID" },
          propertyAddress: {
            type: "address",
            label: "Property Address",
            required: true,
          },
          monthlyRent: { type: "money", label: "Monthly Rent", required: true },
          leaseStartDate: { type: "date", label: "Lease Start Date" },
        })
        .build();

      expect(leaseAgreement).toBeDefined();
      expect(leaseAgreement.name).toBe("residential-lease-agreement");
      expect(leaseAgreement.version).toBe("1.0.0");
      expect(leaseAgreement.title).toBe("Residential Lease Agreement");
      expect(Object.keys(leaseAgreement.parties || {})).toHaveLength(2);
      expect(leaseAgreement.fields).toBeDefined();
    });
  });

  describe("Add file attachments and advanced field types", () => {
    test("creates commercial lease with annexes", () => {
      const advancedLease = para
        .form()
        .name("commercial-lease")
        .version("1.0.0")
        .title("Commercial Lease Agreement")
        .allowAdditionalAnnexes(true)
        .annexes({
          photoId: para.annex().title("Photo ID").required(true),
          proofOfIncome: para.annex().title("Proof of Income").required(true),
        })
        .parties({
          landlord: para
            .party()
            .label("Landlord")
            .signature({ required: true }),
          tenant: para
            .party()
            .label("Tenant")
            .multiple(true)
            .signature({ required: true }),
        })
        .fields({
          leaseId: { type: "uuid", label: "Lease ID", required: true },
          leaseTermMonths: {
            type: "number",
            label: "Lease Term (months)",
            required: true,
          },
          monthlyRent: { type: "money", label: "Monthly Rent", required: true },
          petPolicy: {
            type: "enum",
            enum: [{ value: "no-pets" }, { value: "small-pets" }, { value: "all-pets" }],
            label: "Pet Policy",
            required: true,
          },
        })
        .build();

      expect(advancedLease).toBeDefined();
      expect(advancedLease.name).toBe("commercial-lease");
      expect(Object.keys(advancedLease.annexes || {})).toHaveLength(2);
      expect(advancedLease.fields?.petPolicy.type).toBe("enum");
    });
  });

  describe("Define static documents with metadata", () => {
    test("creates lead paint disclosure document", () => {
      const leadPaintDisclosure = para
        .document()
        .name("lead-paint-disclosure")
        .version("1.0.0")
        .title("Lead Paint Disclosure")
        .code("EPA-747-K-12-001")
        .releaseDate("2025-12-01")
        .metadata({ agency: "EPA/HUD", cfr: "40 CFR 745" })
        .layers({
          pdf: para
            .layer()
            .file()
            .path("fixtures/lead-paint-disclosure.pdf")
            .mimeType("application/pdf"),
        })
        .defaultLayer("pdf")
        .build();

      expect(leadPaintDisclosure).toBeDefined();
      expect(leadPaintDisclosure.name).toBe("lead-paint-disclosure");
      expect(leadPaintDisclosure.kind).toBe("document");
      expect(leadPaintDisclosure.code).toBe("EPA-747-K-12-001");
      expect(leadPaintDisclosure.releaseDate).toBe("2025-12-01");
      expect(leadPaintDisclosure.metadata).toEqual({
        agency: "EPA/HUD",
        cfr: "40 CFR 745",
      });
    });
  });

  describe("Define workflow checklists with status tracking", () => {
    test("creates lease application checklist", () => {
      const leaseChecklist = para
        .checklist()
        .name("lease-application-checklist")
        .version("1.0.0")
        .title("Lease Application Checklist")
        .items([
          {
            id: "application_received",
            title: "Application Received",
            status: { kind: "boolean" },
          },
          {
            id: "credit_check",
            title: "Credit Check Complete",
            status: { kind: "boolean" },
          },
          {
            id: "background_check",
            title: "Background Check Complete",
            status: { kind: "boolean" },
          },
          {
            id: "lease_signed",
            title: "Lease Signed",
            status: { kind: "boolean" },
          },
        ])
        .build();

      expect(leaseChecklist).toBeDefined();
      expect(leaseChecklist.kind).toBe("checklist");
      expect(leaseChecklist.items).toHaveLength(4);
      expect(leaseChecklist.items[0].id).toBe("application_received");
    });
  });

  describe("Compose artifacts into bundles", () => {
    test("creates bundle with multiple artifacts", () => {
      const propertyAddress: AddressField = {
        type: "address",
        label: "Property Address",
        required: true,
      };
      const monthlyRent: MoneyField = {
        type: "money",
        label: "Monthly Rent",
        required: true,
      };

      const residentialLease = para
        .form()
        .name("residential-lease")
        .version("1.0.0")
        .fields({ leaseId: { type: "uuid" }, propertyAddress, monthlyRent })
        .build();

      const commercialLease = para
        .form()
        .name("commercial-lease")
        .version("1.0.0")
        .fields({ leaseId: { type: "uuid" }, propertyAddress, monthlyRent })
        .build();

      const leadPaintDisclosure = para
        .document()
        .name("lead-paint-disclosure")
        .version("1.0.0")
        .title("Lead Paint Disclosure")
        .layers({
          pdf: {
            kind: "file",
            path: "fixtures/lead-paint-disclosure.pdf",
            mimeType: "application/pdf",
          },
        })
        .build();

      const leaseChecklist = para
        .checklist()
        .name("lease-application-checklist")
        .version("1.0.0")
        .title("Lease Application Checklist")
        .items([
          {
            id: "application_received",
            title: "Application Received",
            status: { kind: "boolean" },
          },
          {
            id: "credit_check",
            title: "Credit Check Complete",
            status: { kind: "boolean" },
          },
        ])
        .build();

      const leaseBundle = para
        .bundle()
        .name("residential-lease-bundle")
        .version("1.0.0")
        .contents([
          {
            type: "inline",
            key: "residential",
            artifact: residentialLease.toJSON({ includeSchema: false }),
          },
          {
            type: "inline",
            key: "commercial",
            artifact: commercialLease.toJSON({ includeSchema: false }),
          },
          {
            type: "inline",
            key: "disclosure",
            artifact: leadPaintDisclosure.toJSON({ includeSchema: false }),
          },
          { type: "inline", key: "checklist", artifact: leaseChecklist.toJSON({ includeSchema: false }) },
        ])
        .build();

      expect(leaseBundle).toBeDefined();
      expect(leaseBundle.kind).toBe("bundle");
      expect(leaseBundle.contents).toHaveLength(4);
    });
  });

  describe("Extract TypeScript types from artifacts and validate", () => {
    test("infers form data type and validates with correct data", () => {
      const leaseAgreement = para
        .form()
        .name("residential-lease-agreement")
        .version("1.0.0")
        .title("Residential Lease Agreement")
        .fields({
          leaseId: { type: "uuid", label: "Lease ID" },
          propertyAddress: {
            type: "address",
            label: "Property Address",
            required: true,
          },
          monthlyRent: { type: "money", label: "Monthly Rent", required: true },
          leaseStartDate: { type: "date", label: "Lease Start Date" },
        })
        .build();

      type LeaseData = InferFormPayload<typeof leaseAgreement>;

      const data: LeaseData = {
        fields: {
          leaseId: "550e8400-e29b-41d4-a716-446655440000" as const,
          propertyAddress: {
            line1: "123 Main St",
            locality: "Portland",
            region: "OR",
            postalCode: "97201",
            country: "USA",
          },
          monthlyRent: { amount: 1500, currency: "USD" },
          leaseStartDate: "2024-02-01",
        },
      };

      // Verify form is valid
      expect(leaseAgreement.isValid()).toBe(true);

      // Fill form with data
      const filled = leaseAgreement.fill(data);
      expect(filled).toBeDefined();
      expect(filled.fields).toBeDefined();
      expect(filled.getField("leaseId")).toBe(
        "550e8400-e29b-41d4-a716-446655440000"
      );
    });
  });
});
