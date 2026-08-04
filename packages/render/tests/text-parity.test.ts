import { renderText as renderExisting } from '@paradoc/renderer-text'
import { textRenderer as existingTextRenderer } from '@paradoc/renderer-text'
import type { Form } from '@paradoc/types'
import { describe, expect, it } from 'vitest'
import { renderText, textRenderer } from '../src/text'

const cases: Array<{ name: string; template: string; data: Record<string, unknown> }> = [
  { name: 'nested interpolation', template: 'Hello {{person.name}}', data: { person: { name: 'Ada' } } },
  { name: 'HTML escaping', template: '{{value}} / {{{value}}}', data: { value: '<b>A & B</b>' } },
  { name: 'if and comparison', template: '{{#if (gte count 2)}}many{{else}}few{{/if}}', data: { count: 2 } },
  { name: 'unless', template: '{{#unless closed}}open{{else}}closed{{/unless}}', data: { closed: false } },
  { name: 'logic helpers', template: '{{#if (and enabled (contains tags "a"))}}yes{{else}}no{{/if}}', data: { enabled: true, tags: ['a'] } },
  { name: 'default helper', template: '{{default label "N/A"}}', data: { label: '' } },
  { name: 'with context', template: '{{#with person}}{{name}}/{{../title}}{{/with}}', data: { title: 'Dr', person: { name: 'Ada' } } },
  { name: 'each metadata', template: '{{#each items}}{{@index}}={{this}}{{#unless @last}},{{/unless}}{{else}}empty{{/each}}', data: { items: ['a', 'b'] } },
  { name: 'empty each inverse', template: '{{#each items}}{{this}}{{else}}empty{{/each}}', data: { items: [] } },
  { name: 'root lookup in a loop', template: '{{#each items}}{{@root.title}}={{this}}{{/each}}', data: { title: 'T', items: ['a', 'b'] } },
  { name: 'object loop metadata', template: '{{#each values}}{{@key}}={{this}};{{/each}}', data: { values: { a: 1, b: 2 } } },
  { name: 'standalone block lines', template: 'A\n{{#if yes}}\nB\n{{else}}\nC\n{{/if}}\nD', data: { yes: true } },
]

describe('text renderer parity', () => {
  it.each(cases)('$name', ({ template, data }) => {
    expect(renderText({ template, data })).toBe(renderExisting({ template, data }))
  })

  it('applies nested bindings with the same result', () => {
    const options = {
      template: '{{owner_name}} owns {{pet_name}}',
      data: { owner: { name: 'Ada' }, pet: { name: 'Pixel' } },
      bindings: { owner_name: 'owner.name', pet_name: 'pet.name' },
    }
    expect(renderText(options)).toBe(renderExisting(options))
  })

  const party = (captures: unknown[] = []) => ({
    _role: 'tenant',
    id: 'tenant-1',
    signatories: [{
      signerId: 'signer-1',
      capacity: 'President',
      signer: {
        id: 'signer-1',
        person: { name: 'Ada Lovelace' },
        adopted: {
          signature: { image: 'data:image/png;base64,c2ln' },
          initials: { image: 'data:image/png;base64,aW5pdA==' },
        },
      },
    }],
    _captures: captures,
    _signers: {
      'signer-1': { id: 'signer-1', person: { name: 'Ada Lovelace' } },
    },
  })

  const signatureCases = [
    { name: 'signature placeholder', template: '{{#with this}}{{signature "final"}}{{/with}}', data: party() },
    { name: 'initials placeholder', template: '{{#with this}}{{initials "final"}}{{/with}}', data: party() },
    { name: 'signature date placeholder', template: '{{#with this}}{{signatureDate "final"}}{{/with}}', data: party() },
    { name: 'capacity fallback', template: '{{#with this}}{{capacity "title"}}{{/with}}', data: party() },
    { name: 'printed name fallback', template: '{{#with this}}{{printedName "name"}}{{/with}}', data: party() },
    {
      name: 'captured signature date',
      template: '{{#with this}}{{signatureDate "final"}}{{/with}}',
      data: party([{ role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'final', type: 'signature', timestamp: '2026-07-12T10:30:00Z', method: 'drawn' }]),
    },
    {
      name: 'captured capacity',
      template: '{{#with this}}{{capacity "title"}}{{/with}}',
      data: party([{ role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'title', type: 'capacity', text: 'Trustee', timestamp: '2026-07-12T10:30:00Z' }]),
    },
    {
      name: 'captured printed name',
      template: '{{#with this}}{{printedName "name"}}{{/with}}',
      data: party([{ role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'name', type: 'printed_name', text: 'ADA L LOVELACE', timestamp: '2026-07-12T10:30:00Z' }]),
    },
  ]

  it.each(signatureCases)('matches $name', ({ template, data }) => {
    expect(renderText({ template, data })).toBe(renderExisting({ template, data }))
  })

  it('matches captured HTML signature rendering', () => {
    const data = party([{
      role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'final',
      type: 'signature', timestamp: '2026-07-12T10:30:00Z', method: 'drawn', image: 'data:image/png;base64,c2ln',
    }])
    const template = '{{#with this}}{{{signature "final"}}}{{/with}}'
    const signatureOptions = { format: 'html' as const }
    expect(renderText({ template, data, signatureOptions }))
      .toBe(renderExisting({ template, data, signatureOptions }))
  })

  it('matches captured Markdown initials rendering', () => {
    const data = party([{
      role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'final',
      type: 'initials', timestamp: '2026-07-12T10:30:00Z', method: 'drawn', image: 'data:image/png;base64,aW5pdA==',
    }])
    const template = '{{#with this}}{{initials "final"}}{{/with}}'
    const signatureOptions = { format: 'markdown' as const }
    expect(renderText({ template, data, signatureOptions }))
      .toBe(renderExisting({ template, data, signatureOptions }))
  })

  it('matches automatic field serialization while preserving raw properties', () => {
    const form = {
      fields: {
        fee: { type: 'money' },
        phone: { type: 'phone' },
        address: { type: 'address' },
      },
    } as unknown as Form
    const options = {
      template: '{{fee}}|{{fee.amount}}|{{phone}}|{{phone.number}}|{{address}}|{{address.city}}',
      data: {
        fee: { amount: 1250, currency: 'USD' },
        phone: { number: '+12025550182', countryCode: 'US' },
        address: { line1: '10 Main St', city: 'Boston', region: 'MA', postalCode: '02108', country: 'US' },
      },
      form,
    }
    expect(renderText(options)).toBe(renderExisting(options))
  })

  it('matches the Paradoc renderer adapter data shape', async () => {
    const request = {
      template: {
        type: 'text',
        content: '{{name}}|{{parties.owner.name}}|{{defs.term}}',
        bindings: undefined,
      },
      data: {
        fields: {
          name: 'Pixel',
          parties: { owner: { name: 'Ada' } },
          defs: { term: 'Pet' },
        },
      },
      form: { fields: { name: { type: 'string' } } },
    }
    const actual = await textRenderer().render(request as never)
    const expected = await existingTextRenderer().render(request as never)
    expect(actual).toBe(expected)
  })
})
