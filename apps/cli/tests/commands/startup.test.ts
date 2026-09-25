import { runCli } from '../setup/spawn-cli'
import { beforeAll, describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cliPath = path.resolve(__dirname, '../../src/index.ts')
const builtCliPath = path.resolve(__dirname, '../../dist/index.js')
const packageVersion = (
  JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as { version: string }
).version

/**
 * Spawn a command and resolve when the process exits.
 * Returns elapsed wall-clock time in milliseconds and the captured output.
 */

async function runCommand(bin: string, args: string[]) {
  const start = performance.now()
  const target = bin === 'tsx' ? 'source' : 'dist'
  const cliArgs = args.slice(1)
  const result = await runCli(cliArgs, { target, timeout: 10000 })
  return { ...result, ms: performance.now() - start }
}

function p95(sorted: number[]): number {
  const idx = Math.ceil(sorted.length * 0.95) - 1
  return sorted[idx]!
}

function stats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b)
  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    p95: p95(sorted),
  }
}

const ITERATIONS = 10
const MAX_P95_MS = 5_000 // generous upper bound — regression guard, not a perf target

describe('CLI startup performance (tsx)', { timeout: 60_000 }, () => {
  it('--version starts quickly', async () => {
    const times: number[] = []

    for (let i = 0; i < ITERATIONS; i++) {
      const { ms, exitCode } = await runCommand('tsx', [cliPath, '--version'])
      expect(exitCode).toBe(0)
      times.push(ms)
    }

    const s = stats(times)
    console.log(
      `tsx --version (${ITERATIONS} runs): min=${s.min.toFixed(0)}ms avg=${s.avg.toFixed(0)}ms p95=${s.p95.toFixed(0)}ms max=${s.max.toFixed(0)}ms`,
    )
    expect(s.p95).toBeLessThan(MAX_P95_MS)
  })

  it('--help starts quickly', async () => {
    const times: number[] = []

    for (let i = 0; i < ITERATIONS; i++) {
      const { ms, exitCode } = await runCommand('tsx', [cliPath, '--help'])
      expect(exitCode).toBe(0)
      times.push(ms)
    }

    const s = stats(times)
    console.log(
      `tsx --help (${ITERATIONS} runs): min=${s.min.toFixed(0)}ms avg=${s.avg.toFixed(0)}ms p95=${s.p95.toFixed(0)}ms max=${s.max.toFixed(0)}ms`,
    )
    expect(s.p95).toBeLessThan(MAX_P95_MS)
  })
})

/**
 * Correctness of the built binary. Runs in the default suite: the package's
 * turbo.json makes `test` depend on `build`, so a missing dist fails loudly
 * instead of skipping.
 */
describe('CLI startup (built)', () => {
  beforeAll(() => {
    if (!existsSync(builtCliPath)) {
      throw new Error(
        `Built binary not found at ${builtCliPath}. Run 'pnpm build' first, or run this suite through ` +
          "'pnpm turbo run test --filter=@paradoc/cli', which builds before testing.",
      )
    }
  })

  it('--version prints the package version and exits 0', async () => {
    const { exitCode, stdout } = await runCommand('node', [builtCliPath, '--version'])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe(packageVersion)
  })

  it('--help prints usage and exits 0', async () => {
    const { exitCode, stdout } = await runCommand('node', [builtCliPath, '--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Paradoc CLI')
  })

  it('an unknown command exits non-zero', async () => {
    const { exitCode, stderr } = await runCommand('node', [builtCliPath, 'not-a-command'])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain("unknown command 'not-a-command'")
  })
})

/**
 * Wall-clock startup budget for the built binary. Opt-in only: the 500ms p95
 * target holds on an idle machine but not inside a loaded parallel run, where
 * CPU contention inflates spawn and boot time. Run it with `pnpm test:perf`
 * (sets PARADOC_PERF_TESTS=1) on a quiet machine.
 */
describe.runIf(process.env.PARADOC_PERF_TESTS === '1')(
  'CLI startup performance (built)',
  { timeout: 60_000 },
  () => {
    const BUILT_MAX_P95_MS = 500

    beforeAll(() => {
      if (!existsSync(builtCliPath)) {
        throw new Error(`Built binary not found at ${builtCliPath}. Run 'pnpm build' first.`)
      }
    })

    it('--version starts quickly (built)', async () => {
      const times: number[] = []

      for (let i = 0; i < ITERATIONS; i++) {
        const { ms, exitCode } = await runCommand('node', [builtCliPath, '--version'])
        expect(exitCode).toBe(0)
        times.push(ms)
      }

      const s = stats(times)
      console.log(
        `built --version (${ITERATIONS} runs): min=${s.min.toFixed(0)}ms avg=${s.avg.toFixed(0)}ms p95=${s.p95.toFixed(0)}ms max=${s.max.toFixed(0)}ms`,
      )
      expect(s.p95).toBeLessThan(BUILT_MAX_P95_MS)
    })

    it('--help starts quickly (built)', async () => {
      const times: number[] = []

      for (let i = 0; i < ITERATIONS; i++) {
        const { ms, exitCode } = await runCommand('node', [builtCliPath, '--help'])
        expect(exitCode).toBe(0)
        times.push(ms)
      }

      const s = stats(times)
      console.log(
        `built --help (${ITERATIONS} runs): min=${s.min.toFixed(0)}ms avg=${s.avg.toFixed(0)}ms p95=${s.p95.toFixed(0)}ms max=${s.max.toFixed(0)}ms`,
      )
      expect(s.p95).toBeLessThan(BUILT_MAX_P95_MS)
    })
  },
)
