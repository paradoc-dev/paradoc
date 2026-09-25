import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMA_BASE } from '@paradoc/schemas'
import { describe, expect, it } from 'vitest'

const cliSource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')
const schemaUrlFiles = [
  'utils/lock.ts',
  'utils/config.ts',
  'utils/templates.ts',
  'commands/registry.ts',
]

describe('framework-cli-seam-016: CLI schema URLs derive from SCHEMA_BASE', () => {
  it('exports the expected schema origin', () => {
    expect(SCHEMA_BASE).toBe('https://schema.paradoc.dev')
  })

  it.each(schemaUrlFiles)('%s uses SCHEMA_BASE without hard-coding the origin', (relativePath) => {
    const source = readFileSync(path.join(cliSource, relativePath), 'utf8')
    expect(source).toContain('SCHEMA_BASE')
    expect(source).not.toContain('https://schema.paradoc.dev')
  })
})
