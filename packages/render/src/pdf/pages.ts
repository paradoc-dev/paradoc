import { pageRecords } from './page-tree'
import { inflate, isDict, isName, isRef, type PdfDict, type PdfModel, type PdfValue } from './syntax'

export interface PdfPage {
  dict: PdfDict
  resources: PdfDict | undefined
  /** [x0, y0, x1, y1] in points. */
  mediaBox: [number, number, number, number]
  content: Uint8Array
}

/** Decode a stream object's bytes, applying its declared filters. */
export async function decodeStream(model: PdfModel, dict: PdfDict, raw: Uint8Array): Promise<Uint8Array> {
  const filter = model.resolve(dict.entries.get('Filter'))
  const filters: string[] = []
  if (isName(filter)) filters.push(filter.value)
  else if (Array.isArray(filter)) {
    for (const entry of filter) {
      const resolved = model.resolve(entry)
      if (isName(resolved)) filters.push(resolved.value)
    }
  }
  let bytes = raw
  for (const name of filters) {
    if (name === 'FlateDecode') {
      const parms = model.dict(dict.entries.get('DecodeParms'))
      const predictor = parms ? model.resolve(parms.entries.get('Predictor')) : undefined
      if (typeof predictor === 'number' && predictor > 1) {
        throw new Error('FlateDecode predictors are not supported in content streams')
      }
      bytes = await inflate(bytes)
    } else {
      throw new Error(`Unsupported stream filter: ${name}`)
    }
  }
  return bytes
}

function asNumberArray(model: PdfModel, value: PdfValue | undefined): number[] | undefined {
  const resolved = model.resolve(value)
  if (!Array.isArray(resolved)) return undefined
  const numbers = resolved.map((entry) => model.resolve(entry)).filter((entry): entry is number => typeof entry === 'number')
  return numbers.length === resolved.length ? numbers : undefined
}

/** Every page in document order, with its inherited resources and media box. */
export async function loadPages(model: PdfModel): Promise<PdfPage[]> {
  const catalog = model.catalog()
  if (!catalog || !isDict(catalog.value)) throw new Error('PDF catalog not found')
  if (!model.dict(catalog.value.entries.get('Pages'))) throw new Error('PDF page tree not found')

  const pages: PdfPage[] = []
  for (const { record, inherited } of pageRecords(model, catalog.value)) {
    if (!isDict(record.value)) continue
    const mediaBox = asNumberArray(model, inherited.get('MediaBox'))
    const box = mediaBox && mediaBox.length === 4 ? mediaBox : [0, 0, 612, 792]
    pages.push({
      dict: record.value,
      resources: model.dict(inherited.get('Resources')),
      mediaBox: [box[0]!, box[1]!, box[2]!, box[3]!],
      content: await pageContent(model, record.value),
    })
  }
  return pages
}

async function pageContent(model: PdfModel, page: PdfDict): Promise<Uint8Array> {
  const contents = page.entries.get('Contents')
  const parts: Uint8Array[] = []

  const append = async (value: PdfValue | undefined): Promise<void> => {
    if (isRef(value)) {
      const record = model.objects.get(value.object)
      if (record?.stream && isDict(record.value)) {
        parts.push(await decodeStream(model, record.value, record.stream))
      }
      return
    }
    const resolved = model.resolve(value)
    if (Array.isArray(resolved)) {
      for (const entry of resolved) await append(entry)
    }
  }

  await append(contents)
  if (parts.length === 1) return parts[0]!
  // Streams in a Contents array are logically one stream separated by whitespace.
  const total = parts.reduce((sum, part) => sum + part.length + 1, 0)
  const joined = new Uint8Array(total)
  let cursor = 0
  for (const part of parts) {
    joined.set(part, cursor)
    cursor += part.length
    joined[cursor++] = 0x0a
  }
  return joined
}
