import type { LocateHit } from '@paradoc/types'
import { PdfModel } from './syntax'
import { type FieldTypeValue, fieldTypeToString } from './encoding'
import { extractFieldsFromPdf } from './extract'
import { loadPages } from './pages'
import { mergeRuns, scanPage, type TextRun } from './scanner'

/**
 * A placement query against a converter-produced PDF.
 *
 * - `marker`: find the invisible encoding for a signer index + field type
 *   that the render stage injected into the document.
 * - `anchor`: find literal document text. Without `occurrence` the text must
 *   appear exactly once; ambiguity is an error, not a guess.
 */
export type LocateQuery = { id: string } & (
  | { kind: 'marker'; signerIndex: number; fieldType: FieldTypeValue }
  | { kind: 'anchor'; text: string; occurrence?: number }
)

/** A resolved placement. Coordinates are PDF points, y from the top edge. */
export type { LocateHit } from '@paradoc/types'

/**
 * Factory returning a locator object for core's `seal({ locate })` option.
 * Kept as a factory so future variants (imported-PDF tier, hosted tier) share
 * the calling convention.
 */
export function locator(): { locate: typeof locate } {
  return { locate }
}

/** Thrown when any query cannot be resolved deterministically. */
export class LocateError extends Error {
  constructor(
    message: string,
    readonly failures: { id: string; reason: 'missing' | 'ambiguous'; matches?: number }[],
  ) {
    super(message)
    this.name = 'LocateError'
  }
}

interface AnchorMatch {
  page: number
  x: number
  y: number
  width: number
  height: number
}

/** Group merged runs into lines (same y within tolerance), sorted by x. */
function lines(runs: TextRun[]): TextRun[][] {
  const byLine: TextRun[][] = []
  for (const run of runs) {
    const line = byLine.find((candidate) => Math.abs(candidate[0]!.y - run.y) < 2)
    if (line) line.push(run)
    else byLine.push([run])
  }
  for (const line of byLine) line.sort((a, b) => a.x - b.x)
  // Reading order: top of the page first (PDF y grows upward).
  byLine.sort((a, b) => b[0]!.y - a[0]!.y)
  return byLine
}

function findAnchorMatches(pagesRuns: TextRun[][], text: string): AnchorMatch[] {
  const matches: AnchorMatch[] = []
  for (let pageIndex = 0; pageIndex < pagesRuns.length; pageIndex++) {
    for (const line of lines(pagesRuns[pageIndex]!)) {
      // Concatenate the line and keep a char → run map so a match position
      // converts back to a device-space x.
      let lineText = ''
      const owners: { run: TextRun; start: number }[] = []
      for (const run of line) {
        owners.push({ run, start: lineText.length })
        lineText += run.text
      }
      let from = 0
      while (true) {
        const index = lineText.indexOf(text, from)
        if (index === -1) break
        from = index + 1
        const owner = [...owners].reverse().find((candidate) => candidate.start <= index)!
        const offsetChars = index - owner.start
        const perChar = owner.run.text.length > 0 ? owner.run.width / owner.run.text.length : 0
        const matchWidth = perChar * text.length
        matches.push({
          page: pageIndex + 1,
          x: owner.run.x + perChar * offsetChars,
          y: owner.run.y,
          width: matchWidth,
          height: owner.run.height > 0 ? owner.run.height : 12,
        })
      }
    }
  }
  return matches
}

/**
 * Resolve placement queries against a PDF. All queries succeed or the call
 * throws a `LocateError` naming every failed id — partial results are never
 * returned, so a seal pipeline cannot proceed on a silently incomplete map.
 */
export async function locate(pdf: Uint8Array, queries: LocateQuery[]): Promise<LocateHit[]> {
  if (queries.length === 0) return []

  const model = await PdfModel.load(pdf)
  const pages = await loadPages(model)
  const pageHeights = pages.map((page) => page.mediaBox[3] - page.mediaBox[1])
  const pageOrigins = pages.map((page) => ({ x: page.mediaBox[0], y: page.mediaBox[1] }))

  const needsAnchors = queries.some((query) => query.kind === 'anchor')
  const pagesRuns: TextRun[][] = needsAnchors
    ? await Promise.all(pages.map(async (page) => mergeRuns(await scanPage(model, page))))
    : []

  const markerFields = queries.some((query) => query.kind === 'marker')
    ? await extractFieldsFromPdf(pdf)
    : []

  const hits: LocateHit[] = []
  const failures: { id: string; reason: 'missing' | 'ambiguous'; matches?: number }[] = []

  for (const query of queries) {
    if (query.kind === 'marker') {
      const matches = markerFields.filter(
        (field) =>
          field.signerIndex === query.signerIndex &&
          field.fieldType === fieldTypeToString(query.fieldType),
      )
      if (matches.length === 0) {
        failures.push({ id: query.id, reason: 'missing' })
      } else if (matches.length > 1) {
        // The render stage assigns one marker per slot; duplicates mean the
        // document was assembled wrong, and guessing would misplace a
        // signature.
        failures.push({ id: query.id, reason: 'ambiguous', matches: matches.length })
      } else {
        const field = matches[0]!
        hits.push({
          id: query.id,
          page: field.page,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
        })
      }
      continue
    }

    const matches = findAnchorMatches(pagesRuns, query.text)
    if (matches.length === 0) {
      failures.push({ id: query.id, reason: 'missing' })
      continue
    }
    if (query.occurrence === undefined && matches.length > 1) {
      failures.push({ id: query.id, reason: 'ambiguous', matches: matches.length })
      continue
    }
    const pick = matches[(query.occurrence ?? 1) - 1]
    if (!pick) {
      failures.push({ id: query.id, reason: 'missing', matches: matches.length })
      continue
    }
    const origin = pageOrigins[pick.page - 1]!
    const pageHeight = pageHeights[pick.page - 1]!
    hits.push({
      id: query.id,
      page: pick.page,
      x: pick.x - origin.x,
      y: pageHeight - (pick.y - origin.y) - pick.height,
      width: pick.width,
      height: pick.height,
    })
  }

  if (failures.length > 0) {
    const summary = failures
      .map((failure) =>
        failure.reason === 'ambiguous'
          ? `${failure.id} (ambiguous: ${failure.matches} matches, pass occurrence)`
          : `${failure.id} (not found)`,
      )
      .join(', ')
    throw new LocateError(`Could not resolve ${failures.length} of ${queries.length} placements: ${summary}`, failures)
  }

  return hits
}
