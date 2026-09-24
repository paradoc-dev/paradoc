---
name: workflow-author-form
description: Staged workflow to author a form artifact from requirements or from an existing PDF. Every stage ends on a command result, and the finish line is the round trip.
metadata:
  tags: workflow, create, form, pdf, conversion, acroform, bindings, round-trip
---

# Workflow: author a form

**Contents:** [Before you start](#before-you-start) · [1. Scope and scaffold](#1-scope-and-scaffold) · [2. PDF inventory](#2-pdf-inventory-pdf-branch) · [3. Fields, parties, logic](#3-fields-parties-logic) · [4. Layers and instructions](#4-layers-and-instructions) · [5. Round trip](#5-round-trip) · [Common failures](#common-failures)

One workflow for both starts: a description of the form, or an existing PDF. Stage 2 runs only on the PDF branch. Each stage ends on a command result. Move to the next stage only when that result holds.

At the end of each stage, show the user what you decided (a field table, a party table, a bindings table) and ask about anything ambiguous: a field type, whether a party signs, how many signers a role has. Their answers change the artifact. The command result still decides when the stage is done.

## Before you start

- Check the ready-made forms table in SKILL.md. If `@paradoc/essentials` ships the form, use its export (`import { w9 } from "@paradoc/essentials"`) and stop. Essentials are TypeScript exports, so a JSON or CLI user needs the SDK to use one.
- Decide the output. Screen text or a data record needs a text layer. A fillable government or vendor PDF needs a PDF layer. A printable, branded PDF, or a replica of a flat PDF, needs a React composition: author the artifact here (stages 1 to 3), then compose it with the `paradoc-react` skill.
- Commands below use `npx paradoc-cli`. Run them from the artifact's directory, and keep every file the artifact names (PDF, templates, instructions) inside that directory ([layers.md § Layer shape](./layers.md#layer-shape)).

## 1. Scope and scaffold

Ask, grouped, only what the user has not already said:

| Topic | Questions |
|-------|-----------|
| Purpose | What is the form for? Who fills it in? |
| Data | What does it collect? Which sections? Which fields depend on others? Any repeating rows? |
| Signing | Who signs? Can a role have several people? Witnesses or a notary? |
| Output | Screen text, a fillable PDF, or a printable PDF? |
| Rules | Cross-field checks? Computed values? |

On the PDF branch, the PDF answers most of these. Read it for the title, form code, sections, signature lines, and instructions text.

Name the artifact in kebab-case (`w9`, `residential-lease`). Scaffold with the fields you already know, including `enum`, `multiselect`, `fieldset`, and `list` — `--field` writes each with the keys it needs (placeholder options, an empty `fields`, or a `text` `item`). Replace those placeholders with the real options, nested fields, or item type in stage 3.

```bash
npx paradoc-cli new form volunteer-signup --title "Volunteer Signup" \
  --field startDate:date --field email:email --field hoursPerWeek:number -y
npx paradoc-cli validate volunteer-signup.json
```

The file carries `$schema`, `kind`, `name`, `title`, `version`, and `fields`. Name the file after `name`.

**Done when** each of the five topics has an answer (from the user, the PDF, or an explicit "decide for me"), and `validate` prints `✓ Valid` and exits 0.

## 2. PDF inventory (PDF branch)

The AcroForm field list from `inspect` is the source of truth for the PDF branch: it holds the field names the bindings need.

```bash
npx paradoc-cli inspect form.pdf --summary
npx paradoc-cli inspect form.pdf --format json --include-signatures > fields.json
```

An empty array (`[]`) means a flat PDF: skip to stage 3 and follow [Flat PDFs](./pdf.md#flat-pdfs).

Build a mapping table with one row per entry in `fields.json`: the PDF name, the Paradoc path it binds to, and the field type. Skip a PDF field only for a reason you can state (office use, a barcode). Map PDF field types this way:

| PDF field | Paradoc field | Binding |
|-----------|---------------|---------|
| Text | The most specific type ([fields.md](./fields.md)). Set `maxLength` from `maxLen` or the box width. | `"path"` |
| Group of checkboxes, pick one | `enum` | One `"field:option"` per box |
| Group of checkboxes, pick many | `multiselect` | One `"field:option"` per box |
| Single checkbox | `boolean` | `"field"` |
| Radio group or dropdown | `enum` with option values equal to the PDF export values | `"field"` |
| Split boxes (SSN in 3 parts) | `text` with a `pattern` | `"field:1"`, `"field:2"`, ... |
| Repeating rows | `list` with an `item` fieldset | `"rows[0].name"`, ... |
| Name or signature line of a signer | A party | `"parties.role.name"` |

The binding syntax and what each form reads back are in [pdf.md](./pdf.md#binding-values).

**Done when** the mapping table has as many rows as `jq length fields.json` prints, and each row is bound or has a skip reason.

## 3. Fields, parties, logic

Write the fields, parties, defs, and rules. Load the topic ref for each part:

| Part | Ref | Watch for |
|------|-----|-----------|
| Fields | [fields.md](./fields.md) | The most specific type. A repeating group is a `list`. Money is `money`, not `number`. |
| Parties | [parties.md](./parties.md) | One role per kind of signer, not per signature line. `witnesses` and `notarized` go under the party's `signature`. `payment` if the party pays. |
| Logic | [logic.md](./logic.md) | Field `visible` and `required` expressions use `fields.<id>`. "If yes, complete B" is `visible`. "Sum of lines 1 to 4" is a def. "Must not exceed" is a rule. |
| Annexes | [annexes.md](./annexes.md) | Attachments the form asks for. |

Leave out office-use sections, barcodes, and page furniture.

```bash
npx paradoc-cli validate volunteer-signup.json
```

**Done when** every item from stage 1 (and, on the PDF branch, every bound row of the mapping table) has its field, party, def or rule, and `validate` prints `✓ Valid` and exits 0. To fix a validation error, look up its message in [schemas.md § Error messages](./schemas.md#error-messages).

## 4. Layers and instructions

Use file layers and file ContentRefs. `attach` writes the reference with its MIME type and checksum.

**PDF layer (PDF branch).**

```bash
npx paradoc-cli attach w9.json w-9.pdf -n pdf -t "IRS Form W-9" -y
```

Then add to `layers.pdf`, by hand:

- `bindings` from the stage 2 mapping table. Keys are PDF names, values are Paradoc paths ([pdf.md](./pdf.md#bindings)).
- `signatures` slots with absolute or anchor placement ([pdf.md](./pdf.md#signature-slots-on-a-pdf), [layers.md](./layers.md)).

Set `"defaultLayer": "pdf"`.

**Text layer.** Write the template under `templates/`, with `{{fields.x}}` values and signing directives whose location string is the slot id ([templates.md](./templates.md)). Attach it, then add the matching `signatures` slots with `"placement": "flow"`.

```bash
npx paradoc-cli attach volunteer-signup.json templates/volunteer-signup.md -n markdown -t "Signup sheet" -y
```

**React layer.** For printable or replica output, use the `paradoc-react` skill.

**Instructions.** Write the source's official guidance and the filling guidance for an AI agent as two files, and attach them as [instructions.md § Attach a file](./instructions.md#attach-a-file) shows.

After any later edit to an attached file, refresh the checksums, then validate:

```bash
npx paradoc-cli fix volunteer-signup.json -y
npx paradoc-cli validate volunteer-signup.json
```

**Done when** every mapping-table row is a key in `bindings` (PDF branch), every party with `signature.required: true` has a slot on each layer you will seal, and `validate` prints `✓ Valid` with no warnings: every layer and ContentRef shows `file: found` and `checksum: verified`, and the [fit check](./pdf.md#fit-check) reports nothing.

## 5. Round trip

`validate` does not prove that the data reaches the output. The round trip does. Run the [round trip](./cli.md#round-trip) once per layer, with these additions:

- Replace every placeholder in `sample.json` with a realistic value (empty strings fail on composite fields). Fill every bound path, except paths the form makes exclusive (SSN or EIN).
- Add a `parties` object, which `data template` leaves out: `"parties": { "taxpayer": { "name": "Jane Q. Public", "firstName": "Jane", "lastName": "Public" } }` ([parties.md § Party fill values](./parties.md#party-fill-values)).
- Pass `--layer` to `render` for each layer, and to `data extract` when the form has several PDF layers.

On the PDF branch, list what did not come back:

```bash
jq -r '.report.entries[] | select(.status != "recovered") | "\(.status) \(.path)"' extracted.json
jq '.report.unbound | length' extracted.json
```

**Done when:**

- Every `render` exits 0.
- A text output shows each sample value, and `grep -n "error" out.md` prints nothing.
- On the PDF branch, the `jq` listing shows only paths you left blank on purpose (`empty`) or joined on purpose (`not_recoverable`, such as `a,b,c`), and `unbound` is `0`.

A `not_recoverable` or `unparseable` entry you did not plan for is a binding bug. Fix the binding in stage 4 and run the round trip again.

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `validate` fails with `binding "<key>": "<PDF name>" is not a known Paradoc path` | Bindings are inverted. | Keys are PDF names, values are Paradoc paths. |
| `validate` fails with `binding "<key>": "<key>" is not an AcroForm field` | The key is not a PDF field name. | Use the full name `inspectAcroFormFields` lists. |
| `fields.x.enum: Invalid input: expected array, received undefined` | An `enum` field was hand-written or edited with no `enum` options. | Add the `enum` options list (`--field x:enum` scaffolds placeholder options; replace them). |
| `Cannot format parties.x (party, invalid): Party identity is ambiguous` | An `any` party in the sample has only `name`. | Add `firstName` and `lastName` for a person, or `legalName` for an organization. |
| `Resolver path "../x.pdf" resolves outside the configured root` | A file sits outside the artifact's directory. | Move it next to the artifact. |
| `checksum: mismatch` | A file changed after `attach`. | `npx paradoc-cli fix <file> -y`. |
| A radio group shows no selection | An enum option value differs from the PDF export value. | Copy the export values into the option `value`s. |
