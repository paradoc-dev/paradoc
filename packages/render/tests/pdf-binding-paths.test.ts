/**
 * A PDF binding value is a Paradoc path, written bare (`petName`) or with the
 * `fields.` prefix (`fields.petName`). Binding validation accepts both, so
 * filling reads both: a prefixed value must not leave its PDF field blank.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Form } from '@paradoc/types'
import { inspectAcroFormFields, renderPdf } from '../src/pdf'

/** A real PDF whose AcroForm holds `name`, `weight`, `species` and `hasVaccination`. */
const template = new Uint8Array(readFileSync(new URL('./fixtures/pet-addendum.pdf', import.meta.url)))

const form = {
  kind: 'form',
  name: 'pet',
  fields: {
    petName: { type: 'text', label: 'Name' },
    breed: { type: 'text', label: 'Breed' },
    species: { type: 'enum', label: 'Species', enum: [{ value: 'dog' }, { value: 'cat' }] },
  },
} as unknown as Form

async function filled(bindings: Record<string, string>): Promise<Record<string, unknown>> {
  const output = await renderPdf({ template, form, data: { petName: 'Rex', breed: 'Beagle', species: 'dog' }, bindings })
  return Object.fromEntries((await inspectAcroFormFields(output)).map((field) => [field.name, field.value]))
}

describe('PDF binding paths', () => {
  it('fills a bare path', async () => {
    expect((await filled({ name: 'petName' })).name).toBe('Rex')
  })

  it('fills a fields.-prefixed path as the bare path', async () => {
    expect((await filled({ name: 'fields.petName' })).name).toBe('Rex')
  })

  it('fills each fields.-prefixed part of a joined binding', async () => {
    expect((await filled({ name: 'fields.petName, fields.breed' })).name).toBe('Rex, Beagle')
  })

  it('fills a fields.-prefixed choice binding', async () => {
    expect((await filled({ hasVaccination: 'fields.species:dog' })).hasVaccination).toBe(true)
    expect((await filled({ hasVaccination: 'fields.species:cat' })).hasVaccination).toBe(false)
  })

  it('still refuses a path the form does not declare', async () => {
    await expect(filled({ name: 'fields.nickname' })).rejects.toThrow('Unknown field path "fields.nickname"')
  })
})
