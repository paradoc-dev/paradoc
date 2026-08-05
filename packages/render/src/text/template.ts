interface TextNode {
  type: 'text'
  value: string
}

interface ExpressionNode {
  type: 'expression'
  value: string
  escaped: boolean
}

interface BlockNode {
  type: 'block'
  name: string
  expression: string
  children: Node[]
  inverse: Node[]
}

type Node = TextNode | ExpressionNode | BlockNode

interface Frame {
  context: unknown
  parent?: Frame
  data: Record<string, unknown>
}

export type TemplateHelper = (context: unknown, root: Record<string, unknown>, args: unknown[]) => unknown

type InternalHelper = (args: unknown[], frame: Frame, root: Record<string, unknown>) => unknown

const blockedProperties = new Set(['__proto__', 'constructor', 'prototype'])

const builtInHelpers: Record<string, InternalHelper> = {
  eq: ([a, b]) => a === b,
  ne: ([a, b]) => a !== b,
  gt: ([a, b]) => Number(a) > Number(b),
  gte: ([a, b]) => Number(a) >= Number(b),
  lt: ([a, b]) => Number(a) < Number(b),
  lte: ([a, b]) => Number(a) <= Number(b),
  not: ([value]) => !isTruthy(value),
  and: (args) => args.every(isTruthy),
  or: (args) => args.some(isTruthy),
  contains: ([value, expected]) => Array.isArray(value) && value.includes(expected),
  default: ([value, fallback]) => value !== null && value !== undefined && value !== '' ? value : fallback,
}

function parse(template: string): Node[] {
  template = template.replace(/^[\t ]*(?:\{\{(?:#|\/)[^}\r\n]+\}\}|\{\{else\}\})[\t ]*(?:\r?\n|$)/gm, (line) => {
    const tag = line.match(/\{\{[\s\S]*?\}\}/)?.[0] ?? ''
    return tag
  })
  const root: Node[] = []
  const stack: Array<{ block: BlockNode; output: Node[] }> = []
  let output = root
  let cursor = 0
  const pattern = /\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g

  for (const match of template.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) output.push({ type: 'text', value: template.slice(cursor, index) })

    const token = match[0]
    const escaped = !token.startsWith('{{{')
    const inner = token.slice(escaped ? 2 : 3, escaped ? -2 : -3).trim()

    if (inner.startsWith('!')) {
      cursor = index + token.length
      continue
    }

    if (inner.startsWith('#')) {
      const expression = inner.slice(1).trim()
      const separator = expression.search(/\s/)
      const name = separator === -1 ? expression : expression.slice(0, separator)
      const block: BlockNode = {
        type: 'block',
        name,
        expression: separator === -1 ? '' : expression.slice(separator + 1).trim(),
        children: [],
        inverse: [],
      }
      output.push(block)
      stack.push({ block, output })
      output = block.children
    } else if (inner === 'else') {
      const current = stack.at(-1)
      if (!current) throw new Error('Unexpected {{else}}')
      output = current.block.inverse
    } else if (inner.startsWith('/')) {
      const current = stack.pop()
      const name = inner.slice(1).trim()
      if (!current || current.block.name !== name) {
        throw new Error(`Unexpected closing block {{/${name}}}`)
      }
      output = current.output
    } else {
      output.push({ type: 'expression', value: inner.replace(/^&\s*/, ''), escaped: escaped && !inner.startsWith('&') })
    }

    cursor = index + token.length
  }

  if (cursor < template.length) output.push({ type: 'text', value: template.slice(cursor) })
  if (stack.length > 0) throw new Error(`Unclosed block {{#${stack.at(-1)!.block.name}}}`)
  return root
}

function tokenize(expression: string): string[] {
  const tokens: string[] = []
  let token = ''
  let quote: '"' | "'" | undefined

  const flush = () => {
    if (token.length > 0) tokens.push(token)
    token = ''
  }

  for (let index = 0; index < expression.length; index++) {
    const char = expression[index]!
    if (quote) {
      token += char
      if (char === '\\' && index + 1 < expression.length) token += expression[++index]
      else if (char === quote) quote = undefined
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      token += char
    } else if (char === '(' || char === ')') {
      flush()
      tokens.push(char)
    } else if (/\s/.test(char)) {
      flush()
    } else {
      token += char
    }
  }
  flush()
  return tokens
}

function evaluate(
  expression: string,
  frame: Frame,
  root: Record<string, unknown>,
  customHelpers: Record<string, TemplateHelper>,
): unknown {
  const tokens = tokenize(expression)
  let position = 0
  const helperFor = (name: string): InternalHelper | undefined =>
    builtInHelpers[name] ?? (customHelpers[name]
      ? (args, activeFrame, activeRoot) => customHelpers[name]!(activeFrame.context, activeRoot, args)
      : undefined)

  const read = (nested = false): unknown => {
    const token = tokens[position++]
    if (token === undefined) return undefined
    if (token === '(') {
      const name = tokens[position++]
      const helper = name ? helperFor(name) : undefined
      if (!name || !helper) throw new Error(`Unknown helper ${name ?? ''}`.trim())
      const args: unknown[] = []
      while (position < tokens.length && tokens[position] !== ')') args.push(read(true))
      if (tokens[position++] !== ')') throw new Error(`Unclosed subexpression (${name})`)
      return helper(args, frame, root)
    }
    if (token === ')') throw new Error('Unexpected )')
    if (nested) return valueForToken(token, frame, root)
    const helper = helperFor(token)
    if (helper && position < tokens.length) {
      const args: unknown[] = []
      while (position < tokens.length) args.push(read(true))
      return helper(args, frame, root)
    }
    return valueForToken(token, frame, root)
  }

  return read()
}

function valueForToken(token: string, frame: Frame, root: Record<string, unknown>): unknown {
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1).replace(/\\([\\"'])/g, '$1')
  }
  if (token === 'true') return true
  if (token === 'false') return false
  if (token === 'null') return null
  if (token === 'undefined') return undefined
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token)

  let targetFrame = frame
  while (token.startsWith('../')) {
    targetFrame = targetFrame.parent ?? targetFrame
    token = token.slice(3)
  }
  if (token === 'this' || token === '.') return targetFrame.context
  if (token.startsWith('this.')) token = token.slice(5)
  if (token === '@root') return root
  if (token.startsWith('@root.')) return getPath(root, token.slice(6))
  if (token.startsWith('@')) return targetFrame.data[token.slice(1)]
  if (token.startsWith('$')) return getPath(targetFrame.context, token)
  return getPath(targetFrame.context, token)
}

function getPath(value: unknown, path: string): unknown {
  if (path === '') return value
  let current = value
  for (const part of path.split(/[./]/).filter(Boolean)) {
    if (blockedProperties.has(part) || current === null || current === undefined) return undefined
    if (typeof current !== 'object' && typeof current !== 'function') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function renderNodes(
  nodes: Node[],
  frame: Frame,
  root: Record<string, unknown>,
  customHelpers: Record<string, TemplateHelper>,
  escape: (value: string) => string,
): string {
  let result = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      result += node.value
      continue
    }
    if (node.type === 'expression') {
      const value = evaluate(node.value, frame, root, customHelpers)
      const text = value === null || value === undefined ? '' : String(value)
      result += node.escaped ? escape(text) : text
      continue
    }

    const value = evaluate(node.expression, frame, root, customHelpers)
    if (node.name === 'if' || node.name === 'unless') {
      const include = node.name === 'if' ? isTruthy(value) : !isTruthy(value)
      result += renderNodes(include ? node.children : node.inverse, frame, root, customHelpers, escape)
    } else if (node.name === 'with') {
      result += isTruthy(value)
        ? renderNodes(node.children, { context: value, parent: frame, data: frame.data }, root, customHelpers, escape)
        : renderNodes(node.inverse, frame, root, customHelpers, escape)
    } else if (node.name === 'each') {
      const entries = Array.isArray(value)
        ? value.map((item, index) => [String(index), item] as const)
        : value && typeof value === 'object'
          ? Object.entries(value)
          : []
      if (entries.length === 0) {
        result += renderNodes(node.inverse, frame, root, customHelpers, escape)
      } else {
        entries.forEach(([key, item], index) => {
          result += renderNodes(node.children, {
            context: item,
            parent: frame,
            data: { key, index, first: index === 0, last: index === entries.length - 1 },
          }, root, customHelpers, escape)
        })
      }
    } else {
      throw new Error(`Unsupported block helper ${node.name}`)
    }
  }
  return result
}

function isTruthy(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"'`=]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;',
    '=': '&#x3D;',
  })[char]!)
}

export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  customHelpers: Record<string, TemplateHelper> = {},
  escape: (value: string) => string = escapeHtml,
): string {
  return renderNodes(parse(template), { context: data, data: {} }, data, customHelpers, escape)
}
