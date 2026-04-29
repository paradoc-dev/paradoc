<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=cli" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/cli</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=cli)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=cli) is **documents as code**. The CLI provides a registry-first workflow for installing, managing, and creating Paradoc artifacts — forms, documents, checklists, and bundles.

## Package overview

- 📦 **Registry-first** — Install artifacts from public or private registries
- 🔍 **Search & discover** — Find artifacts by name, kind, or tags
- 🏗️ **Project management** — Initialize projects with proper configuration
- ✏️ **Authoring tools** — Create and validate your own artifacts
- 🔒 **Lock file support** — Reproducible installations across environments
- 🌐 **Private registries** — Authenticate with custom headers and tokens

## Installation

```bash
npm install -g @paradoc/cli
```

Or use with npx:

```bash
npx @paradoc/cli --help
```

## Quick start

```bash
# Initialize a new project
para init my-project
cd my-project

# Search for artifacts
para search "lease agreement"

# Install an artifact
para add @acme/residential-lease

# List installed artifacts
para list

# View artifact details
para view @acme/residential-lease
```

## Commands

### Registry commands

| Command | Description |
|---------|-------------|
| `para add <artifact>` | Install an artifact from a registry |
| `para list` | List installed artifacts |
| `para view <artifact>` | View details of an installed artifact |
| `para search [query]` | Search for artifacts in a registry |

### Registry management

| Command | Description |
|---------|-------------|
| `para registry add <namespace> <url>` | Add a registry |
| `para registry remove <namespace>` | Remove a registry |
| `para registry list` | List configured registries |
| `para registry info <namespace>` | Show registry details |

### Authoring commands

| Command | Description |
|---------|-------------|
| `para new form <name>` | Create a new form |
| `para new document <name>` | Create a new document |
| `para new checklist <name>` | Create a new checklist |
| `para new bundle <name>` | Create a new bundle |
| `para validate <artifact>` | Validate an artifact |
| `para fix <artifact>` | Fix artifact metadata |

### Project commands

| Command | Description |
|---------|-------------|
| `para init [directory]` | Initialize a new project |
| `para render <artifact>` | Render an artifact layer |
| `para show <artifact>` | Display artifact structure |
| `para diff <file1> <file2>` | Compare two artifacts |

## Installing artifacts

Install artifacts from any configured registry:

```bash
# Basic install
para add @acme/residential-lease

# Install with layers (templates, PDFs, etc.)
para add @acme/residential-lease --layers all

# Install specific layers
para add @acme/residential-lease --layers default,pdf-template

# Choose output format
para add @acme/residential-lease --format json

# Force reinstall
para add @acme/residential-lease --force
```

Artifacts are referenced using scoped names: `@namespace/artifact-name`

## Searching registries

```bash
# Search by keyword
para search "lease agreement"

# Search a specific registry
para search --registry @acme

# Filter by artifact kind
para search --kind form

# Filter by tags
para search --tags real-estate,california

# Output as JSON (for scripting)
para search --json
```

## Managing registries

Add registries to your global or project configuration:

```bash
# Add a public registry (prompts for location when in a project)
para registry add @acme https://registry.acme.com

# Add to global config explicitly
para registry add @acme https://registry.acme.com --global

# Add to project config explicitly
para registry add @acme https://registry.acme.com --project

# Add with authentication
para registry add @private https://registry.private.com \
  --header "Authorization: Bearer \${PRIVATE_TOKEN}"

# List all registries
para registry list

# Remove a registry
para registry remove @acme
```

## Configuration

### Project configuration

Created when you run `para init`. Located at `paradoc.json` in your project root.

```json
{
  "$schema": "https://schema.paradoc.dev/manifest.json",
  "name": "@myorg/my-project",
  "title": "My Paradoc Project",
  "visibility": "private",
  "registries": {
    "@acme": "https://registry.acme.com"
  },
  "artifacts": {
    "dir": "artifacts",
    "format": "yaml"
  }
}
```

### Global configuration

User-level settings at `~/.paradoc/config.json`. Applies to all projects.

```json
{
  "$schema": "https://schema.paradoc.dev/config.json",
  "registries": {
    "@acme": "https://registry.acme.com",
    "@private": {
      "url": "https://registry.private.com",
      "headers": {
        "Authorization": "Bearer ${PRIVATE_TOKEN}"
      }
    }
  },
  "defaults": {
    "format": "yaml",
    "artifactsDir": "artifacts"
  }
}
```

Environment variables in `${VAR_NAME}` format are automatically expanded.

### Configuration precedence

1. **Project config** — checked first
2. **Global config** — fallback
3. **Built-in defaults**

## Project structure

```
my-project/
├── paradoc.json           # Project manifest
├── .paradoc/
│   └── lock.json            # Lock file (commit this)
└── artifacts/
    └── @acme/
        ├── residential-lease.yaml
        └── commercial-lease.yaml
```

## Lock file

The `.paradoc/lock.json` file tracks installed artifacts with their versions and integrity hashes. This ensures reproducible installations. Commit this file to version control.

## Related packages

- [`@paradoc/sdk`](../../packages/sdk) — All-in-one SDK package
- [`@paradoc/core`](../../packages/core) — Core artifacts and builders
- [`@paradoc/schemas`](../../packages/schemas) — JSON Schema definitions
- [`@paradoc/renderers`](../../packages/renderers) — PDF, DOCX, Text renderers

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
