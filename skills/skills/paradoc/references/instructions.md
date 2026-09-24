---
name: instructions
description: instructions and agentInstructions - the ContentRef shape, what belongs in each, attaching files with checksums, and where each surface reads them
metadata:
  tags: instructions, agentInstructions, contentref, attach, checksum, fix, get_artifact
---

# Instructions

**Contents:** [Two properties](#two-properties) · [ContentRef shape](#contentref-shape) · [Attach a file](#attach-a-file) · [What belongs where](#what-belongs-where) · [Where they are read](#where-they-are-read) · [SDK](#sdk)

## Two properties

Every artifact kind (form, document, checklist, bundle) takes two optional instruction properties:

| Property | Reader | Holds |
|----------|--------|-------|
| `instructions` | People filling or reviewing the artifact | Official guidance: filing rules, definitions, legal notices |
| `agentInstructions` | An AI agent presenting or filling the artifact | How to run the conversation: order, grouping, tone, sensitive fields |

Put per-field help in the field's `description`.

## ContentRef shape

Each property is a ContentRef: inline text or a file reference.

| Property | Inline | File | Notes |
|----------|--------|------|-------|
| `kind` | `"inline"` | `"file"` | Discriminator |
| `text` | required | none | Up to 1,000,000 characters |
| `path` | none | required | Relative to the artifact file's directory |
| `mimeType` | none | required | Usually `text/markdown` |
| `checksum` | none | optional | `sha256:<64 hex>` |
| `title`, `description` | none | optional | Up to 200 and 2000 characters |

```json schema=artifact
{
  "$schema": "https://schema.paradoc.dev/2026-09-24.json",
  "name": "rental-application",
  "kind": "form",
  "instructions": {
    "kind": "file",
    "path": "instructions/rental-application.instructions.md",
    "mimeType": "text/markdown",
    "title": "Application rules"
  },
  "agentInstructions": {
    "kind": "inline",
    "text": "Ask for parties.applicant first, then currentAddress and employer. Confirm monthlyIncome as a yearly amount."
  }
}
```

Use a file for anything longer than a paragraph. Name files `instructions/<artifact-name>.instructions.md` and `instructions/<artifact-name>.agent.md`.

## Attach a file

Write the file, then attach it. `paradoc attach` writes the ContentRef with the MIME type and checksum:

```bash
paradoc attach rental-application.json instructions/rental-application.agent.md --as agent-instructions -y
paradoc attach rental-application.json instructions/rental-application.instructions.md --as instructions -y
```

After you edit an attached file, its checksum no longer matches and `paradoc validate` fails with `Checksum mismatch`. Update every checksum (layers and ContentRefs) in one step:

```bash
paradoc fix rental-application.json -y
paradoc validate rental-application.json
```

<!-- dep:C7 -->
`paradoc validate` reports a missing instruction file as an error and a missing checksum as a warning. The finish line is `paradoc validate` with no errors and no warnings.

## What belongs where

| `instructions` | `agentInstructions` |
|----------------|---------------------|
| Filing deadlines and procedures | Purpose of the form, in one sentence |
| Regulatory citations, statutory requirements | The order to ask in, by field id |
| Definitions of domain terms | Grouping into sections |
| Legal disclaimers, penalty warnings | Tone |
| Text the end user may need to read | Sensitive fields and how to confirm them |
| | Conditional sections and when they apply |

Write `agentInstructions` like this:

- Name fields by id (`taxClassification`, `parties.taxpayer.name`). The agent reads labels from the schema.
- Describe the flow and its branches.
- Stay within a few hundred words.

```markdown
Purpose: certify the taxpayer's TIN for a W-9.

1. Ask for parties.taxpayer.name, then businessName if it differs.
2. Ask for taxClassification. If it is llc, ask for llcType. If it is other, ask for otherDescription.
3. Ask for mailingAddress.
4. Ask for ssn for an individual, else ein.
5. Ask for exemptPayeeCode and fatcaExemptionCode only if the taxpayer says an exemption applies.

Use a formal tone. When confirming ssn or ein, show only the last 4 digits.
```

## Where they are read

| Surface | What it returns |
|---------|-----------------|
| AI tools `get_artifact` (`@paradoc/ai-tools` and its adapters) | Both refs resolved to content as `instructions` and `agent_instructions`: `{ kind, content, encoding, mime_type?, path? }`. Text is `utf-8`, other types `base64`, up to 5 MiB. Turn each off with `include_instructions: false` or `include_agent_instructions: false`. See [ai-tools.md](./ai-tools.md) |
| SDK instance | `form.instructions` and `form.agentInstructions` return the ContentRef, not the file content. Read a file ref yourself through the same resolver |
| `paradoc validate`, `paradoc fix` | Check and update file refs and their checksums |

## SDK

```typescript
import { p } from "@paradoc/sdk";

const w2 = p
  .form()
  .name("w2-wage-statement")
  .instructions({ kind: "file", path: "instructions/w2.instructions.md", mimeType: "text/markdown" })
  .agentInstructions({ kind: "inline", text: "Ask for employerEin before wages." })
  .fields({ employerEin: p.field.text().label("Employer EIN") })
  .build();

w2.agentInstructions; // { kind: "inline", text: "Ask for employerEin before wages." }
```

In the object form, `instructions` and `agentInstructions` are top-level properties of the definition passed to `p.form({ ... })`.
