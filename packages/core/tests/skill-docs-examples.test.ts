/**
 * Every labeled JSON example in the paradoc skill (paradoc/skills/skills/paradoc)
 * must pass what an author's artifact must pass. Artifact examples go through
 * the full `validate()`: schema, logic, template expressions, and layer
 * references. Configuration examples go through their Zod schema. This lives in
 * core because `@paradoc/schemas` cannot depend on `validate()`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GlobalConfigSchema } from '@paradoc/schemas'
import { validate } from '../src'

const SKILL_DIR = join(import.meta.dirname, '../../../skills/skills/paradoc')

interface JsonExample {
  location: string
  label: string | undefined
  body: string
}

/**
 * A JSON example opts into checking with `schema=<label>` on its fence. The
 * label names where the example sits; a fragment is merged into that minimal
 * container before it is checked.
 */
const BASE_FORM = { name: 'example', kind: 'form' }
const BASE_PDF_LAYER = { kind: 'file', mimeType: 'application/pdf', path: 'example.pdf' }

type Check = { artifact: unknown } | { config: unknown }

const LABELS: Record<string, (value: Record<string, unknown>) => Check> = {
  artifact: (value) => ({ artifact: value }),
  form: (value) => ({ artifact: { ...BASE_FORM, ...value } }),
  fields: (value) => ({ artifact: { ...BASE_FORM, fields: value } }),
  parties: (value) => ({ artifact: { ...BASE_FORM, parties: value } }),
  defs: (value) => ({ artifact: { ...BASE_FORM, defs: value } }),
  layers: (value) => ({ artifact: { ...BASE_FORM, layers: value } }),
  layer: (value) => ({ artifact: { ...BASE_FORM, layers: { example: { ...BASE_PDF_LAYER, ...value } } } }),
  'cli-config': (value) => ({ config: value }),
  registries: (value) => ({ config: { registries: value } }),
}

/** The JSON examples fenced in one Markdown file, with their labels. */
function examplesIn(file: string, markdown: string): JsonExample[] {
  return [...markdown.matchAll(/^```json(?![a-z])([^\n]*)\n([\s\S]*?)^```/gm)].map((match) => ({
    location: `${file}:${markdown.slice(0, match.index).split('\n').length}`,
    label: match[1]!.match(/\bschema=(\S+)/)?.[1],
    body: match[2]!,
  }))
}

function skillExamples(): JsonExample[] {
  const files = ['SKILL.md', ...readdirSync(join(SKILL_DIR, 'references')).map((name) => `references/${name}`)]
  return files.flatMap((file) => examplesIn(file, readFileSync(join(SKILL_DIR, file), 'utf8')))
}

/** A complete JSON value, or a run of `"key": value` members read as one object. */
function parseExample(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return JSON.parse(`{${body}}`)
  }
}

function parses(body: string): boolean {
  try {
    parseExample(body)
    return true
  } catch {
    return false
  }
}

/** The messages of every problem with a labeled example; empty when it is valid. */
function problems(example: JsonExample): string[] {
  const build = LABELS[example.label!]
  if (!build) return [`unknown label ${example.label}`]
  const check = build(parseExample(example.body) as Record<string, unknown>)
  if ('config' in check) {
    const result = GlobalConfigSchema.safeParse(check.config)
    return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
  }
  const result = validate(check.artifact)
  return result.issues ? result.issues.map((issue) => `${(issue.path ?? []).map(String).join('.')}: ${issue.message}`) : []
}

describe('skill docs: JSON examples', () => {
  const examples = skillExamples()
  const labeled = examples.filter((example) => example.label !== undefined)

  it('finds labeled examples', () => {
    expect(labeled.length).toBeGreaterThan(20)
  })

  it('labels every example that is valid JSON', () => {
    const unlabeled = examples.filter((example) => example.label === undefined && parses(example.body))
    expect(unlabeled.map((example) => example.location)).toEqual([])
  })

  it.each(labeled.map((example) => [example.location, example] as const))('%s passes full validation', (_location, example) => {
    expect(problems(example)).toEqual([])
  })
})

describe('skill docs: the example check itself', () => {
  const one = (fence: string, body: string): JsonExample => {
    const [example] = examplesIn('test.md', `Intro\n\n\`\`\`${fence}\n${body}\n\`\`\`\n`)
    return example!
  }

  it('reads the label and body of a fenced example', () => {
    const example = one('json schema=fields', '"age": { "type": "number" }')
    expect(example).toEqual({ location: 'test.md:3', label: 'fields', body: '"age": { "type": "number" }\n' })
    expect(problems(example)).toEqual([])
  })

  it('passes a valid form with logic and a signing template', () => {
    const form = {
      fields: { age: { type: 'number' }, consent: { type: 'boolean', visible: 'isAdult' } },
      defs: { isAdult: { type: 'boolean', value: 'fields.age >= 18' } },
      parties: { tenant: { label: 'Tenant' } },
      layers: {
        markdown: {
          kind: 'inline',
          mimeType: 'text/markdown',
          text: 'Age {{fields.age}} {{signature(parties.tenant, "tenant")}}',
          signatures: { tenant: { party: { role: 'tenant' }, type: 'signature', placement: 'flow' } },
        },
      },
    }
    expect(problems(one('json schema=form', JSON.stringify(form)))).toEqual([])
  })

  it('fails a schema-valid example whose logic names an unknown field', () => {
    const example = one('json schema=defs', '"isAdult": { "type": "boolean", "value": "fields.missing >= 18" }')
    expect(problems(example).join('\n')).toMatch(/missing/)
  })

  it('fails a schema-valid example whose template names an unknown field', () => {
    const layers = { markdown: { kind: 'inline', mimeType: 'text/markdown', text: 'Hi {{fields.nobody}}' } }
    expect(problems(one('json schema=layers', JSON.stringify(layers))).join('\n')).toMatch(/nobody/)
  })

  it('fails a schema-valid example whose signature slot names an undeclared role', () => {
    const form = {
      parties: { tenant: { label: 'Tenant' } },
      layers: {
        markdown: {
          kind: 'inline',
          mimeType: 'text/markdown',
          text: '{{signature(parties.tenant, "tenant")}}',
          signatures: { tenant: { party: { role: 'landlord' }, type: 'signature', placement: 'flow' } },
        },
      },
    }
    expect(problems(one('json schema=form', JSON.stringify(form))).join('\n')).toMatch(/landlord/)
  })

  it('fails a config example that breaks its schema', () => {
    expect(problems(one('json schema=registries', '"@acme": 42'))).not.toEqual([])
  })

  it('fails an example with an unknown label', () => {
    expect(problems(one('json schema=nothing', '{}'))).toEqual(['unknown label nothing'])
  })
})
