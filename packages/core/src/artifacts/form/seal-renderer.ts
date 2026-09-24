/**
 * How the seal renders the layer it is sealing, and how it reads the markers
 * back out.
 *
 * Core's own layers reach a PDF in two steps: core renders the layer's text and
 * a converter turns it into PDF. A React composition has no text to render and
 * no conversion to do — its renderer writes the PDF — so the seal treats it as
 * one step and asks for no adapter.
 *
 * That leaves the markers. Flow placement works by writing eight invisible
 * codepoints in front of each slot's placeholder and finding them again in the
 * PDF. For a text layer core injects them itself, through the text renderer's
 * placeholder hooks, which is why nothing else may render a flow pass. For a
 * composition it cannot: the document is drawn by a renderer core knows nothing
 * about, so the markers travel to that renderer as `ctx.signing` and the
 * renderer puts each one where the document draws that slot.
 *
 * Both seal entry points, `prepareSeal` and `seal`, drive their passes through
 * `createSealPass` and place flow slots through `resolveFlowPlacements`, so the
 * two pipelines cannot drift on which renderer runs, on how a pass becomes PDF
 * bytes, on how a flow slot is located and verified, or on what a wrong answer
 * says.
 */

import {
	FieldType,
	LocateError,
	encode as encodeMarker,
	locate as locatePlacements,
	pageTextRuns,
} from '@paradoc/render/pdf'
import type { LocateHit } from '@paradoc/render/pdf'
import type {
	Layer,
	ParadocRenderer,
	RendererLayer,
	RenderRequest,
	SignatureSlot,
	SigningField,
	SigningMarker,
} from '@paradoc/types'
import { findRegisteredRenderer, isReactLayerMimeType, type RendererRegistry } from '@/rendering/renderer-registry'
import type { TextSignatureOptions } from '@paradoc/render/text'
import { SealConfigError } from './seal-slots'

/** A renderer the seal drives directly. */
export type SealRenderer = ParadocRenderer<RendererLayer, string | Uint8Array>

/** The four codepoints a marker is drawn from. */
const MARKER_ALPHABET = /[⠀⠁⠂⠄]/

/** What an engine writes for a codepoint no embedded font covers. */
const LOST_GLYPH = "\u0000"

/**
 * The registered renderer that produces this layer's PDF on its own, if there
 * is one.
 *
 * Only a React layer qualifies today: it is the layer kind core cannot render,
 * and its renderer returns PDF bytes rather than content to convert. Anything
 * else returns undefined and the seal takes its ordinary render-then-convert
 * path.
 */
export function selectSealRenderer(
	layerSpec: Layer,
	renderers: RendererRegistry | undefined,
): SealRenderer | undefined {
	if (!isReactLayerMimeType(layerSpec.mimeType)) return undefined
	return findRegisteredRenderer(renderers, layerSpec.mimeType) as SealRenderer | undefined
}

/**
 * The markers a renderer needs to draw, one per flow slot.
 *
 * Keyed by slot id, because a slot is the thing being placed: one party can
 * hold several flow slots — a signature and a set of initials is the ordinary
 * case — and they must not collapse into one another. The party travels beside
 * the slot because a renderer places the marker where the document draws that
 * party's block, and has no notion of a signer index.
 */
export function signingMarkersFor(
	slots: Record<string, SignatureSlot>,
	flow: readonly SigningField[],
): SigningMarker[] {
	const markers: SigningMarker[] = []
	for (const field of flow) {
		const slot = slots[field.id]
		if (!slot) continue
		const type = field.type === 'initials' ? 'initials' : 'signature'
		markers.push({
			slot: field.id,
			role: slot.party.role,
			index: slot.party.index ?? 0,
			type,
			marker: encodeMarker(field.signerIndex, type === 'initials' ? FieldType.INITIALS : FieldType.SIGNATURE),
		})
	}
	return markers
}

/**
 * The same renderer, told this render is the seal's marker pass.
 *
 * Wrapping rather than mutating keeps the registry entry the caller passed
 * untouched: the clean pass runs the renderer exactly as an ordinary render
 * would, which is what makes the sealed document the document.
 */
export function withSigningMarkers(renderer: SealRenderer, markers: readonly SigningMarker[]): SealRenderer {
	return {
		id: renderer.id,
		render: (request: RenderRequest<RendererLayer>) =>
			renderer.render({ ...request, ctx: { ...request.ctx, signing: { markers } } }),
	}
}

/** What one seal pass needs to know. */
export interface SealPassInput {
	/** The layer being sealed. */
	layerSpec: Layer
	/** True when the layer places at least one slot in flow. */
	flow: boolean
	/** The registered renderer that writes the PDF itself, if there is one. */
	sealRenderer: SealRenderer | undefined
	/** Markers for this layer's flow slots. Empty when it places none in flow. */
	markers: readonly SigningMarker[]
	/** Core's own marker-injecting text renderer, built per pass. */
	textRenderer: (withMarkers: boolean) => SealRenderer
	/** `SealOptions.renderer`. */
	override: SealRenderer | undefined
	/** `SealOptions.renderers`. */
	renderers: RendererRegistry | undefined
	/** Runs one render of the target layer with the renderer this module chose. */
	render: (renderer: SealRenderer) => Promise<string | Uint8Array>
	/** Turns rendered content into PDF bytes. Not called when the renderer wrote them. */
	convert: (content: string | Uint8Array) => Promise<Uint8Array>
}

/** One seal pass over the target layer. */
export interface SealPass {
	/** Renders the layer, with or without the flow markers. */
	render(withMarkers: boolean): Promise<string | Uint8Array>
	/** The same pass as PDF bytes, converted only when the renderer did not write them. */
	pdf(withMarkers: boolean): Promise<Uint8Array>
}

/**
 * Chooses the renderer for one pass, and turns the pass into PDF bytes.
 *
 * **Which renderer runs, in order.**
 *
 * 1. A renderer registered for a React layer's MIME type. It draws the markers
 *    it is handed and writes the PDF, so it wins over an override: an override
 *    cannot be given markers, and this can.
 * 2. Core's own text renderer, whenever the layer places a slot in flow. Flow
 *    placement *is* core injecting a marker into the text it renders, so nothing
 *    else may render that pass, and neither an override nor a registry entry is
 *    consulted. `prepareSeal` and `seal` refuse an override with flow placement
 *    up front rather than dropping it silently here.
 * 3. Otherwise `SealOptions.renderer`, then a renderer registered for the
 *    layer's MIME type, then core's own — the order `render` itself uses.
 *
 * @throws {SealConfigError} when a renderer expected to write PDF bytes returns
 * text instead.
 */
export function createSealPass(input: SealPassInput): SealPass {
	const rendererFor = (withMarkers: boolean): SealRenderer => {
		if (input.sealRenderer) {
			return withMarkers ? withSigningMarkers(input.sealRenderer, input.markers) : input.sealRenderer
		}
		if (input.flow) return input.textRenderer(withMarkers)
		const registered = findRegisteredRenderer(input.renderers, input.layerSpec.mimeType) as
			| SealRenderer
			| undefined
		return input.override ?? registered ?? input.textRenderer(false)
	}

	const render = (withMarkers: boolean) => input.render(rendererFor(withMarkers))

	return {
		render,
		async pdf(withMarkers: boolean): Promise<Uint8Array> {
			const rendered = await render(withMarkers)
			if (!input.sealRenderer) return input.convert(rendered)
			if (typeof rendered === 'string') {
				const problem =
					`the renderer registered for ${input.layerSpec.mimeType} returned text; ` +
					'a layer sealed without a converter must render PDF bytes'
				throw new SealConfigError(`Cannot seal: ${problem}`, [problem])
			}
			return rendered
		},
	}
}

/**
 * The hint core can give when a marker pass produced a PDF with no marker in it.
 *
 * A marker is eight braille codepoints, and an engine writes U+0000 for a
 * codepoint no embedded font covers. That is far and away the commonest way a
 * marker pass loses its markers, and core's placement error cannot see it: all
 * it knows is that nothing matched. So when the converted PDF carries no marker
 * codepoint at all, say what almost certainly happened. When it carries one, say
 * nothing: the markers arrived and the failure is something else.
 */
async function glyphCoverageHint(pdf: Uint8Array): Promise<string> {
	let text: string
	try {
		const pages = await pageTextRuns(pdf)
		text = pages.map((page) => page.runs.map((run) => run.text).join('')).join('')
	} catch {
		// The hint is a courtesy. A PDF core cannot read is something the caller
		// should hear about from the placement error itself.
		return ''
	}
	if (MARKER_ALPHABET.test(text)) return ''
	return (
		' The converted PDF carries no marker codepoint at all' +
		(text.includes(LOST_GLYPH) ? ', and does carry U+0000 where one belongs' : '') +
		'. A marker is eight braille codepoints (U+2800, U+2801, U+2802, U+2804) and a renderer writes ' +
		'U+0000 for any codepoint its embedded fonts do not cover, so the likeliest cause is glyph ' +
		'coverage: embed a face covering them for the marker pass.'
	)
}

/**
 * Locates the flow markers in the marker pass's PDF.
 *
 * On failure the placement error is re-raised with the glyph-coverage hint
 * appended, so a renderer that does not check its own output still fails naming
 * the likely cause and not only the slots.
 *
 * @throws {LocateError} naming every slot that did not resolve.
 */
export async function locateFlowMarkers(pdf: Uint8Array, flow: readonly SigningField[]): Promise<LocateHit[]> {
	try {
		return await locatePlacements(
			pdf,
			flow.map((field) => ({
				id: field.id,
				kind: 'marker' as const,
				signerIndex: field.signerIndex,
				fieldType: field.type === 'signature' ? FieldType.SIGNATURE : FieldType.INITIALS,
			})),
		)
	} catch (error) {
		if (!(error instanceof LocateError)) throw error
		throw new LocateError(error.message + (await glyphCoverageHint(pdf)), error.failures)
	}
}

const SIGNATURE_UNDERSCORES = '________________'
const INITIALS_UNDERSCORES = '______'

/**
 * Core's text placeholders for a seal pass. With markers, each flow slot's
 * placeholder is prefixed with its invisible marker; without, the visible
 * placeholders are identical, so coordinates located on the marker pass
 * transfer to the clean pass.
 */
export function flowTextSignatureOptions(flow: readonly SigningField[], withMarkers: boolean): TextSignatureOptions {
	const flowById = new Map(flow.map((field) => [field.id, field]))
	return {
		format: 'text',
		placeholder: {
			signature: (context) => {
				const field = withMarkers ? flowById.get(context.locationId) : undefined
				const prefix = field && field.type === 'signature' ? encodeMarker(field.signerIndex, FieldType.SIGNATURE) : ''
				return prefix + SIGNATURE_UNDERSCORES
			},
			initials: (context) => {
				const field = withMarkers ? flowById.get(context.locationId) : undefined
				const prefix = field && field.type === 'initials' ? encodeMarker(field.signerIndex, FieldType.INITIALS) : ''
				return prefix + INITIALS_UNDERSCORES
			},
		},
	}
}

/** Flow slots placed on the clean render, and that render's PDF. */
export interface FlowPlacements {
	/** Each flow slot with the box its marker resolved to. */
	flowResolved: SigningField[]
	/** The clean (marker-free) render: the canonical document. */
	cleanPdf: Uint8Array
}

/**
 * Places flow slots. The one implementation behind both `prepareSeal` and
 * `seal`.
 *
 * Renders twice: the marker pass locates each slot's placeholder in the
 * converted PDF; the clean pass becomes the canonical document. Marker glyphs
 * occupy width, so a wrap or page break can shift between passes. Each
 * resolved box is checked against a text run in the clean PDF, so drift is a
 * loud error, never a silently misplaced signature.
 *
 * @throws {LocateError} when a marker is not found in the marker pass.
 * @throws {Error} when a slot's marker is missing or its box drifted.
 */
export async function resolveFlowPlacements(pass: SealPass, flow: readonly SigningField[]): Promise<FlowPlacements> {
	const markerHits = await locateFlowMarkers(await pass.pdf(true), flow)
	const markersById = new Map(markerHits.map((hit) => [hit.id, hit]))
	const flowResolved: SigningField[] = []
	for (const field of flow) {
		const hit = markersById.get(field.id)
		if (!hit) throw new Error(`Marker for flow slot "${field.id}" was not found in the converted PDF.`)
		flowResolved.push({ ...field, page: hit.page, x: hit.x, y: hit.y, width: hit.width, height: hit.height })
	}

	const cleanPdf = await pass.pdf(false)
	const cleanPages = await pageTextRuns(cleanPdf)
	for (const field of flowResolved) {
		const page = cleanPages[field.page - 1]
		if (!page) throw new Error(`Flow slot "${field.id}" resolved to page ${field.page}, which the clean render does not have.`)
		const pageHeight = page.mediaBox[3] - page.mediaBox[1]
		const expectedRawY = pageHeight - field.y - field.height + page.mediaBox[1]
		const expectedX = field.x + page.mediaBox[0]
		// The clean render merges the label and placeholder into one text run,
		// so the box must fall INSIDE a run on the same line that still carries
		// the placeholder underscores.
		const near = page.runs.some(
			(run) =>
				Math.abs(run.y - expectedRawY) <= 3 &&
				run.text.includes('_') &&
				run.x - 3 <= expectedX &&
				expectedX <= run.x + run.width + 3,
		)
		if (!near) {
			throw new Error(
				`Flow slot "${field.id}" drifted between the marker pass and the clean render (page ${field.page}). ` +
				'The marker run likely changed a line wrap; use anchor placement for this slot or widen its placeholder.',
			)
		}
	}
	return { flowResolved, cleanPdf }
}
