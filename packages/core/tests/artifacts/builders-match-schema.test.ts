/**
 * Builders match the schema.
 *
 * Every key a builder can set is a key the schema accepts, and every key the
 * schema accepts is one the builder can set. The per-method tests prove each
 * setter builds valid output; the drift check keeps the two sides aligned.
 */

import { describe, expect, test } from 'vitest'
import {
	BundleSchema,
	ChecklistSchema,
	DocumentSchema,
	FormAnnexSchema,
	FormFieldSchema,
	FormPartySchema,
	FormSchema,
	LayerSchema,
} from '@paradoc/schemas'
import { annex, bundle, checklist, document, field, form, layer, party } from '@/artifacts'
import type { Form, RulesSection, SignatureSlot } from '@paradoc/types'
import type { FormRulesValidationResult } from '@/logic'

// ============================================================================
// Drift check
// ============================================================================

/** How one builder's methods map onto the keys of the schema object it builds. */
interface BuilderContract {
	/** Methods that set a key named differently from the method, or several methods for one key. */
	methodKeys?: Record<string, string>
	/** Methods that set no key: they load or finish the definition. */
	nonSetters?: readonly string[]
	/** Schema keys the builder writes itself, such as a discriminator. */
	managedKeys?: readonly string[]
	/** Schema keys no builder offers, each with the reason. */
	unbuildableKeys?: Readonly<Record<string, string>>
}

interface BuilderDrift {
	/** Keys a builder method sets that the schema lacks. */
	builderOnly: string[]
	/** Keys the schema has that no builder method sets. */
	schemaOnly: string[]
}

const NON_SETTERS = ['from', 'build'] as const

/** Compare the keys a builder can set with the keys its schema accepts. */
function findBuilderDrift(
	builderMethods: readonly string[],
	schemaKeys: readonly string[],
	contract: BuilderContract = {},
): BuilderDrift {
	const nonSetters = new Set([...NON_SETTERS, ...(contract.nonSetters ?? [])])
	const settable = new Set(
		builderMethods
			.filter((method) => !nonSetters.has(method))
			.map((method) => contract.methodKeys?.[method] ?? method),
	)
	for (const key of contract.managedKeys ?? []) settable.add(key)
	for (const key of Object.keys(contract.unbuildableKeys ?? {})) settable.add(key)

	const schema = new Set(schemaKeys)
	return {
		builderOnly: [...settable].filter((key) => !schema.has(key)).sort(),
		schemaOnly: [...schema].filter((key) => !settable.has(key)).sort(),
	}
}

/** The keys a Zod object schema accepts. */
function objectKeys(schema: unknown): string[] {
	const shape = (schema as { shape?: Record<string, unknown> }).shape
	if (!shape) throw new Error('Expected a Zod object schema')
	return Object.keys(shape)
}

/** The object schemas of a discriminated union, keyed by discriminator value. */
function unionMembers(schema: unknown, discriminator: string): Map<string, string[]> {
	const lazy = schema as { unwrap?: () => unknown }
	const union = (lazy.unwrap ? lazy.unwrap() : schema) as { options?: unknown[] }
	if (!union.options) throw new Error('Expected a Zod discriminated union')
	return new Map(
		union.options.map((member) => {
			const value = (member as { shape: Record<string, { value: string }> }).shape[discriminator]?.value
			if (value === undefined) throw new Error(`Union member has no "${discriminator}" literal`)
			return [value, objectKeys(member)]
		}),
	)
}

const methodsOf = (builder: object): string[] => Object.keys(builder)

const ARTIFACT_CONTRACT = {
	managedKeys: ['kind'],
	unbuildableKeys: {
		$schema: 'toJSON() writes the current schema version; an author never sets it',
	},
	methodKeys: { layer: 'layers', inlineLayer: 'layers', fileLayer: 'layers' },
} satisfies BuilderContract

describe('builder drift check', () => {
	describe('detects a one-sided key', () => {
		test('passes when the builder and the schema offer the same keys', () => {
			expect(findBuilderDrift(['label', 'from', 'build'], ['label'])).toEqual({ builderOnly: [], schemaOnly: [] })
		})

		test('fails when a builder offers a key the schema lacks', () => {
			expect(findBuilderDrift(['label', 'pattern', 'build'], ['label'])).toEqual({
				builderOnly: ['pattern'],
				schemaOnly: [],
			})
		})

		test('fails when the schema has a key the builder cannot set', () => {
			expect(findBuilderDrift(['label', 'build'], ['label', 'step'])).toEqual({
				builderOnly: [],
				schemaOnly: ['step'],
			})
		})

		test('maps renamed and grouped methods onto their schema key', () => {
			expect(
				findBuilderDrift(['options', 'field', 'fields'], ['enum', 'fields'], {
					methodKeys: { options: 'enum', field: 'fields' },
				}),
			).toEqual({ builderOnly: [], schemaOnly: [] })
		})
	})

	describe('field builders', () => {
		const schemaByType = unionMembers(FormFieldSchema, 'type')
		const builderTypes = Object.keys(field).filter((key) => key !== 'parse' && key !== 'safeParse')

		test('every schema field type has a builder, and every builder a schema type', () => {
			expect([...builderTypes].sort()).toEqual([...schemaByType.keys()].sort())
		})

		test.each([...schemaByType.keys()])('%s builder sets exactly the schema keys', (type) => {
			const create = (field as unknown as Record<string, () => object>)[type]
			if (!create) throw new Error(`No builder for field type ${type}`)
			const drift = findBuilderDrift(methodsOf(create()), schemaByType.get(type) ?? [], {
				managedKeys: ['type'],
				methodKeys: { options: 'enum', field: 'fields' },
			})
			expect(drift).toEqual({ builderOnly: [], schemaOnly: [] })
		})
	})

	test('party builder sets exactly the schema keys', () => {
		expect(findBuilderDrift(methodsOf(party()), objectKeys(FormPartySchema))).toEqual({
			builderOnly: [],
			schemaOnly: [],
		})
	})

	test('annex builder sets exactly the schema keys', () => {
		expect(findBuilderDrift(methodsOf(annex()), objectKeys(FormAnnexSchema))).toEqual({
			builderOnly: [],
			schemaOnly: [],
		})
	})

	test.each([
		['file', () => layer.file()],
		['inline', () => layer.inline()],
	] as const)('%s layer builder sets exactly the schema keys', (kind, create) => {
		const drift = findBuilderDrift(methodsOf(create()), unionMembers(LayerSchema, 'kind').get(kind) ?? [], {
			managedKeys: ['kind'],
		})
		expect(drift).toEqual({ builderOnly: [], schemaOnly: [] })
	})

	test.each([
		['form', () => form(), FormSchema, {
			methodKeys: { ...ARTIFACT_CONTRACT.methodKeys, def: 'defs', field: 'fields', annex: 'annexes', party: 'parties' },
		}],
		['document', () => document(), DocumentSchema, {}],
		['checklist', () => checklist(), ChecklistSchema, {
			methodKeys: { ...ARTIFACT_CONTRACT.methodKeys, item: 'items', itemWithBooleanStatus: 'items', itemWithEnumStatus: 'items' },
		}],
		['bundle', () => bundle(), BundleSchema, {
			methodKeys: { def: 'defs', registry: 'contents', path: 'contents', inline: 'contents', removeContent: 'contents', clearContents: 'contents' },
		}],
	] as const)('%s builder sets exactly the schema keys', (_kind, create, schema, contract: BuilderContract) => {
		const drift = findBuilderDrift(methodsOf(create()), objectKeys(schema), {
			...ARTIFACT_CONTRACT,
			...contract,
			methodKeys: { ...ARTIFACT_CONTRACT.methodKeys, ...contract.methodKeys },
		})
		expect(drift).toEqual({ builderOnly: [], schemaOnly: [] })
	})
})

// ============================================================================
// Per-method builders
// ============================================================================

describe('field builder methods', () => {
	test('number step() builds a field with step', () => {
		expect(field.number().min(0).step(0.01).build()).toEqual({ type: 'number', min: 0, step: 0.01 })
	})

	test('number step() rejects a step that is not positive', () => {
		expect(() => field.number().step(0).build()).toThrow(/step/)
	})

	test('money currency() builds a field with currency', () => {
		expect(field.money().currency('USD').build()).toEqual({ type: 'money', currency: 'USD' })
	})

	test('money currency() rejects a code that is not ISO 4217 alpha-3', () => {
		expect(() => field.money().currency('usd').build()).toThrow(/currency/)
	})

	test('email has no pattern()', () => {
		const email = field.email()
		expect('pattern' in email).toBe(false)
		// @ts-expect-error email fields have no pattern in the schema
		expect(() => email.pattern('x')).toThrow(TypeError)
	})
})

describe('party builder payment()', () => {
	test('builds a party with a payment requirement', () => {
		const payment = { required: true, amount: { amount: 25, currency: 'USD' } }
		expect(party().label('Applicant').payment(payment).build().payment).toEqual(payment)
	})

	test('rejects a payment with no amount', () => {
		expect(() =>
			party()
				.label('Applicant')
				.payment({ required: true } as never)
				.build(),
		).toThrow(/amount/)
	})
})

describe('layer builder signatures()', () => {
	const slots: Record<string, SignatureSlot> = {
		applicant: {
			party: { role: 'applicant' },
			type: 'signature',
			placement: { page: 1, x: 10, y: 10, width: 100, height: 20 },
		},
	}

	const formWithLayer = (layerDef: ReturnType<typeof layer.file> | ReturnType<typeof layer.inline>) =>
		form()
			.name('signed')
			.party('applicant', party().label('Applicant'))
			.layer('main', layerDef)
			.build()

	test('file layer builds with signature slots', () => {
		const built = layer.file().path('form.pdf').mimeType('application/pdf').signatures(slots).build()
		expect(built.signatures).toEqual(slots)
		expect(formWithLayer(layer.file().path('form.pdf').mimeType('application/pdf').signatures(slots)).layers?.main?.signatures).toEqual(slots)
	})

	test('inline layer builds with signature slots', () => {
		const built = layer.inline().text('Sign here').mimeType('text/plain').signatures(slots).build()
		expect(built.signatures).toEqual(slots)
		expect(formWithLayer(layer.inline().text('Sign here').mimeType('text/plain').signatures(slots)).layers?.main?.signatures).toEqual(slots)
	})

	test('a form rejects an invalid signature slot set through signatures()', () => {
		const invalid = { applicant: { ...slots.applicant, type: 'stamp' } } as unknown as Record<string, SignatureSlot>
		expect(() => formWithLayer(layer.inline().text('Sign here').mimeType('text/plain').signatures(invalid))).toThrow(
			/signatures\.applicant\.type/,
		)
	})
})

// ============================================================================
// Rules parity
// ============================================================================

describe('form builder rules()', () => {
	const rules: RulesSection = {
		ageLimit: { expr: 'age >= 18', message: 'Applicant must be an adult' },
		incomeHint: { expr: 'income > 0', message: 'Income is usually positive', severity: 'warning' },
	}

	const definition: Form = {
		kind: 'form',
		name: 'rules-parity',
		fields: {
			age: { type: 'number', label: 'Age' },
			income: { type: 'number', label: 'Income' },
		},
		rules,
	}

	const objectForm = () => form(definition)
	const builderForm = () =>
		form()
			.name('rules-parity')
			.field('age', field.number().label('Age'))
			.field('income', field.number().label('Income'))
			.rules(rules)
			.build()
	// from() does not carry the definition's field types, so its instance is widened here.
	const fromForm = () => form().from(definition).build() as unknown as ReturnType<typeof objectForm>

	const rulesResult = (
		instance: { fill(payload: { fields: Record<string, number> }): { validate(): { rules: FormRulesValidationResult } } },
		fields: Record<string, number>,
	) => instance.fill({ fields }).validate().rules

	test('builder.rules() and builder.from() keep the rules the object pattern keeps', () => {
		const expected = objectForm().toJSON().rules
		expect(Object.keys(expected ?? {})).toEqual(['ageLimit', 'incomeHint'])
		expect(builderForm().toJSON().rules).toEqual(expected)
		expect(fromForm().toJSON().rules).toEqual(expected)
	})

	test.each([
		['failing', { age: 16, income: 0 }],
		['passing', { age: 30, income: 1000 }],
	] as const)('validate().rules matches the object pattern when %s', (_label, fields) => {
		const expected = rulesResult(objectForm(), fields)
		expect(rulesResult(builderForm(), fields)).toEqual(expected)
		expect(rulesResult(fromForm(), fields)).toEqual(expected)
	})

	test('a failing rule is reported through the builder', () => {
		const result = rulesResult(builderForm(), { age: 16, income: 0 })
		expect(result.valid).toBe(false)
		expect(result.errors.map((error) => error.ruleId)).toEqual(['ageLimit'])
		expect(result.warnings.map((warning) => warning.ruleId)).toEqual(['incomeHint'])
	})

	test('rules() rejects a rule with no message', () => {
		expect(() =>
			form()
				.name('bad-rules')
				.rules({ broken: { expr: 'true' } } as never)
				.build(),
		).toThrow(/message/)
	})
})

// ============================================================================
// from() round trip
// ============================================================================

describe('form builder from()', () => {
	const everyKey: Form = {
		kind: 'form',
		name: 'every-key',
		version: '1.0.0',
		title: 'Every key',
		description: 'Sets every definition key',
		code: 'EK-1',
		language: 'en',
		releaseDate: '2026-09-01',
		metadata: { owner: 'forms' },
		instructions: { kind: 'inline', text: 'Fill every box.' },
		agentInstructions: { kind: 'inline', text: 'Ask for the amount first.' },
		defs: { large: { type: 'boolean', value: 'amount > 100' } },
		rules: { positive: { expr: 'amount > 0', message: 'Amount must be positive' } },
		fields: { amount: { type: 'number', label: 'Amount' } },
		layers: { main: { kind: 'inline', mimeType: 'text/plain', text: 'Amount: {{fields.amount}}' } },
		defaultLayer: 'main',
		allowAdditionalAnnexes: true,
		annexes: { receipt: { title: 'Receipt' } },
		parties: { payer: { label: 'Payer' } },
	}

	test('the fixture sets every schema key an author sets', () => {
		expect(Object.keys(everyKey).sort()).toEqual(objectKeys(FormSchema).filter((key) => key !== '$schema').sort())
	})

	test('keeps every key the object pattern keeps', () => {
		expect(form().from(everyKey).build().toJSON()).toEqual(form(everyKey).toJSON())
	})

	test('rejects an invalid definition', () => {
		expect(() => form().from({ ...everyKey, defaultLayer: '' })).toThrow(/defaultLayer/)
	})
})
