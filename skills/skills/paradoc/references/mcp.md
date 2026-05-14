---
name: mcp
description: Paradoc MCP service surface — mcp.paradoc.dev — 8 remote tools for discovering, retrieving, validating, filling, rendering artifacts
metadata:
  tags: mcp, model-context-protocol, mcp.paradoc.dev, registries, tools, remote
---

# Paradoc MCP Surface

The Paradoc MCP service exposes 8 tools at `mcp.paradoc.dev` (prod) and `mcp-dev.paradoc.dev` (dev) for AI assistants (Claude, Cursor, etc.) to discover registries and artifacts, retrieve full artifact definitions, validate, fill, and render — without needing local packages installed.

The service is implemented as a Cloudflare Worker (`platform/apps/mcp-service`) using Durable Objects with SQLite-backed MCP sessions.

Use this surface when:

- The user is connected to `mcp.paradoc.dev` via an MCP-capable client
- You want to discover or render artifacts from a registry without local installs
- You need to fetch a published artifact's full JSON to inspect or work with

For local TypeScript usage, see [sdk.md](./sdk.md). For CLI usage, see [cli.md](./cli.md).

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info |
| `/health` | GET | Health check |
| `/mcp` | ALL | MCP protocol endpoint |

## Custom Domains

| Environment | Domain |
|-------------|--------|
| Dev | `mcp-dev.paradoc.dev` |
| Prod | `mcp.paradoc.dev` |

## Tools

| Tool | Description |
|------|-------------|
| `list_registries` | List registries sorted by popularity, with pagination |
| `get_registry` | Get a registry and its artifacts (capped at 500) |
| `list_artifacts` | List artifacts sorted by popularity, with pagination |
| `search` | Search artifacts by keyword |
| `get_artifact` | Retrieve the full artifact definition from a registry |
| `validate` | Validate a custom artifact against schema and logic rules |
| `fill` | Fill an artifact with data, apply defaults, validate |
| `render` | Render an artifact from a registry as text, PDF, or DOCX |

## Use Cases and Arguments

| UC | Description | Tool | Arguments |
|----|-------------|------|-----------|
| UC-01 | List registries by popularity | `list_registries` | `status` (enum, opt), `limit` (int, opt), `offset` (int, opt) |
| UC-02 | Get a registry and its artifacts | `get_registry` | `registry_id` (string) |
| UC-03 | List artifacts by popularity | `list_artifacts` | `kind` (enum, opt), `limit` (int, opt), `offset` (int, opt) |
| UC-04 | Search artifacts | `search` | `query` (string), `kind` (enum, opt), `limit` (int, opt) |
| UC-05 | Retrieve full artifact | `get_artifact` | `registry_id` (string), `artifact_name` (string) |
| UC-06 | Validate a custom artifact | `validate` | `artifact` (object), `options` (object, opt) |
| UC-07 | Fill artifact with data | `fill` | `artifact` (object), `data` (object) |
| UC-08 | Render from registry | `render` | `registry_id` (string), `artifact_name` (string), `data` (object), `layer` (string, opt), `output_mode` (enum, opt) |

## Tool Flow: Discovery → Render

Every discovery tool returns `registry_id` and `artifact_name` so there are no dead ends.

```
ENTRY POINTS
  list_registries   list_artifacts        search
  (UC-01)           (UC-03)               (UC-04)
       │                 │ registry_id        │ registry_id
       │ registry_id     │ artifact_name      │ artifact_name
       ▼                 │                    │
  get_registry           │                    │
  (UC-02)                │                    │
       │ registry_id     │                    │
       │ artifact_name   │                    │
       ▼                 ▼                    ▼
  ┌──────────────────────────────────────────────────┐
  │              get_artifact (UC-05)                │
  │      needs: registry_id + artifact_name          │
  │      returns: full artifact JSON + metadata      │
  └────────────────────────┬─────────────────────────┘
                           │ artifact (full JSON)
                ┌──────────┴───────────┐
                ▼                      ▼
            fill (UC-07)         validate (UC-06)
            artifact + data      artifact + options
                │
                │ validated data
                ▼
  ┌──────────────────────────────┐
  │          render (UC-08)      │
  │  registry_id + artifact_name │
  │  + data → rendered output    │
  └──────────────────────────────┘
```

### Typical happy path

1. **Discover** (UC-01 / UC-03 / UC-04) — find what you're looking for
2. **Inspect** (UC-05) — get the full artifact to understand fields and layers
3. **Fill** (UC-07) — test data against the artifact
4. **Render** (UC-08) — produce the final output

## Rate Limiting

POST requests to `/mcp` are rate-limited per IP via Cloudflare's Rate Limiting binding.

| Environment | Limit | Window | ~Hourly |
|-------------|-------|--------|---------|
| Dev | 2 requests | 60s | ~120/hr |
| Prod | 2 requests | 60s | ~120/hr |

GET requests (health, service info, SSE) and non-`/mcp` routes are not rate-limited.

## Text Rendering Proxy

Cloudflare Workers block `new Function()`, which Handlebars requires. To render `text/*` layers (HTML, Markdown, plain text), the MCP service delegates to a documents-service (Fly.io, Node.js) via `POST /render`. PDF and DOCX run locally on the Worker.

This is transparent to the MCP client — `render` works for all supported MIME types.

## When to Use the MCP Surface

- Asked to find or use a published Paradoc artifact via an MCP-connected client
- Need to render a registry artifact without installing renderers locally
- Want to validate or fill a custom artifact server-side without local SDK setup

When in a local Node.js project with `@paradoc/sdk` already installed, prefer the [sdk.md](./sdk.md) surface — it's faster and avoids network latency.

## See Also

- [sdk.md](./sdk.md) — local TypeScript surface
- [cli.md](./cli.md) — local CLI surface
- [schemas.md](./schemas.md) — raw JSON/YAML manipulation
- [artifacts.md](./artifacts.md) — artifact shapes returned by `get_artifact`
