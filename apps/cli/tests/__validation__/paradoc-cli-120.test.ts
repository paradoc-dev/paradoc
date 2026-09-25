import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'
import { runCli } from '../setup/spawn-cli.js'

const root = await mkdtemp(path.join(tmpdir(), 'paradoc-cli-120-'))
afterAll(() => rm(root, { recursive: true, force: true }))

describe('paradoc-cli-120: interactive fill preserves value types', () => {
  it('writes typed defaults and validates before writing', async () => {
    await writeFile(path.join(root, 'form.json'), JSON.stringify({
      $schema: PARADOC_SCHEMA_URL, kind: 'form', name: 'fill-120', version: '1.0.0', title: 'Fill',
      fields: {
        who: { type: 'person', label: 'Who' },
        count: { type: 'number', label: 'Count' },
        pct: { type: 'percentage', label: 'Pct' },
      },
    }))
    const result = await runCli(['data', 'fill', 'form.json', '--out', 'out.json'], {
      cwd: root, input: ['\r', '\r', '\r', '\r'],
    })
    expect(result, result.stdout + result.stderr).toMatchObject({ exitCode: 0 })
    const output = JSON.parse(await readFile(path.join(root, 'out.json'), 'utf8'))
    expect(output.fields).not.toHaveProperty('who')
    expect(output.fields).not.toHaveProperty('count')
    expect(output.fields).not.toHaveProperty('pct')
    expect((await runCli(['data', 'validate', 'form.json', 'out.json'], { cwd: root })).exitCode).toBe(0)
  }, 30_000)
})
