# AGENTS.md

Guidance for AI agents working in this tree.

## Overview

The official agent skills for [Paradoc](https://paradoc.dev), the documents-as-code framework. Users install them from `github.com/paradoc-dev/paradoc` with `npx skills add https://github.com/paradoc-dev/paradoc --skill <name>`.

Two skills:

- `skills/paradoc/`: authoring, filling, validating, rendering and sealing artifacts on every surface (TypeScript SDK, `paradoc` CLI, raw JSON/YAML, AI agent tools, hosted MCP), plus the authoring workflow.
- `skills/paradoc-react/`: composing, checking, previewing, rendering and sealing documents written in React with `@paradoc/react` and `@paradoc/react-pdf`.

## Structure

```text
.
├── AGENTS.md         # This file
├── README.md         # User-facing overview
└── skills/
    ├── paradoc/
    │   ├── SKILL.md
    │   ├── metadata.json
    │   └── references/
    │       # Surface refs
    │       ├── sdk.md, cli.md, schemas.md, ai-tools.md, mcp.md
    │       # Topic refs
    │       ├── artifacts.md, fields.md, parties.md, annexes.md, logic.md,
    │       ├── layers.md, templates.md, pdf.md, rendering.md, formatting.md,
    │       ├── instructions.md, filling.md, sealing.md, essentials.md
    │       # Workflow refs
    │       └── workflow-author-form.md
    └── paradoc-react/
        ├── SKILL.md
        ├── metadata.json
        └── references/
            ├── components.md, pagination.md, safe-classes.md,
            └── custom-components.md, render-and-seal.md, cli.md
```

## Reference categories (`paradoc`)

`paradoc` spans five surfaces, so its references split three ways. `paradoc-react` covers one surface and keeps a flat set of topic references; do not force it into these categories.

| Category | Purpose | Examples |
|---|---|---|
| **Surface** | How to do things on one surface. Thin guides that link to topic refs for shapes. | `sdk.md`, `cli.md`, `ai-tools.md` |
| **Topic** | The single source of truth for one concept, surface-agnostic. Show JSON and SDK side by side where useful. | `fields.md`, `logic.md`, `sealing.md` |
| **Workflow** | A staged pipeline that links to topic refs at each stage. Every stage ends on a command result. | `workflow-author-form.md` |

Topic refs are canonical. Surface and workflow refs link to them and do not restate them.

## File conventions

Skills follow the [Agent Skills specification](https://agentskills.io/specification.md).

### `SKILL.md` frontmatter

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Equals the parent directory. Lowercase and hyphens, 1-64 chars. |
| `description` | Yes | Max 1024 chars. Lead with what the skill does, then one trigger per distinct use. |
| `metadata` | No | `author`, `version`, `tags`, `license`. |
| `allowed-tools` | No | Space-separated pre-approved tools. |

Keep `SKILL.md` short (about 150 lines). It loads in full on activation. Put depth in references, behind pointers that say when to load them.

### Reference frontmatter

```yaml
---
name: <ref-name>
description: <one-line description>
metadata:
  tags: <comma-separated>
---
```

### Naming

- Skill directory: `paradoc` for the general skill; every other skill takes the `paradoc-` prefix (`paradoc-react`), so its name says whose it is.
- `SKILL.md`: uppercase, exact.
- Surface refs: one word (`sdk.md`). Topic refs: one concept (`fields.md`); hyphens only for a real compound (`safe-classes.md`).
- Workflow refs: `workflow-` prefix, flat in `references/`.

### Cross-references

Use relative links: `[fields](./fields.md)` between references, `[references/fields.md](./references/fields.md)` from `SKILL.md`. References stay one level deep. Between skills, name the other skill in prose; do not link across skill folders.

## Writing style

- Imperative: "Use the most specific type."
- State the target behavior. Keep ALWAYS/NEVER for hard guardrails that are true.
- Tables for reference data. Language-tagged code blocks.
- One concept per section. Short paragraphs. No em dashes.
- Cite real APIs only, with their real import paths.
- Every example runs: artifacts validate, snippets reassign immutable returns and include their setup.
- Files over 100 lines start with a `**Contents:**` line.

## Global rules in `paradoc`

The skill states these in `SKILL.md`; repeat one in a reference only where it applies directly:

- Schema version `2026-09-23`: `$schema` is `https://schema.paradoc.dev/2026-09-23.json` for every artifact kind. Migrate older files with `npx paradoc-cli migrate`.
- Validate files with `npx paradoc-cli validate <file>`.
- Artifact name pattern `^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$`. Field, party, def and rule ids `^[a-z][a-zA-Z0-9_]*$`.
- Use the most specific field type.
- Templates name values as `{{fields.fieldName}}`; conditions are boolean. Signatures use the signing directives, bound to `signatures` slots.

## Validation

```bash
uvx --from skills-ref agentskills validate ./skills/paradoc
uvx --from skills-ref agentskills validate ./skills/paradoc-react
```

Tests tie the skills to the code:

- `packages/schemas/tests/skill-docs.test.ts` checks `paradoc`: the field type lists, the signature slot types, and every JSON example. Label each JSON example that parses with its container, for example ```` ```json schema=fields ````. Labels: `artifact`, `form`, `fields`, `parties`, `defs`, `layers`, `layer`, `cli-config`, `registries`.
- `packages/react-pdf/tests/pdf-class-vocabulary-docs.test.ts` checks the `## The verified families` table in `paradoc-react/references/safe-classes.md` against the PDF class vocabulary.

## When editing

1. Put the content in the right category, and link instead of restating.
2. Update cross-references when renaming. Search the repo for the old name.
3. Keep `metadata.version` in `SKILL.md` and `metadata.json` equal to the framework version the skill documents.
