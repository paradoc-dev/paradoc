# @paradoc/ui-spec

> **In development; not yet published.** This package is currently `private: true` and is consumed by applications in the Paradoc workspace. Its API may change before publication.

A **headless UI specification** for Paradoc artifacts. It maps form fields to typed, validated presentation trees. The companion private package `@paradoc/ui-catalog` binds this spec to controls.

## What it does

Given a `FormField` from `@paradoc/types` (text, number, enum, address, person, and other field families), `fieldToSpec` produces a JSON spec naming the input component and its typed props. `validateSpec` validates a serialized tree, including component props, child shape, and field targets. The package has **no React, no shadcn, and no rendering runtime**. Consumers validate the tree and wire catalog component names to their own controls.

```ts
import {
  createSubmitFieldValueAction,
  fieldToSpec,
  validateSpec,
} from "@paradoc/ui-spec";
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
//       display: "radio",
//     },
//     fieldPath: "pet.species",
//   }
```

The consumer feeds this validated tree to its renderer. A renderer maps `EnumPicker` to a real control and emits a concrete field action when the user submits a value:

```ts
const action = createSubmitFieldValueAction(spec.fieldPath, "dog");
// → { type: "submitFieldValue", fieldPath: "pet.species", value: "dog" }
```

The action carries the canonical option value, not the label shown to the user.

## State and field targets

`fieldToSpec` maps a field definition. It does not evaluate visibility or requiredness expressions and it does not own session state. The host resolves those values from its current artifact state before presenting a field, and overlays the current answer over the definition default when revisiting a field. That overlay must preserve falsy answers such as `false`, `0`, and an explicitly permitted empty string. An unresolved or hidden field must remain unavailable until the host resolves it.

`fieldPath` is optional context. When it is omitted, the node is unbound and its descendants remain unbound. A path containing `[]`, such as `items[].name`, is a reusable list template. A renderer can submit only a concrete path, such as `items[2].name`; use `resolveConcreteFieldPath` when the host has the repeated-item indices. `createSubmitFieldValueAction` rejects unbound and template paths before an action reaches a session.

`Fieldset` nodes contain recursively addressed children. `List` nodes contain exactly one child, which is the reusable item template. These shapes are part of the typed contract and are checked again by `validateSpec` at the serialized boundary.

## Localization, canonical values, and transport

`MapperContext.translateOption` is an optional, caller-owned label translator. `sourceLanguage` and `targetLanguage` are passed to it only when the caller supplies them. The package does not infer a language or translate free text. Localized labels never replace canonical option values, and canonical object keys remain unchanged, for example `postalCode`, `lat`, and `lon`.

The action type is an in-process TypeScript contract. If a host sends a presentation or action over HTTP, its transport adapter owns the wire conversion and uses snake_case fields such as `chat_id`, `form_session_id`, `field_path`, and `presentation_event_count`; canonical values keep the field schema's own keys and types.

## Architecture: why headless

The package depends on `zod` plus the canonical schemas and types from Paradoc. It has zero React peer dependency and no shadcn coupling. Two reasons:

1. **No bundle duplication** — apps that already have shadcn primitives (e.g. via `@paradoc/common` in the platform monorepo) shouldn't load a second copy
2. **Consumer freedom** — the host chooses its rendering technology and maps the typed component names to its own controls

## Catalog components

The catalog defines the following input primitives. See `src/catalog.ts` for the full Zod-typed prop schemas. A renderer may support a subset of the catalog and must provide a visible fallback for unsupported nodes.

| Component | Used for paradoc field types |
|---|---|
| `TextInput` | `text` and `uuid` |
| `TextArea` | long `text` fields (`maxLength > 200`) |
| `NumberInput` | `number` |
| `MoneyInput`, `PercentageInput` | `money`, `percentage` |
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

A registry is a lookup table that maps catalog component names to actual implementations. Keep the component name, props, and action callback typed. This example shows two entries; a host can add only the controls it supports.

```tsx
// app/playground/registry.tsx
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  createSubmitFieldValueAction,
  type CatalogAction,
  type CatalogComponentName,
  type CatalogPropsFor,
  type SpecNode,
} from "@paradoc/ui-spec";

type RegistryArgs<TName extends CatalogComponentName> = {
  spec: Extract<SpecNode, { type: TName }>;
  emit: (action: CatalogAction) => void;
};

type Registry = Partial<{
  [TName in CatalogComponentName]: (args: RegistryArgs<TName>) => ReactNode;
}>;

export const registry = {
  TextInput: ({ spec, emit }: RegistryArgs<"TextInput">) => {
    const props: CatalogPropsFor<"TextInput"> = spec.props;
    return (
      <Input
        placeholder={props.placeholder}
        defaultValue={props.default}
        onChange={(event) => {
          if (spec.fieldPath === undefined) return;
          emit(createSubmitFieldValueAction(spec.fieldPath, event.target.value));
        }}
      />
    );
  },

  EnumPicker: ({ spec, emit }: RegistryArgs<"EnumPicker">) => {
    const props: CatalogPropsFor<"EnumPicker"> = spec.props;
    return (
      <div role="radiogroup">
        {props.options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => {
              if (spec.fieldPath === undefined) return;
              emit(createSubmitFieldValueAction(spec.fieldPath, option.value));
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  },
} satisfies Registry;
```

A renderer must resolve a list template to a concrete item path before calling `createSubmitFieldValueAction`. It should emit canonical values such as `option.value` and preserve typed composite values instead of converting them to display strings. If the host cannot render a visible component safely, show a visible fallback and let the agent or another host path collect and validate the value. The landing playground currently renders `TextInput`, `TextArea`, `NumberInput`, `CoordinateInput`, `BboxInput`, `YesNoToggle`, `EnumPicker`, `MultiSelectChips`, `DateInput`, `EmailInput`, and `AddressForm`; its remaining catalog nodes use that fallback.
