---
name: templates
description: Template syntax for text (Markdown, HTML, plain) and DOCX layers - markers, roots, conditions, loops, the five signing directives, default output per engine, DOCX commands
metadata:
  tags: templates, markers, if, each, loops, conditions, signature, initials, signatureDate, capacity, printedName, docx, FOR, IF
---

# Templates

**Contents:** [Markers](#markers) · [Roots](#roots) · [Conditions](#conditions) · [Loops](#loops) · [Signing directives](#signing-directives) · [Directive output](#directive-output) · [DOCX commands](#docx-commands) · [Validation](#validation)

Text layers (`text/markdown`, `text/html`, `text/plain`) and DOCX layers are templates. Everything inside `{{ }}` is an artifact expression: the language of `visible`, `required`, defs and rules, described in [logic.md](./logic.md). No JavaScript runs.

A PDF layer is not a template: it maps PDF field names to data through `bindings` ([pdf.md](./pdf.md)). A React composition reads data through components (the `paradoc-react` skill).

## Markers

| Marker | Effect |
|--------|--------|
| `{{expr}}` | Print the value, formatted for its type. HTML layers escape it |
| `{{{expr}}}`, `{{& expr}}` | Print without HTML escaping |
| `{{#if cond}}…{{else}}…{{/if}}` | Condition. `{{else}}` is optional |
| `{{#unless cond}}…{{/unless}}` | Negated condition |
| `{{#each list}}…{{else}}…{{/each}}` | Loop. `{{else}}` renders when the list is empty or missing |
| `{{! note }}` | Comment. Prints nothing |

A block marker that stands alone on its line removes that line from the output, so block markers on their own lines leave no blank lines.

```text
# Residential Lease

**Tenant:** {{fields.tenantName}}
**Monthly rent:** {{fields.monthlyRent}}
**Deposit:** {{fields.monthlyRent.amount * 2}}

{{#if fields.hasPets}}
Pet deposit: {{fields.petDeposit}}
{{/if}}
```

A path prints formatted for its field type: money as `$1,500.00`, an enum or multiselect as its option labels. A computed value is formatted by its result type. Locale and styles come from the formatter ([formatting.md](./formatting.md)).

## Roots

| Root | Example | Notes |
|------|---------|-------|
| `fields.<id>` | `{{fields.address.line1}}` | Field values. A bare `{{tenantName}}` is an unknown reference |
| a def, by name | `{{totalDue}}` | Computed values from `defs`. There is no `defs.` prefix |
| `parties.<role>` | `{{parties.landlord.name}}`, `{{parties.tenant[0].name}}` | A role with `max > 1` is a list |
| `items.<id>` | `{{items.reviewed}}`, `{{items["signed-contract"]}}` | Checklists. Use brackets for ids with hyphens |

Functions from [logic.md](./logic.md) work in templates too, including the party functions: `{{partyCount("tenant")}}`, `{{coalesce(fields.nickname, fields.firstName)}}`.

## Conditions

A condition is a boolean gate ([logic.md § Conditions are boolean](./logic.md#conditions-are-boolean)): compare text, numbers and optional values. A missing value reads as false.

```text
{{#if fields.notes != null}}Notes: {{fields.notes}}{{/if}}
{{#if fields.status == "active" and fields.balance.amount > 0}}Balance due.{{else}}Nothing due.{{/if}}
{{#unless fields.smokingAllowed}}No smoking.{{/unless}}
{{#if parties.tenant[1] != null}}Co-tenant: {{parties.tenant[1].name}}{{/if}}
```

`{{#if fields.notes}}` on a text field fails with `A condition must be boolean, got string. Compare it, such as value != null.`

## Loops

A loop source must be a list. A missing list gives no rows. Inside a loop, `item` is the current row and `parent` the enclosing loop's row. `index(item)` (0-based), `first(item)` and `last(item)` work inside loops only.

```text
Pets: {{#each fields.pets}}{{item}}{{#unless last(item)}}, {{/unless}}{{else}}none{{/each}}
{{#each fields.orders}}{{index(item) + 1}}. {{item.name}}: {{#each item.parts}}{{parent.name}}/{{item}} {{/each}}{{/each}}
Total: {{sum(fields.orders.amount)}}
```

Write expressions, not Handlebars helpers: `a == b` for `(eq a b)`, `item` for `this`, `index(item)` for `@index`, `{{coalesce(v, "x")}}` for `{{default v "x"}}`, `[0]` for `.[0]`. A loop runs over lists only, so there is no `@key`.

## Signing directives

Place every signing mark with a directive: sealing finds slots only through directives.

| Directive | Places | Slot `type` |
|-----------|--------|-------------|
| `{{signature(party, "location")}}` | Signature | `signature` |
| `{{initials(party, "location")}}` | Initials | `initials` |
| `{{signatureDate(party, "location")}}` | Date of the signature at that location | none: pass the signature's location |
| `{{capacity(party, "location")}}` | Signer's capacity or title | `capacity` |
| `{{printedName(party, "location")}}` | Signer's printed name | `printed_name` |

The location string is the slot id. Declare each slot in the layer's `signatures` map, following the [slot rules](./layers.md#slot-rules). `signatureDate` prints the date of the signature captured at the location you pass.

Pass the party first. Inside `{{#each parties.<role>}}` or `{{#each parties.<role>.signatories}}`, omit it: the directive signs for the current row. The location is an expression, so build one per row:

```text
Landlord: {{parties.landlord.name}}
Signature: {{signature(parties.landlord, "landlord-sig")}}
Date: {{signatureDate(parties.landlord, "landlord-sig")}}

{{#each parties.tenant}}
Tenant {{index(item) + 1}}: {{item.name}}
Signature: {{signature("tenant-" + index(item) + "-sig")}}
{{/each}}
```

The loop renders locations `tenant-0-sig` and `tenant-1-sig`, one declared slot per index.

For an organization that signs through people, loop over its signatories:

```text
{{#each parties.landlord.signatories}}
{{printedName("landlord-name")}}, {{capacity("landlord-cap")}}
Signature: {{signature("landlord-sig")}}
{{/each}}
```

For an optional party, guard the block: `{{#if parties.guarantor != null}}…{{/if}}`.

## Directive output

What a directive prints depends on the engine and on whether a capture exists.

| Directive | Text layer (default) | Text layer after capture | DOCX layer |
|-----------|----------------------|--------------------------|------------|
| `signature` | `[SIGNATURE]` | `[Signed]` | underscores, `[Signed]` after capture |
| `initials` | `[INITIALS]` | `[Initialed]` | underscores, `[Initialed]` after capture |
| `signatureDate` | `[DATE]` | `YYYY-MM-DD` of the capture | underscores, the date after capture |
| `capacity` | the signatory's capacity, else `[CAPACITY]` | the captured text | the capacity, else underscores |
| `printedName` | the signer's name, else `[PRINTED NAME]` | the captured text | the name, else underscores |

The captured signature image appears only when the text layer renders with `textSignatureOptions.format` set to `"html"` (an `<img>` tag) or `"markdown"` (an image link). With `format: "html"`, the directive returns markup, so write it as `{{{signature(parties.tenant, "tenant-sig")}}}` to keep it unescaped. `placeholder` and `captured` in `textSignatureOptions` and `docxSignatureOptions` replace the default text; see [rendering.md](./rendering.md#renderlayer-options).

## DOCX commands

A DOCX template takes the text markers inside a paragraph, plus these commands, each alone in its own paragraph:

| Command | Effect |
|---------|--------|
| `{{IF cond}}` … `{{ELSE}}` … `{{END-IF}}` | Condition. `{{ELSE}}` is optional |
| `{{FOR line IN fields.lines}}` … `{{END-FOR line}}` | Loop. The row is named: `{{line.description}}`, `{{index(line) + 1}}` |
| `{{INS expr}}` | Same as `{{expr}}` |

```text
{{IF fields.hasPets}}
Pet deposit: {{fields.petDeposit}}
{{ELSE}}
No pets.
{{END-IF}}
{{FOR line IN fields.lines}}
{{index(line) + 1}}. {{line.description}} {{line.amount}}
{{END-FOR line}}
```

- To repeat table rows, put `{{FOR x IN list}}` and `{{END-FOR x}}` each alone in its own table row. The rows between them repeat, and the two marker rows are removed.
- Templates work in the body, headers, footers, footnotes and endnotes.
- `renderDocx({ options: { cmdDelimiter: ["<<", ">>"] } })` changes the delimiters when a template cannot use `{{ }}`.

## Validation

`validate()`, `paradoc validate` and the `validate_artifact` tool check every expression in inline templates. File templates need their bytes: `paradoc validate` reads them from the artifact's directory, and in code `validateLayers(artifact, { resolver })` does the same. Each error names the layer, the line and column (or the DOCX part and paragraph), and the expression:

```text
Template error at layer "md", line 1, column 3 in {{a}}: Unknown reference: a
```

A failed expression at render time throws `TemplateError` with the same `layer`, `position` and `expression`.
