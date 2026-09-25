import { createHash } from 'node:crypto'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fileReferencesOf } from '../../src/utils/artifact-file.js'
import { runCli } from '../setup/spawn-cli.js'

const schema = 'https://schema.paradoc.dev/2026-09-24.json'
const roots: string[] = []
const scratch = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'paradoc-walker-'))
  roots.push(root)
  return root
}
const checksum = (file: string) => `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

describe('one artifact file-reference walker', () => {
  it('walks layers, fonts, content refs, bundle paths, and nested inline artifacts', () => {
    const artifact = {
      kind: 'bundle', name: 'packet', version: '1.0.0', title: 'Packet',
      instructions: { kind: 'file', path: 'packet.md', checksum: 'sha256:x' },
      contents: [
        { type: 'path', key: 'external', path: 'forms/a.yaml' },
        { type: 'inline', key: 'inline', artifact: {
          kind: 'form', name: 'form', version: '1.0.0', title: 'Form', fields: {},
          layers: { pdf: { kind: 'file', path: 'form.pdf', mimeType: 'application/pdf', font: { path: 'font.ttf', checksum: 'sha256:y' } } },
        } },
      ],
    }

    expect([...fileReferencesOf(artifact as never)].map((reference) => reference.path)).toEqual([
      'packet.md', 'forms/a.yaml', 'form.pdf', 'font.ttf',
    ])
  })

  it('fails schema-invalid artifacts in checksum-only scope', async () => {
    const root = scratch()
    const file = path.join(root, 'bad.json')
    writeFileSync(file, JSON.stringify({ $schema: schema, kind: 'form', name: 'bad', title: 'Bad', version: '1.0.0', fields: { a: { type: 'nope', label: 'A' } } }))

    const result = await runCli(['validate', file, '--checksum-only', '--json'], { cwd: root })
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stdout).ok).toBe(false)
  })

  it('reports a read error once on stderr', async () => {
    const root = scratch()
    const result = await runCli(['validate', 'missing.json'], { cwd: root })
    expect(result.exitCode).toBe(1)
    expect(result.stdout).not.toContain('File not found: missing.json')
    expect(result.stderr.match(/File not found: missing\.json/g)).toHaveLength(1)
  })

  it('validates and fixes layer-font and instruction checksums', async () => {
    const root = scratch()
    const pdf = path.join(root, 'form.pdf')
    const font = path.join(root, 'font.ttf')
    const instructions = path.join(root, 'instructions.md')
    copyFileSync(path.resolve(import.meta.dirname, '../fixtures/pet-addendum.pdf'), pdf)
    copyFileSync(path.resolve(import.meta.dirname, '../../../../packages/core/tests/artifacts/form/fixtures/cyrillic-boxes.ttf'), font)
    writeFileSync(instructions, '# Instructions')
    const file = path.join(root, 'form.json')
    writeFileSync(file, JSON.stringify({
      $schema: schema, kind: 'form', name: 'form', version: '1.0.0', title: 'Form', fields: {},
      instructions: { kind: 'file', path: 'instructions.md', mimeType: 'text/markdown', checksum: `sha256:${'0'.repeat(64)}` },
      layers: { pdf: { kind: 'file', path: 'form.pdf', mimeType: 'application/pdf', checksum: checksum(pdf), font: { path: 'font.ttf', checksum: `sha256:${'0'.repeat(64)}` } } },
    }, null, 2))

    expect((await runCli(['validate', file], { cwd: root })).exitCode).toBe(1)
    const dryRun = await runCli(['fix', file, '--dry-run'], { cwd: root, timeout: 10_000 })
    expect(dryRun.exitCode).toBe(0)
    expect(dryRun.stdout).toContain('layers.pdf.font.checksum')
    expect(dryRun.stdout).toContain('instructions.checksum')

    expect((await runCli(['fix', file, '--yes'], { cwd: root })).exitCode).toBe(0)
    expect((await runCli(['validate', file], { cwd: root })).exitCode).toBe(0)
  })
})
