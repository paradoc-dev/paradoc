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

```json
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

Maps Paradoc field IDs (keys) to PDF AcroForm field names (values).

```json
"bindings": {
  "fullName": "Text_FullName",
  "ssn": "SSN_Field",
  "filingStatus": "RadioGroup_Status",
  "agreeToTerms": "Checkbox_Agree",
  "mailingAddress": "Text_Address_Line1"
}
```

### Rules

- Keys MUST be valid Paradoc field IDs from the `fields` object
- Values MUST be the EXACT PDF AcroForm field names (case-sensitive)
- Every field with a corresponding PDF field SHOULD have a binding
- Fields without PDF counterparts (computed, derived) are omitted
- Nested fieldset fields use dot notation: `"employment.employerName": "Employer_Name_Field"`

### Finding PDF field names

- AcroForm field names visible in the PDF structure
- Field tooltip text (often matches the internal name)
- Use `para inspect template.pdf` to extract field names — see [cli.md](./cli.md) and [rendering.md](./rendering.md)
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
| `date` | "Date Signed" field next to a signature |

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

```json
"markdown": {
  "kind": "inline",
  "mimeType": "text/markdown",
  "title": "Markdown Template",
  "text": "# Form Title\n\n## Section 1: Personal Information\n\n**Full Name:** {{fullName}}\n**Date of Birth:** {{dateOfBirth}}\n**SSN:** {{ssn}}\n\n## Section 2: Employment\n\n**Employer:** {{employerName}}\n**Annual Salary:** {{annualSalary}}"
}
```

### Markdown rules

- Use `{{fieldId}}` (NOT `{{fields.fieldId}}`)
- Mirror the PDF's section structure
- Include section headings from the PDF
- Use signature helpers (see [layers.md](./layers.md)) — NEVER manual underscore lines
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

```json
"defaultLayer": "pdf",
"layers": {
  "pdf": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "w9.pdf",
    "title": "IRS Form W-9 PDF",
    "bindings": {
      "name": "f1_01",
      "businessName": "f1_02",
      "federalTaxClassification": "c1_1",
      "address": "f1_04",
      "ssn": "f1_11"
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
    "text": "# Request for Taxpayer Identification Number and Certification\n\n**Name:** {{name}}\n**Business Name:** {{businessName}}\n..."
  }
}
```

## See Also

- [layers.md](./layers.md) — generic layer concepts, signature block schema
- [rendering.md](./rendering.md) — `renderPdf`, `inspectAcroFormFields`, `para inspect`
- [parties.md](./parties.md) — party roles for signature blocks
- [cli.md](./cli.md) — `para inspect`, `para render --renderer pdf`
