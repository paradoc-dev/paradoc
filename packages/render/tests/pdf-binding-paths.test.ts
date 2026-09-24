/**
 * A PDF binding value is a Paradoc path, written bare (`petName`) or with the
 * `fields.` prefix (`fields.petName`). Binding validation accepts both, so
 * filling reads both: a prefixed value must not leave its PDF field blank.
 *
 * Fill, overlays, and validation read a binding through one parser, so they
 * agree on the prefix, on space around a `:` qualifier, and on the roots fill
 * data carries.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Form } from '@paradoc/types'
import { inspectAcroFormFields, PdfBindingKeyError, PdfBindingSyntaxError, renderPdf } from '../src/pdf'
import { acroFormPdf, pagePdf, textFieldsPdf } from './pdf-fixtures'

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

  it('checks an option box whose qualifier has space around it', async () => {
    expect((await filled({ hasVaccination: 'fields.species : dog' })).hasVaccination).toBe(true)
    expect((await filled({ hasVaccination: 'species: cat' })).hasVaccination).toBe(false)
  })

  it('refuses a binding whose key names no PDF field, naming the key', async () => {
    const error = await filled({ name: 'petName', nmae: 'breed' }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(PdfBindingKeyError)
    expect((error as PdfBindingKeyError).keys).toEqual(['nmae'])
    expect((error as Error).message).toMatch(/does not have: "nmae"\. Template fields: .*name/)
  })

  it('fills a split part only for a whole-number qualifier', async () => {
    const splitForm = { kind: 'form', name: 's', fields: { ssn: { type: 'text', label: 'SSN' } } } as unknown as Form
    const part = async (binding: string) => {
      const output = await renderPdf({ template: textFieldsPdf(['part']), form: splitForm, data: { ssn: '123-45-6789' }, bindings: { part: binding } })
      return (await inspectAcroFormFields(output))[0]?.value
    }
    expect(await part('ssn:2')).toBe('45')
    expect(await part('ssn:2x')).toBe('')
    expect(await part('ssn:0')).toBe('')
  })

  it('refuses bindings on a template with no form fields', async () => {
    await expect(renderPdf({ template: pagePdf([[300, 300]]), data: { petName: 'Rex' }, bindings: { name: 'petName' } }))
      .rejects.toThrow('PDF bindings name form fields the template does not have: "name". The template has no form fields')
  })

  it('refuses a joined binding that qualifies a part', async () => {
    await expect(filled({ name: 'petName, species:dog' })).rejects.toThrow(PdfBindingSyntaxError)
  })

  it('refuses a binding to a root fill data never carries', async () => {
    for (const root of ['title', 'description', 'items']) {
      await expect(filled({ name: root })).rejects.toThrow(`Unknown field path "${root}"`)
    }
  })

  it('accepts a binding to the signer roots fill data carries', async () => {
    const output = await renderPdf({ template: textFieldsPdf(['signer']), form, data: { _signers: { s1: { name: 'Ada' } } }, bindings: { signer: '_signers.s1.name' } })
    expect((await inspectAcroFormFields(output))[0]?.value).toBe('Ada')
  })
})

describe('text overlay field paths', () => {
  const overlay = (field: string) => renderPdf({ template: pagePdf([[300, 300]]), form, data: { petName: 'Rex' }, overlays: [{ page: 1, x: 10, y: 10, field }] })
  const drawn = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes).match(/\([^)]*\) Tj/g)

  it('draws a bare overlay field', async () => {
    expect(drawn(await overlay('petName'))).toEqual(['(Rex) Tj'])
  })

  it('draws a fields.-prefixed overlay field as the bare path', async () => {
    expect(drawn(await overlay('fields.petName'))).toEqual(['(Rex) Tj'])
  })

  it('refuses an overlay field the form does not declare', async () => {
    await expect(overlay('fields.nickname')).rejects.toThrow('Unknown field path "fields.nickname"')
  })
})

describe('checkbox qualifiers on a purpose-built form', () => {
  it('checks the box for `status: married` as for `status:married`', async () => {
    const statusForm = { kind: 'form', name: 'q', fields: { status: { type: 'enum', label: 'Status', enum: [{ value: 'single' }, { value: 'married' }] } } } as unknown as Form
    for (const binding of ['status:married', 'status: married']) {
      const output = await renderPdf({ template: acroFormPdf([{ kind: 'checkbox', name: 'married_box' }]), form: statusForm, data: { status: 'married' }, bindings: { married_box: binding } })
      expect((await inspectAcroFormFields(output))[0]?.value).toBe(true)
    }
  })
})
