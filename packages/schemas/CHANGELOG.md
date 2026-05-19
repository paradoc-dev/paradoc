# @paradoc/schemas

## 0.2.0

- **Breaking**: Zod schemas for `EnumField`/`MultiselectField` now expect `EnumOption[]` instead of `(string | number)[]`.
- Add `language` to the artifact base schema.
- Regenerate per-form JSON schemas under `schemas/2026-01-01/`; removed a stale non-standard `"id"` property from each (the JSON-Schema `$id` URL pointer is preserved).

## 0.1.1

- Add `capacity` and `printed_name` to the layer schema's signature block types.
- Fix `address.region` schema entry.

## 0.1.0

Initial public release.
