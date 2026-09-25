import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export const SOURCE_YAML = `# source formatting must survive compilation
$schema: https://schema.paradoc.dev/2026-09-24.json
kind: form
name: w9
version: 1.0.0
title: W9
fields: {}
instructions:
  kind: file
  path: instr.md
  mimeType: text/markdown
layers:
  notes:
    kind: file
    path: w9.md
    mimeType: text/markdown
`

export async function makeCompileFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'paradoc-registry-compile-'))
  const forms = path.join(root, 'forms')
  await mkdir(forms)
  await writeFile(path.join(forms, 'w9.yaml'), SOURCE_YAML)
  await writeFile(path.join(forms, 'w9.md'), '# Layer\n')
  await writeFile(path.join(forms, 'instr.md'), '# Instructions\n')
  await writeFile(path.join(root, 'registry.json'), JSON.stringify({
    name: 'test',
    items: [{ name: 'w9', kind: 'form', version: '1.0.0', path: 'forms/w9.yaml' }],
  }))
  return root
}
