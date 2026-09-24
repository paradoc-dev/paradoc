// DOCX control blocks: custom delimiters on one-paragraph blocks (render-003),
// closers and ELSE that must match their block (render-020), paragraph
// numbering in error locations (render-021), and the removed INS and {{& }}
// aliases (render-027).
import { createTypeEnv, T } from '@paradoc/expr'
import { unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { checkDocxTemplate, renderDocx } from '../src/docx'
import { checkTextTemplate, renderText, TemplateError } from '../src/text'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function docx(paragraphs: string[], wrap = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`): Uint8Array {
  return zipSync({
    '[Content_Types].xml': encoder.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': encoder.encode('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': encoder.encode(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map(wrap).join('')}</w:body></w:document>`),
  })
}

function visible(bytes: Uint8Array): string {
  const xml = decoder.decode(unzipSync(bytes)['word/document.xml'])
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join('')
}

const env = createTypeEnv({
  'fields.a': T.boolean,
  'fields.name': T.string,
  'fields.lines': T.array(T.object),
  'fields.lines.name': T.string,
})

const brackets = { cmdDelimiter: ['[[', ']]'] as [string, string] }

describe('one-paragraph blocks with custom delimiters (render-003)', () => {
  it('renders an inline IF with the default delimiters', async () => {
    expect(visible(await renderDocx({ template: docx(['{{IF fields.a}}Yes{{END-IF}}']), data: { a: true } }))).toBe('Yes')
  })

  it('renders an inline IF and FOR with custom delimiters', async () => {
    const ifOutput = await renderDocx({ template: docx(['[[IF fields.a]]Yes[[END-IF]]']), data: { a: true }, options: brackets })
    expect(visible(ifOutput)).toBe('Yes')
    const skipped = await renderDocx({ template: docx(['[[IF fields.a]]Yes[[END-IF]]']), data: { a: false }, options: brackets })
    expect(visible(skipped)).toBe('')
    const forOutput = await renderDocx({ template: docx(['[[FOR line IN fields.lines]][[line.name]];[[END-FOR line]]']), data: { lines: [{ name: 'A' }, { name: 'B' }] }, options: brackets })
    expect(visible(forOutput)).toBe('A;B;')
  })

  it('splits an inline ELSE and rejects a second one in the same paragraph', async () => {
    const template = docx(['[[IF fields.a]]A[[ELSE]]B[[END-IF]]'])
    expect(visible(await renderDocx({ template, data: { a: true }, options: brackets }))).toBe('A')
    expect(visible(await renderDocx({ template, data: { a: false }, options: brackets }))).toBe('B')
    await expect(renderDocx({ template: docx(['{{IF fields.a}}A{{ELSE}}B{{ELSE}}C{{END-IF}}']), data: { a: false } }))
      .rejects.toThrow(/has a second ELSE/)
  })

  it('checks an inline block with custom delimiters without a marker problem', () => {
    expect(checkDocxTemplate(docx(['[[IF fields.a]]Yes[[END-IF]]']), env, brackets)).toEqual([])
  })

  it('still reports an unclosed custom-delimiter block', async () => {
    const run = renderDocx({ template: docx(['[[IF fields.a]]', 'Yes']), data: { a: true }, options: brackets })
    await expect(run).rejects.toThrowError(TemplateError)
    await expect(run).rejects.toMatchObject({ diagnostic: { code: 'markers', message: 'Unclosed DOCX control command: IF fields.a', location: 'word/document.xml paragraph 1' } })
  })
})

describe('block closers and ELSE match their block (render-020)', () => {
  const cases: Array<[string, string[], RegExp]> = [
    ['END-FOR closing an IF', ['{{IF fields.a}}', 'X', '{{END-FOR}}'], /END-FOR cannot close IF fields\.a; write END-IF/],
    ['END-IF closing a FOR', ['{{FOR line IN fields.lines}}', 'X', '{{END-IF}}'], /END-IF cannot close FOR line IN fields\.lines; write END-FOR/],
    ['END-FOR naming another row', ['{{FOR line IN fields.lines}}', 'X', '{{END-FOR row}}'], /write END-FOR line/],
    ['a second ELSE', ['{{IF fields.a}}', 'A', '{{ELSE}}', 'B', '{{ELSE}}', 'C', '{{END-IF}}'], /has a second ELSE/],
    ['ELSE in a FOR', ['{{FOR line IN fields.lines}}', 'A', '{{ELSE}}', 'B', '{{END-FOR line}}'], /ELSE belongs inside an IF block/],
    ['a closer with no block', ['X', '{{END-IF}}'], /Unexpected END-IF/],
  ]

  it.each(cases)('rejects %s at render', async (_name, paragraphs, message) => {
    const run = renderDocx({ template: docx(paragraphs), data: { a: false, lines: [{ name: 'A' }] } })
    await expect(run).rejects.toThrowError(TemplateError)
    await expect(run).rejects.toThrow(message)
  })

  it.each(cases)('reports %s in check', (_name, paragraphs, message) => {
    const found = checkDocxTemplate(docx(paragraphs), env)
    expect(found).toContainEqual(expect.objectContaining({ code: 'markers', message: expect.stringMatching(message) }))
  })

  it('rejects a mismatched closer in a branch that does not render', async () => {
    const run = renderDocx({ template: docx(['{{IF fields.a}}', '{{IF fields.a}}', 'X', '{{END-FOR}}', '{{END-IF}}']), data: { a: false } })
    await expect(run).rejects.toThrow(/END-FOR cannot close IF fields\.a/)
  })

  it('renders and checks well-formed nested blocks with one ELSE each', async () => {
    const paragraphs = ['{{FOR line IN fields.lines}}', '{{IF fields.a}}', '{{line.name}}', '{{ELSE}}', '-', '{{END-IF}}', '{{END-FOR line}}']
    expect(visible(await renderDocx({ template: docx(paragraphs), data: { a: true, lines: [{ name: 'A' }, { name: 'B' }] } }))).toBe('AB')
    expect(visible(await renderDocx({ template: docx(paragraphs), data: { a: false, lines: [{ name: 'A' }] } }))).toBe('-')
    expect(checkDocxTemplate(docx(paragraphs), env)).toEqual([])
  })

  it('names the paragraph of the mismatched closer', () => {
    const found = checkDocxTemplate(docx(['{{IF fields.a}}', 'X', '{{END-FOR}}']), env)
    expect(found).toEqual([expect.objectContaining({ location: 'word/document.xml paragraph 3' })])
  })
})

describe('error locations count every paragraph (render-021)', () => {
  it('numbers paragraphs that carry properties', async () => {
    const styled = (text: string) => `<w:p w:rsidR="00AB"><w:pPr><w:pStyle w:val="Body"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`
    const run = renderDocx({ template: docx(['intro', 'more', '{{fields.name +}}'], styled), data: { name: 'x' } })
    await expect(run).rejects.toMatchObject({ diagnostic: { location: 'word/document.xml paragraph 3' } })
  })
})

describe('removed aliases (render-027)', () => {
  it('refuses the DOCX INS form, naming the replacement', async () => {
    await expect(renderDocx({ template: docx(['{{INS fields.name}}']), data: { name: 'Ada' } }))
      .rejects.toThrow(/The INS form is removed/)
    const found = checkDocxTemplate(docx(['{{INS fields.name}}']), env)
    expect(found).toEqual([expect.objectContaining({ message: expect.stringMatching(/The INS form is removed/) })])
  })

  it('refuses the {{& }} raw marker, naming {{{ }}}', () => {
    expect(() => renderText({ template: '{{& fields.name}}', data: { name: 'Ada' }, mimeType: 'text/html' }))
      .toThrow(/use \{\{\{ \}\}\}/)
    expect(checkTextTemplate('{{& fields.name}}', env)).toEqual([expect.objectContaining({ message: expect.stringMatching(/use \{\{\{ \}\}\}/) })])
  })

  it('keeps {{{ }}} raw and {{ }} as the plain value', async () => {
    expect(renderText({ template: '{{{fields.name}}}', data: { name: '<b>' }, mimeType: 'text/html' })).toBe('<b>')
    expect(visible(await renderDocx({ template: docx(['{{fields.name}}']), data: { name: 'Ada' } }))).toBe('Ada')
  })
})
