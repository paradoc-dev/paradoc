import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARADOC_SCHEMA_URL } from '@paradoc/schemas'
import { runCli } from '../setup/spawn-cli.js'

const source = `# Reviewed by legal
$schema: ${PARADOC_SCHEMA_URL}
kind: form
name: comments
version: 1.0.0
title: Comments # inline note
fields: {}
layers:
  notes:
    kind: file
    mimeType: text/markdown
    path: notes.md
    checksum: sha256:0000000000000000000000000000000000000000000000000000000000000000
`

describe('framework-cli-seam-011: artifact edits preserve YAML comments', () => {
  it('preserves comments through attach, detach, and fix', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cli-seam-011-'))
    try {
      await writeFile(path.join(root, 'paradoc.json'), '{}\n')
      await mkdir(path.join(root, '.paradoc'))
      await writeFile(path.join(root, 'form.yaml'), source)
      await writeFile(path.join(root, 'notes.md'), '# notes\n')
      await writeFile(path.join(root, 'extra.md'), '# extra\n')
      expect((await runCli(['attach', 'form.yaml', 'extra.md', '-y'], { cwd: root })).exitCode).toBe(0)
      expect((await runCli(['detach', 'form.yaml', 'extra', '-y'], { cwd: root })).exitCode).toBe(0)
      expect((await runCli(['fix', 'form.yaml', '-y'], { cwd: root })).exitCode).toBe(0)
      expect((await runCli(['version', 'form.yaml', 'patch'], { cwd: root })).exitCode).toBe(0)
      const output = await readFile(path.join(root, 'form.yaml'), 'utf8')
      expect(output).toContain('# Reviewed by legal')
      expect(output).toContain('# inline note')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)
})
