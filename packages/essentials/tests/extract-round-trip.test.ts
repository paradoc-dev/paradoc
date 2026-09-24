/**
 * Fill every bundled essentials form, then read the filled PDF back.
 *
 * The data is built from each PDF layer's own bindings, so every binding the
 * official forms carry is exercised: each exactly reversible binding must
 * return the value it was filled with, and each joined binding must be
 * reported as not recoverable. A new essentials form, or a new binding on an
 * existing one, is covered without editing this file.
 */

import { describe, expect, it } from 'vitest'
import { PdfExtractionError, type FormField, type PdfExtractionEntry } from '@paradoc/core'
import * as essentials from '../src/index.js'
import { w9 } from '../src/tax/w-9.js'
import { f1099NEC } from '../src/tax/1099-nec.js'

type EssentialsForm = (typeof essentials)[keyof typeof essentials]
type Spec = {
  fields?: Record<string, FormField>
  parties?: Record<string, { partyType?: string; max?: number }>
  layers?: Record<string, { mimeType?: string; bindings?: Record<string, string> }>
}

const address = { line1: '1 Main St', line2: 'Suite 2', locality: 'Springfield', region: 'IL', postalCode: '62704', country: 'US' }

function segments(path: string): string[] {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
}

/**
 * A text value that satisfies the field's pattern. It covers the pattern shapes
 * the essentials forms use; an unknown shape fails loudly instead of sampling
 * an invalid value the form would never accept.
 */
function patterned(pattern: string, seed: number): string {
  const first = pattern.replace(/^\^\(?/, '').replace(/\)?\$$/, '').split('|')[0]!
  const digit = (index: number) => String((seed + index) % 10)
  let index = 0
  const value = first
    .replace(/\\d\{(\d+)\}/g, (_, count: string) => Array.from({ length: Number(count) }, () => digit(index++)).join(''))
    .replace(/\[A-Za-z0-9\]\+/g, `A${seed}B`)
    .replace(/\[A-Z\]\{(\d+)\}/g, (_, count: string) => Array.from({ length: Number(count) }, () => String.fromCharCode(65 + (seed + index++) % 26)).join(''))
    .replace(/-\?/g, '-')
  if (!new RegExp(pattern).test(value)) throw new Error(`No sample for pattern ${pattern}`)
  return value
}

/** A value of the field's type that the fill path can write and extraction can read. */
function sample(field: FormField, seed: number): unknown {
  switch (field.type) {
    case 'text': return field.pattern ? patterned(field.pattern, seed) : `Value ${seed}`
    case 'email': return `person${seed}@example.com`
    case 'boolean': return true
    case 'number': return 1000 + seed
    case 'money': return { amount: 1234.5 + seed, currency: 'USD' }
    case 'date': return `2024-03-${String((seed % 27) + 1).padStart(2, '0')}`
    case 'phone': return { number: `+1555010${String(seed % 10000).padStart(4, '0')}` }
    case 'address': return address
    case 'enum': return field.enum[seed % field.enum.length]!.value
    default: throw new Error(`No sample for ${field.type}`)
  }
}

/** A party of the declared type; an `any` party is an organization when a binding reads its legal name. */
function party(partyType: string | undefined, id: string, asOrganization: boolean) {
  const person = { firstName: 'Jane', middleName: 'Q', lastName: 'Public', name: 'Jane Q Public' }
  const organization = { legalName: 'Acme Holdings LLC', name: 'Acme' }
  if (partyType === 'organization' || (partyType !== 'person' && asOrganization)) return { id, ...organization }
  return { id, ...person }
}

interface Plan {
  data: { fields: Record<string, unknown>; parties: Record<string, unknown> }
  /** Paths whose bindings reverse exactly, with the value extraction must return. */
  exact: Map<string, unknown>
  /** Paths only ever written into a joined box. */
  joined: Set<string>
}

function plan(spec: Spec, bindings: Record<string, string>): Plan {
  const fields: Record<string, unknown> = {}
  const parties: Record<string, unknown> = {}
  const exact = new Map<string, unknown>()
  const joined = new Set<string>()
  const splitParts = new Map<string, number>()
  let seed = 0

  const bound = Object.values(bindings).join(',')
  for (const [role, definition] of Object.entries(spec.parties ?? {})) {
    const asOrganization = bound.includes(`parties.${role}.legalName`)
    parties[role] = (definition.max ?? 1) > 1
      ? Array.from({ length: definition.max! }, (_, index) => party(definition.partyType, `${role}-${index}`, asOrganization))
      : party(definition.partyType, `${role}-0`, asOrganization)
  }

  for (const binding of Object.values(bindings)) {
    const qualifier = binding.includes(',') ? undefined : binding.split(':')[1]
    if (qualifier && /^\d+$/.test(qualifier)) {
      const path = binding.split(':')[0]!
      splitParts.set(path, Math.max(splitParts.get(path) ?? 0, Number(qualifier)))
    }
  }

  const valueAt = (path: string): unknown => {
    const [root, ...rest] = segments(path)
    let value: unknown
    if (root === 'parties') value = parties
    else {
      const field = spec.fields![root!]!
      if (!(root! in fields)) {
        const parts = splitParts.get(root!)
        seed += 1
        fields[root!] = parts && field.type === 'text' && !field.pattern
          ? Array.from({ length: parts }, (_, index) => `${seed}${index}`).join('-')
          : sample(field, seed)
      }
      value = fields[root!]
    }
    for (const segment of rest) value = (value as Record<string, unknown>)[segment]
    return value
  }

  for (const binding of Object.values(bindings)) {
    if (binding.includes(',')) {
      for (const path of binding.split(',').map((part) => part.trim())) {
        valueAt(path)
        joined.add(path)
      }
      continue
    }
    const path = binding.split(':')[0]!
    exact.set(path, valueAt(path))
  }

  for (const path of exact.keys()) joined.delete(path)
  return { data: { fields, parties }, exact, joined }
}

function valueIn(data: { fields: Record<string, unknown>; parties?: Record<string, unknown> }, path: string): unknown {
  const [root, ...rest] = segments(path)
  let value: unknown = root === 'parties' ? data.parties : data.fields[root!]
  for (const segment of rest) value = (value as Record<string, unknown> | undefined)?.[segment]
  return value
}

/** Fill the form with every sampled value; a value its PDF field cannot hold fails the test. */
async function fill(form: EssentialsForm, layer: string, planned: Plan): Promise<Uint8Array> {
  return await form.render({ layer, data: planned.data } as never) as Uint8Array
}

const pdfLayers = (form: EssentialsForm) =>
  Object.entries((form.spec as Spec).layers ?? {}).filter(([, layer]) => layer.mimeType === 'application/pdf')

describe('extract from filled essentials forms', () => {
  for (const [name, form] of Object.entries(essentials)) {
    for (const [layer, definition] of pdfLayers(form)) {
      it(`${name} (${layer}) returns every exactly reversible value it was filled with`, async () => {
        const planned = plan(form.spec as Spec, definition.bindings!)
        const pdf = await fill(form, layer, planned)
        const { exact, joined } = planned
        const result = await form.extract(pdf, { layer })
        const byPath = new Map<string, PdfExtractionEntry>(result.report.entries.map((entry) => [entry.path, entry]))

        expect(result.layer).toBe(layer)
        for (const [path, value] of exact) {
          expect({ path, status: byPath.get(path)?.status }).toEqual({ path, status: 'recovered' })
          expect({ path, value: valueIn(result.data, path) }).toEqual({ path, value })
        }
        for (const path of joined) {
          expect({ path, status: byPath.get(path)?.status }).toEqual({ path, status: 'not_recoverable' })
          expect({ path, value: valueIn(result.data, path) }).toEqual({ path, value: undefined })
        }
      })
    }
  }
})

describe('extracted data through the normal fill path', () => {
  const taxpayer = { id: 'taxpayer-0', name: 'Jane Q Public', firstName: 'Jane', lastName: 'Public' }

  it('fills cleanly and reports the required values the PDF did not hold as missing', async () => {
    const pdf = await w9.render({
      data: { fields: { taxClassification: 'individual_or_sole_proprietor', ssn: '123-45-6789' }, parties: { taxpayer } },
    }) as Uint8Array
    const { data } = await w9.extract(pdf)

    expect(data.fields).toEqual({ taxClassification: 'individual_or_sole_proprietor', ssn: '123-45-6789' })
    const filled = w9.safeFill(data as never)
    expect(filled.success).toBe(true)
    if (!filled.success) return
    expect(filled.data.validateRules().valid).toBe(true)
    expect(filled.data.getFillState().openRequired.map((target) => target.key)).toContain('mailingAddress')
  })

  it('names the address parts a joined box kept from being recovered', async () => {
    const pdf = await w9.render({
      data: { fields: { taxClassification: 'individual_or_sole_proprietor', ssn: '123-45-6789', mailingAddress: address }, parties: { taxpayer } },
    }) as Uint8Array
    const { data } = await w9.extract(pdf)

    expect(data.fields.mailingAddress).toEqual({ line1: '1 Main St' })
    const filled = w9.safeFill(data as never)
    expect(filled.success).toBe(false)
    if (filled.success) return
    expect((filled.error as unknown as { errors: Array<{ field: string }> }).errors.map((error) => error.field)).toEqual([
      'fields.mailingAddress.locality',
      'fields.mailingAddress.region',
      'fields.mailingAddress.postalCode',
      'fields.mailingAddress.country',
    ])
  })
})

describe('layer selection on essentials forms', () => {
  it('requires a layer name on a form with several PDF copies', async () => {
    const pdf = await f1099NEC.render({ layer: 'pdfCopyB', data: { fields: {} } }) as Uint8Array
    const error = await f1099NEC.extract(pdf).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(PdfExtractionError)
    expect(error).toMatchObject({ code: 'layer_required', message: expect.stringContaining('pdfCopyB') })
    await expect(f1099NEC.extract(pdf, { layer: 'pdfCopyB' })).resolves.toMatchObject({ layer: 'pdfCopyB' })
  })
})
