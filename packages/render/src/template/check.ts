/**
 * Authoring checks for template expressions.
 *
 * Every condition, loop source, placeholder, and directive argument is parsed
 * and type-checked against the artifact's type environment, the one its field
 * logic is checked against. A condition must be boolean and a loop source a
 * list; `item`, `parent`, a DOCX loop's name, and the loop-only functions
 * resolve only inside a loop.
 */

import { unzipSync } from 'fflate'
import { checkAst, formatType, T, type Diagnostic, type Expr, type ExprType, type TypeEnv } from '@paradoc/expr'
import { removedSyntaxHint, TemplateError, type TemplateDiagnostic, type TemplatePosition } from './errors'
import { expressionSlot, parseTemplate, type ExpressionSlot, type TemplateNode } from './markers'
import { frameFor, LOOP_FUNCTION_NAMES, referenceSegments, withLoopFunctions } from './scope'
import { SIGNING_DIRECTIVES } from '../text/template'
import {
  docxControlProblems,
  DOCX_TEMPLATE_PARTS,
  normalizeDelimiters,
  normalizeInlineControls,
  paragraphText,
} from '../docx/render'

interface CheckFrame {
  kind: 'each' | 'named'
  name?: string
  element: ExprType
  /** The loop source's path in the type environment, when it is one. */
  sourcePath?: string
}

class CheckScope {
  constructor(readonly env: TypeEnv, readonly frames: readonly CheckFrame[] = []) {}

  push(frame: CheckFrame): CheckScope {
    return new CheckScope(this.env, [...this.frames, frame])
  }

  frameFor(name: string): CheckFrame | undefined {
    return frameFor(this.frames, name)
  }

  typeEnv(): TypeEnv {
    if (this.frames.length === 0) return this.env
    return {
      registry: withLoopFunctions(this.env.registry),
      resolve: (path) => {
        const [head, ...rest] = path.split('.')
        const frame = head ? this.frameFor(head) : undefined
        if (!frame) return this.env.resolve(path)
        if (rest.length === 0) return frame.element
        if (frame.sourcePath) return this.env.resolve([frame.sourcePath, ...rest].join('.'))
        return T.unknown
      },
    }
  }

  /** The environment path a list expression names, so its rows' members can be typed. */
  sourcePath(node: Expr): string | undefined {
    const segments = referenceSegments(node)
    if (!segments || segments.some((segment) => /^\d+$/.test(segment))) return undefined
    const [head, ...rest] = segments
    const frame = head ? this.frameFor(head) : undefined
    if (frame) return frame.sourcePath ? [frame.sourcePath, ...rest].join('.') : undefined
    return segments.join('.')
  }
}

function at(slot: ExpressionSlot, span: Diagnostic['span']): TemplatePosition {
  return span.start.line === 1
    ? { line: slot.position.line, column: slot.position.column + span.start.column - 1 }
    : { line: slot.position.line + span.start.line - 1, column: span.start.column }
}

function diagnosticsFor(slot: ExpressionSlot, node: Expr, scope: CheckScope): { type: ExprType; diagnostics: TemplateDiagnostic[] } {
  const result = checkAst(node, scope.typeEnv())
  const diagnostics = result.diagnostics.map((diagnostic): TemplateDiagnostic => {
    let message = diagnostic.message
    const unknown = diagnostic.name
    if (diagnostic.code === 'unknown-function' && unknown && LOOP_FUNCTION_NAMES.has(unknown)) {
      message = `${unknown}() is valid only inside a loop.`
    } else if (diagnostic.code === 'unknown-identifier' && (unknown === 'item' || unknown === 'parent')) {
      message = unknown === 'item' ? 'item is valid only inside a loop.' : 'parent is valid only inside a nested loop.'
    } else if (diagnostic.code === 'unknown-identifier' && unknown?.split('.')[0] === 'this') {
      message = removedSyntaxHint('this')!
    }
    return { code: diagnostic.code, message, expression: slot.source, position: at(slot, diagnostic.span) }
  })
  diagnostics.push(...loopFunctionMisuse(slot, node, scope))
  return { type: result.type, diagnostics }
}

/** `index`, `first`, and `last` take a loop row, never some other value. */
function loopFunctionMisuse(slot: ExpressionSlot, node: Expr, scope: CheckScope): TemplateDiagnostic[] {
  const found: TemplateDiagnostic[] = []
  const visit = (current: Expr): void => {
    if (current.kind === 'Call') {
      if (LOOP_FUNCTION_NAMES.has(current.callee) && scope.frames.length > 0) {
        const arg = current.args[0]
        if (current.args.length !== 1 || arg?.kind !== 'Identifier' || !scope.frameFor(arg.name)) {
          found.push({ code: 'type-mismatch', message: `${current.callee}() takes a loop row, such as ${current.callee}(item).`, expression: slot.source, position: at(slot, current.span) })
        }
      }
      current.args.forEach(visit)
      return
    }
    for (const value of Object.values(current)) {
      if (value && typeof value === 'object' && 'kind' in value && 'span' in value) visit(value as Expr)
      if (Array.isArray(value)) value.forEach((element) => element && typeof element === 'object' && 'kind' in element && visit(element as Expr))
    }
  }
  visit(node)
  return found
}

function checkDirective(slot: ExpressionSlot, node: Extract<Expr, { kind: 'Call' }>, scope: CheckScope): TemplateDiagnostic[] {
  const found: TemplateDiagnostic[] = []
  if (node.args.length < 1 || node.args.length > 2) {
    found.push({ code: 'arity', message: `${node.callee} takes a location, or a party and a location, such as ${node.callee}(parties.tenant, "tenant-sign").`, expression: slot.source, position: slot.position })
    return found
  }
  if (node.args.length === 1 && scope.frames.length === 0) {
    found.push({ code: 'arity', message: `${node.callee}() needs a party: use it inside a party loop, or pass the party first, such as ${node.callee}(parties.tenant, "location").`, expression: slot.source, position: slot.position })
  }
  for (const arg of node.args) found.push(...diagnosticsFor(slot, arg, scope).diagnostics)
  const location = diagnosticsFor(slot, node.args.at(-1)!, scope).type
  if (location.kind !== 'string' && location.kind !== 'unknown') {
    found.push({ code: 'type-mismatch', message: `${node.callee}'s location must be a string, got ${formatType(location)}.`, expression: slot.source, position: slot.position })
  }
  return found
}

function checkSlot(slot: ExpressionSlot, scope: CheckScope, role: 'value' | 'condition' | 'loop'): { diagnostics: TemplateDiagnostic[]; frame?: CheckFrame } {
  if (!slot.ast) return { diagnostics: slot.problem ? [slot.problem] : [] }
  if (role === 'value' && slot.ast.kind === 'Call' && SIGNING_DIRECTIVES.has(slot.ast.callee)) {
    return { diagnostics: checkDirective(slot, slot.ast, scope) }
  }
  const { type, diagnostics } = diagnosticsFor(slot, slot.ast, scope)
  if (diagnostics.length > 0) return { diagnostics }
  if (role === 'condition' && type.kind !== 'boolean') {
    return {
      diagnostics: [{
        code: 'non-boolean-gate',
        message: type.kind === 'unknown'
          ? 'A condition must be boolean; its type cannot be determined. Compare it, such as value != null.'
          : `A condition must be boolean, got ${formatType(type)}. Compare it, such as value != null.`,
        expression: slot.source,
        position: slot.position,
      }],
    }
  }
  if (role === 'loop') {
    if (type.kind !== 'array') {
      return { diagnostics: [{ code: 'type-mismatch', message: `A loop source must be a list, got ${formatType(type)}.`, expression: slot.source, position: slot.position }] }
    }
    return { diagnostics: [], frame: { kind: 'each', element: type.element, sourcePath: scope.sourcePath(slot.ast) } }
  }
  return { diagnostics: [] }
}

function checkNodes(nodes: readonly TemplateNode[], scope: CheckScope, found: TemplateDiagnostic[]): void {
  for (const node of nodes) {
    if (node.type === 'text') continue
    if (node.type === 'value') {
      found.push(...checkSlot(node.slot, scope, 'value').diagnostics)
      continue
    }
    if (node.type === 'each') {
      const { diagnostics, frame } = checkSlot(node.slot, scope, 'loop')
      found.push(...diagnostics)
      checkNodes(node.children, frame ? scope.push(frame) : scope.push({ kind: 'each', element: T.unknown }), found)
      checkNodes(node.inverse, scope, found)
      continue
    }
    found.push(...checkSlot(node.slot, scope, 'condition').diagnostics)
    checkNodes(node.children, scope, found)
    checkNodes(node.inverse, scope, found)
  }
}

function markerProblem(error: unknown): TemplateDiagnostic[] {
  if (error instanceof TemplateError) return [error.diagnostic]
  throw error
}

/** Check every expression in a text, Markdown, or HTML template. */
export function checkTextTemplate(template: string, env: TypeEnv): TemplateDiagnostic[] {
  let nodes: TemplateNode[]
  try {
    nodes = parseTemplate(template)
  } catch (error) {
    return markerProblem(error)
  }
  const found: TemplateDiagnostic[] = []
  checkNodes(nodes, new CheckScope(env), found)
  return found
}

export interface DocxCheckOptions {
  /** Command delimiters, when the template does not use `{{` and `}}`. */
  cmdDelimiter?: [string, string]
}

const textDecoder = new TextDecoder()

/** Check every control command and expression in a Word template. */
export function checkDocxTemplate(template: Uint8Array, env: TypeEnv, options: DocxCheckOptions = {}): TemplateDiagnostic[] {
  const delimiters = options.cmdDelimiter ?? ['{{', '}}']
  const found: TemplateDiagnostic[] = []
  for (const [part, bytes] of Object.entries(unzipSync(template))) {
    if (!DOCX_TEMPLATE_PARTS.test(part)) continue
    const xml = normalizeInlineControls(textDecoder.decode(bytes), delimiters)
    const paragraphs = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)]
    const commands = paragraphs.map((match) => commandOf(match[0], delimiters))
    for (const { index, message } of docxControlProblems(commands)) {
      found.push({ code: 'markers', message, location: `${part} paragraph ${index + 1}` })
    }
    let scope = new CheckScope(env)
    const open: Array<'IF' | 'FOR'> = []
    paragraphs.forEach((match, index) => {
      const location = `${part} paragraph ${index + 1}`
      const locate = (diagnostics: TemplateDiagnostic[]) => diagnostics.map((diagnostic) => ({ ...diagnostic, location }))
      // A control command fills its paragraph, so the paragraph is its position.
      const locateCommand = (diagnostics: TemplateDiagnostic[]) => diagnostics.map(({ position: _position, ...diagnostic }) => ({ ...diagnostic, location }))
      const command = commands[index]
      if (command !== undefined) {
        const forMatch = command.match(/^FOR\s+(\S+)\s+IN\s+(.+)$/)
        if (forMatch) {
          const slot = expressionSlot(forMatch[2]!, { line: 1, column: 1 })
          const { diagnostics, frame } = checkSlot(slot, scope, 'loop')
          found.push(...locateCommand(diagnostics))
          scope = scope.push({ ...(frame ?? { element: T.unknown }), kind: 'named', name: forMatch[1]! })
          open.push('FOR')
          return
        }
        if (/^IF\s+/.test(command)) {
          found.push(...locateCommand(checkSlot(expressionSlot(command.slice(3), { line: 1, column: 1 }), scope, 'condition').diagnostics))
          open.push('IF')
          return
        }
        if (/^END-(?:FOR|IF)/.test(command)) {
          if (open.pop() === 'FOR') scope = new CheckScope(scope.env, scope.frames.slice(0, -1))
          return
        }
        if (command === 'ELSE') return
      }
      const text = paragraphText(match[0])
      if (!text.includes(delimiters[0])) return
      let nodes: TemplateNode[]
      try {
        nodes = parseTemplate(normalizeDelimiters(text, delimiters))
      } catch (error) {
        found.push(...locate(markerProblem(error)))
        return
      }
      const inner: TemplateDiagnostic[] = []
      checkNodes(nodes, scope, inner)
      found.push(...locate(inner))
    })
  }
  return found
}

function commandOf(paragraph: string, delimiters: [string, string]): string | undefined {
  const value = paragraphText(paragraph).trim()
  if (!value.startsWith(delimiters[0]) || !value.endsWith(delimiters[1])) return undefined
  const inner = value.slice(delimiters[0].length, -delimiters[1].length).trim()
  return /^(?:FOR\s|IF\s|ELSE$|END-(?:FOR|IF))/.test(inner) ? inner : undefined
}

/** A signing directive a template writes, such as `signature(parties.tenant, "tenant-sign")`. */
export interface SigningDirectiveUse {
  /** The directive name: `signature`, `initials`, `signatureDate`, `capacity`, or `printedName`. */
  directive: string
  /** The location the directive places, when written as a string literal; undefined when computed. */
  location?: string
}

function collectDirectives(nodes: readonly TemplateNode[], found: SigningDirectiveUse[]): void {
  for (const node of nodes) {
    if (node.type === 'text') continue
    if (node.type === 'value') {
      const ast = node.slot.ast
      if (ast?.kind !== 'Call' || !SIGNING_DIRECTIVES.has(ast.callee) || ast.args.length === 0) continue
      const location = ast.args.at(-1)!
      found.push({ directive: ast.callee, ...(location.kind === 'StringLiteral' && { location: location.value }) })
      continue
    }
    collectDirectives(node.children, found)
    collectDirectives(node.inverse, found)
  }
}

/**
 * The signing directives a text, Markdown, or HTML template writes, including
 * those inside blocks. Undefined when the template's markers do not parse, so
 * which directives it writes is unknown.
 */
export function textTemplateSigningDirectives(template: string): SigningDirectiveUse[] | undefined {
  let nodes: TemplateNode[]
  try {
    nodes = parseTemplate(template)
  } catch (error) {
    if (error instanceof TemplateError) return undefined
    throw error
  }
  const found: SigningDirectiveUse[] = []
  collectDirectives(nodes, found)
  return found
}
