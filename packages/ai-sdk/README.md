<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=ai-sdk" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/ai-sdk</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=ai-sdk)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=ai-sdk) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Vercel AI SDK adapter for Paradoc tools. Wraps `@paradoc/ai-tools` with AI SDK `tool()` for use with `generateText`, `streamText`, and other AI SDK functions.

- **5 tools** - validateArtifact, fill, render, getRegistry, getArtifact
- **Drop-in integration** - Works with any AI SDK-compatible model
- **Typed schemas** - Zod v4 input schemas with full type inference
- **Peer dependency** - Requires `ai` ^6.0.0

## Installation

```bash
npm install @paradoc/ai-sdk ai zod
```

## Usage

```typescript
import { paradocTools } from "@paradoc/ai-sdk";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const tools = paradocTools({
  defaultRegistryUrl: "https://public.paradoc.dev",
});

const result = await generateText({
  model: openai("gpt-4o"),
  tools,
  prompt: "Fill the pet addendum for my dog Rex, 30 lbs, vaccinated",
});
```

### With streaming

```typescript
import { streamText } from "ai";

const result = streamText({
  model: openai("gpt-4o"),
  tools: paradocTools(),
  prompt: "What artifacts are available in the public registry?",
});

for await (const part of result.textStream) {
  process.stdout.write(part);
}
```

### Configuration

```typescript
const tools = paradocTools({
  defaultRegistryUrl: "https://public.paradoc.dev",
  proxyTextRenderer: {
    url: "https://your-documents-service.example.com",
    apiKey: "your-api-key",
  },
  fetch: customFetchWithAuth,
});
```

## Tools provided

| Tool | Description |
|------|-------------|
| `validateArtifact` | Validates an Paradoc artifact against its schema |
| `fill` | Fills an Paradoc artifact with data and validates |
| `render` | Renders an Paradoc artifact to PDF, markdown, or DOCX |
| `getRegistry` | Fetches registry.json from a URL, returns available artifacts |
| `getArtifact` | Fetches artifact JSON from a registry by name |

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/ai-sdk/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/ai-tools`](../ai-tools) - Core tool protocol (framework-neutral)
- [`@paradoc/tanstack-ai`](../tanstack-ai) - TanStack AI adapter
- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
