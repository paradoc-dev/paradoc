/**
 * Minimal table renderer for terminal output.
 * Replaces cli-table3 for simple header + rows tables.
*/
import { stripVTControlCharacters } from 'node:util'

export function formatTable(head: string[], rows: string[][]): string {
  // Compute column widths (max of header and all row values)
  const widths = head.map((h, i) =>
    Math.max(stripVTControlCharacters(h).length, ...rows.map((r) => stripVTControlCharacters(r[i] ?? '').length))
  )

  const sep = '─'
  const top = '┌' + widths.map((w) => sep.repeat(w + 2)).join('┬') + '┐'
  const mid = '├' + widths.map((w) => sep.repeat(w + 2)).join('┼') + '┤'
  const bot = '└' + widths.map((w) => sep.repeat(w + 2)).join('┴') + '┘'

  const formatRow = (cells: string[]) =>
    '│' + cells.map((c, i) => {
      const cell = c ?? ''
      return ` ${cell}${' '.repeat(widths[i]! - stripVTControlCharacters(cell).length)} `
    }).join('│') + '│'

  const lines = [top, formatRow(head), mid]
  for (const row of rows) {
    lines.push(formatRow(row))
  }
  lines.push(bot)

  return lines.join('\n')
}
