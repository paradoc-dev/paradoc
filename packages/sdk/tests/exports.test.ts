import { describe, expect, it } from 'vitest'
import * as pdf from '@paradoc/render/pdf'
import * as sdk from '../src/index'

describe('@paradoc/sdk exports', () => {
  it('exports the MIME-selected renderLayer', () => {
    expect(typeof sdk.renderLayer).toBe('function')
    expect(sdk.renderLayer().id).toBe('render-layer')
  })

  it('exports the placement API from @paradoc/render/pdf as the same functions', () => {
    expect(sdk.locate).toBe(pdf.locate)
    expect(sdk.extractFieldsFromPdf).toBe(pdf.extractFieldsFromPdf)
  })

  // The per-format wrappers dropped options (font, expressions) on the way to
  // renderLayer. Callers use renderLayer, the built-in default renderer, or the
  // @paradoc/render subpaths.
  it.each(['textRenderer', 'pdfRenderer', 'docxRenderer', 'inspectAcroFormFields'])('does not export %s', (name) => {
    expect(name in sdk).toBe(false)
  })
})
