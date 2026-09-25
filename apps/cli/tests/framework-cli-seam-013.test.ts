import { describe, it, expect, beforeAll } from 'vitest'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// framework-cli-seam-013: `add --output ts` names the exported const from the
// *artifact's own name* (`toCamelCase(artifactName)`, add.ts:308) — and `add`
// always writes the file as `${artifactName}.${ext}` (add.ts:172), so its
// filename and its artifact name are always identical. `generate --output ts`
// instead names the export from the *local file's basename*
// (`toCamelCase(baseFileName)`, generate.ts:106), which can differ from the
// artifact's own `name` field when a file was renamed or hand-authored.
// So the same artifact content, run through the two commands, can produce two
// different export identifiers: `w9` (what `add` would produce, since it
// would have written `w9.ts`) vs whatever `generate` derives from an
// arbitrarily-named source file such as `w9-2024.json`.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const builtCli = path.resolve(__dirname, '../dist/index.js')
const runRoot = '/private/tmp/claude-501/-Users-amuaddi-projects-paradoc-workspace/3c3d0125-1acb-434a-8ef8-4b49600f0eae/scratchpad/val-seam-c/runs/seam-013'

function runCli(args: string[], cwd: string, home: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [builtCli, ...args], {
      cwd,
      env: { ...process.env, HOME: home, DO_NOT_TRACK: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('timeout'))
    }, 20000)
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}

describe('framework-cli-seam-013 add and generate name TS exports from different sources', () => {
  it('generate derives the export name from the filename, not the artifact\'s own `name` (unlike add)', async () => {
    const dir = path.join(runRoot, 'dir-' + Date.now())
    const home = path.join(dir, 'home')
    await fs.mkdir(home, { recursive: true })

    // File is named "w9-2024.json" but the artifact's own name is "w9" —
    // exactly the mismatch add.ts:172 cannot produce (it always names the
    // file after artifactName), but generate.ts is fed arbitrary filenames.
    const artifact = {
      $schema: 'https://schema.paradoc.dev/2026-09-24.json',
      kind: 'form',
      name: 'w9',
      version: '1.0.0',
      title: 'W9',
      fields: { a: { type: 'text', label: 'A' } },
    }
    await fs.writeFile(path.join(dir, 'w9-2024.json'), JSON.stringify(artifact, null, 2))

    const result = await runCli(['generate', 'w9-2024.json', '--output', 'ts'], dir, home)
    expect(result.exitCode, result.stderr).toBe(0)

    const tsContent = await fs.readFile(path.join(dir, 'w9-2024.ts'), 'utf-8')

    // What `add --output ts` would export for this same artifact, since it
    // always writes `${artifactName}.ts` and exports `toCamelCase(artifactName)`.
    expect(tsContent).toMatch(/export const w9 =/)
  })
})
