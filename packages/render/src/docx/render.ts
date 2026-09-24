import { defaultFormatter } from '@paradoc/format'
import type { Form, Formatter } from '@paradoc/types'
import { unzipSync, zipSync } from 'fflate'
import { formatFieldData } from '../text/field-formatter'
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

/** The text of a run, with the layer's delimiters normalized to `{{` and `}}`. */
export function normalizeDelimiters(value: string, delimiters: [string, string]): string {
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
 * in one paragraph. Split that paragraph at each control command, ELSE
 * included, so the same syntax works whether Word kept the commands on
 * separate lines or in one run.
 */
export function normalizeInlineControls(xml: string, delimiters: [string, string]): string {
  const paragraphPattern = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
  const [open, close] = delimiters.map(regexEscape) as [string, string]
  const command = (body: string) => `${open}\\s*(?:${body})(?:(?!${close})[\\s\\S])*?${close}`
  const inlinePattern = new RegExp(`^\\s*${command('(?:FOR|IF)\\s')}[\\s\\S]*${command('END-(?:FOR|IF)')}\\s*$`)
  const anyCommand = new RegExp(`(${command('(?:FOR|IF)\\s|ELSE\\s*(?=' + close + ')|END-(?:FOR|IF)')})`)

  return xml.replace(paragraphPattern, (paragraph) => {
    const text = paragraphText(paragraph)
    if (!inlinePattern.test(text)) return paragraph

    const opening = paragraph.match(/^<w:p\b[^>]*>/)?.[0] ?? '<w:p>'
    const properties = paragraph.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
    const makeParagraph = (text: string) => {
      const content = text.length > 0
        ? `<w:r><w:t xml:space="preserve">${encodeXml(text)}</w:t></w:r>`
        : ''
      return `${opening}${properties}${content}</w:p>`
    }

    return text.split(anyCommand)
      .filter((piece) => piece.length > 0)
      .map(makeParagraph)
      .join('')
  })
}

const OPENING = /^(?:FOR\s+\S+\s+IN\s+.+|IF\s+.+)$/
const CLOSING = /^END-(?:FOR|IF)(?:\s+\S+)?$/

/** A block-structure problem, at the index of the command it names. */
export interface DocxControlProblem {
  index: number
  message: string
}

/**
 * Check that a part's control commands nest: each END-FOR or END-IF closes the
 * block it follows (an END-FOR that names its row names the loop's row), an
 * IF has at most one ELSE, and ELSE appears only in an IF. `commands` lists
 * every command paragraph in document order; other entries are skipped.
 */
export function docxControlProblems(commands: readonly (string | undefined)[]): DocxControlProblem[] {
  const problems: DocxControlProblem[] = []
  const open: Array<{ index: number; command: string; kind: 'FOR' | 'IF'; alias?: string; hasElse: boolean }> = []
  commands.forEach((command, index) => {
    if (command === undefined) return
    if (OPENING.test(command)) {
      const kind = command.startsWith('FOR ') ? 'FOR' : 'IF'
      open.push({ index, command, kind, alias: kind === 'FOR' ? command.split(/\s+/)[1] : undefined, hasElse: false })
      return
    }
    if (CLOSING.test(command)) {
      const [closer, alias] = command.split(/\s+/) as [string, string | undefined]
      const block = open.pop()
      if (!block) problems.push({ index, message: `Unexpected ${command}: no block is open.` })
      else if (closer !== `END-${block.kind}`) problems.push({ index, message: `${command} cannot close ${block.command}; write END-${block.kind}.` })
      else if (alias !== undefined && alias !== block.alias) problems.push({ index, message: `${command} cannot close ${block.command}; write END-FOR ${block.alias}.` })
      return
    }
    if (command === 'ELSE') {
      const block = open.at(-1)
      if (block?.kind !== 'IF') problems.push({ index, message: 'ELSE belongs inside an IF block.' })
      else if (block.hasElse) problems.push({ index, message: `${block.command} has a second ELSE; an IF takes one.` })
      else block.hasElse = true
    }
  })
  for (const block of open) problems.push({ index: block.index, message: `Unclosed DOCX control command: ${block.command}` })
  return problems.sort((a, b) => a.index - b.index)
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
  return xml.replace(/<w:p\b[^>]*>/g, (open) => `${open}<!--pdc:${++count}-->`)
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

  const before = xml.slice(0, opening.start)
  // validateControls ran over the whole part, so every opener has its closer.
  const close = closing!
  const truthyBody = xml.slice(opening.end, alternative?.start ?? close.start)
  const falseBody = alternative ? xml.slice(alternative.end, close.start) : ''
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
  return `${renderLeafXml(before, run)}${expanded}${expandControls(xml.slice(close.end), run)}`
}

/** Reject a part whose control commands do not nest, before any of it renders. */
function validateControls(xml: string, run: DocxRun): void {
  const controls = controlsIn(xml, run.delimiters)
  const [problem] = docxControlProblems(controls.map(({ command }) => command))
  if (!problem) return
  const control = controls[problem.index]!
  throw new TemplateError({ code: 'markers', message: problem.message, location: locate(run, xml.slice(control.start, control.end)) }, run.options.layer)
}

function renderRunText(text: string, run: DocxRun): string {
  const nodes = parseTemplate(normalizeDelimiters(text, run.delimiters))
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
  signatureOptions,
  options = {},
  expressions,
  layer,
}: RenderDocxOptions): Promise<Uint8Array> {
  const prepared = form
    ? formatFieldData(data, form, formatter)
    : data
  const { context, resolveData } = templateData(data, prepared, form, expressions)
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
    const xml = markParagraphs(normalizeInlineControls(textDecoder.decode(bytes), delimiters))
    const run: DocxRun = { scope, options: templateOptions, delimiters, processLineBreaks, part: name }
    validateControls(xml, run)
    files[name] = textEncoder.encode(unmarkParagraphs(expandControls(xml, run)))
  }
  return zipSync(files, { level: 6 })
}

/** The parts of a Word package that carry template text. */
export const DOCX_TEMPLATE_PARTS = /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/
