# @paradoc/tanstack-ai

Experimental [TanStack AI](https://tanstack.com/ai) tools for Paradoc document workflows. The adapter is tested against TanStack AI `0.53.0`, the latest published release candidate, and remains experimental until TanStack AI reaches a stable release. TanStack AI's pre-1.0 API may change between releases.

The adapter consumes the canonical schemas, descriptions, result contracts, and execution functions from `@paradoc/ai-tools`.

## Installation

```bash
npm install @paradoc/tanstack-ai@0.5.0 @tanstack/ai@0.53.0 zod
```

## Native server tools

`paradocTools()` returns a readonly nine-tool tuple that can be passed directly to TanStack AI's `chat` activity:

```typescript
import { chat } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { paradocTools } from "@paradoc/tanstack-ai";

const result = await chat({
  adapter: openaiText("gpt-5.5"),
  messages: [{ role: "user", content: "Inspect the purchase agreement fields." }],
  tools: paradocTools({
    defaultRegistryUrl: "https://public.paradoc.dev",
  }),
  stream: false,
});
```

The collection contains these canonical wire names:

| Tool | Purpose |
| --- | --- |
| `get_registry` | Discover artifacts in a registry |
| `get_artifact` | Retrieve an artifact and its instructions |
| `inspect_artifact` | Return a bounded artifact description |
| `validate_artifact` | Validate an artifact definition |
| `validate_input` | Validate one field, party, annex, or checklist item |
| `fill` | Seed a form or checklist draft |
| `get_fill_state` | Inspect draft progress and the next target |
| `update_fill` | Merge, clear, or reset a draft |
| `render` | Render a form, document, or checklist |

Each tool uses the shared Zod input and output schemas. TanStack AI validates tool input before calling the server function and validates output through `outputSchema`, so application code retains the inferred result type.

## Definition-only composition

Use `paradocToolDefinitions()` when a client needs tool metadata and schemas without server credentials or execution functions. Instantiate a definition with TanStack AI's native `.client()` or `.server()` method at the boundary that owns execution:

```typescript
import { paradocToolDefinitions } from "@paradoc/tanstack-ai";

const definitions = paradocToolDefinitions();
const clientTools = definitions.map((definition) => definition.client());
```

Individual server factories and definition functions are available from the root and from package subpaths, such as `getFillState()` and `@paradoc/tanstack-ai/get-fill-state`.

## Cancellation and configuration

TanStack AI's execution `abortSignal` is composed with `ParadocToolsConfig.signal` and the request context signal before the shared operation runs. Registry, artifact, instruction, and layer requests observe the resulting signal.

```typescript
const tools = paradocTools({
  defaultRegistryUrl: "https://public.paradoc.dev",
  approvedOrigins: ["https://public.paradoc.dev"],
  maxOutputBytes: 200_000,
});
```

`maxOutputBytes` supplies the default render presentation limit when the call does not provide one. An explicit `presentation` input remains authoritative.

## Related packages

- [`@paradoc/ai-tools`](../ai-tools) provides the framework-neutral contract.
- [`@paradoc/ai-sdk`](../ai-sdk) provides the Vercel AI SDK 7 adapter.
- [`@paradoc/mastra`](../mastra) provides the Mastra adapter.

## License

MIT
