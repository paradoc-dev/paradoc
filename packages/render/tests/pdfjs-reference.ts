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
        const isInitials = name === 'initials'
        const width = isInitials ? Math.min(position.width, DEFAULT_INITIALS_DIMENSIONS.width) : position.width
        const height = isInitials ? Math.min(position.height * 0.8, 40) : position.height
        fields.push({
          signerIndex: encoding.signerIndex,
          fieldType: name === 'unknown' ? 'signature' : name,
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
