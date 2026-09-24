/**
 * Templates read the artifact's own expression context.
 *
 * A condition written as field logic, in a Markdown layer, and in a DOCX layer
 * gives one answer; parties and checklist items are typed roots; signing
 * directives keep their party scoping; and authoring validation checks the
 * template expressions of inline layers synchronously and of file layers
 * through the resolver.
 */

import { zipSync, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createMemoryResolver } from '@paradoc/resolvers/memory'
import { createLayerRenderer } from '@paradoc/render'
import { checklist, form, validate, validateLayers } from '@/index'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function docx(paragraphs: string[]): Uint8Array {
  const body = paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`).join('')
  return zipSync({
    '[Content_Types].xml': encoder.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': encoder.encode('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': encoder.encode(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
  })
}

function wordText(bytes: Uint8Array): string {
  const xml = decoder.decode(unzipSync(bytes)['word/document.xml'])
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join('')
}

const conditions = [
  'fields.qty > 2',
  'fields.qty * fields.rate == 0.3',
  'fields.price.amount >= 19.95',
  'dateDiff(fields.due, "2024-04-01", "days") > 0',
  'fields.approved',
  'fields.note == null',
  '"a" in fields.tags',
  'sum(fields.lines.amount) == 0.3',
  'count(parties.tenants) == 2',
  'parties.buyer.name == "Ada"',
]

const fields = {
  qty: { type: 'number', label: 'Quantity' },
  rate: { type: 'number', label: 'Rate' },
  price: { type: 'money', label: 'Price' },
  due: { type: 'date', label: 'Due' },
  approved: { type: 'boolean', label: 'Approved' },
  note: { type: 'text', label: 'Note' },
  tags: { type: 'multiselect', label: 'Tags', enum: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
  lines: { type: 'list', label: 'Lines', item: { type: 'fieldset', label: 'Line', fields: { amount: { type: 'number', label: 'Amount' } } } },
} as const

const parties = {
  buyer: { label: 'Buyer', partyType: 'person' },
  tenants: { label: 'Tenants', partyType: 'person', min: 0, max: 3 },
} as const

const seed = {
  fields: {
    qty: 3,
    rate: 0.1,
    price: { amount: 19.95, currency: 'USD' },
    due: '2024-03-05',
    approved: true,
    tags: ['a'],
    lines: [{ amount: 0.1 }, { amount: 0.2 }],
  },
  parties: {
    buyer: { id: 'buyer-0', name: 'Ada', firstName: 'Ada', lastName: 'Lovelace' },
    tenants: [
      { id: 'tenants-0', name: 'Bo', firstName: 'Bo', lastName: 'Ng' },
      { id: 'tenants-1', name: 'Cy', firstName: 'Cy', lastName: 'Ode' },
    ],
  },
}

describe('one condition language through an artifact', () => {
  it('answers each condition the same as field logic, in Markdown, and in DOCX', async () => {
    const resolver = createMemoryResolver({
      contents: { 'conditions.docx': docx(conditions.flatMap((condition) => [`{{IF ${condition}}}`, 'T', '{{ELSE}}', 'F', '{{END-IF}}'])) },
    })
    const artifact = form.from({
      kind: 'form',
      name: 'conditions',
      fields,
      parties,
      defs: Object.fromEntries(conditions.map((condition, index) => [`c${index}`, { type: 'boolean', value: condition }])),
      layers: {
        md: { kind: 'inline', mimeType: 'text/markdown', text: conditions.map((condition) => `{{#if ${condition}}}T{{else}}F{{/if}}`).join('') },
        word: { kind: 'file', mimeType: DOCX, path: 'conditions.docx' },
      },
      defaultLayer: 'md',
    } as never, { resolver })
    const draft = artifact.fill(seed as never)
    const logic = conditions.map((_, index) => (draft.getLogicValue(`c${index}`) ? 'T' : 'F')).join('')

    expect(logic).toBe('TTTTTTTTTT')
    expect(await draft.render({ layer: 'md', renderer: createLayerRenderer() })).toBe(logic)
    expect(wordText(await draft.render({ layer: 'word', renderer: createLayerRenderer() }) as Uint8Array)).toBe(logic)

    const other = artifact.fill({ ...seed, fields: { ...seed.fields, qty: 1, approved: false, note: 'x' } } as never)
    expect(await other.render({ layer: 'md', renderer: createLayerRenderer() }))
      .toBe(conditions.map((_, index) => (other.getLogicValue(`c${index}`) ? 'T' : 'F')).join(''))
  })

  it('reads typed parties in field logic and templates, and places signing marks by party', async () => {
    const artifact = form.from({
      kind: 'form',
      name: 'parties',
      fields: { memo: { type: 'text', label: 'Memo', visible: 'parties.buyer.name == "Ada" and count(parties.tenants) > 1' } },
      parties,
      layers: {
        md: {
          kind: 'inline',
          mimeType: 'text/markdown',
          text: 'Buyer {{parties.buyer.name}} {{signature(parties.buyer, "buyer-sign")}}\n{{#each parties.tenants}}{{index(item) + 1}}. {{item.name}} {{signature("tenant-sign")}}\n{{/each}}',
        },
      },
      defaultLayer: 'md',
    } as never)
    const draft = artifact.fill({ parties: seed.parties } as never)

    expect(draft.isFieldVisible('memo')).toBe(true)
    expect(await draft.render({ renderer: createLayerRenderer() })).toBe('Buyer Ada _[SIGNATURE]_\n1. Bo _[SIGNATURE]_\n2. Cy _[SIGNATURE]_\n')
    expect(artifact.fill({ parties: { buyer: seed.parties.buyer } } as never).isFieldVisible('memo')).toBe(false)
  })

  it('renders a checklist template from its typed items', async () => {
    const definition = {
      kind: 'checklist',
      name: 'onboarding',
      version: '1.0.0',
      title: 'Onboarding',
      items: [
        { id: 'reviewed', title: 'Reviewed', status: { kind: 'boolean' } },
        { id: 'approval', title: 'Approval', status: { kind: 'enum', options: [{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }] } },
      ],
      layers: { md: { kind: 'inline', mimeType: 'text/markdown', text: '[{{#if items.reviewed}}x{{else}} {{/if}}] Reviewed / {{items.approval}}' } },
      defaultLayer: 'md',
    }
    expect(validate(definition).issues).toBeUndefined()
    const list = checklist.from(definition as never)
    expect(await list.fill({ reviewed: true, approval: 'approved' } as never).render({ renderer: createLayerRenderer() })).toBe('[x] Reviewed / approved')
    expect(validate({ ...definition, layers: { md: { kind: 'inline', mimeType: 'text/markdown', text: '{{items.missing}}' } } }).issues)
      .toEqual([expect.objectContaining({ message: expect.stringContaining('Unknown reference: items.missing') })])
  })
})

describe('authoring validation of template expressions', () => {
  const artifact = (text: string) => ({
    kind: 'form',
    name: 'validated',
    fields,
    parties,
    layers: { md: { kind: 'inline', mimeType: 'text/markdown', text } },
  })

  it('accepts valid inline templates, including typed parties and loops', () => {
    expect(validate(artifact('{{#each fields.lines}}{{item.amount}}{{/each}} {{parties.buyer.name}} {{#each parties.tenants}}{{item.lastName}}{{/each}}')).issues).toBeUndefined()
  })

  it('reports removed syntax in an inline layer with the layer, position, and replacement', () => {
    const result = validate(artifact('Line one\n  {{#if (eq fields.qty 1)}}x{{/if}}'))
    expect(result.issues).toEqual([{
      message: expect.stringMatching(/^Template error at layer "md", line 2, column 9 in \{\{\(eq fields\.qty 1\)\}\}: The "eq" helper is removed; compare with the == operator/),
      path: ['layers', 'md'],
    }])
  })

  it('reports a non-boolean condition, an unknown party member, and a loop-only function outside a loop', () => {
    const messages = validate(artifact('{{#if fields.note}}x{{/if}}{{parties.buyer.nope}}{{index(item)}}')).issues?.map((issue) => issue.message)
    expect(messages).toEqual([
      expect.stringContaining('A condition must be boolean, got string'),
      expect.stringContaining('Unknown reference: parties.buyer.nope'),
      expect.stringContaining('index() is valid only inside a loop'),
      expect.stringContaining('item is valid only inside a loop'),
    ])
  })

  it('checks file-backed text and DOCX layers through the resolver', async () => {
    const resolver = createMemoryResolver({
      contents: {
        'good.md': '{{fields.qty}}',
        'bad.md': 'ok\n{{default fields.note "n/a"}}',
        'bad.docx': docx(['{{IF fields.qty === 1}}', 'x', '{{END-IF}}']),
      },
    })
    const withFiles = {
      ...artifact('{{fields.qty}}'),
      layers: {
        good: { kind: 'file', mimeType: 'text/markdown', path: 'good.md' },
        bad: { kind: 'file', mimeType: 'text/markdown', path: 'bad.md' },
        word: { kind: 'file', mimeType: DOCX, path: 'bad.docx' },
        missing: { kind: 'file', mimeType: 'text/plain', path: 'missing.txt' },
      },
    }
    expect(validate(withFiles).issues).toBeUndefined()
    const result = await validateLayers(withFiles, { resolver })
    expect(result.issues?.map((issue) => issue.message)).toEqual([
      expect.stringMatching(/^Layer "missing" could not be read from "missing\.txt"/),
      expect.stringMatching(/^Template error at layer "bad", line 2, column 3 .*coalesce/),
      'Template error at layer "word", word/document.xml paragraph 1 in {{fields.qty === 1}}: The === and !== operators are removed; use == and !=.',
    ])
    const valid = { ...withFiles, layers: { good: withFiles.layers.good } }
    expect((await validateLayers(valid, { resolver })).issues).toBeUndefined()
  })
})
