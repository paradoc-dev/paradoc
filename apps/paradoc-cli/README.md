# paradoc-cli

The documented install of the Paradoc CLI. It runs [`@paradoc/cli`](https://www.npmjs.com/package/@paradoc/cli) and gives you the `paradoc` command.

## Install

Requires Node.js 22 or newer.

```bash
npm install -g paradoc-cli
# or, without installing:
npx paradoc-cli
```

`@paradoc/cli` is an alternative with the same version and behavior. Install one of them, not both. Each registers the `paradoc` command, so a second global install fails with `EEXIST`.

## Documentation

Full CLI reference, configuration, and command list: [paradoc.dev/docs/cli](https://paradoc.dev/docs/cli).

For programmatic use of the framework, install [`@paradoc/sdk`](https://www.npmjs.com/package/@paradoc/sdk) directly.

## License

MIT
