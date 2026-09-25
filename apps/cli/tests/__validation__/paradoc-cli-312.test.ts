import { describe, expect, it } from 'vitest'
import { stripVTControlCharacters } from 'node:util'
import { formatTable } from '../../src/utils/table.js'

describe('paradoc-cli-312', () => {
  it('aligns tables containing ANSI-colored cells', () => {
    const output = formatTable(['Package', 'Installed'], [
      ['render', '\x1b[32m0.5.0\x1b[39m'],
      ['react', '\x1b[90mnot installed\x1b[39m'],
    ])
    expect(new Set(output.split('\n').map((line) => stripVTControlCharacters(line).length)).size).toBe(1)
  })
})
