import { defaultFormatter } from '@paradoc/format'
import type { Bindings, Form, Formatter } from '@paradoc/types'
import { unzipSync, zipSync } from 'fflate'
import { applyBindings } from '../text/bindings'
import { formatFieldData, validateFieldBindings } from '../text/field-formatter'
import { loopFrames, loopRows, renderTemplateNodes, type SigningDirective, type TemplateRenderOptions } from '../text/template'
import { templateData, type TemplateExpressionOptions } from '../template/context'
import { TemplateError } from '../template/errors'
import { expressionSlot, parseTemplate } from '../template/markers'
import { TemplateScope } from '../template/scope'
import { createDocxSignatureDirectives, type DocxSignatureOptions } from './signatures'

export type { DocxSignatureOptions } from './signatures'

export interface DocxRenderOptions {
  cmdDelimiter?: [string, string]
  processLineBreaks?: boolean
}

export interface RenderDocxOptions {
  template: Uint8Array
  data: Record<string, unknown>
  form?: Form
  formatter?: Formatter
  bindings?: Bindings
  signatureOptions?: DocxSignatureOptions
  options?: DocxRenderOptions
  /** The expression context and configured functions templates read. */
  expressions?: TemplateExpressionOptions
  /** The layer key, named in template errors. */
  layer?: string
}

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function encodeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeDelimiters(value: string, delimiters: [string, string]): string {
  if (delimiters[0] === '{{' && delimiters[1] === '}}') return value
  return value
    .replace(new RegExp(regexEscape(delimiters[0]), 'g'), '{{')
    .replace(new RegExp(regexEscape(delimiters[1]), 'g'), '}}')
}

export function paragraphText(paragraph: string): string {
  return [...paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1] ?? ''))
    .join('')
}

function visibleParagraph(paragraph: string): string {
  return paragraphText(paragraph).trim()
}

function commandIn(paragraph: string, delimiters: [string, string]): string | undefined {
  const value = visibleParagraph(paragraph)
  if (!value.startsWith(delimiters[0]) || !value.endsWith(delimiters[1])) return undefined
  return value.slice(delimiters[0].length, -delimiters[1].length).trim()
}

interface Control {
  command: string
  start: number
  end: number
}

function controlsIn(xml: string, delimiters: [string, string]): Control[] {
  const rows = [...xml.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    value: visibleParagraph(match[0]),
  }))
  return [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
    .map((match) => {
      const start = match.index ?? 0
      const end = start + match[0].length
      const command = commandIn(match[0], delimiters)
      const marker = command === undefined ? undefined : `${delimiters[0]}${command}${delimiters[1]}`
      const row = marker === undefined ? undefined : rows.find((candidate) =>
        candidate.start <= start && candidate.end >= end && candidate.value === marker)
      return { command, start: row?.start ?? start, end: row?.end ?? end }
    })
    .filter((item): item is Control => item.command !== undefined)
}

/**
 * Word templates sometimes put a complete FOR/IF block, including its body,
 * in one paragraph. Split that paragraph into standalone control paragraphs
 * before expansion so the same syntax works whether Word kept the commands
 * on separate lines or in one run.
 */
export function normalizeInlineControls(xml: string): string {
  const paragraphPattern = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
  const inlinePattern = /^(\s*)(\{\{(?:FOR|IF)\s+[^{}]+\}\})([\s\S]*?)(\{\{END-(?:FOR|IF)(?:\s+[^{}]+)?\}\})(\s*)$/

  return xml.replace(paragraphPattern, (paragraph) => {
    const match = paragraphText(paragraph).match(inlinePattern)
    if (!match) return paragraph

    const opening = paragraph.match(/^<w:p\b[^>]*>/)?.[0] ?? '<w:p>'
    const properties = paragraph.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
    const makeParagraph = (text: string) => {
      const content = text.length > 0
        ? `<w:r><w:t xml:space="preserve">${encodeXml(text)}</w:t></w:r>`
        : ''
      return `${opening}${properties}${content}</w:p>`
    }

    return [match[1], match[2], match[3], match[4], match[5]]
      .filter((text): text is string => Boolean(text))
      .map(makeParagraph)
      .join('')
  })
}

interface DocxRun {
  scope: TemplateScope
  options: TemplateRenderOptions
  delimiters: [string, string]
  processLineBreaks: boolean
  part: string
}

const PARAGRAPH_MARK = /<!--pdc:(\d+)-->/

/** Number every paragraph of a part so errors can name it; removed after rendering. */
function markParagraphs(xml: string): string {
  let count = 0
  return xml.replace(/<w:p\b[^>]*>/g, (open) => /^<w:pPr\b|^<w:p[A-Z]/.test(open) ? open : `${open}<!--pdc:${++count}-->`)
}

function unmarkParagraphs(xml: string): string {
  return xml.replace(/<!--pdc:\d+-->/g, '')
}

function locate(run: DocxRun, xml: string): string {
  const paragraph = xml.match(PARAGRAPH_MARK)?.[1]
  return paragraph ? `${run.part} paragraph ${paragraph}` : run.part
}

function located<T>(run: DocxRun, xml: string, render: () => T): T {
  try {
    return render()
  } catch (error) {
    if (!(error instanceof TemplateError) || error.location) throw error
    throw new TemplateError({ ...error.diagnostic, location: locate(run, xml) }, run.options.layer)
  }
}

const OPENING = /^(?:FOR\s+\S+\s+IN\s+.+|IF\s+.+)$/
const CLOSING = /^END-(?:FOR|IF)(?:\s+\S+)?$/

function expandControls(xml: string, run: DocxRun): string {
  const controls = controlsIn(xml, run.delimiters)
  const openingIndex = controls.findIndex(({ command }) => OPENING.test(command))
  if (openingIndex === -1) return renderLeafXml(xml, run)
  const opening = controls[openingIndex]!
  const isFor = opening.command.startsWith('FOR ')
  let depth = 1
  let closing: Control | undefined
  let alternative: Control | undefined
  for (const control of controls.slice(openingIndex + 1)) {
    if (OPENING.test(control.command)) depth++
    else if (CLOSING.test(control.command)) {
      depth--
      if (depth === 0) { closing = control; break }
    } else if (control.command === 'ELSE' && depth === 1) alternative = control
  }
  const openingXml = xml.slice(opening.start, opening.end)
  if (!closing) {
    throw new TemplateError({ code: 'markers', message: `Unclosed DOCX control command: ${opening.command}`, location: locate(run, openingXml) }, run.options.layer)
  }

  const before = xml.slice(0, opening.start)
  const truthyBody = xml.slice(opening.end, alternative?.start ?? closing.start)
  const falseBody = alternative ? xml.slice(alternative.end, closing.start) : ''
  const expanded = located(run, openingXml, () => {
    if (isFor) {
      const match = opening.command.match(/^FOR\s+(\S+)\s+IN\s+(.+)$/)!
      const alias = match[1]!
      const slot = expressionSlot(match[2]!, { line: 1, column: 1 })
      if (!slot.ast) throw new TemplateError(slot.problem!, run.options.layer)
      const rows = loopRows(run.scope.evaluate(slot.ast, slot.source, slot.position), slot, run.options.layer)
      return loopFrames(run.scope, slot.ast, rows, { kind: 'named', name: alias })
        .map((frame) => expandControls(truthyBody, { ...run, scope: run.scope.push(frame) }))
        .join('')
    }
    const slot = expressionSlot(opening.command.slice(3), { line: 1, column: 1 })
    if (!slot.ast) throw new TemplateError(slot.problem!, run.options.layer)
    const value = run.scope.evaluate(slot.ast, slot.source, slot.position)
    if (value.kind !== 'boolean' && value.kind !== 'null') {
      throw new TemplateError({ code: 'non-boolean-gate', message: `A condition must be boolean, got ${value.kind}.`, expression: slot.source }, run.options.layer)
    }
    return expandControls(value.kind === 'boolean' && value.value ? truthyBody : falseBody, run)
  })
  return `${renderLeafXml(before, run)}${expanded}${expandControls(xml.slice(closing.end), run)}`
}

/** The text of a run, with the layer's delimiters and the `INS` alias normalized. */
export function normalizeDocxExpressions(value: string, delimiters: [string, string]): string {
  return normalizeDelimiters(value, delimiters).replace(/\{\{\s*INS\s+([^}]+)\}\}/g, '{{$1}}')
}

function renderRunText(text: string, run: DocxRun): string {
  const nodes = parseTemplate(normalizeDocxExpressions(text, run.delimiters))
  const rendered = encodeXml(renderTemplateNodes(nodes, run.scope, run.options))
  return run.processLineBreaks ? rendered.replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">') : rendered
}

function renderLeafXml(xml: string, run: DocxRun): string {
  const { delimiters } = run
  const textNode = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => located(run, paragraph, () => {
    const nodes = [...paragraph.matchAll(textNode)]
    const texts = nodes.map((match) => decodeXml(match[2] ?? ''))
    const visible = texts.join('')
    let offset = 0
    const boundaries = texts.slice(0, -1).map((text) => (offset += text.length))
    const commandPattern = new RegExp(`${regexEscape(delimiters[0])}[\\s\\S]*?${regexEscape(delimiters[1])}`, 'g')
    const hasSplitCommand = [...visible.matchAll(commandPattern)].some((match) =>
      boundaries.some((boundary) => boundary > match.index! && boundary < match.index! + match[0].length))

    // Inspect original template runs before inserting data. Inserted text is never
    // reinterpreted as a command, including literal braces from a formatter.
    if (!hasSplitCommand) {
      return paragraph.replace(textNode, (_, open: string, content: string, close: string) =>
        `${open}${renderRunText(decodeXml(content), run)}${close}`)
    }
    const replacement = renderRunText(visible, run)
    let used = false
    return paragraph.replace(textNode, (_, open: string, _content: string, close: string) => {
      if (used) return `${open}${close}`
      used = true
      return `${open}${replacement}${close}`
    })
  }))
}

export async function renderDocx({
  template,
  data,
  form,
  formatter = defaultFormatter,
  bindings,
  signatureOptions,
  options = {},
  expressions,
  layer,
}: RenderDocxOptions): Promise<Uint8Array> {
  let prepared = form
    ? formatFieldData(data, form, formatter)
    : data
  if (bindings) {
    if (form) validateFieldBindings(form, bindings)
    prepared = applyBindings(prepared, bindings)
  }
  const { context, resolveData } = templateData(data, prepared, form, expressions, bindings)
  const directives: Record<string, SigningDirective> = createDocxSignatureDirectives(signatureOptions)
  const templateOptions: TemplateRenderOptions = {
    context,
    resolveData,
    root: prepared,
    formatter,
    directives,
    escape: (text) => text,
    layer,
  }
  const scope = new TemplateScope(context, { formatter, resolveData, layer })
  const files = unzipSync(template)
  const delimiters = options.cmdDelimiter ?? ['{{', '}}']
  const processLineBreaks = options.processLineBreaks ?? true
  for (const [name, bytes] of Object.entries(files)) {
    if (!DOCX_TEMPLATE_PARTS.test(name)) continue
    const xml = markParagraphs(normalizeInlineControls(textDecoder.decode(bytes)))
    const run: DocxRun = { scope, options: templateOptions, delimiters, processLineBreaks, part: name }
    files[name] = textEncoder.encode(unmarkParagraphs(expandControls(xml, run)))
  }
  return zipSync(files, { level: 6 })
}

/** The parts of a Word package that carry template text. */
export const DOCX_TEMPLATE_PARTS = /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/
