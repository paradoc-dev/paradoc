/**
 * Shape tests for the renderer plugin contract: RenderRequest, RendererLayer,
 * the open-ended ParadocRendererContext, and the signing-marker types a seal
 * hands a renderer for flow placement.
 *
 * See tests/artifact-union.test.ts for the testing idiom.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type { Form } from '../src/schemas/artifacts/form'
import type { FormData } from '../src/runtime'
import type {
	BinaryContent,
	RendererLayer,
	RenderRequest,
	ParadocRendererContext,
	ParadocRenderer,
	SigningMarker,
	SigningMarkerRequest,
} from '../src/interfaces/renderer'
import type { Resolver } from '../src/interfaces/resolver'

describe('RenderRequest', () => {
	it('always carries a Form and FormData beside the template', () => {
		expectTypeOf<RenderRequest>().toHaveProperty('form').toEqualTypeOf<Form>()
		expectTypeOf<RenderRequest>().toHaveProperty('data').toEqualTypeOf<FormData>()
	})

	it('is generic over the template layer it renders', () => {
		interface PdfLayer extends RendererLayer {
			type: 'pdf'
		}
		expectTypeOf<RenderRequest<PdfLayer>>().toHaveProperty('template').toEqualTypeOf<PdfLayer>()
	})

	it('rejects a request missing the form', () => {
		const data: FormData = { fields: {} }
		// @ts-expect-error a RenderRequest cannot omit `form`.
		const bad: RenderRequest = { template: { type: 'text' }, data }
		void bad
	})
})

describe('ParadocRendererContext', () => {
	it('stays open for forward-compatible extension', () => {
		const ctx: ParadocRendererContext = { anythingAtAll: true }
		expectTypeOf(ctx).toMatchTypeOf<ParadocRendererContext>()
	})

	it('types its known members without forcing them', () => {
		expectTypeOf<ParadocRendererContext>().toHaveProperty('signing').toEqualTypeOf<SigningMarkerRequest | undefined>()
	})
})

describe('SigningMarker / SigningMarkerRequest', () => {
	it('only supports the two flow-placeable field types', () => {
		expectTypeOf<SigningMarker['type']>().toEqualTypeOf<'signature' | 'initials'>()
	})

	it('carries markers in slot declaration order as a readonly list', () => {
		expectTypeOf<SigningMarkerRequest['markers']>().toEqualTypeOf<readonly SigningMarker[]>()
	})

	it('rejects a marker request missing its markers array', () => {
		// @ts-expect-error SigningMarkerRequest requires `markers`.
		const bad: SigningMarkerRequest = {}
		void bad
	})
})

describe('ParadocRenderer', () => {
	it('renders by id, returning Output sync or async', () => {
		interface TextOutput {
			text: string
		}
		expectTypeOf<ParadocRenderer<RendererLayer, TextOutput>['render']>().returns.toEqualTypeOf<
			Promise<TextOutput> | TextOutput
		>()
	})
})

describe('BinaryContent', () => {
	it('is a plain Uint8Array, so a Node Buffer is assignable to it', () => {
		expectTypeOf<Buffer>().toMatchTypeOf<BinaryContent>()
	})
})

describe('Resolver', () => {
	it('reads a logical path to raw bytes', () => {
		expectTypeOf<Resolver['read']>().returns.toEqualTypeOf<Promise<Uint8Array>>()
		expectTypeOf<Resolver['read']>().parameter(0).toEqualTypeOf<string>()
	})
})
