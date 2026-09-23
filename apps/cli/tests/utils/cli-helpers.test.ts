import { describe, it, expect } from 'vitest'
import { InvalidArgumentError } from 'commander'
import { collectHeader } from '../../src/utils/cli-helpers.js'

describe('collectHeader', () => {
  it('adds each header to the record, trimming its name and value', () => {
    const first = collectHeader('Authorization:  Bearer abc ', {})
    const both = collectHeader(' X-Team : forms', first)

    expect(both).toEqual({ Authorization: 'Bearer abc', 'X-Team': 'forms' })
    expect(first).toEqual({ Authorization: 'Bearer abc' })
  })

  it('keeps a colon inside the value', () => {
    expect(collectHeader('X-Url: https://example.com', {})).toEqual({ 'X-Url': 'https://example.com' })
  })

  it.each([
    ['no colon', 'Authorization Bearer abc', 'Invalid header "Authorization Bearer abc": expected "Name: Value".'],
    ['an empty name', ' : Bearer abc', 'Invalid header " : Bearer abc": the header name is empty.'],
    ['an empty value', 'Authorization:   ', 'Invalid header "Authorization": the header value is empty.'],
  ])('rejects a header with %s as an invalid option argument', (_shape, header, message) => {
    expect(() => collectHeader(header, {})).toThrow(InvalidArgumentError)
    expect(() => collectHeader(header, {})).toThrow(message)
  })
})
