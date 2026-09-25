import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.resolve(__dirname, '../dist/index.js')
const scratch =
  '/private/tmp/claude-501/-Users-amuaddi-projects-paradoc-workspace/3c3d0125-1acb-434a-8ef8-4b49600f0eae/scratchpad/val-lowb'

function tempDir(name: string): string {
  const dir = path.join(scratch, 'runs', `${name}-${process.pid}-${Math.random().toString(36).slice(2)}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function run(args: string[], cwd: string) {
  const r = spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: path.join(scratch, 'home'), DO_NOT_TRACK: '1', CI: '1' },
    timeout: 30000,
  })
  return { stdout: r.stdout, stderr: r.stderr, exitCode: r.status ?? -1 }
}

// Correct behavior: `init --dry-run` in a directory that already has a
// paradoc.json should preview the SAME refusal a real run would give, not a
// success preview.
describe('paradoc-cli-219: init --dry-run previews the existing-project refusal', () => {
  const dir = tempDir('219')
  fs.writeFileSync(path.join(dir, 'paradoc.json'), '{}')

  it('a real run refuses (baseline)', () => {
    const r = run(['init', '--yes', '--name', 'Dupe'], dir)
    expect(r.exitCode).toBe(1)
    expect(r.stdout + r.stderr).toContain('already exists')
  })

  it('--dry-run previews the refusal instead of a success preview', () => {
    const r = run(['init', '--dry-run', '--yes', '--name', 'Dupe'], dir)
    const out = r.stdout + r.stderr
    // This is what SHOULD happen: dry-run tells the user it would refuse.
    expect(out).toContain('already exists')
  })
})
