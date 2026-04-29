/**
 * Tests for renderPdf function with field bindings
 */

import { describe, test, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderPdf } from '../src/render'
import type { Form } from '@paradoc/core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('renderPdf with bindings', () => {
  const testData = {
    name: 'Fluffy',
    species: 'cat',
    weight: 12,
    hasVaccination: true,
  }

  const formDefinition: Form = {
    kind: 'form',
    name: 'pet-addendum-2',
    version: '1.0.0',
    title: 'Pet Addendum',
    fields: {
      name: {
        type: 'text',
        label: 'Pet Name',
      },
      species: {
        type: 'enum',
        enum: ['dog', 'cat', 'bird', 'rabbit', 'hamster'],
        label: 'Species',
      },
      weight: {
        type: 'number',
        label: 'Weight (lbs)',
      },
      hasVaccination: {
        type: 'boolean',
        label: 'Has Vaccination',
      },
    },
  }

  // Bindings format: { pdfFieldName: formDataExpression }
  // Keys are the field names in the PDF, values are the form data paths
  const bindings = {
    pet_name: 'name',
    SPECIES: 'species',
    petWeight: 'weight',
    is_vaccinated: 'hasVaccination',
  }

  test('renders PDF template with pet data using bindings', async () => {
    const templatePath = path.join(__dirname, 'fixtures', 'pet-addendum-2.pdf')

    if (!fs.existsSync(templatePath)) {
      console.log('⚠️  No pet-addendum-2.pdf found in tests/fixtures/')
      return
    }

    // Read template
    const template = fs.readFileSync(templatePath)
    expect(template).toBeDefined()
    expect(template.length).toBeGreaterThan(0)

    // Render with bindings
    const output = await renderPdf({
      template: new Uint8Array(template),
      form: formDefinition,
      data: testData,
      bindings,
    })

    expect(output).toBeDefined()
    expect(output.length).toBeGreaterThan(0)
    expect(output).toBeInstanceOf(Uint8Array)

    // Write output to file
    const outputPath = path.join(__dirname, 'output', 'pet-addendum-2-rendered.pdf')

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    fs.writeFileSync(outputPath, output)
    console.log('Rendered PDF file written to output/pet-addendum-2-rendered.pdf')
  })
})
