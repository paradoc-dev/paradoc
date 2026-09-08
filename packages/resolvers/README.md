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
policy failures use `ERR_RESOLVER_OUTSIDE_ROOT` or `ERR_RESOLVER_INVALID_PATH`.
The root is checked on the first read, so a missing root rejects that read with
Node.js's native `ENOENT` error.

Artifact paths use forward slashes on every supported host, including Windows.
Containment assumes the filesystem tree is stable during a read; this resolver
is not a race-proof sandbox for a concurrently hostile filesystem.

### With form rendering

Bind a resolver once, when a form with file-based layers is constructed.
Every instance you derive from it afterward — every `fill`, every render —
carries the same resolver:

```typescript
import { para } from "@paradoc/sdk";
import { createFsResolver } from "@paradoc/resolvers/fs";

const resolver = createFsResolver({ root: "./templates" });

const form = para.form(formSchema, { resolver });

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
```

### Memory resolver for testing

For testing and browser environments, use the memory entrypoint. Keys are matched exactly, and binary content is copied on input and output:

```typescript
import { createMemoryResolver } from "@paradoc/resolvers/memory";

const resolver = createMemoryResolver({
  contents: {
    "/templates/form.md": "# {{title}}",
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
