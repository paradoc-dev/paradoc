import { unzlibSync, zlibSync } from 'fflate'
import type { PdfFontSet } from './drawing-fonts'
import { MIN_FONT_SIZE, PdfFieldFillError, type DrawingFont } from './field-appearance'
import { type PdfRef, PdfModel, type PdfValue } from './syntax'
import { getPath } from '../path'
import { addPageResource, appendPageContent, documentPages } from './page-tree'

interface PdfOverlayBase {
  /** One-based page number. */
  page: number
  /** Horizontal position in PDF points from the bottom-left corner. */
  x: number
  /** Vertical position in PDF points from the bottom-left corner. */
  y: number
}

export type PdfTextOverlay = PdfOverlayBase & {
  fontSize?: number
  /**
   * Fit text inside this width, shrinking no smaller than 6 points. Text that
   * still does not fit fails with an overflow error.
   */
  width?: number
  /** Vertically center text inside this height. */
  height?: number
  /** RGB components in the range 0–1. */
  color?: [number, number, number]
} & (
  | { text: string | number | boolean; field?: never }
  | { field: string; text?: never }
)

export type PdfImageOverlay = PdfOverlayBase & {
  image: Uint8Array
  mediaType: 'image/png' | 'image/jpeg'
  width: number
  height: number
  fit?: 'contain' | 'fill'
}

export type PdfOverlay = PdfTextOverlay | PdfImageOverlay


interface EmbeddedImage {
  ref: PdfRef
  width: number
  height: number
}

function textValue(overlay: PdfTextOverlay, data: Record<string, unknown>): unknown {
  if ('text' in overlay) return overlay.text
  return getPath(data, overlay.field)
}

/** The overlay as errors name it: its bound field, or its position. */
function overlaySubject(overlay: PdfTextOverlay, index: number): string {
  return 'field' in overlay && overlay.field ? overlay.field : `text overlay ${index + 1} (page ${overlay.page})`
}

function fittedFontSize(text: string, overlay: PdfTextOverlay, font: DrawingFont, subject: string): number {
  const declared = overlay.fontSize ?? 12
  let size = Math.min(declared, overlay.height ?? Number.POSITIVE_INFINITY)
  const width = overlay.width
  if (width === undefined) return size
  const floor = Math.min(MIN_FONT_SIZE, size)
  const unitWidth = font.width(text) / 1000
  if (unitWidth * size <= width) return size
  size = width / unitWidth
  if (size < floor) {
    throw new PdfFieldFillError(subject, 'overflow', { limit: floor }, `the text does not fit its ${width} pt width at the minimum size of ${floor} pt`)
  }
  return size
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0)
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

function paeth(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft
  const leftDistance = Math.abs(estimate - left)
  const aboveDistance = Math.abs(estimate - above)
  const upperLeftDistance = Math.abs(estimate - upperLeft)
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left
  return aboveDistance <= upperLeftDistance ? above : upperLeft
}

function decodePng(bytes: Uint8Array): {
  width: number
  height: number
  colorSpace: 'DeviceGray' | 'DeviceRGB'
  pixels: Uint8Array
  alpha?: Uint8Array
} {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!signature.every((byte, index) => bytes[index] === byte)) throw new Error('Invalid PNG image')
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat: Uint8Array[] = []
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = readUint32(bytes, offset)
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
    const data = bytes.slice(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = readUint32(data, 0)
      height = readUint32(data, 4)
      bitDepth = data[8]!
      colorType = data[9]!
      interlace = data[12]!
    } else if (type === 'IDAT') idat.push(data)
    offset += length + 12
    if (type === 'IEND') break
  }
  if (width < 1 || height < 1 || bitDepth !== 8 || interlace !== 0 || ![0, 2, 4, 6].includes(colorType)) {
    throw new Error('PNG overlays require non-interlaced 8-bit grayscale, RGB, grayscale-alpha, or RGBA images')
  }
  const channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[colorType]!
  const rowLength = width * channels
  const inflated = unzlibSync(concatBytes(idat))
  if (inflated.length < (rowLength + 1) * height) throw new Error('PNG image data is truncated')
  const decoded = new Uint8Array(rowLength * height)
  let source = 0
  for (let row = 0; row < height; row++) {
    const filter = inflated[source++]!
    const rowOffset = row * rowLength
    for (let column = 0; column < rowLength; column++) {
      const raw = inflated[source++]!
      const left = column >= channels ? decoded[rowOffset + column - channels]! : 0
      const above = row > 0 ? decoded[rowOffset + column - rowLength]! : 0
      const upperLeft = row > 0 && column >= channels ? decoded[rowOffset + column - rowLength - channels]! : 0
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : filter === 4 ? paeth(left, above, upperLeft)
                : Number.NaN
      if (Number.isNaN(predictor)) throw new Error(`Unsupported PNG filter ${filter}`)
      decoded[rowOffset + column] = (raw + predictor) & 0xff
    }
  }
  const hasAlpha = colorType === 4 || colorType === 6
  const colorChannels = colorType === 0 || colorType === 4 ? 1 : 3
  const pixels = new Uint8Array(width * height * colorChannels)
  const alpha = hasAlpha ? new Uint8Array(width * height) : undefined
  for (let pixel = 0; pixel < width * height; pixel++) {
    const input = pixel * channels
    const output = pixel * colorChannels
    pixels.set(decoded.slice(input, input + colorChannels), output)
    if (alpha) alpha[pixel] = decoded[input + channels - 1]!
  }
  return { width, height, colorSpace: colorChannels === 1 ? 'DeviceGray' : 'DeviceRGB', pixels, alpha }
}

function embedPng(model: PdfModel, bytes: Uint8Array): EmbeddedImage {
  const png = decodePng(bytes)
  const alphaRef = png.alpha
    ? model.addObject({
        kind: 'dict',
        entries: new Map<string, PdfValue>([
          ['Type', { kind: 'name', value: 'XObject' }],
          ['Subtype', { kind: 'name', value: 'Image' }],
          ['Width', png.width],
          ['Height', png.height],
          ['ColorSpace', { kind: 'name', value: 'DeviceGray' }],
          ['BitsPerComponent', 8],
          ['Filter', { kind: 'name', value: 'FlateDecode' }],
        ]),
      }, zlibSync(png.alpha))
    : undefined
  const entries = new Map<string, PdfValue>([
    ['Type', { kind: 'name', value: 'XObject' }],
    ['Subtype', { kind: 'name', value: 'Image' }],
    ['Width', png.width],
    ['Height', png.height],
    ['ColorSpace', { kind: 'name', value: png.colorSpace }],
    ['BitsPerComponent', 8],
    ['Filter', { kind: 'name', value: 'FlateDecode' }],
  ])
  if (alphaRef) entries.set('SMask', alphaRef)
  return { ref: model.addObject({ kind: 'dict', entries }, zlibSync(png.pixels)), width: png.width, height: png.height }
}

function embedJpeg(model: PdfModel, bytes: Uint8Array): EmbeddedImage {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Invalid JPEG image')
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue }
    const marker = bytes[offset + 1]!
    offset += 2
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!
      const components = bytes[offset + 7]!
      const colorSpace = components === 1 ? 'DeviceGray' : components === 4 ? 'DeviceCMYK' : 'DeviceRGB'
      const ref = model.addObject({
        kind: 'dict',
        entries: new Map<string, PdfValue>([
          ['Type', { kind: 'name', value: 'XObject' }],
          ['Subtype', { kind: 'name', value: 'Image' }],
          ['Width', width],
          ['Height', height],
          ['ColorSpace', { kind: 'name', value: colorSpace }],
          ['BitsPerComponent', 8],
          ['Filter', { kind: 'name', value: 'DCTDecode' }],
        ]),
      }, bytes)
      return { ref, width, height }
    }
    if (length < 2) break
    offset += length
  }
  throw new Error('JPEG dimensions could not be read')
}

const component = (value: number) => Math.max(0, Math.min(1, value))

export function applyPdfOverlays(
  model: PdfModel,
  overlays: PdfOverlay[],
  data: Record<string, unknown>,
  fonts: PdfFontSet,
): void {
  if (overlays.length === 0) return
  const pages = documentPages(model)
  const grouped = new Map<number, PdfOverlay[]>()
  for (const overlay of overlays) {
    if (!Number.isInteger(overlay.page) || overlay.page < 1 || overlay.page > pages.length) {
      throw new Error(`PDF overlay page ${overlay.page} is outside the document's ${pages.length} pages`)
    }
    grouped.set(overlay.page, [...(grouped.get(overlay.page) ?? []), overlay])
  }
  let imageIndex = 0
  for (const [pageNumber, items] of grouped) {
    const page = pages[pageNumber - 1]!
    const commands: string[] = []
    const pageFonts = new Map<string, PdfRef>()
    for (const overlay of items) {
      if ('image' in overlay) {
        const embedded = overlay.mediaType === 'image/png'
          ? embedPng(model, overlay.image)
          : embedJpeg(model, overlay.image)
        const name = `PdrI${imageIndex++}`
        addPageResource(model, page, 'XObject', name, embedded.ref)
        const scale = overlay.fit === 'fill'
          ? undefined
          : Math.min(overlay.width / embedded.width, overlay.height / embedded.height)
        const width = scale === undefined ? overlay.width : embedded.width * scale
        const height = scale === undefined ? overlay.height : embedded.height * scale
        commands.push(`q\n${width} 0 0 ${height} ${overlay.x} ${overlay.y} cm\n/${name} Do\nQ`)
        continue
      }
      const text = String(textValue(overlay, data) ?? '').replace(/\r\n|\r|\n/g, ' ')
      const subject = overlaySubject(overlay, overlays.indexOf(overlay))
      const font = fonts.select(subject, text)
      pageFonts.set(font.resourceName, font.reference())
      const size = fittedFontSize(text, overlay, font, subject)
      const x = overlay.x + (overlay.width === undefined ? 0 : 1)
      const y = overlay.y + (overlay.height === undefined ? 0 : Math.max(1, (overlay.height - size) / 2))
      const [red, green, blue] = (overlay.color ?? [0, 0, 0]).map(component)
      commands.push(`BT\n/${font.resourceName} ${size} Tf\n${red} ${green} ${blue} rg\n${x} ${y} Td\n${font.encode(text)} Tj\nET`)
    }
    for (const [name, ref] of pageFonts) addPageResource(model, page, 'Font', name, ref)
    const stream = model.addObject({ kind: 'dict', entries: new Map() }, new TextEncoder().encode(`q\n${commands.join('\n')}\nQ`))
    appendPageContent(model, page, stream)
  }
}
