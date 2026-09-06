/**
 * Burning a filled form into its pages.
 *
 * The property that matters and is easy to lose: a page with several fields
 * keeps every one of them. Each burned appearance is added to the page's
 * resource dictionary and drawn from its content stream, so a flatten that
 * rebuilt the resources from a stale snapshot would leave the earlier names
 * drawn but undeclared, and a reader would paint the last field only.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { flattenPdf } from '../src/pdf/flatten'
import { inspectAcroFormFields } from '../src/pdf/inspect'

const fixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')

const load = (name: string) => readFile(join(fixtures, name))

/** Every `PdrA` appearance name in the file, and how often each occurs. */
function appearanceNames(bytes: Uint8Array): Map<string, number> {
  const counts = new Map<string, number>()
  for (const match of new TextDecoder('latin1').decode(bytes).matchAll(/\/(PdrA\d+)\b/g)) {
    const name = match[1]!
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return counts
}

describe('flattenPdf', () => {
  it('declares every appearance it draws, on a page holding several fields', async () => {
    const flat = await flattenPdf(await load('pet-addendum.pdf'))
    const names = appearanceNames(flat)

    expect(names.size).toBeGreaterThan(1)
    // Twice each: once in the page's XObject dictionary, once in the `Do` that
    // draws it. A name drawn but not declared paints nothing.
    for (const [name, count] of names) expect([name, count]).toEqual([name, 2])
  })

  it('leaves no interactive form behind', async () => {
    expect((await inspectAcroFormFields(await load('pet-addendum.pdf'))).length).toBeGreaterThan(0)
    expect(await inspectAcroFormFields(await flattenPdf(await load('pet-addendum.pdf')))).toEqual([])
  })

  it('returns a PDF with no AcroForm unchanged', async () => {
    const plain = await load('large-contract.pdf')
    expect(await flattenPdf(plain)).toEqual(new Uint8Array(plain))
  })
})
