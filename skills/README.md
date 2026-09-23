# Paradoc Skills

Agent skills for [Paradoc](https://paradoc.dev), the documents-as-code framework. A skill is a package of instructions and references that teaches an AI coding agent how to use Paradoc's APIs, CLI and file formats.

## Available skills

| Skill | Use it for |
|---|---|
| [paradoc](skills/paradoc/) | Authoring, filling, validating, rendering and sealing artifacts with the TypeScript SDK, the `paradoc` CLI, raw JSON/YAML, the AI agent tools, or the hosted MCP server. Includes a staged workflow for creating a form or converting a PDF form. |
| [paradoc-react](skills/paradoc-react/) | Composing, checking, previewing, rendering and sealing documents written in React with `@paradoc/react` and `@paradoc/react-pdf`. |

Install `paradoc-react` on its own when composing documents in React is the only Paradoc work in play. Install both when you also author the artifacts.

## Installation

### Claude Code

```bash
npx skills add https://github.com/paradoc-dev/paradoc --skill paradoc
npx skills add https://github.com/paradoc-dev/paradoc --skill paradoc-react
```

Or copy them by hand:

```bash
git clone https://github.com/paradoc-dev/paradoc.git
cp -r paradoc/skills/skills/paradoc ~/.claude/skills/
cp -r paradoc/skills/skills/paradoc-react ~/.claude/skills/
```

### Claude.ai

Upload `SKILL.md` and the relevant files from `references/` to your project knowledge.

### Other agents

The skills follow the [Agent Skills specification](https://agentskills.io/specification.md). Point your agent's skill loader at each skill's `SKILL.md`.

## Structure

```text
skills/
  paradoc/
    SKILL.md            # Manifest: rules, package map, dispatch
    metadata.json
    references/
      sdk.md cli.md schemas.md ai-tools.md mcp.md          # Surfaces
      artifacts.md fields.md parties.md annexes.md logic.md  # Topics
      layers.md templates.md pdf.md rendering.md formatting.md
      instructions.md filling.md sealing.md essentials.md
      workflow-author-form.md                               # Workflow
  paradoc-react/
    SKILL.md            # Manifest: the compose-to-seal lifecycle
    metadata.json
    references/
      components.md pagination.md safe-classes.md
      custom-components.md render-and-seal.md cli.md
```

## Contributing

See [AGENTS.md](AGENTS.md) for the conventions and the tests that tie the skills to the code.

## License

MIT
