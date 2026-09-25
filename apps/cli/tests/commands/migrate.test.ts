import { runCli } from '../setup/spawn-cli'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PARADOC_SCHEMA_URL, SCHEMA_VERSION } from '@paradoc/schemas'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PREVIOUS = 'https://schema.paradoc.dev/2026-08-10.json'

const signedForm = (schema: string | undefined) =>
  JSON.stringify(
    {
      ...(schema ? { $schema: schema } : {}),
      kind: 'form',
      name: 'pet-addendum',
      parties: { tenant: { label: 'Tenant' } },
      fields: { petName: { type: 'text' } },
      layers: {
        markdown: {
          kind: 'inline',
          mimeType: 'text/markdown',
          text: 'Pet: {{fields.petName}} Tenant: {{signature(parties.tenant, "tenant")}}',
          signatures: { tenant: { party: { role: 'tenant' }, type: 'signature', placement: 'auto' } },
        },
      },
    },
    null,
    2,
  ) + '\n'

const signedYaml = `# Pet addendum
$schema: ${PREVIOUS}
kind: form
name: pet-addendum
parties:
  tenant:
    label: Tenant
layers:
  markdown:
    kind: inline
    mimeType: text/markdown
    text: 'Pet {{signature(parties.tenant, "tenant")}}'
    signatures:
      tenant:
        party:
          role: tenant
        type: signature
        placement: auto
`

function run(args: string[], cwd: string) {
  return runCli(args, { cwd, env: { PARADOC_TELEMETRY_DISABLED: '1', NO_COLOR: '1' } })
}

describe('paradoc migrate', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'paradoc-migrate-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('migrates one JSON file in place', async () => {
    const file = path.join(dir, 'pet.json')
    await writeFile(file, signedForm(PREVIOUS))

    const result = await run(['migrate', 'pet.json'], dir)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`migrated  pet.json  2026-08-10 → ${SCHEMA_VERSION}`)
    const written = JSON.parse(await readFile(file, 'utf-8'))
    expect(written.$schema).toBe(PARADOC_SCHEMA_URL)
    expect(written.layers.markdown.signatures.tenant.placement).toBe('flow')
  })

  it('migrates a directory, keeps YAML as YAML, and reports every file', async () => {
    await mkdir(path.join(dir, 'forms'))
    await writeFile(path.join(dir, 'forms', 'pet.yaml'), signedYaml)
    await writeFile(path.join(dir, 'current.json'), JSON.stringify({ $schema: PARADOC_SCHEMA_URL, kind: 'document', name: 'notice' }))
    await writeFile(path.join(dir, 'broken.json'), '{ "kind": ')
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'not-an-artifact' }))

    const result = await run(['migrate', '.'], dir)

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('migrated  forms/pet.yaml')
    expect(result.stdout).toContain('current   current.json')
    expect(result.stdout).toMatch(/failed {4}broken\.json: The file is not valid JSON/)
    expect(result.stdout).not.toContain('package.json')
    expect(result.stdout).toContain('1 migrated, 1 current, 1 failed')

    const yaml = await readFile(path.join(dir, 'forms', 'pet.yaml'), 'utf-8')
    expect(yaml).toBe(signedYaml.replace(PREVIOUS, PARADOC_SCHEMA_URL).replace('placement: auto', 'placement: flow'))
  })

  it('prints a diff on --dry-run and writes nothing', async () => {
    const file = path.join(dir, 'pet.yaml')
    await writeFile(file, signedYaml)

    const result = await run(['migrate', 'pet.yaml', '--dry-run'], dir)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`-$schema: ${PREVIOUS}`)
    expect(result.stdout).toContain(`+$schema: ${PARADOC_SCHEMA_URL}`)
    expect(result.stdout).toContain('-        placement: auto')
    expect(result.stdout).toContain('+        placement: flow')
    expect(result.stdout).toContain('Dry run: no files were written.')
    expect(await readFile(file, 'utf-8')).toBe(signedYaml)
  })

  it('migrates a file without $schema only when --from names its version', async () => {
    const file = path.join(dir, 'pet.json')
    await writeFile(file, signedForm(undefined))

    const refused = await run(['migrate', 'pet.json'], dir)
    expect(refused.exitCode).toBe(1)
    expect(refused.stdout).toContain('has no $schema')
    expect(await readFile(file, 'utf-8')).toBe(signedForm(undefined))

    const result = await run(['migrate', 'pet.json', '--from', '2026-08-10'], dir)
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(await readFile(file, 'utf-8')).$schema).toBe(PARADOC_SCHEMA_URL)
  })

  it('leaves a file unchanged when a value cannot be converted, and names it', async () => {
    const file = path.join(dir, 'pet.json')
    const source = signedForm(PREVIOUS).replace('"text/markdown"', '"text/tsx"')
    await writeFile(file, source)

    const result = await run(['migrate', 'pet.json'], dir)

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('layers.markdown.mimeType = "text/tsx"')
    expect(await readFile(file, 'utf-8')).toBe(source)
  })

  it('names in --help every file that needs --from', async () => {
    const result = await run(['migrate', '--help'], dir)
    expect(result.exitCode).toBe(0)
    const from = result.stdout.slice(result.stdout.indexOf('--from'), result.stdout.indexOf('-h, --help'))
    expect(from.replace(/\s+/g, ' ').trim()).toMatchInlineSnapshot(
      `"--from <version> Schema version of a file whose $schema is missing, undated (schema.json), an unpublished version, or not a Paradoc address"`,
    )
  })

  it('rejects an unknown --from version', async () => {
    await writeFile(path.join(dir, 'pet.json'), signedForm(undefined))
    const result = await run(['migrate', 'pet.json', '--from', '2020-01-01'], dir)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Unknown schema version: 2020-01-01')
  })
})
