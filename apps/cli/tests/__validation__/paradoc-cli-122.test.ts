import { describe, expect, it } from 'vitest'
import { makeInstanceTemplate } from '../../src/utils/instance-template.js'
import type { Form } from '@paradoc/core'

describe('paradoc-cli-122: list template placeholder', () => {
  it('uses an empty list', () => {
    const form = { kind: 'form', fields: { rows: { type: 'list', label: 'Rows', item: { type: 'text', label: 'Row' } } } } as unknown as Form
    expect(makeInstanceTemplate(form).fields.rows).toEqual([])
  })
})
