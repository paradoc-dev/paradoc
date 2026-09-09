/**
 * Fixture-based tests for ai-tools execute functions.
 *
 * Fixtures sourced from:
 * - artifacts/staging/ — real production artifacts (pet-addendum, w-9)
 * - apps/docs/tests/   — docs test vectors (lease, purchase agreement, checklist)
 *
 * Each artifact has a corresponding .data.json with valid fill data.
 * File-backed render tests use a mocked public registry.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { executeValidateArtifact } from '../src/tools/validate'
import { executeFill } from '../src/tools/fill'
import { executeRender } from '../src/tools/render'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const fixturesDir = join(__dirname, 'fixtures')
const PUBLIC_REGISTRY_URL = 'https://public.paradoc.dev'

function loadFixture(name: string) {
  const artifact = JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), 'utf-8'))
  const data = JSON.parse(readFileSync(join(fixturesDir, `${name}.data.json`), 'utf-8'))
  return { artifact, data }
}

function createPetAddendumRegistryFetch(artifact: unknown): typeof globalThis.fetch {
  return async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.endsWith('/registry.json')) {
      return Response.json({
        items: [{ name: 'pet-addendum', path: 'pet-addendum/pet-addendum.json' }],
      })
    }

    if (url.endsWith('/pet-addendum/pet-addendum.json')) {
      return Response.json(artifact)
    }

    if (url.endsWith('/pet-addendum/pet-addendum.md')) {
      return new Response(readFileSync(join(fixturesDir, 'pet-addendum.md'), 'utf-8'), {
        headers: { 'content-type': 'text/markdown' },
      })
    }

    if (url.endsWith('/pet-addendum/pet-addendum.pdf')) {
      return new Response(new Uint8Array(readFileSync(join(fixturesDir, 'pet-addendum.pdf'))), {
        headers: { 'content-type': 'application/pdf' },
      })
    }

    return new Response('Not found', { status: 404 })
  }
}

// ---------------------------------------------------------------------------
// Pet Addendum — real production artifact from artifacts/staging/.
// Has file-backed PDF + markdown layers, signature blocks, bindings.
// ---------------------------------------------------------------------------

describe('pet-addendum fixture (production artifact)', () => {
  const { artifact, data } = loadFixture('pet-addendum')
  const fixtureRegistryConfig = { fetch: createPetAddendumRegistryFetch(artifact) }

  it('validates successfully', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact })
    expect(result.valid).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.issues).toBeUndefined()
  })

  it('validates with logic checks enabled', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact, options: { schema: true, logic: true } })
    expect(result.valid).toBe(true)
  })

  it('fills with valid data', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.accepted).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.data).toBeDefined()
    expect(result.data!.fields.petName).toBe('Bella')
    expect(result.data!.fields.species).toBe('dog')
    expect(result.data!.fields.weight).toBe(35)
    expect(result.data!.fields.isVaccinated).toBe(true)
  })

  it('fills successfully when party id is omitted (auto-normalized)', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: {
        fields: data.fields,
        parties: {
          tenant: { name: 'Alice Tenant' },
          landlord: { name: 'Bob Landlord', legalName: 'Bob Landlord LLC' },
        },
      },
    })

    expect(result.accepted).toBe(true)
    expect(result.artifact_kind).toBe('form')
  })

  it('accepts a partial draft when required fields are omitted', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: { fields: {}, parties: data.parties },
    })
    expect(result.accepted).toBe(true)
    expect(result.complete).toBe(false)
  })

  it('returns error when rendering file-backed layer without baseUrl', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })
    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('file-backed')
  })

  it('renders markdown via public registry', async () => {
    const result = await executeRender(
      {
        source: 'registry' as const,
        registry_url: PUBLIC_REGISTRY_URL,
        artifact_name: 'pet-addendum',
        data,
        layer: 'markdown',
      },
      fixtureRegistryConfig,
    )

    if (!result.success) {
      console.error('Render failed:', result.error, result.errors, result.validation_issues)
    }
    expect(result.success).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.encoding).toBe('utf-8')
    expect(result.mime_type).toBe('text/markdown')

    // Content from the Paradoc template
    expect(result.content).toContain('Pet Addendum')
    expect(result.content).toContain('Bella')
    expect(result.content).toContain('dog')
    expect(result.content).toContain('35')
  })

  it('renders markdown when party id is omitted (auto-normalized)', async () => {
    const result = await executeRender(
      {
        source: 'registry' as const,
        registry_url: PUBLIC_REGISTRY_URL,
        artifact_name: 'pet-addendum',
        data: {
          fields: data.fields,
          parties: {
            tenant: { name: 'Alice Tenant' },
            landlord: { name: 'Bob Landlord', legalName: 'Bob Landlord LLC' },
          },
        },
        layer: 'markdown',
      },
      fixtureRegistryConfig,
    )

    expect(result.success).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.encoding).toBe('utf-8')
    expect(result.mime_type).toBe('text/markdown')
  })

  it('renders PDF via public registry', async () => {
    const result = await executeRender(
      {
        source: 'registry' as const,
        registry_url: PUBLIC_REGISTRY_URL,
        artifact_name: 'pet-addendum',
        data,
        layer: 'pdf',
      },
      fixtureRegistryConfig,
    )

    expect(result.success).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.encoding).toBe('base64')
    expect(result.mime_type).toBe('application/pdf')
    expect(result.content).toBeDefined()

    // Verify base64 decodes to a valid PDF
    const decoded = atob(result.content!.slice(0, 20))
    expect(decoded.startsWith('%PDF')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Lease Agreement — complex form: address, money, duration, enum, boolean,
// multiple parties, conditionals in a Paradoc template (inline layer)
// ---------------------------------------------------------------------------

describe('lease-agreement fixture', () => {
  const { artifact, data } = loadFixture('lease-agreement')

  it('validates successfully', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact })
    expect(result.valid).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.issues).toBeUndefined()
  })

  it('fills with valid data', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.accepted).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.data).toBeDefined()
    expect(result.errors).toBeUndefined()
  })

  it('fills and applies boolean defaults', async () => {
    const partialData = {
      fields: {
        address: data.fields.address,
        propertyType: 'house',
        bedrooms: 3,
        startDate: '2025-06-01',
        leaseTerm: 'P6M',
        monthlyRent: { amount: 1500, currency: 'USD' },
        // petsAllowed and smokingAllowed omitted — should get defaults (false)
      },
      parties: data.parties,
    }
    const result = await executeFill({ source: 'artifact' as const, artifact, data: partialData })
    expect(result.accepted).toBe(true)
    expect(result.data!.fields.petsAllowed).toBe(false)
    expect(result.data!.fields.smokingAllowed).toBe(false)
  })

  it('accepts a partial draft when required fields are omitted', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: { fields: {}, parties: data.parties },
    })
    expect(result.accepted).toBe(true)
    expect(result.complete).toBe(false)
  })

  it('renders markdown with party names and field values', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })

    expect(result.success).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.encoding).toBe('utf-8')
    expect(result.mime_type).toBe('text/markdown')

    // Party names
    expect(result.content).toContain('Alice Chen')
    expect(result.content).toContain('Bob Smith')
    expect(result.content).toContain('Carol Johnson')

    // Field values
    expect(result.content).toContain('123 Oak Street')
    expect(result.content).toContain('apartment')
    expect(result.content).toContain('2')
    expect(result.content).toContain('$2,800.00')

    // Conditionals: petsAllowed=true, smokingAllowed=false
    expect(result.content).toContain('permitted')
    expect(result.content).toContain('not permitted')
  })
})

// ---------------------------------------------------------------------------
// Purchase Agreement — simpler form: number, money, date, parties with
// signatures, inline Paradoc template
// ---------------------------------------------------------------------------

describe('purchase-agreement fixture', () => {
  const { artifact, data } = loadFixture('purchase-agreement')

  it('validates successfully', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact })
    expect(result.valid).toBe(true)
    expect(result.artifact_kind).toBe('form')
  })

  it('fills with valid data', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.accepted).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.data).toBeDefined()
  })

  it('accepts a partial draft when required fields are omitted', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: { fields: { quantity: 10 }, parties: data.parties },
    })
    expect(result.accepted).toBe(true)
    expect(result.complete).toBe(false)
  })

  it('renders markdown with buyer, seller, and values', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })

    expect(result.success).toBe(true)
    expect(result.encoding).toBe('utf-8')
    expect(result.mime_type).toBe('text/markdown')

    expect(result.content).toContain('Purchase Agreement')
    expect(result.content).toContain('Alice Johnson')
    expect(result.content).toContain('Bob Smith')
    expect(result.content).toContain('100')
    expect(result.content).toContain('$25.00')
    expect(result.content).toContain('Mar 1, 2025')
  })
})

// ---------------------------------------------------------------------------
// W-9 Tax Form — hand-crafted fixture with file-backed PDF layer + bindings.
// Validates and fills fine, but render requires a baseUrl.
// ---------------------------------------------------------------------------

describe('w9-tax-form fixture', () => {
  const { artifact, data } = loadFixture('w9-tax-form')

  it('validates successfully', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact })
    expect(result.valid).toBe(true)
    expect(result.artifact_kind).toBe('form')
  })

  it('fills with valid data', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.accepted).toBe(true)
    expect(result.artifact_kind).toBe('form')
    expect(result.data).toBeDefined()
    expect(result.data!.fields.name).toBe('John Smith')
    expect(result.data!.fields.taxClassification).toBe('individual')
  })

  it('fills with all optional fields', async () => {
    const fullData = {
      fields: {
        ...data.fields,
        businessName: 'Smith Consulting LLC',
        llcTaxCode: 'C',
        ein: '12-3456789',
      },
    }
    const result = await executeFill({ source: 'artifact' as const, artifact, data: fullData })
    expect(result.accepted).toBe(true)
    expect(result.data!.fields.businessName).toBe('Smith Consulting LLC')
  })

  it('accepts a partial draft when required fields are omitted', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: { fields: { businessName: 'Test' } },
    })
    expect(result.accepted).toBe(true)
    expect(result.complete).toBe(false)
  })

  it('returns error when rendering file-backed layer without baseUrl', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('file-backed')
  })
})

// ---------------------------------------------------------------------------
// Onboarding Checklist — validates and fills as checklist kind
// ---------------------------------------------------------------------------

describe('onboarding-checklist fixture', () => {
  const { artifact, data } = loadFixture('onboarding-checklist')

  it('validates successfully', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact })
    expect(result.valid).toBe(true)
    expect(result.artifact_kind).toBe('checklist')
  })

  it('fills with boolean values', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.accepted).toBe(true)
    expect(result.artifact_kind).toBe('checklist')
    expect(result.data).toBeDefined()
  })

  it('fills with all items false', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: {
        'signed-contract': false,
        'received-equipment': false,
        'completed-training': false,
      },
    })
    expect(result.accepted).toBe(true)
  })

  it('fills with empty data (all defaults)', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data: {} })
    expect(result.accepted).toBe(true)
  })

  it('reports when a checklist has no renderable layer', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })

    expect(result.success).toBe(false)
    expect(result.artifact_kind).toBe('checklist')
    expect(result.error?.code).toBe('missing_layer')
  })
})

// ---------------------------------------------------------------------------
// Cross-cutting: validate rejects bad artifacts
// ---------------------------------------------------------------------------

describe('fixture validation edge cases', () => {
  const { artifact: petArtifact } = loadFixture('pet-addendum')

  it('detects schema issues when kind is removed', async () => {
    const broken = { ...petArtifact }
    delete (broken as Record<string, unknown>).kind
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact: broken })
    expect(result.valid).toBe(false)
  })

  it('detects schema issues when name is removed', async () => {
    const broken = { ...petArtifact }
    delete (broken as Record<string, unknown>).name
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact: broken })
    expect(result.valid).toBe(false)
  })

  it('validates with schema-only option', async () => {
    const result = await executeValidateArtifact({
      source: 'artifact' as const,
      artifact: petArtifact,
      options: { schema: true, logic: false },
    })
    expect(result.valid).toBe(true)
  })
})
