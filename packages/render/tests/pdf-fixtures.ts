import { deflateSync } from 'node:zlib'

const encoder = new TextEncoder()

interface PdfObject {
  id: number
  body: string
  stream?: Uint8Array
}

function assemblePdf(objects: PdfObject[]): Uint8Array {
  const chunks: Uint8Array[] = [encoder.encode('%PDF-1.5\n')]
  const offsets = new Map<number, number>()
  let offset = chunks[0]!.length

  for (const object of objects) {
    offsets.set(object.id, offset)
    const header = encoder.encode(`${object.id} 0 obj\n${object.body}`)
    const footer = object.stream ? encoder.encode('\nendstream\nendobj\n') : encoder.encode('\nendobj\n')
    chunks.push(header)
    offset += header.length
    if (object.stream) {
      chunks.push(object.stream)
      offset += object.stream.length
    }
    chunks.push(footer)
    offset += footer.length
  }

  const xrefOffset = offset
  const size = Math.max(...objects.map(({ id }) => id)) + 1
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`
  for (let id = 1; id < size; id += 1) {
    const objectOffset = offsets.get(id)
    xref += objectOffset === undefined
      ? '0000000000 00000 f \n'
      : `${String(objectOffset).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(encoder.encode(xref))

  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const output = new Uint8Array(length)
  let cursor = 0
  for (const chunk of chunks) {
    output.set(chunk, cursor)
    cursor += chunk.length
  }
  return output
}

export function pagePdf(pageSizes: Array<[number, number]>): Uint8Array {
  const pageObjects = pageSizes.map(([width, height], index) => ({
    id: index + 3,
    body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << >> >>`,
  }))
  const kids = pageObjects.map(({ id }) => `${id} 0 R`).join(' ')
  return assemblePdf([
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { id: 2, body: `<< /Type /Pages /Kids [${kids}] /Count ${pageObjects.length} >>` },
    ...pageObjects,
  ])
}

export function compressedCheckboxPdf(names: string[]): Uint8Array {
  const fieldObjects = names.map((name, index) => {
    const id = index + 4
    const y = 20 + index * 20
    return {
      id,
      body: `<< /FT /Btn /T (${name}) /Subtype /Widget /Rect [20 ${y} 30 ${y + 10}] /P 3 0 R /V /Off /AS /Off /AP << /N << /Off null /Yes null >> >> >>`,
    }
  })
  const bodies: string[] = []
  let bodyOffset = 0
  const header = fieldObjects.map(({ id, body }) => {
    const pair = `${id} ${bodyOffset}`
    bodies.push(body)
    bodyOffset += encoder.encode(`${body} `).length
    return pair
  }).join(' ') + ' '
  const objectStream = encoder.encode(header + bodies.join(' ') + ' ')
  const compressedObjectStream = deflateSync(objectStream)
  const fields = fieldObjects.map(({ id }) => `${id} 0 R`).join(' ')

  return assemblePdf([
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R /AcroForm 7 0 R >>' },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { id: 3, body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Annots [${fields}] >>` },
    { id: 7, body: `<< /Fields [${fields}] >>` },
    {
      id: 8,
      body: `<< /Type /ObjStm /N ${fieldObjects.length} /First ${encoder.encode(header).length} /Filter /FlateDecode /Length ${compressedObjectStream.length} >>\nstream\n`,
      stream: compressedObjectStream,
    },
  ])
}

/** Build a real AcroForm PDF whose fixed text slots are controlled by the test. */
export function textFieldsPdf(names: string[]): Uint8Array {
  const fieldObjects = names.map((name, index) => {
    const id = index + 4
    const y = 250 - index * 24
    return {
      id,
      body: `<< /FT /Tx /T (${name}) /Subtype /Widget /Rect [20 ${y} 280 ${y + 18}] /P 3 0 R /V () >>`,
    }
  })
  const fields = fieldObjects.map(({ id }) => `${id} 0 R`).join(' ')
  const acroFormId = fieldObjects.length + 4
  return assemblePdf([
    { id: 1, body: `<< /Type /Catalog /Pages 2 0 R /AcroForm ${acroFormId} 0 R >>` },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { id: 3, body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Annots [${fields}] >>` },
    ...fieldObjects,
    { id: acroFormId, body: `<< /Fields [${fields}] >>` },
  ])
}
