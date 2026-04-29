<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=core" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/core</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=core)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=core) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Fundamental package for modeling business documents as typed, versioned artifacts. Provides builders for Forms, Documents, Checklists, and Bundles with schema-driven validation and composition.

- 🏗️ **Type-safe builders** - Fluent API for defining document structures
- 📋 **Four artifact types** - Form, Document, Checklist, and Bundle builders
- ✅ **Schema-driven validation** - Built-in structure and constraint validation
- 🎯 **Composable design** - Reuse fields and artifacts across definitions
- 📦 **Standalone library** - Use independently or with @paradoc/sdk

## Installation

```bash
npm install @paradoc/core
```

## Usage

Define forms with parties, fields, and validation rules:

```typescript
import { para } from "@paradoc/core";

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
    leaseStartDate: { type: "date", label: "Lease Start Date", required: true },
  })
  .build();
```

Add file attachments and advanced field types:

```typescript
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
      enum: ["no-pets", "small-pets", "all-pets"],
      label: "Pet Policy",
      required: true,
    },
  })
  .build();
```

Define static documents with metadata:

```typescript
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
```

Define workflow checklists with status tracking:

```typescript
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
    { id: "lease_signed", title: "Lease Signed", status: { kind: "boolean" } },
  ])
  .build();
```

Compose artifacts into bundles:

```typescript
const propertyAddress = {
  type: "address",
  label: "Property Address",
  required: true,
};
const monthlyRent = { type: "money", label: "Monthly Rent", required: true };

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

const leaseBundle = para
  .bundle()
  .name("residential-lease-bundle")
  .version("1.0.0")
  .contents([
    { type: "inline", key: "residential", artifact: residentialLease.toJSON({ includeSchema: false }) },
    { type: "inline", key: "commercial", artifact: commercialLease.toJSON({ includeSchema: false }) },
    { type: "inline", key: "disclosure", artifact: leadPaintDisclosure.toJSON({ includeSchema: false }) },
    { type: "inline", key: "checklist", artifact: leaseChecklist.toJSON({ includeSchema: false }) },
  ])
  .build();
```

Extract TypeScript types from artifacts:

```typescript
import { type InferFormPayload } from "@paradoc/core";

type LeaseData = InferFormPayload<typeof leaseAgreement>;

const data: LeaseData = {
  fields: {
    leaseId: "550e8400-e29b-41d4-a716-446655440000",
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
```

Validate and fill forms with data:

```typescript
// Check if the form schema itself is valid
if (!leaseAgreement.isValid()) {
  console.log("Form schema is invalid");
}

// Fill the form with data (validates during fill)
try {
  const filled = leaseAgreement.fill(data);
  console.log("Form filled successfully");
} catch (error) {
  console.error("Validation failed:", error);
}

// Or use safeFill to avoid exceptions
const result = leaseAgreement.safeFill(data);
if (result.success) {
  const filled = result.data;
} else {
  console.error("Validation failed:", result.error);
}
```

For rendering artifacts to PDF, DOCX, HTML, or other formats, use `@paradoc/sdk` with the renderers package. For complete production examples, see `/incubator/apps/demo/src/demos/leasing`. For API reference and advanced patterns, visit [docs.paradoc.dev](https://docs.paradoc.dev).

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/core/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/sdk`](../sdk) - Complete framework with renderers
- [`@paradoc/types`](../types) - TypeScript utilities and types
- [`@paradoc/schemas`](../schemas) - JSON Schema definitions
- [`@paradoc/renderers`](../renderers) - All renderers (PDF, DOCX, Text)
- [`@paradoc/resolvers`](../resolvers) - File and environment resolvers

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
