// render-017: an unknown bindingsFrom is reported as "has no bindings".
// Input: layers { pdf: { mimeType: 'application/pdf', bindingsFrom: 'missing' } }.
// Expected: an error naming the unknown bindingsFrom layer. Actual: 'Layer "pdf" has no bindings ...' (not_matching).
import { describe, expect, it } from 'vitest'
import { selectPdfExtractionLayer } from '../src/pdf'

describe('render-017', () => {
  it('names the unknown bindingsFrom layer', () => {
    expect(() => selectPdfExtractionLayer({ pdf: { mimeType: 'application/pdf', bindingsFrom: 'missing' } }))
      .toThrow(expect.objectContaining({ code: 'unknown_bindings_source', message: expect.stringContaining('"missing"') }))
  })
  it('still reports a layer that reuses a non-PDF layer as having no bindings', () => {
    expect(() => selectPdfExtractionLayer({ md: { mimeType: 'text/markdown' }, pdf: { mimeType: 'application/pdf', bindingsFrom: 'md' } }))
      .toThrow(expect.objectContaining({ code: 'not_matching' }))
  })
})
