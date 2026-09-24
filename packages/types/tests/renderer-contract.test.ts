/**
 * Shape tests for the renderer plugin contract: RenderRequest, RendererLayer,
 * the closed ParadocRendererContext, and the signing-marker types a seal
 * hands a renderer for flow placement.
 *
 * See tests/artifact-union.test.ts for the testing idiom.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type { Form } from '../src/schemas/artifacts/form'
import type { Checklist, Document } from '../src/schemas/artifacts'
import type { ChecklistData, FormData } from '../src/runtime'
import type {
	BinaryContent,
	RendererLayer,
	RendererLayerType,
	RenderRequest,
	RendererExpressions,
	ParadocRendererContext,
	ParadocRenderer,
	SigningMarker,
	SigningMarkerRequest,
} from '../src/interfaces/renderer'
import type { Resolver } from '../src/interfaces/resolver'

describe('RenderRequest', () => {
	it('pairs each artifact kind with its own payload', () => {
		function payload(request: RenderRequest): string {
			switch (request.kind) {
				case 'form':
					expectTypeOf(request.artifact).toEqualTypeOf<Form>()
					expectTypeOf(request.data).toEqualTypeOf<FormData>()
					return request.artifact.name
				case 'checklist':
					expectTypeOf(request.artifact).toEqualTypeOf<Checklist>()
					expectTypeOf(request.data).toEqualTypeOf<ChecklistData>()
					return request.artifact.name
				case 'document':
					expectTypeOf(request.artifact).toEqualTypeOf<Document>()
					expectTypeOf(request).not.toHaveProperty('data')
					return request.artifact.name
			}
		}
		void payload
	})

	it('is generic over the template layer it renders', () => {
		interface PdfLayer extends RendererLayer {
			type: 'pdf'
		}
		expectTypeOf<RenderRequest<PdfLayer>>().toHaveProperty('template').toEqualTypeOf<PdfLayer>()
	})

	it('rejects a form request missing its artifact', () => {
		const data: FormData = { fields: {} }
		// @ts-expect-error a form request names the form it renders.
		const bad: RenderRequest = { kind: 'form', template: { type: 'text' }, data }
		void bad
	})

	it('rejects a checklist request that carries form data', () => {
		const checklist = {} as Checklist
		// @ts-expect-error a checklist request carries item statuses, not form fields.
		const bad: RenderRequest = { kind: 'checklist', template: { type: 'text' }, artifact: checklist, data: { fields: {} } }
		void bad
	})

	it('rejects a document passed off as a form', () => {
		const document = {} as Document
		// @ts-expect-error a form request carries a Form, not a Document.
		const bad: RenderRequest = { kind: 'form', template: { type: 'text' }, artifact: document, data: { fields: {} } }
		void bad
	})
})

describe('RendererLayer', () => {
	it('closes its type to the known template types', () => {
		expectTypeOf<RendererLayer['type']>().toEqualTypeOf<RendererLayerType>()
		// @ts-expect-error an unknown layer type is not a RendererLayer.
		const bad: RendererLayer = { type: 'xlsx' }
		void bad
	})
})

describe('ParadocRendererContext', () => {
	it('rejects a key it does not declare', () => {
		// @ts-expect-error a misspelled member is an error, not an ignored extra.
		const bad: ParadocRendererContext = { formater: undefined }
		void bad
	})

	it('types its known members without forcing them', () => {
		const empty: ParadocRendererContext = {}
		void empty
		expectTypeOf<ParadocRendererContext>().toHaveProperty('signing').toEqualTypeOf<SigningMarkerRequest | undefined>()
		expectTypeOf<ParadocRendererContext>().toHaveProperty('expressions').toEqualTypeOf<RendererExpressions | undefined>()
	})

	it('requires expressions to carry a context with lookup', () => {
		const good: ParadocRendererContext = { expressions: { context: { lookup: () => undefined } } }
		void good
		// @ts-expect-error expressions carry an expression context, not arbitrary data.
		const bad: ParadocRendererContext = { expressions: { items: {} } }
		void bad
	})

	it('has no logger member', () => {
		expectTypeOf<ParadocRendererContext>().not.toHaveProperty('logger')
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
