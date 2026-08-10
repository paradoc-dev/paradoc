import { isDict, isName, isRef, type PdfDict, type PdfModel, type PdfValue } from './syntax'

export interface PdfPage {
  dict: PdfDict
  resources: PdfDict | undefined
  /** [x0, y0, x1, y1] in points. */
  mediaBox: [number, number, number, number]
  content: Uint8Array
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('FlateDecode is unavailable in this runtime')
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
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

/** Walk the page tree in document order, resolving inherited attributes. */
export async function loadPages(model: PdfModel): Promise<PdfPage[]> {
  const catalog = [...model.objects.values()].find((record) => {
    if (!isDict(record.value)) return false
    const type = record.value.entries.get('Type')
    return isName(type) && type.value === 'Catalog'
  })
  if (!catalog || !isDict(catalog.value)) throw new Error('PDF catalog not found')
  const root = model.dict(catalog.value.entries.get('Pages'))
  if (!root) throw new Error('PDF page tree not found')

  const pages: PdfPage[] = []
  const visited = new Set<PdfValue>()

  const walk = async (
    node: PdfDict,
    inherited: { resources?: PdfDict; mediaBox?: number[] },
  ): Promise<void> => {
    if (visited.has(node)) return
    visited.add(node)
    const resources = model.dict(node.entries.get('Resources')) ?? inherited.resources
    const mediaBox = asNumberArray(model, node.entries.get('MediaBox')) ?? inherited.mediaBox
    const type = model.resolve(node.entries.get('Type'))

    if (isName(type) && type.value === 'Page') {
      const box = mediaBox && mediaBox.length === 4 ? mediaBox : [0, 0, 612, 792]
      pages.push({
        dict: node,
        resources,
        mediaBox: [box[0]!, box[1]!, box[2]!, box[3]!],
        content: await pageContent(model, node),
      })
      return
    }

    const kids = model.resolve(node.entries.get('Kids'))
    if (!Array.isArray(kids)) return
    for (const kid of kids) {
      const child = model.dict(kid)
      if (child) await walk(child, { resources, mediaBox })
    }
  }

  await walk(root, {})
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
