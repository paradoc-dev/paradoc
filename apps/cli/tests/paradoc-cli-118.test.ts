import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { runCli, tmpDir, SCHEMA } from './p2b-helpers'

describe('paradoc-cli-118: generate on YAML must not silently overwrite a sibling .json', () => {
  it('leaves an existing, different form.json alone (or refuses)', async () => {
    const dir = await tmpDir('118-')
    const yaml = `$schema: ${SCHEMA}\nkind: form\nname: gen-118\nversion: 1.0.0\ntitle: Gen\nfields:\n  a:\n    type: text\n    label: A\n`
    const userJson = '{ "hand": "written", "keep": true }\n'
    await fs.writeFile(path.join(dir, 'form.yaml'), yaml)
    await fs.writeFile(path.join(dir, 'form.json'), userJson)

    const result = await runCli(['generate', 'form.yaml'], { cwd: dir })
    const after = await fs.readFile(path.join(dir, 'form.json'), 'utf8')

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('already exists with different content')
    expect(after).toBe(userJson)
  }, 60000)
})
