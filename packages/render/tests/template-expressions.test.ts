/**
 * Templates written in the artifact expression language.
 *
 * The shared condition fixtures are evaluated three ways, directly by the
 * expression evaluator, in a Markdown template, and in a DOCX template, and
 * must agree. The failure cases prove each removed dialect is refused with its
 * replacement named, at authoring validation and at render.
 */

import { unzipSync, zipSync } from 'fflate'
import { buildRegistry, createContext, createTypeEnv, evaluateExpression, T, Values, type FnSignature } from '@paradoc/expr'
import type { Form } from '@paradoc/types'
import { describe, expect, it } from 'vitest'
import { checkTextTemplate, renderText, TemplateError, textRenderer } from '../src/text'
import { checkDocxTemplate, renderDocx } from '../src/docx'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function docx(paragraphs: string[], wrap = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`): Uint8Array {
  const body = paragraphs.map(wrap).join('')
  return zipSync({
    '[Content_Types].xml': encoder.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': encoder.encode('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': encoder.encode(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
  })
}

function visible(bytes: Uint8Array): string {
  const xml = decoder.decode(unzipSync(bytes)['word/document.xml'])
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join('')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

const form = {
  kind: 'form',
  name: 'conditions',
  fields: {
    qty: { type: 'number', label: 'Quantity' },
    rate: { type: 'number', label: 'Rate' },
    price: { type: 'money', label: 'Price' },
    due: { type: 'date', label: 'Due' },
    approved: { type: 'boolean', label: 'Approved' },
    note: { type: 'text', label: 'Note' },
    tags: { type: 'multiselect', label: 'Tags', enum: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
    lines: {
      type: 'list',
      label: 'Lines',
      item: {
        type: 'fieldset',
        label: 'Line',
        fields: {
          name: { type: 'text', label: 'Name' },
          amount: { type: 'number', label: 'Amount' },
          parts: { type: 'list', label: 'Parts', item: { type: 'text', label: 'Part' } },
        },
      },
    },
  },
} as unknown as Form

const data = {
  qty: 3,
  rate: 0.1,
  price: { amount: 19.95, currency: 'USD' },
  due: '2024-03-05',
  approved: true,
  note: null,
  tags: ['a'],
  lines: [
    { name: 'Bolt', amount: 0.1, parts: ['head', 'shaft'] },
    { name: 'Nut', amount: 0.2, parts: [] },
  ],
}

/** Conditions across numbers, decimals, money, dates, booleans, null, and lists. */
const conditions = [
  'fields.qty > 2',
  'fields.qty * fields.rate == 0.3',
  'fields.price.amount >= 19.95',
  'fields.price.currency == "USD"',
  'dateDiff(fields.due, "2024-04-01", "days") > 0',
  'fields.approved',
  'not fields.approved',
  'fields.note == null',
  'fields.note != null',
  '"a" in fields.tags',
  'length(fields.lines) == 2',
  'sum(fields.lines.amount) == 0.3',
  'sum(fields.lines.amount, fields.lines.amount > 0.15) == 0.2',
]

const env = createTypeEnv({
  'fields.qty': T.number,
  'fields.rate': T.number,
  'fields.price': T.money,
  'fields.price.amount': T.number,
  'fields.price.currency': T.string,
  'fields.due': T.date,
  'fields.approved': T.boolean,
  'fields.note': T.string,
  'fields.tags': T.array(T.string),
  'fields.lines': T.array(T.object),
  'fields.lines.name': T.string,
  'fields.lines.amount': T.number,
  'fields.lines.parts': T.array(T.string),
})

describe('one condition language', () => {
  it('gives each condition the same answer directly, in Markdown, and in DOCX', async () => {
    const context = createContext({ fields: data })
    const direct = conditions.map((condition) => {
      const result = evaluateExpression(condition, context)
      if (!result.success) throw new Error(result.error)
      return result.value.kind === 'boolean' && result.value.value ? 'T' : 'F'
    })
    const markdown = renderText({
      form,
      data,
      template: conditions.map((condition) => `{{#if ${condition}}}T{{else}}F{{/if}}`).join(','),
    }).split(',')
    const word = visible(await renderDocx({
      form,
      data,
      template: docx(conditions.flatMap((condition) => [`{{IF ${condition}}}`, 'T', '{{ELSE}}', 'F', '{{END-IF}}'])),
    })).split('')

    expect(markdown).toEqual(direct)
    expect(word).toEqual(direct)
    expect(direct).toEqual(['T', 'T', 'T', 'T', 'T', 'T', 'F', 'T', 'F', 'T', 'T', 'T', 'T'])
  })

  it('evaluates arithmetic, functions, and aggregates in placeholders, formatted and escaped', () => {
    const text = renderText({
      form,
      data: { ...data, note: '<b>&</b>' },
      template: [
        '{{fields.qty * fields.price.amount}}',
        '{{sum(fields.lines.amount)}}',
        '{{upper(fields.lines[0].name)}}',
        '{{coalesce(fields.missing, fields.note)}}',
        '{{fields.price}}',
        '{{fields.due}}',
        '{{addDays(fields.due, 10)}}',
        '{{fields.approved ? "yes" : "no"}}',
        '{{{fields.note}}}',
      ].join('|'),
    })
    expect(text).toBe('59.85|0.3|BOLT|&lt;b&gt;&amp;&lt;/b&gt;|$19.95|Mar 5, 2024|Mar 15, 2024|yes|<b>&</b>')
  })

  it('exposes item, parent, and the loop position functions in nested loops', () => {
    const text = renderText({
      form,
      data,
      template: '{{#each fields.lines}}{{index(item)}}:{{item.name}}[{{#each item.parts}}{{parent.name}}/{{item}}{{#unless last(item)}},{{/unless}}{{else}}none{{/each}}]{{#if first(item)}}*{{/if}};{{/each}}',
    })
    expect(text).toBe('0:Bolt[Bolt/head,Bolt/shaft]*;1:Nut[none];')
  })

  it('exposes a DOCX loop variable, including when it repeats table rows', async () => {
    const row = (text: string) => `<w:tr><w:tc><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc></w:tr>`
    const output = await renderDocx({
      form,
      data,
      template: zipSync({
        ...unzipSync(docx([])),
        'word/document.xml': encoder.encode(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>${[
          row('{{FOR line IN fields.lines}}'),
          row('{{index(line) + 1}}. {{line.name}} {{line.amount}}'),
          row('{{END-FOR line}}'),
        ].join('')}</w:tbl></w:body></w:document>`),
      }),
    })
    expect(visible(output)).toBe('1. Bolt 0.12. Nut 0.2')
    expect(decoder.decode(unzipSync(output)['word/document.xml']).match(/<w:tr>/g)).toHaveLength(2)
  })

  it('calls host-configured functions and refuses functions that are not configured', () => {
    const signatures: FnSignature[] = [{ name: 'shout', category: 'string', params: [{ name: 'value', type: T.string }], returns: { kind: 'fixed', type: T.string }, deterministic: true }]
    const functions = { shout: ([value]: readonly import('@paradoc/expr').Value[]) => Values.string(`${value?.kind === 'string' ? value.value : ''}!`) }
    expect(renderText({ data: { name: 'ada' }, template: '{{shout(fields.name)}}', expressions: { functions, signatures } })).toBe('ada!')

    expect(() => renderText({ data: { name: 'ada' }, template: '{{shout(fields.name)}}', layer: 'markdown' }))
      .toThrowError(expect.objectContaining({ code: 'unknown-function', layer: 'markdown', position: { line: 1, column: 3 } }))
    expect(checkTextTemplate('{{shout(fields.name)}}', createTypeEnv({ 'fields.name': T.string }))).toEqual([
      expect.objectContaining({ code: 'unknown-function', position: { line: 1, column: 3 } }),
    ])
    const configured = createTypeEnv({ 'fields.name': T.string }, buildRegistry(signatures))
    expect(checkTextTemplate('{{shout(fields.name)}}', configured)).toEqual([])
  })

  it('passes configured functions through the text renderer', async () => {
    const signatures: FnSignature[] = [{ name: 'twice', category: 'number', params: [{ name: 'value', type: T.number }], returns: { kind: 'fixed', type: T.number }, deterministic: true }]
    const renderer = textRenderer({
      expressions: {
        signatures,
        functions: { twice: ([value]) => value!.kind === 'number' ? Values.number(value!.value.add(value!.value)) : Values.null },
      },
    })
    const output = await renderer.render({
      template: { type: 'text', content: '{{twice(fields.qty)}}' },
      data: { fields: { qty: 21 } },
    } as never)
    expect(output).toBe('42')

    const throughArtifact = await renderer.render({
      template: { type: 'text', content: '{{twice(fields.qty)}}' },
      data: { fields: { qty: 21 } },
      ctx: { expressions: { context: createContext({ fields: { qty: 5 } }) } },
    } as never)
    expect(throughArtifact).toBe('10')
  })
})

describe('template diagnostics', () => {
  const removed: Array<[string, RegExp]> = [
    ['{{#if (eq fields.note "a")}}x{{/if}}', /== operator/],
    ['{{#if (ne fields.note "a")}}x{{/if}}', /!= operator/],
    ['{{#if (gt fields.qty 1)}}x{{/if}}', /> operator/],
    ['{{#if (gte fields.qty 1)}}x{{/if}}', />= operator/],
    ['{{#if (lt fields.qty 1)}}x{{/if}}', /< operator/],
    ['{{#if (lte fields.qty 1)}}x{{/if}}', /<= operator/],
    ['{{#if (and fields.approved fields.approved)}}x{{/if}}', /and operator/],
    ['{{#if (or fields.approved fields.approved)}}x{{/if}}', /or operator/],
    ['{{#if (contains fields.tags "a")}}x{{/if}}', /in fields\.list/],
    ['{{default fields.note "n/a"}}', /coalesce/],
    ['{{#each fields.lines}}{{@index}}{{/each}}', /index\(item\)/],
    ['{{#each fields.lines}}{{@first}}{{/each}}', /first\(item\)/],
    ['{{#each fields.lines}}{{@last}}{{/each}}', /last\(item\)/],
    ['{{#each fields.lines}}{{../fields.qty}}{{/each}}', /parent/],
    ['{{@root.fields.qty}}', /path from the root/],
    ['{{this}}', /item inside a loop/],
    ['{{#with fields.price}}{{amount}}{{/with}}', /\{\{#with\}\} is removed/],
    ['{{signature "sign"}}', /signature\("location"\)/],
  ]

  it.each(removed)('refuses %s and names the replacement', (template, replacement) => {
    const found = checkTextTemplate(template, env)
    expect(found.length).toBeGreaterThan(0)
    expect(found[0]!.message).toMatch(replacement)
    // `this` parses as a name; like any unknown reference it reads as missing
    // at render, so authoring validation is where it is refused.
    if (template !== '{{this}}') expect(() => renderText({ form, data, template })).toThrowError(TemplateError)
  })

  it('refuses the old DOCX comparison and loop alias syntax, naming the replacement', () => {
    const found = checkDocxTemplate(docx(['{{IF fields.qty === 3}}', 'x', '{{END-IF}}', '{{FOR line IN fields.lines}}', '{{$line.name}}', '{{END-FOR line}}']), env)
    expect(found.map((diagnostic) => [diagnostic.location, diagnostic.message])).toEqual([
      ['word/document.xml paragraph 1', expect.stringMatching(/use == and !=/)],
      ['word/document.xml paragraph 5', expect.stringMatching(/\{\{line\.amount\}\}/)],
    ])
  })

  it('reports a non-boolean condition, a non-list loop source, and an unknown reference with positions', () => {
    const found = checkTextTemplate('A\n  {{#if fields.note}}x{{/if}}\n{{#each fields.qty}}{{/each}}{{fields.nope}}', env)
    expect(found).toEqual([
      expect.objectContaining({ code: 'non-boolean-gate', position: { line: 2, column: 9 } }),
      expect.objectContaining({ code: 'type-mismatch', message: 'A loop source must be a list, got number.', position: { line: 3, column: 9 } }),
      expect.objectContaining({ code: 'unknown-identifier', position: { line: 3, column: 32 } }),
    ])
  })

  it('refuses loop-only names outside a loop, and accepts them inside one', () => {
    expect(checkTextTemplate('{{index(item)}}', env).map((diagnostic) => diagnostic.message)).toEqual([
      'index() is valid only inside a loop.',
      'item is valid only inside a loop.',
    ])
    expect(checkTextTemplate('{{#each fields.lines}}{{index(item)}}{{item.name}}{{#each item.parts}}{{parent.amount}}{{last(parent)}}{{/each}}{{/each}}', env)).toEqual([])
    expect(checkTextTemplate('{{#each fields.lines}}{{index(fields.qty)}}{{/each}}', env)).toEqual([
      expect.objectContaining({ message: 'index() takes a loop row, such as index(item).' }),
    ])
  })

  it('checks DOCX loop variables and conditions in Word packages', () => {
    const template = docx(['{{FOR line IN fields.lines}}', '{{line.name}} {{index(line)}}', '{{IF line.amount > 0}}', 'x', '{{END-IF}}', '{{END-FOR line}}', '{{line.name}}'])
    expect(checkDocxTemplate(template, env)).toEqual([
      expect.objectContaining({ code: 'unknown-identifier', location: 'word/document.xml paragraph 7' }),
    ])
  })

  it('fails a render at the expression that fails, naming the layer and position', () => {
    expect(() => renderText({ data: { a: 'x' }, template: 'ok\n{{fields.a * 2}}', layer: 'markdown' }))
      .toThrowError(expect.objectContaining({ layer: 'markdown', position: { line: 2, column: 3 }, expression: 'fields.a * 2' }))
    expect(() => renderText({ data: { a: 'x' }, template: '{{#if fields.a}}x{{/if}}' }))
      .toThrowError(expect.objectContaining({ code: 'non-boolean-gate' }))
  })

  it('never interprets inserted data as template or expression syntax', () => {
    expect(renderText({ data: { note: '{{fields.secret}}' }, template: '{{{fields.note}}}' })).toBe('{{fields.secret}}')
  })
})
