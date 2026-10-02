---
name: mcp
description: The hosted Paradoc MCP server at https://mcp.paradoc.dev/mcp. Connect with OAuth or an x-api-key, choose test, live, or both modes per connection, the data payload shape, every tool with its arguments and limits, which tools are billed, and rate limits.
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

**Choose the connection's modes.** Sign-in identifies the member. What the connection may do is set once per connection, in the Paradoc console, on **Settings → MCP connections**. The first call from a new connection returns an error with a link to that page. Open it, choose the modes and the permissions for each mode, and retry the call.

| Grant | Behavior |
|-------|----------|
| Test only, or live only | Every call runs in that mode. A call that names the other mode is refused. |
| Test and live | Every call that touches mode-owned content or records must pass `mode` (`"test"` or `"live"`). A call without it is refused; there is no default. |

Each mode has its own permissions, capped by the member's role. Every result from a platform tool ends with the mode it ran in (`mode: test`). The artifact, registry and render tools touch no mode-owned content, so they take no `mode`.

The same console page lists the member's connections. Revoke one mode, or the whole connection; the next call is refused. An organization administrator can turn MCP access off per mode for the whole organization.

| Error code | Meaning |
|------------|---------|
| `MCP_CONNECTION_NOT_GRANTED` | The connection is not set up. The message carries the setup link. |
| `MCP_MODE_REQUIRED` | A test-and-live connection called without `mode`. |
| `MCP_MODE_NOT_GRANTED` | The call named a mode the connection does not hold. |
| `MCP_MODE_DISABLED` | An administrator turned MCP access off in that mode. |

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

The server checks the key with the platform before it opens a session. An API-key connection runs in the key's mode (`ofk_test_…` or `ofk_live_…`) and needs no console setup. A call that names the other mode is refused.

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
| `validate` | `artifact` (object), `options?: { schema?: boolean, logic?: boolean }` (both default `true`) | `{ valid, detected_kind?, issues?: [{ message, path? }] }` |
| `fill` | `artifact` (form or checklist object), `data` | `{ accepted, complete, artifact_kind, data?, errors?: [{ field, message }] }` |

`accepted` is `true` when every supplied value is valid. `complete` is `true` when every required value is present. An invalid artifact (`valid: false`) and rejected values (`accepted: false`) are normal results. `fill` on an artifact that is not a form or checklist returns a tool error (`isError: true`). The `data` that `fill` returns is the flat field map, not a payload: keep your own `data` object and pass it to `render`.

`fill` takes only the current `$schema`; migrate an older artifact first ([schemas.md § Loading rules](./schemas.md#loading-rules)).

## Registry tools

| Tool | Arguments | Returns |
|------|-----------|---------|
| `search` | `query` (min 2 characters), `kind?` (`form`, `document`, `checklist`, `bundle`), `limit?` (1-50, default 20) | Matching artifacts and registries |
| `list_artifacts` | `kind?`, `limit?` (1-50, default 20), `offset?` | Artifacts ranked by all-time installs |
| `list_registries` | `status?` (`verified` default, `pending`, `bad`, `all`), `limit?` (1-50, default 20), `offset?` | Registries with artifact counts and installs |
| `get_registry` | `registry_id` | The registry and its artifacts |
| `get_artifact` | `registry_id`, `artifact_name` | `{ registry_id, artifact_name, artifact, metadata }`. File `instructions` and `agentInstructions` come back inline. Verified registries only. |

Result keys are snake_case (`display_name`, `installs_total`, `artifact_count`). The artifact JSON inside `get_artifact` keeps the artifact's own keys. A lookup that fails (unknown registry or artifact, unverified registry) returns a tool error (`isError: true`).

## Render

| Argument | Value |
|----------|-------|
| `registry_id`, `artifact_name` | From a registry tool. The registry must be verified. |
| `data` | The payload you gave `fill`. |
| `layer?` | Layer key. Defaults to `defaultLayer`, then the first layer. |
| `output_mode?` | `"url"` (default): a short download link that expires in 7 days. `"inline"`: the content in the response, base64 for binary output. Use `"inline"` for text or markdown shown in chat. |

Returns `{ success, render_id, artifact_kind, mime_type, download_url?, expires_at?, content?, encoding? }`. When the artifact fails schema validation or the data is rejected, `success` is `false` with `validation_issues` or `errors`. When the render cannot run (unverified registry, not a form, unknown layer), the tool returns an error (`isError: true`).

`render` renders forms from a verified registry, with text, markdown, HTML, PDF and DOCX layers. For an unpublished artifact, render locally with the SDK or CLI ([rendering.md](./rendering.md)). React (`text/tsx`) layers render with the `paradoc-react` skill.

## Platform tools

These act on the session's organization through the Paradoc platform API. The artifact argument is a source object, not a `registry_id`:

```jsonc
{ "source": "registry", "id": "@acme/forms/nda" }          // optional "@1.2.0" suffix, or "version"
{ "source": "inline", "artifact": { "kind": "form", "…": "…" } }
```

A registry coordinate resolves in the call's mode. A test session never falls back to a live artifact. To test with a live published version, add `"source_mode": "live"` to the registry source. The version is read-only, and the call and its records stay in test mode. To change a live artifact from test mode, fork it into a test repo.

OAuth and API-key connections get the same platform tools. Each call needs the permission in the tables below: an API key must hold it, and an OAuth connection must be granted it for the call's mode.

A billed tool fails with an insufficient-balance error when the organization's balance is empty.

`extract`, `prefill`, `seal`, `extract_job_submit` and `create_envelope` take an optional `idempotency_key` (1-255 characters). To retry a call that failed or timed out, send the same key: the API returns the first result and does not bill it again. Without a key, each call is a new operation. A test-mode call and a live-mode call never share a result, even with the same key.

### Execution

Every execution tool needs `execution:run`. Reading a stored extraction result with `extract_job_get` or `extract_job_list` also needs `execution-content:read`.

| Tool | Arguments | Cost | Does |
|------|-----------|------|------|
| `describe` | `artifact` | Free | Fields, parties and annexes with types, plus a sample payload. Call it first. |
| `extract` | `artifact`, `document: { content_base64, mime_type }`, `options?: { confidence_threshold?, validate_extracted? }`, `idempotency_key?` | Per page | Reads a filled PDF or image (PNG, JPEG, WebP; 10 MB max, no data-URI prefix). Returns values with confidence and page provenance. Works on scanned and flattened documents. |
| `prefill` | `artifact`, `document`, `options?: { confidence_threshold?, include_optional?, required_first? }`, `idempotency_key?` | Extract + fill | Extracts and commits readings above the threshold into a fill. Lower readings come back as suggestions. |
| `seal` | `artifact`, `data`, `layer?`, `signers?`, `signatories?`, `idempotency_key?` | Per call | Fills the form and returns the canonical PDF, the signature map and `canonical_pdf_hash`. Creates no envelope. See [sealing.md](./sealing.md). |
| `extract_job_submit` | `artifact`, `document` (about 18.75 MB, 100 pages max), `options?`, `idempotency_key?` | Per page, on success | Starts async extraction and returns a job id. |
| `extract_job_get` | `job_id` | Free | Job status, and the `extract` result when complete. |
| `extract_job_list` | `limit?` (1-100), `offset?` | Free | The organization's jobs, newest first. |

### E-signature

| Tool | Arguments | Permission | Cost | Does |
|------|-----------|------------|------|------|
| `create_envelope` | `artifact`, `data`, `signers: [{ email, name, client_user_id?, routing_order? }]` (1-20), `title?`, `message?`, `external_id?`, `client_user_id?`, `signer_access_days?` (1-3650), `retention_days?` (30 or more, or `null` to keep forever), `idempotency_key?` | `esign:manage` | Per call | Seals the artifact and sends signing invitations. Returns the envelope id and each signer's signing URL. Omitted `signer_access_days` and `retention_days` take the organization defaults. |
| `get_envelope` | `envelope_id` | `esign:read` | Free | Status and per-signer state. |
| `list_envelopes` | `status?` (`draft`, `pending`, `in_progress`, `completed`, `declined`, `voided`, `expired`), `client_user_id?`, `limit?` (1-100), `offset?` | `esign:read` | Free | Envelopes, newest first. |
| `download_envelope` | `envelope_id` | `esign-content:read` | Free | Links to the signed document and completion certificate, once completed. |
| `void_envelope` | `envelope_id`, `reason` (1-500 characters) | `esign:manage` | Free | Voids an in-progress envelope and notifies signers. |
| `remind_envelope` | `envelope_id` | `esign:manage` | Free | Emails every pending signer. |
| `envelope_audit` | `envelope_id` | `esign-content:read` | Free | Every lifecycle event with actor, timestamp and a tamper-evident hash. |

### Payments

| Tool | Arguments | Permission | Does |
|------|-----------|------------|------|
| `connect_get_status` | none | `payment:read` | Stripe Connect status. `ready` must be `true` before `create_payment`. Onboarding is done by a person on the Payments page of the Paradoc console. |
| `create_payment` | Either `amount_cents` + `currency`, or `artifact` + `data` (the amount comes from the party `payment` in the form). Always `success_url`, `cancel_url`. Optional `connected_account_id` (defaults to the organization's default account), `description`, `external_id`, `client_user_id`, `payer_client_user_id`. | `payment:charge` | Creates a hosted checkout. Returns `checkout_url`. |
| `get_payment` | `payment_id` | `payment:read` | One payment. |
| `list_payments` | `status?` (`pending`, `succeeded`, `failed`, `partially_refunded`, `refunded`), `created_after?`, `created_before?` (ISO 8601), `q?` (description text), `min_amount_cents?`, `max_amount_cents?`, `connected_account_id?`, `client_user_id?`, `limit?` (1-100), `offset?` | `payment:read` | Payments, newest first. |
| `refund_payment` | `payment_id` | `payment:refund` | Refunds the remaining amount of a `succeeded` or `partially_refunded` payment. A payment already refunded in full is rejected; read its state with `get_payment`. |

A `402` from `create_payment` names its cause: no connected Stripe account (start onboarding), an account that is not payout-enabled (finish onboarding), or, for a billed operation, an empty balance (top up).

## Limits

| Limit | Value |
|-------|-------|
| Rate limit, `mcp.paradoc.dev` | 60 requests to `/mcp` (`POST`, `GET` and `DELETE`) per 60 seconds per client IP |
| Rate limit, `mcp-dev.paradoc.dev` | 60 per 60 seconds |
| `extract`, `prefill` document | 10 MB. Larger documents: `extract_job_submit` (about 18.75 MB, 100 pages). |

The session handshake counts against the rate limit. A `GET` that opens the server-to-client stream counts once, when it opens; an open stream is not cut off. A normal handshake and `tools/list` leave room for an active fill loop within the 60-request window. Request 61 from the same client IP gets `429`; wait for the 60-second window to reset. For larger workloads, use the npm tools ([ai-tools.md](./ai-tools.md)), the SDK ([sdk.md](./sdk.md)) or the CLI ([cli.md](./cli.md)) locally.

Every tool signals a failed call the same way: the result has `isError: true` and its text is the error message. A result without `isError` is the tool's answer, which can still report a validation outcome (`valid: false`, `accepted: false`, `success: false` with `errors` or `validation_issues`).
