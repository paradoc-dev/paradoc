import { describe, expect, it } from 'vitest'
import { stripVTControlCharacters } from 'node:util'
import { formatTable } from '../../src/utils/table.js'

describe('formatTable', () => {
  it('pads plain and colored cells to the same visible width', () => {
    const table = formatTable(['Name', 'Status'], [['short', '\x1b[32mready\x1b[39m'], ['longer', 'waiting']])
    const widths = table.split('\n').map((line) => stripVTControlCharacters(line).length)
    expect(new Set(widths).size).toBe(1)
  })
})
