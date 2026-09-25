/**
 * The test registry's artifacts are served to every registry workflow test,
 * so each must be a valid artifact under the current schema, and the index
 * must describe exactly the artifacts the registry serves.
 */

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { validate } from '@paradoc/core'
import { RegistryIndexSchema } from '@paradoc/schemas'
import { runCli } from '../setup/spawn-cli.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test-registry')
const itemsDir = path.join(root, 'r')
const itemFiles = fs.readdirSync(itemsDir).filter((file) => file.endsWith('.json')).sort()
const readJson = (file: string): Record<string, unknown> => JSON.parse(fs.readFileSync(file, 'utf-8'))

describe('test registry', () => {
  it('matches fresh registry compile output', async () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'paradoc-test-registry-'))
    try {
      const result = await runCli(['registry', 'compile', '--registry', path.join(root, 'registry.json'), '--output', output], { cwd: root })
      expect(result.exitCode).toBe(0)
      const generated = fs.readdirSync(output).filter((file) => file !== 'registry.json').sort()
      const committed = fs.readdirSync(itemsDir).sort()
      expect(generated).toEqual(committed)
      for (const file of committed) {
        expect(fs.readFileSync(path.join(output, file))).toEqual(fs.readFileSync(path.join(itemsDir, file)))
      }
      const compiledIndex = RegistryIndexSchema.parse(readJson(path.join(output, 'registry.json')))
      expect(compiledIndex.artifactsPath).toBeUndefined()
      expect(compiledIndex.items.every((item) => item.path === undefined)).toBe(true)
    } finally {
      fs.rmSync(output, { recursive: true, force: true })
    }
  })

  it.each(itemFiles)('serves %s as a valid artifact', (file) => {
    const result = validate(readJson(path.join(itemsDir, file)))
    expect(result.issues ?? []).toEqual([])
  })

  it('refuses an artifact whose shape does not match its kind', () => {
    const checklist = readJson(path.join(itemsDir, 'property-inspection.json'))
    const result = validate({ ...checklist, items: { exterior: { title: 'Exterior' } }, fields: {} })
    expect(result.issues?.length).toBeGreaterThan(0)
  })

  it('indexes exactly the artifacts it serves, with matching kind and version', () => {
    const index = RegistryIndexSchema.parse(readJson(path.join(root, 'registry.json')))
    const served = itemFiles.map((file) => {
      const artifact = readJson(path.join(itemsDir, file))
      return { file, name: artifact.name, kind: artifact.kind, version: artifact.version }
    })
    const indexed = index.items.map((item) => ({ file: `${item.name}.json`, name: item.name, kind: item.kind, version: item.version }))
    expect(indexed.sort((left, right) => left.file.localeCompare(right.file))).toEqual(served)
  })
})
