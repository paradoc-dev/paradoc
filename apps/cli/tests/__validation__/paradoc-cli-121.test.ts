import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'
import { runCli } from '../setup/spawn-cli.js'

const root = await mkdtemp(path.join(tmpdir(), 'paradoc-cli-121-'))
afterAll(() => rm(root, { recursive: true, force: true }))

describe('paradoc-cli-121: payload YAML has no artifact schema modeline', () => {
  it('omits the modeline from template and fill output', async () => {
    await writeFile(path.join(root, 'form.json'), JSON.stringify({
      $schema: PARADOC_SCHEMA_URL, kind: 'form', name: 'form-121', version: '1.0.0', title: 'Form',
      fields: { a: { type: 'text', label: 'A' } },
    }))
    expect((await runCli(['data', 'template', 'form.json', '--out', 'template.yaml'], { cwd: root })).exitCode).toBe(0)
    expect((await runCli(['data', 'fill', 'form.json', '--data', '{"a":"x"}', '--out', 'filled.yaml'], { cwd: root })).exitCode).toBe(0)
    expect(await readFile(path.join(root, 'template.yaml'), 'utf8')).not.toContain('yaml-language-server')
    expect(await readFile(path.join(root, 'filled.yaml'), 'utf8')).not.toContain('yaml-language-server')
  })
})
