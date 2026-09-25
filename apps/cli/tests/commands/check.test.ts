import { runCli as executeCliCommand } from '../setup/spawn-cli'
import { describe, it, expect, beforeAll } from 'vitest'
import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = path.resolve(__dirname, '../fixtures/check')

interface CliResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Spawns `paradoc` under `tsx` (the same way the CLI's own dev script and its
 * other command tests do) and waits for the process to fully close before
 * resolving, so `stdout`/`stderr` are read to completion rather than
 * snapshotted mid-flight. Encoding is set explicitly on both streams so a
 * multi-chunk write cannot be read back split across a UTF-8 boundary.
 */

/**
 * Copies one fixture composition + artifact pair into an isolated directory
 * of their own, so a project-wide search scoped to it cannot collide with
 * another test's fixtures running concurrently.
 *
 * Created under `fixturesDir` rather than the system temp directory: `tsx`
 * resolves each file's JSX settings from the nearest `tsconfig.json` above
 * it, which is this package's own (declaring `jsx: "react-jsx"`) only for a
 * path still inside this tree. The prefix is not dot-led: a dot-directory
 * broke that resolution outright (`tsx` reported `React is not defined`,
 * meaning it fell back to a JSX transform with no automatic runtime),
 * so a plain name is what actually keeps the fixture inside the project
 * `tsx` can see.
 */
async function isolatedFixture(...names: string[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(fixturesDir, 'check-tmp-'))
  for (const name of names) {
    await fs.copyFile(path.join(fixturesDir, name), path.join(dir, name))
  }
  return dir
}

describe('CLI check command', () => {
  it('passes a clean composition, resolved from its artifact', async () => {
    const result = await executeCliCommand([
      'check',
      path.join(fixturesDir, 'clean-artifact.json'),
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('No unsupported classes, unresolved paths, or missing images')
  }, 30000)

  it('finds the artifact when given the composition file directly', async () => {
    // Isolated from the shared fixtures directory and from every other test
    // here: a project-wide search runs in this directory, scoped by cwd, and
    // sharing a directory across concurrently spawned processes is exactly
    // the kind of shared-path race this test must not risk.
    const dir = await isolatedFixture('clean-artifact.json', 'clean-composition.tsx')
    try {
      const result = await executeCliCommand(['check', 'clean-composition.tsx'], { cwd: dir })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No unsupported classes, unresolved paths, or missing images')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  }, 30000)

  it('fails naming an unsupported class', async () => {
    const result = await executeCliCommand([
      'check',
      path.join(fixturesDir, 'unsupported-class-artifact.json'),
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('Unsupported classes')
    expect(result.stdout).toContain('grid-cols-3')
  }, 30000)

  it('fails naming an unresolved field path', async () => {
    const result = await executeCliCommand([
      'check',
      path.join(fixturesDir, 'unresolved-path-artifact.json'),
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('Unresolved field paths')
    expect(result.stdout).toContain('doesNotExist')
  }, 30000)

  it('fails naming a missing image and exits non-zero, even alone', async () => {
    const result = await executeCliCommand([
      'check',
      path.join(fixturesDir, 'remote-image-artifact.json'),
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('Images with no embedded bytes')
    expect(result.stdout).toContain('https://example.com/logo.png')
  }, 30000)

  it('accepts explicit --data, overriding the composition sample', async () => {
    const result = await executeCliCommand([
      'check',
      path.join(fixturesDir, 'clean-artifact.json'),
      '--data',
      JSON.stringify({ fields: { name: 'Grace Hopper' } }),
    ])

    expect(result.exitCode).toBe(0)
  }, 30000)

  it('discovers sample data from a sibling *.sample.ts file', async () => {
    // The composition itself exports no `sample`; only the sibling
    // `sample-sibling-composition.sample.ts` file does. Its one row names a
    // list item field the artifact does not declare, so the unresolved path
    // is reachable only when a row actually exists — which happens only if
    // the sibling file's data was discovered and used. Without it the table
    // has no rows to walk and the check would report nothing at all, so this
    // failure is the proof, not an incidental side effect.
    const result = await executeCliCommand([
      'check',
      path.join(fixturesDir, 'sample-sibling-artifact.json'),
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('Unresolved field paths')
    expect(result.stdout).toContain('lineItems.0.doesNotExist')
  }, 30000)

  it('fails clearly on an artifact with no React layer', async () => {
    const result = await executeCliCommand(['check', path.join(fixturesDir, 'missing-layer.json')])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('declares no React layer')
  }, 30000)

  it('fails clearly when the target file does not exist', async () => {
    const result = await executeCliCommand(['check', path.join(fixturesDir, 'does-not-exist.json')])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('File not found')
  }, 30000)

  it('checks cleanly when a Totals def has no sample data to format', async () => {
    // `total` evaluates to `{ amount: null, currency: null }` with no data at
    // all, which the money serializer rejects — but a value with no data
    // anywhere in it is what running with no sample data looks like, not a
    // fault, so this must pass rather than throw or report `defs.total`.
    const result = await executeCliCommand([
      'check',
      path.join(fixturesDir, 'totals-no-data-artifact.json'),
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('No unsupported classes, unresolved paths, or missing images')
  }, 30000)

  it('reports a Totals def whose real sample data a serializer rejects', async () => {
    // `amount` carries an actual value here, just not one the money
    // serializer accepts, so unlike the no-data case above this is a real
    // fault and must be reported rather than swallowed as blank.
    const result = await executeCliCommand([
      'check',
      path.join(fixturesDir, 'totals-bad-data-artifact.json'),
    ])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('Unresolved field paths')
    expect(result.stdout).toContain('defs.total')
  }, 30000)
})

/**
 * `paradoc check` holds its artifact to the current schema version on every
 * target shape, as `paradoc dev` does: the artifact file itself, a composition
 * an artifact's layer points at, and a composition paired with a sibling
 * artifact of the same name.
 */
describe('CLI check command applies the schema version rule', () => {
  const OUTDATED = 'https://schema.paradoc.dev/2026-08-10.json'

  /** The clean fixture pair, with the artifact rewritten under `artifactName`. */
  async function fixtureWith(
    artifactName: string,
    change: (artifact: Record<string, any>) => void
  ): Promise<string> {
    const dir = await isolatedFixture('clean-composition.tsx')
    const artifact = JSON.parse(await fs.readFile(path.join(fixturesDir, 'clean-artifact.json'), 'utf-8'))
    change(artifact)
    await fs.writeFile(path.join(dir, artifactName), JSON.stringify(artifact, null, 2))
    return dir
  }

  const outdated = (artifact: Record<string, any>) => {
    artifact.$schema = OUTDATED
  }
  const siblingOnly = (artifact: Record<string, any>) => {
    delete artifact.layers
  }

  const shapes = [
    ['an artifact target', 'intake.json', 'intake.json'],
    ['a composition matched by layer path', 'intake.json', 'clean-composition.tsx'],
    ['a sibling-matched composition', 'clean-composition.json', 'clean-composition.tsx'],
  ] as const

  it.each(shapes)('%s with an outdated $schema exits 1 and points to paradoc migrate', async (label, artifactName, target) => {
    const dir = await fixtureWith(artifactName, (artifact) => {
      outdated(artifact)
      if (label === 'a sibling-matched composition') siblingOnly(artifact)
    })
    try {
      const result = await executeCliCommand(['check', target], { cwd: dir })
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('2026-08-10')
      expect(result.stderr).toContain('paradoc migrate')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  }, 30000)

  it.each(shapes)('%s with the current $schema passes', async (label, artifactName, target) => {
    const dir = await fixtureWith(artifactName, (artifact) => {
      if (label === 'a sibling-matched composition') siblingOnly(artifact)
    })
    try {
      const result = await executeCliCommand(['check', target], { cwd: dir })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No unsupported classes, unresolved paths, or missing images')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  }, 30000)

  it('a sibling-matched composition whose artifact has no $schema exits 1', async () => {
    const dir = await fixtureWith('clean-composition.json', (artifact) => {
      delete artifact.$schema
      siblingOnly(artifact)
    })
    try {
      const result = await executeCliCommand(['check', 'clean-composition.tsx'], { cwd: dir })
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('no $schema')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  }, 30000)
})

describe('CLI check command (built binary)', () => {
  const builtCliPath = path.resolve(__dirname, '../../dist/index.js')

  // Fail loudly rather than skip silently: the package's own turbo.json
  // makes `test` depend on `build`, so the built binary is expected to exist
  // whenever this suite runs through the task graph. A missing dist here
  // means that dependency broke, or the suite ran outside it (a bare
  // `vitest run` with no prior build) — either way, a skipped test would
  // hide exactly the regression this describe block exists to catch.
  beforeAll(() => {
    if (!existsSync(builtCliPath)) {
      throw new Error(
        `Built binary not found at ${builtCliPath}. Run 'pnpm build' first, or run this suite through ` +
          "'pnpm turbo run test --filter=@paradoc/cli', which builds before testing."
      )
    }
  })

  async function executeBuiltCommand(args: string[], options?: { cwd?: string }): Promise<CliResult> {
    return executeCliCommand(args, { ...options, target: 'dist' })
  }

  it(
    'checks a .tsx composition from the built binary with no loader flags',
    async () => {
      const result = await executeBuiltCommand(['check', path.join(fixturesDir, 'clean-artifact.json')])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No unsupported classes, unresolved paths, or missing images')
    },
    30000
  )

  it(
    'checks a Totals def with no sample data cleanly from the built binary',
    async () => {
      const result = await executeBuiltCommand(['check', path.join(fixturesDir, 'totals-no-data-artifact.json')])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No unsupported classes, unresolved paths, or missing images')
    },
    30000
  )

  it(
    'ignores an unrelated tsconfig at cwd when the composition has none of its own',
    async () => {
      // The composition and its artifact are copied into an isolated
      // directory with no tsconfig.json anywhere above it (unlike every
      // fixture above, which lives under this package's own tsconfig
      // declaring `jsx: "react-jsx"`). `cwd` for the process, though, is a
      // *different* directory that does declare one with the same setting —
      // the exact shape of the leak this guards against: a tsconfig that
      // happens to govern wherever the shell is sitting, not the
      // composition's own project. If `ensureTsLoader` ever fell back to
      // `register()`'s own cwd-based discovery again, this misleading
      // config would make the transform depend on the caller's cwd instead
      // of the composition's location, and the two runs below would answer
      // differently depending only on where the process happened to start.
      const isolatedDir = await fs.mkdtemp(path.join(tmpdir(), 'paradoc-check-no-tsconfig-'))
      const misleadingCwd = await fs.mkdtemp(path.join(tmpdir(), 'paradoc-check-misleading-cwd-'))
      try {
        await fs.copyFile(
          path.join(fixturesDir, 'clean-artifact.json'),
          path.join(isolatedDir, 'clean-artifact.json')
        )
        await fs.copyFile(
          path.join(fixturesDir, 'clean-composition.tsx'),
          path.join(isolatedDir, 'clean-composition.tsx')
        )
        await fs.writeFile(
          path.join(misleadingCwd, 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { jsx: 'react-jsx' } }, null, 2)
        )

        const fromIsolatedCwd = await executeBuiltCommand(
          ['check', path.join(isolatedDir, 'clean-artifact.json')],
          { cwd: isolatedDir }
        )
        const fromMisleadingCwd = await executeBuiltCommand(
          ['check', path.join(isolatedDir, 'clean-artifact.json')],
          { cwd: misleadingCwd }
        )

        // Neither directory near the composition declares a tsconfig, so
        // both runs must resolve `tsconfig: false` and answer identically
        // regardless of which directory the process was started from — the
        // misleading cwd's `react-jsx` setting must have no effect at all.
        expect(fromMisleadingCwd.exitCode).toBe(fromIsolatedCwd.exitCode)
        expect(fromMisleadingCwd.stdout).toBe(fromIsolatedCwd.stdout)
      } finally {
        await fs.rm(isolatedDir, { recursive: true, force: true })
        await fs.rm(misleadingCwd, { recursive: true, force: true })
      }
    },
    30000
  )
})
