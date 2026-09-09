<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=mastra" target="_blank" rel="noopener noreferrer">
    <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
  </a>
</p>

<h1 align="center">@paradoc/mastra</h1>

[Paradoc](https://paradoc.dev) is documents as code. This package exposes the shared Paradoc document operations as native [Mastra](https://mastra.ai) tools.

## Installation

```bash
npm install @paradoc/mastra @mastra/core zod
```

`@paradoc/mastra` is verified against `@mastra/core` 1.64.0 and requires Node.js 22.13 or newer, matching Mastra's runtime baseline.

## Use with an agent

```typescript
import { Agent } from "@mastra/core/agent";
import { paradocTools } from "@paradoc/mastra";

const agent = new Agent({
  id: "document-agent",
  name: "Document agent",
  instructions: "Use the Paradoc tools to inspect and complete documents.",
  model: "openai/gpt-4o-mini",
  tools: paradocTools({
    defaultRegistryUrl: "https://public.paradoc.dev",
  }),
});
```

The collection keeps the canonical wire names used by `@paradoc/ai-tools`:

```typescript
const tools = paradocTools();
tools.get_registry;
tools.get_artifact;
tools.inspect_artifact;
tools.validate_artifact;
tools.validate_input;
tools.fill;
tools.get_fill_state;
tools.update_fill;
tools.render;
```

Each operation is also available through an individual factory, such as `createRenderTool()` or `createUpdateFillTool()`. The factories pass the shared Zod input and output schemas directly to Mastra, and the tool IDs and descriptions remain aligned with the neutral contract.

Mastra's execution `abortSignal` is forwarded to the shared request policy. The raw operation result stays available to application code while `toModelOutput` bounds rendered text and base64 content for the model. Set `modelOutputMaxBytes` to change the default 16 KiB model-facing budget:

```typescript
const tools = paradocTools({
  defaultRegistryUrl: "https://public.paradoc.dev",
  modelOutputMaxBytes: 32_000,
});
```

The adapter depends on the framework-neutral `@paradoc/ai-tools` package and imports Mastra's `createTool` contract. It does not add Mastra dependencies to other Paradoc adapters or render/session behavior to the shared package.

## Related packages

- [`@paradoc/ai-tools`](../ai-tools) - framework-neutral tool contract
- [`@paradoc/ai-sdk`](../ai-sdk) - Vercel AI SDK adapter
- [`@paradoc/tanstack-ai`](../tanstack-ai) - TanStack AI adapter

## License

MIT. See [LICENSE](./LICENSE).
