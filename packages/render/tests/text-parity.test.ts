import type { Form, RenderRequest } from '@paradoc/types'
import { createFormatter } from '@paradoc/format'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { renderText, textRenderer, type RenderTextOptions } from '../src/text'

const cases: Array<{ name: string; template: string; data: Record<string, unknown>; expected: string }> = [
  { name: 'nested interpolation', template: 'Hello {{fields.person.name}}', data: { person: { name: 'Ada' } }, expected: 'Hello Ada' },
  { name: 'if and comparison', template: '{{#if fields.count >= 2}}many{{else}}few{{/if}}', data: { count: 2 }, expected: 'many' },
  { name: 'unless', template: '{{#unless fields.closed}}open{{else}}closed{{/unless}}', data: { closed: false }, expected: 'open' },
  { name: 'logic operators', template: '{{#if fields.enabled and "a" in fields.tags}}yes{{else}}no{{/if}}', data: { enabled: true, tags: ['a'] }, expected: 'yes' },
  { name: 'coalesce', template: '{{coalesce(fields.label, "N/A")}}', data: { label: null }, expected: 'N/A' },
  { name: 'full paths', template: '{{fields.person.name}}/{{fields.title}}', data: { title: 'Dr', person: { name: 'Ada' } }, expected: 'Ada/Dr' },
  { name: 'loop position', template: '{{#each fields.items}}{{index(item)}}={{item}}{{#unless last(item)}},{{/unless}}{{else}}empty{{/each}}', data: { items: ['a', 'b'] }, expected: '0=a,1=b' },
  { name: 'first row', template: '{{#each fields.items}}{{#if first(item)}}[{{/if}}{{item}}{{/each}}', data: { items: ['a', 'b'] }, expected: '[ab' },
  { name: 'empty each inverse', template: '{{#each fields.items}}{{item}}{{else}}empty{{/each}}', data: { items: [] }, expected: 'empty' },
  { name: 'missing list reads as no rows', template: '{{#each fields.items}}{{item}}{{else}}none{{/each}}', data: {}, expected: 'none' },
  { name: 'root paths in a loop', template: '{{#each fields.items}}{{fields.title}}={{item}}{{/each}}', data: { title: 'T', items: ['a', 'b'] }, expected: 'T=aT=b' },
  { name: 'parent row', template: '{{#each fields.groups}}{{#each item.tags}}{{parent.name}}:{{item}};{{/each}}{{/each}}', data: { groups: [{ name: 'g', tags: ['x', 'y'] }] }, expected: 'g:x;g:y;' },
  { name: 'standalone block lines', template: 'A\n{{#if fields.yes}}\nB\n{{else}}\nC\n{{/if}}\nD', data: { yes: true }, expected: 'A\nB\nD' },
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
			template: '{{#each fields.groups}}## {{item.name}}\n{{#each item.amounts}}- {{item}}\n{{/each}}{{/each}}',
			data: {
				groups: [
					{ name: 'Labor', amounts: [{ amount: 100, currency: 'USD' }, { amount: 25, currency: 'USD' }] },
					{ name: 'Parts', amounts: [{ amount: 50, currency: 'USD' }] },
				],
			},
		})
		expect(actual).toBe('## Labor\n- $100.00\n- $25.00\n## Parts\n- $50.00\n')
	})

  it.each(cases)('$name', ({ template, data, expected }) => {
    expect(renderText({ template, data })).toBe(expected)
  })

  const escapingCases = [
    { mimeType: 'text/plain', expected: "Name: O'Brien <b> / Smith & Sons" },
    { mimeType: 'text/markdown', expected: "Name: O'Brien <b> / Smith & Sons" },
    { mimeType: undefined, expected: "Name: O'Brien <b> / Smith & Sons" },
    { mimeType: 'text/html', expected: 'Name: O&#x27;Brien &lt;b&gt; / Smith &amp; Sons' },
    { mimeType: 'TEXT/HTML', expected: 'Name: O&#x27;Brien &lt;b&gt; / Smith &amp; Sons' },
  ]

  it.each(escapingCases)('escapes values for $mimeType output', async ({ mimeType, expected }) => {
    const template = 'Name: {{fields.name}} / {{fields.business}}'
    const data = { name: "O'Brien <b>", business: 'Smith & Sons' }
    expect(renderText({ template, data, mimeType })).toBe(expected)
    const request = { template: { type: 'text', key: 'body', mimeType, content: template }, data: { fields: data } }
    expect(await textRenderer().render(request as never)).toBe(expected)
  })

  it('leaves raw placeholders unescaped in HTML output', () => {
    expect(renderText({
      template: '{{{fields.value}}} / {{& fields.value}}',
      data: { value: '<b>A & B</b>' },
      mimeType: 'text/html',
    })).toBe('<b>A & B</b> / <b>A & B</b>')
  })

  const party = (captures: unknown[] = []) => ({
    parties: {
      tenant: {
        _role: 'tenant',
        id: 'tenant-1',
        name: 'Ada Lovelace',
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
      },
    },
    _captures: captures,
    _signers: {
      'signer-1': { id: 'signer-1', person: { name: 'Ada Lovelace' } },
    },
  })

  const signatureCases = [
    { name: 'signature placeholder', template: '{{signature(parties.tenant, "final")}}', data: party(), expected: '[SIGNATURE]' },
    { name: 'initials placeholder', template: '{{initials(parties.tenant, "final")}}', data: party(), expected: '[INITIALS]' },
    { name: 'signature date placeholder', template: '{{signatureDate(parties.tenant, "final")}}', data: party(), expected: '[DATE]' },
    { name: 'capacity fallback', template: '{{capacity(parties.tenant, "title")}}', data: party(), expected: 'President' },
    { name: 'printed name fallback', template: '{{printedName(parties.tenant, "name")}}', data: party(), expected: 'Ada Lovelace' },
    {
      name: 'captured signature date',
      template: '{{signatureDate(parties.tenant, "final")}}',
      data: party([{ role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'final', type: 'signature', timestamp: '2026-07-12T10:30:00Z', method: 'drawn' }]), expected: '2026-07-12',
    },
    {
      name: 'captured capacity',
      template: '{{capacity(parties.tenant, "title")}}',
      data: party([{ role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'title', type: 'capacity', text: 'Trustee', timestamp: '2026-07-12T10:30:00Z' }]), expected: 'Trustee',
    },
    {
      name: 'captured printed name',
      template: '{{printedName(parties.tenant, "name")}}',
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
    const template = '{{{signature(parties.tenant, "final")}}}'
    const signatureOptions = { format: 'html' as const }
    expect(renderText({ template, data, signatureOptions })).toBe('<img src="data:image/png;base64,c2ln" alt="Signature" class="signature-image" data-role="tenant" data-party-id="tenant-1" data-signer-id="signer-1" data-location-id="final" />')
  })

  it('matches captured Markdown initials rendering', () => {
    const data = party([{
      role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'final',
      type: 'initials', timestamp: '2026-07-12T10:30:00Z', method: 'drawn', image: 'data:image/png;base64,aW5pdA==',
    }])
    const template = '{{initials(parties.tenant, "final")}}'
    const signatureOptions = { format: 'markdown' as const }
    expect(renderText({ template, data, signatureOptions })).toBe('![Initials](data:image/png;base64,aW5pdA==)')
  })

  const hostileParty = (captures: unknown[] = []) => ({
    parties: {
      tenant: {
        _role: '"><script>alert(1)</script>',
        id: 'tenant-1" onmouseover="alert(2)',
        signatories: [{ signerId: 'signer-1"><b>', signer: { id: 'signer-1', person: { name: 'Ada' } } }],
      },
    },
    _captures: captures,
  })
  const hostileCapture = (type: string) => ({
    role: '"><script>alert(1)</script>', partyId: 'tenant-1" onmouseover="alert(2)', signerId: 'signer-1"><b>',
    locationId: 'final', type, timestamp: '2026-07-12T10:30:00Z', method: 'drawn', image: 'x.png"><script>alert(4)</script>',
  })
  const hostileAttributes = 'data-role="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;" data-party-id="tenant-1&quot; onmouseover&#x3D;&quot;alert(2)" data-signer-id="signer-1&quot;&gt;&lt;b&gt;" data-location-id="final"'

  it('escapes party, signer, and location values in HTML signing marks', () => {
    const signatureOptions = { format: 'html' as const }
    expect(renderText({ template: '{{{signature(parties.tenant, "final")}}}', data: hostileParty(), signatureOptions }))
      .toBe(`<span class="signature-placeholder" ${hostileAttributes}>[SIGNATURE]</span>`)
    expect(renderText({ template: '{{{signatureDate(parties.tenant, "final")}}}', data: hostileParty(), signatureOptions }))
      .toBe(`<span class="signature-date-placeholder" ${hostileAttributes}>[DATE]</span>`)
    expect(renderText({ template: '{{{signatureDate(parties.tenant, "final")}}}', data: hostileParty([hostileCapture('signature')]), signatureOptions }))
      .toBe(`<span class="signature-date" ${hostileAttributes}>2026-07-12</span>`)
  })

  it('escapes the image, alt text, and class of a captured HTML signature', () => {
    const signatureOptions = { format: 'html' as const, altText: '"><b>evil-alt</b>', cssClass: 'sig" onclick="x' }
    expect(renderText({ template: '{{{signature(parties.tenant, "final")}}}', data: hostileParty([hostileCapture('signature')]), signatureOptions }))
      .toBe(`<img src="x.png&quot;&gt;&lt;script&gt;alert(4)&lt;/script&gt;" alt="&quot;&gt;&lt;b&gt;evil-alt&lt;/b&gt;" class="sig&quot; onclick&#x3D;&quot;x" ${hostileAttributes} />`)
  })

  it('keeps a captured Markdown image inside its alt text and destination', () => {
    const capture = { ...hostileCapture('initials'), image: 'x.png)[click](javascript:alert(5)' }
    const signatureOptions = { format: 'markdown' as const, altText: 'Initials] [link' }
    expect(renderText({ template: '{{{initials(parties.tenant, "final")}}}', data: hostileParty([capture]), signatureOptions }))
      .toBe('![Initials\\] \\[link](x.png%29[click]%28javascript:alert%285%29)')
  })

  it('matches automatic field formatting while preserving raw properties', () => {
    const form = {
      fields: {
        fee: { type: 'money' },
        phone: { type: 'phone' },
        address: { type: 'address' },
      },
    } as unknown as Form
    const options = {
      template: '{{fields.fee}}|{{fields.fee.amount}}|{{fields.phone}}|{{fields.phone.number}}|{{fields.address}}|{{fields.address.locality}}',
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
        content: '{{fields.name}}|{{parties.owner.name}}|{{term}}',
      },
      data: {
        fields: { name: 'Pixel' },
        parties: { owner: { name: 'Ada' } },
        defs: { term: 'Pet' },
      },
      form: {
        fields: { name: { type: 'string' } },
        parties: { owner: { label: 'Owner', partyType: 'person' } },
        defs: { term: { type: 'string', value: 'term' } },
      },
    }
    expect(await textRenderer().render(request as never)).toBe('Pixel|Ada|Pet')
  })

  describe('reads what a render request carries beside fields', () => {
    const form = {
      fields: { name: { type: 'string' } },
      parties: { tenant: { label: 'Tenant', partyType: 'person' } },
      annexes: { proof: { title: 'Proof' } },
    } as unknown as Form
    const tenant = { id: 'tenant-1', _role: 'tenant', name: 'Ada', signatories: [{ signerId: 'signer-1' }] }
    const capture = {
      role: 'tenant', partyId: 'tenant-1', signerId: 'signer-1', locationId: 'final',
      type: 'signature', timestamp: '2026-07-12T10:30:00Z', method: 'drawn',
    }
    const render = (data: Record<string, unknown>) => textRenderer().render({
      template: {
        type: 'text',
        content: '{{fields.name}}|{{annexes.proof.name}}|{{signatureDate(parties.tenant, "final")}}|{{printedName(parties.tenant, "name")}}',
      },
      form,
      data,
    } as never)

    it('resolves annexes, signers and captures from beside fields', async () => {
      expect(await render({
        fields: { name: 'Pixel' },
        parties: { tenant },
        annexes: { proof: { name: 'proof.pdf', mimeType: 'application/pdf' } },
        signers: { 'signer-1': { id: 'signer-1', person: { name: 'Ada Lovelace' } } },
        captures: [capture],
      })).toBe('Pixel|proof.pdf|2026-07-12|Ada Lovelace')
    })

    it('renders an empty annex and placeholders when the request carries none', async () => {
      expect(await render({ fields: { name: 'Pixel' }, parties: { tenant } })).toBe('Pixel||[DATE]|[PRINTED NAME]')
    })
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
      template: '{{fields.amount}}/{{fields.amount.amount}}/{{fields.when}}/{{fields.enabled}}/{{fields.choice}}/{{fields.choices}}/{{parties.owner}}/{{total}}/{{#each fields.rows}}{{item.amount}};{{/each}}',
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
    })).toBe('MONEY:12.5:$12.50/12.5/DATE:2024-01-15/Active/<Alpha>/Alpha and Beta/PERSON:Ada/MONEY:12.5:$12.50/MONEY:2:$2.00;')
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
      template: '{{fields.amount}}/{{fields.amount.currency}}/{{fields.address}}',
      data: { amount: { currency: 'USD' } },
    })).toBe('INCOMPLETE/USD/MISSING')
  })

  it('raises attributable errors for malformed values', () => {
    const form = { fields: { amount: { type: 'money' } } } as unknown as Form

    expect(() => renderText({
      form,
      template: '{{fields.amount}}',
      data: { amount: { amount: 'bad', currency: 'USD' } },
    })).toThrowError(expect.objectContaining({ path: 'fields.amount', status: 'invalid' }))
  })

  it('qualifies nested formatter issues with the actual indexed field path', () => {
    const form = { fields: { rows: { type: 'list', item: { type: 'fieldset', fields: { amount: { type: 'money' } } } } } } as unknown as Form
    expect(() => renderText({
      form, template: '{{fields.rows}}', data: { rows: [{ amount: { amount: 'bad', currency: 'USD' } }] },
    })).toThrowError(expect.objectContaining({
      path: 'fields.rows[0].amount', status: 'invalid',
      issues: expect.arrayContaining([expect.objectContaining({ path: 'fields.rows[0].amount.amount' })]),
    }))
  })

  it('requires explicit boolean message recovery for additional locales', () => {
    const form = { fields: { enabled: { type: 'boolean' }, count: { type: 'number' } } } as unknown as Form
    const input = { form, template: '{{fields.enabled}}/{{fields.count}}', data: { enabled: true, count: 1234.5 } }
    expect(() => renderText({ ...input, formatter: createFormatter({ locale: 'es-ES' }) }))
      .toThrowError(expect.objectContaining({ status: 'unsupported', issues: expect.arrayContaining([expect.objectContaining({ code: 'missing_message', path: 'fields.enabled' })]) }))
    expect(renderText({ ...input, formatter: createFormatter({ locale: 'es-ES', messages: { 'es-ES': { 'boolean.true': 'Sí' } } }) }))
      .toBe(`Sí/${new Intl.NumberFormat('es-ES').format(1234.5)}`)
    expect(renderText({ ...input, formatter: createFormatter({ locale: 'es-ES', fallbackLocale: 'fr-FR' }) }))
      .toBe(`Oui/${new Intl.NumberFormat('es-ES').format(1234.5)}`)
  })
})

describe('text templates name values only through fields', () => {
  const form = { fields: { name: { type: 'text' }, owner: { type: 'fieldset', fields: { name: { type: 'text' } } } } } as unknown as Form

  it('renders {{fields.x}} paths, nested ones included', () => {
    expect(renderText({ form, template: '{{fields.owner.name}} owns {{fields.name}}', data: { name: 'Pixel', owner: { name: 'Ada' } } }))
      .toBe('Ada owns Pixel')
  })

  it('offers no bindings option on a text render or a render request', () => {
    expectTypeOf<RenderTextOptions>().not.toHaveProperty('bindings')
    expectTypeOf<RenderRequest>().not.toHaveProperty('bindings')
  })

  it.each([
    ['flat', { name: 'Pixel' }],
    ['artifact', { fields: { name: 'Pixel' } }],
  ])('does not resolve a former alias from layer bindings (%s data)', async (_, data) => {
    const request = {
      template: { type: 'text', mimeType: 'text/markdown', content: '[{{pet}}] {{fields.name}}', bindings: { pet: 'fields.name' } },
      form,
      data,
    }
    expect(await textRenderer().render(request as never)).toBe('[] Pixel')
  })
})
