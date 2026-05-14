# Paradoc Skills

Official collection of agent skills for [Paradoc](https://paradoc.dev) — the documents-as-code framework.

Skills are packaged instructions that extend AI coding agents with deep knowledge of Paradoc's APIs, patterns, and tooling.

## Available Skill

| Skill | Trigger | What it covers |
|---|---|---|
| [paradoc](skills/paradoc/) | Any Paradoc work | All surfaces (TypeScript SDK, `para` CLI, raw JSON/YAML, `mcp.paradoc.dev`) and end-to-end workflows (create new form from requirements, convert PDF to artifact) |

A single skill with topic-organized references. Surface refs (`sdk`, `cli`, `schemas`, `mcp`) describe how to express things on each surface; topic refs (`fields`, `parties`, `annexes`, `logic`, `layers`, `rendering`, `serialization`, `instructions`, `pdf-bindings`, `artifacts`) describe the underlying concepts and are loaded as needed; workflow refs (`workflow-create-form`, `workflow-convert-pdf`) orchestrate stages by linking to topic refs.

## Installation

### Claude Code

```bash
npx skills add https://github.com/paradoc-dev/skills --skill paradoc
```

Or manually copy:

```bash
git clone https://github.com/paradoc-dev/skills.git
cp -r skills/skills/paradoc ~/.claude/skills/
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
      cli.md          # para CLI
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
      serialization.md
      instructions.md
      pdf-bindings.md
      # Workflow refs — staged pipelines
      workflow-create-form.md
      workflow-convert-pdf.md
```

## Contributing

Each reference is a standalone markdown file with YAML frontmatter. See any existing reference file for the format, and see [AGENTS.md](AGENTS.md) for repository conventions.

## License

MIT
