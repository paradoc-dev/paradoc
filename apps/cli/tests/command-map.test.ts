import { describe, expect, it } from 'vitest'
import { commandEntries } from '../src/command-map.js'

describe('command map', () => {
  it('matches every command module', async () => {
    for (const entry of commandEntries) {
      const command = await entry.load()
      expect.soft(entry.name).toBe(command.name())
      expect.soft(entry.description, entry.name).toBe(command.description())
      expect.soft(entry.aliases ?? []).toEqual(command.aliases())
    }
  })
})
