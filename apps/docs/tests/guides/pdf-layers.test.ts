/**
 * Tests for code snippets in guides/pdf-layers.mdx
 */
import { describe, test, expect } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { para, inspectAcroFormFields, pdfRenderer } from '@paradoc/sdk'
import { createFsResolver } from '@paradoc/resolvers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesRoot = path.resolve(__dirname, '../fixtures')

describe('PDF Layers Guide', () => {
  // ============================================================================
  // Step 3: Inspect PDF Fields
  // ============================================================================

  describe('inspect AcroForm fields', () => {
    test('discovers fields from W-9 PDF', async () => {
      const template = readFileSync(join(fixturesRoot, 'pdfs', 'w9.pdf'))
      const fields = await inspectAcroFormFields(new Uint8Array(template))

      expect(fields).toBeDefined()
      expect(Array.isArray(fields)).toBe(true)
      expect(fields.length).toBeGreaterThan(0)

      // Each field has name, type, and optional value/required
      for (const field of fields) {
        expect(field).toHaveProperty('name')
        expect(field).toHaveProperty('type')
        expect(typeof field.name).toBe('string')
        expect(['text', 'checkbox', 'dropdown', 'radio', 'button', 'signature', 'unknown']).toContain(field.type)
      }

      // W-9 has text fields (name, address, etc.)
      const textFields = fields.filter(f => f.type === 'text')
      expect(textFields.length).toBeGreaterThan(0)

      // W-9 has checkbox fields (tax classification)
      const checkboxFields = fields.filter(f => f.type === 'checkbox')
      expect(checkboxFields.length).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // Step 4: Define the Form with PDF Layer and Bindings
  // ============================================================================

  describe('form with PDF layer and bindings', () => {
    const w9Form = para.form({
      name: 'w9-tax-form',
      fields: {
        name: { type: 'text', label: 'Name', required: true },
        businessName: { type: 'text', label: 'Business Name' },
        taxClassification: {
          type: 'enum',
          label: 'Tax Classification',
          enum: [{ value: 'individual' }, { value: 'c_corp' }, { value: 's_corp' }, { value: 'partnership' }, { value: 'llc' }],
          required: true,
        },
        llcTaxCode: { type: 'text', label: 'LLC Tax Code' },
        address: { type: 'address', label: 'Address', required: true },
        ssn: { type: 'text', label: 'SSN' },
        ein: { type: 'text', label: 'EIN' },
      },
      defaultLayer: 'pdf',
      layers: {
        pdf: {
          kind: 'file',
          mimeType: 'application/pdf',
          path: 'pdfs/w9.pdf',
          bindings: {
            'topmostSubform[0].Page1[0].f1_01[0]': 'name',
            'topmostSubform[0].Page1[0].f1_02[0]': 'businessName',
            'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]': 'taxClassification:individual',
            'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]': 'taxClassification:c_corp',
            'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[2]': 'taxClassification:s_corp',
            'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[3]': 'taxClassification:partnership',
            'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[5]': 'taxClassification:llc',
            'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]': 'llcTaxCode',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]': 'address.line1',
            'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]': 'address.locality,address.region,address.postalCode',
            'topmostSubform[0].Page1[0].f1_11[0]': 'ssn:1',
            'topmostSubform[0].Page1[0].f1_12[0]': 'ssn:2',
            'topmostSubform[0].Page1[0].f1_13[0]': 'ssn:3',
            'topmostSubform[0].Page1[0].f1_14[0]': 'ein:1',
            'topmostSubform[0].Page1[0].f1_15[0]': 'ein:2',
          },
        },
      },
    })

    test('defines form with PDF layer and bindings', () => {
      expect(w9Form.kind).toBe('form')
      expect(w9Form.name).toBe('w9-tax-form')
      expect(w9Form.defaultLayer).toBe('pdf')
      expect(w9Form.layers!.pdf).toBeDefined()
      expect(w9Form.layers!.pdf.kind).toBe('file')

      const pdfLayer = w9Form.layers!.pdf as { bindings?: Record<string, string> }
      expect(pdfLayer.bindings).toBeDefined()
      expect(Object.keys(pdfLayer.bindings!).length).toBeGreaterThan(10)
    })

    // ============================================================================
    // Step 5: Fill the Form
    // ============================================================================

    const filled = w9Form.fill({
      fields: {
        name: 'John Smith',
        taxClassification: 'individual',
        address: {
          line1: '123 Main Street',
          locality: 'San Francisco',
          region: 'CA',
          postalCode: '94105',
          country: 'US',
        },
        ssn: '123-45-6789',
      },
    })

    test('fills form with data', () => {
      expect(filled).toBeDefined()
      expect(filled.phase).toBe('draft')
      expect(filled.getField('name')).toBe('John Smith')
      expect(filled.getField('taxClassification')).toBe('individual')
    })

    // ============================================================================
    // Step 6: Render to PDF
    // ============================================================================

    test('renders filled form to PDF', async () => {
      const resolver = createFsResolver({ root: fixturesRoot })

      const output = await filled.render({
        renderer: pdfRenderer(),
        resolver,
        layer: 'pdf',
      })

      expect(output).toBeDefined()
      expect(output).toBeInstanceOf(Uint8Array)
      expect(output.length).toBeGreaterThan(0)

      // Write to temp file and verify
      const tempDir = mkdtempSync(join(tmpdir(), 'paradoc-pdf-test-'))
      try {
        const outputPath = join(tempDir, 'w9-filled.pdf')
        writeFileSync(outputPath, output)
        const written = readFileSync(outputPath)
        expect(written.length).toBe(output.length)
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })
  })
})
