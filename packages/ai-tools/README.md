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

- **9 tools** - registry discovery, retrieval, inspection, validation, filling, fill-state inspection, updates, and rendering
- **No framework dependency** - Pure tool protocol, no AI SDK lock-in
- **3 source modes** - Run operations against artifact JSON, a URL, or an indexed registry item
- **Registry client** - Fetch artifacts from any Paradoc registry over HTTPS
- **Bounded output** - Request-scoped caching, cancellation, limits, and selectable render presentation

This package is the foundation for `@paradoc/ai-sdk` (Vercel AI SDK) and `@paradoc/tanstack-ai` (TanStack AI). Advanced users can build custom adapters for other frameworks.

## Installation

```bash
npm install @paradoc/ai-tools
```

## Usage

### Direct usage (no framework)

```typescript
import {
  toolDefinitions,
  executeGetRegistry,
  executeGetArtifact,
  executeInspectArtifact,
  executeValidateArtifact,
  executeValidateInput,
  executeFill,
  executeGetFillState,
  executeUpdateFill,
  executeRender,
} from "@paradoc/ai-tools";

// Fetch available artifacts from a registry
const registry = await executeGetRegistry({
  registry_url: "https://public.paradoc.dev",
});

// Fetch a specific artifact
const { artifact } = await executeGetArtifact({
  registry_url: "https://public.paradoc.dev",
  artifact_name: "pet-addendum",
});

// Validate the artifact schema
const validation = await executeValidateArtifact({ source: "artifact", artifact });

// Fill with data and check for errors
const fillResult = await executeFill({
  source: "artifact",
  artifact,
  data: {
    fields: { petName: "Buddy", species: "dog", weight: 45 },
    parties: { tenant: { id: "t1", name: "Jane Doe" } },
  },
});

if (!fillResult.accepted) throw new Error(fillResult.error?.message);

const state = await executeGetFillState({
  source: "artifact",
  artifact,
  data: fillResult.data,
  evaluation_context: fillResult.evaluation_context,
});

// Render to markdown (inline)
const rendered = await executeRender({
  source: "artifact",
  artifact,
  data: fillResult.data,
  evaluation_context: fillResult.evaluation_context,
  layer: "markdown",
});
```

### Render modes

The render tool supports three input modes via discriminated union:

| Mode | Fields | Resolution |
|------|--------|------------|
| `source: 'artifact'` | `artifact`, `base_url?` | Direct, no fetch needed |
| `source: 'url'` | `url` | Fetches artifact JSON and derives its layer base URL |
| `source: 'registry'` | `registry_url`, `artifact_name` | Fetches `registry.json`, verifies membership, then retrieves the artifact |

### Configuration

```typescript
import type { ParadocToolsConfig } from "@paradoc/ai-tools";

const config: ParadocToolsConfig = {
  defaultRegistryUrl: "https://public.paradoc.dev",
  fetch: customFetchWithAuth,
  approvedOrigins: ["https://public.paradoc.dev"],
  maxOutputBytes: 200_000,
};
```

The configured default is used only when an operation omits `registry_url`; an explicit input always wins. Local HTTP/loopback access requires `allowLocalDevelopment: true`. `approvedOrigins` should be used with a connection-level egress policy when sources are untrusted, because lexical hostname checks cannot prevent DNS rebinding.

## Tools

| Tool | Input | Output | Network? |
|------|-------|--------|----------|
| `get_registry` | `{registry_url?}` | `{registry_url, items[]}` | Yes |
| `get_artifact` | `{registry_url?, artifact_name}` | `{artifact, artifact_name, instructions?}` | Yes |
| `inspect_artifact` | A source plus selectable sections | Bounded artifact projection | Source dependent |
| `validate_artifact` | A source plus validation options | `{valid, artifact_kind?, issues?}` | Source dependent |
| `validate_input` | A source plus one field/party/annex/item value | Typed normalized value or structured errors | Source dependent |
| `fill` | A source plus `{data}` | `{accepted, complete, data?, evaluation_context?}` | Source dependent |
| `get_fill_state` | A source plus draft data | Progress, open targets, rules, and next target | Source dependent |
| `update_fill` | A source plus draft, patch, clear/reset paths | Lossless reusable draft payload | Source dependent |
| `render` | A source plus optional data and layer | Text or base64 result with byte length | Source dependent |

The public operation names and schemas are available from `toolDefinitions`. Wire fields use `snake_case`; artifact JSON keeps its own field names. Form and checklist fill output keeps the accepted payload shape (`fields`, `parties`, `annexes`, and supported signer data), so it can be passed directly to `update_fill` or `render`. `accepted` means supplied values were accepted; `complete` reports whether the draft is ready according to the artifact's rules.

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/ai-sdk`](../ai-sdk) - Vercel AI SDK adapter
- [`@paradoc/tanstack-ai`](../tanstack-ai) - TanStack AI adapter
- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
