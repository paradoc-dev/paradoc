import { describe, expect, test } from 'vitest'
import { bundle, document, form } from '@/artifacts'
import {
	assertBundleInclusionResolved,
	evaluateBundleInclusion,
} from '@/artifacts/bundle/inclusion'

function sourceForm() {
	return form()
		.name('source')
		.version('1.0.0')
		.title('Source')
		.fields({ enabled: { type: 'boolean', label: 'Enabled' } })
		.build()
}

function conditionalBundle(enabled: boolean) {
	const source = sourceForm()
	const artifact = document().name('optional').version('1.0.0').title('Optional').build()
	const condition = 'forms.source.fields.enabled == true'
	const definition = bundle()
		.name('uniform')
		.version('1.0.0')
		.title('Uniform')
		.inline('inline', artifact, condition)
		.path('path', './optional.yaml', condition)
		.registry('registry', '@example/optional', condition)
		.inline('source', source)
		.build()

	return {
		definition,
		contents: {
			source: source.fill({ fields: { enabled } }),
		},
	}
}

describe('bundle inclusion', () => {
	test('uses one evaluator for inline, path, and registry members', () => {
		const enabled = conditionalBundle(true)
		const state = evaluateBundleInclusion(enabled.definition, enabled.contents)

		expect(state.resolved).toBe(true)
		expect(state.decisions.map((decision) => [decision.key, decision.status])).toEqual([
			['inline', 'included'],
			['path', 'included'],
			['registry', 'included'],
			['source', 'included'],
		])

		const disabled = conditionalBundle(false)
		expect(evaluateBundleInclusion(disabled.definition, disabled.contents).excludedKeys).toEqual([
			'inline',
			'path',
			'registry',
		])
	})

	test('resolves named bundle definitions from the same instance context', () => {
		const source = sourceForm()
		const artifact = document().name('optional').version('1.0.0').title('Optional').build()
		const definition = bundle()
			.name('named')
			.version('1.0.0')
			.title('Named')
			.def('showOptional', 'forms.source.fields.enabled == true')
			.inline('optional', artifact, 'showOptional')
			.inline('source', source)
			.build()
		const state = evaluateBundleInclusion(definition, {
			source: source.fill({ fields: { enabled: true } }),
		})

		expect(state.decisions[0]?.value).toBe(true)
		expect(state.errors).toEqual([])
	})

	test('keeps conditions unresolved until the referenced runtime data exists', () => {
		const { definition } = conditionalBundle(true)
		const state = evaluateBundleInclusion(definition)

		expect(state.resolved).toBe(false)
		expect(state.unresolvedKeys).toEqual(['inline', 'path', 'registry'])
		expect(() => assertBundleInclusionResolved(state)).toThrow(/unresolved/)
	})

	test('reports invalid conditions as errors instead of silently including a member', () => {
		const invalid = bundle()
			.name('invalid')
			.version('1.0.0')
			.title('Invalid')
			.inline(
				'doc',
				document().name('doc').version('1.0.0').title('Doc').build(),
				'forms..broken',
			)
			.build()

		const state = evaluateBundleInclusion(invalid)
		expect(state.resolved).toBe(false)
		expect(state.errors.join(' ')).toContain('Invalid include expression')
	})

	test('treats an unknown reference root as an invalid expression', () => {
		const invalid = bundle()
			.name('invalid-reference')
			.version('1.0.0')
			.title('Invalid reference')
			.inline(
				'doc',
				document().name('doc').version('1.0.0').title('Doc').build(),
				'ambient.flag == true',
			)
			.build()

		const state = evaluateBundleInclusion(invalid)
		expect(state.resolved).toBe(false)
		expect(state.errors.join(' ')).toContain('Unknown variable')
	})

	test('does not use a process clock when a temporal condition has no fixed context', () => {
		const temporal = bundle()
			.name('temporal')
			.version('1.0.0')
			.title('Temporal')
			.inline(
				'doc',
				document().name('doc').version('1.0.0').title('Doc').build(),
				'today() == today()',
			)
			.build()

		const state = evaluateBundleInclusion(temporal)
		expect(state.resolved).toBe(false)
		expect(state.unresolvedKeys).toEqual(['doc'])
	})

	test('uses the supplied member clock for temporal conditions', () => {
		const source = sourceForm()
		const definition = bundle()
			.name('clocked')
			.version('1.0.0')
			.title('Clocked')
			.inline(
				'doc',
				document().name('doc').version('1.0.0').title('Doc').build(),
				'today() == "2026-09-12"',
			)
			.inline('source', source)
			.build()
		const state = evaluateBundleInclusion(definition, {
			source: source.partialFill(undefined, { context: { asOf: '2026-09-12T12:00:00Z' } }),
		})

		expect(state.decisions[0]?.status).toBe('included')
	})

	test('filters draft rendering and assembly while retaining excluded answers', async () => {
		const artifact = form()
			.name('conditional-form')
			.version('1.0.0')
			.title('Conditional form')
			.fields({ answer: { type: 'text', label: 'Answer' } })
			.inlineLayer('default', { mimeType: 'text/plain', text: '{{answer}}' })
			.defaultLayer('default')
			.build()
		const filled = artifact.fill({ fields: { answer: 'retained' } })
		const definition = bundle()
			.name('filtered')
			.version('1.0.0')
			.title('Filtered')
			.inline('kept', artifact)
			.inline('excluded', artifact, false)
			.build()

		const draft = definition.prepare({ kept: filled, excluded: filled })
		expect(draft.getContent('excluded')).toBe(filled)
		expect(draft.getInclusion('excluded').status).toBe('excluded')
		expect(Object.keys((await draft.render()).outputs)).toEqual(['kept'])
		expect(
		Object.keys(
			(
				await definition.assemble({ contents: { kept: filled, excluded: filled } })
			).outputs,
		),
	).toEqual(['kept'])
	})

	test('retains excluded draft content so reinclusion restores its answer', () => {
		const source = sourceForm()
		const optional = form()
			.name('optional')
			.version('1.0.0')
			.title('Optional')
			.fields({ answer: { type: 'text', label: 'Answer' } })
			.build()
		const definition = bundle()
			.name('reinclude')
			.version('1.0.0')
			.title('Reinclude')
			.inline('optional', optional, 'forms.source.fields.enabled == true')
			.inline('source', source)
			.build()
		const optionalAnswer = optional.fill({ fields: { answer: 'retained' } })
		const disabledSource = source.fill({ fields: { enabled: false } })
		const enabledSource = source.fill({ fields: { enabled: true } })
		const draft = definition.prepare({ optional: optionalAnswer, source: disabledSource })

		expect(draft.getInclusion('optional').status).toBe('excluded')
		const reenabled = draft.setContent('source', enabledSource)
		expect(reenabled.getInclusion('optional').status).toBe('included')
		expect(reenabled.getContent('optional')).toBe(optionalAnswer)
	})

	test('applies the same contract to nested bundle membership', () => {
		const source = sourceForm()
		const child = document().name('child').version('1.0.0').title('Child').build()
		const inner = bundle()
			.name('inner')
			.version('1.0.0')
			.title('Inner')
			.inline('child', child, 'forms.source.fields.enabled == true')
			.inline('source', source)
			.build()
		const outer = bundle()
			.name('outer')
			.version('1.0.0')
			.title('Outer')
			.inline('inner', inner)
			.build()
		const innerRuntime = inner.prepare({
			child: child.prepare(),
			source: source.fill({ fields: { enabled: false } }),
		})
		const state = evaluateBundleInclusion(outer, { inner: innerRuntime })

		expect(state.resolved).toBe(true)
		expect(state.decisions[0]?.nested?.excludedKeys).toEqual(['child'])
	})

	test('rechecks inclusion when a signable bundle is finalized', () => {
		const source = sourceForm()
		const optional = document().name('optional').version('1.0.0').title('Optional').build()
		const definition = bundle()
			.name('finalize-check')
			.version('1.0.0')
			.title('Finalize check')
			.inline('optional', optional, 'forms.source.fields.enabled == true')
			.inline('source', source)
			.build()
		const draft = definition.prepare({
			optional: optional.prepare(),
			source: source.fill({ fields: { enabled: true } }),
		})
		const signable = draft.prepareForSigning()
		const invalidated = signable.updateContent('source', source.partialFill())

		expect(() => invalidated.finalize()).toThrow(/unresolved/)
	})
})
