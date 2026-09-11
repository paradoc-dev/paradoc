/**
 * Registers a TypeScript/JSX-aware ESM loader for this process, on demand.
 *
 * The built `paradoc` binary is plain compiled JavaScript with no TypeScript
 * loader of its own, so importing a `.tsx`/`.jsx` module directly — binding
 * a composition's React layer, in `check.ts` today — fails with "Unknown
 * file extension". `tsx` exposes exactly this as a programmatic API:
 * `register()` installs Node's module hooks for the rest of the process, the
 * same hooks the `tsx` CLI installs for itself, so a plain dynamic
 * `import()` anywhere afterward — including one inside `@paradoc/react`'s
 * own `bindComponent` — transforms a `.tsx`/`.jsx` file instead of failing
 * on its extension.
 *
 * The import is lazy — nothing here loads `tsx` until a command actually
 * binds a React layer — but the package itself is a real, non-optional
 * dependency of `@paradoc/cli`, not an on-demand install: `tsx` wraps
 * esbuild, which adds roughly 10 MB to every `paradoc` install whether or not
 * a project ever composes in React. That is the honest trade-off; it is not
 * hidden behind the renderer manager's on-demand-install path the way
 * `@paradoc/react` itself is.
 *
 * **The tsconfig has to be resolved explicitly.** Left to its own defaults,
 * `register()` resolves one from `process.cwd()`, which is wherever the
 * shell that ran `paradoc` happens to be sitting rather than the composition's
 * own project — a composition checked from outside its project directory
 * would then transform under whatever `jsx` setting an unrelated tsconfig
 * that happens to govern the caller's cwd declares (or the classic
 * transform, with none at all), which fails at render with "React is not
 * defined" for a tree written against the automatic runtime. So this walks
 * up from the composition's own directory for its nearest `tsconfig.json`
 * and hands `register()` that path directly — and when none exists, passes
 * `tsconfig: false` explicitly rather than leaving the option unset, which
 * is what would let `register()` fall back to its own cwd-based search and
 * reintroduce exactly this leak.
 *
 * Registered once and cached: calling this more than once in a process is a
 * no-op, and a command that never binds a React layer never pays for it.
 */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Walks up from `fromDir` for the nearest `tsconfig.json`, or `undefined` past the filesystem root. */
function findNearestTsconfig(fromDir: string): string | undefined {
  let dir = fromDir
  for (;;) {
    const candidate = join(dir, 'tsconfig.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

let registered = false

/** `fromDir` is where tsconfig discovery starts — the composition's own directory. */
export async function ensureTsLoader(fromDir: string): Promise<void> {
  if (registered) return
  const { register } = await import('tsx/esm/api')
  const tsconfig = findNearestTsconfig(fromDir)
  register({ tsconfig: tsconfig ?? false })
  registered = true
}
