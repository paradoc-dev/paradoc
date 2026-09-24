/**
 * Shape tests for the sealing/e-signing adapter contract in
 * `src/runtime/signing.ts`: SigningField, SealingRequest/Result, and the
 * deprecated legacy aliases that must keep pointing at their replacements
 * until ticket:remove-legacy-signing-shapes removes them.
 *
 * See tests/artifact-union.test.ts for the testing idiom.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type { Form } from '../src/schemas/artifacts/form'
import type {
	SigningFieldType,
	SigningField,
	SealingRequest,
	SealingResult,
	SealAdapterRequest,
	SealAdapterResult,
	Sealer,
	FormalSigningRequest,
	FormalSigningResponse,
	FormalSigningAdapter,
} from '../src/runtime/signing'

describe('SigningField', () => {
	it('supports exactly the five vendor-agnostic field types', () => {
		expectTypeOf<SigningField['type']>().toEqualTypeOf<SigningFieldType>()
		expectTypeOf<SigningFieldType>().toEqualTypeOf<'signature' | 'initials' | 'date_signed' | 'capacity' | 'printed_name'>()
	})

	it('rejects a field with no page/x/y/width/height', () => {
		// @ts-expect-error page, x, y, width, and height are all required.
		const bad: SigningField = { id: 'f1', signerIndex: 0, signerId: 's1', type: 'signature' }
		void bad
	})
})

describe('SealingRequest', () => {
	it('is generic over the form definition it seals', () => {
		expectTypeOf<SealingRequest<Form>['form']>().toEqualTypeOf<Form>()
	})

	it('keys parties, signers, and signatories the way FormData does', () => {
		expectTypeOf<SealingRequest>().toHaveProperty('parties')
		expectTypeOf<SealingRequest>().toHaveProperty('signers')
		expectTypeOf<SealingRequest>().toHaveProperty('signatories')
	})
})

describe('SealAdapterRequest', () => {
	it('extends SealingRequest with the rendered native document', () => {
		expectTypeOf<SealAdapterRequest>().toMatchTypeOf<SealingRequest>()
		expectTypeOf<SealAdapterRequest>().toHaveProperty('document')
	})
})

describe('SealAdapterResult / SealingResult', () => {
	it('an adapter returns raw pdf bytes; the sealer returns a hash and map', () => {
		expectTypeOf<SealAdapterResult>().toHaveProperty('pdf').toEqualTypeOf<Uint8Array>()
		expectTypeOf<SealingResult>().toHaveProperty('canonicalPdfHash').toEqualTypeOf<string>()
		expectTypeOf<SealingResult>().toHaveProperty('signatureMap').toEqualTypeOf<SigningField[]>()
	})
})

describe('Sealer', () => {
	it('seals any form and resolves a SealingResult', () => {
		expectTypeOf<Sealer['seal']>().returns.toEqualTypeOf<Promise<SealingResult>>()
	})
})

describe('legacy aliases (deprecated)', () => {
	it('still point at their replacements', () => {
		expectTypeOf<FormalSigningRequest>().toEqualTypeOf<SealingRequest>()
		expectTypeOf<FormalSigningResponse>().toEqualTypeOf<SealingResult>()
		expectTypeOf<FormalSigningAdapter>().toEqualTypeOf<Sealer>()
	})
})
