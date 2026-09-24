/**
 * The small shared unions are defined once and reused. Each test pins a use
 * site to the one shared type, so restating the union inline (or diverging
 * from it) fails `check-types`.
 *
 * Parity of these types with the Zod schemas is proved in
 * `@paradoc/schemas` (tests/types-parity.test.ts), since this package stays
 * Zod-free (D2).
 */
import { describe, expectTypeOf, it } from 'vitest'
import type { Attachment, Signature, SignatureMethod } from '../src/schemas/primitives'
import type { BaseField, EnumOption, EnumOptionValue, FormAnnex, FormParty } from '../src/schemas/artifacts/form'
import type { CondExpr } from '../src/schemas/artifacts/shared'
import type { EnumFormatOptions, SelectionValueByKind } from '../src/interfaces/formatter'
import type {
	AdoptedSignature,
	DraftFormJSON,
	ExecutedFormJSON,
	FormData,
	SignableFormJSON,
	SignatureCapture,
} from '../src/runtime'

describe('CondExpr', () => {
	it('types every required and visible condition on fields, annexes, and parties', () => {
		expectTypeOf<BaseField['required']>().toEqualTypeOf<CondExpr | undefined>()
		expectTypeOf<BaseField['visible']>().toEqualTypeOf<CondExpr | undefined>()
		expectTypeOf<FormAnnex['required']>().toEqualTypeOf<CondExpr | undefined>()
		expectTypeOf<FormAnnex['visible']>().toEqualTypeOf<CondExpr | undefined>()
		expectTypeOf<FormParty['required']>().toEqualTypeOf<CondExpr | undefined>()
	})

	it('rejects a value that is neither a boolean nor an expression string', () => {
		// @ts-expect-error a number is not a condition.
		const bad: BaseField = { required: 1 }
		void bad
	})
})

describe('SignatureMethod', () => {
	it('is the capture method of signatures, adopted signatures, and captures', () => {
		expectTypeOf<Signature['method']>().toEqualTypeOf<SignatureMethod>()
		expectTypeOf<AdoptedSignature['method']>().toEqualTypeOf<SignatureMethod>()
		expectTypeOf<SignatureCapture['method']>().toEqualTypeOf<SignatureMethod | undefined>()
	})

	it('rejects a method outside the four capture methods', () => {
		// @ts-expect-error "stamped" is not a capture method.
		const bad: SignatureMethod = 'stamped'
		void bad
	})
})

describe('EnumOption', () => {
	it('is the option shape the formatter reads', () => {
		expectTypeOf<NonNullable<EnumFormatOptions['options']>>().toEqualTypeOf<readonly EnumOption[]>()
		expectTypeOf<SelectionValueByKind['enum']>().toEqualTypeOf<EnumOptionValue>()
	})
})

describe('serialized form annexes', () => {
	it('carry the same Attachment values as FormData', () => {
		type Annexes = NonNullable<FormData['annexes']>
		expectTypeOf<Annexes>().toEqualTypeOf<Record<string, Attachment>>()
		expectTypeOf<DraftFormJSON['annexes']>().toEqualTypeOf<Annexes>()
		expectTypeOf<SignableFormJSON['annexes']>().toEqualTypeOf<Annexes>()
		expectTypeOf<ExecutedFormJSON['annexes']>().toEqualTypeOf<Annexes>()
	})

	it('reject an annex value that is not an Attachment', () => {
		// @ts-expect-error an annex value must be an Attachment.
		const annexes: DraftFormJSON['annexes'] = { lease: 'lease.pdf' }
		void annexes
	})
})
