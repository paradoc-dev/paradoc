/**
 * Tests for renderPdf function
 */

import { describe, test, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderPdf } from '../src/render'
import type { Form } from '@paradoc/core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('renderPdf', () => {
  const testData = {
    name: 'Fluffy',
    species: 'cat',
    weight: 12,
    hasVaccination: true,
  }

  const formDefinition: Form = {
    kind: 'form',
    name: 'pet-addendum',
    version: '1.0.0',
    title: 'Pet Addendum',
    fields: {
      name: {
        type: 'text',
        label: 'Pet Name',
      },
      species: {
        type: 'enum',
        enum: [{ value: 'dog' }, { value: 'cat' }, { value: 'bird' }, { value: 'rabbit' }, { value: 'hamster' }],
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

  test('renders PDF template with pet data', async () => {
    const templatePath = path.join(__dirname, 'fixtures', 'pet-addendum.pdf')

    if (!fs.existsSync(templatePath)) {
      console.log('⚠️  No pet-addendum.pdf found in tests/fixtures/')
      console.log('   Run: node tests/create-pdf-fixture.mjs')
      return
    }

    // Read template
    const template = fs.readFileSync(templatePath)
    expect(template).toBeDefined()
    expect(template.length).toBeGreaterThan(0)

    // Render
    const output = await renderPdf({
      template: new Uint8Array(template),
      form: formDefinition,
      data: testData,
    })

    expect(output).toBeDefined()
    expect(output.length).toBeGreaterThan(0)
    expect(output).toBeInstanceOf(Uint8Array)

    // Ensure output directory exists
    const outputDir = path.join(__dirname, 'output')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write output to file
    fs.writeFileSync(path.join(outputDir, 'pet-addendum-rendered.pdf'), output)
    console.log('Rendered PDF file written to output/pet-addendum-rendered.pdf')
  })
})
