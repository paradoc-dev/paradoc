// render-019: locate reports occurrence 0 as "not found".
// Input: anchor 'Approved by manager' (3 matches in large-contract.pdf), occurrence 0.
// Expected: an invalid-query error, not "(not found)". Actual: LocateError "... approval (not found)".
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { locate } from '../src/pdf/locate'

describe('render-019', () => {
  it('does not report a matched anchor as not found for occurrence 0', async () => {
    const pdf = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')))
    await expect(locate(pdf, [{ id: 'approval', kind: 'anchor', text: 'Approved by manager', occurrence: 0 }]))
      .rejects.toThrow(/occurrence/)
  })
  it('rejects a fractional occurrence', async () => {
    const pdf = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')))
    await expect(locate(pdf, [{ id: 'approval', kind: 'anchor', text: 'Approved by manager', occurrence: 1.5 }]))
      .rejects.toThrow(RangeError)
  })
  it('resolves a positive integer occurrence', async () => {
    const pdf = new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'large-contract.pdf')))
    const [hit] = await locate(pdf, [{ id: 'approval', kind: 'anchor', text: 'Approved by manager', occurrence: 2 }])
    expect(hit?.id).toBe('approval')
  })
})
