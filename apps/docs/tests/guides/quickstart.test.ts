/**
 * Tests for code snippets in quickstart.mdx
 */
import { describe, test, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { para, textRenderer } from '@paradoc/sdk'
import { createFsResolver } from '@paradoc/resolvers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesRoot = path.resolve(__dirname, '../fixtures/templates')

describe('Quickstart Guide', () => {
  // ============================================================================
  // Step 2: Define the Form
  // ============================================================================

  const purchaseAgreement = para
    .form()
    .name('purchase-agreement')
    .title('Purchase Agreement')
    .version('1.0.0')
    .parties({
      buyer: para.party().label('Buyer').signature({ required: true }),
      seller: para.party().label('Seller').signature({ required: true }),
    })
    .fields({
      quantity: para.field.number().label('Quantity').required(),
      price: para.field.money().label('Price').required(),
      date: para.field.date().label('Date').required(),
    })
    .layers({
      markdown: para.layer().file().mimeType('text/markdown').path('purchase-agreement.md'),
    })
    .defaultLayer('markdown')
    .build()

  test('defines the form correctly', () => {
    expect(purchaseAgreement).toBeDefined()
    expect(purchaseAgreement.kind).toBe('form')
    expect(purchaseAgreement.name).toBe('purchase-agreement')
    expect(purchaseAgreement.title).toBe('Purchase Agreement')
    expect(purchaseAgreement.version).toBe('1.0.0')
    expect(purchaseAgreement.fields).toBeDefined()
    expect(Object.keys(purchaseAgreement.fields!)).toEqual(['quantity', 'price', 'date'])
    expect(Object.keys(purchaseAgreement.parties!)).toEqual(['buyer', 'seller'])
  })

  // ============================================================================
  // Step 4: Populate
  // ============================================================================

  const draft = purchaseAgreement.fill({
    fields: {
      quantity: 100,
      price: { amount: 25, currency: 'USD' },
      date: '2025-03-01',
    },
    parties: {
      buyer: { id: 'buyer-1', name: 'Alice Johnson' },
      seller: { id: 'seller-1', name: 'Bob Smith' },
    },
  })

  test('fills the form with data', () => {
    expect(draft).toBeDefined()
    expect(draft.phase).toBe('draft')
    expect(draft.getField('quantity')).toBe(100)
    expect(draft.getField('date')).toBe('2025-03-01')
  })

  // ============================================================================
  // Step 5: Validate
  // ============================================================================

  test('validates the filled form', () => {
    expect(draft.isValid()).toBe(true)
  })

  // ============================================================================
  // Step 6: Render
  // ============================================================================

  test('renders the purchase agreement', async () => {
    const renderer = textRenderer()
    const resolver = createFsResolver({ root: fixturesRoot })

    const output = await draft.render({ renderer, resolver, layer: 'markdown' })

    expect(output).toContain('Purchase Agreement')
    expect(output).toContain('Alice Johnson')
    expect(output).toContain('Bob Smith')
    expect(output).toContain('100')
    expect(output).toContain('$25.00')
    expect(output).toContain('2025-03-01')
  })

  // ============================================================================
  // Step 7: Save Artifact
  // ============================================================================

  test('serializes to JSON', () => {
    const json = purchaseAgreement.toJSON()
    expect(json).toBeDefined()
    expect(typeof json).toBe('object')
    expect(json.kind).toBe('form')
    expect(json.name).toBe('purchase-agreement')
  })

  test('serializes to YAML', () => {
    const yaml = purchaseAgreement.toYAML()
    expect(yaml).toBeDefined()
    expect(typeof yaml).toBe('string')
    expect(yaml).toContain('kind: form')
    expect(yaml).toContain('name: purchase-agreement')
  })

  test('round-trips through JSON', () => {
    const jsonStr = JSON.stringify(purchaseAgreement.toJSON())
    const loaded = para.load(jsonStr)
    expect(loaded.kind).toBe('form')
    expect(loaded.name).toBe('purchase-agreement')
    expect(loaded.title).toBe('Purchase Agreement')
  })

  test('round-trips through YAML', () => {
    const yaml = purchaseAgreement.toYAML()
    const loaded = para.load(yaml)
    expect(loaded.kind).toBe('form')
    expect(loaded.name).toBe('purchase-agreement')
  })
})
