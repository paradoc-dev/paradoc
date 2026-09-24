/**
 * The `@example` in validateLogic's docstring is what an editor shows a
 * caller. This runs it as written and holds it to the full validate().
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validate, validateLogic } from '../../../src'

const SOURCE = join(import.meta.dirname, '../../../src/logic/design-time/validation/index.ts')

/** The code of the `@example` block in the JSDoc just above `export function <name>`. */
function docExample(name: string): string {
  const source = readFileSync(SOURCE, 'utf8')
  const end = source.indexOf(`export function ${name}`)
  const doc = source.slice(source.lastIndexOf('/**', end), end)
  const code = doc.match(/@example\s*\n\s*\*\s*```typescript\n([\s\S]*?)\n\s*\*\s*```/)
  if (!code) throw new Error(`No @example for ${name}`)
  return code[1]!.split('\n').map((line) => line.replace(/^\s*\* ?/, '')).join('\n')
}

/** Runs the example with its import and type annotations removed, and returns its `form` and `result`. */
function runExample(code: string): { form: unknown; result: ReturnType<typeof validateLogic>; logged: unknown[][] } {
  const body = code.replace(/^import .*$/m, '').replace(/const form: Form =/, 'const form =')
  const logged: unknown[][] = []
  const sink = { log: (...args: unknown[]) => logged.push(args), error: (...args: unknown[]) => logged.push(['error', ...args]) }
  const run = new Function('validateLogic', 'console', `${body}\nreturn { form, result }`) as (
    validator: typeof validateLogic,
    console: typeof sink,
  ) => { form: unknown; result: ReturnType<typeof validateLogic> }
  return { ...run(validateLogic, sink), logged }
}

describe('validateLogic docstring example', () => {
  const code = docExample('validateLogic')

  it('runs as written and reports the artifact as valid', () => {
    const { result, logged } = runExample(code)
    expect(result.issues).toBeUndefined()
    expect(logged).toEqual([['Valid artifact:', expect.anything()]])
  })

  it('shows a form that passes full validation', () => {
    const { form } = runExample(code)
    expect(validate(form).issues).toBeUndefined()
  })

  it('catches an example whose form does not validate', () => {
    const broken = code.replace(/(defs|logic):/, 'unknownKey:')
    expect(validate(runExample(broken).form).issues).toBeDefined()
  })
})
