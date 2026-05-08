---
"@paradoc/renderer-pdf": patch
---

Fix: handle multiselect arrays in `field:qualifier` checkbox bindings

The `field:qualifier` binding handler only branched on `enum` and `boolean`
field types. Bindings of the form `"field:value": "field:value"` against a
`multiselect` field fell through to the split-field code path, which silently
no-op'd because `parseInt("non-numeric-value", 10)` returned `NaN`. Result:
multiselect-value checkboxes stayed unchecked even when the data array
included the value.

Fix extends the checkbox branch to recognize `multiselect`: when the field
type is `multiselect`, check the box iff the qualifier appears in the value
array (`Array.isArray(value) && value.includes(qualifier)`). Enum and
boolean handling are unchanged.

Adds three new tests in `render-with-bindings.test.ts` covering: multi-value
selection, empty array, and undefined field.
