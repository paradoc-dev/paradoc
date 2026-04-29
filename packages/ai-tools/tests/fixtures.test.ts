/**
 * Fixture-based tests for ai-tools execute functions.
 *
 * Fixtures sourced from:
 * - artifacts/staging/ — real production artifacts (pet-addendum, w-9)
 * - apps/docs/tests/   — docs test vectors (lease, purchase agreement, checklist)
 *
 * Each artifact has a corresponding .data.json with valid fill data.
 * File-backed render tests use the public registry.
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

// ---------------------------------------------------------------------------
// Pet Addendum — real production artifact from artifacts/staging/.
// Has file-backed PDF + markdown layers, signature blocks, bindings.
// ---------------------------------------------------------------------------

describe('pet-addendum fixture (production artifact)', () => {
  const { artifact, data } = loadFixture('pet-addendum')

  it('validates successfully', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact })
    expect(result.valid).toBe(true)
    expect(result.detectedKind).toBe('form')
    expect(result.issues).toBeUndefined()
  })

  it('validates with logic checks enabled', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact, options: { schema: true, logic: true } })
    expect(result.valid).toBe(true)
  })

  it('fills with valid data', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.valid).toBe(true)
    expect(result.artifactKind).toBe('form')
    expect(result.data).toBeDefined()
    expect(result.data!.petName).toBe('Bella')
    expect(result.data!.species).toBe('dog')
    expect(result.data!.weight).toBe(35)
    expect(result.data!.isVaccinated).toBe(true)
  })

  it('fills successfully when party id is omitted (auto-normalized)', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: {
        fields: data.fields,
        parties: {
          tenant: { name: 'Alice Tenant' },
          landlord: { name: 'Bob Landlord' },
        },
      },
    })

    expect(result.valid).toBe(true)
    expect(result.artifactKind).toBe('form')
  })

  it('returns errors when required fields are missing', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: { fields: {}, parties: data.parties },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)

    const fieldNames = result.errors!.map((e) => e.field)
    expect(fieldNames.some((f) => f.includes('petName'))).toBe(true)
    expect(fieldNames.some((f) => f.includes('species'))).toBe(true)
    expect(fieldNames.some((f) => f.includes('weight'))).toBe(true)
    expect(fieldNames.some((f) => f.includes('isVaccinated'))).toBe(true)
  })

  it('returns error when rendering file-backed layer without baseUrl', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('file-backed')
  })

  it('renders markdown via public registry', async () => {
    const result = await executeRender({
      source: 'registry' as const,
      registryUrl: PUBLIC_REGISTRY_URL,
      artifactName: 'pet-addendum',
      data,
      layer: 'markdown',
    })

    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error('Render failed:', result.error, result.errors, result.validationIssues)
    }
    expect(result.success).toBe(true)
    expect(result.artifactKind).toBe('form')
    expect(result.encoding).toBe('utf-8')
    expect(result.mimeType).toBe('text/markdown')

    // Content from the Handlebars template
    expect(result.content).toContain('Pet Addendum')
    expect(result.content).toContain('Bella')
    expect(result.content).toContain('dog')
    expect(result.content).toContain('35')
  })

  it('renders markdown when party id is omitted (auto-normalized)', async () => {
    const result = await executeRender({
      source: 'registry' as const,
      registryUrl: PUBLIC_REGISTRY_URL,
      artifactName: 'pet-addendum',
      data: {
        fields: data.fields,
        parties: {
          tenant: { name: 'Alice Tenant' },
          landlord: { name: 'Bob Landlord' },
        },
      },
      layer: 'markdown',
    })

    expect(result.success).toBe(true)
    expect(result.artifactKind).toBe('form')
    expect(result.encoding).toBe('utf-8')
    expect(result.mimeType).toBe('text/markdown')
  })

  it('renders PDF via public registry', async () => {
    const result = await executeRender({
      source: 'registry' as const,
      registryUrl: PUBLIC_REGISTRY_URL,
      artifactName: 'pet-addendum',
      data,
      layer: 'pdf',
    })

    expect(result.success).toBe(true)
    expect(result.artifactKind).toBe('form')
    expect(result.encoding).toBe('base64')
    expect(result.mimeType).toBe('application/pdf')
    expect(result.content).toBeDefined()

    // Verify base64 decodes to a valid PDF
    const decoded = atob(result.content!.slice(0, 20))
    expect(decoded.startsWith('%PDF')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Lease Agreement — complex form: address, money, duration, enum, boolean,
// multiple parties, conditionals in Handlebars template (inline layer)
// ---------------------------------------------------------------------------

describe('lease-agreement fixture', () => {
  const { artifact, data } = loadFixture('lease-agreement')

  it('validates successfully', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact })
    expect(result.valid).toBe(true)
    expect(result.detectedKind).toBe('form')
    expect(result.issues).toBeUndefined()
  })

  it('fills with valid data', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.valid).toBe(true)
    expect(result.artifactKind).toBe('form')
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
    expect(result.valid).toBe(true)
    expect(result.data!.petsAllowed).toBe(false)
    expect(result.data!.smokingAllowed).toBe(false)
  })

  it('returns errors when required fields are missing', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: { fields: {}, parties: data.parties },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors!.length).toBeGreaterThan(0)

    const fieldNames = result.errors!.map((e) => e.field)
    expect(fieldNames.some((f) => f.includes('address'))).toBe(true)
    expect(fieldNames.some((f) => f.includes('propertyType'))).toBe(true)
  })

  it('renders markdown with party names and field values', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })

    expect(result.success).toBe(true)
    expect(result.artifactKind).toBe('form')
    expect(result.encoding).toBe('utf-8')
    expect(result.mimeType).toBe('text/markdown')

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
// signatures, inline Handlebars template
// ---------------------------------------------------------------------------

describe('purchase-agreement fixture', () => {
  const { artifact, data } = loadFixture('purchase-agreement')

  it('validates successfully', async () => {
    const result = await executeValidateArtifact({ source: 'artifact' as const, artifact })
    expect(result.valid).toBe(true)
    expect(result.detectedKind).toBe('form')
  })

  it('fills with valid data', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.valid).toBe(true)
    expect(result.artifactKind).toBe('form')
    expect(result.data).toBeDefined()
  })

  it('returns errors when required fields are missing', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: { fields: { quantity: 10 }, parties: data.parties },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()

    const fieldNames = result.errors!.map((e) => e.field)
    expect(fieldNames.some((f) => f.includes('price'))).toBe(true)
    expect(fieldNames.some((f) => f.includes('date'))).toBe(true)
  })

  it('renders markdown with buyer, seller, and values', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })

    expect(result.success).toBe(true)
    expect(result.encoding).toBe('utf-8')
    expect(result.mimeType).toBe('text/markdown')

    expect(result.content).toContain('Purchase Agreement')
    expect(result.content).toContain('Alice Johnson')
    expect(result.content).toContain('Bob Smith')
    expect(result.content).toContain('100')
    expect(result.content).toContain('$25.00')
    expect(result.content).toContain('2025-03-01')
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
    expect(result.detectedKind).toBe('form')
  })

  it('fills with valid data', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.valid).toBe(true)
    expect(result.artifactKind).toBe('form')
    expect(result.data).toBeDefined()
    expect(result.data!.name).toBe('John Smith')
    expect(result.data!.taxClassification).toBe('individual')
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
    expect(result.valid).toBe(true)
    expect(result.data!.businessName).toBe('Smith Consulting LLC')
  })

  it('returns errors when required fields are missing', async () => {
    const result = await executeFill({
      source: 'artifact' as const,
      artifact,
      data: { fields: { businessName: 'Test' } },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()

    const fieldNames = result.errors!.map((e) => e.field)
    expect(fieldNames.some((f) => f.includes('name'))).toBe(true)
    expect(fieldNames.some((f) => f.includes('taxClassification'))).toBe(true)
    expect(fieldNames.some((f) => f.includes('address'))).toBe(true)
  })

  it('returns error when rendering file-backed layer without baseUrl', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('file-backed')
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
    expect(result.detectedKind).toBe('checklist')
  })

  it('fills with boolean values', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data })
    expect(result.valid).toBe(true)
    expect(result.artifactKind).toBe('checklist')
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
    expect(result.valid).toBe(true)
  })

  it('fills with empty data (all defaults)', async () => {
    const result = await executeFill({ source: 'artifact' as const, artifact, data: {} })
    expect(result.valid).toBe(true)
  })

  it('returns error when rendering (only forms can render)', async () => {
    const result = await executeRender({
      source: 'artifact' as const,
      artifact,
      data,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Only form')
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
