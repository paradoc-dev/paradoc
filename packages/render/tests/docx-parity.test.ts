import { createFormatter } from '@paradoc/format'
import type { Form } from '@paradoc/types'
import { renderText } from '../src/text'
import { readFile } from 'node:fs/promises'
import { unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { docxRenderer, renderDocx } from '../src/docx'

const decoder = new TextDecoder()
const encoder = new TextEncoder()

function documentXml(bytes: Uint8Array): string {
  return decoder.decode(unzipSync(bytes)['word/document.xml'])
}

function visibleText(bytes: Uint8Array): string {
  return [...documentXml(bytes).matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function minimalDocx(document: string): Uint8Array {
  return zipSync({
    '[Content_Types].xml': encoder.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': encoder.encode('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': encoder.encode(document),
  })
}

describe('DOCX renderer behavior', () => {
  it('renders visible content from the real fixture', async () => {
    const template = new Uint8Array(await readFile(new URL('./fixtures/pet-addendum.docx', import.meta.url)))
    const options = {
      template,
      data: { petName: 'Pixel & Co', petSpecies: 'cat', petWeight: 12, isVaccinated: true },
      bindings: { name: 'petName', species: 'petSpecies', weight: 'petWeight', hasVaccination: 'isVaccinated' },
    }
    const actual = await renderDocx(options)
    expect(visibleText(actual)).toContain('Pixel & Co')
    expect(documentXml(actual)).not.toMatch(/\{\{(?:name|species|weight|hasVaccination)\}\}/)
  })

  it('renders commands split across Word runs', async () => {
    const template = minimalDocx('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello {{na</w:t></w:r><w:r><w:t>me}}!</w:t></w:r></w:p></w:body></w:document>')
    const output = await renderDocx({ template, data: { name: 'Ada' } })
    expect(visibleText(output)).toBe('Hello Ada!')
  })

  it('supports custom command delimiters', async () => {
    const template = minimalDocx('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello [[name]]</w:t></w:r></w:p></w:body></w:document>')
    const output = await renderDocx({ template, data: { name: 'Ada' }, options: { cmdDelimiter: ['[[', ']]'] } })
    expect(visibleText(output)).toBe('Hello Ada')
  })

  it('renders FOR and IF controls', async () => {
    const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`
    const template = minimalDocx(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[
      paragraph('{{FOR item IN items}}'),
      paragraph('{{$item.name}}'),
      paragraph('{{END-FOR item}}'),
      paragraph('{{IF approved}}'),
      paragraph('Approved'),
      paragraph('{{END-IF}}'),
    ].join('')}</w:body></w:document>`)
    for (const approved of [true, false]) {
      const options = { template, data: { items: [{ name: 'A' }, { name: 'B' }], approved } }
      const actual = await renderDocx(options)
      expect(visibleText(actual)).toBe(approved ? 'ABApproved' : 'AB')
    }
  })

  it('handles inline FOR blocks and legacy dollar-prefixed loop aliases', async () => {
    const template = minimalDocx('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{FOR item IN items}}{{$item.name}}, {{END-FOR item}}</w:t></w:r></w:p></w:body></w:document>')
    const output = await renderDocx({ template, data: { items: [{ name: 'A' }, { name: 'B' }] } })
    expect(visibleText(output)).toBe('A, B, ')
  })

  it('adds ELSE as a safe extension to the compatibility syntax', async () => {
    const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`
    const template = minimalDocx(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[
      paragraph('{{IF approved}}'),
      paragraph('Approved'),
      paragraph('{{ELSE}}'),
      paragraph('Pending'),
      paragraph('{{END-IF}}'),
    ].join('')}</w:body></w:document>`)
    const output = await renderDocx({ template, data: { approved: false } })
    expect(visibleText(output)).toBe('Pending')
  })

  it('renders signature helpers and exposes all signature values in templates', async () => {
    const template = minimalDocx('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{signature(signatory, "final")}}</w:t></w:r></w:p><w:p><w:r><w:t>{{signatureDate(signatory, "final")}}</w:t></w:r></w:p></w:body></w:document>')
    const signer = { person: { name: 'Ada Lovelace' } }
    const signatory = {
      signerId: 'signer-1',
      signer,
      capacity: 'Director',
      _role: 'owner',
      _partyId: 'party-1',
    }
    const data = {
      signatory,
      _signers: { 'signer-1': signer },
      _captures: [{
        role: 'owner',
        partyId: 'party-1',
        signerId: 'signer-1',
        locationId: 'final',
        type: 'signature' as const,
        timestamp: '2026-08-04T12:00:00Z',
      }],
    }
    const options = { template, data }
    const actual = await renderDocx(options)
    expect(visibleText(actual)).toBe('[Signed]2026-08-04')

    const extendedTemplate = minimalDocx('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{capacity(signatory, "capacity")}}</w:t></w:r></w:p><w:p><w:r><w:t>{{printedName(signatory, "name")}}</w:t></w:r></w:p></w:body></w:document>')
    const extended = await renderDocx({ template: extendedTemplate, data })
    expect(visibleText(extended)).toBe('DirectorAda Lovelace')
  })

  it('processes line breaks by default and permits opting out', async () => {
    const template = minimalDocx('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{value}}</w:t></w:r></w:p></w:body></w:document>')
    const enabled = await renderDocx({ template, data: { value: 'first\nsecond' } })
    const disabled = await renderDocx({ template, data: { value: 'first\nsecond' }, options: { processLineBreaks: false } })
    expect(documentXml(enabled)).toContain('<w:br/>')
    expect(documentXml(disabled)).not.toContain('<w:br/>')
  })

  it('renders loops that repeat Word table rows', async () => {
    const row = (text: string) => `<w:tr><w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc></w:tr>`
    const template = minimalDocx(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>${[
      row('{{FOR item IN items}}'),
      row('{{$item.name}}'),
      row('{{END-FOR item}}'),
    ].join('')}</w:tbl></w:body></w:document>`)
    const options = { template, data: { items: [{ name: 'A' }, { name: 'B' }] } }
    const actual = await renderDocx(options)
    expect(visibleText(actual)).toBe('AB')
    expect(documentXml(actual).match(/<w:tr>/g)).toHaveLength(2)
  })

  it('matches the Paradoc renderer adapter data shape', async () => {
    const template = new Uint8Array(await readFile(new URL('./fixtures/pet-addendum.docx', import.meta.url)))
    const request = {
      template: {
        type: 'docx',
        content: template,
        bindings: { name: 'petName', species: 'petSpecies', weight: 'petWeight', hasVaccination: 'isVaccinated' },
      },
      data: { fields: { petName: 'Pixel', petSpecies: 'cat', petWeight: 12, isVaccinated: true } },
    }
    const actual = await docxRenderer().render(request as never)
    expect(visibleText(actual)).toContain('Pixel')
    expect(documentXml(actual)).not.toMatch(/\{\{(?:name|species|weight|hasVaccination)\}\}/)
  })
})


describe('DOCX artifact formatting', () => {
  const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`
  const templateFor = (text: string) => minimalDocx(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text}</w:body></w:document>`)
  const form = {
    fields: {
      enabled: { type: 'boolean' },
      count: { type: 'number' },
      rows: { type: 'list', item: { type: 'fieldset', fields: { amount: { type: 'money' } } } },
    },
    defs: { total: { type: 'money', value: {} } },
    parties: { owner: { label: 'Owner', partyType: 'person' } },
  } as unknown as Form
  const data = {
    enabled: false, count: 0,
    rows: [{ amount: { amount: 12.5, currency: 'EUR' } }],
    defs: { total: { amount: 12.5, currency: 'EUR' } },
    parties: { owner: { name: 'Ada' } },
  }

  it('shares artifact context across nested, computed, party and boolean values', async () => {
    const formatter = createFormatter({ locale: 'de-DE' })
    const template = templateFor([
      paragraph('{{defs.total}}|{{parties.owner}}|{{enabled}}|{{count}}|'),
      paragraph('{{FOR row IN rows}}'), paragraph('{{$row.amount}}'), paragraph('{{END-FOR row}}'),
      paragraph('{{IF enabled}}'), paragraph('WRONG'), paragraph('{{END-IF}}'),
      paragraph('{{IF count == 0}}'), paragraph('|ZERO'), paragraph('{{END-IF}}'),
    ].join(''))
    const expected = renderText({ form, formatter, data,
      template: '{{defs.total}}|{{parties.owner}}|{{enabled}}|{{count}}|{{#each rows}}{{amount}}{{/each}}|ZERO',
    })
    expect(visibleText(await renderDocx({ template, data, form, formatter }))).toBe(expected)
    const { parties, defs, ...fields } = data
    const actual = await docxRenderer({ formatter: createFormatter({ locale: 'fr-FR' }) }).render({
      template: { type: 'docx', content: template }, data: { fields, parties, defs }, form, ctx: { formatter },
    } as never)
    expect(visibleText(actual)).toBe(expected)
  })

  it('rejects invalid indexed values and unknown member bindings', async () => {
    const template = templateFor(paragraph('{{value}}'))
    await expect(renderDocx({ template, form, data: { ...data, rows: [{ amount: { amount: 'bad', currency: 'EUR' } }] } }))
      .rejects.toMatchObject({ path: 'fields.rows[0].amount', status: 'invalid' })
    await expect(renderDocx({ template, form, data, bindings: { value: 'rows[0].amount.unknown' } }))
      .rejects.toMatchObject({ status: 'invalid' })
  })

  it.each([false, true])('inserts formatter output once with split runs = %s', async (split) => {
    const formatter = createFormatter({ overrides: { money: () => '<>& {{count}}' } })
    const body = split
      ? '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{{defs.to</w:t></w:r><w:r><w:t>tal}}</w:t></w:r></w:p>'
      : '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{{defs.total}}</w:t></w:r><w:r><w:t>!</w:t></w:r></w:p>'
    const output = await renderDocx({ template: templateFor(body), form, formatter, data })
    expect(visibleText(output)).toBe(split ? '<>& {{count}}' : '<>& {{count}}!')
    expect(documentXml(output)).toContain('&lt;&gt;&amp; {{count}}')
    expect(documentXml(output)).toContain('<w:rPr><w:b/></w:rPr>')
  })

  it('rejects malformed template controls instead of returning an unrendered file', async () => {
    await expect(renderDocx({ template: templateFor(paragraph('{{IF enabled}}')), data }))
      .rejects.toThrow('Unclosed DOCX control command')
  })
})
