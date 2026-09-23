/**
 * What a field's `pattern` says about the values it accepts: how long they can
 * be, which characters each position may hold, and, for a pattern made of
 * hyphen-separated parts, the same for each part.
 *
 * The analysis reads the common regular expression subset artifacts use:
 * literals, escapes, character classes, `.`, groups, alternation, anchors, and
 * quantifiers. A pattern outside that subset (a backreference, for example) is
 * not analyzed, and the value is bounded by its `maxLength` alone.
 */

/**
 * The characters an unconstrained position may hold when looking for the
 * widest value: Latin letters and digits. Measured in Helvetica, the widest is
 * `W`.
 */
export const REFERENCE_REPERTOIRE = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'0123456789',
]

/** Largest range a character class is expanded over; a wider one reads as any character. */
const MAX_RANGE = 256

/** The characters one position may hold. */
type CharSet = { any: true } | { any: false; chars: string[] }

type PatternNode =
  | { kind: 'chars'; set: CharSet }
  | { kind: 'empty' }
  | { kind: 'seq'; items: PatternNode[] }
  | { kind: 'alt'; options: PatternNode[] }
  | { kind: 'repeat'; node: PatternNode; min: number; max: number }

class Unsupported extends Error {}

const DIGITS = [...'0123456789']
const WORD = [...REFERENCE_REPERTOIRE, '_']
const ANY: CharSet = { any: true }
const set = (chars: string[]): CharSet => ({ any: false, chars })

class Parser {
  private index = 0
  constructor(private readonly source: string) {}

  parse(): PatternNode {
    const node = this.alternation()
    if (this.index < this.source.length) throw new Unsupported(`unexpected ${this.source[this.index]}`)
    return node
  }

  private peek(): string | undefined {
    return this.source[this.index]
  }

  private alternation(): PatternNode {
    const options = [this.sequence()]
    while (this.peek() === '|') {
      this.index++
      options.push(this.sequence())
    }
    return options.length === 1 ? options[0]! : { kind: 'alt', options }
  }

  private sequence(): PatternNode {
    const items: PatternNode[] = []
    while (this.index < this.source.length && this.peek() !== '|' && this.peek() !== ')') {
      const atom = this.atom()
      items.push(this.quantified(atom))
    }
    return { kind: 'seq', items }
  }

  private quantified(node: PatternNode): PatternNode {
    const char = this.peek()
    let bounds: [number, number] | undefined
    if (char === '*') bounds = [0, Infinity]
    else if (char === '+') bounds = [1, Infinity]
    else if (char === '?') bounds = [0, 1]
    if (bounds) this.index++
    else if (char === '{') {
      const match = /^\{(\d+)(,(\d*))?\}/.exec(this.source.slice(this.index))
      if (!match) return node
      this.index += match[0].length
      const min = Number(match[1])
      bounds = [min, match[2] === undefined ? min : match[3] ? Number(match[3]) : Infinity]
    } else return node
    if (this.peek() === '?') this.index++
    return this.quantified({ kind: 'repeat', node, min: bounds[0], max: bounds[1] })
  }

  private atom(): PatternNode {
    const char = this.source[this.index++]!
    if (char === '^' || char === '$') return { kind: 'empty' }
    if (char === '.') return { kind: 'chars', set: ANY }
    if (char === '[') return { kind: 'chars', set: this.characterClass() }
    if (char === '\\') return this.escape(false)
    if (char === '(') {
      let lookaround = false
      if (this.peek() === '?') {
        const rest = this.source.slice(this.index)
        if (rest.startsWith('?:')) this.index += 2
        else if (/^\?(=|!|<=|<!)/.test(rest)) {
          lookaround = true
          this.index += rest.startsWith('?<') ? 3 : 2
        } else if (/^\?<[A-Za-z_$][\w$]*>/.test(rest)) this.index += rest.indexOf('>') + 1
        else throw new Unsupported('group modifier')
      }
      const inner = this.alternation()
      if (this.peek() !== ')') throw new Unsupported('unclosed group')
      this.index++
      return lookaround ? { kind: 'empty' } : inner
    }
    if (char === ')' || char === '*' || char === '+' || char === '?') throw new Unsupported(`unexpected ${char}`)
    return { kind: 'chars', set: set([char]) }
  }

  /** An escape after the backslash; inside a class, `\b` is a backspace. */
  private escape(inClass: boolean): PatternNode {
    const char = this.source[this.index++]
    if (char === undefined) throw new Unsupported('trailing backslash')
    if (char === 'd') return { kind: 'chars', set: set(DIGITS) }
    if (char === 'w') return { kind: 'chars', set: set(WORD) }
    if (char === 's') return { kind: 'chars', set: set([' ']) }
    if (char === 'D' || char === 'W' || char === 'S') return { kind: 'chars', set: ANY }
    if (!inClass && (char === 'b' || char === 'B')) return { kind: 'empty' }
    if (/[1-9]/.test(char) || char === 'k') throw new Unsupported('backreference')
    return { kind: 'chars', set: set([this.escapedCharacter(char)]) }
  }

  private escapedCharacter(char: string): string {
    const code = (length: number) => {
      const hex = this.source.slice(this.index, this.index + length)
      if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(hex)) throw new Unsupported('escape')
      this.index += length
      return String.fromCodePoint(Number.parseInt(hex, 16))
    }
    if (char === 'u') {
      if (this.peek() === '{') {
        const end = this.source.indexOf('}', this.index)
        if (end < 0) throw new Unsupported('escape')
        const value = String.fromCodePoint(Number.parseInt(this.source.slice(this.index + 1, end), 16))
        this.index = end + 1
        return value
      }
      return code(4)
    }
    if (char === 'x') return code(2)
    if (char === 't') return '\t'
    if (char === 'n') return '\n'
    if (char === 'r') return '\r'
    if (char === 'b') return '\b'
    if (char === 'p' || char === 'P') throw new Unsupported('property escape')
    return char
  }

  private characterClass(): CharSet {
    const negated = this.peek() === '^'
    if (negated) this.index++
    const chars: string[] = []
    let any = false
    let first = true
    while (this.peek() !== ']' || first) {
      first = false
      let char = this.source[this.index++]
      if (char === undefined) throw new Unsupported('unclosed class')
      if (char === '\\') {
        const escaped = this.escape(true)
        if (escaped.kind !== 'chars') continue
        if (escaped.set.any) {
          any = true
          continue
        }
        if (escaped.set.chars.length > 1) {
          chars.push(...escaped.set.chars)
          continue
        }
        char = escaped.set.chars[0]!
      }
      if (this.peek() === '-' && this.source[this.index + 1] !== ']' && this.source[this.index + 1] !== undefined) {
        this.index++
        let end = this.source[this.index++]!
        if (end === '\\') {
          const escaped = this.escape(true)
          if (escaped.kind !== 'chars' || escaped.set.any || escaped.set.chars.length !== 1) throw new Unsupported('range')
          end = escaped.set.chars[0]!
        }
        const from = char.codePointAt(0)!
        const to = end.codePointAt(0)!
        if (to < from) throw new Unsupported('range')
        if (to - from > MAX_RANGE) any = true
        else for (let point = from; point <= to; point++) chars.push(String.fromCodePoint(point))
        continue
      }
      chars.push(char)
    }
    this.index++
    return negated || any ? ANY : set([...new Set(chars)])
  }
}

function parsePattern(pattern: string): PatternNode | undefined {
  try {
    return new Parser(pattern).parse()
  } catch (error) {
    if (error instanceof Unsupported) return undefined
    throw error
  }
}

/**
 * The character a value holds at one position, chosen from the characters the
 * pattern allows there: the widest, or a typical one.
 */
export type CharacterPicker = (set: CharSet, position: number) => string

function maxLength(node: PatternNode): number {
  switch (node.kind) {
    case 'chars': return 1
    case 'empty': return 0
    case 'seq': return node.items.reduce((total, item) => total + maxLength(item), 0)
    case 'alt': return Math.max(...node.options.map(maxLength))
    case 'repeat': return node.max === 0 ? 0 : node.max * maxLength(node.node)
  }
}

function charSets(node: PatternNode): CharSet[] {
  switch (node.kind) {
    case 'chars': return [node.set]
    case 'empty': return []
    case 'seq': return node.items.flatMap(charSets)
    case 'alt': return node.options.flatMap(charSets)
    case 'repeat': return node.max === 0 ? [] : charSets(node.node)
  }
}

/**
 * The longest value the node accepts, each position filled by `pick`; where
 * alternatives differ, the one `width` measures widest. Undefined when unbounded.
 */
function longestValue(node: PatternNode, pick: CharacterPicker, width: (text: string) => number, start = 0): string | undefined {
  switch (node.kind) {
    case 'chars': return pick(node.set, start)
    case 'empty': return ''
    case 'seq': {
      let text = ''
      for (const item of node.items) {
        const part = longestValue(item, pick, width, start + [...text].length)
        if (part === undefined) return undefined
        text += part
      }
      return text
    }
    case 'alt': {
      const options = node.options.map((option) => longestValue(option, pick, width, start))
      if (options.some((option) => option === undefined)) return undefined
      return (options as string[]).reduce((best, option) => width(option) > width(best) ? option : best)
    }
    case 'repeat': {
      if (node.max === Infinity) return undefined
      let text = ''
      for (let count = 0; count < node.max; count++) {
        const part = longestValue(node.node, pick, width, start + [...text].length)
        if (part === undefined) return undefined
        text += part
      }
      return text
    }
  }
}

function isHyphen(node: PatternNode): boolean {
  return node.kind === 'chars' && !node.set.any && node.set.chars.length === 1 && node.set.chars[0] === '-'
}

function canHoldHyphen(node: PatternNode): boolean {
  return charSets(node).some((item) => item.any || item.chars.includes('-'))
}

/** Flatten a pattern's top level into one sequence of items, if it is one. */
function topLevelItems(node: PatternNode): PatternNode[] | undefined {
  if (node.kind === 'seq') {
    return node.items.flatMap((item) => item.kind === 'seq' ? topLevelItems(item) ?? [item] : [item])
  }
  if (node.kind === 'alt') return undefined
  return [node]
}

/** What a pattern bounds about a value, measured with one font. */
export interface ValueShape {
  /** Most characters a value may have; Infinity when unbounded. */
  maxLength: number
  /** Every character set a position may hold. */
  sets: CharSet[]
  /** The longest value, filled by the picker, when the pattern's own structure bounds it. */
  value?: string
}

/** Analyze a pattern; undefined when it is outside the supported subset. */
export function analyzePattern(pattern: string): PatternAnalysis | undefined {
  const node = parsePattern(pattern)
  return node && new PatternAnalysis(node)
}

/** A parsed pattern: its shape as a whole, and the shape of each hyphen-separated part. */
export class PatternAnalysis {
  constructor(private readonly node: PatternNode) {}

  /** The whole value's shape. */
  shape(width: (text: string) => number, pick: CharacterPicker): ValueShape {
    return shapeOf(this.node, width, pick)
  }

  /**
   * The shape of the `index`th (0-based) part of a value split on `-`, when
   * the pattern is a sequence whose hyphens are fixed separators. Undefined
   * when the pattern does not fix where the hyphens fall.
   */
  part(index: number, width: (text: string) => number, pick: CharacterPicker): ValueShape | undefined {
    const items = topLevelItems(this.node)
    if (!items) return undefined
    const parts: PatternNode[][] = [[]]
    for (const item of items) {
      if (isHyphen(item)) parts.push([])
      else if (canHoldHyphen(item)) return undefined
      else parts.at(-1)!.push(item)
    }
    const part = parts[index]
    return part ? shapeOf({ kind: 'seq', items: part }, width, pick) : undefined
  }

  /** Every character set the pattern allows anywhere. */
  sets(): CharSet[] {
    return charSets(this.node)
  }
}

function shapeOf(node: PatternNode, width: (text: string) => number, pick: CharacterPicker): ValueShape {
  const value = longestValue(node, pick, width)
  return {
    maxLength: maxLength(node),
    sets: charSets(node),
    ...(value !== undefined && { value }),
  }
}

export type { CharSet }
