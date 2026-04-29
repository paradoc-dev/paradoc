import { describe, it, expect } from 'vitest'
import { executeGetRegistry } from '../../src/tools/get-registry'
import { executeGetArtifact } from '../../src/tools/get-artifact'
import { executeRender } from '../../src/tools/render'
import { executeValidateArtifact } from '../../src/tools/validate'
import { executeFill } from '../../src/tools/fill'

const REGISTRY_URL = 'https://public-dev.paradoc.dev'

const PET_ADDENDUM_DATA = {
  fields: {
    petName: 'Buddy',
    species: 'dog',
    weight: 45,
    isVaccinated: true,
  },
  parties: {
    tenant: { id: 'tenant-1', name: 'Jane Doe' },
    landlord: { id: 'landlord-1', name: 'Acme Properties LLC' },
  },
}

// ---------------------------------------------------------------------------
// getRegistry
// ---------------------------------------------------------------------------

describe('executeGetRegistry', () => {
  it('fetches registry.json and returns items', async () => {
    const result = await executeGetRegistry({ registryUrl: REGISTRY_URL })

    expect(result.error).toBeUndefined()
    expect(result.items.length).toBeGreaterThan(0)

    const names = result.items.map((i) => i.name)
    expect(names).toContain('pet-addendum')
  })

  it('returns error for invalid registry URL', async () => {
    const result = await executeGetRegistry({ registryUrl: 'https://nonexistent.example.com' })

    expect(result.error).toBeDefined()
    expect(result.items).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getArtifact
// ---------------------------------------------------------------------------

describe('executeGetArtifact', () => {
  it('fetches pet-addendum artifact from registry', async () => {
    const result = await executeGetArtifact({
      registryUrl: REGISTRY_URL,
      artifactName: 'pet-addendum',
    })

    expect(result.error).toBeUndefined()
    expect(result.artifactName).toBe('pet-addendum')
    expect(result.artifact).toBeDefined()
    expect(result.artifact!.kind).toBe('form')
    expect(result.artifact!.name).toBe('pet-addendum')
    expect(result.artifact!.fields).toBeDefined()

    // Verify fields match expected schema
    const fields = result.artifact!.fields as Record<string, { type: string }>
    expect(fields.petName.type).toBe('text')
    expect(fields.species.type).toBe('enum')
    expect(fields.weight.type).toBe('number')
    expect(fields.isVaccinated.type).toBe('boolean')
  })

  it('returns error for nonexistent artifact', async () => {
    const result = await executeGetArtifact({
      registryUrl: REGISTRY_URL,
      artifactName: 'does-not-exist',
    })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('does-not-exist')
  })
})

// ---------------------------------------------------------------------------
// Full pipeline: getArtifact → validate → fill → render
// ---------------------------------------------------------------------------

describe('full pipeline', () => {
  it('getArtifact → validate → fill → render (pet-addendum, markdown)', async () => {
    // 1. Fetch
    const getResult = await executeGetArtifact({
      registryUrl: REGISTRY_URL,
      artifactName: 'pet-addendum',
    })
    expect(getResult.error).toBeUndefined()
    const artifact = getResult.artifact!

    // 2. Validate
    const validateResult = await executeValidateArtifact({ source: 'artifact' as const, artifact })
    expect(validateResult.valid).toBe(true)
    expect(validateResult.detectedKind).toBe('form')

    // 3. Fill
    const fillResult = await executeFill({ source: 'artifact' as const, artifact, data: PET_ADDENDUM_DATA })
    expect(fillResult.valid).toBe(true)
    expect(fillResult.artifactKind).toBe('form')
    expect(fillResult.data).toBeDefined()

    // 4. Render (markdown, via registry source mode)
    const renderResult = await executeRender({
      source: 'registry',
      registryUrl: REGISTRY_URL,
      artifactName: 'pet-addendum',
      data: PET_ADDENDUM_DATA,
      layer: 'markdown',
    })

    expect(renderResult.success).toBe(true)
    expect(renderResult.artifactKind).toBe('form')
    expect(renderResult.mimeType).toBe('text/markdown')
    expect(renderResult.encoding).toBe('utf-8')
    expect(renderResult.content).toBeDefined()
    expect(renderResult.content).toContain('Buddy')
    expect(renderResult.content).toContain('dog')
  })

  it('renders pet-addendum as PDF (inline, base64)', async () => {
    const result = await executeRender({
      source: 'registry',
      registryUrl: REGISTRY_URL,
      artifactName: 'pet-addendum',
      data: PET_ADDENDUM_DATA,
      layer: 'pdf',
    })

    expect(result.success).toBe(true)
    expect(result.artifactKind).toBe('form')
    expect(result.mimeType).toBe('application/pdf')
    expect(result.encoding).toBe('base64')
    expect(result.content).toBeDefined()

    // Verify base64 content is a valid PDF
    const decoded = atob(result.content!.slice(0, 20))
    expect(decoded.startsWith('%PDF')).toBe(true)
  })

  it('renders pet-addendum via URL source mode', async () => {
    const result = await executeRender({
      source: 'url',
      url: `${REGISTRY_URL}/pet-addendum/pet-addendum.json`,
      data: PET_ADDENDUM_DATA,
      layer: 'markdown',
    })

    expect(result.success).toBe(true)
    expect(result.mimeType).toBe('text/markdown')
    expect(result.content).toContain('Buddy')
  })

  it('validates pet-addendum via registry source', async () => {
    const result = await executeValidateArtifact({
      source: 'registry',
      registryUrl: REGISTRY_URL,
      artifactName: 'pet-addendum',
    })

    expect(result.valid).toBe(true)
    expect(result.detectedKind).toBe('form')
  })

  it('fills pet-addendum via registry source', async () => {
    const result = await executeFill({
      source: 'registry',
      registryUrl: REGISTRY_URL,
      artifactName: 'pet-addendum',
      data: PET_ADDENDUM_DATA,
    })

    expect(result.valid).toBe(true)
    expect(result.artifactKind).toBe('form')
    expect(result.data).toBeDefined()
    expect(result.data!.petName).toBe('Buddy')
  })
})
