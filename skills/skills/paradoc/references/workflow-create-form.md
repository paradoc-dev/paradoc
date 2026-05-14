---
name: workflow-create-form
description: Interactive 7-stage pipeline to create a new Paradoc form artifact from user requirements — gather, design, validate
metadata:
  tags: workflow, create, new, form, pipeline, requirements, design, interactive
---

# Workflow: Create New Form

Interactive pipeline that guides creation of a new Paradoc form artifact through dialogue. Every stage presents findings, asks for confirmation, and incorporates feedback before proceeding.

**Output:** valid form artifact (`.json` or `.yaml`) with fields, parties, layers, defs, rules, instructions, agentInstructions — plus referenced template and instruction files.

**Trigger phrases:** "create a form", "new form", "build a form", "design a form", "form for X".

## Setup

- All artifacts use schema version `2026-01-01` (`$schema` per [artifacts.md](./artifacts.md))
- ALWAYS use `npx paradoc validate <file>` after every significant change — see [schemas.md](./schemas.md)
- File MUST be named `<name>.json` or `<name>.yaml`. Name pattern: `^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$`

## Pipeline Overview

```
1. Gather Requirements    — dialogue + optional web research
2. Design Fields          — present field list, confirm
3. Design Parties         — present party roles, confirm (skip if not needed)
4. Design Logic           — present defs/rules, confirm (skip if not needed)
5. Create Layers          — present template structure, confirm
6. Add Instructions       — present instructions content, confirm
7. Validate               — final review with user
```

For CRITICAL decisions (ambiguous field types, whether parties are needed, complex logic), ALWAYS ask the user rather than assuming.

## Stage 1: Gather Requirements

**Goal:** understand what the user needs through dialogue. If a common form type, search the web first.

### Web research

When the user requests a well-known form type (W-9, rental application, patient intake), search the web for representative examples to inform the design. Skip if:

- The user already provided a detailed field list
- The form is highly custom
- The user explicitly declines research

### Questions to ask

Group related questions; let the user answer naturally rather than dumping everything at once.

**Domain and purpose**

1. What domain is this form for? (real estate, tax, healthcare, credit, employment, insurance, legal, government)
2. What is the specific purpose? (lease agreement, loan application, patient intake, tax filing)
3. Who is the target audience? (individuals, businesses, both)

**Data collection**

4. What information does this form collect?
5. Are there sections or groups of related data?
6. Are any fields conditional?

**Parties and signatures**

7. Who fills out this form?
8. Does anyone sign it? Who?
9. Are witnesses or notarization required?
10. Can there be multiple people in the same role?

**Output and presentation**

11. What output formats? (markdown, HTML, plain text)
12. Specific layout for rendered output?
13. Title page or header section?

**Business rules**

14. Cross-field validation rules?
15. Computed values?
16. Regulatory/compliance requirements?

### Decision matrix

| Signal | Add |
|--------|-----|
| Dollar amounts, prices | `money` fields |
| Dates, deadlines | `date` / `duration` fields |
| Yes/no, checkboxes | `boolean` fields |
| Selecting from options | `enum` / `multiselect` fields |
| Signatures | `parties` with `signature` |
| Conditional display | `visible` expressions |
| Validation rules | `rules` section |
| Computed values | `defs` section |
| Regulatory context | `instructions` (ContentRef) |
| AI-assisted filling | `agentInstructions` (ContentRef) |
| File attachments | `annexes` |
| Grouping fields | `fieldset` |

### Domain quick-reference

**Real estate (lease, purchase agreement)**
Fields: tenant/landlord names, property address, rent, deposit, lease term, move-in date, pet policy, utilities.
Parties: tenant, landlord, guarantor, agent.
Rules: deposit ≤ 2x rent, end > start, guarantor required if credit < threshold.

**Tax (W-9, 1040, state forms)**
Fields: taxpayer name, SSN/EIN, filing status, income lines, deductions, address.
Parties: taxpayer, preparer.
Rules: line totals balance, conditional fields by filing status.

**Healthcare (patient intake, consent)**
Fields: patient name, DOB, insurance, medical history, allergies, medications, emergency contact.
Parties: patient, guardian, physician.
Rules: guardian if patient < 18, insurance fields if insured.

**Credit / lending (loan application)**
Fields: borrower name, SSN, employment, income, assets, liabilities, loan amount.
Parties: borrower, co-borrower, lender.
Rules: DTI, LTV ratios.

**Employment**
Fields: applicant name, contact, work history, education, references, availability.
Parties: applicant, hiring manager.

### Format defaults

- **Markdown** (`text/markdown`): ALWAYS include — default for most forms
- **HTML** (`text/html`): when web rendering is needed
- **Plain text** (`text/plain`): when minimal/accessible output is needed

If the user does not specify, default to markdown only.

### Exit criteria

You MUST have answers to questions 1-5 and 11 before Stage 2. Reasonable defaults fill gaps:

- No parties mentioned → skip Stage 3
- No business rules → skip Stage 4
- No format preference → markdown only

### Checkpoint

Present numbered summary:

1. Form name and purpose
2. Target audience
3. Key data sections and fields
4. Parties / signatures needed?
5. Logic / rules needed?
6. Output formats

Ask: "Here is my understanding of your requirements. Is this correct? Anything to add or change?"

If web research was performed, also: "Based on common [form type] forms, I recommend considering: [additional fields]. Include any?"

Wait for confirmation before Stage 2.

## Stage 2: Design Fields

**Goal:** define all fields with correct types, constraints, identifiers.

**Load:** [fields.md](./fields.md) — full field type reference, identifier rules, constraints, fieldsets, design heuristics.

Use the type selection table in fields.md. ALWAYS use the most specific type. NEVER `text` when a structured type fits.

### Checkpoint

Present field table:

| ID | Type | Label | Required | Constraints |
|----|------|-------|----------|-------------|
| applicantName | text | Full Legal Name | yes | minLength: 2, maxLength: 100 |
| dateOfBirth | date | Date of Birth | yes | — |
| ... | ... | ... | ... | ... |

For ambiguous types, present as multiple choice: "For 'Monthly Rent', should this be: (a) money, (b) number, (c) text?"

Ask: "Here are the fields I recommend. Should I add, remove, or change any?"

Wait for confirmation. Then run `npx paradoc validate` on the partial artifact.

## Stage 3: Design Parties (if needed)

**Goal:** define party roles and signature requirements. Skip if no signatures — ASK if uncertain.

**Load:** [parties.md](./parties.md) — FormParty properties, signature object, common patterns, role naming.

### Checkpoint

Present party table:

| Role | Label | Type | Min | Max | Signature Required |
|------|-------|------|-----|-----|--------------------|
| tenant | Tenant | person | 1 | 4 | yes |
| landlord | Landlord | any | 1 | 1 | yes |

For uncertain configurations, ask: "Should the guarantor be required, or only when credit score is below a threshold?"

Wait for confirmation. Then validate.

## Stage 4: Design Logic (if needed)

**Goal:** add conditional visibility, defs, validation rules. Skip if no cross-field dependencies — ASK if uncertain.

**Load:** [logic.md](./logic.md) — CondExpr, defs, rules, expression context, design heuristics.

### Checkpoint

Present defs and rules:

**Defs:**
1. `totalMonthlyIncome` (number) = salary + bonusIncome + rentalIncome
2. `isHighRisk` (boolean) = creditScore < 620 or debt ratio > 43%

**Rules:**
1. `endAfterStart`: End date after start date (error)
2. `depositLimit`: Deposit ≤ 2x rent (error)
3. `highDeposit`: Warning at 1.5x rent (warning)

For complex decisions, present as options: "For deposit limit: (a) hard cap at 2x, (b) warn at 1.5x and cap at 2x, or (c) just warn?"

Wait for confirmation. Then validate.

## Stage 5: Create Layers

**Goal:** generate Handlebars template files for requested output formats.

**Load:** [layers.md](./layers.md) — layer kinds, MIME types, Handlebars syntax, signature helpers, design checklist.

### Workflow rules for this stage

- ALWAYS use file layers (`"kind": "file"`). NEVER inline.
- Create the template file at the specified `path`.
- Use `{{fieldName}}` (NOT `{{fields.fieldName}}`).
- Use signature helpers (`{{signature "loc"}}`, `{{initials "loc"}}`, `{{signatureDate "loc"}}`) inside party blocks. NEVER manual underscore lines.
- Set `defaultLayer` on the artifact.

Layer key convention:

| Format | Key | MIME |
|--------|-----|------|
| Markdown | `markdown` | `text/markdown` |
| HTML | `html` | `text/html` |
| Plain text | `plainText` | `text/plain` |

### Checkpoint

Present layout summary:

```
Template: markdown
  - Title and description header
  - Section: Personal Information (firstName, lastName, dateOfBirth)
  - Section: Contact (email, phone)
  - Section: Employment (employmentStatus, annualIncome)
  - Conditional: Pet Information (hasPets, petCount, petDeposit)
  - Signature block (tenant, landlord)
```

Ask: "Here is the template layout. Does this look right?"

Wait for confirmation. Then validate.

## Stage 6: Add Instructions

**Goal:** add domain context (`instructions`) and AI guidance (`agentInstructions`).

**Load:** [instructions.md](./instructions.md) — ContentRef shapes, when to use each, design heuristics.

### Workflow rules for this stage

- ALWAYS use file ContentRef (`"kind": "file"`). NEVER inline.
- File naming:
  - `instructions/<artifact-name>.instructions.md`
  - `instructions/<artifact-name>.agent.md`
- Create the referenced markdown files at the specified paths.

### Checkpoint

Present:

**Instructions** (file: `instructions/<artifact-name>.instructions.md`):
> [Summary of content]

**Agent Instructions** (file: `instructions/<artifact-name>.agent.md`):
> [Summary of content]

Ask: "Here are the instructions. Any changes?"

Wait for confirmation. Then validate.

## Stage 7: Validate & Review

**Goal:** final validation and user sign-off.

**Load:** [schemas.md](./schemas.md) — validation rules and common errors. Re-load topic refs as needed.

1. Run `npx paradoc validate <file>`
2. Fix all errors. NEVER skip.
3. Present final summary: field count, parties, logic rules, layers, instructions
4. Ask user to confirm

## Common Issues

**Validation: "unknown field type"**
Common mismatches: `currency` → `money`, `datetime` → `date` (for date-only), `string` → `text`. Check [fields.md](./fields.md).

**Field type ambiguity**
ALWAYS use the most specific type. `text` for an email is wrong — use `email`. See type-selection table in [fields.md](./fields.md).

**Layer template syntax errors**
Use `{{fieldName}}`, NOT `{{fields.fieldName}}` or `{{fieldName.value}}`. Fields are spread at top level during rendering.

**Missing parties causing validation errors**
Form references party roles in signature blocks or logic but no `parties` is defined. Either add the `parties` object or remove the references.

## Examples

### Example 1: Simple data-collection form

User: "Create a patient intake form for a dental office."

Pipeline:
- Stage 1: Web search common dental intake fields → present ~15-20 fields → no parties needed (data collection only) → simple required-field logic → markdown layer → instructions about HIPAA context → validate
- Output: `dental-intake.json` + `templates/dental-intake.md` + `instructions/dental-intake.instructions.md`

### Example 2: Multi-party form with signatures

User: "I need a residential lease agreement."

Pipeline:
- Stage 1: Web search lease structure → fields for property, rent, deposit, utilities → two parties (landlord, tenant max 4) → conditional fields (pet deposit only if pets allowed) → markdown + HTML layers with signature blocks → instructions about local tenancy law → validate
- Output: `residential-lease.json` + 2 template files + 2 instruction files

## See Also

- [fields.md](./fields.md), [parties.md](./parties.md), [logic.md](./logic.md), [layers.md](./layers.md), [instructions.md](./instructions.md), [annexes.md](./annexes.md)
- [schemas.md](./schemas.md) — validation
- [cli.md](./cli.md) — `para new` for non-interactive scaffolding
