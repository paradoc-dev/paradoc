import { runCli } from '../setup/spawn-cli'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PARADOC_SCHEMA_URL, SCHEMA_VERSION } from '@paradoc/schemas'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const notice = (schema?: string) =>
  `${schema ? `$schema: ${schema}\n` : ''}kind: document\nname: notice\nlayers:\n  text:\n    kind: inline\n    mimeType: text/plain\n    text: Notice\n`

function run(args: string[], cwd: string) {
  return runCli(args, { cwd, env: { PARADOC_TELEMETRY_DISABLED: '1', NO_COLOR: '1' } })
}

describe('CLI loading applies the schema version rules', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'paradoc-schema-version-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('validates and renders a current artifact', async () => {
    await writeFile(path.join(dir, 'notice.yaml'), notice(PARADOC_SCHEMA_URL))
    expect((await run(['validate', 'notice.yaml'], dir)).exitCode).toBe(0)
    const rendered = await run(['render', 'notice.yaml'], dir)
    expect(rendered.exitCode).toBe(0)
    expect(rendered.stdout).toContain('Notice')
  })

  it.each([
    ['an outdated', 'https://schema.paradoc.dev/2026-08-10.json', '2026-08-10'],
    ['a missing', undefined, 'no $schema'],
    ['an undated', 'https://schema.paradoc.dev/schema.json', 'names no schema version'],
  ])('refuses %s $schema and points to paradoc migrate', async (_label, schema, named) => {
    await writeFile(path.join(dir, 'notice.yaml'), notice(schema))
    for (const command of [['validate', 'notice.yaml'], ['render', 'notice.yaml']]) {
      const result = await run(command, dir)
      const output = result.stdout + result.stderr
      expect(result.exitCode).toBe(1)
      expect(output).toContain(named)
      expect(output).toContain(SCHEMA_VERSION)
      expect(output).toContain('paradoc migrate')
    }
  })

  it('loads an outdated artifact once it is migrated', async () => {
    await writeFile(path.join(dir, 'notice.yaml'), notice('https://schema.paradoc.dev/2026-08-10.json'))
    expect((await run(['migrate', 'notice.yaml'], dir)).exitCode).toBe(0)
    expect((await run(['validate', 'notice.yaml'], dir)).exitCode).toBe(0)
  })
})
