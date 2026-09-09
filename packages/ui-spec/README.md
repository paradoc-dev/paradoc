# @paradoc/ui-spec

> **In development; not yet published.** This package is currently `private: true` and lives in the Paradoc workspace for internal consumers (e.g. the landing playground). It will graduate to public npm publishing in a future release.

A **headless UI specification** for Paradoc artifacts. Maps form fields to typed, validated presentation trees. The companion private package `@paradoc/ui-catalog` binds this spec to shadcn controls.

## What it does

Given a `FormField` from `@paradoc/types` (text, number, enum, address, person, etc.), produces a JSON spec describing which input component should render it and with what typed props. The package has **no React, no shadcn, and no rendering runtime**. Consumers validate the tree and wire catalog component names to their own controls.

```ts
import { fieldToSpec, validateSpec } from "@paradoc/ui-spec";
import type { FormField } from "@paradoc/types";

const animalField: FormField = {
  type: "enum",
  label: "Pet species",
  enum: [{ value: "dog", label: "Dog" }, { value: "cat", label: "Cat" }, { value: "fish", label: "Fish" }],
};

const spec = validateSpec(fieldToSpec(animalField, { fieldPath: "pet.species" }));
// → {
//     type: "EnumPicker",
//     props: {
//       label: "Pet species",
//       options: [
//         { label: "Dog", value: "dog" },
//         { label: "Cat", value: "cat" },
//         { label: "Fish", value: "fish" },
//       ],
//     },
//     fieldPath: "pet.species",
//   }
```

The consumer feeds this validated tree to its renderer. The renderer maps `EnumPicker` to a real control and emits a concrete field action when the user submits a value.

## Architecture: why headless

The package depends on `zod` plus the canonical schemas and types from Paradoc. It has zero React peer dependency and no shadcn coupling. Two reasons:

1. **No bundle duplication** — apps that already have shadcn primitives (e.g. via `@paradoc/common` in the platform monorepo) shouldn't load a second copy
2. **Consumer freedom** — the host chooses its rendering technology and maps the typed component names to its own controls

## Catalog components

The catalog defines the following input primitives. See `src/catalog.ts` for the full Zod-typed prop schemas.

| Component | Used for paradoc field types |
|---|---|
| `TextInput`, `TextArea` | `text`, `email`, `uuid`, `uri` |
| `NumberInput`, `MoneyInput`, `PercentageInput` | `number`, `money`, `percentage` |
| `CoordinateInput`, `BboxInput` | `coordinate`, `bbox` (canonical geographic values; renderer support is host-owned) |
| `YesNoToggle` | `boolean` |
| `EnumPicker`, `MultiSelectChips` | `enum`, `multiselect` |
| `DateInput`, `DateTimeInput`, `TimeInput`, `DurationInput` | `date`, `datetime`, `time`, `duration` |
| `EmailInput`, `PhoneInput`, `UriInput` | typed text variants with format validation |
| `AddressForm`, `PersonForm`, `OrganizationForm` | `address`, `person`, `organization` |
| `IdentificationInput` | `identification` |
| `RatingStars` | `rating` |
| `Fieldset` | `fieldset` (recursive container) |
| `List` | `list` (recursive repeatable container; its child is the item template) |

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
