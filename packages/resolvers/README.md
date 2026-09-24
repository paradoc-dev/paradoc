<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=resolvers" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/resolvers</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=resolvers)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=resolvers) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Environment-specific resolvers for Paradoc. Use these to read layer files, templates, and other assets in your Paradoc applications.

- 📂 **Filesystem resolver** - Read root-confined local files in Node.js
- 🌐 **HTTP resolver** - Read files beneath a base URL in any runtime with `fetch`
- 🧠 **Memory resolver** - Read exact-key text and bytes in any JavaScript environment
- ✅ **Type-safe** - Full TypeScript support
- 🔌 **Pluggable** - Implements the `Resolver` interface from `@paradoc/types`

## Installation

```bash
npm install @paradoc/resolvers
```

## Usage

### Filesystem resolver

Create a resolver to read files from your filesystem:

```typescript
import { createFsResolver } from "@paradoc/resolvers/fs";

const resolver = createFsResolver({ root: process.cwd() });

// Read a file relative to root
const bytes = await resolver.read("/templates/form.md");
```

Filesystem paths always resolve beneath `root`. A single leading slash means the
resolver root, not the operating-system root. Parent traversal, outward symlinks,
backslashes, drive paths, and UNC paths are rejected. Relative roots are anchored
when the resolver is created. Missing files retain native Node.js error codes;
policy failures use `ERR_RESOLVER_OUTSIDE_ROOT` or `ERR_RESOLVER_INVALID_PATH`,
and an empty or non-string `root` throws `ERR_RESOLVER_INVALID_OPTIONS`.
The root is checked on each read until it is found. A missing root rejects that
read with Node.js's native `ENOENT` error, and a root created later becomes
readable.

Artifact paths use forward slashes on every supported host, including Windows.
Containment assumes the filesystem tree is stable during a read; this resolver
is not a race-proof sandbox for a concurrently hostile filesystem.

### HTTP resolver

Read files beneath a base URL in any runtime with the Fetch API:

```typescript
import { createHttpResolver } from "@paradoc/resolvers/http";

const resolver = createHttpResolver({ baseUrl: "https://example.com/forms/w-9/" });

// Fetches https://example.com/forms/w-9/templates/form.pdf
const bytes = await resolver.read("/templates/form.pdf");
```

Paths follow the filesystem rules: forward slashes only, and a single leading
slash means the base URL, not the origin root. Each segment is percent-encoded.
A path that resolves outside the base URL rejects with
`ERR_RESOLVER_OUTSIDE_ROOT`, and one that names the base URL itself with
`ERR_RESOLVER_INVALID_PATH`, before any request. A 404 rejects with
`ERR_RESOLVER_NOT_FOUND`, and any other failed status with
`ERR_RESOLVER_FETCH_FAILED`. Pass `fetch` to add transport policy, such as
allowed hosts, redirect handling, timeouts, or body size limits. Redirects
follow the fetch function's own policy. An error thrown by a supplied
`fetch` passes through unchanged.

### With form rendering

Bind a resolver once, when a form with file-based layers is constructed.
Every instance you derive from it afterward — every `fill`, every render —
carries the same resolver:

```typescript
import { p } from "@paradoc/sdk";
import { createFsResolver } from "@paradoc/resolvers/fs";

const resolver = createFsResolver({ root: "./templates" });

const form = p.form(formSchema, { resolver });

const result = await form
  .fill({
    fields: {
      /* ... */
    },
  })
  .render({
    layer: "pdf",
  });
```

### Using subpath imports

Import each adapter from its environment-specific entrypoint:

```typescript
import { createFsResolver } from "@paradoc/resolvers/fs";
import { createHttpResolver } from "@paradoc/resolvers/http";
import { createMemoryResolver } from "@paradoc/resolvers/memory";
```

### Memory resolver for testing

For testing and browser environments, use the memory entrypoint. Keys are matched exactly, and binary content (including a Node.js `Buffer`) is copied on input and output. Missing `contents`, or a value that is not a string or `Uint8Array`, throws `ERR_RESOLVER_INVALID_OPTIONS`:

```typescript
import { createMemoryResolver } from "@paradoc/resolvers/memory";

const resolver = createMemoryResolver({
  contents: {
    "/templates/form.md": "# {{fields.title}}",
    "/assets/logo.png": myLogoBytes,
  },
});
```

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK
- [`@paradoc/core`](../core) - Core framework behavior

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
