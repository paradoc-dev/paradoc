---
name: pdf
description: PDF layers - read field names and coordinates with paradoc inspect, write bindings for fill and extract, place signature slots, pass the fit check, pick fonts and money format, read a filled PDF back.
metadata:
  tags: pdf, acroform, bindings, inspect, extract, coordinates, fonts, fit
---

# PDF layers

**Contents:** [Inventory the PDF](#inventory-the-pdf) · [Bindings](#bindings) · [Binding values](#binding-values) · [Example: W-9](#example-w-9) · [Signature slots on a PDF](#signature-slots-on-a-pdf) · [Fit check](#fit-check) · [Fonts](#fonts) · [Money](#money) · [Read a filled PDF back](#read-a-filled-pdf-back) · [Flat PDFs](#flat-pdfs)

A PDF layer is a file layer with `"mimeType": "application/pdf"`. This file covers what only PDF layers have. For the layer shape, file paths, and the slot schema, load [layers.md](./layers.md). To convert a whole PDF form into an artifact, follow [workflow-author-form.md](./workflow-author-form.md).

## Inventory the PDF

`paradoc inspect` is the source of truth for field names, types, and boxes. Copy every name from its output; the visible label differs from the field name.

```bash
npx paradoc-cli inspect form.pdf --summary                                       # counts by type
npx paradoc-cli inspect form.pdf --format json --include-signatures > fields.json
```

The JSON is an array with one entry per AcroForm field:

| Key | Meaning |
|-----|---------|
| `name` | Fully qualified field name, for example `topmostSubform[0].Page1[0].f1_01[0]`. Copy it exactly as the binding key. |
| `type` | `text`, `checkbox`, `radio`, `dropdown`; `signature` with `--include-signatures`; `button` with `--include-buttons`. |
| `page` | One-based page number. |
| `rect` | `[x1, y1, x2, y2]` in PDF points, origin at the **bottom-left** of the page. |
| `maxLen` | Character limit of the box. A comb field (one character per box) has one. `null` means none. |
| `value` | Current value, if the PDF is already filled. |

`--filter "<glob>"` narrows by name. An empty array `[]` means a flat PDF (see [Flat PDFs](#flat-pdfs)). The renderer reads AcroForm fields only; XFA-only forms have no fields to bind.

## Bindings

`bindings` maps each **PDF field name (key)** to a **Paradoc path (value)**. Keys are at most 100 characters. Where `bindings` may appear and how `bindingsFrom` reuses them is in [layers.md § Bindings](./layers.md#bindings).

<!-- dep:C7 -->
`paradoc validate` rejects a binding whose key is not a field in the PDF, or whose value is not a known path. An inverted map (Paradoc id as key) fails validation. The round trip remains the final check.

Path rules:

| Path | Example | Notes |
|------|---------|-------|
| Field id | `businessName` | Write the bare id, as the essentials do. |
| Nested member | `mailingAddress.line1` | Fieldset members and composite parts. |
| List item | `dependents[0].name` or `dependents.0.name` | More list items than bound indices fails the render: `PDF bindings for "dependents" support 2 list items, but received 3`. |
| Party, `max: 1` | `parties.taxpayer.name` | An index is refused. |
| Party, `max > 1` | `parties.tenant[0].name` | The index is required and must be below `max`. |
| Computed value | `defs.totalDue` | Fill only. |

With no `bindings` at all, PDF fields whose names equal top-level field ids fill automatically (fieldsets are skipped). Extraction needs explicit bindings, so always write them.

## Binding values

One table for filling and for reading back. "Extract" is the status [extraction](#read-a-filled-pdf-back) reports.

| Form | Example value | PDF field | Fill | Extract |
|------|---------------|-----------|------|---------|
| Direct | `"businessName"` | text | Writes the formatted value. An enum or multiselect writes the option **value** (the code, such as `C` or `5`), never the label. | `recovered`, parsed into the field type |
| Direct | `"hasForeignPartners"` | checkbox | Checked when the value is truthy. | `recovered` as a boolean |
| Direct | `"species"` | radio, dropdown | Selects the state named by the value. Each option `value` must equal the PDF export value exactly. | `recovered` from the selected export value |
| Option | `"taxClassification:llc"` | checkbox | Checked when an enum equals the option, or a multiselect contains it. One binding per box. | `recovered` from the checked box. Two checked for an enum is `unparseable`. A multiselect comes back as a list. |
| Split part | `"ssn:1"`, `"ssn:2"`, `"ssn:3"` | text | Writes the Nth `-`-separated part (1-based). | `recovered` by joining the parts with `-`. Every part must be bound. |
| Joined | `"mailingAddress.locality,mailingAddress.region,mailingAddress.postalCode"` | text | Joins the non-empty values with `", "`. | `not_recoverable` |
| Whole composite | `"mailingAddress"` | text | Writes the formatted address in one box. | `not_recoverable`. Bind the parts instead. |
| Party or computed | `"parties.tenant[0]"`, `"defs.totalDue"` | text | Writes the formatted value. | `not_recoverable` |

Prefer bindings that read back. Join values only when the PDF gives them one box, as the W-9 does for city, state, and ZIP.

Fill, extraction, the fit check, and validation parse a binding value the same way:

- A path may carry the `fields.` prefix: `"fields.businessName"` is `"businessName"`.
- Space around `:` and `,` is ignored: `"status: married"` is `"status:married"`.
- A joined part takes no qualifier. `"ssn:1, ssn:2"` fails validation.
- Every binding key must name a field of the template. Filling fails, naming the key, when one does not.

## Example: W-9

Trimmed from the `@paradoc/essentials` W-9 (`w9.spec`). The enum keeps three of its seven options. The PDF field names come from `paradoc inspect`.

```json schema=form
"parties": {
  "taxpayer": {
    "label": "Taxpayer",
    "partyType": "any",
    "min": 1,
    "max": 1,
    "signature": { "required": true }
  }
},
"fields": {
  "businessName": { "type": "text", "label": "Business name", "maxLength": 80 },
  "taxClassification": {
    "type": "enum",
    "label": "Federal tax classification",
    "required": true,
    "enum": [
      { "value": "individual_or_sole_proprietor", "label": "Individual or sole proprietor" },
      { "value": "c_corporation", "label": "C corporation" },
      { "value": "llc", "label": "Limited liability company" }
    ]
  },
  "mailingAddress": { "type": "address", "label": "Mailing address", "required": true },
  "ssn": { "type": "text", "label": "Social security number", "pattern": "^\\d{3}-\\d{2}-\\d{4}$" }
},
"layers": {
  "pdf": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "w-9.pdf",
    "title": "IRS Form W-9",
    "bindings": {
      "topmostSubform[0].Page1[0].f1_01[0]": "parties.taxpayer.name",
      "topmostSubform[0].Page1[0].f1_02[0]": "businessName",
      "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]": "taxClassification:individual_or_sole_proprietor",
      "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]": "taxClassification:c_corporation",
      "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[5]": "taxClassification:llc",
      "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]": "mailingAddress.line1",
      "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]": "mailingAddress.locality,mailingAddress.region,mailingAddress.postalCode",
      "topmostSubform[0].Page1[0].f1_11[0]": "ssn:1",
      "topmostSubform[0].Page1[0].f1_12[0]": "ssn:2",
      "topmostSubform[0].Page1[0].f1_13[0]": "ssn:3"
    },
    "signatures": {
      "taxpayerSignature": {
        "party": { "role": "taxpayer" },
        "type": "signature",
        "placement": { "page": 1, "x": 175, "y": 586, "width": 195, "height": 14 }
      },
      "taxpayerDate": {
        "party": { "role": "taxpayer" },
        "type": "date_signed",
        "placement": { "page": 1, "x": 410, "y": 586, "width": 80, "height": 14 }
      }
    }
  }
},
"defaultLayer": "pdf"
```

A round trip of this artifact reports every path `recovered` except the three joined address parts (`not_recoverable`).

## Signature slots on a PDF

Declare slots in the layer's `signatures` map with absolute or anchor placement ([layers.md § Slot rules](./layers.md#slot-rules)).

Absolute placement is in PDF points with the origin at the **top-left**. `inspect` reports `rect` from the bottom-left, so convert:

| Slot key | From `rect: [x1, y1, x2, y2]` |
|----------|-------------------------------|
| `x` | `x1` |
| `y` | `pageHeight - y2` |
| `width` | `x2 - x1` |
| `height` | `y2 - y1` |

Get `pageHeight` from `inspectPdf()`. US Letter is 612 × 792 points.

```typescript
import { readFile } from "node:fs/promises";
import { inspectPdf, locate } from "@paradoc/render/pdf";

const pdf = new Uint8Array(await readFile("w-9.pdf"));
const { pages } = await inspectPdf(pdf);
// [{ page: 1, width: 611.976, height: 791.968 }]
const [hit] = await locate(pdf, [{ id: "sig", kind: "anchor", text: "Signature of" }]);
// { id: "sig", page: 1, x: 76, y: 580.6, width: 39.4, height: 7 }, top-left origin
```

A PDF often has a printed "Sign here" label and no signature field. Use `locate()` to measure the label, or declare an anchor placement and let the seal find it: `{ "anchor": { "text": "Signature of", "offsetX": 100 }, "width": 195, "height": 14 }`. The anchor text must be unique unless you set `occurrence`.

## Fit check

`paradoc validate` checks, before any data exists, that bound values fit their PDF text boxes. For each binding to a text field it lays out values at the bound field's length limit (`maxLength`, or the length `pattern` allows):

| Result | When |
|--------|------|
| Error | A typical value of that length cannot fit at 6 points. An enum option value cannot fit. A value or split part has more characters than a comb field has boxes. |
| Warning | Only the widest value (all `W`) overflows. Or the bound field has no `maxLength` or `pattern`. |

Real messages name the layer, PDF field, path, and limit:

```text
✗ Layer "pdf", PDF field "topmostSubform[0].Page1[0].f1_02[0]" (bound to fields.businessName): the typical value fields.businessName accepts under maxLength 400 (400 characters) does not fit the 517.4 × 14.001 pt box at the minimum size of 6 pt
⚠ Layer "pdf", PDF field "topmostSubform[0].Page1[0].f1_02[0]" (bound to fields.businessName): fields.businessName has no maxLength or pattern that bounds its length, so a long value can fail to fill the 517.4 × 14.001 pt box
```

Fix each by giving the field a `maxLength` its box can hold (use `maxLen` from `inspect`, or the box width), or a `pattern`. Use a multiline PDF field for free text.

At fill time the renderer honors each field's font size (auto when 0), alignment, color, comb boxes, and multiline wrapping. A value that does not fit shrinks to 6 points. Past that, the render fails with `PdfFieldFillError` (`field`, `reason`: `overflow` or `comb-length`, `limit`).

## Fonts

Each value uses the first font that can draw all of it: a font passed at render time, then the layer's `font`, then the form's own embedded font for the field, then Helvetica for Latin-1 text. Latin-1 data needs no font. For names in Latin Extended, Greek, Cyrillic, or CJK scripts, declare a TrueType font (`.ttf`, TrueType outlines). The resolver reads it like the PDF, and it is embedded in the output.

```json schema=layer
"path": "w-9.pdf",
"font": { "path": "fonts/NotoSans-Regular.ttf" }
```

Only PDF layers declare a `font`. A character no font can draw fails with `PdfFieldFillError` (`reason: "missing-glyph"`, `character`). Scripts that need shaping (Arabic, Hebrew, Devanagari, Thai, and others) fail with `reason: "unsupported-script"`. For those documents, compose the output with the `paradoc-react` skill. An unreadable or non-embeddable font fails with `PdfFontError`.

## Money

A money value prints with its currency symbol (`$1,250.50`). When the PDF pre-prints the symbol beside the box, declare `format` on the layer and `currency` on the field:

```json schema=form
"fields": { "fee": { "type": "money", "currency": "USD" } },
"layers": {
  "pdf": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "invoice.pdf",
    "format": { "money": { "currencyDisplay": "none" } },
    "bindings": { "Amount": "fee" }
  }
}
```

The box then holds `1,250.50`, and extraction reads it back in the field's declared `currency`. Both forms round-trip. Without a field `currency`, bind `fee.amount` to a box that holds a bare number. Only PDF layers declare `format`. Formatter options are in [formatting.md](./formatting.md).

## Read a filled PDF back

Extraction runs the bindings in reverse.

```bash
npx paradoc-cli data extract w-9.json filled.pdf --out extracted.json   # also takes a directory of PDFs; --layer when there are several PDF layers
```

```typescript
import { w9 } from "@paradoc/essentials";

const draft = w9.fill({
  fields: {
    taxClassification: "individual_or_sole_proprietor",
    mailingAddress: { line1: "123 Main St", locality: "Portland", region: "OR", postalCode: "97201", country: "US" },
    ssn: "123-45-6789",
  },
  parties: { taxpayer: { id: "taxpayer-0", name: "Jane Q. Public", firstName: "Jane", lastName: "Public" } },
});
const pdf = await draft.render({ layer: "pdf" });
const { data, report } = await w9.extract(pdf, { layer: "pdf" });
// data: { fields: { taxClassification, mailingAddress: { line1 }, ssn }, parties: { taxpayer: { name } } }

const refilled = w9.safeFill(data);
if (!refilled.success) console.error(refilled.error.message); // "Form data validation failed: Missing required field: fields.mailingAddress.locality, …": the joined city, state and ZIP box does not read back
```

`data` holds only values recovered exactly, in the fill payload shape. Extraction does not validate: pass `data` to `safeFill()`. A partial structured value stays partial and fails there with the missing parts named. The CLI `data extract` and the `extract` AI tool ([ai-tools.md](./ai-tools.md)) return the same result.

`report.entries` has one entry per bound path: `{ path, status, sources: [{ field, value }], reason? }`.

| Status | Meaning |
|--------|---------|
| `recovered` | Read back exactly. |
| `empty` | The bound PDF fields hold no value. |
| `not_recoverable` | The binding cannot be reversed: joined, whole composite, whole party, `defs.*`, `annexes.*`, or an unbound split part. `reason` says which. |
| `unparseable` | The PDF value does not parse into the field type, two boxes are checked for one enum, or the fields that carry the path disagree. |

`report.unbound` lists filled PDF fields that no binding covers: `{ field, type, value }`.

A refused input throws `PdfExtractionError` with a `code`:

| `code` | Cause |
|--------|-------|
| `malformed_pdf` | Not a readable PDF. |
| `no_form_fields` | The PDF has no fillable AcroForm fields (flat, flattened, or scanned). |
| `not_matching` | No PDF field matches a binding key, or the layer has no bindings. |
| `no_pdf_layer` | The artifact has no PDF layer. |
| `layer_required` | Several PDF layers exist. Pass `layer`. |
| `layer_not_found` | `layer` names no layer. |
| `not_pdf_layer` | `layer` names a layer that is not a PDF. |

An encrypted PDF throws `PdfEncryptedError` (`code` `encrypted_pdf`). Every `@paradoc/render/pdf` function that reads or writes a PDF refuses one the same way.

## Flat PDFs

`inspect` returns `[]` for a flat or scanned PDF. There is nothing to bind.

- Keep a PDF file layer only when the PDF itself must be shown or signed. It renders unchanged and can carry `signatures` slots with absolute or anchor placement.
- Present the data in a text layer ([templates.md](./templates.md)).
- For a printable replica of the form, compose it with the `paradoc-react` skill.
