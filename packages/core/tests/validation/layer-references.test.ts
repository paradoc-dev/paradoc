/**
 * `validate()` and `validateLayers()` report what a layer or an instruction
 * refers to and cannot resolve: a PDF binding whose value is not a Paradoc
 * path (an inverted binding among them), a binding whose key is not an
 * AcroForm field of the template, and a template or instructions file that
 * cannot be read. Each is an error, because render or seal would fail on it.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createMemoryResolver } from '@paradoc/resolvers/memory'
import { validate, validateLayers } from '@/index'

/** A real PDF whose AcroForm holds `name`, `weight`, `species` and `hasVaccination`. */
const petAddendum = new Uint8Array(readFileSync(new URL('./fixtures/pet-addendum.pdf', import.meta.url)))

/** A PDF with one page and no AcroForm. */
const plainPdf = new TextEncoder().encode([
  '%PDF-1.4',
  '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
  '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
  '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj',
  'trailer << /Root 1 0 R >>',
  '%%EOF',
].join('\n'))

const resolver = createMemoryResolver({
  contents: {
    'pet.pdf': petAddendum,
    'plain.pdf': plainPdf,
    'terms.md': 'Hello {{fields.petName}}',
    'guide.md': 'Fill in the pet details.',
  },
})

const fields = {
  petName: { type: 'text', label: 'Pet name', maxLength: 10 },
  petWeight: { type: 'number', label: 'Weight', min: 0, max: 100 },
  petSpecies: { type: 'enum', label: 'Species', enum: [{ value: 'dog' }, { value: 'cat' }] },
  vaccinated: { type: 'boolean', label: 'Vaccinated' },
}

const correctBindings = {
  name: 'petName',
  weight: 'fields.petWeight',
  species: 'petSpecies',
  hasVaccination: 'vaccinated',
}

function pdfForm(bindings: Record<string, string>, path = 'pet.pdf', extra: Record<string, unknown> = {}) {
  return {
    kind: 'form',
    name: 'pet',
    version: '1.0.0',
    title: 'Pet',
    fields,
    layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path, bindings } },
    ...extra,
  }
}

describe('PDF binding values', () => {
  it('passes bindings whose values are known paths', () => {
    expect(validate(pdfForm(correctBindings)).issues).toBeUndefined()
  })

  it('passes known paths in joined, split and choice bindings', () => {
    const result = validate(pdfForm({ name: 'petName, petSpecies', weight: 'petName:2', species: 'petSpecies:dog' }))
    expect(result.issues).toBeUndefined()
  })

  it('fails an inverted binding, naming the key and saying the binding is inverted', () => {
    const result = validate(pdfForm({ petName: 'name' }))
    expect(result.issues).toEqual([{
      message: 'Layer "pdf", binding "petName": "name" is not a known Paradoc path (Unknown field path "name"). '
        + 'The key "petName" is a field of this artifact: bindings map AcroForm field names (keys) to Paradoc paths (values).',
      path: ['layers', 'pdf', 'bindings', 'petName'],
    }])
  })

  it('fails an unknown value path, naming the key', () => {
    const result = validate(pdfForm({ ...correctBindings, name: 'fields.nickname' }))
    expect(result.issues).toEqual([{
      message: 'Layer "pdf", binding "name": "fields.nickname" is not a known Paradoc path (Unknown field path "fields.nickname").',
      path: ['layers', 'pdf', 'bindings', 'name'],
    }])
  })

  it('checks each part of a joined binding', () => {
    const result = validate(pdfForm({ name: 'petName, owner' }))
    expect(result.issues).toEqual([expect.objectContaining({
      message: expect.stringMatching(/^Layer "pdf", binding "name": "owner" is not a known Paradoc path/),
      path: ['layers', 'pdf', 'bindings', 'name'],
    })])
  })

  it('fails a binding it cannot parse, naming the key and the problem', () => {
    const result = validate(pdfForm({ ...correctBindings, name: 'petName:1, petSpecies', weight: 'petWeight: ' }))
    expect(result.issues).toEqual([
      {
        message: 'Layer "pdf", binding "name": Binding "petName:1, petSpecies" qualifies a part of a joined binding; a joined binding reads whole values.',
        path: ['layers', 'pdf', 'bindings', 'name'],
      },
      {
        message: 'Layer "pdf", binding "weight": Binding "petWeight: " has an empty qualifier after "petWeight:".',
        path: ['layers', 'pdf', 'bindings', 'weight'],
      },
    ])
  })

  it('fails a binding to a root fill data never carries', () => {
    const result = validate(pdfForm({ ...correctBindings, name: 'title' }))
    expect(result.issues).toEqual([expect.objectContaining({
      message: 'Layer "pdf", binding "name": "title" is not a known Paradoc path (Unknown field path "title").',
    })])
  })

  it('fails an unknown party role and an unknown computed value', () => {
    const result = validate(pdfForm({ name: 'parties.buyer.name', weight: 'defs.total' }))
    expect(result.issues?.map((issue) => issue.path)).toEqual([
      ['layers', 'pdf', 'bindings', 'name'],
      ['layers', 'pdf', 'bindings', 'weight'],
    ])
  })

  it('stops at the first issue when collectAllErrors is false', () => {
    const result = validate(pdfForm({ name: 'one', weight: 'two' }), { collectAllErrors: false })
    expect(result.issues).toHaveLength(1)
  })
})

describe('PDF binding keys', () => {
  it('passes a correct PDF layer through validateLayers', async () => {
    const result = await validateLayers(pdfForm(correctBindings), { resolver })
    expect(result.issues).toBeUndefined()
  })

  it('fails a key that is not an AcroForm field of the template, naming the key', async () => {
    const result = await validateLayers(pdfForm({ ...correctBindings, petName: 'petName' }), { resolver })
    expect(result.issues).toEqual([expect.objectContaining({
      message: 'Layer "pdf", binding "petName": "petName" is not an AcroForm field in "pet.pdf". Its fields are: name, weight, species, hasVaccination.',
      path: ['layers', 'pdf', 'bindings', 'petName'],
      severity: 'error',
    })])
  })

  it('fails every key of a template that has no AcroForm', async () => {
    const result = await validateLayers(pdfForm({ name: 'petName' }, 'plain.pdf'), { resolver })
    expect(result.issues).toEqual([expect.objectContaining({
      message: 'Layer "pdf", binding "name": "name" is not an AcroForm field in "plain.pdf". It has no AcroForm fields.',
      path: ['layers', 'pdf', 'bindings', 'name'],
    })])
  })

  it('checks the keys a layer reuses through bindingsFrom against its own template', async () => {
    const base = pdfForm(correctBindings)
    const form = { ...base, layers: { ...base.layers, flat: { kind: 'file', mimeType: 'application/pdf', path: 'plain.pdf', bindingsFrom: 'pdf' } } }
    const result = await validateLayers(form, { resolver })
    expect(result.issues).toEqual(Object.keys(correctBindings).map((key) => expect.objectContaining({
      message: `Layer "flat", binding "${key}" (from layer "pdf"): "${key}" is not an AcroForm field in "plain.pdf". It has no AcroForm fields.`,
      path: ['layers', 'flat', 'bindingsFrom'],
    })))
  })
})

describe('unreadable files', () => {
  const textForm = (layerPath: string, extra: Record<string, unknown> = {}) => ({
    kind: 'form',
    name: 'terms',
    version: '1.0.0',
    title: 'Terms',
    fields,
    layers: { md: { kind: 'file', mimeType: 'text/markdown', path: layerPath } },
    ...extra,
  })

  it('fails a template file that cannot be read', async () => {
    const result = await validateLayers(textForm('missing.md'), { resolver })
    expect(result.issues).toEqual([expect.objectContaining({
      message: expect.stringMatching(/^Layer "md" could not be read from "missing\.md"/),
      path: ['layers', 'md'],
    })])
  })

  it('fails a template file that cannot be read when logic validation is off', async () => {
    const result = await validateLayers(textForm('missing.md'), { resolver, logic: false })
    expect(result.issues).toEqual([expect.objectContaining({ path: ['layers', 'md'] })])
  })

  it('reports an unreadable PDF template once', async () => {
    const result = await validateLayers(pdfForm(correctBindings, 'missing.pdf'), { resolver })
    expect(result.issues).toEqual([expect.objectContaining({
      message: expect.stringMatching(/^Layer "pdf" could not be read from "missing\.pdf"/),
      path: ['layers', 'pdf'],
    })])
  })

  it('fails a missing PDF template on a document, and a missing file of any other type', async () => {
    const result = await validateLayers({
      kind: 'document',
      name: 'letter',
      version: '1.0.0',
      title: 'Letter',
      layers: {
        pdf: { kind: 'file', mimeType: 'application/pdf', path: 'missing.pdf' },
        json: { kind: 'file', mimeType: 'application/json', path: 'missing.json' },
      },
    }, { resolver })
    expect(result.issues?.map((issue) => issue.path)).toEqual([['layers', 'pdf'], ['layers', 'json']])
  })

  it('does not read a React layer, whose path names a module', async () => {
    const result = await validateLayers(textForm('terms.md', {
      layers: { md: { kind: 'file', mimeType: 'text/markdown', path: 'terms.md' }, react: { kind: 'file', mimeType: 'text/tsx', path: 'Layer.tsx' } },
    }), { resolver })
    expect(result.issues).toBeUndefined()
  })

  it('passes readable template and instructions files', async () => {
    const guide = { kind: 'file', mimeType: 'text/markdown', path: 'guide.md' }
    const result = await validateLayers(textForm('terms.md', { instructions: guide, agentInstructions: guide }), { resolver })
    expect(result.issues).toBeUndefined()
  })

  it('fails an instructions file that cannot be read', async () => {
    const result = await validateLayers(textForm('terms.md', {
      instructions: { kind: 'file', mimeType: 'text/markdown', path: 'missing-guide.md' },
    }), { resolver })
    expect(result.issues).toEqual([expect.objectContaining({
      message: expect.stringMatching(/^instructions could not be read from "missing-guide\.md"/),
      path: ['instructions'],
    })])
  })

  it('fails an agentInstructions file that cannot be read, on an artifact with no layers', async () => {
    const result = await validateLayers({
      kind: 'checklist',
      name: 'steps',
      version: '1.0.0',
      title: 'Steps',
      items: [{ id: 'one', title: 'One' }],
      agentInstructions: { kind: 'file', mimeType: 'text/markdown', path: 'missing-agent.md' },
    }, { resolver })
    expect(result.issues).toEqual([expect.objectContaining({
      message: expect.stringMatching(/^agentInstructions could not be read from "missing-agent\.md"/),
      path: ['agentInstructions'],
    })])
  })

  it('fails an unreadable agentInstructions file on a bundle', async () => {
    const result = await validateLayers({
      kind: 'bundle',
      name: 'pack',
      version: '1.0.0',
      title: 'Pack',
      contents: [],
      agentInstructions: { kind: 'file', mimeType: 'text/markdown', path: 'missing-agent.md' },
    }, { resolver })
    expect(result.issues).toEqual([expect.objectContaining({
      message: expect.stringMatching(/^agentInstructions could not be read from "missing-agent\.md"/),
      path: ['agentInstructions'],
    })])
  })

  it('leaves inline instructions alone', async () => {
    const result = await validateLayers(textForm('terms.md', { instructions: { kind: 'inline', text: 'Read me' } }), { resolver })
    expect(result.issues).toBeUndefined()
  })
})
