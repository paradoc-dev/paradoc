---
name: mcp
description: The hosted Paradoc MCP server at https://mcp.paradoc.dev/mcp. Connect with OAuth or an x-api-key, the data payload shape, every tool with its arguments and limits, which tools are billed, and rate limits.
metadata:
  tags: mcp, model-context-protocol, mcp.paradoc.dev, hosted, registry, fill, render, seal, extract, e-signature, payments, oauth, api-key
---

# Hosted MCP server

**Contents:** [Connect](#connect) · [Payload shape](#payload-shape) · [Workflow](#workflow) · [Artifact tools](#artifact-tools) · [Registry tools](#registry-tools) · [Render](#render) · [Platform tools](#platform-tools) · [Limits](#limits)

Use this surface when an MCP client (Claude Code, Claude Desktop, Cursor) is connected to Paradoc's hosted server. Nothing is installed. Every session acts for one Paradoc organization.

When the user builds an agent in code, load [ai-tools.md](./ai-tools.md) instead. Its tools have other names; [ai-tools.md § Differences from MCP](./ai-tools.md#differences-from-mcp) maps them.

## Connect

| Endpoint | URL |
|----------|-----|
| MCP (streamable HTTP) | `https://mcp.paradoc.dev/mcp` |
| OAuth protected-resource metadata | `https://mcp.paradoc.dev/.well-known/oauth-protected-resource` |
| Health | `https://mcp.paradoc.dev/health` |

**OAuth (interactive clients).** Add the server by URL. The client runs sign-in on first connect. In Claude Code:

```bash
claude mcp add --transport http paradoc https://mcp.paradoc.dev/mcp
```

Then run `/mcp` and choose **Authenticate**. The token must be scoped to an organization.

**API key (headless clients).** Send the key in the `x-api-key` header, for example in `.mcp.json`:

```jsonc
// .mcp.json
{
  "mcpServers": {
    "paradoc": {
      "type": "http",
      "url": "https://mcp.paradoc.dev/mcp",
      "headers": { "x-api-key": "${PARADOC_API_KEY}" }
    }
  }
}
```

The server checks the key with the platform before it opens a session.

| Response | Meaning |
|----------|---------|
| `401` with `WWW-Authenticate: Bearer resource_metadata="…"` | No credential, a bad API key, or a token with no organization. OAuth clients start sign-in from this. |
| `503` | The server could not check the key. Retry later. |
| `429` | Rate limit. See [Limits](#limits). |

## Payload shape

`fill`, `render`, `seal`, `create_envelope` and `create_payment` take the same `data` object: `{ fields, parties, annexes }`. Value shapes: [fields.md § Field Type Reference](./fields.md#field-type-reference) and [parties.md § Party fill values](./parties.md#party-fill-values).

```jsonc
// data for fill, render, seal, create_envelope
{
  "fields": {
    "petName": "Rex",
    "weight": 30
  },
  "parties": {
    "tenant": { "name": "Jane Smith" }
  }
}
```

For a checklist, `data` maps item ids to `true`, `false` or a string.

## Workflow

1. Find the artifact: `search`, `list_artifacts`, or `list_registries` → `get_registry`. Each result carries `registry_id` and `artifact_name`.
2. `get_artifact` with those two values. Read `fields`, `parties` and `layers`, and follow `agentInstructions` when present.
3. `fill` with the artifact and your `data`. Repeat until `accepted` and `complete` are both `true`.
4. `render` with `registry_id`, `artifact_name` and the same `data` you gave `fill`.

For signing, call `seal` (the canonical PDF and signature map) or `create_envelope` (seal and send). For reading a filled document, call `describe` then `extract`.

## Artifact tools

These two run on an artifact object you pass in. They make no outbound call.

| Tool | Arguments | Returns |
|------|-----------|---------|
| `validate` | `artifact` (object), `options?: { schema?: boolean, logic?: boolean }` (both default `true`) | `{ valid, detectedKind?, issues?: [{ message, path? }] }` |
| `fill` | `artifact` (form or checklist object), `data` | `{ accepted, complete, artifactKind, data?, errors?: [{ field, message }] }` |

`accepted` is `true` when every supplied value is valid. `complete` is `true` when every required value is present. The `data` that `fill` returns is the flat field map, not a payload: keep your own `data` object and pass it to `render`.

`fill` takes only the current `$schema`; migrate an older artifact first ([schemas.md § Loading rules](./schemas.md#loading-rules)).

## Registry tools

| Tool | Arguments | Returns |
|------|-----------|---------|
| `search` | `query` (min 2 characters), `kind?` (`form`, `document`, `checklist`, `bundle`), `limit?` (1-50, default 20) | Matching artifacts and registries |
| `list_artifacts` | `kind?`, `limit?` (1-50, default 20), `offset?` | Artifacts ranked by all-time installs |
| `list_registries` | `status?` (`verified` default, `pending`, `bad`, `all`), `limit?` (1-50, default 20), `offset?` | Registries with artifact counts and installs |
| `get_registry` | `registry_id` | The registry and its artifacts |
| `get_artifact` | `registry_id`, `artifact_name` | `{ artifact, metadata }`. File `instructions` and `agentInstructions` come back inline. Verified registries only. |

## Render

| Argument | Value |
|----------|-------|
| `registry_id`, `artifact_name` | From a registry tool. The registry must be verified. |
| `data` | The payload you gave `fill`. |
| `layer?` | Layer key. Defaults to `defaultLayer`, then the first layer. |
| `outputMode?` | `"url"` (default): a short download link that expires in 7 days. `"inline"`: the content in the response, base64 for binary output. Use `"inline"` for text or markdown shown in chat. |

Returns `{ success, renderId, artifactKind, mimeType, downloadUrl?, expiresAt?, content?, encoding?, errors?, validationIssues? }`.

`render` renders forms from a verified registry, with text, markdown, HTML, PDF and DOCX layers. For an unpublished artifact, render locally with the SDK or CLI ([rendering.md](./rendering.md)). React (`text/tsx`) layers render with the `paradoc-react` skill.

## Platform tools

These act on the session's organization through the Paradoc platform API. The artifact argument is a source object, not a `registry_id`:

```jsonc
{ "source": "registry", "id": "@acme/forms/nda" }          // optional "@1.2.0" suffix, or "version"
{ "source": "inline", "artifact": { "kind": "form", "…": "…" } }
```

A billed tool fails with an insufficient-balance error when the organization's balance is empty.

### Execution

| Tool | Arguments | Cost | Does |
|------|-----------|------|------|
| `describe` | `artifact` | Free | Fields, parties and annexes with types, plus a sample payload. Call it first. |
| `extract` | `artifact`, `document: { content_base64, mime_type }`, `options?: { confidence_threshold?, validate_extracted? }` | Per page | Reads a filled PDF or image (PNG, JPEG, WebP; 10 MB max, no data-URI prefix). Returns values with confidence and page provenance. Works on scanned and flattened documents. |
| `prefill` | `artifact`, `document`, `options?: { confidence_threshold?, include_optional?, required_first? }` | Extract + fill | Extracts and commits readings above the threshold into a fill. Lower readings come back as suggestions. |
| `seal` | `artifact`, `data`, `layer?`, `signers?`, `signatories?` | Per call | Fills the form and returns the canonical PDF, the signature map and `canonical_pdf_hash`. Creates no envelope. See [sealing.md](./sealing.md). |
| `extract_job_submit` | `artifact`, `document` (25 MB, 100 pages max), `options?` | Per page, on success | Starts async extraction and returns a job id. |
| `extract_job_get` | `job_id` | Free | Job status, and the `extract` result when complete. |
| `extract_job_list` | `limit?` (1-100), `offset?` | Free | The organization's jobs, newest first. |

### E-signature

| Tool | Arguments | Cost | Does |
|------|-----------|------|------|
| `create_envelope` | `artifact`, `data`, `signers: [{ email, name, routing_order? }]` (1-20), `title?`, `message?`, `external_id?` | Per call | Seals the artifact and sends signing invitations. Returns the envelope id and each signer's signing URL. |
| `get_envelope` | `envelope_id` | Free | Status and per-signer state. |
| `list_envelopes` | `status?` (`draft`, `pending`, `in_progress`, `completed`, `declined`, `voided`, `expired`), `limit?` (1-100), `offset?` | Free | Envelopes, newest first. |
| `download_envelope` | `envelope_id` | Free | Links to the signed document and completion certificate, once completed. |
| `void_envelope` | `envelope_id`, `reason` (1-500 characters) | Free | Voids an in-progress envelope and notifies signers. |
| `remind_envelope` | `envelope_id` | Free | Emails every pending signer. |
| `envelope_audit` | `envelope_id` | Free | Every lifecycle event with actor, timestamp and a tamper-evident hash. |

### Payments

| Tool | Arguments | Does |
|------|-----------|------|
| `connect_get_status` | none | Stripe Connect status. `ready` must be `true` before `create_payment`. |
| `connect_start_onboarding` | `refresh_url`, `return_url` | Returns a hosted onboarding URL. |
| `create_payment` | Either `amountCents` + `currency`, or `artifact` + `data` (the amount comes from the party `payment` in the form). Always `successUrl`, `cancelUrl`. Optional `description`, `externalId`. | Creates a hosted checkout. Returns `checkoutUrl`. |
| `get_payment` | `paymentId` | One payment. |
| `list_payments` | `status?` (`pending`, `succeeded`, `failed`, `partially_refunded`, `refunded`), `limit?` (1-100), `offset?` | Payments, newest first. |
| `refund_payment` | `paymentId` | Refunds the remaining amount. |

## Limits

| Limit | Value |
|-------|-------|
| Rate limit, `mcp.paradoc.dev` | 2 `POST /mcp` requests per 60 seconds per client IP |
| Rate limit, `mcp-dev.paradoc.dev` | 60 per 60 seconds |
| `extract`, `prefill` document | 10 MB. Larger documents: `extract_job_submit` (25 MB, 100 pages). |

The session handshake counts against the rate limit, so a new session plus two tool calls can reach the production limit. On `429`, wait 60 seconds before the next call. For many calls in a row, use the npm tools ([ai-tools.md](./ai-tools.md)), the SDK ([sdk.md](./sdk.md)) or the CLI ([cli.md](./cli.md)) locally.
