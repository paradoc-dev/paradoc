// render-038: an aggregate over a loop row asks row visibility about the list
// the row came from, with the loop's own indices first.
import { createContext } from '@paradoc/expr'
import { describe, expect, it } from 'vitest'
import { renderText } from '../src/text/render'

const fields = {
  lines: [
    { parts: [{ amount: 1 }, { amount: 2 }] },
    { parts: [{ amount: 4 }, { amount: 8 }] },
  ],
}

function render(hidden: string[]): string {
  const rowVisible = (listPath: string, indices: readonly number[]) =>
    !hidden.includes(`${listPath}[${indices.join(',')}]`)
  return renderText({
    template: '{{#each fields.lines}}{{sum(item.parts.amount)}};{{/each}}',
    data: fields,
    expressions: { context: createContext({ fields }, { rowVisible }) },
  })
}

describe('render-038', () => {
  it('sums every row when none is hidden', () => {
    expect(render([])).toBe('3;12;')
  })

  it('leaves a hidden nested row out of a loop-relative aggregate', () => {
    expect(render(['fields.lines.parts[0,1]'])).toBe('1;12;')
    expect(render(['fields.lines.parts[1,0]'])).toBe('3;8;')
  })
})
