/**
 * Reference extractor built on pdfjs-dist, mirroring the platform's
 * pdf-text-extractor. Used only in tests and benchmarks to verify that the
 * lean scanner produces equivalent results.
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { decodeAll, fieldTypeToString } from '../src/pdf/encoding'
import type { ExtractedField } from '../src/pdf/extract'
import { DEFAULT_INITIALS_DIMENSIONS } from '../src/pdf/extract'

const require = createRequire(import.meta.url)
const workerPath = join(require.resolve('pdfjs-dist/package.json'), '../legacy/build/pdf.worker.mjs')
pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath}`

interface Item {
  str: string
  transform: number[]
  width: number
  height: number
}

function findEncodingPosition(items: Item[], charPosition: number) {
  let cursor = 0
  let foundIndex = -1
  for (let index = 0; index < items.length; index++) {
    const end = cursor + items[index]!.str.length
    if (charPosition >= cursor && charPosition < end) {
      foundIndex = index
      break
    }
    cursor = end
  }
  if (foundIndex === -1) return null
  const found = items[foundIndex]!
  const x = found.transform[4] ?? 0
  const y = found.transform[5] ?? 0
  const fontHeight = found.height > 0 ? found.height : Math.abs(found.transform[3] ?? 12)

  let placeholderWidth = 0
  const scanStart = Math.max(0, foundIndex - 10)
  const scanEnd = Math.min(foundIndex + 10, items.length)
  for (let index = scanStart; index < scanEnd; index++) {
    const item = items[index]!
    const underscores = (item.str.match(/_/g) ?? []).length
    const itemY = item.transform[5] ?? 0
    if (underscores === 0 || Math.abs(itemY - y) > 5) continue
    if (item.width > 0) placeholderWidth += (item.width / item.str.length) * underscores
    else placeholderWidth += fontHeight * 0.4 * underscores
    break
  }

  return {
    x,
    y,
    width: Math.max(placeholderWidth, 30),
    height: Math.max(fontHeight * 2.5, 25),
  }
}

/** Locate the first pdf.js text item containing `text`; top-origin y. */
export async function anchorPositionWithPdfjs(
  pdf: Uint8Array,
  text: string,
): Promise<{ page: number; x: number; y: number } | null> {
  const document = await pdfjs.getDocument({
    data: pdf.slice(),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.0 })
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!('str' in item)) continue
        const textItem = item as unknown as Item
        const index = textItem.str.indexOf(text)
        if (index === -1) continue
        const perChar = textItem.str.length > 0 ? (textItem.width ?? 0) / textItem.str.length : 0
        return {
          page: pageNumber,
          x: (textItem.transform[4] ?? 0) + perChar * index,
          y: viewport.height - (textItem.transform[5] ?? 0),
        }
      }
    }
    return null
  } finally {
    await document.destroy()
  }
}

export async function extractFieldsWithPdfjs(pdf: Uint8Array): Promise<ExtractedField[]> {
  const document = await pdfjs.getDocument({
    data: pdf.slice(),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise

  const fields: ExtractedField[] = []
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.0 })
      const pageHeight = viewport.height
      const content = await page.getTextContent()
      const items: Item[] = []
      let accumulated = ''
      for (const item of content.items) {
        if (!('str' in item)) continue
        const textItem = item as unknown as Item
        items.push({
          str: textItem.str,
          transform: textItem.transform ?? [1, 0, 0, 1, 0, 0],
          width: textItem.width ?? 0,
          height: textItem.height ?? 12,
        })
        accumulated += textItem.str
      }
      for (const encoding of decodeAll(accumulated)) {
        const position = findEncodingPosition(items, encoding.position)
        if (!position) continue
        const name = fieldTypeToString(encoding.fieldType)
        if (name === 'unknown') throw new Error(`Unknown marker field type ${encoding.fieldType} on page ${pageNumber}`)
        const isInitials = name === 'initials'
        const width = isInitials ? Math.min(position.width, DEFAULT_INITIALS_DIMENSIONS.width) : position.width
        const height = isInitials ? Math.min(position.height * 0.8, 40) : position.height
        fields.push({
          signerIndex: encoding.signerIndex,
          fieldType: name,
          page: pageNumber,
          x: position.x,
          y: pageHeight - position.y - height,
          width: Math.round(width),
          height: Math.round(height),
          rawY: position.y,
          pageHeight,
        })
      }
    }
  } finally {
    await document.destroy()
  }
  return fields
}

/** One drawn text run as pdf.js reads it, in page coordinates (bottom-left origin). */
export interface PdfjsTextItem {
  page: number
  text: string
  x: number
  y: number
  width: number
  /** Font size: the text matrix's vertical scale. */
  size: number
}

/** Every text run pdf.js reads from the page content, page by page. */
export async function textItemsWithPdfjs(pdf: Uint8Array): Promise<PdfjsTextItem[]> {
  const document = await pdfjs.getDocument({
    data: pdf.slice(),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise
  const items: PdfjsTextItem[] = []
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue
        const textItem = item as unknown as Item
        items.push({
          page: pageNumber,
          text: textItem.str,
          x: textItem.transform[4] ?? 0,
          y: textItem.transform[5] ?? 0,
          width: textItem.width,
          size: Math.abs(textItem.transform[3] ?? 0),
        })
      }
    }
  } finally {
    await document.destroy()
  }
  return items
}

/** A font pdf.js loaded to draw the document, as it reports it. */
export interface PdfjsFont {
  /** The font's name, from its BaseFont. */
  name: string
  /** True when the PDF does not embed the font program. */
  missingFile: boolean
}

/** Every font pdf.js sets while drawing each page, flattened form XObjects included. */
export async function fontsWithPdfjs(pdf: Uint8Array): Promise<PdfjsFont[]> {
  const document = await pdfjs.getDocument({
    data: pdf.slice(),
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
    standardFontDataUrl: `${join(require.resolve('pdfjs-dist/package.json'), '../standard_fonts')}/`,
  }).promise
  const fonts = new Map<string, PdfjsFont>()
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const operators = await page.getOperatorList()
      operators.fnArray.forEach((operator, index) => {
        if (operator !== pdfjs.OPS.setFont) return
        const loadedName = (operators.argsArray[index] as [string])[0]
        const font = page.commonObjs.get(loadedName) as { name: string; missingFile: boolean }
        fonts.set(font.name, { name: font.name, missingFile: font.missingFile })
      })
    }
  } finally {
    await document.destroy()
  }
  return [...fonts.values()]
}

/** Each form field's value as pdf.js reads it from the unflattened form. */
export async function fieldValuesWithPdfjs(pdf: Uint8Array): Promise<Record<string, unknown>> {
  const document = await pdfjs.getDocument({ data: pdf.slice(), isEvalSupported: false }).promise
  try {
    const fields = (await document.getFieldObjects()) ?? {}
    return Object.fromEntries(Object.entries(fields).map(([name, [first]]) => [name, (first as { value?: unknown }).value]))
  } finally {
    await document.destroy()
  }
}
