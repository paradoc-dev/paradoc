/**
 * The paradoc skill (paradoc/skills/skills/paradoc) is written by hand. These
 * tests hold its mechanically checkable facts to the schemas: the field type
 * list, the signature block and slot type names, and every labeled JSON
 * example. Lists are parsed from the docs, so prose edits do not break them.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
	FormFieldSchema,
	FormSchema,
	GlobalConfigSchema,
	LayerSchema,
	ParadocSchema,
	SignatureBlockTypeSchema,
	SignatureSlotTypeSchema,
} from '../src/zod'

const SKILL_DIR = join(import.meta.dirname, '../../../skills/skills/paradoc')

function readSkill(relativePath: string): string {
	return readFileSync(join(SKILL_DIR, relativePath), 'utf8')
}

/** Discriminator values of a field union, found by walking the Zod graph. */
function fieldTypes(schema: z.ZodType): string[] {
	const found = new Set<string>()
	const walk = (node: z.ZodType): void => {
		const def = (node as unknown as { _zod: { def: Record<string, unknown> } })._zod.def
		if (def.type === 'lazy') return walk((def.getter as () => z.ZodType)())
		if (def.type === 'union') return (def.options as z.ZodType[]).forEach(walk)
		if (def.type === 'object') {
			const typeDef = ((def.shape as Record<string, z.ZodType>).type as unknown as {
				_zod: { def: { values: unknown[] } }
			})._zod.def
			for (const value of typeDef.values) found.add(String(value))
			return
		}
		throw new Error(`Unexpected node in field union: ${String(def.type)}`)
	}
	walk(schema)
	return [...found].sort()
}

/** Text of a `## heading` section, up to the next heading of the same or higher level. */
function section(markdown: string, heading: string): string {
	const lines = markdown.split('\n')
	const start = lines.findIndex((line) => line.replace(/^#+\s*/, '') === heading && line.startsWith('#'))
	if (start === -1) throw new Error(`Missing section: ${heading}`)
	const level = lines[start]!.match(/^#+/)![0].length
	const rest = lines.slice(start + 1)
	const end = rest.findIndex((line) => {
		const match = line.match(/^(#+)\s/)
		return match !== null && match[1]!.length <= level
	})
	return (end === -1 ? rest : rest.slice(0, end)).join('\n')
}

/** Cells of each body row of the first Markdown table in `text`. */
function tableRows(text: string): string[][] {
	const lines = text.split('\n')
	const start = lines.findIndex((line) => line.trim().startsWith('|'))
	const end = lines.findIndex((line, index) => index > start && !line.trim().startsWith('|'))
	const rows = (start === -1 ? [] : lines.slice(start, end === -1 ? undefined : end)).map((line) =>
		line.trim().slice(1, -1).split('|').map((cell) => cell.trim()),
	)
	if (rows.length < 3) throw new Error('Expected a Markdown table')
	return rows.slice(2)
}

/** Every backticked token in `text`, with surrounding quotes removed. */
function codeTokens(text: string): string[] {
	return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]!.replace(/^"(.*)"$/, '$1'))
}

/** The type row of a property table: the quoted values it lists. */
function typeRowValues(text: string): string[] {
	const row = tableRows(text).find((cells) => cells[0] === '`type`')
	if (!row) throw new Error('Expected a `type` row')
	return codeTokens(row.slice(1).join(' ')).sort()
}

const FIELD_TYPES = fieldTypes(FormFieldSchema)
const BLOCK_TYPES = [...SignatureBlockTypeSchema.options].sort()
const SLOT_TYPES = [...SignatureSlotTypeSchema.options].sort()

describe('skill docs: field types', () => {
	const fields = readSkill('references/fields.md')
	const skill = readSkill('SKILL.md')

	it('reads a non-trivial type list from the schema', () => {
		expect(FIELD_TYPES).toContain('text')
		expect(FIELD_TYPES).toContain('fieldset')
		expect(FIELD_TYPES).toContain('list')
	})

	it('lists exactly the schema field types in the type reference table', () => {
		const documented = tableRows(section(fields, 'Field Type Reference')).map((cells) => codeTokens(cells[0]!)[0])
		expect([...documented].sort()).toEqual(FIELD_TYPES)
		expect(new Set(documented).size).toBe(documented.length)
	})

	it('states the schema field type count wherever it gives one', () => {
		const counts = [...fields.matchAll(/\b(\d+)\s+(?:Paradoc field types|field types|typed field definitions)/g)].map((match) =>
			Number(match[1]),
		)
		expect(counts.length).toBeGreaterThan(0)
		for (const count of counts) expect(count).toBe(FIELD_TYPES.length)
	})

	it('names only schema field types in the type-specific property headings', () => {
		const headings = section(fields, 'Type-specific properties')
			.split('\n')
			.filter((line) => line.startsWith('#### '))
			.flatMap((line) => line.slice(5).split(/,\s*/).map((name) => name.replace(/\s*\(.*\)$/, '').trim()))
		expect(headings.length).toBeGreaterThan(0)
		for (const name of headings) expect(FIELD_TYPES).toContain(name)
	})

	it('recommends only schema field types in the type selection table', () => {
		// `text`+`pattern` names a property after the `+`, not a type.
		const recommended = tableRows(section(fields, 'Type selection table')).flatMap((cells) =>
			codeTokens(cells[1]!.replace(/\+`[^`]+`/g, '')),
		)
		expect(recommended.length).toBeGreaterThan(0)
		for (const type of recommended) expect(FIELD_TYPES).toContain(type)
	})

	it('maps each invalid type in SKILL.md to a valid one', () => {
		const paragraph = section(skill, 'Common Issues (Cross-Surface)').split('**Validation: "unknown field type"**')[1]!.split('\n\n')[0]!
		const pairs = [...paragraph.matchAll(/`([^`]+)`\s*→\s*`([^`]+)`/g)].map((match) => [match[1]!, match[2]!] as const)
		expect(pairs.length).toBeGreaterThan(0)
		for (const [invalid, valid] of pairs) {
			expect(FIELD_TYPES, `${invalid} is a valid type`).not.toContain(invalid)
			expect(FIELD_TYPES).toContain(valid)
		}
		const affirmed = paragraph.match(/((?:`[^`]+`(?:,\s*|\s+and\s+)?)+)\s+are valid types/)
		expect(affirmed).not.toBeNull()
		for (const type of codeTokens(affirmed![1]!)) expect(FIELD_TYPES).toContain(type)
	})
})

describe('skill docs: unknown field type fixes in schemas.md', () => {
	const schemas = readSkill('references/schemas.md')
	const text = section(schemas, 'Unknown field type')

	it('maps each invalid type to a valid one', () => {
		const typeOf = (cell: string): string => (JSON.parse(`{${cell.replace(/^`|`$/g, '')}}`) as { type: string }).type
		const pairs = tableRows(text).map((cells) => [typeOf(cells[0]!), typeOf(cells[1]!)] as const)
		expect(pairs.length).toBeGreaterThan(0)
		for (const [invalid, valid] of pairs) {
			expect(FIELD_TYPES, `${invalid} is a valid type`).not.toContain(invalid)
			expect(FIELD_TYPES).toContain(valid)
		}
	})

	it('affirms only valid types', () => {
		const affirmed = text.match(/((?:`[^`]+`(?:,\s*|\s+and\s+)?)+)\s+are valid types/)
		expect(affirmed).not.toBeNull()
		for (const type of codeTokens(affirmed![1]!)) expect(FIELD_TYPES).toContain(type)
	})
})

describe('skill docs: signature type names', () => {
	const layers = readSkill('references/layers.md')
	const pdfBindings = readSkill('references/pdf-bindings.md')

	it('lists exactly the signature block types in layers.md', () => {
		expect(typeRowValues(section(layers, 'Signature Blocks'))).toEqual(BLOCK_TYPES)
	})

	it('lists exactly the signature slot types in layers.md', () => {
		expect(typeRowValues(section(layers, 'Signature slots'))).toEqual(SLOT_TYPES)
	})

	it('lists exactly the signature block types in pdf-bindings.md', () => {
		const documented = tableRows(section(pdfBindings, 'Block types')).map((cells) => codeTokens(cells[0]!)[0]!)
		expect([...documented].sort()).toEqual(BLOCK_TYPES)
	})
})

/**
 * A JSON example opts into checking with `schema=<label>` on its fence. The
 * label names where the example sits; a fragment is merged into that minimal
 * container before it is parsed.
 */
const BASE_FORM = { name: 'example', kind: 'form' }
const BASE_PDF_LAYER = { kind: 'file', mimeType: 'application/pdf', path: 'example.pdf' }
const LABELS: Record<string, (value: Record<string, unknown>) => { schema: z.ZodType; input: unknown }> = {
	artifact: (value) => ({ schema: ParadocSchema, input: value }),
	form: (value) => ({ schema: FormSchema, input: { ...BASE_FORM, ...value } }),
	fields: (value) => ({ schema: FormSchema, input: { ...BASE_FORM, fields: value } }),
	parties: (value) => ({ schema: FormSchema, input: { ...BASE_FORM, parties: value } }),
	defs: (value) => ({ schema: FormSchema, input: { ...BASE_FORM, defs: value } }),
	layers: (value) => ({ schema: FormSchema, input: { ...BASE_FORM, layers: value } }),
	layer: (value) => ({ schema: LayerSchema, input: { ...BASE_PDF_LAYER, ...value } }),
	'cli-config': (value) => ({ schema: GlobalConfigSchema, input: value }),
	registries: (value) => ({ schema: GlobalConfigSchema, input: { registries: value } }),
}

interface JsonExample {
	location: string
	label: string | undefined
	body: string
}

function jsonExamples(): JsonExample[] {
	const files = ['SKILL.md', ...readdirSync(join(SKILL_DIR, 'references')).map((name) => `references/${name}`)]
	return files.flatMap((file) => {
		const markdown = readSkill(file)
		return [...markdown.matchAll(/^```json([^\n]*)\n([\s\S]*?)^```/gm)].map((match) => ({
			location: `${file}:${markdown.slice(0, match.index).split('\n').length}`,
			label: match[1]!.match(/\bschema=(\S+)/)?.[1],
			body: match[2]!,
		}))
	})
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

describe('skill docs: JSON examples', () => {
	const examples = jsonExamples()
	const labeled = examples.filter((example) => example.label !== undefined)

	it('finds labeled examples', () => {
		expect(labeled.length).toBeGreaterThan(20)
	})

	it('labels every example that is valid JSON', () => {
		const unlabeled = examples.filter((example) => example.label === undefined && parses(example.body))
		expect(unlabeled.map((example) => example.location)).toEqual([])
	})

	it.each(labeled.map((example) => [example.location, example] as const))('%s parses against its schema', (_location, example) => {
		const build = LABELS[example.label!]
		expect(build, `unknown label ${example.label}`).toBeDefined()
		const { schema, input } = build!(parseExample(example.body) as Record<string, unknown>)
		const result = schema.safeParse(input)
		expect(result.success ? [] : result.error.issues).toEqual([])
	})
})
