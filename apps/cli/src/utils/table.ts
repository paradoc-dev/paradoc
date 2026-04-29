/**
 * Minimal table renderer for terminal output.
 * Replaces cli-table3 for simple header + rows tables.
 */

export function formatTable(head: string[], rows: string[][]): string {
  // Compute column widths (max of header and all row values)
  const widths = head.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length))
  )

  const sep = '─'
  const top = '┌' + widths.map((w) => sep.repeat(w + 2)).join('┬') + '┐'
  const mid = '├' + widths.map((w) => sep.repeat(w + 2)).join('┼') + '┤'
  const bot = '└' + widths.map((w) => sep.repeat(w + 2)).join('┴') + '┘'

  const formatRow = (cells: string[]) =>
    '│' + cells.map((c, i) => ' ' + (c ?? '').padEnd(widths[i]!) + ' ').join('│') + '│'

  const lines = [top, formatRow(head), mid]
  for (const row of rows) {
    lines.push(formatRow(row))
  }
  lines.push(bot)

  return lines.join('\n')
}
