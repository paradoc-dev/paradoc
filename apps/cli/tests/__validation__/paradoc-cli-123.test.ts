import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'
import { runCli } from '../setup/spawn-cli.js'

const root = await mkdtemp(path.join(tmpdir(), 'paradoc-cli-123-'))
afterAll(() => rm(root, { recursive: true, force: true }))

describe('paradoc-cli-123: render and data validate share payload normalization', () => {
  it('rejects a misspelled structured payload key in both commands', async () => {
    await writeFile(path.join(root, 'form.json'), JSON.stringify({
      $schema: PARADOC_SCHEMA_URL, kind: 'form', name: 'form-123', version: '1.0.0', title: 'Form',
      fields: { a: { type: 'text', label: 'A' } },
      layers: { md: { kind: 'inline', mimeType: 'text/markdown', text: 'A is {{fields.a}}' } },
      defaultLayer: 'md',
    }))
    const payload = JSON.stringify({ fields: { a: 'x' }, partys: {} })
    const validate = await runCli(['data', 'validate', 'form.json', payload], { cwd: root })
    const render = await runCli(['render', 'form.json', '--data', payload, '--out', 'out.md'], { cwd: root })

    expect(validate.exitCode).toBe(1)
    expect(render.exitCode).toBe(1)
    expect(validate.stderr).toContain('Unknown top-level key "partys"')
    expect(render.stderr).toContain('Unknown top-level key "partys"')
  })
})
