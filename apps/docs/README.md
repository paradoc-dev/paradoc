# @paradoc/docs

The public Paradoc framework documentation at [docs.paradoc.dev](https://docs.paradoc.dev). It uses Fumadocs, TanStack Start, Tailwind CSS, Vite, and a Cloudflare Worker.

## Development

From this directory:

```bash
pnpm dev          # sync generated content, then start on port 3001
pnpm build        # sync generated content, then make the Worker build
pnpm check        # lint and type-check
pnpm test         # run the docs and snippet tests
pnpm preview      # serve the production build locally
```

Pages live in `content/docs/`. `PARADOC_DOCS_PLATFORM_API=true` includes the gated Platform API guide; it is excluded by default and from the public production build.

## Generated content

`predev`, `prebuild`, `precheck-types`, and `pretest` run `pnpm sync`. The sync writes two ignored inputs:

- `sync:changelog` converts `paradoc/CHANGELOG.md` to the changelog page.
- `sync:component-docs` reads the component examples and `public/r/*.json` into `src/generated/component-docs-content.ts`.

Refresh `public/r/*.json` first with `pnpm --filter @paradoc/components registry:build` when component registry content changes. `pnpm changelog:draft` previews public framework commits for the next changelog entry.

## Operations

`pnpm health` checks the deployed Worker's `/api/health` response. `pnpm cf-typegen` refreshes Cloudflare binding types. `pnpm deploy:prod` builds with gated Platform API docs disabled and deploys through Wrangler; run it only through the authorized release workflow.

The public package is MIT licensed. See [LICENSE](../../LICENSE), [CONTRIBUTING.md](../../CONTRIBUTING.md), and [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).
