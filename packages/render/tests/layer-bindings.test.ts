import { describe, expect, it } from 'vitest'
import { parseBinding, PdfBindingSyntaxError, resolveLayerBindings } from '../src/index'
import { splitPartIndex } from '../src/layer-bindings'

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

describe('parseBinding', () => {
  it('reads one path, with or without the fields. prefix', () => {
    expect(parseBinding('name')).toEqual([{ source: 'name', path: 'name' }])
    expect(parseBinding(' fields.name ')).toEqual([{ source: 'fields.name', path: 'name' }])
    expect(parseBinding('parties.buyer.name')).toEqual([{ source: 'parties.buyer.name', path: 'parties.buyer.name' }])
  })

  it('trims a qualifier and the path before it', () => {
    expect(parseBinding('fields.status : married')).toEqual([{ source: 'fields.status', path: 'status', qualifier: 'married' }])
    expect(parseBinding('ssn:2')).toEqual([{ source: 'ssn', path: 'ssn', qualifier: '2' }])
  })

  it('reads each part of a joined binding', () => {
    expect(parseBinding('fields.city, state ,zip')).toEqual([
      { source: 'fields.city', path: 'city' },
      { source: 'state', path: 'state' },
      { source: 'zip', path: 'zip' },
    ])
  })

  it('refuses an empty path or qualifier, naming the binding', () => {
    expect(() => parseBinding('')).toThrow(PdfBindingSyntaxError)
    expect(() => parseBinding('city,,zip')).toThrow('Binding "city,,zip" has an empty path.')
    expect(() => parseBinding(':married')).toThrow('has an empty path')
    expect(() => parseBinding('status: ')).toThrow('Binding "status: " has an empty qualifier after "status:".')
  })

  it('refuses a qualifier inside a joined binding', () => {
    expect(() => parseBinding('ssn:1, ssn:2')).toThrow('Binding "ssn:1, ssn:2" qualifies a part of a joined binding; a joined binding reads whole values.')
    expect(() => parseBinding('city, status:married')).toThrow(PdfBindingSyntaxError)
  })
})

describe('splitPartIndex', () => {
  it('reads a positive whole number as a zero-based part', () => {
    expect(splitPartIndex('1')).toBe(0)
    expect(splitPartIndex('12')).toBe(11)
  })

  it('reads anything else as no part', () => {
    for (const qualifier of ['0', '2x', '-1', '1.5', 'married', '01']) expect(splitPartIndex(qualifier)).toBeUndefined()
  })
})
