import { describe, it, expect } from 'vitest'
import { paradocTools } from '../src/index'

describe('paradocTools', () => {
  it('returns all five tools', () => {
    const tools = paradocTools()

    expect(tools).toHaveProperty('validateArtifact')
    expect(tools).toHaveProperty('fill')
    expect(tools).toHaveProperty('render')
    expect(tools).toHaveProperty('getRegistry')
    expect(tools).toHaveProperty('getArtifact')
  })

  it('each tool has execute function', () => {
    const tools = paradocTools()

    for (const [name, t] of Object.entries(tools)) {
      expect(t, `${name} should have execute`).toHaveProperty('execute')
    }
  })

  it('accepts config and propagates to execute functions', () => {
    const tools = paradocTools({
      defaultRegistryUrl: 'https://public-dev.paradoc.dev',
    })

    expect(tools.render).toBeDefined()
    expect(tools.getRegistry).toBeDefined()
    expect(tools.getArtifact).toBeDefined()
  })

  it('validateArtifact tool executes correctly', async () => {
    const tools = paradocTools()

    const result = await tools.validateArtifact.execute({
      source: 'artifact' as const,
      artifact: {
        kind: 'form',
        name: 'test',
        fields: { name: { type: 'text', label: 'Name' } },
      },
    })

    expect(result.valid).toBe(true)
    expect(result.detectedKind).toBe('form')
  })

  it('fill tool catches validation errors', async () => {
    const tools = paradocTools()

    const result = await tools.fill.execute({
      source: 'artifact' as const,
      artifact: {
        kind: 'form',
        name: 'test',
        fields: { name: { type: 'text', label: 'Name', required: true } },
      },
      data: { fields: {} },
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
  })
})
