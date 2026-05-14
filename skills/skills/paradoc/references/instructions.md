---
name: instructions
description: ContentRef for instructions and agentInstructions — inline vs file, when to use each, design heuristics
metadata:
  tags: instructions, agent-instructions, contentref, inline, file, compliance, guidance
---

# Instructions (ContentRef)

All four artifact types support two instruction properties, both using the **ContentRef** type:

| Property | Purpose |
|----------|---------|
| `instructions` | Domain or compliance reference content (regulatory, filing rules, legal) — for human readers |
| `agentInstructions` | LLM/agent prompts for field ordering, grouping, tone — for AI agents |

## ContentRef Types

A ContentRef is either **inline** or **file**.

### Inline ContentRef

Embeds content in the artifact JSON.

**Required:** `kind`, `text`

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `kind` | YES | `"inline"` | Discriminator |
| `text` | YES | string | Content text (max 1,000,000 chars) |

```json
"instructions": {
  "kind": "inline",
  "text": "Line 1: Enter your full legal name as it appears on your tax return.\nLine 2: Enter your SSN."
}
```

### File ContentRef

References an external content file.

**Required:** `kind`, `path`, `mimeType`

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `kind` | YES | `"file"` | Discriminator |
| `path` | YES | string | Path (max 1000 chars) |
| `mimeType` | YES | string | MIME type (max 100 chars) |
| `title` | No | string | Title (max 200) |
| `description` | No | string | Description (max 2000) |
| `checksum` | No | string | `sha256:<64-hex>` |

```json
"instructions": {
  "kind": "file",
  "path": "instructions/w9-instructions.md",
  "mimeType": "text/markdown",
  "title": "IRS W-9 Instructions",
  "description": "Official IRS instructions for completing Form W-9"
}
```

For workflow contexts (creating new artifacts, converting PDFs): ALWAYS use file ContentRef. Naming convention:

| Property | File Path |
|----------|-----------|
| `instructions` | `instructions/<artifact-name>.instructions.md` (or `<name>-instructions.md`) |
| `agentInstructions` | `instructions/<artifact-name>.agent.md` |

When using file ContentRef, you MUST create the referenced file.

## When to Use Each

### Use `instructions` for

- Official reference material (IRS instructions, regulatory text)
- Compliance requirements and filing procedures
- Domain term definitions, legal disclaimers
- Jurisdiction-specific rules, penalty warnings
- Regulatory citations (e.g., "26 CFR 1.1441-1")
- Text the end user might need to read

### Use `agentInstructions` for

- LLM/agent prompts for how to present and fill the form
- Field ordering and grouping preferences
- Tone and formatting guidance
- Conditional logic hints
- Data format expectations
- When to prompt for clarification vs. infer

### Use both when

Most forms benefit from both — `instructions` for the human-facing context, `agentInstructions` for AI behavior.

```json
{
  "name": "rental-application",
  "kind": "form",
  "instructions": {
    "kind": "file",
    "path": "instructions/rental-application.instructions.md",
    "mimeType": "text/markdown"
  },
  "agentInstructions": {
    "kind": "file",
    "path": "instructions/rental-application.agent.md",
    "mimeType": "text/markdown"
  }
}
```

## What Belongs Where

### `instructions` content

| Include | Skip |
|---------|------|
| Filing deadlines and procedures | "For Office Use Only" instructions |
| Regulatory citations | Page layout instructions |
| Domain term definitions | Internal processing notes |
| Legal disclaimers, penalty warnings | How to fill specific fields (use field `description`) |
| Statutory requirements | AI behavior directives (use `agentInstructions`) |

### `agentInstructions` content

Required content (every `agentInstructions`):

1. **Form purpose** — one sentence
2. **Field presentation order**
3. **Grouping** into logical sections
4. **Tone** (formal, professional, friendly)
5. **Special handling** for sensitive fields

Optional content:

- Conditional logic hints
- Data format guidance
- Common mistakes
- Cross-field relationships

DO:
- Reference field IDs by name
- Describe logical flow, not flat lists
- Note conditional sections

DO NOT:
- Repeat field labels (the agent reads them from the schema)
- Include raw schema structure
- Copy legal text (that goes in `instructions`)
- Exceed ~2000 characters

## Examples

### Tax form — instructions file

`instructions/w9.instructions.md`:

```markdown
This form is used to request your taxpayer identification number (TIN).
Under penalties of perjury, you certify that:

1. The TIN shown is your correct TIN.
2. You are not subject to backup withholding.
3. You are a U.S. citizen or other U.S. person.

For more information, see IRS Publication 515.
```

### Tax form — agentInstructions file

`instructions/w9.agent.md`:

```markdown
Present fields in this order:
1. Name (as shown on income tax return)
2. Business name (if different)
3. Federal tax classification (guide user through options)
4. Exemptions (only if user qualifies)
5. Address
6. TIN (SSN or EIN based on entity type)

Use formal, professional tone. Mask all but last 4 digits when confirming.
```

### Rental application — agentInstructions

```markdown
Guide the applicant through these sections in order:
1. Personal information (name, DOB, contact)
2. Current address and rental history
3. Employment and income
4. References
5. Authorization and consent

For income fields, ask for annual amounts and display with currency formatting.
If self-employed, ask follow-up questions about business type. Be empathetic
but thorough — explain why financial information is needed.
```

## SDK Patterns

```typescript
// Object pattern
const form = para.form({
  name: "w2-wage-statement",
  instructions: { kind: "inline", text: "Complete all boxes..." },
  agentInstructions: { kind: "file", path: "instructions/w2-agent.md", mimeType: "text/markdown" },
  fields: { /* ... */ },
});

// Builder pattern
const form = para.form()
  .name("w2-wage-statement")
  .instructions({ kind: "inline", text: "Complete all boxes..." })
  .agentInstructions({ kind: "file", path: "instructions/w2-agent.md", mimeType: "text/markdown" })
  .fields({ /* ... */ })
  .build();
```

## See Also

- [artifacts.md](./artifacts.md) — all artifacts support these properties
- [fields.md](./fields.md) — field `description` for per-field help text
- [layers.md](./layers.md) — template content (separate from instructions)
