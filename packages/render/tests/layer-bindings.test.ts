import { describe, expect, it } from 'vitest'
import { resolveLayerBindings } from '../src/index'

describe('resolveLayerBindings', () => {
  const pdf = 'application/pdf'
  const layers = {
    copyA: { mimeType: pdf, bindings: { Name: 'name' }, format: { money: { currencyDisplay: 'none' } } },
    copyB: { mimeType: pdf, bindingsFrom: 'copyA' },
    copyC: { mimeType: pdf, bindingsFrom: 'copyB' },
    own: { mimeType: pdf, bindings: { Own: 'own' }, bindingsFrom: 'copyA' },
    plain: { mimeType: pdf },
    dangling: { mimeType: pdf, bindingsFrom: 'missing' },
    markdown: { mimeType: 'text/markdown', bindings: { alias: 'fields.name' } },
    markdownFrom: { mimeType: 'text/markdown', bindingsFrom: 'copyA' },
    fromMarkdown: { mimeType: 'APPLICATION/PDF', bindingsFrom: 'markdown' },
  }

  it('returns the layer own bindings', () => {
    expect(resolveLayerBindings(layers, layers.copyA)).toEqual({ Name: 'name' })
  })

  it('resolves through bindingsFrom to the named layer bindings, and only the bindings', () => {
    const resolved = resolveLayerBindings(layers, layers.copyB)
    expect(resolved).toBe(layers.copyA.bindings)
    expect(resolved).not.toHaveProperty('money')
  })

  it('prefers own bindings over bindingsFrom', () => {
    expect(resolveLayerBindings(layers, layers.own)).toEqual({ Own: 'own' })
  })

  it('follows one hop only: a source with no own bindings gives none', () => {
    expect(resolveLayerBindings(layers, layers.copyC)).toBeUndefined()
  })

  it('returns undefined for a layer with neither bindings nor bindingsFrom', () => {
    expect(resolveLayerBindings(layers, layers.plain)).toBeUndefined()
  })

  it('throws, naming the available layers, when bindingsFrom names no layer', () => {
    expect(() => resolveLayerBindings(layers, layers.dangling)).toThrow(
      'bindingsFrom "missing" references unknown layer. Available: copyA, copyB, copyC, own, plain, dangling, markdown, markdownFrom, fromMarkdown',
    )
  })

  it('gives a layer that is not a PDF no bindings, its own or reused', () => {
    expect(resolveLayerBindings(layers, layers.markdown)).toBeUndefined()
    expect(resolveLayerBindings(layers, layers.markdownFrom)).toBeUndefined()
  })

  it('reuses only a PDF layer: a source that is not a PDF gives none', () => {
    expect(resolveLayerBindings(layers, layers.fromMarkdown)).toBeUndefined()
  })
})
