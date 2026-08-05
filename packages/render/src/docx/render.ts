import { preprocessFieldData, usaSerializers } from '@paradoc/serialization'
import type { Bindings, Form, SerializerRegistry } from '@paradoc/types'
import { unzipSync, zipSync } from 'fflate'
import { applyBindings } from '../text/bindings'
import { createSerializedFieldValue } from '../text/field-serializer'
import { renderTemplate } from '../text/template'
import { getPath } from '../path'
import { createDocxTemplateHelpers, type DocxSignatureOptions } from './signatures'

export type { DocxSignatureOptions } from './signatures'

export interface DocxRenderOptions {
  cmdDelimiter?: [string, string]
  failFast?: boolean
  processLineBreaks?: boolean
}

export interface RenderDocxOptions {
  template: Uint8Array
  data: Record<string, unknown>
  form?: Form
  serializers?: SerializerRegistry
  bindings?: Bindings
  signatureOptions?: DocxSignatureOptions
  options?: DocxRenderOptions
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

function paragraphText(paragraph: string): string {
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

function expressionValue(expression: string, data: Record<string, unknown>): unknown {
  const value = expression.trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value)
  return getPath(data, value)
}

function evaluateCondition(expression: string, data: Record<string, unknown>): boolean {
  const value = expression.trim()
  if (value.startsWith('!')) return !expressionValue(value.slice(1), data)
  const comparison = value.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/)
  if (!comparison) return Boolean(expressionValue(value, data))
  const left = expressionValue(comparison[1]!, data)
  const right = expressionValue(comparison[3]!, data)
  switch (comparison[2]) {
    case '===': return left === right
    case '!==': return left !== right
    case '==': return String(left) === String(right)
    case '!=': return String(left) !== String(right)
    case '>=': return Number(left) >= Number(right)
    case '<=': return Number(left) <= Number(right)
    case '>': return Number(left) > Number(right)
    case '<': return Number(left) < Number(right)
    default: return false
  }
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
function normalizeInlineControls(xml: string): string {
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

type DocxHelpers = Record<string, import('../text/template').TemplateHelper>

function expandControls(
  xml: string,
  data: Record<string, unknown>,
  delimiters: [string, string],
  helpers: DocxHelpers,
  processLineBreaks: boolean,
): string {
  const controls = controlsIn(xml, delimiters)
  const openingIndex = controls.findIndex(({ command }) => /^(?:FOR\s+\S+\s+IN\s+.+|IF\s+.+)$/.test(command))
  if (openingIndex === -1) return renderLeafXml(xml, data, delimiters, helpers, processLineBreaks)
  const opening = controls[openingIndex]!
  const isFor = opening.command.startsWith('FOR ')
  let depth = 1
  let closing: Control | undefined
  let alternative: Control | undefined
  for (const control of controls.slice(openingIndex + 1)) {
    if (/^(?:FOR\s+\S+\s+IN\s+.+|IF\s+.+)$/.test(control.command)) depth++
    else if (/^END-(?:FOR|IF)(?:\s+\S+)?$/.test(control.command)) {
      depth--
      if (depth === 0) { closing = control; break }
    } else if (control.command === 'ELSE' && depth === 1) alternative = control
  }
  if (!closing) throw new Error(`Unclosed DOCX control command: ${opening.command}`)

  const before = xml.slice(0, opening.start)
  const truthyBody = xml.slice(opening.end, alternative?.start ?? closing.start)
  const falseBody = alternative ? xml.slice(alternative.end, closing.start) : ''
  let expanded = ''
  if (isFor) {
    const match = opening.command.match(/^FOR\s+(\S+)\s+IN\s+(.+)$/)!
    const alias = match[1]!
    const collection = expressionValue(match[2]!, data)
    const values = Array.isArray(collection)
      ? collection
      : collection && typeof collection === 'object' ? Object.values(collection) : []
    expanded = values.map((value, index) => expandControls(truthyBody, {
      ...data,
      [`$${alias}`]: value,
      $idx: index,
    }, delimiters, helpers, processLineBreaks)).join('')
  } else {
    const condition = opening.command.slice(3)
    expanded = expandControls(
      evaluateCondition(condition, data) ? truthyBody : falseBody,
      data,
      delimiters,
      helpers,
      processLineBreaks,
    )
  }
  return `${before}${expanded}${expandControls(xml.slice(closing.end), data, delimiters, helpers, processLineBreaks)}`
}

function normalizeDocxExpressions(value: string, delimiters: [string, string]): string {
  return normalizeDelimiters(value, delimiters)
    .replace(/\{\{\s*INS\s+([^}]+)\}\}/g, '{{$1}}')
    .replace(/\{\{\s*(signature|initials|signatureDate|capacity|printedName)\s*\(\s*([^,]+?)\s*,\s*((?:"[^"]*")|(?:'[^']*'))\s*\)\s*\}\}/g, '{{$1 $2 $3}}')
}

function renderTextNodeContent(
  value: string,
  data: Record<string, unknown>,
  delimiters: [string, string],
  helpers: DocxHelpers,
  processLineBreaks: boolean,
): string {
  const decoded = decodeXml(value)
  const normalized = normalizeDocxExpressions(decoded, delimiters)
  const rendered = encodeXml(renderTemplate(normalized, data, helpers, (text) => text))
  return processLineBreaks ? rendered.replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">') : rendered
}

function renderLeafXml(
  xml: string,
  data: Record<string, unknown>,
  delimiters: [string, string],
  helpers: DocxHelpers = {},
  processLineBreaks = true,
): string {
  const textNode = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g
  let rendered = xml.replace(textNode, (_, open: string, content: string, close: string) =>
    `${open}${renderTextNodeContent(content, data, delimiters, helpers, processLineBreaks)}${close}`)

  // Word may split a command across adjacent runs. Consolidate only the
  // affected paragraph; ordinary runs retain their original formatting.
  rendered = rendered.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const nodes = [...paragraph.matchAll(textNode)]
    const visible = nodes.map((match) => decodeXml(match[2] ?? '')).join('')
    const normalized = normalizeDocxExpressions(visible, delimiters)
    if (!normalized.includes('{{')) return paragraph
    let replacement = encodeXml(renderTemplate(normalized, data, helpers, (text) => text))
    if (processLineBreaks) replacement = replacement.replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">')
    let used = false
    return paragraph.replace(textNode, (_, open: string, _content: string, close: string) => {
      if (used) return `${open}${close}`
      used = true
      const value = replacement
      replacement = ''
      return `${open}${value}${close}`
    })
  })
  return rendered
}

function renderXml(
  xml: string,
  data: Record<string, unknown>,
  delimiters: [string, string],
  helpers: DocxHelpers,
  processLineBreaks: boolean,
): string {
  return expandControls(xml, data, delimiters, helpers, processLineBreaks)
}

export async function renderDocx({
  template,
  data,
  form,
  serializers = usaSerializers,
  bindings,
  signatureOptions,
  options = {},
}: RenderDocxOptions): Promise<Uint8Array> {
  let prepared = form
    ? preprocessFieldData(data, form, (value, fieldType) => createSerializedFieldValue(value, fieldType, serializers))
    : data
  if (bindings) prepared = applyBindings(prepared, bindings)
  const files = unzipSync(template)
  const delimiters = options.cmdDelimiter ?? ['{{', '}}']
  const helpers = createDocxTemplateHelpers(signatureOptions)
  const processLineBreaks = options.processLineBreaks ?? true
  for (const [name, bytes] of Object.entries(files)) {
    if (!/^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(name)) continue
    const xml = normalizeInlineControls(textDecoder.decode(bytes))
    try {
      files[name] = textEncoder.encode(renderXml(xml, prepared, delimiters, helpers, processLineBreaks))
    } catch (error) {
      if (options.failFast) throw error
    }
  }
  return zipSync(files, { level: 6 })
}
