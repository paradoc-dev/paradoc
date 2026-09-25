import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export type CliTarget = 'source' | 'dist' | 'shim'

export interface CliRunOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  timeout?: number
  input?: string
  stdin?: string
  target?: CliTarget
  built?: boolean
}

export interface CliResult {
  stdout: string
  stderr: string
  exitCode: number
}

export function runCli(args: string[], options: CliRunOptions = {}): Promise<CliResult> {
  const target = options.target ?? (options.built ? 'dist' : 'source')
  const entry = target === 'source'
    ? path.join(packageRoot, 'src/index.ts')
    : target === 'dist'
      ? path.join(packageRoot, 'dist/index.js')
      : path.resolve(packageRoot, '../paradoc-cli/bin.js')
  const executable = target === 'source' ? 'tsx' : process.execPath
  const input = options.input ?? options.stdin

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [entry, ...args], {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdin.end(input)

    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = options.timeout ?? 60_000
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error(`Command timed out after ${timeout}ms`))
    }, timeout)

    child.stdout.on('data', (chunk: string) => { stdout += chunk })
    child.stderr.on('data', (chunk: string) => { stderr += chunk })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })
  })
}
