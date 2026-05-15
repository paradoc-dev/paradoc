<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=main" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">Welcome to Paradoc</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=main)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=main) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

An umbrella package containing the Paradoc core framework, serialization, and renderers.

- 📦 **All-in-one** - Single install
- 🏗️ **Type-safe builders** - Fluent API with full TypeScript support
- 📄 **Multi-format rendering** - PDF, DOCX, HTML, Text from one definition
- ✅ **Automatic validation** - Schema-driven constraints and validation
- 🎯 **Composable artifacts** - Reuse fields, forms, and documents across definitions
- 🤖 **AI-ready** - Built for agent ingestion and verification

## Installation

```bash
npm install @paradoc/sdk
```

## Usage

Define forms with parties, fields, and output layers:

```typescript
import { para, textRenderer } from "@paradoc/sdk";
import { createFsResolver } from "@paradoc/resolvers";

const leaseAgreement = para
  .form()
  .name("residential-lease-agreement")
  .version("1.0.0")
  .title("Residential Lease Agreement")
  .defaultLayer("markdown")
  .layers({
    markdown: {
      kind: "file",
      path: "fixtures/lease-agreement.md",
      mimeType: "text/markdown",
    },
    html: {
      kind: "file",
      path: "fixtures/lease-agreement.html",
      mimeType: "text/html",
    },
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

// Fill with data (automatic validation)
const filledLease = leaseAgreement.fill({
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
});

// Render to multiple formats
const resolver = createFsResolver({ root: process.cwd() });
const markdown = await filledLease.render({
  renderer: textRenderer(),
  resolver,
  layer: "markdown",
});
const html = await filledLease.render({
  renderer: textRenderer(),
  resolver,
  layer: "html",
});
```

Add file attachments and advanced field types:

```typescript
const advancedLease = para
  .form()
  .name("commercial-lease")
  .version("1.0.0")
  .title("Commercial Lease Agreement")
  .defaultLayer("markdown")
  .layers({
    markdown: {
      kind: "file",
      path: "fixtures/commercial-lease.md",
      mimeType: "text/markdown",
    },
  })
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
```

Define static documents and workflow checklists:

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

Combine forms, documents, and checklists into a bundle:

```typescript
const leaseBundle = para
  .bundle()
  .name("residential-lease-bundle")
  .version("1.0.0")
  .title("Residential Lease Bundle")
  .contents([
    { type: "inline", key: "leaseAgreement", artifact: leaseAgreement.toJSON({ includeSchema: false }) },
    { type: "inline", key: "leadPaintDisclosure", artifact: leadPaintDisclosure.toJSON({ includeSchema: false }) },
    { type: "inline", key: "checklist", artifact: leaseChecklist.toJSON({ includeSchema: false }) },
  ])
  .build();
```

Get automatic TypeScript types from your form definitions:

```typescript
import { type InferFormPayload } from "@paradoc/sdk";

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
if (!form.isValid()) {
  console.log("Form schema is invalid");
}

// Fill the form with data (validates during fill)
const filled = form.fill(data); // throws if validation fails

// Or use safeFill to avoid exceptions
const result = form.safeFill(data);
if (result.success) {
  const filled = result.data;
}
```

For a complete production example, see `/incubator/apps/demo/src/demos/leasing`. For API reference and advanced patterns, visit [docs.paradoc.dev](https://docs.paradoc.dev).

## Changelog

View package Changelogs for update.

## Core packages

- [`@paradoc/core`](https://github.com/paradoc-dev/paradoc/blob/main/packages/core) - Core artifacts and builders
- [`@paradoc/types`](https://github.com/paradoc-dev/paradoc/blob/main/packages/types) - TypeScript utilities and types
- [`@paradoc/schemas`](https://github.com/paradoc-dev/paradoc/blob/main/packages/schemas) - JSON Schema definitions
- [`@paradoc/serialization`](https://github.com/paradoc-dev/paradoc/blob/main/packages/serialization) - Locale-aware formatting
- [`@paradoc/resolvers`](https://github.com/paradoc-dev/paradoc/blob/main/packages/resolvers) - File and environment resolvers
- [`@paradoc/renderers`](https://github.com/paradoc-dev/paradoc/blob/main/packages/renderers) - All renderers (PDF, DOCX, Text)

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
