---
name: workflow-convert-pdf
description: Interactive 7-stage pipeline to convert an existing PDF form into a Paradoc form artifact — extract fields, parties, logic, bindings
metadata:
  tags: workflow, pdf, conversion, acroform, pipeline, extraction, bindings
---

# Workflow: Convert PDF Form to Paradoc

Interactive pipeline that converts an existing PDF form into a valid Paradoc form artifact. Every stage ends with a checkpoint where findings are presented and the user confirms before proceeding.

**Output:**

1. **Form artifact file** (`.json` or `.yaml`) with `fields`, `parties`, `defs`, `rules`, `instructions`, `agentInstructions`, `layers`
2. Optional: **PDF file layer** with `bindings` mapping Paradoc field IDs to PDF AcroForm field names
3. Optional: **Markdown layer** template based on the form structure

**Trigger phrases:** "convert PDF", "PDF to form", "extract PDF fields", "PDF form import", "AcroForm extraction".

## Setup

- All output uses schema version `2026-01-01` (`$schema: https://schema.paradoc.dev/2026-01-01/form.json`)
- ALWAYS run `npx paradoc validate <file>` after every significant change — see [schemas.md](./schemas.md)
- ALWAYS use camelCase for field IDs, kebab-case for artifact names
- ALWAYS present findings and wait for user confirmation at each checkpoint
- ALWAYS ask the user when something is ambiguous rather than guessing
- NEVER invent fields that are not in the PDF
- NEVER skip validation
- Prefer the most specific field type (money > text for dollar amounts)

## Pipeline Overview

```
Stage 1: Analyze PDF       → Stage 2: Identify Parties  → Stage 3: Identify Fields
Stage 4: Extract Logic     → Stage 5: Create Layers     → Stage 6: Add Instructions
Stage 7: Validate & Review
```

## Stage 1: Analyze PDF

Read the PDF and build a mental model. No files are written yet.

Claude can read PDF files natively — no external tooling needed. Read the path the user provides.

### What to identify

**Document identity**

| Item | Where to look | Maps to |
|------|--------------|---------|
| Form title | Header, first page, title bar | `title` |
| Form number/code | Top-right, header, footer | `code` |
| Issuing organization | Header, logo, footer | `metadata.issuer` |
| Revision date | Footer near form number | `releaseDate` |
| Purpose statement | First paragraph, instructions | `description` |

**Artifact name** — derive from form title or number, kebab-case:

| PDF Title | Artifact Name |
|-----------|--------------|
| "Form W-9" | `w9` |
| "Residential Lease Agreement" | `residential-lease-agreement` |
| "Form 1040-ES" | `form-1040-es` |

Strip revision info, dates, and qualifiers. Pattern `^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$`, max 128 chars.

### AcroForm detection

| AcroForm | Flat |
|----------|------|
| Highlighted/bordered input areas | Blank lines / underscores for handwriting |
| Dropdowns, combo boxes | "Print Name: ___" patterns |
| Interactive checkboxes/radio | Checkbox squares as graphics |
| Text fields accept typing | No fillable behavior |

**Why it matters:** AcroForm yields original field names and PDF field types — much richer output. Flat PDFs require inference and have no PDF bindings layer (use markdown layer instead).

### Section structure

| Section | Examples | Relevance |
|---------|----------|-----------|
| Personal info | Name, SSN, address, DOB | Core fields |
| Employment / income | Employer, salary, title | Fields + possible fieldset |
| Financial | Accounts, assets, debts | Money fields, fieldsets |
| Certification | "I certify...", "Under penalty of perjury..." | Instructions text |
| Signature blocks | Signature, date, printed name | Parties |
| Instructions section | "How to complete this form" | `instructions` ContentRef |
| For Office Use Only | Stamps, codes | SKIP — not fields |

### Common PDF patterns

**Government / tax forms** — form number, numbered lines, certification section, multiple filing statuses (enum), SSN/EIN fields (text+pattern).

**Lease / rental** — Landlord, Tenant parties, money for rent/deposit, dates for start/end, address fields, multiple signature blocks.

**Applications** — personal info top, employment history (fieldsets), financial (money), references, single applicant signature.

**Healthcare** — patient (person), insurance, medical history (boolean checkboxes), HIPAA signature, "For Office Use" sections (skip).

### Checkpoint

Present:

1. Form identity: name, title, code, description
2. AcroForm status (interactive or flat)
3. Section overview
4. Estimated field count and dominant types
5. Identified party roles (preliminary)

Ask: "Does this analysis look correct? Should I adjust anything before I proceed to identify parties?"

Ambiguous? Ask explicitly:
- Form name or title unclear
- AcroForm status uncertain
- Section role ambiguous (fields vs. instructions vs. skip)

## Stage 2: Identify Parties

**Goal:** scan signature blocks, identify party roles and configuration.

**Load:** [parties.md](./parties.md) for FormParty schema, signature object, common role names by domain.

### PDF-specific identification

**Signature block patterns** — usually grouped vertically near end of form or sections:

| Element | What it looks like |
|---------|-------------------|
| Signature line | "Signature: _______________" or "X _______________" |
| Printed name | "Print Name: _______________" |
| Date signed | "Date: _______________" |
| Title/Position | "Title: _______________" |

**Where to look:**

1. End of the document — most signatures are at the bottom
2. End of each section — some forms require per-section sign-off
3. Certification/declaration sections
4. Witness and notary sections (below main signatures)

**PDF Label → role ID mapping**

| PDF Label | Role ID | partyType |
|-----------|---------|-----------|
| Applicant | `applicant` | `person` |
| Taxpayer | `taxpayer` | `any` |
| Buyer / Purchaser | `buyer` | `any` |
| Seller / Vendor | `seller` | `any` |
| Landlord / Lessor / Owner | `landlord` | `any` |
| Tenant / Lessee / Renter | `tenant` | `person` |
| Borrower | `borrower` | `any` |
| Lender / Creditor | `lender` | `organization` |
| Employee | `employee` | `person` |
| Employer | `employer` | `organization` |
| Patient | `patient` | `person` |
| Provider | `provider` | `any` |
| Guarantor / Co-Signer | `guarantor` | `person` |
| Agent / Representative | `representative` | `person` |

**Witnesses:** do NOT create a separate party role. Set `witnesses` count on the party that requires witnessing. If general witness block not tied to specific party, attach to the most relevant party (typically last signing party).

**Notary:** if attached to a specific party's signature, set `notarized: true` on that party. If standalone, set on the primary party role.

**Multi-signature forms:** some forms have multiple signature blocks for the same role (e.g., initial each page). A party role represents the signer, not each placement. Signature block positions are handled in Stage 5.

### Checkpoint

Present table:

| Role ID | Label | Party Type | Min | Max | Signature | Witnesses | Notarized |
|---------|-------|-----------|-----|-----|-----------|-----------|-----------|

Ask: "I identified these party roles. Do you want to adjust roles, add missing ones, or change configuration?"

Ambiguous? Ask explicitly:
- Signature block role unclear ("Authorized Representative" — for which side?)
- Person/organization/either uncertain
- Number of signers uncertain ("Tenant(s)" — max 2 or 4?)
- Witness/notary block not clearly tied to a party

## Stage 3: Identify Fields

**Goal:** map every data-entry point to a Paradoc field. Record original PDF field names for bindings.

**Load:** [fields.md](./fields.md) for full type reference and identifier rules.

### PDF content → Paradoc type

| PDF Content | Paradoc Type | Rationale |
|------------|--------------|-----------|
| Dollar amount, price, fee, cost | `money` | Structured monetary value |
| Date field, "MM/DD/YYYY" | `date` | ISO date |
| Date + time field | `datetime` | ISO datetime |
| Time-only field | `time` | Time string |
| Email | `email` | Validation |
| Phone number | `phone` | Phone structure |
| Full address | `address` | Address structure |
| Person name (first, last, title) | `person` | Person structure |
| Company / org name | `organization` | Org structure |
| SSN, EIN, license number | `text` with `pattern` | Pattern-constrained text |
| Percentage, rate | `percentage` | Percentage value |
| Yes/No checkbox (single) | `boolean` | Toggle |
| Radio buttons (select one) | `enum` | Single-select |
| Checkbox group (select multiple) | `multiselect` | Multi-select |
| Dropdown / combo box | `enum` | Single-select |
| Large text area | `text` with `maxLength` | Long text |
| Short text input | `text` | Basic string |
| Number of dependents, count | `number` | Numeric |
| URL | `uri` | URI validation |
| ID document | `identification` | ID structure |

### PDF Label → field ID

MUST use camelCase. Pattern `^[a-z][a-zA-Z0-9_]*$`.

| PDF Label | Field ID | Notes |
|-----------|----------|-------|
| "Full Name" | `fullName` | |
| "Monthly Rent" | `monthlyRent` | |
| "Date of Birth" | `dateOfBirth` | |
| "SSN" | `ssn` | Acronyms lowercase |
| "Employer's Name" | `employerName` | Drop possessives |
| "Line 1: First Name" | `firstName` | Drop line numbers |
| "Previous Address (if different)" | `previousAddress` | Drop parentheticals |
| "# of Dependents" | `numberOfDependents` | Spell out symbols |

### Pattern constraints (common identifiers)

| Field | Pattern |
|-------|---------|
| SSN | `^[0-9]{3}-?[0-9]{2}-?[0-9]{4}$` |
| EIN | `^[0-9]{2}-?[0-9]{7}$` |
| US ZIP | `^[0-9]{5}(-[0-9]{4})?$` |

### Required fields

Mark `required: true` if the PDF shows asterisk (*), "Required", bold label, or context makes it clearly mandatory. Government forms: most numbered lines are required unless marked "optional" or "if applicable". Use CondExpr strings for conditional: `"required": "fields.hasSpouse == true"`.

### AcroForm field mapping

When the PDF has AcroForm fields, record original PDF field names alongside Paradoc field IDs (used in Stage 5):

| Paradoc Field ID | PDF AcroForm Field Name |
|-------------------|------------------------|
| `fullName` | `Text_FullName` |
| `ssn` | `SSN_Field_1` |
| `filingStatus` | `RadioGroup_FilingStatus` |

### Fieldsets

Use for grouped logical units: address blocks, employment sections, contact info, financial accounts. ALWAYS use `type: "fieldset"` and `label`.

### Fields to skip

NEVER create fields for:

- "For Office Use Only" sections
- Internal processing codes / stamps
- Page numbers, revision dates
- Barcodes, QR codes
- Repeating section headers (structural, not data)

### Checkpoint

Present table:

| Field ID | Type | Label | Required | Constraints |

For fieldsets, show grouping hierarchy. Ask: "I identified these fields. Should I add, remove, or change any?"

Ambiguous? Present as multiple choice:

- "The 'Tax ID' field could be: (a) `text` with SSN pattern, (b) `text` with EIN pattern, or (c) `identification` type. Which is correct?"

Or ask:
- Group of fields could be a fieldset or separate top-level
- Required status unclear
- Enum values cut off in PDF
- Checkbox could be boolean (single) or part of multiselect

## Stage 4: Extract Logic

**Goal:** find conditional instructions and validation rules in the PDF text.

**Load:** [logic.md](./logic.md) for CondExpr syntax, defs, rules, expression context.

### PDF text patterns → logic

| PDF Text | Create |
|----------|--------|
| "If yes, complete Section B" | `visible` expression on Section B fields |
| "Required if married" | `required` expression on the field |
| "Complete only if Line 3 exceeds Line 5" | `visible` referencing fields |
| "Enter the sum of lines 1 through 4" | `defs` entry for the sum |
| "End date must be after start date" | `rules` entry |
| "Not to exceed 2x monthly rent" | `rules` entry |
| "If applicable" / "optional" | Leave `required: false` (default) |

### Checkpoint

Present defs and rules in plain language. For each:

**Defs:** key, type, expression
**Rules:** key, what it validates, severity (error or warning)

Ask: "Here are the conditional logic and validation rules I extracted. Should I add, remove, or change any?"

Ambiguous? Ask:
- Condition could be visibility OR requirement (or both)
- PDF text unclear about which fields are affected
- Calculation formula partially visible

## Stage 5: Create Layers

**Goal:** create PDF file layer with bindings (if AcroForm), optional markdown layer, set `defaultLayer`.

**Load:** [pdf-bindings.md](./pdf-bindings.md) for PDF AcroForm bindings, signature block coordinates, naming conventions. Cross-reference [layers.md](./layers.md) for layer schema.

### Decisions

| PDF state | Action |
|-----------|--------|
| Has AcroForm fields | ALWAYS create PDF file layer with `bindings` |
| Flat (no AcroForm) | SKIP PDF layer; markdown layer is required |

### Markdown layer rules

ALWAYS create a markdown inline layer (even alongside a PDF layer) — it's a human-readable template:

- Use `{{fieldId}}` (NOT `{{fields.fieldId}}`)
- Mirror the PDF's section structure
- Include section headings from the PDF
- Use signature helpers (see [layers.md](./layers.md)) — NEVER manual underscore lines
- NEVER include "For Office Use" sections

### Default layer

| Scenario | `defaultLayer` |
|----------|---------------|
| PDF layer exists | `"pdf"` |
| Markdown only | `"markdown"` |

### Signature blocks

Position by `(page, x, y, width, height)`. Naming: combine party role + block type (`buyerSig`, `tenant0Sig`, `witnessSig`). Coordinate estimation when exact values unavailable: see [pdf-bindings.md](./pdf-bindings.md).

### Checkpoint

Present:

1. PDF layer (if created): bindings table mapping field IDs to PDF field names
2. Signature blocks: each block with page, position, party role
3. Markdown layer: preview of template text
4. Default layer

Ask: "I've created these layers and bindings. Do field mappings look correct? Are signature block positions reasonable?"

Ambiguous? Ask:
- A PDF field name cannot be reliably determined
- Signature block position uncertain
- Unclear which party role a block belongs to

## Stage 6: Add Instructions

**Goal:** extract reference content from the PDF and generate AI guidance.

**Load:** [instructions.md](./instructions.md) for ContentRef shapes and design heuristics.

### `instructions` extraction (from the PDF)

| PDF Content | Include? |
|------------|----------|
| "Instructions for Form W-9" | YES — official guidance |
| Filing deadlines and procedures | YES — compliance |
| Legal definitions ("For purposes of this form...") | YES — domain reference |
| Penalty warnings ("Under penalty of perjury...") | YES — legal |
| Regulatory citations ("26 CFR 1.1441-1") | YES |
| General disclaimers | YES |
| "For Office Use Only" instructions | NO — internal processing |
| Page layout instructions ("Continue on page 2") | NO — structural |

**Where in the PDF:**
1. Separate instructions page(s) — often last page of government forms
2. Header/footer text ("See instructions on reverse")
3. Inline help text below or beside fields
4. Certification sections
5. Definitions sections

### Format for instructions

ALWAYS use file ContentRef. Extract the instruction text into `instructions/<artifact-name>-instructions.md`. NEVER inline.

```json
"instructions": {
  "kind": "file",
  "path": "instructions/w9-instructions.md",
  "mimeType": "text/markdown",
  "title": "IRS W-9 Instructions (Rev. March 2024)",
  "description": "Official IRS instructions for completing Form W-9"
}
```

### Extracting instruction text

1. Preserve original structure (headings, numbered items, bullets)
2. Convert to clean markdown
3. Remove page layout artifacts (headers, footers, page numbers)
4. Keep legal citations and regulatory references intact
5. Keep original language — do NOT paraphrase legal/regulatory text

### `agentInstructions` (generated)

Not extracted — GENERATED based on form analysis.

Required content:

1. Form purpose (one sentence)
2. Field presentation order
3. Grouping into logical sections
4. Tone (formal, professional, friendly)
5. Special handling for sensitive fields

Format: file ContentRef preferred for detailed guidance, inline for short, form-specific prompts.

```
This is a [FORM TYPE] used by [WHO] to [PURPOSE].

Present fields in this order:
1. [SECTION]: [field1], [field2], [field3]
2. [SECTION]: [field4], [field5]

[CONDITIONAL LOGIC NOTES]

Tone: [TONE].
[SPECIAL HANDLING NOTES]
```

DO:
- Reference field IDs by name
- Describe logical flow
- Note conditional sections
- Mention data format expectations

DO NOT:
- Repeat field labels
- Include raw schema structure
- Copy legal text (that goes in `instructions`)
- Exceed ~2000 characters

### Checkpoint

Present:

1. Instructions file: path + summary of extracted content
2. agentInstructions: full text of generated guidance

Ask: "Does the instructions content accurately capture the PDF's guidance? Is the agentInstructions appropriate?"

Ambiguous? Ask:
- PDF has no clear instructions section — write minimal or omit?
- Instructions text might be jurisdiction-specific
- Tone for agentInstructions unclear

## Stage 7: Validate & Review

**Goal:** write the final artifact, validate, fix errors, present summary, get sign-off.

**Load:** [schemas.md](./schemas.md) — validation rules and common errors.

1. Write the artifact
2. Run `npx paradoc validate <output-file>`
3. Fix all errors and re-validate
4. Present final summary: field count, parties, logic rules, layers, instructions
5. User confirms

## Common Issues

**PDF has no AcroForm fields (flat / scanned)**
Use visual layout analysis to identify fields from labels and blank lines. Create fields manually. No PDF bindings layer — use markdown layer as default.

**Validation fails after generation**
Usually a schema mismatch — missing required properties, wrong field type, invalid CondExpr. Read the error carefully. Common: ensure `$schema` is set, field types match enum, CondExpr uses `fields.<id>` in field-level expressions.

**Field type mismatches**
Defaulting to `text` when a more specific type fits. Re-check PDF context. See type table in [fields.md](./fields.md).

**Binding errors — PDF field names don't match**
PDF AcroForm names contain special characters, nested prefixes, or differ from visible labels. Use the EXACT AcroForm field name (including dots, brackets, prefixes). Do NOT rename. See [pdf-bindings.md](./pdf-bindings.md).

## Examples

### Example 1: Simple tax form (W-9)

User: "Convert this W-9 PDF to Paradoc."

Pipeline outcome: `w9.json` with ~15 fields (taxpayer name, TIN, address, tax classification as enum, certification checkboxes), one party (`taxpayer`, type `any`), PDF bindings layer mapping AcroForm fields, agentInstructions covering IRS requirements. Conditional logic shows Part II only when `foreignStatus` is true.

### Example 2: Multi-party rental application

User: "I have this rental application PDF, make it Paradoc."

Pipeline outcome: `rental-application.json` with ~40 fields across fieldsets (personal, employment, references, vehicles), two parties (`applicant` min 1 max 2, `landlord` min 1 max 1), rules enforcing "move-in date after application date", markdown layer (no AcroForm fields in flat PDF).

## See Also

- [fields.md](./fields.md), [parties.md](./parties.md), [logic.md](./logic.md), [layers.md](./layers.md), [pdf-bindings.md](./pdf-bindings.md), [instructions.md](./instructions.md), [annexes.md](./annexes.md)
- [schemas.md](./schemas.md) — validation
- [cli.md](./cli.md) — `para inspect` for AcroForm field name extraction
