---
name: sdk
description: TypeScript SDK surface. Install and imports, the package map, defining artifacts (object and builder), loading and migrating files, documents, checklists and bundles at runtime, serialization, and type inference.
metadata:
  tags: sdk, typescript, install, imports, builder, object-pattern, load, migrate, bundle, checklist, document, type-inference
---

# SDK surface

**Contents:** [Install](#install) · [Define an artifact](#define-an-artifact) · [Load and migrate](#load-and-migrate) · [Check a definition](#check-a-definition) · [Form runtime](#form-runtime) · [Documents](#documents) · [Checklists](#checklists) · [Bundles](#bundles) · [Serialize](#serialize) · [Type inference](#type-inference) · [Errors](#errors)

Use this surface to define, load, fill, render and seal artifacts from TypeScript. For the shape of what you define, load the topic ref: [artifacts.md](./artifacts.md) (kinds), [fields.md](./fields.md), [parties.md](./parties.md), [logic.md](./logic.md), [layers.md](./layers.md).

## Install

```bash
npm install @paradoc/sdk
npm install @paradoc/resolvers   # only when an artifact has file layers (PDF, DOCX, template files)
```

```typescript
import { p } from "@paradoc/sdk";
import { createFsResolver } from "@paradoc/resolvers/fs";
```

`@paradoc/sdk` is the umbrella. It re-exports all of `@paradoc/core`, `@paradoc/format` and `@paradoc/sessions`, plus `renderLayer`, `hostedSealAdapter`, the placement helpers (`locate`, `locator`, `extractFieldsFromPdf`) and `expr` (the `@paradoc/expr` namespace). Import each package only from the paths in its `exports`:

| Package | Import paths | Install it when |
|---------|--------------|-----------------|
| `@paradoc/sdk` | `@paradoc/sdk` | Always, for TypeScript work |
| `@paradoc/resolvers` | `/fs`, `/memory` (no root export) | The artifact has file layers |
| `@paradoc/render` | root, `/text`, `/text/field-formatter`, `/pdf`, `/docx` | You call `renderPdf`, `inspectPdf`, `mergePdfs` or a template check directly ([rendering.md](./rendering.md)) |
| `@paradoc/essentials` | root, `/tax`, `/banking`, `/employment` | You fill a standard form |
| `@paradoc/core`, `@paradoc/format`, `@paradoc/sessions`, `@paradoc/expr` | root | You must keep a bundle small; the SDK already re-exports them |

## Define an artifact

Use the **object pattern** by default. One `p.form({...})` call keeps literal types for [type inference](#type-inference).

```typescript
import { p } from "@paradoc/sdk";

const lease = p.form({
  name: "residential-lease",
  version: "1.0.0",
  title: "Residential Lease",
  fields: {
    propertyAddress: { type: "address", label: "Property address", required: true },
    monthlyRent: { type: "money", label: "Monthly rent", required: true },
    hasPets: { type: "boolean", label: "Pets allowed", default: false },
    petDeposit: { type: "money", label: "Pet deposit", visible: "fields.hasPets", required: "fields.hasPets" },
  },
  parties: {
    tenant: { label: "Tenant", partyType: "person", signature: { required: true } },
  },
  rules: {
    rentPositive: { expr: "fields.monthlyRent.amount > 0", message: "Rent must be positive" },
  },
});
```

The **builder pattern** chains setters and ends with `.build()`. Its `.field()` and `.fields()` take plain objects, field builders, or a mix.

```typescript
const lease = p.form()
  .name("residential-lease")
  .fields({
    monthlyRent: p.field.money().label("Monthly rent").required(),
    notes: { type: "text", label: "Notes" },
  })
  .build();
```

| Constraint | Detail |
|------------|--------|
| Plain values in the object pattern | A field builder inside `p.form({...})` fails with `Invalid discriminator value`. Call `.build()` on it first, or use the builder pattern. |
| Builder methods | `name`, `version`, `title`, `description`, `code`, `language`, `releaseDate`, `metadata`, `instructions`, `agentInstructions`, `defs`/`def`, `field`/`fields`, `layers`/`layer`/`inlineLayer`/`fileLayer`, `defaultLayer`, `annex`/`annexes`, `allowAdditionalAnnexes`, `party`/`parties`, `build` |
| Other kinds | `p.document`, `p.checklist` and `p.bundle` take the same two patterns |
| File layers | Pass the resolver at construction: `p.form(def, { resolver })`. `render()` takes no resolver. |

<!-- dep:C5 -->
The form builder has `.rules()`. Field builder methods are in [fields.md § Field builder methods](./fields.md#field-builder-methods).

<!-- dep:C2 -->
`p.form()`, `p.form.from()` and the other kinds' entry points enforce the current `$schema` and throw `SchemaVersionError` on any other version.

## Load and migrate

Load an artifact file with `load` (text) or `loadFromObject` (a parsed object). Both return the instance for the artifact's `kind` and enforce the schema version.

```typescript
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { load, isFormInstance } from "@paradoc/sdk";
import { createFsResolver } from "@paradoc/resolvers/fs";

const file = "forms/lease.json";
const artifact = load(readFileSync(file, "utf8"), {
  resolver: createFsResolver({ root: dirname(file) }), // file-layer paths are relative to the artifact file
});
if (!isFormInstance(artifact)) throw new Error("expected a form");
```

| Function | Input | `$schema` rule | Failure |
|----------|-------|----------------|---------|
| `load(text, { resolver })` | JSON or YAML text | Required, must be current | Throws `LoadError` or `SchemaVersionError` |
| `loadFromObject(obj, { resolver })` | Parsed object | Optional; if present, must be current | Same |
| `safeLoad`, `safeLoadFromObject` | Same | Same | Returns `{ success, data \| error }` |
| `p.form.from(obj, { resolver })`, `p.form.safeFrom(...)` | Parsed form object | Optional; if present, must be current | Throws `SchemaVersionError` or `Error("Invalid Form ...")` |

A bundle takes no resolver (its members carry their own); passing one throws `BundleResolverError`. Narrow the result with `isFormInstance`, `isDocumentInstance`, `isChecklistInstance` or `isBundleInstance`. Use `createMemoryResolver({ contents: { "lease.pdf": bytes } })` from `@paradoc/resolvers/memory` in a browser or a test.

Migrate an older artifact before you load it. `migrateArtifact` returns a new object and validates it.

```typescript
import { migrateArtifact } from "@paradoc/sdk";

const oldArtifact = { $schema: "https://schema.paradoc.dev/2026-08-10.json", kind: "form", name: "lease" };
const result = migrateArtifact(oldArtifact); // { from } names the version when $schema has none
const current = result.artifact; // result.status is "current" or "migrated"
```

`migrateArtifactSource(text, { format?, from? })` does the same on JSON or YAML text and returns `{ status, content }` in the input's format. Both throw `SchemaMigrationError` with a `code` (`missing-version`, `unknown-version`, `version-conflict`, `no-migration-path`, `unconvertible-value`, `invalid-result`). The CLI equivalent is [`paradoc migrate`](./cli.md#migrate).

## Check a definition

`p.form({...})` checks structure only. Expressions (defs, rules, `visible`, `required`, template markers) are checked by `validate()` and again when you call `fill()`.

```typescript
import { validate } from "@paradoc/sdk";

const report = lease.validate(); // StandardSchema result
if ("issues" in report && report.issues) console.error(report.issues);

const fromObject = validate(someArtifactObject); // any kind, same result shape
```

`lease.isValid()` returns the same verdict as a boolean. `await validateLayers(artifactObject, { resolver })` also reads each file layer. The CLI `paradoc validate <file>` runs all of these.

## Form runtime

A form moves through these phases:

| Phase | Type | Created by | Moves on with |
|-------|------|-----------|---------------|
| design | `FormInstance` | `p.form`, `load` | `fill()` |
| draft | `DraftForm` | `fill()`, `update()` | `prepareForSigning()` or `seal()` |
| signable | `SignableForm` | | `finalize()` |
| executed | `ExecutedForm` | | terminal |

```typescript
let draft = lease.fill({ fields: { monthlyRent: { amount: 1500, currency: "USD" } } });
draft = draft.update({ parties: { tenant: { name: "Ada Lovelace" } } });
const { summary, next } = draft.getFillState(); // what is still open
```

- Filling, `update()`, fill state, validators, persist and resume, sessions, and PDF extraction: [filling.md](./filling.md).
- Signers, signatories, `seal()`, captures and `finalize()`: [sealing.md](./sealing.md).
- Render options, renderers and resolvers: [rendering.md](./rendering.md).

## Documents

A document has no fields or parties. Its phases are `draft → final`.

```typescript
const policy = p.document({
  name: "privacy-policy",
  layers: { markdown: { kind: "inline", mimeType: "text/markdown", text: "# Privacy Policy" } },
});
const draft = policy.prepare();         // optional target layer key
const text = await draft.render();
const final = draft.finalize();
```

## Checklists

Phases are `draft → completed`. `fill()` and `update()` take partial answers. `complete()` requires every item after defaults; an explicit `false` counts as an answer.

```typescript
const closing = p.checklist({
  name: "closing",
  items: [
    { id: "titleSearch", title: "Title search", status: { kind: "boolean" } },
    {
      id: "appraisal",
      title: "Appraisal",
      status: {
        kind: "enum",
        options: [{ value: "pending", label: "Pending" }, { value: "done", label: "Done" }],
        default: "pending",
      },
    },
  ],
});

let draft = closing.fill();                        // no answers yet
draft = draft.update({ titleSearch: true });
const state = draft.getFillState();                // summary, next target
const completed = draft.complete();                // throws "Missing required checklist item: items.<id>" if one is open
```

`clear("items.<id>")` removes an answer and `reset("items.<id>")` restores its default. `closing.validateItemInput({ itemId, value })` and `validateItemsPatch(items)` check answers before you apply them.

## Bundles

A bundle orders other artifacts. Its phases are `draft → signable → executed`. The bundle shape and its expression context are in [artifacts.md](./artifacts.md#bundle).

```typescript
const application = p.form({
  name: "loan-application",
  fields: { loanAmount: { type: "number", label: "Loan amount", required: true } },
  layers: { markdown: { kind: "inline", mimeType: "text/markdown", text: "Amount: {{fields.loanAmount}}" } },
});
const disclosure = p.document({
  name: "truth-in-lending",
  layers: { markdown: { kind: "inline", mimeType: "text/markdown", text: "# Truth in Lending" } },
});

const loanPackage = p.bundle()
  .name("loan-package")
  .inline("application", application) // takes an instance or a plain object
  .inline("disclosure", disclosure, "forms.application.fields.loanAmount > 10000")
  .build();

let draft = loanPackage.prepare({
  application: application.fill({ fields: { loanAmount: 20000 } }),
  disclosure: disclosure.prepare(),
});
draft = draft.setContent("application", application.fill({ fields: { loanAmount: 5000 } }));

const included = Object.keys(draft.getIncludedContents()); // ["application"]
const { outputs } = await draft.render();                   // keyed by content key: { content, mimeType, filename }
const executed = draft.prepareForSigning().finalize();
```

- Each member is a runtime instance that carries its own resolver. The bundle binds none.
- `bundle.assemble({ contents })` renders the included members from the design-time bundle. A nested bundle's parts get folder-style keys such as `nested/docA`.
- `getInclusionState()` lists each member's decision: `included`, `excluded`, or `unresolved` with a reason.
- A sealed packet (one PDF for all members) is `sealBundle`: see [sealing.md](./sealing.md).

## Serialize

| Call | On | Result |
|------|----|--------|
| `toJSON()` | Any instance | Plain object. Design-time instances include `$schema`; pass `{ includeSchema: false }` to omit it. |
| `toYAML()` | Any instance | YAML text with a `yaml-language-server` schema line |
| `clone()` | Any instance | An exact copy |
| `compile(form)` | `FormInstance` | JSON Schema for the fill payload |

Runtime `toJSON()` output resumes with `runtimeFormFromJSON` and its siblings: see [filling.md](./filling.md#persist-and-resume).

## Type inference

```typescript
import { type InferFormPayload, type ProgressiveFormPayload } from "@paradoc/sdk";

type LeasePayload = InferFormPayload<typeof lease>;         // a complete submission
type LeasePatch = ProgressiveFormPayload<typeof lease>;     // what fill() and update() accept
```

- Only a literal `required: true` makes a key required in `InferFormPayload`. An expression `required` gives an optional key.
- In `InferFormPayload`, each party needs its `id` (`"<role>-<index>"`). `fill()` and `update()` assign ids, so a patch can leave them out.
- Inference needs the literal definition. Define it in one `p.form({...})` call or end the builder chain with `.build()`.

| Field type | TypeScript type |
|------------|-----------------|
| `text`, `email`, `uuid`, `uri` | `string` |
| `date`, `datetime`, `time`, `duration` | `string` |
| `number`, `percentage`, `rating` | `number` |
| `boolean` | `boolean` |
| `enum` | union of the option `value`s |
| `multiselect` | array of the option `value`s |
| `money` | `{ amount, currency }` |
| `address`, `phone`, `person`, `organization`, `identification`, `coordinate`, `bbox` | the composite object ([fields.md](./fields.md)) |
| `fieldset` | nested object of its fields |
| `list` | array of the item type |

## Errors

| Message or class | Cause | Fix |
|------------------|-------|-----|
| `SchemaVersionError: The artifact was written for schema version <v>` | Old `$schema` | `migrateArtifact` or `paradoc migrate` |
| `SchemaVersionError: The artifact has no $schema` | `load()` on a file with no `$schema` | Add the current `$schema`, or migrate with `--from` |
| `Invalid Form at fields.<id>.type: Invalid discriminator value` | Unknown field type, or a builder inside `p.form({...})` | Use a schema type; call `.build()` on nested builders |
| `Invalid form definition: Unknown variable: "defs.<name>"` | Defs are referenced by bare name | Write `<name>`, not `defs.<name>` ([logic.md](./logic.md)) |
| `UnboundResolverError: Layer "<key>" is file-backed ("<path>") but ...` | A file layer rendered with no resolver | Pass `{ resolver }` when you construct or load the artifact |
| `BundleResolverError` | A resolver passed to a bundle | Bind resolvers on the members |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` for `@paradoc/resolvers` | The package has no root export | Import `@paradoc/resolvers/fs` or `/memory` |
