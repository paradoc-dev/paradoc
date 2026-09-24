import { describe, expect, test } from 'vitest'
import { LAYER_BINDINGS_RULE } from '@paradoc/schemas'
import { validate } from '@/validation/artifact'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const layers = {
	'an inline markdown': { kind: 'inline', mimeType: 'text/markdown', text: '# Notice' },
	'an inline HTML': { kind: 'inline', mimeType: 'text/html', text: '<p>Notice</p>' },
	'a markdown file': { kind: 'file', mimeType: 'text/markdown', path: 'notice.md' },
	'an HTML file': { kind: 'file', mimeType: 'text/html', path: 'notice.html' },
	'a DOCX file': { kind: 'file', mimeType: DOCX, path: 'notice.docx' },
} as const

const pdf = { kind: 'file', mimeType: 'application/pdf', path: 'notice.pdf' } as const

/** An artifact of each kind that declares layers, holding the given layers. */
const artifacts = {
	form: (layerMap: Record<string, unknown>) => ({
		kind: 'form',
		name: 'notice',
		fields: { name: { type: 'text', label: 'Name' } },
		layers: layerMap,
	}),
	document: (layerMap: Record<string, unknown>) => ({ kind: 'document', name: 'notice', layers: layerMap }),
	checklist: (layerMap: Record<string, unknown>) => ({
		kind: 'checklist',
		name: 'notice',
		items: [{ id: 'signed', title: 'Signed' }],
		layers: layerMap,
	}),
} as const

const cases = Object.entries(artifacts).flatMap(([kind, build]) =>
	Object.entries(layers).map(([label, layer]) => ({ kind, label, build, layer })),
)

function messages(result: ReturnType<typeof validate>): string[] {
	return (result.issues ?? []).map((issue) => {
		const path = (issue.path ?? []).map((segment) => (typeof segment === 'object' ? segment.key : segment)).join('.')
		return `${path}: ${issue.message}`
	})
}

describe('validate() allows bindings only on PDF layers', () => {
	test.each(cases)('a $kind rejects bindings on $label layer', ({ build, layer }) => {
		const result = validate(build({ copy: { ...layer, bindings: { name: 'fields.name' } } }))
		expect(result.issues).toBeDefined()
		expect(messages(result).join('\n')).toContain('layers.copy')
		expect(messages(result).join('\n')).toContain('bindings')
	})

	test.each(cases)('a $kind rejects bindingsFrom on $label layer', ({ build, layer }) => {
		const result = validate(build({ pdf, copy: { ...layer, bindingsFrom: 'pdf' } }))
		expect(result.issues).toBeDefined()
		expect(messages(result).join('\n')).toContain('bindingsFrom')
	})

	test.each(cases)('a $kind accepts $label layer without bindings', ({ build, layer }) => {
		expect(validate(build({ copy: layer })).issues).toBeUndefined()
	})

	test('a file layer that is not a PDF is told the rule', () => {
		const result = validate(artifacts.document({ copy: { ...layers['a DOCX file'], bindings: { name: 'fields.name' } } }))
		expect(messages(result)).toContain(`layers.copy.bindings: ${LAYER_BINDINGS_RULE}`)
	})

	test.each([
		['form', 'fields.name'],
		['checklist', 'items.signed'],
	] as const)('a %s accepts bindings and bindingsFrom on PDF layers', (kind, path) => {
		const result = validate(
			artifacts[kind]({
				copyA: { ...pdf, bindings: { 'topmostSubform[0].Page1[0].f1_01[0]': path } },
				copyB: { ...pdf, path: 'notice-b.pdf', bindingsFrom: 'copyA' },
			}),
		)
		expect(result.issues).toBeUndefined()
	})
})
