import { isDict, isName, isRef, type PdfDict, type PdfObject, type PdfRef, PdfModel, type PdfValue } from './syntax'

interface PdfOverlayBase {
  /** One-based page number. */
  page: number
  /** Horizontal position in PDF points from the bottom-left corner. */
  x: number
  /** Vertical position in PDF points from the bottom-left corner. */
  y: number
  fontSize?: number
  /** RGB components in the range 0–1. */
  color?: [number, number, number]
}

export type PdfTextOverlay = PdfOverlayBase & (
  | { text: string | number | boolean; field?: never }
  | { field: string; text?: never }
)

function pageRecords(model: PdfModel): Array<{ record: PdfObject; inheritedResources?: PdfValue }> {
  const catalog = [...model.objects.values()].find((record) => {
    if (!isDict(record.value)) return false
    const type = record.value.entries.get('Type')
    return isName(type) && type.value === 'Catalog'
  })
  const pages: Array<{ record: PdfObject; inheritedResources?: PdfValue }> = []
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

function addFont(model: PdfModel, page: PdfObject, inheritedResources: PdfValue | undefined, font: PdfRef): void {
  if (!isDict(page.value)) return
  const resources = cloneDict(model.dict(page.value.entries.get('Resources') ?? inheritedResources))
  const fonts = cloneDict(model.dict(resources.entries.get('Font')))
  fonts.entries.set('PdrF', font)
  resources.entries.set('Font', fonts)
  page.value.entries.set('Resources', resources)
  model.markUpdated(page)
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
  return overlay.field.split('.').reduce<unknown>((value, key) => {
    if (value === null || value === undefined || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[key]
  }, data)
}

function escapeText(value: unknown): string {
  return String(value ?? '')
    .replace(/[^\x20-\xff]/g, '?')
    .replace(/([\\()])/g, '\\$1')
}

const component = (value: number) => Math.max(0, Math.min(1, value))

export function applyTextOverlays(
  model: PdfModel,
  overlays: PdfTextOverlay[],
  data: Record<string, unknown>,
): void {
  if (overlays.length === 0) return
  const pages = pageRecords(model)
  const font = standardFont(model)
  const grouped = new Map<number, PdfTextOverlay[]>()
  for (const overlay of overlays) {
    if (!Number.isInteger(overlay.page) || overlay.page < 1 || overlay.page > pages.length) {
      throw new Error(`PDF overlay page ${overlay.page} is outside the document's ${pages.length} pages`)
    }
    grouped.set(overlay.page, [...(grouped.get(overlay.page) ?? []), overlay])
  }
  for (const [pageNumber, items] of grouped) {
    const page = pages[pageNumber - 1]!
    addFont(model, page.record, page.inheritedResources, font)
    const commands = items.map((overlay) => {
      const size = overlay.fontSize ?? 12
      const [red, green, blue] = (overlay.color ?? [0, 0, 0]).map(component)
      return `BT\n/PdrF ${size} Tf\n${red} ${green} ${blue} rg\n${overlay.x} ${overlay.y} Td\n(${escapeText(textValue(overlay, data))}) Tj\nET`
    }).join('\n')
    const stream = model.addObject({ kind: 'dict', entries: new Map() }, new TextEncoder().encode(`q\n${commands}\nQ`))
    appendContent(model, page.record, stream)
  }
}
