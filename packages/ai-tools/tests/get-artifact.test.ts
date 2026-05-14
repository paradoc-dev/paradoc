import { describe, expect, it, vi } from 'vitest'
import { executeGetArtifact } from '../src/tools/get-artifact'

describe('executeGetArtifact instruction resolution', () => {
  it('returns inline instructions and inline agent instructions', async () => {
    const artifact = {
      kind: 'form',
      name: 'pet-addendum',
      instructions: {
        kind: 'inline',
        text: 'Fill out required pet details only.',
      },
      agentInstructions: {
        kind: 'inline',
        text: 'Ask one question at a time.',
      },
    }
    const registryIndex = { items: [{ name: 'pet-addendum' }] }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(new Response(JSON.stringify(registryIndex)))
      }
      return Promise.resolve(new Response(JSON.stringify(artifact)))
    })

    const result = await executeGetArtifact(
      { registryUrl: 'https://public.paradoc.dev', artifactName: 'pet-addendum' },
      { fetch: mockFetch },
    )

    expect(result.error).toBeUndefined()
    expect(result.instructions?.kind).toBe('inline')
    expect(result.instructions?.content).toContain('required pet details')
    expect(result.agentInstructions?.kind).toBe('inline')
    expect(result.agentInstructions?.content).toContain('one question at a time')
  })

  it('fetches file-backed instructions and agent instructions', async () => {
    const artifact = {
      kind: 'form',
      name: 'pet-addendum',
      instructions: {
        kind: 'file',
        path: 'instructions.md',
        mimeType: 'text/markdown',
      },
      agentInstructions: {
        kind: 'file',
        path: 'agent-instructions.md',
        mimeType: 'text/markdown',
      },
    }
    const registryIndex = { items: [{ name: 'pet-addendum' }] }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(new Response(JSON.stringify(registryIndex)))
      }
      if (url.endsWith('/pet-addendum.json')) {
        return Promise.resolve(new Response(JSON.stringify(artifact)))
      }
      if (url.endsWith('/instructions.md')) {
        return Promise.resolve(new Response('# Instructions'))
      }
      if (url.endsWith('/agent-instructions.md')) {
        return Promise.resolve(new Response('# Agent Instructions'))
      }
      return Promise.resolve(new Response('Not found', { status: 404 }))
    })

    const result = await executeGetArtifact(
      { registryUrl: 'https://public.paradoc.dev', artifactName: 'pet-addendum' },
      { fetch: mockFetch },
    )

    expect(result.error).toBeUndefined()
    expect(result.instructions?.kind).toBe('file')
    expect(result.instructions?.encoding).toBe('utf-8')
    expect(result.instructions?.content).toContain('Instructions')
    expect(result.agentInstructions?.kind).toBe('file')
    expect(result.agentInstructions?.encoding).toBe('utf-8')
    expect(result.agentInstructions?.content).toContain('Agent Instructions')
  })

  it('returns an error when referenced instruction file cannot be fetched', async () => {
    const artifact = {
      kind: 'form',
      name: 'pet-addendum',
      instructions: {
        kind: 'file',
        path: 'instructions.md',
        mimeType: 'text/markdown',
      },
    }
    const registryIndex = { items: [{ name: 'pet-addendum' }] }

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/registry.json')) {
        return Promise.resolve(new Response(JSON.stringify(registryIndex)))
      }
      if (url.endsWith('/pet-addendum.json')) {
        return Promise.resolve(new Response(JSON.stringify(artifact)))
      }
      return Promise.resolve(new Response('Not found', { status: 404 }))
    })

    const result = await executeGetArtifact(
      { registryUrl: 'https://public.paradoc.dev', artifactName: 'pet-addendum' },
      { fetch: mockFetch },
    )

    expect(result.error).toBeDefined()
    expect(result.error).toContain('instructions.md')
    expect(result.instructions).toBeUndefined()
  })
})
