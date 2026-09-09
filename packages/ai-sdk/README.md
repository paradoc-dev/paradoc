# @paradoc/ai-sdk

Native [AI SDK 7](https://ai-sdk.dev/) tools for Paradoc document workflows. The adapter consumes the canonical schemas, descriptions, result contracts, and execution functions from `@paradoc/ai-tools`.

The package is verified with AI SDK `7.0.94`, Zod `4.1.8` or newer in the v4 line, and Node.js `22` or newer.

## Installation

```bash
npm install @paradoc/ai-sdk ai zod @ai-sdk/openai
```

## Use the native tool map

`paradocTools()` returns all nine operations under their canonical snake_case names so the map can be passed directly to `generateText`, `streamText`, or an AI SDK agent.

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { paradocTools } from "@paradoc/ai-sdk";

const result = await generateText({
  model: openai("gpt-4o"),
  tools: paradocTools({
    defaultRegistryUrl: "https://public.paradoc.dev",
  }),
  prompt: "Find the purchase agreement artifact and inspect its required fields.",
});
```

The collection keys and tool IDs are:

| Tool | Purpose |
| --- | --- |
| `get_registry` | Discover artifacts in a registry |
| `get_artifact` | Retrieve an artifact and selected instructions |
| `inspect_artifact` | Return a bounded, selectable artifact description |
| `validate_artifact` | Validate an artifact definition |
| `validate_input` | Validate one field, party, annex, or checklist item |
| `fill` | Seed a form or checklist draft |
| `get_fill_state` | Inspect progress and the next available target |
| `update_fill` | Merge, clear, or reset a draft |
| `render` | Render a form, document, or checklist |

## Use one tool

Each operation is available as a named factory and as a package subpath. Subpaths let an application select one operation without constructing the complete collection.

```typescript
import getFillState from "@paradoc/ai-sdk/get-fill-state";

const fillState = getFillState({
  defaultRegistryUrl: "https://public.paradoc.dev",
});
```

The root named factories are `getRegistry`, `getArtifact`, `inspectArtifact`, `validateArtifact`, `validateInput`, `fill`, `getFillState`, `updateFill`, and `render`.

## Canonical inputs and results

Tool inputs use the shared `snake_case` wire contract. Source-backed operations accept one of these forms:

```typescript
const source = { source: "artifact", artifact };
const remoteSource = { source: "url", url: "https://example.com/artifact.json" };
const registrySource = {
  source: "registry",
  registry_url: "https://public.paradoc.dev",
  artifact_name: "purchase-agreement",
};
```

The adapter passes the shared Zod schemas directly to AI SDK 7. AI SDK validates model-generated calls before execution, and the adapter does not parse the input a second time. Result types and `outputSchema` are also shared, so application code receives the complete canonical result returned by `@paradoc/ai-tools`.

## Cancellation and output limits

The AI SDK `abortSignal` is composed with `ParadocToolsConfig.signal` and passed into a request-scoped neutral execution context. Registry, artifact, instruction, and layer requests observe the combined signal.

Render presentation can bound content sent back to the model while keeping byte length and truncation metadata in the result:

```typescript
const tools = paradocTools({ maxOutputBytes: 200_000 });

const renderResult = await tools.render.execute({
  source: "artifact",
  artifact,
  presentation: { max_bytes: 20_000, include_content: true },
}, {
  toolCallId: "render-1",
  messages: [],
  context: {},
});
```

`maxOutputBytes` supplies a default only when the input has no `presentation`. Explicit input presentation wins. Omit the presentation limit when the caller needs the unbounded application result.

## Related packages

- [`@paradoc/ai-tools`](../ai-tools) provides the framework-neutral contracts and execution functions.
- [`@paradoc/tanstack-ai`](../tanstack-ai) provides the TanStack AI adapter.
- [`@paradoc/sdk`](../sdk) provides the Paradoc framework SDK.

## License

MIT
