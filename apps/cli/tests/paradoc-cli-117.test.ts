import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.resolve(__dirname, '../dist/index.js')
const scratch = '/private/tmp/claude-501/-Users-amuaddi-projects-paradoc-workspace/3c3d0125-1acb-434a-8ef8-4b49600f0eae/scratchpad/val-p2a'

function tempDir(name: string): string {
  const dir = path.join(scratch, 'runs', `${name}-${process.pid}-${Math.random().toString(36).slice(2)}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function run(args: string[], cwd: string, input?: string) {
  const r = spawnSync('node', [cliPath, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    env: { ...process.env, HOME: path.join(scratch, 'home'), DO_NOT_TRACK: '1', PARADOC_TELEMETRY_DISABLED: '1', CI: '1' },
    timeout: 60000,
  })
  return { stdout: r.stdout, stderr: r.stderr, exitCode: r.status ?? -1 }
}

const SCHEMA = 'https://schema.paradoc.dev/2026-09-24.json'

const artifact = { $schema: SCHEMA, kind: 'form', name: 'nec', title: 'NEC', version: '1.0.0', fields: {} }

describe('paradoc-cli-117: generate prints the real export name', () => {
  it('--output ts: the printed import names the export the module has', () => {
    const dir = tempDir('117ts')
    const file = path.join(dir, '1099-nec.json')
    fs.writeFileSync(file, JSON.stringify(artifact, null, 2))
    const r = run(['generate', file, '--output', 'ts'], dir)
    expect(r.exitCode).toBe(0)
    const mod = fs.readFileSync(path.join(dir, '1099-nec.ts'), 'utf8')
    const exported = /export const (\w+)/.exec(mod)![1]
    expect(r.stdout).toContain(`import { ${exported} } from './1099-nec.js'`)
  })
  it('typed: the printed const is a valid identifier', () => {
    const dir = tempDir('117typed')
    const file = path.join(dir, '1099-nec.json')
    fs.writeFileSync(file, JSON.stringify(artifact, null, 2))
    const r = run(['generate', file], dir)
    expect(r.exitCode).toBe(0)
    const m = /const (\S+) = p\.form\(schema\)/.exec(r.stdout)
    expect(m?.[1]).toMatch(/^[A-Za-z_$][\w$]*$/)
  })
  it('an upper-case extension is stripped from the output name', () => {
    const dir = tempDir('117ext')
    const file = path.join(dir, 'form.JSON')
    fs.writeFileSync(file, JSON.stringify(artifact, null, 2))
    const r = run(['generate', file, '--output', 'ts'], dir)
    expect(r.exitCode).toBe(0)
    expect(fs.readdirSync(dir).sort()).toEqual(['form.JSON', 'form.ts'])
  })
})
