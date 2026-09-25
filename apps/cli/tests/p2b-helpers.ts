import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const cliRoot = path.resolve(here, '..')
export const scratch =
  '/private/tmp/claude-501/-Users-amuaddi-projects-paradoc-workspace/3c3d0125-1acb-434a-8ef8-4b49600f0eae/scratchpad/val-p2b'
export const SCHEMA = 'https://schema.paradoc.dev/2026-09-24.json'

export interface CliResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Runs the CLI. `mode: 'dist'` spawns the built `dist/index.js`; `mode: 'tsx'`
 * runs `src/index.ts` under tsx (needed for `check`, which imports .tsx).
 * `input` chunks are written to stdin one by one with a delay.
 */
export function runCli(
  args: string[],
  opts: { cwd?: string; mode?: 'dist' | 'tsx'; input?: string[]; timeout?: number } = {}
): Promise<CliResult> {
  const mode = opts.mode ?? 'dist'
  const cmd = mode === 'dist' ? process.execPath : path.join(cliRoot, 'node_modules/.bin/tsx')
  const entry = mode === 'dist' ? path.join(cliRoot, 'dist/index.js') : path.join(cliRoot, 'src/index.ts')
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [entry, ...args], {
      cwd: opts.cwd ?? scratch,
      env: { ...process.env, HOME: path.join(scratch, 'home'), DO_NOT_TRACK: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (c: string) => (stdout += c))
    child.stderr.on('data', (c: string) => (stderr += c))
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`timeout; stdout=${stdout} stderr=${stderr}`))
    }, opts.timeout ?? 60000)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })
    child.on('error', reject)
    if (opts.input) {
      let i = 0
      const send = () => {
        if (i >= opts.input!.length) {
          child.stdin.end()
          return
        }
        child.stdin.write(opts.input![i++]!)
        setTimeout(send, 400)
      }
      setTimeout(send, 1500)
    } else {
      child.stdin.end()
    }
  })
}

export async function tmpDir(prefix: string, base: string = scratch): Promise<string> {
  await fs.mkdir(base, { recursive: true })
  return fs.mkdtemp(path.join(base, prefix))
}
