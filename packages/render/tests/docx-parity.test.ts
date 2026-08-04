import { readFile } from 'node:fs/promises'
import { docxRenderer as existingDocxRenderer, renderDocx as renderExisting } from '@paradoc/renderer-docx'
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

describe('DOCX renderer parity', () => {
  it('matches visible content from the real fixture', async () => {
    const template = new Uint8Array(await readFile(new URL('../../renderer-docx/tests/fixtures/pet-addendum.docx', import.meta.url)))
    const options = {
      template,
      data: { petName: 'Pixel & Co', petSpecies: 'cat', petWeight: 12, isVaccinated: true },
      bindings: { name: 'petName', species: 'petSpecies', weight: 'petWeight', hasVaccination: 'isVaccinated' },
    }
    const actual = await renderDocx(options)
    const expected = await renderExisting(options)
    expect(visibleText(actual)).toBe(visibleText(expected))
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

  it('matches FOR and IF control rendering', async () => {
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
      const expected = await renderExisting(options)
      expect(visibleText(actual)).toBe(visibleText(expected))
      expect(visibleText(actual)).toBe(approved ? 'ABApproved' : 'AB')
    }
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

  it('matches signature helper rendering and exposes all signature values in templates', async () => {
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
    const expected = await renderExisting(options)
    expect(visibleText(actual)).toBe(visibleText(expected))
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

  it('matches loops that repeat Word table rows', async () => {
    const row = (text: string) => `<w:tr><w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc></w:tr>`
    const template = minimalDocx(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>${[
      row('{{FOR item IN items}}'),
      row('{{$item.name}}'),
      row('{{END-FOR item}}'),
    ].join('')}</w:tbl></w:body></w:document>`)
    const options = { template, data: { items: [{ name: 'A' }, { name: 'B' }] } }
    const actual = await renderDocx(options)
    const expected = await renderExisting(options)
    expect(visibleText(actual)).toBe(visibleText(expected))
    expect(visibleText(actual)).toBe('AB')
    expect(documentXml(actual).match(/<w:tr>/g)).toHaveLength(2)
  })

  it('matches the Paradoc renderer adapter data shape', async () => {
    const template = new Uint8Array(await readFile(new URL('../../renderer-docx/tests/fixtures/pet-addendum.docx', import.meta.url)))
    const request = {
      template: {
        type: 'docx',
        content: template,
        bindings: { name: 'petName', species: 'petSpecies', weight: 'petWeight', hasVaccination: 'isVaccinated' },
      },
      data: { fields: { petName: 'Pixel', petSpecies: 'cat', petWeight: 12, isVaccinated: true } },
    }
    const actual = await docxRenderer().render(request as never)
    const expected = await existingDocxRenderer().render(request as never)
    expect(visibleText(actual)).toBe(visibleText(expected))
  })
})
