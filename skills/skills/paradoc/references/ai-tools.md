---
name: ai-tools
description: Give your own AI agent Paradoc tools with @paradoc/ai-tools and its adapters (@paradoc/ai-sdk, @paradoc/mastra, @paradoc/tanstack-ai). The ten operations, source modes, snake_case wire format, execute functions, the fill loop, config and security, and how it differs from the hosted MCP server.
metadata:
  tags: ai-tools, ai-sdk, vercel, mastra, tanstack-ai, agent, tools, fill, get_fill_state, update_fill, render, extract, snake_case
---

# AI tools in your own code

**Contents:** [Packages](#packages) · [The ten operations](#the-ten-operations) · [Sources](#sources) · [Wire format](#wire-format) · [The fill loop](#the-fill-loop) · [Adapters](#adapters) · [Config and security](#config-and-security) · [Limits](#limits) · [Differences from MCP](#differences-from-mcp)

The AI packages are npm libraries. The tools run in your own process, with no Paradoc account; they make network calls only to fetch artifacts by URL or registry. When a chat client connects to the hosted server instead, load [mcp.md](./mcp.md).

## Packages

| Package | Use it for | Install |
|---------|-----------|---------|
| `@paradoc/ai-tools` | The framework-neutral contract: Zod schemas, `execute*` functions, `toolDefinitions` | `npm install @paradoc/ai-tools` |
| `@paradoc/ai-sdk` | Vercel AI SDK 7 (`generateText`, `streamText`, agents) | `npm install @paradoc/ai-sdk ai zod` |
| `@paradoc/mastra` | Mastra agents | `npm install @paradoc/mastra @mastra/core zod` |
| `@paradoc/tanstack-ai` | TanStack AI `chat()` | `npm install @paradoc/tanstack-ai@0.5.0 @tanstack/ai@0.53.0 @tanstack/ai-openai@0.22.5 zod` |

Every adapter wraps `@paradoc/ai-tools`, so the tool names, inputs and outputs are the same everywhere.

## The ten operations

| Tool | Does | Key inputs (besides the source) | `execute` function |
|------|------|----------------------------------|--------------------|
| `get_registry` | List the artifacts in a registry | `registry_url?` | `executeGetRegistry` |
| `get_artifact` | Fetch one artifact and its instructions | `registry_url?`, `artifact_name`, `include_instructions?`, `include_agent_instructions?` | `executeGetArtifact` |
| `inspect_artifact` | Bounded description of an artifact | `sections?` (`metadata`, `fields`, `parties`, `annexes`, `items`, `layers`), `max_items?` (default 100, max 500) | `executeInspectArtifact` |
| `validate_artifact` | Validate an artifact definition | `options?: { schema?, logic? }` | `executeValidateArtifact` |
| `validate_input` | Validate and normalize one value | `target` (`field`, `party`, `annex`, `checklist_item`), `field_path` / `role_id` + `index` / `annex_id` / `item_id`, `value` | `executeValidateInput` |
| `fill` | Start a form or checklist draft | `data`, `evaluation_context?` | `executeFill` |
| `get_fill_state` | Progress, open targets, rules, next target | `data`, `evaluation_context?`, `include_optional?` | `executeGetFillState` |
| `update_fill` | Merge, clear or reset values in a draft | `data`, `patch?`, `clear?`, `reset?`, `evaluation_context?` | `executeUpdateFill` |
| `render` | Render a form, document or checklist | `data?`, `layer?`, `evaluation_context?`, `presentation?: { max_bytes?, include_content? }` | `executeRender` |
| `extract` | Read a filled PDF form back into data | `pdf` (base64) or `pdf_url`, `layer?` | `executeExtract` |

`get_registry` and `get_artifact` take `registry_url`. Every other tool takes a source.

## Sources

| `source` | Fields | Resolution |
|----------|--------|------------|
| `"artifact"` | `artifact`, `base_url?` | Inline artifact JSON. File layers (a PDF template) resolve against `base_url`. |
| `"url"` | `url` | Fetches the artifact JSON. File layers resolve against the URL's directory. |
| `"registry"` | `registry_url`, `artifact_name` | Fetches `registry.json`, checks the artifact is listed, then fetches it. |

The `$schema` rules are the SDK's ([schemas.md § Loading rules](./schemas.md#loading-rules)): a fetched artifact declares the current version, and an inline one may omit it. An older version returns an error that names `paradoc migrate`.

## Wire format

Tool names and tool input and output fields are snake_case (`artifact_name`, `evaluation_context`, `open_required`). Artifact JSON and fill data keep their own names (`fields.petName`, `mimeType`).

The `data` payload for a form is `{ fields, parties, annexes }`. Value shapes: [fields.md § Field Type Reference](./fields.md#field-type-reference) and [parties.md § Party fill values](./parties.md#party-fill-values).

```jsonc
// data for fill, update_fill, render
{
  "fields": { "petName": "Rex", "weight": 30 },
  "parties": { "tenant": { "name": "Jane Smith" } }
}
```

For a checklist, `data` maps item ids to `true`, `false` or a string.

Tools return failures in the result instead of throwing. Check `accepted` / `valid` / `success`, then read `error: { code, message, path?, retryable? }` and, for value errors, `errors[]` of the same shape.

## The fill loop

`fill` starts a draft and `update_fill` changes it. The tools keep no state: the draft is the `data` the tool returns. Pass that `data` and the returned `evaluation_context` into the next call. `evaluation_context` fixes the clock (`today()`, `now()`) for the whole draft ([logic.md § Dates and the clock](./logic.md#dates-and-the-clock)).

| Output | Meaning |
|--------|---------|
| `accepted` | Every value in this call was valid. `false` returns no `data`: fix `errors[]` and call again with the previous draft. |
| `complete` | The draft has every required value and passes its rules. |

This loop runs as is with the `execute*` functions; an agent makes the same calls through its adapter.

```typescript
import { readFile } from 'node:fs/promises'
import { executeFill, executeGetFillState, executeUpdateFill, executeRender } from '@paradoc/ai-tools'

const artifact = JSON.parse(await readFile('pet-addendum.json', 'utf8'))
const source = { source: 'artifact' as const, artifact }

// 1. Start the draft with what the user gave.
const first = await executeFill({ ...source, data: { fields: { petName: 'Rex' } } })
// { accepted: true, complete: false, data: { fields: { petName: 'Rex' }, parties: {} }, evaluation_context: { asOf: {…} } }

// 2. Ask what is still open.
const state = await executeGetFillState({ ...source, data: first.data, evaluation_context: first.evaluation_context })
// state.summary: { required_total: 6, required_done: 1, … }
// state.next:    { kind: 'party', key: 'tenant', required: true, … }

// 3. Merge the next answers into the same draft.
const second = await executeUpdateFill({
  ...source,
  data: first.data!,
  patch: {
    fields: { weight: 30, species: 'dog', isVaccinated: true },
    parties: { tenant: { name: 'Jane Smith' }, landlord: { name: 'Pat Jones' } },
  },
  evaluation_context: first.evaluation_context,
})
// { accepted: true, complete: true, data: { …, parties: { tenant: { name: 'Jane Smith', id: 'tenant-0' } } } }

// 4. Render. A draft renders whether or not it is complete.
const doc = await executeRender({ ...source, data: second.data, layer: 'markdown', evaluation_context: second.evaluation_context })
// { success: true, encoding: 'utf-8', mime_type: 'text/markdown', content: '# Pet Addendum…' }
```

`update_fill` also takes `clear: ['fields.weight']` and `reset: ['fields.weight']` (schema-qualified paths). Use `validate_input` to check one answer before it goes into the draft.

To start from a filled PDF, call `extract` and pass its `data` to `fill`. The report is the SDK's ([filling.md § Extract from a filled PDF](./filling.md#extract-from-a-filled-pdf)). `extract` reads AcroForm fields; for a flattened or scanned PDF, use the hosted `extract` ([mcp.md § Execution](./mcp.md#execution)).

## Adapters

### `@paradoc/ai-sdk`

```typescript
import { paradocTools } from '@paradoc/ai-sdk'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

const result = await generateText({
  model: openai('gpt-4o'),
  tools: paradocTools({ defaultRegistryUrl: 'https://public.paradoc.dev' }),
  prompt: 'Fill the pet addendum for my dog Rex, 30 lbs',
})
```

| Export | Returns |
|--------|---------|
| `paradocTools(config?)` | Object keyed by tool name. Spread it next to your own tools, or destructure: `const { fill, render } = paradocTools()`. |
| `getRegistry`, `getArtifact`, `inspectArtifact`, `validateArtifact`, `validateInput`, `fill`, `getFillState`, `updateFill`, `render`, `extract` | One AI SDK `tool()` each, taking `config?`. |
| Subpaths `@paradoc/ai-sdk/<tool-name>` (`/fill`, `/get-fill-state`, …) | The same factory, as named and default export. |

The framework abort signal is combined with `config.signal` and `config.context.signal` in every adapter.

### `@paradoc/mastra`

```typescript
import { Agent } from '@mastra/core/agent'
import { paradocTools } from '@paradoc/mastra'

const agent = new Agent({
  id: 'document-agent',
  name: 'Document agent',
  instructions: 'Use the Paradoc tools to inspect and complete documents.',
  model: 'openai/gpt-4o',
  tools: paradocTools({ defaultRegistryUrl: 'https://public.paradoc.dev' }),
})
```

| Export | Returns |
|--------|---------|
| `paradocTools(config?)` | Object keyed by tool name. |
| `getRegistry`, `getArtifact`, `inspectArtifact`, `validateArtifact`, `validateInput`, `fill`, `getFillState`, `updateFill`, `render`, `extract` | One Mastra tool each. Tool `id` is the snake_case name. |
| Subpaths `@paradoc/mastra/<tool-name>` | The same factory, as named and default export. |
| `ParadocMastraConfig` | `ParadocToolsConfig` plus `modelOutputMaxBytes`. |

`modelOutputMaxBytes` (default `DEFAULT_MODEL_OUTPUT_MAX_BYTES`, 16,384) caps the `content` the model sees through `toModelOutput`. Your code still gets the full tool result.

### `@paradoc/tanstack-ai`

```typescript
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { paradocTools } from '@paradoc/tanstack-ai'

const result = await chat({
  adapter: openaiText('gpt-4o'),
  messages: [{ role: 'user', content: 'Inspect the pet addendum fields.' }],
  tools: paradocTools({ defaultRegistryUrl: 'https://public.paradoc.dev' }),
  stream: false,
})
```

| Export | Returns |
|--------|---------|
| `paradocTools(config?)` | A readonly **array** of ten server tools, as `chat()` expects. Spread it: `[...paradocTools(), myTool]`. |
| `getRegistry()` … `extract()` | One server tool each. |
| `paradocToolDefinitions()`, `getRegistryDefinition()` … `extractDefinition()` | Definitions with no execution, for `.client()` or `.server()` registration. |
| Subpaths `@paradoc/tanstack-ai/<tool-name>` | The factory (default and named) and its definition function. |

The TanStack AI abort signal is combined with `config.signal` and `config.context.signal`.

### No framework

Use `toolDefinitions` from `@paradoc/ai-tools`. Each entry has `name`, `description`, `input_schema` and `output_schema` (Zod) and `execute(input, config?)`. `operationNames` lists the ten names in order.

## Config and security

Every adapter factory takes `ParadocToolsConfig`:

| Option | Default | Use |
|--------|---------|-----|
| `defaultRegistryUrl` | none | Registry for calls that omit `registry_url`. Without it, those calls return `missing_registry_url`. |
| `approvedOrigins` | none | Origin allowlist for every registry, artifact, instruction and layer fetch. Checks hostnames only: pair it with a network egress policy for untrusted sources. |
| `allowLocalDevelopment` | `false` | Allow loopback and private hosts, and plain HTTP. Otherwise only public HTTPS URLs are fetched. |
| `fetch` | global `fetch` | Add auth headers, or mock in tests. |
| `maxRedirects` | `3` | Validated redirects per request. |
| `maxOutputBytes` | none | Default `render` output budget when a call has no `presentation`. |
| `signal` | none | Abort all work for the call. |
| `context` | per call | `createToolExecutionContext()`: one request-scoped cache and signal. Create one per request. |

Bound model-facing output with `presentation.max_bytes` on `render`. The result then has `truncated: true` and the full `byte_length`. Base64 content is cut on a whole 4-character group, so it stays decodable.

## Limits

| Tool | Limit |
|------|-------|
| `fill`, `get_fill_state`, `update_fill` | Forms and checklists only. |
| `render` | Forms, documents and checklists (render a bundle with the SDK). Text, markdown, HTML, PDF and DOCX layers; React (`text/tsx`) layers render with the `paradoc-react` skill. Binary output is base64. |
| `extract` | Fillable (AcroForm) PDFs with layer `bindings`. Pass `layer` when the artifact has more than one PDF layer. |
| All | To seal, use the SDK ([sealing.md](./sealing.md)) or the MCP `seal` tool. |

## Differences from MCP

| | AI packages | MCP server ([mcp.md](./mcp.md)) |
|---|---|---|
| Runs | In your process | Hosted at `https://mcp.paradoc.dev/mcp` |
| Auth | Your own config (`fetch` headers) | OAuth or `x-api-key`, per organization |
| Artifact lookup | Inline JSON, URL, or registry URL | Inline JSON, or `registry_id` + `artifact_name` from the Paradoc directory |
| Tools only here | `inspect_artifact`, `validate_input`, `get_fill_state`, `update_fill`, local `extract` | `list_registries`, `list_artifacts`, `search`, e-signature, payments, billed extraction and sealing |
| Validate and fill names | `validate_artifact`, `fill` | `validate`, `fill` |
| Render output | Inline only | Short download link (default) or inline |
