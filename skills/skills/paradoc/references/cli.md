---
name: cli
description: paradoc CLI surface — project init, registries, authoring, validation, rendering, data, all commands
metadata:
  tags: cli, paradoc, init, add, new, validate, render, registry, data, commands
---

# Paradoc CLI (`paradoc`)

The `paradoc` binary manages Paradoc artifacts — projects, registries, authoring, validation, rendering, data.

ALWAYS use `npx paradoc validate` to validate artifacts when you can't guarantee a global install.

## Installation

```bash
npm install -g @paradoc/cli
# or run via npx
npx paradoc <command>
```

If `paradoc: command not found`: install globally, run via `npx paradoc`, or ensure `node_modules/.bin` is on PATH.

## Project Lifecycle

### Initializing

```bash
# Interactive
paradoc init

# Non-interactive
paradoc init --yes --name "My Project" --visibility private

# In a specific directory
paradoc init my-new-project
```

| Flag | Description |
|------|-------------|
| `-y, --yes` | Non-interactive (requires `--name`) |
| `--name <name>` | Project title |
| `--description <desc>` | Project description |
| `--visibility <public\|private>` | Default: `private` |
| `--nested` | Allow inside existing project |
| `--dry-run` | Preview without creating files |

### What `paradoc init` creates

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
paradoc configure          # Interactive — output, artifacts dir, cache, registry, telemetry
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
paradoc cache stats              # Statistics
paradoc cache clear              # Clear cached data
paradoc cache invalidate @acme   # Invalidate specific registry
paradoc cache config             # Show cache config
paradoc cache reset              # Reset cache to defaults
paradoc cache reset --clear      # Reset config AND clear data
```

### Reset

```bash
paradoc reset                    # Reset CLI to factory defaults
paradoc reset --yes              # Skip confirmation
paradoc reset --keep-registries  # Preserve registry configs
paradoc reset --keep-cache       # Preserve cached data
```

### Telemetry

```bash
paradoc --no-telemetry <command>
```

Or permanently: config `telemetry.enabled: false`, env `OFM_TELEMETRY_DISABLED=1` / `DO_NOT_TRACK=1`.

### Utility commands

```bash
paradoc about              # CLI version, environment, platform info
paradoc docs               # Open documentation
paradoc console            # Open Paradoc web console
```

## Registries

Registries are HTTPS-served directories containing artifacts. URLs MUST use HTTPS in production.

This section covers **consuming** artifacts from registries. Publishing your own registry (`paradoc registry make`, `paradoc registry catalog`, `paradoc registry compile`) is out of scope for this skill — see [docs.paradoc.dev](https://docs.paradoc.dev) for the publisher workflow.

### Adding artifacts

```bash
paradoc add @acme/residential-lease
paradoc add @acme/residential-lease --layers all
paradoc add @acme/residential-lease --layers pdf,markdown
paradoc add @acme/residential-lease --output yaml
paradoc add @acme/residential-lease --no-cache
paradoc add @acme/residential-lease --cache-ttl 0
paradoc add https://example.com/form.json --header "Authorization: Bearer TOKEN"
```

### Searching

```bash
paradoc search "lease agreement"
paradoc search --kind form --tags legal,real-estate
paradoc search --registry @acme "tax"
paradoc search "lease" --json
```

Defaults to the `@paradoc` registry if `--registry` is not provided.

### Listing installed

```bash
paradoc list
paradoc list --json
paradoc list --kind form
```

### Managing registries

```bash
# Add (namespace + URL)
paradoc registry add @acme https://registry.acme.com
paradoc registry add @acme https://registry.acme.com --global    # ~/.paradoc/config.json
paradoc registry add @acme https://registry.acme.com --project   # paradoc.json
paradoc registry add https://registry.acme.com                   # auto-discover namespace
paradoc registry add @acme https://registry.acme.com --header "Authorization: Bearer TOKEN"

# Remove
paradoc registry remove @acme
paradoc registry remove --global

# Inspect
paradoc registry list                          # All configured registries
paradoc registry list --json
paradoc registry info @acme                    # Registry-level info
paradoc registry info @acme --json
paradoc registry view @acme/residential-lease  # Specific artifact metadata
paradoc registry view @acme/residential-lease --json
paradoc registry stats @acme                   # Read-only stats
paradoc registry stats @acme --json
```

## Authoring

ALWAYS validate after creation. ALWAYS use the most specific field type with `--field` shorthand. NEVER use generic names — artifact names MUST be descriptive kebab-case.

### Creating artifacts

```bash
# Interactive
paradoc new form my-form
paradoc new document my-doc
paradoc new checklist my-checklist
paradoc new bundle my-bundle

# Non-interactive
paradoc new form lease-agreement \
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
paradoc new form lease --field "address:address" --field "rent:money"
paradoc new checklist closing --item "Title search" --item "Appraisal" --item "Insurance bound"
```

Available `--field` types: `text`, `boolean`, `number`, `money`, `address`, `phone`, `date`, `datetime`, `time`, `email`, `uuid`, `uri`, `enum`, `person`, `organization`, `identification`, `percentage`, `rating`, `duration`, `coordinate`, `bbox`, `multiselect`, `fieldset`.

### Versioning

```bash
paradoc version <file> <bump-type>

paradoc version my-form.json patch        # 1.0.0 -> 1.0.1
paradoc version my-form.json minor        # 1.0.0 -> 1.1.0
paradoc version my-form.json major        # 1.0.0 -> 2.0.0
paradoc version my-form.json prepatch     # 1.0.0 -> 1.0.1-0
paradoc version my-form.json preminor     # 1.0.0 -> 1.1.0-0
paradoc version my-form.json premajor     # 1.0.0 -> 2.0.0-0
paradoc version my-form.json prerelease   # 1.0.1-0 -> 1.0.1-1
paradoc version my-form.json 2.5.0        # exact version
```

### Attaching / detaching layers

```bash
paradoc attach <artifact> <file>
paradoc attach form.json template.pdf -n pdf -t "PDF Template" -m application/pdf
paradoc attach form.json template.pdf --dry-run

paradoc detach <artifact> [layer]
paradoc detach form.json pdf
paradoc detach form.json --dry-run
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
paradoc attach form.json instructions.md --as instructions
paradoc attach form.json agent-guide.md --as agent-instructions
```

### Generating TypeScript types

```bash
paradoc generate <file>
paradoc generate form.json --output ts
```

| Flag | Description |
|------|-------------|
| `--output <format>` | `typed` (.d.ts) or `ts` (TypeScript module). Default: `typed` |

## Validation

ALWAYS validate after creation, modification, and before rendering. NEVER render unvalidated artifacts.

```bash
paradoc validate my-form.json
paradoc validate my-form.yaml
paradoc validate my-form.json --json          # JSON output
paradoc validate my-form.json --silent         # Exit code only
paradoc validate my-form.json --expect-kind form
paradoc validate my-form.json --schema-only
paradoc validate my-form.json --layers-only
paradoc validate my-form.json --checksum-only
cat my-form.yaml | paradoc validate -          # From stdin
```

| Exit code | Meaning |
|-----------|---------|
| `0` | Valid |
| `1` | Invalid |

### Auto-fixing

```bash
paradoc fix <artifact>
paradoc fix my-form.json --yes        # Accept all without prompting
paradoc fix my-form.json --dry-run    # Preview
```

### Comparing

```bash
paradoc diff form-v1.json form-v2.json
paradoc diff form-v1.json form-v2.json --name-only
```

### Applying patches

```bash
paradoc apply <patch-file>
paradoc apply patch.diff --dry-run    # Preview without writing
paradoc apply patch.diff --check      # Validate the patch without applying
paradoc apply patch.diff --reverse    # Invert the patch (undo)
```

Inverse of `paradoc diff` — applies a unified diff to the working directory.

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview changes without modifying files |
| `--check` | Validate the patch can apply, without writing |
| `--reverse` | Apply the patch in reverse (undo) |

### Showing structure

```bash
paradoc show my-form.json              # Human-readable
paradoc show my-form.json --raw        # Raw file content
paradoc show my-form.json --deps       # Show dependencies
```

For schema rules and common validation errors, see [schemas.md](./schemas.md).

## Rendering

ALWAYS validate before rendering. ALWAYS provide `--data` for forms — without data, the CLI warns and renders the raw layer (placeholders unfilled).

```bash
paradoc render my-form.json --data payload.json
paradoc render my-form.json --data payload.json --out output.pdf
paradoc render my-form.json --data payload.json --layer markdown
paradoc render my-form.json --data payload.json --bindings bindings.json
paradoc render my-form.json --data payload.json --format json       # JSON summary
paradoc render my-form.json --data payload.json --dry-run
```

`--format <style>` accepts `pretty` (default) or `json`.

The renderer is selected from the layer MIME type. `--bindings` (CLI) merges on
top of layer-spec bindings (CLI wins).

### Data payload

```bash
paradoc render form.json --data payload.json
paradoc render form.json --data payload.yaml
paradoc render form.json --data '{"fields":{"name":"Alice"}}'
```

### Renderer management

The unified `@paradoc/render` package auto-installs on first use under
`~/.paradoc/renderers/`.

```bash
paradoc renderers status     # Check installation
paradoc renderers install    # Install (or reinstall) the renderer package
paradoc renderers update     # Reinstall to match the current CLI version
paradoc renderers remove     # Remove installed renderers
```

For full renderer API and options, see [rendering.md](./rendering.md).

### Inspecting PDFs

```bash
paradoc inspect template.pdf                              # Default: table format
paradoc inspect template.pdf --format json                # JSON output
paradoc inspect template.pdf --filter "Landlord*"
paradoc inspect template.pdf --summary
paradoc inspect template.pdf --include-buttons --include-signatures
paradoc inspect template.pdf --out fields.json
```

`--format <format>` accepts `table` (default) or `json`.

Use to discover PDF AcroForm field names before configuring bindings — see [pdf-bindings.md](./pdf-bindings.md).

### Hashing

```bash
paradoc hash <file>
paradoc hash template.pdf --json
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
paradoc data template my-form.json                       # Stdout (YAML default)
paradoc data template my-form.json --out template.json   # File (format from extension)
paradoc data template my-form.json --out template.yaml
paradoc data template my-form.json --json
paradoc data template my-form.json --yaml
paradoc data template my-form.json --out template.yaml --silent
```

Produces a payload skeleton with `null` per field.

### Interactive filling

```bash
paradoc data fill my-form.json --out payload.json
paradoc data fill my-form.json --out payload.yaml --yaml
paradoc data fill my-form.json --out payload.json --data existing-data.json
```

### Validating data

```bash
paradoc data validate my-form.json payload.json
paradoc data validate my-form.json payload.json --json
paradoc data validate my-form.json payload.json --silent
```

### Typical data workflow

1. `paradoc data template form.json --out payload.json` — empty template
2. Edit `payload.json` with values
3. `paradoc data validate form.json payload.json` — validate
4. `paradoc render form.json --data payload.json --out output.pdf` — render

## Common CLI Issues

**`paradoc: command not found`**
Install `@paradoc/cli` globally or use `npx paradoc`.

**Validation errors on `paradoc validate`**
Check `--verbose` output. Use `paradoc fix` to auto-correct. Verify all field IDs in rules/logic/bindings exist in `fields`.

**Registry connection failures (`paradoc add`, `paradoc search`)**
Check `paradoc registry list` to verify the registry is configured. Inspect with `paradoc registry info <namespace>`. Refresh auth tokens via `paradoc configure`.

**Render failures (`paradoc render`)**
Run `paradoc renderers status` to confirm `@paradoc/render` is available, then
validate the artifact. In a workspace checkout, rebuild `render` before the SDK
and CLI so their build-first outputs stay current.

## See Also

- [schemas.md](./schemas.md) — schema rules, common validation errors
- [rendering.md](./rendering.md) — full renderer API
- [pdf-bindings.md](./pdf-bindings.md) — PDF AcroForm bindings
- [sdk.md](./sdk.md) — TypeScript SDK surface
- [mcp.md](./mcp.md) — remote MCP service surface
