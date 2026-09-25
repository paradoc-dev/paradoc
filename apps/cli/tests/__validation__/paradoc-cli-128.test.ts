import { describe, expect, it } from 'vitest'
import { getMimeType, isKnownMimeType } from '../../src/utils/mime.js'

describe('paradoc-cli-128: React layer MIME types', () => {
  it('recognizes TSX and JSX', () => {
    expect(getMimeType('.tsx')).toBe('text/tsx')
    expect(getMimeType('.jsx')).toBe('text/jsx')
    expect(isKnownMimeType('.tsx')).toBe(true)
  })
})
