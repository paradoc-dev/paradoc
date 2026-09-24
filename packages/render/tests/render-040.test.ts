// render-040: a block takes at most one {{else}}.
import { describe, expect, it } from 'vitest'
import { renderText } from '../src/text/render'
import { TemplateError } from '../src/template/errors'

describe('render-040', () => {
  it('rejects a block with a second {{else}}', () => {
    const template = '{{#if fields.ok}}a{{else}}b{{else}}c{{/if}}'
    expect(() => renderText({ template, data: { ok: true } })).toThrow(TemplateError)
    expect(() => renderText({ template, data: { ok: true } })).toThrow(/more than one \{\{else\}\}/)
  })

  it('renders a block with one {{else}}', () => {
    expect(renderText({ template: '{{#if fields.ok}}a{{else}}b{{/if}}', data: { ok: false } })).toBe('b')
  })
})
