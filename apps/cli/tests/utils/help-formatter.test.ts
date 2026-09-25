import { Command } from 'commander'
import { describe, expect, it } from 'vitest'
import { stripVTControlCharacters } from 'node:util'
import { formatGroupedHelp } from '../../src/utils/help-formatter.js'

describe('formatGroupedHelp', () => {
  it('aligns descriptions after command names of different lengths', () => {
    const program = new Command('paradoc').description('Documents').usage('<command>')
    const short = new Command('add').description('Add one')
    const long = new Command('configure').description('Configure one')
    const output = stripVTControlCharacters(formatGroupedHelp(program, [{ name: 'Work', commands: [short, long] }]))
    const lines = output.split('\n').filter((line) => line.includes(' one'))
    expect(lines[0]!.indexOf('Add one')).toBe(lines[1]!.indexOf('Configure one'))
  })
})
