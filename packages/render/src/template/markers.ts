/**
 * Block markers of text, Markdown, and HTML templates.
 *
 * The markers are `{{#if}}`, `{{#unless}}`, `{{else}}`, `{{#each}}`, their
 * closing tags, comments, and value placeholders (`{{ }}` escaped, `{{{ }}}`
 * raw). Everything inside a marker is an artifact expression, parsed
 * here once so rendering and checking read the same tree.
 */

import { parse, type Expr } from '@paradoc/expr'
import { removedSyntaxHint, TemplateError, type TemplateDiagnostic, type TemplatePosition } from './errors'

export interface ExpressionSlot {
  /** Expression source as written. */
  source: string
  /** Parsed expression, or undefined when it does not parse. */
  ast?: Expr
  /** Why it does not parse, with the replacement for removed syntax. */
  problem?: TemplateDiagnostic
  position: TemplatePosition
}

export interface TextNode {
  type: 'text'
  value: string
}

export interface ValueNode {
  type: 'value'
  slot: ExpressionSlot
  escaped: boolean
}

export interface BlockNode {
  type: 'if' | 'unless' | 'each'
  slot: ExpressionSlot
  children: TemplateNode[]
  inverse: TemplateNode[]
}

export type TemplateNode = TextNode | ValueNode | BlockNode

/** Offsets to 1-based line and column, for one template source. */
export function positionFinder(source: string, base: TemplatePosition = { line: 1, column: 1 }): (offset: number) => TemplatePosition {
  const lineStarts = [0]
  for (let index = 0; index < source.length; index++) if (source[index] === '\n') lineStarts.push(index + 1)
  return (offset) => {
    let line = 0
    while (line + 1 < lineStarts.length && lineStarts[line + 1]! <= offset) line++
    const column = offset - lineStarts[line]! + 1
    return line === 0
      ? { line: base.line, column: base.column + column - 1 }
      : { line: base.line + line, column }
  }
}

/** Parse one expression, keeping any problem for validation to report. */
export function expressionSlot(source: string, position: TemplatePosition): ExpressionSlot {
  const trimmed = source.trim()
  if (trimmed === '') {
    return { source: trimmed, position, problem: { code: 'syntax', message: 'The marker holds no expression.', expression: trimmed, position } }
  }
  const { ast, errors } = parse(trimmed)
  if (ast) return { source: trimmed, ast, position }
  const hint = removedSyntaxHint(trimmed)
  return {
    source: trimmed,
    position,
    problem: {
      code: hint ? 'removed-syntax' : 'syntax',
      message: hint ?? errors[0]?.message ?? 'The expression does not parse.',
      expression: trimmed,
      position,
    },
  }
}

const TAG = /\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g

/**
 * Parse a text template into nodes. Malformed or mismatched markers throw a
 * {@link TemplateError}; an expression that does not parse is kept on its
 * node, so validation can report every one of them.
 */
export function parseTemplate(template: string, base?: TemplatePosition): TemplateNode[] {
  const positionAt = positionFinder(template, base)
  const root: TemplateNode[] = []
  const stack: Array<{ block: BlockNode; output: TemplateNode[]; tag: string; position: TemplatePosition }> = []
  let output = root
  let cursor = 0
  let skipLineBreak = false

  const fail = (message: string, offset: number): never => {
    throw new TemplateError({ code: 'markers', message, position: positionAt(offset) })
  }

  /** A block marker alone on its line takes the line with it. */
  const standalone = (start: number, end: number): boolean => {
    const lineStart = template.lastIndexOf('\n', start - 1) + 1
    const lineEndIndex = template.indexOf('\n', end)
    const lineEnd = lineEndIndex === -1 ? template.length : lineEndIndex
    return /^[\t ]*$/.test(template.slice(lineStart, start)) && /^[\t \r]*$/.test(template.slice(end, lineEnd))
  }

  const pushText = (value: string) => {
    let text = value
    if (skipLineBreak) {
      text = text.replace(/^[\t ]*\r?\n?/, '')
      skipLineBreak = false
    }
    if (text.length > 0) output.push({ type: 'text', value: text })
  }

  const trimLineBefore = () => {
    const last = output.at(-1)
    if (last?.type !== 'text') return
    last.value = last.value.replace(/[\t ]*$/, '')
    if (last.value.length === 0) output.pop()
  }

  for (const match of template.matchAll(TAG)) {
    const index = match.index ?? 0
    const token = match[0]
    const end = index + token.length
    if (index > cursor) pushText(template.slice(cursor, index))
    else if (skipLineBreak) skipLineBreak = false
    cursor = end

    const triple = token.startsWith('{{{')
    const inner = token.slice(triple ? 3 : 2, triple ? -3 : -2)
    const innerOffset = index + (triple ? 3 : 2) + (inner.length - inner.trimStart().length)
    const content = inner.trim()

    if (!triple && content.startsWith('!')) continue

    const isBlockTag = !triple && (content.startsWith('#') || content.startsWith('/') || content === 'else')
    if (isBlockTag && standalone(index, end)) {
      trimLineBefore()
      skipLineBreak = true
    }

    if (!triple && content.startsWith('#')) {
      const body = content.slice(1)
      const name = body.match(/^\S*/)?.[0] ?? ''
      const expression = body.slice(name.length)
      if (name === 'with') fail('{{#with}} is removed; write full paths, such as parties.tenant.name.', index)
      if (name !== 'if' && name !== 'unless' && name !== 'each') fail(`Unsupported block {{#${name}}}; use {{#if}}, {{#unless}}, or {{#each}}.`, index)
      const expressionOffset = innerOffset + 1 + name.length + (expression.length - expression.trimStart().length)
      const block: BlockNode = {
        type: name as BlockNode['type'],
        slot: expressionSlot(expression, positionAt(expressionOffset)),
        children: [],
        inverse: [],
      }
      output.push(block)
      stack.push({ block, output, tag: name, position: positionAt(index) })
      output = block.children
      continue
    }

    if (!triple && content === 'else') {
      const current = stack.at(-1)
      if (!current) fail('Unexpected {{else}}', index)
      if (output === current!.block.inverse) fail('A block has more than one {{else}}', index)
      output = current!.block.inverse
      continue
    }

    if (!triple && content.startsWith('/')) {
      const name = content.slice(1).trim()
      const current = stack.pop()
      if (!current || current.tag !== name) fail(`Unexpected closing block {{/${name}}}`, index)
      output = current!.output
      continue
    }

    output.push({ type: 'value', slot: expressionSlot(inner, positionAt(innerOffset)), escaped: !triple })
  }

  if (cursor < template.length) pushText(template.slice(cursor))
  const open = stack.at(-1)
  if (open) throw new TemplateError({ code: 'markers', message: `Unclosed block {{#${open.tag}}}`, position: open.position })
  return root
}
