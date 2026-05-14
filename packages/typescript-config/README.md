<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=typescript_config" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/typescript-config</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=typescript_config)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=typescript_config) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Shared TypeScript configuration used across Paradoc framework packages.

## Usage

Extend this configuration in your package's `tsconfig.json`:

```json
{
  "extends": "@paradoc/typescript-config/base.json"
}
```

For React packages, use `react-library.json` instead.

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/typescript-config/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK
- [`@paradoc/eslint-config`](../eslint-config) - Shared ESLint configuration

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
