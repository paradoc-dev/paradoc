# Paradoc Skills

Official collection of agent skills for [Paradoc](https://paradoc.dev) — the documents-as-code framework.

Skills are packaged instructions that extend AI coding agents with deep knowledge of Paradoc's APIs, patterns, and tooling.

## Available Skills

| Skill | Trigger | What it covers |
|---|---|---|
| [paradoc](skills/paradoc/) | Any Paradoc work | All surfaces (TypeScript SDK, `paradoc` CLI, raw JSON/YAML, `mcp.paradoc.dev`) and end-to-end workflows (create new form from requirements, convert PDF to artifact) |
| [compose-documents](skills/compose-documents/) | Authoring or checking a `.tsx`/`.jsx` composition with `@paradoc/react` | The component vocabulary, the pagination rule, the safe Tailwind class subset, tenant branding tokens, binding a composition to a form artifact's React layer, and `paradoc check`/`paradoc add` |

`paradoc` is a single skill with topic-organized references. Surface refs (`sdk`, `cli`, `schemas`, `mcp`) describe how to express things on each surface; topic refs (`fields`, `parties`, `annexes`, `logic`, `layers`, `rendering`, `formatting`, `instructions`, `pdf-bindings`, `artifacts`) describe the underlying concepts and are loaded as needed; workflow refs (`workflow-create-form`, `workflow-convert-pdf`) orchestrate stages by linking to topic refs.

`compose-documents` is a second, narrower skill for the `@paradoc/react` composition surface specifically — install it on its own when the only Paradoc surface in play is composing documents in React.

## Installation

### Claude Code

```bash
npx skills add https://github.com/paradoc-dev/skills --skill paradoc
npx skills add https://github.com/paradoc-dev/skills --skill compose-documents
```

Or manually copy:

```bash
git clone https://github.com/paradoc-dev/skills.git
cp -r skills/skills/paradoc ~/.claude/skills/
cp -r skills/skills/compose-documents ~/.claude/skills/
```

### claude.ai

Add the skill to project knowledge or paste the `SKILL.md` contents into the conversation.

## Structure

```
skills/
  paradoc/
    SKILL.md          # Manifest and dispatch table
    metadata.json     # Version and metadata
    references/
      # Surface refs — how to express things on each surface
      sdk.md          # TypeScript SDK
      cli.md          # paradoc CLI
      schemas.md      # Raw JSON/YAML
      mcp.md          # mcp.paradoc.dev MCP service
      # Topic refs — canonical concept knowledge
      artifacts.md
      fields.md
      parties.md
      annexes.md
      logic.md
      layers.md
      rendering.md
      formatting.md
      instructions.md
      pdf-bindings.md
      # Workflow refs — staged pipelines
      workflow-create-form.md
      workflow-convert-pdf.md
  compose-documents/
    SKILL.md          # Manifest and dispatch table
    metadata.json      # Version and metadata
    references/
      components.md       # The component vocabulary and props
      pagination.md        # The keep-together rule
      safe-classes.md      # The verified Tailwind subset and branding tokens
      artifact-binding.md  # The React layer, binding, and the seal
      cli.md                # paradoc check / paradoc add
```

## Contributing

Each reference is a standalone markdown file with YAML frontmatter. See any existing reference file for the format, and see [AGENTS.md](AGENTS.md) for repository conventions.

## License

MIT
