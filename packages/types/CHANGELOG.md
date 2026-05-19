# @paradoc/types

## 0.2.0

- **Breaking**: `EnumField.enum` and `MultiselectField.enum` are now `readonly EnumOption[]` (previously `readonly (string | number)[]`). Each option is `{ value, label? }`.
- **Breaking**: `MultiselectField.default` is now `readonly EnumOptionValue[]`.
- Add `EnumOption` and `EnumOptionValue` to the public type exports.
- Add optional `ArtifactBase.language` (BCP-47 source language tag; defaults to `"en"` when omitted).

## 0.1.1

Add `capacity` and `printed_name` signature block types.

## 0.1.0

Initial public release.
