import { describe, expect, it } from 'vitest'
import * as core from '@paradoc/core'
import * as render from '@paradoc/render'
import * as pdf from '@paradoc/render/pdf'
import * as sdk from '../src/index'

describe('@paradoc/sdk exports', () => {
  it('exports every @paradoc/core export unchanged', () => {
    const differing = Object.keys(core).filter(
      (key) => (sdk as Record<string, unknown>)[key] !== (core as Record<string, unknown>)[key],
    )
    expect(Object.keys(core).length).toBeGreaterThan(100)
    expect(differing).toEqual([])
  })

  it("exports core's renderLayer and render's createLayerRenderer side by side", () => {
    expect(sdk.renderLayer).toBe(core.renderLayer)
    expect(sdk.createLayerRenderer).toBe(render.createLayerRenderer)
    expect(sdk.createLayerRenderer().id).toBe('render-layer')
  })

  it('exports the placement API from @paradoc/render/pdf as the same functions', () => {
    expect(sdk.locate).toBe(pdf.locate)
    expect(sdk.extractFieldsFromPdf).toBe(pdf.extractFieldsFromPdf)
  })

  // The per-format wrappers dropped options (font, expressions) on the way to
  // createLayerRenderer. Callers use createLayerRenderer, the built-in default renderer, or the
  // @paradoc/render subpaths.
  it.each(['textRenderer', 'pdfRenderer', 'docxRenderer', 'inspectAcroFormFields'])('does not export %s', (name) => {
    expect(name in sdk).toBe(false)
  })
})
