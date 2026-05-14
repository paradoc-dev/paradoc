<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=ai-tools" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/ai-tools</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=ai-tools)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=ai-tools) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Framework-neutral AI tool definitions for Paradoc. Provides Zod input schemas, execute functions, and an HTTP registry client that any AI framework adapter can wrap.

- **5 tools** - validateArtifact, fill, render, getRegistry, getArtifact
- **No framework dependency** - Pure tool protocol, no AI SDK lock-in
- **3 render modes** - Render from artifact JSON, URL, or registry lookup
- **Registry client** - Fetch artifacts from any Paradoc registry over HTTPS
- **Edge-compatible** - Optional proxy text renderer for edge runtimes

This package is the foundation for `@paradoc/ai-sdk` (Vercel AI SDK) and `@paradoc/tanstack-ai` (TanStack AI). Advanced users can build custom adapters for other frameworks.

## Installation

```bash
npm install @paradoc/ai-tools
```

## Usage

### Direct usage (no framework)

```typescript
import {
  executeValidateArtifact,
  executeFill,
  executeRender,
  executeGetRegistry,
  executeGetArtifact,
} from "@paradoc/ai-tools";

// Fetch available artifacts from a registry
const registry = await executeGetRegistry({
  registryUrl: "https://public.paradoc.dev",
});

// Fetch a specific artifact
const { artifact } = await executeGetArtifact({
  registryUrl: "https://public.paradoc.dev",
  artifactName: "pet-addendum",
});

// Validate the artifact schema
const validation = executeValidateArtifact({ artifact });

// Fill with data and check for errors
const fillResult = executeFill({
  artifact,
  data: {
    fields: { petName: "Buddy", species: "dog", weight: 45 },
    parties: { tenant: { id: "t1", name: "Jane Doe" } },
  },
});

// Render to markdown (inline)
const rendered = await executeRender({
  source: "registry",
  registryUrl: "https://public.paradoc.dev",
  artifactName: "pet-addendum",
  data: fillResult.data,
  layer: "markdown",
});
```

### Render modes

The render tool supports three input modes via discriminated union:

| Mode | Fields | Resolution |
|------|--------|------------|
| `source: 'artifact'` | `artifact`, `baseUrl?` | Direct - no fetch needed |
| `source: 'url'` | `url` | Fetches artifact JSON, derives baseUrl |
| `source: 'registry'` | `registryUrl`, `artifactName` | Fetches registry.json, then artifact |

### Configuration

```typescript
import type { ParadocToolsConfig } from "@paradoc/ai-tools";

const config: ParadocToolsConfig = {
  defaultRegistryUrl: "https://public.paradoc.dev",
  proxyTextRenderer: {
    url: "https://your-documents-service.example.com",
    apiKey: "your-api-key",
  },
  fetch: customFetchWithAuth,
};
```

### Edge compatibility

- **PDF and DOCX renderers** work everywhere (pure JS)
- **Text renderer** (Handlebars) requires Node.js. On edge runtimes, configure `proxyTextRenderer` to delegate to an HTTP service

## Tools

| Tool | Input | Output | Network? |
|------|-------|--------|----------|
| `validateArtifact` | `{artifact, options?}` | `{valid, detectedKind, issues?}` | No |
| `fill` | `{artifact, data}` | `{valid, artifactKind, data?, errors?}` | No |
| `render` | 3 modes (see above) | `{success, content, encoding, mimeType}` | Modes 2+3 |
| `getRegistry` | `{registryUrl}` | `{name, items[]}` | Yes |
| `getArtifact` | `{registryUrl, artifactName}` | `{artifact, artifactName}` | Yes |

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/ai-tools/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/ai-sdk`](../ai-sdk) - Vercel AI SDK adapter
- [`@paradoc/tanstack-ai`](../tanstack-ai) - TanStack AI adapter
- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
