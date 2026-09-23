---
name: pdf-bindings
description: PDF-specific layer configuration — AcroForm bindings, signature block coordinates, naming conventions, fallback for flat PDFs
metadata:
  tags: pdf, acroform, bindings, signature-blocks, coordinates, layers
---

# PDF Bindings and Layers

PDF-specific layer details. For generic layer concepts (kinds, MIME types, signature block schema), see [layers.md](./layers.md).

## When to Create a PDF Layer

| PDF state | Action |
|-----------|--------|
| Has interactive AcroForm fields | ALWAYS create a PDF file layer with `bindings` |
| Flat / scanned (no AcroForm) | SKIP the PDF layer. Create a markdown layer instead. |

## PDF File Layer Structure

```json schema=form
"layers": {
  "pdf": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "<relative-path-to-pdf>",
    "title": "Original PDF Form",
    "bindings": { },
    "signatureBlocks": { }
  }
}
```

### Path

`path` MUST be relative from the artifact file:

| Layout | Path |
|--------|------|
| PDF and artifact in same directory | `form-name.pdf` |
| PDF in `templates/` subdirectory | `templates/form-name.pdf` |
| PDF in parent directory | `../form-name.pdf` |

## Bindings Object

Maps PDF AcroForm field names (keys) to Paradoc data paths (values).

```json schema=layer
"bindings": {
  "Text_FullName": "fullName",
  "SSN_Field": "ssn",
  "RadioGroup_Status": "filingStatus",
  "Checkbox_Agree": "agreeToTerms",
  "Text_Address_Line1": "mailingAddress.line1"
}
```

### Rules

- Keys MUST be the EXACT PDF AcroForm field names (case-sensitive)
- Values MUST be valid Paradoc data paths: a field ID from the `fields` object, or `parties.<role>.<member>`
- Every PDF field with a corresponding Paradoc value SHOULD have a binding
- Fields without PDF counterparts (computed, derived) are omitted
- Nested fieldset fields use dot notation: `"Employer_Name_Field": "employment.employerName"`
- An enum or multiselect bound to a text box writes the option **value**, the code the form expects (for example `C`, `5`, or `A`), never its label. Labels are for reading; give options the values the paper form asks for.

### How bound values are drawn

Filling honors each PDF field's own settings: its declared font size (or automatic sizing when the size is 0), alignment, color, comb boxes (one character per box), and multiline wrapping. Choice lists show every selected value. A value that does not fit shrinks down to 6 points; past that, or with more characters than a comb field has boxes, rendering fails with `PdfFieldFillError` (`field`, `reason`: `overflow` or `comb-length`, `limit`). When you bind a split value to comb fields, make each part no longer than its field's box count.

### Fonts

Each value uses the first font that can draw all of it: a font supplied at render time, then the layer's declared `font`, then the form's own embedded font for the field, then Helvetica for Latin-1 text. Latin-1 forms need no font. If the data can hold names in Latin Extended, Greek, Cyrillic, or CJK scripts, declare a TrueType font (`.ttf`, TrueType outlines) on the PDF layer; the resolver reads it like the PDF and it is embedded in the output:

```json schema=layers
"pdf": {
  "kind": "file",
  "mimeType": "application/pdf",
  "path": "w-9.pdf",
  "font": { "path": "fonts/NotoSans-Regular.ttf" }
}
```

Only PDF layers can declare a font. A character no font can draw fails with `PdfFieldFillError` (`reason: 'missing-glyph'`, `character`). Scripts that need shaping (Arabic, Hebrew, Devanagari, Thai, and others) always fail (`reason: 'unsupported-script'`, `script`); use a React composition layer for those documents. An unreadable, unsupported, or non-embeddable font fails with `PdfFontError` naming its source.

### Finding PDF field names

- AcroForm field names visible in the PDF structure
- Field tooltip text (often matches the internal name)
- Use `paradoc inspect template.pdf` to extract field names — see [cli.md](./cli.md) and [rendering.md](./rendering.md)
- If names are not visible, use descriptive names based on position and label

### Common PDF naming conventions

| PDF Tool | Convention |
|----------|-----------|
| Adobe Acrobat | `Text1`, `CheckBox1`, `RadioButton1` |
| Adobe LiveCycle | `form1[0].Page1[0].TextField1[0]` |
| PDF-XFA | `xfa.form.form1.Page1.TextField1` |
| Fillable PDF generators | `field_name`, `FieldName`, `FIELD_NAME` |

## Signature Blocks (PDF Specific)

Signature blocks are positioned by `(page, x, y, width, height)` in PDF points. For schema details see [layers.md](./layers.md). PDF-specific concerns:

### Block types

| Type | When to Use |
|------|-------------|
| `signature` | Signature line |
| `initials` | Initials line ("Initial here: ____") |
| `date` | "Date Signed" field next to a signature (`date_signed` in a `signatures` slot) |
| `capacity` | Signer's role or title ("Title: ____") |
| `printed_name` | "Print Name: ____" line |

### Estimating coordinates

When exact coordinates are not extractable, estimate:

- **US Letter page:** 612 × 792 points (8.5" × 11" at 72 dpi)
- **Typical margins:** 72 points (1 inch) from each edge
- **Signature line:** width 180-250 points, height 40-60 points
- **Common positions** (top-left origin):
  - Bottom of page: y ≈ 680-740
  - Left column: x ≈ 72
  - Right column: x ≈ 320-350

### Naming convention

Combine party role and block type:

| Party Role | Block Type | Block ID |
|-----------|------------|----------|
| buyer | signature | `buyerSig` |
| buyer | date | `buyerDate` |
| seller | signature | `sellerSig` |
| tenant (index 0) | signature | `tenant0Sig` |
| tenant (index 1) | signature | `tenant1Sig` |
| witness | signature | `witnessSig` |

## Markdown Fallback Layer

ALWAYS create a markdown inline layer alongside the PDF layer (or as the only layer when the PDF is flat). It serves as a human-readable template.

```json schema=layers
"markdown": {
  "kind": "inline",
  "mimeType": "text/markdown",
  "title": "Markdown Template",
  "text": "# Form Title\n\n## Section 1: Personal Information\n\n**Full Name:** {{fields.fullName}}\n**Date of Birth:** {{fields.dateOfBirth}}\n**SSN:** {{fields.ssn}}\n\n## Section 2: Employment\n\n**Employer:** {{fields.employerName}}\n**Annual Salary:** {{fields.annualSalary}}"
}
```

### Markdown rules

- Use `{{fields.fieldId}}` paths; a bare `{{fieldId}}` is an unknown reference
- Mirror the PDF's section structure
- Include section headings from the PDF
- Use signing directives (see [layers.md](./layers.md)) — NEVER manual underscore lines
- NEVER include "For Office Use" sections

## Default Layer

| Scenario | `defaultLayer` |
|----------|---------------|
| PDF layer exists | `"pdf"` |
| Only markdown layer (flat PDF) | `"markdown"` |

```json
{
  "defaultLayer": "pdf",
  "layers": {
    "pdf": { /* ... */ },
    "markdown": { /* ... */ }
  }
}
```

## Complete Example

```json schema=form
"defaultLayer": "pdf",
"layers": {
  "pdf": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "w9.pdf",
    "title": "IRS Form W-9 PDF",
    "bindings": {
      "f1_01": "name",
      "f1_02": "businessName",
      "c1_1": "federalTaxClassification",
      "f1_04": "address",
      "f1_11": "ssn"
    },
    "signatureBlocks": {
      "taxpayerSig": {
        "type": "signature",
        "page": 1, "x": 72, "y": 640, "width": 250, "height": 50,
        "partyRole": "taxpayer",
        "label": "Taxpayer Signature"
      },
      "taxpayerDate": {
        "type": "date",
        "page": 1, "x": 400, "y": 640, "width": 140, "height": 30,
        "partyRole": "taxpayer",
        "label": "Date"
      }
    }
  },
  "markdown": {
    "kind": "inline",
    "mimeType": "text/markdown",
    "title": "W-9 Markdown Template",
    "text": "# Request for Taxpayer Identification Number and Certification\n\n**Name:** {{fields.name}}\n**Business Name:** {{fields.businessName}}\n..."
  }
}
```

## Reading Filled PDFs Back

`form.extract(pdf)`, `paradoc data extract`, and the AI tool `extract` run the bindings in reverse. Binding shape decides what comes back:

| Binding | Example | Extraction |
|---------|---------|------------|
| Direct or nested | `"parties.taxpayer.name"`, `"address.line1"` | Recovered; text is parsed into the field's type |
| Enum checkbox map | `"taxClassification:llc"` | Recovered from the one checked box; two checked is `unparseable` |
| Radio group or dropdown | `"species"` | Recovered from the selected export value |
| Split | `"ssn:1"`, `"ssn:2"`, `"ssn:3"` | Recovered by joining the parts in order with `-` |
| Combined | `"locality,region,postalCode"` | `not_recoverable`; the raw text is in the report and the fields stay empty |
| Whole structured value in one box | `"mailingAddress"` | `not_recoverable`; bind the parts instead |

When a value must be readable back, bind each part to its own PDF field rather than combining them. A money value in one box needs its currency symbol to be read back; bind `amount` alone when the box holds a bare number.

## See Also

- [layers.md](./layers.md) — generic layer concepts, signature block schema
- [rendering.md](./rendering.md) — `renderPdf`, `inspectAcroFormFields`, `paradoc inspect`
- [parties.md](./parties.md) — party roles for signature blocks
- [cli.md](./cli.md) — `paradoc inspect`, `paradoc render --layer pdf`, `paradoc data extract`
- [sdk.md](./sdk.md) — `form.extract()` and its report
