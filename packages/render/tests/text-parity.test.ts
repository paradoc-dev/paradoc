import type { Form } from '@paradoc/types'
import { createFormatter } from '@paradoc/format'
import { describe, expect, it } from 'vitest'
import { ArtifactFieldFormatError, renderText, textRenderer } from '../src/text'

const cases: Array<{ name: string; template: string; data: Record<string, unknown>; expected: string }> = [
  { name: 'nested interpolation', template: 'Hello {{person.name}}', data: { person: { name: 'Ada' } }, expected: 'Hello Ada' },
  { name: 'HTML escaping', template: '{{value}} / {{{value}}}', data: { value: '<b>A & B</b>' }, expected: '&lt;b&gt;A &amp; B&lt;/b&gt; / <b>A & B</b>' },
  { name: 'if and comparison', template: '{{#if (gte count 2)}}many{{else}}few{{/if}}', data: { count: 2 }, expected: 'many' },
  { name: 'unless', template: '{{#unless closed}}open{{else}}closed{{/unless}}', data: { closed: false }, expected: 'open' },
  { name: 'logic helpers', template: '{{#if (and enabled (contains tags "a"))}}yes{{else}}no{{/if}}', data: { enabled: true, tags: ['a'] }, expected: 'yes' },
  { name: 'default helper', template: '{{default label "N/A"}}', data: { label: '' }, expected: 'N/A' },
  { name: 'with context', template: '{{#with person}}{{name}}/{{../title}}{{/with}}', data: { title: 'Dr', person: { name: 'Ada' } }, expected: 'Ada/Dr' },
  { name: 'each metadata', template: '{{#each items}}{{@index}}={{this}}{{#unless @last}},{{/unless}}{{else}}empty{{/each}}', data: { items: ['a', 'b'] }, expected: '0=a,1=b' },
  { name: 'empty each inverse', template: '{{#each items}}{{this}}{{else}}empty{{/each}}', data: { items: [] }, expected: 'empty' },
  { name: 'root lookup in a loop', template: '{{#each items}}{{@root.title}}={{this}}{{/each}}', data: { title: 'T', items: ['a', 'b'] }, expected: 'T=aT=b' },
  { name: 'object loop metadata', template: '{{#each values}}{{@key}}={{this}};{{/each}}', data: { values: { a: 1, b: 2 } }, expected: 'a=1;b=2;' },
  { name: 'standalone block lines', template: 'A\n{{#if yes}}\nB\n{{else}}\nC\n{{/if}}\nD', data: { yes: true }, expected: 'A\nB\nD' },
]

describe('text renderer behavior', () => {
	it('renders lists and lists of lists into Markdown while serializing nested fields', () => {
		const form = {
			fields: {
				groups: {
					type: 'list',
					item: {
						type: 'fieldset',
						fields: {
							name: { type: 'text' },
							amounts: { type: 'list', item: { type: 'money' } },
						},
					},
				},
			},
		} as unknown as Form
		const actual = renderText({
			form,
			template: '{{#each groups}}## {{name}}\n{{#each amounts}}- {{this}}\n{{/each}}{{/each}}',
			data: {
				groups: [
					{ name: 'Labor', amounts: [{ amount: 100, currency: 'USD' }, { amount: 25, currency: 'USD' }] },
					{ name: 'Parts', amounts: [{ amount: 50, currency: 'USD' }] },
				],
			},
		})
		expect(actual).toBe('## Labor\n- $100.00\n- $25.00\n## Parts\n- $50.00\n')
	})

	it('resolves bracket-indexed bindings for list items', () => {
		expect(renderText({
			template: '{{first}}/{{nested}}',
			data: { matrix: [['a', 'b'], ['c']] },
			bindings: { first: 'matrix[0][1]', nested: 'matrix[1][0]' },
		})).toBe('b/c')
	})

  it.each(cases)('$name', ({ template, data, expected }) => {
    expect(renderText({ template, data })).toBe(expected)
  })

  it('applies nested bindings with the same result', () => {
    const options = {
      template: '{{owner_name}} owns {{pet_name}}',
      data: { owner: { name: 'Ada' }, pet: { name: 'Pixel' } },
      bindings: { owner_name: 'owner.name', pet_name: 'pet.name' },
    }
    expect(renderText(options)).toBe('Ada owns Pixel')
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
    { name: 'signature placeholder', template: '{{#with this}}{{signature "final"}}{{/with}}', data: party(), expected: '[SIGNATURE]' },
    { name: 'initials placeholder', template: '{{#with this}}{{initials "final"}}{{/with}}', data: party(), expected: '[INITIALS]' },
    { name: 'signature date placeholder', template: '{{#with this}}{{signatureDate "final"}}{{/with}}', data: party(), expected: '[DATE]' },
    { name: 'capacity fallback', template: '{{#with this}}{{capacity "title"}}{{/with}}', data: party(), expected: 'President' },
    { name: 'printed name fallback', template: '{{#with this}}{{printedName "name"}}{{/with}}', data: party(), expected: 'Ada Lovelace' },
    {
      name: 'captured signature date',
      template: '{{#with this}}{{signatureDate "final"}}{{/with}}',
      data: party([{ role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'final', type: 'signature', timestamp: '2026-07-12T10:30:00Z', method: 'drawn' }]), expected: '2026-07-12',
    },
    {
      name: 'captured capacity',
      template: '{{#with this}}{{capacity "title"}}{{/with}}',
      data: party([{ role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'title', type: 'capacity', text: 'Trustee', timestamp: '2026-07-12T10:30:00Z' }]), expected: 'Trustee',
    },
    {
      name: 'captured printed name',
      template: '{{#with this}}{{printedName "name"}}{{/with}}',
      data: party([{ role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'name', type: 'printed_name', text: 'ADA L LOVELACE', timestamp: '2026-07-12T10:30:00Z' }]), expected: 'ADA L LOVELACE',
    },
  ]

  it.each(signatureCases)('$name', ({ template, data, expected }) => {
    expect(renderText({ template, data })).toBe(expected)
  })

  it('matches captured HTML signature rendering', () => {
    const data = party([{
      role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'final',
      type: 'signature', timestamp: '2026-07-12T10:30:00Z', method: 'drawn', image: 'data:image/png;base64,c2ln',
    }])
    const template = '{{#with this}}{{{signature "final"}}}{{/with}}'
    const signatureOptions = { format: 'html' as const }
    expect(renderText({ template, data, signatureOptions })).toBe('<img src="data:image/png;base64,c2ln" alt="Signature" class="signature-image" data-role="tenant" data-party-id="tenant-1" data-signer-id="signer-1" data-location-id="final" />')
  })

  it('matches captured Markdown initials rendering', () => {
    const data = party([{
      role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'final',
      type: 'initials', timestamp: '2026-07-12T10:30:00Z', method: 'drawn', image: 'data:image/png;base64,aW5pdA==',
    }])
    const template = '{{#with this}}{{initials "final"}}{{/with}}'
    const signatureOptions = { format: 'markdown' as const }
    expect(renderText({ template, data, signatureOptions })).toBe('![Initials](data:image/png;base64,aW5pdA&#x3D;&#x3D;)')
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
      template: '{{fee}}|{{fee.amount}}|{{phone}}|{{phone.number}}|{{address}}|{{address.locality}}',
      data: {
        fee: { amount: 1250, currency: 'USD' },
        phone: { number: '+12025550182', countryCode: 'US' },
        address: { line1: '10 Main St', locality: 'Boston', region: 'MA', postalCode: '02108', country: 'US' },
      },
      form,
    }
    expect(renderText(options)).toBe('$1,250.00|1250|+12025550182|+12025550182|10 Main St, Boston, MA 02108, US|Boston')
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
      form: {
        fields: { name: { type: 'string' } },
        parties: { owner: { label: 'Owner', partyType: 'person' } },
        defs: { term: { type: 'string', value: 'term' } },
      },
    }
    expect(await textRenderer().render(request as never)).toBe('Pixel|Ada|Pet')
  })

  it('applies one custom formatter across nested fields, computed values, and parties', () => {
    const formatter = createFormatter({
      overrides: {
        money: (value, options, context) => `MONEY:${value.amount}:${context.delegate(value, options)}`,
        person: (value) => `PERSON:${value?.name ?? ''}`,
        date: (value) => `DATE:${value instanceof Date ? value.toISOString() : value}`,
      },
      messages: { 'en-US': { 'boolean.true': 'Active', 'boolean.false': 'Inactive' } },
    })
    const form = {
      fields: {
        amount: { type: 'money' },
        when: { type: 'date' },
        enabled: { type: 'boolean' },
        choice: { type: 'enum', enum: [{ value: 'a', label: '<Alpha>' }] },
        choices: { type: 'multiselect', enum: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
        rows: { type: 'list', item: { type: 'fieldset', fields: { amount: { type: 'money' } } } },
      },
      defs: { total: { type: 'money', value: { amount: 'amount', currency: 'currency' } } },
      parties: { owner: { label: 'Owner', partyType: 'person' } },
    } as unknown as Form

    expect(renderText({
      form,
      formatter,
      template: '{{amount}}/{{amount.amount}}/{{when}}/{{enabled}}/{{choice}}/{{choices}}/{{parties.owner}}/{{defs.total}}/{{#each rows}}{{amount}};{{/each}}',
      data: {
        amount: { amount: 12.5, currency: 'USD' },
        when: '2024-01-15',
        enabled: true,
        choice: 'a',
        choices: ['a', 'b'],
        parties: { owner: { name: 'Ada' } },
        defs: { total: { amount: 12.5, currency: 'USD' } },
        rows: [{ amount: { amount: 2, currency: 'USD' } }],
      },
    })).toBe('MONEY:12.5:$12.50/12.5/DATE:2024-01-15/Active/&lt;Alpha&gt;/Alpha, Beta/PERSON:Ada/MONEY:12.5:$12.50/MONEY:2:$2.00;')
  })

  it('keeps missing and incomplete values explicit when progressive presentation is selected', () => {
    const form = {
      fields: {
        amount: { type: 'money' },
        address: { type: 'address' },
      },
    } as unknown as Form

    expect(renderText({
      form,
      progressive: { missing: 'MISSING', incomplete: 'INCOMPLETE' },
      template: '{{amount}}/{{amount.currency}}/{{address}}',
      data: { amount: { currency: 'USD' } },
    })).toBe('INCOMPLETE/USD/MISSING')
  })

  it('raises attributable errors for malformed values and unknown binding paths', () => {
    const form = { fields: { amount: { type: 'money' } } } as unknown as Form

    expect(() => renderText({
      form,
      template: '{{amount}}',
      data: { amount: { amount: 'bad', currency: 'USD' } },
    })).toThrowError(expect.objectContaining({ path: 'fields.amount', status: 'invalid' }))

    expect(() => renderText({
      form,
      template: '{{value}}',
      bindings: { value: 'missing' },
      data: { amount: { amount: 1, currency: 'USD' } },
    })).toThrowError(ArtifactFieldFormatError)
  })
})
