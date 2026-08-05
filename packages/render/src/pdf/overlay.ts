import { unzlibSync, zlibSync } from 'fflate'
import { isDict, isName, isRef, type PdfDict, type PdfObject, type PdfRef, PdfModel, type PdfValue } from './syntax'
import { getPath } from '../path'

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
  /** Fit text inside this width, shrinking no smaller than 6 points. */
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

interface PageRecord {
  record: PdfObject
  inheritedResources?: PdfValue
}

interface EmbeddedImage {
  ref: PdfRef
  width: number
  height: number
}

function pageRecords(model: PdfModel): PageRecord[] {
  const catalog = [...model.objects.values()].find((record) => {
    if (!isDict(record.value)) return false
    const type = record.value.entries.get('Type')
    return isName(type) && type.value === 'Catalog'
  })
  const pages: PageRecord[] = []
  const visit = (value: PdfValue | undefined, inheritedResources?: PdfValue) => {
    const record = isRef(value) ? model.objects.get(value.object) : undefined
    const dict = model.dict(value)
    if (!dict) return
    const resources = dict.entries.get('Resources') ?? inheritedResources
    const type = dict.entries.get('Type')
    if (isName(type) && type.value === 'Page') {
      if (record) pages.push({ record, inheritedResources: resources })
      return
    }
    const kids = model.resolve(dict.entries.get('Kids'))
    if (Array.isArray(kids)) kids.forEach((kid) => visit(kid, resources))
  }
  if (catalog && isDict(catalog.value)) visit(catalog.value.entries.get('Pages'))
  return pages
}

function standardFont(model: PdfModel): PdfRef {
  return model.addObject({
    kind: 'dict',
    entries: new Map<string, PdfValue>([
      ['Type', { kind: 'name', value: 'Font' }],
      ['Subtype', { kind: 'name', value: 'Type1' }],
      ['BaseFont', { kind: 'name', value: 'Helvetica' }],
      ['Encoding', { kind: 'name', value: 'WinAnsiEncoding' }],
    ]),
  })
}

function cloneDict(dict: PdfDict | undefined): PdfDict {
  return { kind: 'dict', entries: new Map(dict?.entries) }
}

function addResource(
  model: PdfModel,
  page: PageRecord,
  category: 'Font' | 'XObject',
  name: string,
  ref: PdfRef,
): void {
  if (!isDict(page.record.value)) return
  const resources = cloneDict(model.dict(page.record.value.entries.get('Resources') ?? page.inheritedResources))
  const entries = cloneDict(model.dict(resources.entries.get(category)))
  entries.entries.set(name, ref)
  resources.entries.set(category, entries)
  page.record.value.entries.set('Resources', resources)
  model.markUpdated(page.record)
}

function appendContent(model: PdfModel, page: PdfObject, stream: PdfRef): void {
  if (!isDict(page.value)) return
  const current = page.value.entries.get('Contents')
  const resolved = model.resolve(current)
  if (Array.isArray(resolved)) page.value.entries.set('Contents', [...resolved, stream])
  else if (current === undefined) page.value.entries.set('Contents', stream)
  else page.value.entries.set('Contents', [current, stream])
  model.markUpdated(page)
}

function textValue(overlay: PdfTextOverlay, data: Record<string, unknown>): unknown {
  if ('text' in overlay) return overlay.text
  return getPath(data, overlay.field)
}

function escapeText(value: unknown): string {
  return String(value ?? '')
    .replace(/[^\x20-\xff]/g, '?')
    .replace(/([\\()])/g, '\\$1')
}

function estimatedTextWidth(text: string, size: number): number {
  let units = 0
  for (const char of text) {
    if (char === ' ') units += 0.28
    else if (/[ilI.,'|!]/.test(char)) units += 0.28
    else if (/[mwMW@%]/.test(char)) units += 0.85
    else units += 0.56
  }
  return units * size
}

function fittedFontSize(text: string, overlay: PdfTextOverlay): number {
  let size = Math.min(overlay.fontSize ?? 12, overlay.height ?? Number.POSITIVE_INFINITY)
  const width = overlay.width
  while (width !== undefined && size > 6 && estimatedTextWidth(text, size) > width) size -= 0.5
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
): void {
  if (overlays.length === 0) return
  const pages = pageRecords(model)
  const grouped = new Map<number, PdfOverlay[]>()
  for (const overlay of overlays) {
    if (!Number.isInteger(overlay.page) || overlay.page < 1 || overlay.page > pages.length) {
      throw new Error(`PDF overlay page ${overlay.page} is outside the document's ${pages.length} pages`)
    }
    grouped.set(overlay.page, [...(grouped.get(overlay.page) ?? []), overlay])
  }
  const hasText = overlays.some((overlay) => !('image' in overlay))
  const font = hasText ? standardFont(model) : undefined
  let imageIndex = 0
  for (const [pageNumber, items] of grouped) {
    const page = pages[pageNumber - 1]!
    if (font && items.some((item) => !('image' in item))) addResource(model, page, 'Font', 'PdrF', font)
    const commands: string[] = []
    for (const overlay of items) {
      if ('image' in overlay) {
        const embedded = overlay.mediaType === 'image/png'
          ? embedPng(model, overlay.image)
          : embedJpeg(model, overlay.image)
        const name = `PdrI${imageIndex++}`
        addResource(model, page, 'XObject', name, embedded.ref)
        const scale = overlay.fit === 'fill'
          ? undefined
          : Math.min(overlay.width / embedded.width, overlay.height / embedded.height)
        const width = scale === undefined ? overlay.width : embedded.width * scale
        const height = scale === undefined ? overlay.height : embedded.height * scale
        commands.push(`q\n${width} 0 0 ${height} ${overlay.x} ${overlay.y} cm\n/${name} Do\nQ`)
        continue
      }
      const text = String(textValue(overlay, data) ?? '')
      const size = fittedFontSize(text, overlay)
      const x = overlay.x + (overlay.width === undefined ? 0 : 1)
      const y = overlay.y + (overlay.height === undefined ? 0 : Math.max(1, (overlay.height - size) / 2))
      const [red, green, blue] = (overlay.color ?? [0, 0, 0]).map(component)
      commands.push(`BT\n/PdrF ${size} Tf\n${red} ${green} ${blue} rg\n${x} ${y} Td\n(${escapeText(text)}) Tj\nET`)
    }
    const stream = model.addObject({ kind: 'dict', entries: new Map() }, new TextEncoder().encode(`q\n${commands.join('\n')}\nQ`))
    appendContent(model, page.record, stream)
  }
}
