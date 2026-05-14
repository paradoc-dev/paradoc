# @paradoc/ui-catalog

> **In development; not yet published.** This package is currently `private: true` and lives in the Paradoc workspace for internal consumers (e.g. the landing playground). It will graduate to public npm publishing in a future release.

A **headless catalog** of input UI primitives for Paradoc artifacts. Maps form fields to renderable spec fragments — bring your own renderer.

## What it does

Given a `FormField` from `@paradoc/types` (text, number, enum, address, person, etc.), produces a JSON spec describing which input component should render it and with what props. The spec format is compatible with [json-render](https://github.com/vercel-labs/json-render), but the package itself has **no React, no shadcn, and no rendering runtime** — consumers wire the catalog component names to their own React (or Vue, or Svelte) implementations.

```ts
import { fieldToSpec } from "@paradoc/ui-catalog";
import type { FormField } from "@paradoc/types";

const animalField: FormField = {
  type: "enum",
  label: "Pet species",
  enum: ["dog", "cat", "fish"],
};

const spec = fieldToSpec(animalField, { fieldPath: "/pet/species" });
// → {
//     type: "EnumPicker",
//     props: {
//       label: "Pet species",
//       options: [
//         { label: "dog", value: "dog" },
//         { label: "cat", value: "cat" },
//         { label: "fish", value: "fish" },
//       ],
//     },
//     bindings: { value: { $bindState: "/pet/species" } },
//     submitAction: { type: "submitFieldValue", fieldPath: "/pet/species" },
//   }
```

The consumer feeds this spec to its renderer. The renderer maps `EnumPicker` to a real React (or other) component.

## Architecture: why headless

The package depends only on `zod` and types from `@paradoc/types`. It has zero React peer dependency and no shadcn coupling. Two reasons:

1. **No bundle duplication** — apps that already have shadcn primitives (e.g. via `@paradoc/common` in the platform monorepo) shouldn't load a second copy
2. **Consumer freedom** — render with React + shadcn, or React + Material UI, or Vue, or terminal-ink, or anything else that knows how to map component names to renderers

## Catalog components

The catalog defines the following input primitives. See `src/catalog.ts` for the full Zod-typed prop schemas.

| Component | Used for paradoc field types |
|---|---|
| `TextInput`, `TextArea` | `text`, `email`, `uuid`, `uri` |
| `NumberInput`, `MoneyInput`, `PercentageInput` | `number`, `money`, `percentage` |
| `YesNoToggle` | `boolean` |
| `EnumPicker`, `MultiSelectChips` | `enum`, `multiselect` |
| `DateInput`, `DateTimeInput`, `TimeInput`, `DurationInput` | `date`, `datetime`, `time`, `duration` |
| `EmailInput`, `PhoneInput`, `UriInput` | typed text variants with format validation |
| `AddressForm`, `PersonForm`, `OrganizationForm` | `address`, `person`, `organization` |
| `IdentificationInput` | `identification` |
| `RatingStars` | `rating` |
| `Fieldset` | `fieldset` (recursive container) |

## Writing a registry (illustrative)

A registry is a lookup table that maps catalog component names to actual implementations. Here's a minimal example showing two components — a real registry would cover all of them.

```tsx
// app/playground/registry.tsx
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";  // your shadcn primitive

type Registry = Record<string, (props: { spec: any; emit: (action: any) => void }) => ReactNode>;

export const registry: Registry = {
  TextInput: ({ spec, emit }) => (
    <Input
      placeholder={spec.props.placeholder}
      onChange={(e) => emit({ type: "submitFieldValue", value: e.target.value })}
    />
  ),

  EnumPicker: ({ spec, emit }) => (
    <div role="radiogroup">
      {spec.props.options.map((opt) => (
        <button key={opt.value} onClick={() => emit({ type: "submitFieldValue", value: opt.value })}>
          {opt.label}
        </button>
      ))}
    </div>
  ),
};
```

A full reference registry implementation for the Paradoc landing playground lives in `platform/apps/landing/src/components/playground-registry/`. Other apps will write their own.

## Future graduation

When this package graduates to public npm publishing:

- `"private": true` → removed
- Added to `publish-npm-paradoc.sh` PACKAGES array (after `@paradoc/types` and `@paradoc/schemas`, before `@paradoc/sdk`)
- Inaugural `0.1.0` `CHANGELOG.md` entry
- Lockstep version-bumped with the rest of the public packages from that release on
