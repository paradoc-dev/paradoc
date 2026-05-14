import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const cliPath = path.resolve(__dirname, '../../src/index.ts')
const builtCliPath = path.resolve(__dirname, '../../dist/index.js')

/**
 * Spawn a command and resolve when the process exits.
 * Returns elapsed wall-clock time in milliseconds.
 */
function timeCommand(
  bin: string,
  args: string[],
): Promise<{ ms: number; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const start = performance.now()
    const child = spawn(bin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Command timed out'))
    }, 10_000)

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ms: performance.now() - start, exitCode: code ?? 0 })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
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
      const { ms, exitCode } = await timeCommand('tsx', [cliPath, '--version'])
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
      const { ms, exitCode } = await timeCommand('tsx', [cliPath, '--help'])
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

describe('CLI startup performance (built)', { timeout: 60_000 }, () => {
  const hasBuilt = existsSync(builtCliPath)

  it.skipIf(!hasBuilt)('--version starts quickly (built)', async () => {
    const times: number[] = []

    for (let i = 0; i < ITERATIONS; i++) {
      const { ms, exitCode } = await timeCommand('node', [
        builtCliPath,
        '--version',
      ])
      expect(exitCode).toBe(0)
      times.push(ms)
    }

    const s = stats(times)
    console.log(
      `built --version (${ITERATIONS} runs): min=${s.min.toFixed(0)}ms avg=${s.avg.toFixed(0)}ms p95=${s.p95.toFixed(0)}ms max=${s.max.toFixed(0)}ms`,
    )
    expect(s.p95).toBeLessThan(500)
  })

  it.skipIf(!hasBuilt)('--help starts quickly (built)', async () => {
    const times: number[] = []

    for (let i = 0; i < ITERATIONS; i++) {
      const { ms, exitCode } = await timeCommand('node', [
        builtCliPath,
        '--help',
      ])
      expect(exitCode).toBe(0)
      times.push(ms)
    }

    const s = stats(times)
    console.log(
      `built --help (${ITERATIONS} runs): min=${s.min.toFixed(0)}ms avg=${s.avg.toFixed(0)}ms p95=${s.p95.toFixed(0)}ms max=${s.max.toFixed(0)}ms`,
    )
    expect(s.p95).toBeLessThan(500)
  })
})
