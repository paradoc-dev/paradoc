---
name: sdk
description: TypeScript SDK surface — @paradoc/core, @paradoc/sdk, @paradoc/renderers — builder vs object pattern, fill lifecycle, type inference, runtime phases
metadata:
  tags: sdk, typescript, builder, object-pattern, fill, safefill, lifecycle, type-inference, partialfill, signers
---

# Paradoc SDK Surface

TypeScript API for defining and operating on Paradoc artifacts. Use this surface when:

- Importing from `@paradoc/core`, `@paradoc/sdk`, `@paradoc/renderers`, `@paradoc/renderer-*`, `@paradoc/serialization`, `@paradoc/resolvers`
- Defining artifacts in code (not editing JSON/YAML directly)
- Filling, validating, signing, or rendering at runtime in a Node.js / Bun / browser app

For raw JSON/YAML editing, use the [schemas.md](./schemas.md) surface. For CLI usage, see [cli.md](./cli.md).

## Imports

ALWAYS import from public entry points. NEVER from `@paradoc/core/dist/...` or other internal sub-paths.

```typescript
import { para, type InferFormPayload } from "@paradoc/core";
import { textRenderer } from "@paradoc/renderer-text";
import { pdfRenderer } from "@paradoc/renderer-pdf";
import { docxRenderer } from "@paradoc/renderer-docx";
import { createFsResolver } from "@paradoc/resolvers";
import { createSerializer, usaSerializers } from "@paradoc/serialization";
```

## Two Creation Patterns

All artifacts support **object pattern** (preferred) and **builder pattern**.

### Object pattern

```typescript
const form = para.form({
  name: "residential-lease",
  version: "1.0.0",
  title: "Residential Lease Agreement",
  fields: {
    propertyAddress: { type: "address", label: "Property Address", required: true },
    monthlyRent: { type: "money", label: "Monthly Rent", required: true },
  },
});
```

### Builder pattern

```typescript
const form = para.form()
  .name("residential-lease")
  .version("1.0.0")
  .title("Residential Lease Agreement")
  .fields({
    propertyAddress: { type: "address", label: "Property Address", required: true },
    monthlyRent: { type: "money", label: "Monthly Rent", required: true },
  })
  .build();
```

NEVER mix the two patterns within one artifact. Builder chains MUST end with `.build()`.

When working in an existing project, match whichever pattern is already in use.

For artifact shapes (form / document / bundle / checklist), see [artifacts.md](./artifacts.md). Field-level patterns: [fields.md](./fields.md). Parties: [parties.md](./parties.md). Logic: [logic.md](./logic.md).

## Core Pipeline

```
define artifact → fill(data) → validate → render(renderer, layer)
```

Forms add parties and signatures between validate and render.

## Filling Forms

Use `fill()` (throws on error) or `safeFill()` (returns result):

```typescript
// Throws FormValidationError on failure
const draft = form.fill({
  fields: {
    propertyAddress: { line1: "123 Main St", locality: "Portland", region: "OR", postalCode: "97201", country: "USA" },
    monthlyRent: { amount: 1500, currency: "USD" },
  },
});

// Returns discriminated result, NEVER throws
const result = form.safeFill({ fields: { /* ... */ } });
if (result.success) {
  const draft = result.data;
  const rules = result.rules; // FormRulesValidationResult
} else {
  console.error(result.error); // FormValidationError
}
```

ALWAYS prefer `safeFill()` in production code where errors are expected.

### Fill options

```typescript
const draft = form.fill(data, {
  rules: true, // run validation rules (default: true)
});
```

### Validation pipeline

When `fill()` / `safeFill()` runs:

1. **Schema validation** — values match declared types
2. **Constraint validation** — min/max, required, pattern, enum membership
3. **Default application** — missing optional fields get defaults
4. **Logic evaluation** — `visible` / `required` expressions, defs, rules

### Validating without filling

```typescript
const parseResult = form.parseData(data);     // throws on failure
const safeResult = form.safeParseData(data);  // returns result
```

### Validating the schema itself

```typescript
// Design-time (FormInstance) — returns StandardSchema result
if (!form.isValid()) {
  const result = form.validate();
  if ("issues" in result) {
    console.error(result.issues);
  }
}

// Runtime (DraftForm) — returns FormValidationResult { valid, rules }
const result = draft.validate();
if (!result.valid) {
  console.error(result.rules);
}
```

### Loading from unknown input

```typescript
const form = para.form.from(unknownData);          // throws on invalid
const result = para.form.safeFrom(unknownData);     // returns result
```

## Progressive Fill (AI / Multi-Turn)

For incremental or AI-driven filling: `partialFill()` creates a draft with partial data, then `update()` adds more.

```typescript
// Throws on invalid provided fields
const draft = form.partialFill({
  fields: { propertyAddress: { line1: "123 Main St", locality: "Portland", region: "OR", postalCode: "97201", country: "USA" } },
});

// Safe variant
const result = form.safePartialFill({ fields: { /* ... */ } });

// Update an existing draft (throws on error)
const updated = draft.update({ fields: { monthlyRent: { amount: 1500, currency: "USD" } } });

// Safe update
const updateResult = draft.safeUpdate({ fields: { /* ... */ } });
```

### Fill state inspection

```typescript
const state = draft.getFillState();           // { filled, total, percentage }
const next = draft.getNextFillTarget();        // FillTarget | null
const targets = draft.getAvailableFillTargets(); // FillTarget[]
```

Essential for AI agent workflows where forms are filled incrementally.

## Form Lifecycle Phases

Forms progress through three immutable phases. Mutations return new objects. Phase transitions are one-way — NEVER go backwards.

| Phase | Type | Transition |
|-------|------|------------|
| `draft` | `DraftForm<F>` | `prepareForSigning()` |
| `signable` | `SignableForm<F>` | `finalize()` |
| `executed` | `ExecutedForm<F>` | Terminal |

```typescript
const draft = form.fill(data);

// Mutate fields in draft phase
draft.setField("monthlyRent", { amount: 2000, currency: "USD" });
draft.updateFields({ monthlyRent: { amount: 2000, currency: "USD" } });

// Transition to signable
const signable = draft.prepareForSigning();

// Capture signatures (positional: role, partyId, signerId, locationId)
signable.captureSignature("landlord", "landlord-1", "signer-1", "sig-loc-1");

// Status check
const status = signable.getOverallSignatureStatus();

// Finalize
const executed = signable.finalize();
```

For party data shape, see [parties.md](./parties.md).

## Document and Checklist Lifecycle

Documents have two phases: `draft → final`.

```typescript
const disclosure = para.document({ /* ... */ });
const draft = disclosure.prepare("pdf");
const final = draft.finalize();
```

Checklists have two phases: `draft → completed`.

```typescript
const checklist = para.checklist({ /* ... */ });
const draft = checklist.fill({ task_1: true, review: "approved" });
draft.setItem("task_1", true);
const completed = draft.complete();
```

Bundles have three phases (like forms): `draft → signable → executed`. Set runtime instances on bundle contents:

```typescript
const draft = bundle.prepare();
draft.setContent("lease", filledLeaseDraft); // must be a runtime instance
const signable = draft.prepareForSigning();
const executed = signable.finalize();
```

Assemble bundle outputs with multiple renderers:

```typescript
const assembled = await bundle.assemble({
  renderers: { text: textRenderer(), pdf: pdfRenderer() },
  resolver: createFsResolver({ root: process.cwd() }),
});
```

## Type Inference

Compile-time inference from form definitions:

```typescript
import { type InferFormPayload } from "@paradoc/core";

type LeaseData = InferFormPayload<typeof leaseForm>;
// => {
//   fields: {
//     address: { line1: string, ... }       // required
//     rent: { amount: number, currency: string }  // required
//     startDate: string                    // required
//     notes?: string                       // optional
//   }
// }
```

Only `required: true` (literal boolean) makes a field required in the inferred type. Expression-based `required` produces an optional field — evaluated at runtime.

If type inference is not working, check:

1. Builder chain ended with `.build()`
2. Object pattern uses a single `para.form({...})` call (no intermediate variables that widen the type)
3. Imports are from `@paradoc/core` (not internal paths)

### Field type → TypeScript

| Field Type | TypeScript Type |
|-----------|----------------|
| `text`, `email`, `uuid`, `uri` | `string` |
| `boolean` | `boolean` |
| `number`, `percentage`, `rating` | `number` |
| `date`, `datetime`, `time`, `duration` | `string` |
| `money` | `{ amount: number, currency: string }` |
| `address` | `{ line1, line2?, locality, region, postalCode, country }` |
| `phone` | `{ number, type?, extension? }` |
| `person` | `{ name, title?, firstName?, ... }` |
| `organization` | `{ name, legalName?, taxId?, ... }` |
| `identification` | `{ type, number, issuer?, ... }` |
| `coordinate` | `{ lat, lon }` |
| `bbox` | `{ southWest, northEast }` |
| `enum` | union of literal values |
| `multiselect` | array of enum values |
| `fieldset` | recursive mapped type |

### Compiling to JSON Schema

```typescript
import { compile } from "@paradoc/core";

const jsonSchema = compile(form);
```

## Serialization

Design-time `FormInstance` supports options:

```typescript
const json = form.toJSON({ includeSchema: false });
const yaml = form.toYAML();
const clone = form.clone();
```

Runtime `DraftForm.toJSON()` takes no arguments:

```typescript
const json = draft.toJSON();
```

ALWAYS pass `{ includeSchema: false }` when embedding artifacts in bundles.

## Versioning

Use semver (`major.minor.patch`):

| Bump | When |
|------|------|
| Major (2.0.0) | Removing/renaming fields, changing types, removing party roles, making optional → required |
| Minor (1.1.0) | New optional fields, new layers, new annexes |
| Patch (1.0.1) | Label changes, template corrections, typos |

Use descriptive kebab-case names: `"residential-lease-agreement"`, NOT `"form1"` or `"My Form"`.

## Rendering

For full renderer API, see [rendering.md](./rendering.md). Quick example:

```typescript
const text = await form.fill(data).render({
  renderer: textRenderer(),
  resolver: createFsResolver({ root: process.cwd() }),
  layer: "markdown",
});
```

## Common SDK Issues

**Type inference not working on filled form**
Cause: Builder chain missing `.build()`, or intermediate variables widening the type.
Fix: End builder chains with `.build()`. For object pattern, define artifact in a single `para.form({...})` call.

**Wrong import paths — module not found**
Cause: Importing from internal sub-paths (e.g., `@paradoc/core/dist/fields`).
Fix: ALWAYS import from package root: `@paradoc/core`, `@paradoc/sdk`, `@paradoc/renderers`.

**Builder vs object pattern mixing**
Cause: Passing a `para.field.money().label(...)` builder inside an object-pattern artifact, or vice versa.
Fix: Pick one pattern per artifact. Object pattern uses plain objects; builder pattern uses `para.field.*()` chains.

**Render produces blank output**
Cause: Missing layer, or rendering a form before `fill()`.
Fix: Ensure at least one layer is defined. Call `fill()` before `render()`. Verify renderer matches layer's MIME type.

**Schema duplication errors when bundling**
Cause: Forgot `{ includeSchema: false }` when inlining artifacts in a bundle.
Fix: ALWAYS pass `{ includeSchema: false }` to `toJSON()` when bundling.

## See Also

- [artifacts.md](./artifacts.md) — form / document / bundle / checklist shapes
- [fields.md](./fields.md) — field types, builders, type inference
- [parties.md](./parties.md) — party data, signature lifecycle
- [logic.md](./logic.md) — defs, rules, runtime evaluation
- [layers.md](./layers.md) — layer definitions, Handlebars
- [rendering.md](./rendering.md) — render API, resolvers
- [serialization.md](./serialization.md) — locale-aware formatters
- [cli.md](./cli.md) — `para` CLI surface
- [schemas.md](./schemas.md) — raw JSON/YAML surface
