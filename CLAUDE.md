# Paradoc

A "documents as code" framework: type-safe builders, multi-format renderers, and a registry-first CLI.

## Repo Map

Three git repos. Root is public; platform and incubator are private submodules.

| Area          | Location     | What's there                                                               |
| ------------- | ------------ | -------------------------------------------------------------------------- |
| Core packages | `packages/`  | schemas, types, core, renderers, serialization, sdk, resolvers, essentials |
| CLI           | `apps/cli/`  | `para` binary — artifact manager                                           |
| Docs site     | `apps/docs/` | Fumadocs + Vite, deployed to Cloudflare                                    |
| Platform      | `platform/`  | Backend services, DB, billing, auth, APIs (private)                        |
| Incubator     | `incubator/` | Studio, playground, demo (private)                                         |
| Artifacts     | `artifacts/` | Example form definitions (tax, healthcare, credit)                         |
| Internal      | `internal/`  | Internal apps                                                              |

## Critical Guardrails

- Never `git pull` or `git push` without explicit user approval
- Never `git stash` without explicit permission
- Never deploy (vercel, wrangler, fly) without explicit permission
- Never use `eslint-disable` or similar without explicit permission

## Quick Rules

- **Dependencies:** Check `pnpm-workspace.yaml` catalog before adding
- **Zod v4:** `z.email()` and `z.url()` are top-level (not `z.string().email()`)
- **Icons:** Always use `Icon` suffix (`ArrowUpIcon` not `ArrowUp`)
- **Button text:** Sentence case ("New comment" not "New Comment")
- **Package verification:** See `platform/_docs/procedures/package-verification.md`
- **Build chain:** After renderer changes: core → renderer-pdf → renderers → sdk → cli
