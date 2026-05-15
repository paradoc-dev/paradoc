/**
 * Tests for code snippets in guides/text-layers.mdx
 */
import { describe, test, expect } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { para, textRenderer } from '@paradoc/sdk'
import { createFsResolver } from '@paradoc/resolvers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesRoot = path.resolve(__dirname, '../fixtures/templates')

describe('Text Layers Guide', () => {
  // ============================================================================
  // Step 4: Define the Form
  // ============================================================================

  const leaseAgreement = para.form({
    name: 'lease-agreement',
    title: 'Residential Lease Agreement',
    fields: {
      address: { type: 'address', label: 'Property Address', required: true },
      propertyType: {
        type: 'enum',
        label: 'Property Type',
        enum: [{ value: 'apartment' }, { value: 'house' }, { value: 'condo' }, { value: 'townhouse' }],
        required: true,
      },
      bedrooms: { type: 'number', label: 'Bedrooms', min: 0, max: 10, required: true },
      startDate: { type: 'date', label: 'Lease Start Date', required: true },
      leaseTerm: { type: 'duration', label: 'Lease Term', required: true },
      monthlyRent: { type: 'money', label: 'Monthly Rent', required: true },
      petsAllowed: { type: 'boolean', label: 'Pets Allowed', default: false },
      smokingAllowed: { type: 'boolean', label: 'Smoking Allowed', default: false },
    },
    parties: {
      landlord: {
        label: 'Landlord',
        min: 1,
        max: 1,
        signature: { required: true },
      },
      tenant: {
        label: 'Tenant',
        min: 1,
        max: 4,
        signature: { required: true },
      },
    },
    defaultLayer: 'markdown',
    layers: {
      markdown: {
        kind: 'file',
        mimeType: 'text/markdown',
        path: 'lease.md',
      },
    },
  })

  test('defines form with file layer', () => {
    expect(leaseAgreement.kind).toBe('form')
    expect(leaseAgreement.name).toBe('lease-agreement')
    expect(leaseAgreement.defaultLayer).toBe('markdown')
    expect(leaseAgreement.layers!.markdown.kind).toBe('file')
  })

  // ============================================================================
  // Step 5: Fill the Form
  // ============================================================================

  const filled = leaseAgreement.fill({
    fields: {
      address: {
        line1: '123 Oak Street, Unit 4B',
        locality: 'San Francisco',
        region: 'CA',
        postalCode: '94102',
        country: 'US',
      },
      propertyType: 'apartment',
      bedrooms: 2,
      startDate: '2025-02-01',
      leaseTerm: 'P12M',
      monthlyRent: { amount: 2800, currency: 'USD' },
      petsAllowed: true,
      smokingAllowed: false,
    },
    parties: {
      landlord: { id: 'landlord-1', name: 'Alice Chen' },
      tenant: [
        { id: 'tenant-1', name: 'Bob Smith' },
        { id: 'tenant-2', name: 'Carol Johnson' },
      ],
    },
  })

  test('fills form with data including multiple tenants', () => {
    expect(filled).toBeDefined()
    expect(filled.phase).toBe('draft')
    expect(filled.getField('propertyType')).toBe('apartment')
    expect(filled.getField('bedrooms')).toBe(2)
    expect(filled.getField('petsAllowed')).toBe(true)
    expect(filled.getField('smokingAllowed')).toBe(false)
  })

  test('validates filled form', () => {
    expect(filled.isValid()).toBe(true)
  })

  // ============================================================================
  // Step 6: Render the Document
  // ============================================================================

  test('renders lease agreement with all Handlebars patterns', async () => {
    const resolver = createFsResolver({ root: fixturesRoot })

    const output = await filled.render({
      renderer: textRenderer(),
      resolver,
      layer: 'markdown',
    })

    expect(typeof output).toBe('string')

    // Verify field values
    expect(output).toContain('RESIDENTIAL LEASE AGREEMENT')
    expect(output).toContain('123 Oak Street')
    expect(output).toContain('San Francisco')
    expect(output).toContain('apartment')
    expect(output).toContain('2')
    expect(output).toContain('$2,800.00')

    // Verify party data
    expect(output).toContain('Alice Chen')
    expect(output).toContain('Bob Smith')
    expect(output).toContain('Carol Johnson')

    // Verify conditional output
    expect(output).toContain('permitted')
    expect(output).toContain('not permitted')
  })

  test('renders and writes to temp file', async () => {
    const resolver = createFsResolver({ root: fixturesRoot })
    const output = await filled.render({
      renderer: textRenderer(),
      resolver,
      layer: 'markdown',
    })

    const tempDir = mkdtempSync(join(tmpdir(), 'paradoc-text-test-'))
    try {
      const outputPath = join(tempDir, 'lease-agreement.md')
      writeFileSync(outputPath, output)
      const written = readFileSync(outputPath, 'utf-8')
      expect(written).toBe(output)
      expect(written).toContain('RESIDENTIAL LEASE AGREEMENT')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
