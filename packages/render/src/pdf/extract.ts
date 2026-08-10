import { PdfModel } from './syntax'
import { decodeAll, fieldTypeToString, ALPHABET } from './encoding'
import { loadPages } from './pages'
import { mergeRuns, scanPage, type TextRun } from './scanner'

export const DEFAULT_SIGNATURE_DIMENSIONS = { width: 200, height: 50 }
export const DEFAULT_INITIALS_DIMENSIONS = { width: 80, height: 40 }

/** A signature or initials field located in the PDF. */
export interface ExtractedField {
  signerIndex: number
  fieldType: 'signature' | 'initials'
  /** 1-based page number. */
  page: number
  /** Points from the left page edge. */
  x: number
  /** Points from the top page edge. */
  y: number
  width: number
  height: number
  /** Raw bottom-origin y from the PDF. */
  rawY: number
  pageHeight: number
}

interface Position {
  x: number
  y: number
  width: number
  height: number
}


/**
 * Locate the run containing the encoding start, then size the field from the
 * underscore placeholder on the same line. Mirrors the platform extractor:
 * the same ±5pt line tolerance, the same ±10-item bidirectional scan, and the
 * same box minimums, so results stay comparable field for field.
 */
function findEncodingPosition(runs: TextRun[], charPosition: number): Position | null {
  let cursor = 0
  let foundIndex = -1
  for (let index = 0; index < runs.length; index++) {
    const end = cursor + runs[index]!.text.length
    if (charPosition >= cursor && charPosition < end) {
      foundIndex = index
      break
    }
    cursor = end
  }
  if (foundIndex === -1) return null

  const found = runs[foundIndex]!
  const fontHeight = found.height > 0 ? found.height : 12

  let placeholderWidth = 0
  const lineTolerance = 5
  const scanStart = Math.max(0, foundIndex - 10)
  const scanEnd = Math.min(foundIndex + 10, runs.length)
  for (let index = scanStart; index < scanEnd; index++) {
    const run = runs[index]!
    const underscores = (run.text.match(/_/g) ?? []).length
    if (underscores === 0 || Math.abs(run.y - found.y) > lineTolerance) continue
    if (run.width > 0) {
      placeholderWidth += (run.width / run.text.length) * underscores
    } else {
      placeholderWidth += fontHeight * 0.4 * underscores
    }
    break
  }

  return {
    x: found.x,
    y: found.y,
    width: Math.max(placeholderWidth, 30),
    height: Math.max(fontHeight * 2.5, 25),
  }
}

/** Extract signature/initials fields from a PDF produced by a converter. */
export async function extractFieldsFromPdf(pdf: Uint8Array): Promise<ExtractedField[]> {
  const model = await PdfModel.load(pdf)
  const pages = await loadPages(model)
  const fields: ExtractedField[] = []

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex]!
    const pageHeight = page.mediaBox[3] - page.mediaBox[1]
    const originX = page.mediaBox[0]
    const originY = page.mediaBox[1]
    const runs = mergeRuns(await scanPage(model, page))
    const accumulated = runs.map((run) => run.text).join('')

    for (const encoding of decodeAll(accumulated)) {
      const position = findEncodingPosition(runs, encoding.position)
      if (!position) continue
      const name = fieldTypeToString(encoding.fieldType)
      const isInitials = name === 'initials'
      const width = isInitials ? Math.min(position.width, DEFAULT_INITIALS_DIMENSIONS.width) : position.width
      const height = isInitials ? Math.min(position.height * 0.8, DEFAULT_INITIALS_DIMENSIONS.height) : position.height
      const rawY = position.y - originY
      fields.push({
        signerIndex: encoding.signerIndex,
        fieldType: name === 'unknown' ? 'signature' : name,
        page: pageIndex + 1,
        x: position.x - originX,
        y: pageHeight - rawY - height,
        width: Math.round(width),
        height: Math.round(height),
        rawY,
        pageHeight,
      })
    }
  }

  return fields
}


/** Positioned, merged text runs for one page, with its geometry. */
export interface PageTextRuns {
  /** [x0, y0, x1, y1] MediaBox in points. */
  mediaBox: [number, number, number, number]
  runs: TextRun[]
}

/**
 * Merged text runs for every page, in document order. Low-level building
 * block for verification and layout tooling; coordinates are raw PDF user
 * space (bottom-origin y).
 */
export async function pageTextRuns(pdf: Uint8Array): Promise<PageTextRuns[]> {
  const model = await PdfModel.load(pdf)
  const pages = await loadPages(model)
  const result: PageTextRuns[] = []
  for (const page of pages) {
    result.push({ mediaBox: page.mediaBox, runs: mergeRuns(await scanPage(model, page)) })
  }
  return result
}

/** True when any page's text layer contains encoding characters. */
export async function pdfContainsEncoding(pdf: Uint8Array): Promise<boolean> {
  const model = await PdfModel.load(pdf)
  for (const page of await loadPages(model)) {
    const runs = await scanPage(model, page)
    for (const run of runs) {
      if (ALPHABET.some((character) => run.text.includes(character))) return true
    }
  }
  return false
}

/** All text in stream order, page by page. Debug helper. */
export async function extractAllText(pdf: Uint8Array): Promise<string> {
  const model = await PdfModel.load(pdf)
  const parts: string[] = []
  for (const page of await loadPages(model)) {
    const runs = await scanPage(model, page)
    parts.push(runs.map((run) => run.text).join(''))
  }
  return parts.join('\n--- Page Break ---\n')
}
