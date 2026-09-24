import { describe, expect, test } from 'vitest'
import {
	bundle,
	checklist,
	document,
	form,
	runtimeBundleFromJSON,
	runtimeChecklistFromJSON,
	runtimeContentFromJSON,
	runtimeDocumentFromJSON,
} from '@/artifacts'
import { evaluateBundleInclusion } from '@/artifacts/bundle/inclusion'

/**
 * A bundle keeps every member's phase, its one clock, and its inclusion
 * decisions across transitions and reloads.
 */

const decode = (content: unknown): string => new TextDecoder().decode(content as Uint8Array)
const markdown = (text: string) => ({ md: { kind: 'inline' as const, mimeType: 'text/markdown', text } })

const memberForm = () =>
	form({
		name: 'f',
		version: '1.0.0',
		title: 'F',
		fields: { v: { type: 'text', label: 'V' } },
		layers: markdown('Form: {{fields.v}}'),
		defaultLayer: 'md',
	})
const memberChecklist = () =>
	checklist({
		name: 'cl',
		version: '1.0.0',
		title: 'CL',
		items: [{ id: 'done', title: 'Done' }],
		layers: markdown('Done: {{items.done}}'),
		defaultLayer: 'md',
	})
const memberDocument = () =>
	document({ kind: 'document', name: 'doc', version: '1.0.0', title: 'Doc', layers: markdown('Terms'), defaultLayer: 'md' })

/** A bundle with every member kind: form, checklist, document, and a nested bundle. */
function everyKind() {
	const f = memberForm()
	const cl = memberChecklist()
	const doc = memberDocument()
	const inner = bundle().name('inner').version('1.0.0').title('Inner').inline('doc', doc).build()
	const outer = bundle()
		.name('outer')
		.version('1.0.0')
		.title('Outer')
		.inline('f', f)
		.inline('cl', cl)
		.inline('doc', doc)
		.inline('inner', inner)
		.build()
	const draft = outer.prepare(
		{
			f: f.fill({ fields: { v: 'x' } }),
			cl: cl.fill({ done: true }),
			doc: doc.prepare(),
			inner: inner.prepare({ doc: doc.prepare() }),
		},
		{ context: { asOf: '2026-09-24T12:00:00Z' } },
	)
	return { draft }
}

const reload = <T extends { toJSON(): unknown }>(runtime: T) =>
	runtimeBundleFromJSON(JSON.parse(JSON.stringify(runtime.toJSON())))

describe('bundle JSON round trip', () => {
	test.each(['signable', 'executed'] as const)('keeps every member phase and timestamp of a %s bundle', (phase) => {
		const signable = everyKind().draft.prepareForSigning()
		const runtime = phase === 'signable' ? signable : signable.finalize()
		const reloaded = reload(runtime)

		expect(reloaded.phase).toBe(phase)
		expect(reloaded.toJSON()).toEqual(runtime.toJSON())
		for (const key of ['f', 'cl', 'doc', 'inner']) {
			expect(reloaded.getContent(key)?.phase).toBe(runtime.getContent(key)?.phase)
		}
		expect(reloaded.getContent('cl')?.phase).toBe('completed')
		expect(reloaded.getContent('doc')?.phase).toBe('final')
	})

	test('a reloaded bundle renders its checklist and document parts', async () => {
		const reloaded = reload(everyKind().draft.prepareForSigning())
		const { outputs } = await reloaded.render()

		expect(decode(outputs.cl!.content)).toContain('Done: Yes')
		expect(decode(outputs.doc!.content)).toContain('Terms')
		expect(decode(outputs['inner/doc']!.content)).toContain('Terms')
		expect(decode(outputs.f!.content)).toContain('Form: x')
	})

	test('keeps phases through the hand-written deserializer when it passes the timestamps (core-002)', () => {
		const signable = everyKind().draft.prepareForSigning()
		const json = JSON.parse(JSON.stringify(signable.toJSON()))
		const reloaded = runtimeBundleFromJSON(json, (m) => {
			if (m.kind === 'checklist') {
				return runtimeChecklistFromJSON({
					phase: m.phase,
					checklist: m.artifact,
					targetLayer: m.targetLayer,
					context: m.context,
					items: m.data,
					completedAt: m.completedAt,
				} as never)
			}
			if (m.kind === 'document') {
				return runtimeDocumentFromJSON({
					phase: m.phase,
					document: m.artifact,
					targetLayer: m.targetLayer,
					finalizedAt: m.finalizedAt,
				} as never)
			}
			return runtimeContentFromJSON(m)
		})

		expect(reloaded.getContent('cl')?.phase).toBe('completed')
		expect(reloaded.getContent('doc')?.phase).toBe('final')
	})

	test('a completed checklist or final document without its timestamp does not load as a draft', () => {
		const signable = everyKind().draft.prepareForSigning()
		const json = JSON.parse(JSON.stringify(signable.toJSON()))
		delete json.contents.cl.completedAt
		expect(() => runtimeBundleFromJSON(json)).toThrow('a completed checklist needs completedAt')

		const again = JSON.parse(JSON.stringify(signable.toJSON()))
		delete again.contents.doc.finalizedAt
		expect(() => runtimeBundleFromJSON(again)).toThrow('a final document needs finalizedAt')
	})
})

describe('bundle load checks (core-006)', () => {
	const signableJSON = () => JSON.parse(JSON.stringify(everyKind().draft.prepareForSigning().toJSON()))

	test('rejects a draft included member in a signable bundle', () => {
		const json = signableJSON()
		const draftForm = everyKind().draft.getContent('f')!
		expect(() => runtimeBundleFromJSON(json, (m) => (m.kind === 'form' ? draftForm : runtimeContentFromJSON(m)))).toThrow(
			'Invalid signable bundle "outer": content "f" is a form in draft phase, but an included member of a signable bundle requires signable phase',
		)
	})

	test('rejects an undeclared key', () => {
		const json = signableJSON()
		json.contents.bogus = json.contents.f
		expect(() => runtimeBundleFromJSON(json)).toThrow('content "bogus" is not declared')
	})

	test('rejects a member of the wrong kind', () => {
		const json = signableJSON()
		json.contents.f = json.contents.doc
		expect(() => runtimeBundleFromJSON(json)).toThrow('content "f" must be a form instance, got a document')
	})

	test('rejects an unknown member phase and kind', () => {
		const json = signableJSON()
		json.contents.cl.phase = 'archived'
		expect(() => runtimeBundleFromJSON(json)).toThrow('Invalid checklist JSON: unknown phase "archived"')

		const other = signableJSON()
		other.contents.f.kind = 'slide'
		expect(() => runtimeBundleFromJSON(other)).toThrow('Cannot load bundle content of kind "slide"')
	})

	test('rejects a bundle JSON without its clock', () => {
		const json = signableJSON()
		delete json.context
		expect(() => runtimeBundleFromJSON(json)).toThrow('context.asOf is required')
	})

	test('loads a valid signable bundle', () => {
		expect(runtimeBundleFromJSON(signableJSON()).phase).toBe('signable')
	})
})

describe('bundle clock (core-003)', () => {
	const dated = () => form().name('f').version('1.0.0').title('F').fields({ d: { type: 'date', label: 'D' } }).build()
	const plain = () => form().name('g').version('1.0.0').title('G').fields({ x: { type: 'text', label: 'X' } }).build()
	const definition = () =>
		bundle().name('b').version('1.0.0').title('B').inline('f', dated()).inline('g', plain(), 'forms.f.fields.d < today()').build()

	test('members filled at different instants resolve today() under the bundle clock', () => {
		const f = dated().fill({ fields: { d: '2026-01-01' } }, { context: { asOf: '2026-01-01T00:00:00Z' } })
		const g = plain().fill({ fields: { x: 'y' } }, { context: { asOf: '2027-06-30T00:00:00Z' } })
		const draft = definition().prepare({ f, g }, { context: { asOf: '2026-03-01T00:00:00Z' } })

		expect(draft.context.asOf.datetime).toBe('2026-03-01T00:00:00.000Z')
		expect(draft.getInclusion('g').status).toBe('included')
		expect(draft.prepareForSigning().getInclusion('g').status).toBe('included')
	})

	test('the bundle clock, not a member clock, decides inclusion', () => {
		const f = dated().fill({ fields: { d: '2026-06-01' } }, { context: { asOf: '2027-01-01T00:00:00Z' } })
		const g = plain().fill({ fields: { x: 'y' } }, { context: { asOf: '2027-01-01T00:00:00Z' } })
		const draft = definition().prepare({ f, g }, { context: { asOf: '2026-03-01T00:00:00Z' } })

		expect(draft.getInclusion('g').status).toBe('excluded')
	})

	test('the clock survives transitions and reloads', () => {
		const f = dated().fill({ fields: { d: '2026-01-01' } })
		const g = plain().fill({ fields: { x: 'y' } })
		const signable = definition().prepare({ f, g }, { context: { asOf: '2026-03-01T00:00:00Z' } }).prepareForSigning()
		const reloaded = reload(signable)
		if (reloaded.phase !== 'signable') throw new Error('expected a signable bundle')
		const executed = reloaded.finalize()

		expect(executed.context).toEqual(signable.context)
		expect(reload(executed).context.asOf.datetime).toBe('2026-03-01T00:00:00.000Z')
		expect(reload(executed).getInclusion('g').status).toBe('included')
	})

	test('members filled moments apart resolve without an explicit clock (core-003 repro)', async () => {
		const fi = dated().fill({ fields: { d: '2020-01-01' } })
		await new Promise((resolve) => setTimeout(resolve, 5))
		const gi = plain().fill({ fields: { x: 'y' } })
		const draft = definition().prepare({ f: fi, g: gi })

		expect(draft.getInclusionState().unresolvedKeys).toEqual([])
		expect(draft.getInclusion('g').status).toBe('included')
		expect(draft.prepareForSigning().phase).toBe('signable')
	})

	test('prepare captures the current instant when no clock is supplied', () => {
		const before = Date.now()
		const draft = definition().prepare({})
		expect(Date.parse(draft.context.asOf.datetime)).toBeGreaterThanOrEqual(before)
	})

	test('without a bundle clock a today() condition stays unresolved', () => {
		const f = dated().fill({ fields: { d: '2026-01-01' } }, { context: { asOf: '2026-03-01T00:00:00Z' } })
		const state = evaluateBundleInclusion(definition(), { f, g: plain().fill() })
		expect(state.decisions[1]?.status).toBe('unresolved')
		expect(state.decisions[1]?.reason).toContain('the bundle has no clock')
	})
})

describe('signing boundaries', () => {
	const required = () =>
		form().name('f').version('1.0.0').title('F').fields({ a: { type: 'text', label: 'A', required: true } }).build()

	test('an excluded incomplete member does not block signing and stays a draft (core-004)', () => {
		const f = required()
		const g = memberForm()
		const b = bundle().name('b').version('1.0.0').title('B').inline('f', f, false).inline('g', g).build()
		const signable = b.prepare({ f: f.fill(), g: g.fill({ fields: { v: 'x' } }) }).prepareForSigning()
		const executed = signable.finalize()

		expect(signable.getContent('f')?.phase).toBe('draft')
		expect(executed.getContent('f')?.phase).toBe('draft')
		expect(executed.getContent('g')?.phase).toBe('executed')
		expect(reload(executed).getContent('f')?.phase).toBe('draft')
	})

	test('an included incomplete member still blocks signing', () => {
		const f = required()
		const b = bundle().name('b').version('1.0.0').title('B').inline('f', f).build()
		expect(() => b.prepare({ f: f.fill() }).prepareForSigning()).toThrow('Missing required field: fields.a')
	})

	test('a missing included member blocks signing (core-005)', () => {
		const f = memberForm()
		const b = bundle().name('b').version('1.0.0').title('B').inline('lease', f).inline('extra', f, false).build()
		expect(() => b.prepare({}).prepareForSigning()).toThrow('Content "lease" is included but has no content.')
		expect(b.prepare({ lease: f.fill() }).prepareForSigning().phase).toBe('signable')
	})

	test('a signable bundle JSON missing an included member does not load', () => {
		const f = memberForm()
		const b = bundle().name('b').version('1.0.0').title('B').inline('lease', f).build()
		const json = JSON.parse(JSON.stringify(b.prepare({ lease: f.fill() }).prepareForSigning().toJSON()))
		delete json.contents.lease
		expect(() => runtimeBundleFromJSON(json)).toThrow('Content "lease" is included but has no content.')
	})
})

describe('bundle include roots (core-007)', () => {
	test('checklist and document roots are unknown variables', () => {
		const cl = memberChecklist()
		const doc = memberDocument()
		const b = bundle().name('b').version('1.0.0').title('B').inline('cl', cl).inline('doc', doc, 'checklists.cl.items.done == true').build()
		expect(() => b.prepare({ cl: cl.fill(), doc: doc.prepare() })).toThrow(/Unknown variable/)

		const state = evaluateBundleInclusion(b, { cl: cl.fill({ done: true }), doc: doc.prepare() }, { asOf: { date: '2026-01-01', datetime: '2026-01-01T00:00:00.000Z' } })
		expect(state.errors[0]).toContain('Unknown variable(s) in include expression "checklists.cl.items.done == true": checklists')
	})
})

describe('bundle object definitions (core-041)', () => {
	test('a nested member orders its def after the defs it reads and resolves', () => {
		const optional = memberDocument()
		const definition = bundle()
			.name('named')
			.version('1.0.0')
			.title('Named')
			.def('area', {
				type: 'bbox',
				value: { southWest: { lat: 'minLat', lon: '0' }, northEast: { lat: '5', lon: '5' } },
			} as never)
			.def('minLat', { type: 'number', value: '1' })
			.inline('optional', optional, 'area.southWest.lat == 1')
			.inline('other', optional, 'area.southWest.lat == 2')
			.build()
		const state = evaluateBundleInclusion(definition, {})

		expect(state.errors).toEqual([])
		expect(state.decisions.map((decision) => decision.status)).toEqual(['included', 'excluded'])
	})
})
