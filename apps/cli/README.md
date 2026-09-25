<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=cli" target="_blank" rel="noopener noreferrer">
    <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
  </a>
</p>

<h1 align="center">@paradoc/cli</h1>

Paradoc treats documents as structured, machine-readable artifacts. The CLI initializes projects, manages artifacts and registries, validates data, and runs local document workflows.

## Installation

Requires Node.js 22 or newer.

```bash
npm install -g paradoc-cli
```

You can also run it without a global install:

```bash
npx paradoc-cli --help
```

`paradoc-cli` and `@paradoc/cli` publish the same CLI and both register the `paradoc` executable. Install one package, not both.

## Quick start

```bash
paradoc init my-project
cd my-project

paradoc search "lease agreement"
paradoc add @paradoc/example-form
paradoc list
paradoc show @paradoc/example-form
```

`paradoc init` prompts for project details. For a non-interactive setup, pass `--yes` and `--name`:

```bash
paradoc init my-project --yes --name "My Project"
```

## Global options

```text
-V, --version   output the version number
-h, --help      display help for command
```

Run `paradoc <command> --help` for command-specific arguments and options. The [CLI command reference](https://docs.paradoc.dev/cli/commands) documents the full command set.

## Project files

A Paradoc project contains `paradoc.json` and a `.paradoc` directory. Installed artifacts and their files are recorded in `.paradoc/lock.json`; commit the lock file with your project.

## Related packages

- [`@paradoc/sdk`](../../packages/sdk)
- [`@paradoc/core`](../../packages/core)
- [`@paradoc/schemas`](../../packages/schemas)
- [`@paradoc/render`](../../packages/render)
