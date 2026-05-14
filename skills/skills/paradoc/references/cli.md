---
name: cli
description: para CLI surface — project init, registries, authoring, validation, rendering, data, all commands
metadata:
  tags: cli, para, paradoc, init, add, new, validate, render, registry, data, commands
---

# Paradoc CLI (`para`)

The `para` binary (also `paradoc`) manages Paradoc artifacts — projects, registries, authoring, validation, rendering, data.

ALWAYS use `npx paradoc validate` (NOT `para validate`) to validate artifacts when you can't guarantee a global install. Other commands assume `para` is installed locally or globally.

## Installation

```bash
npm install -g @paradoc/cli
# or run via npx
npx para <command>
```

If `para: command not found`: install globally, run via `npx para`, or ensure `node_modules/.bin` is on PATH.

## Project Lifecycle

### Initializing

```bash
# Interactive
para init

# Non-interactive
para init --yes --name "My Project" --visibility private

# In a specific directory
para init my-new-project
```

| Flag | Description |
|------|-------------|
| `-y, --yes` | Non-interactive (requires `--name`) |
| `--name <name>` | Project title |
| `--description <desc>` | Project description |
| `--visibility <public\|private>` | Default: `private` |
| `--nested` | Allow inside existing project |
| `--dry-run` | Preview without creating files |

### What `para init` creates

| Path | Purpose |
|------|---------|
| `paradoc.json` | Project manifest (name, title, description, registries, config) |
| `.paradoc/HEAD` | Current commit reference |
| `.paradoc/index.json` | Artifact index |
| `.paradoc/config.json` | Local project config |
| `.paradoc/commits/` | Commit history |
| `.paradoc/objects/` | Content-addressed storage |

### Output formats

| Format | Extension | Notes |
|--------|-----------|-------|
| `json` | `.json` | Standard JSON |
| `yaml` | `.yaml` | More readable |
| `typed` | `.json` + `.d.ts` | JSON with TypeScript declarations |
| `ts` | `.ts` | Standalone TypeScript module |

### Lock file

`.paradoc/lock.json` pins exact versions and checksums. ALWAYS commit it for reproducible installs.

### Configuration

Precedence (highest to lowest): CLI flags → `paradoc.json` → `~/.paradoc/config.json` → built-in defaults.

```bash
para configure          # Interactive — output, artifacts dir, cache, registry, telemetry
```

Global config at `~/.paradoc/config.json`:

```json
{
  "defaults": {
    "output": "json",
    "artifactsDir": "artifacts",
    "registry": "@paradoc"
  },
  "registries": {
    "@acme": { "url": "https://registry.acme.com" }
  },
  "cache": { "ttl": 3600, "directory": "~/.paradoc/cache" }
}
```

Registry URLs support env-var expansion:

```json
{
  "@private": {
    "url": "https://registry.example.com",
    "headers": { "Authorization": "Bearer ${REGISTRY_TOKEN}" }
  }
}
```

Proxy: `HTTPS_PROXY` / `HTTP_PROXY`.

### Cache management

```bash
para cache stats              # Statistics
para cache clear              # Clear cached data
para cache invalidate @acme   # Invalidate specific registry
para cache config             # Show cache config
para cache reset              # Reset cache to defaults
para cache reset --clear      # Reset config AND clear data
```

### Reset

```bash
para reset                    # Reset CLI to factory defaults
para reset --yes              # Skip confirmation
para reset --keep-registries  # Preserve registry configs
para reset --keep-cache       # Preserve cached data
```

### Telemetry

```bash
para --no-telemetry <command>
```

Or permanently: config `telemetry.enabled: false`, env `OFM_TELEMETRY_DISABLED=1` / `DO_NOT_TRACK=1`.

### Utility commands

```bash
para about              # CLI version, environment, platform info
para docs               # Open documentation
para console            # Open Paradoc web console
```

## Registries

Registries are HTTPS-served directories containing artifacts. URLs MUST use HTTPS in production.

This section covers **consuming** artifacts from registries. Publishing your own registry (`para registry make`, `para registry catalog`, `para registry compile`) is out of scope for this skill — see [docs.paradoc.dev](https://docs.paradoc.dev) for the publisher workflow.

### Adding artifacts

```bash
para add @acme/residential-lease
para add @acme/residential-lease --layers all
para add @acme/residential-lease --layers pdf,markdown
para add @acme/residential-lease --output yaml
para add @acme/residential-lease --no-cache
para add @acme/residential-lease --cache-ttl 0
para add https://example.com/form.json --header "Authorization: Bearer TOKEN"
```

### Searching

```bash
para search "lease agreement"
para search --kind form --tags legal,real-estate
para search --registry @acme "tax"
para search "lease" --json
```

Defaults to the `@paradoc` registry if `--registry` is not provided.

### Listing installed

```bash
para list
para list --json
para list --kind form
```

### Managing registries

```bash
# Add (namespace + URL)
para registry add @acme https://registry.acme.com
para registry add @acme https://registry.acme.com --global    # ~/.paradoc/config.json
para registry add @acme https://registry.acme.com --project   # paradoc.json
para registry add https://registry.acme.com                   # auto-discover namespace
para registry add @acme https://registry.acme.com --header "Authorization: Bearer TOKEN"

# Remove
para registry remove @acme
para registry remove --global

# Inspect
para registry list                          # All configured registries
para registry list --json
para registry info @acme                    # Registry-level info
para registry info @acme --json
para registry view @acme/residential-lease  # Specific artifact metadata
para registry view @acme/residential-lease --json
para registry stats @acme                   # Read-only stats
para registry stats @acme --json
```

## Authoring

ALWAYS validate after creation. ALWAYS use the most specific field type with `--field` shorthand. NEVER use generic names — artifact names MUST be descriptive kebab-case.

### Creating artifacts

```bash
# Interactive
para new form my-form
para new document my-doc
para new checklist my-checklist
para new bundle my-bundle

# Non-interactive
para new form lease-agreement \
  --yes \
  --title "Lease Agreement" \
  --field "address:address" \
  --field "rent:money" \
  --field "startDate:date" \
  --format yaml
```

### Key flags

| Flag | Description |
|------|-------------|
| `-y, --yes` | Non-interactive |
| `--slug <slug>` | Override auto-generated slug |
| `--title <title>` | Title |
| `--description <desc>` | Description |
| `--code <code>` | Code/reference number |
| `--artifact-version <v>` | Version (default `1.0.0`) |
| `--dir <path>` | Custom output directory |
| `--field <name:type>` | Add a field (repeatable) |
| `--format <json\|yaml>` | Output format |
| `--dry-run` | Preview |

### Field shorthand (`new form` only)

`--field <name:type>` is supported on `new form` only. Other artifact types take different content flags:

| Subcommand | Content flag | Notes |
|---|---|---|
| `new form` | `--field <name:type>` (repeatable) | Adds a typed field |
| `new checklist` | `--item <text>` (repeatable) | Adds a checklist item |
| `new document` | — | No inline content flag — edit the file after scaffolding |
| `new bundle` | — | No inline content flag — edit the file after scaffolding |

```bash
para new form lease --field "address:address" --field "rent:money"
para new checklist closing --item "Title search" --item "Appraisal" --item "Insurance bound"
```

Available `--field` types: `text`, `boolean`, `number`, `money`, `address`, `phone`, `date`, `datetime`, `time`, `email`, `uuid`, `uri`, `enum`, `person`, `organization`, `identification`, `percentage`, `rating`, `duration`, `coordinate`, `bbox`, `multiselect`, `fieldset`.

### Versioning

```bash
para version <file> <bump-type>

para version my-form.json patch        # 1.0.0 -> 1.0.1
para version my-form.json minor        # 1.0.0 -> 1.1.0
para version my-form.json major        # 1.0.0 -> 2.0.0
para version my-form.json prepatch     # 1.0.0 -> 1.0.1-0
para version my-form.json preminor     # 1.0.0 -> 1.1.0-0
para version my-form.json premajor     # 1.0.0 -> 2.0.0-0
para version my-form.json prerelease   # 1.0.1-0 -> 1.0.1-1
para version my-form.json 2.5.0        # exact version
```

### Attaching / detaching layers

```bash
para attach <artifact> <file>
para attach form.json template.pdf -n pdf -t "PDF Template" -m application/pdf
para attach form.json template.pdf --dry-run

para detach <artifact> [layer]
para detach form.json pdf
para detach form.json --dry-run
```

| Attach flag | Description |
|------------|-------------|
| `-y, --yes` | Skip prompts |
| `--as <target>` | `layer` (default), `instructions`, `agent-instructions` |
| `-n, --name <name>` | Layer name (key in layers object) |
| `-t, --title <title>` | Title |
| `-d, --description <desc>` | Description |
| `-m, --mime-type <type>` | Override auto-detected MIME |

```bash
para attach form.json instructions.md --as instructions
para attach form.json agent-guide.md --as agent-instructions
```

### Generating TypeScript types

```bash
para generate <file>
para generate form.json --output ts
```

| Flag | Description |
|------|-------------|
| `--output <format>` | `typed` (.d.ts) or `ts` (TypeScript module). Default: `typed` |

## Validation

ALWAYS validate after creation, modification, and before rendering. NEVER render unvalidated artifacts.

```bash
para validate my-form.json
para validate my-form.yaml
para validate my-form.json --json          # JSON output
para validate my-form.json --silent         # Exit code only
para validate my-form.json --expect-kind form
para validate my-form.json --schema-only
para validate my-form.json --layers-only
para validate my-form.json --checksum-only
cat my-form.yaml | para validate -          # From stdin
```

| Exit code | Meaning |
|-----------|---------|
| `0` | Valid |
| `1` | Invalid |

### Auto-fixing

```bash
para fix <artifact>
para fix my-form.json --yes        # Accept all without prompting
para fix my-form.json --dry-run    # Preview
```

### Comparing

```bash
para diff form-v1.json form-v2.json
para diff form-v1.json form-v2.json --name-only
```

### Applying patches

```bash
para apply <patch-file>
para apply patch.diff --dry-run    # Preview without writing
para apply patch.diff --check      # Validate the patch without applying
para apply patch.diff --reverse    # Invert the patch (undo)
```

Inverse of `para diff` — applies a unified diff to the working directory.

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview changes without modifying files |
| `--check` | Validate the patch can apply, without writing |
| `--reverse` | Apply the patch in reverse (undo) |

### Showing structure

```bash
para show my-form.json              # Human-readable
para show my-form.json --raw        # Raw file content
para show my-form.json --deps       # Show dependencies
```

For schema rules and common validation errors, see [schemas.md](./schemas.md).

## Rendering

ALWAYS validate before rendering. ALWAYS provide `--data` for forms — without data, the CLI warns and renders the raw layer (placeholders unfilled).

```bash
para render my-form.json --data payload.json
para render my-form.json --data payload.json --out output.pdf
para render my-form.json --data payload.json --layer markdown
para render my-form.json --data payload.json --renderer pdf
para render my-form.json --data payload.json --bindings bindings.json
para render my-form.json --data payload.json --format json       # JSON summary
para render my-form.json --data payload.json --dry-run
```

`--format <style>` accepts `pretty` (default) or `json`.

Renderer auto-detected from layer MIME type. `--renderer` overrides. `--bindings` (CLI) merges on top of layer-spec bindings (CLI wins).

### Data payload

```bash
para render form.json --data payload.json
para render form.json --data payload.yaml
para render form.json --data '{"fields":{"name":"Alice"}}'
```

### Renderer management

Renderers (`text`, `pdf`, `docx`) auto-install on first use to `~/.paradoc/renderers/`.

```bash
para renderers status     # Check installation
para renderers install    # Install (or reinstall) all renderers
para renderers update     # Reinstall to match the current CLI version
para renderers remove     # Remove installed renderers
```

For full renderer API and options, see [rendering.md](./rendering.md).

### Inspecting PDFs

```bash
para inspect template.pdf                              # Default: table format
para inspect template.pdf --format json                # JSON output
para inspect template.pdf --filter "Landlord*"
para inspect template.pdf --summary
para inspect template.pdf --include-buttons --include-signatures
para inspect template.pdf --out fields.json
```

`--format <format>` accepts `table` (default) or `json`.

Use to discover PDF AcroForm field names before configuring bindings — see [pdf-bindings.md](./pdf-bindings.md).

### Hashing

```bash
para hash <file>
para hash template.pdf --json
```

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `-a, --algorithm <alg>` | Hash algorithm. Currently only `sha256` is supported (default). |

Computes a SHA-256 checksum for use in layer `checksum` properties.

## Data Operations

ALWAYS validate data against the form before rendering. NEVER render with unvalidated data.

### Generating a template

```bash
para data template my-form.json                       # Stdout (YAML default)
para data template my-form.json --out template.json   # File (format from extension)
para data template my-form.json --out template.yaml
para data template my-form.json --json
para data template my-form.json --yaml
para data template my-form.json --out template.yaml --silent
```

Produces a payload skeleton with `null` per field.

### Interactive filling

```bash
para data fill my-form.json --out payload.json
para data fill my-form.json --out payload.yaml --yaml
para data fill my-form.json --out payload.json --data existing-data.json
```

### Validating data

```bash
para data validate my-form.json payload.json
para data validate my-form.json payload.json --json
para data validate my-form.json payload.json --silent
```

### Typical data workflow

1. `para data template form.json --out payload.json` — empty template
2. Edit `payload.json` with values
3. `para data validate form.json payload.json` — validate
4. `para render form.json --data payload.json --out output.pdf` — render

## Common CLI Issues

**`para: command not found`**
Install `@paradoc/cli` globally or use `npx para`.

**Validation errors on `para validate`**
Check `--verbose` output. Use `para fix` to auto-correct. Verify all field IDs in rules/logic/bindings exist in `fields`.

**Registry connection failures (`para add`, `para search`)**
Check `para registry list` to verify the registry is configured. Inspect with `para registry info <namespace>`. Refresh auth tokens via `para configure`.

**Render failures (`para render`)**
Run `para renderers` to confirm renderer is available. Validate the artifact first. For PDF: ensure `renderer-pdf` is installed and rebuilt (build chain: core → renderer-pdf → renderers → sdk → cli).

## See Also

- [schemas.md](./schemas.md) — schema rules, common validation errors
- [rendering.md](./rendering.md) — full renderer API
- [pdf-bindings.md](./pdf-bindings.md) — PDF AcroForm bindings
- [sdk.md](./sdk.md) — TypeScript SDK surface
- [mcp.md](./mcp.md) — remote MCP service surface
