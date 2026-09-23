import { deflateSync } from 'node:zlib'

const encoder = new TextEncoder()

export interface FixtureObject {
  id: number
  body: string
  stream?: Uint8Array
}

export function assemblePdf(objects: FixtureObject[], trailerEntries = ''): Uint8Array {
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
  xref += `trailer\n<< /Size ${size} /Root 1 0 R${trailerEntries} >>\nstartxref\n${xrefOffset}\n%%EOF\n`
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

/** One widget-merged field for {@link acroFieldsPdf}. */
export interface FixtureField {
  name: string
  /** Lower-left x, lower-left y, upper-right x, upper-right y. */
  rect: [number, number, number, number]
  type?: 'Tx' | 'Ch'
  da?: string
  q?: number
  flags?: number
  maxLen?: number
  /** Choice options: plain strings, or [export value, display text] pairs. */
  options?: Array<string | [string, string]>
}

const literal = (value: string) => `(${value.replace(/[\\()]/g, (char) => `\\${char}`)})`

/** Form-wide settings for {@link acroFieldsPdf}. */
export interface FixtureForm {
  /** The AcroForm default appearance. */
  da?: string
  /** TrueType programs embedded in the form's default resources, keyed by resource name. */
  fonts?: Record<string, Uint8Array>
  /** Ask viewers to regenerate field appearances. */
  needAppearances?: boolean
}

/** Build a one-page AcroForm PDF whose field appearance settings are controlled by the test. */
export function acroFieldsPdf(fields: FixtureField[], form: FixtureForm = {}): Uint8Array {
  const fieldObjects = fields.map((field, index) => {
    const entries = [
      `/FT /${field.type ?? 'Tx'}`,
      `/T ${literal(field.name)}`,
      '/Subtype /Widget',
      `/Rect [${field.rect.join(' ')}]`,
      '/P 3 0 R',
      field.da === undefined ? '' : `/DA ${literal(field.da)}`,
      field.q === undefined ? '' : `/Q ${field.q}`,
      field.flags === undefined ? '' : `/Ff ${field.flags}`,
      field.maxLen === undefined ? '' : `/MaxLen ${field.maxLen}`,
      field.options === undefined
        ? ''
        : `/Opt [${field.options.map((option) => Array.isArray(option)
          ? `[${literal(option[0])} ${literal(option[1])}]`
          : literal(option)).join(' ')}]`,
    ].filter(Boolean)
    return { id: index + 4, body: `<< ${entries.join(' ')} >>` }
  })
  const refs = fieldObjects.map(({ id }) => `${id} 0 R`).join(' ')
  const acroFormId = fieldObjects.length + 4
  // Each form font is three objects: the simple TrueType font, its
  // descriptor, and the embedded program.
  const fontObjects: Array<{ id: number; body: string; name?: string; stream?: Uint8Array }> = Object.entries(form.fonts ?? {}).flatMap(([name, program], index) => {
    const id = acroFormId + 1 + index * 3
    return [
      { id, name, body: `<< /Type /Font /Subtype /TrueType /BaseFont /${name} /FontDescriptor ${id + 1} 0 R /Encoding /WinAnsiEncoding >>` },
      { id: id + 1, body: `<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [0 -200 1000 800] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 /FontFile2 ${id + 2} 0 R >>` },
      { id: id + 2, body: `<< /Length ${program.length} /Length1 ${program.length} >>\nstream\n`, stream: program },
    ]
  })
  const resources = fontObjects.filter((object) => object.name).map((object) => `/${object.name} ${object.id} 0 R`).join(' ')
  return assemblePdf([
    { id: 1, body: `<< /Type /Catalog /Pages 2 0 R /AcroForm ${acroFormId} 0 R >>` },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { id: 3, body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Annots [${refs}] >>` },
    ...fieldObjects,
    {
      id: acroFormId,
      body: `<< /Fields [${refs}]${form.da === undefined ? '' : ` /DA ${literal(form.da)}`}${resources ? ` /DR << /Font << ${resources} >> >>` : ''}${form.needAppearances ? ' /NeedAppearances true' : ''} >>`,
    },
    ...fontObjects,
  ])
}

/** One AcroForm field of a purpose-built fixture. */
export type AcroFormFixtureField =
  | { kind: 'text'; name: string; value?: string }
  | { kind: 'checkbox'; name: string; onState?: string; checked?: boolean }
  | { kind: 'radio'; name: string; states: string[]; selected?: string }
  | { kind: 'choice'; name: string; options: string[]; value?: string }

export interface AcroFormFixtureOptions {
  /** Declare the file encrypted in its trailer, as a password-protected PDF does. */
  encrypted?: boolean
}

/**
 * Build a one-page AcroForm PDF with text, checkbox, radio, and dropdown
 * fields whose names and values are controlled by the test.
 */
export function acroFormPdf(fields: AcroFormFixtureField[], options: AcroFormFixtureOptions = {}): Uint8Array {
  const objects: FixtureObject[] = []
  const roots: number[] = []
  const widgets: number[] = []
  let next = 4
  let y = 270

  const rect = () => {
    const box = `[20 ${y} 200 ${y + 14}]`
    y -= 18
    return box
  }

  for (const field of fields) {
    if (field.kind === 'text') {
      const id = next++
      const value = field.value === undefined ? '' : ` /V (${field.value})`
      objects.push({ id, body: `<< /FT /Tx /T (${field.name}) /Subtype /Widget /Rect ${rect()} /P 3 0 R${value} >>` })
      roots.push(id)
      widgets.push(id)
    } else if (field.kind === 'checkbox') {
      const id = next++
      const on = field.onState ?? 'Yes'
      const state = field.checked ? on : 'Off'
      objects.push({ id, body: `<< /FT /Btn /T (${field.name}) /Subtype /Widget /Rect ${rect()} /P 3 0 R /V /${state} /AS /${state} /AP << /N << /Off null /${on} null >> >> >>` })
      roots.push(id)
      widgets.push(id)
    } else if (field.kind === 'radio') {
      const parent = next++
      const kids = field.states.map((state) => {
        const id = next++
        const current = field.selected === state ? state : 'Off'
        objects.push({ id, body: `<< /Subtype /Widget /Parent ${parent} 0 R /Rect ${rect()} /P 3 0 R /AS /${current} /AP << /N << /Off null /${state} null >> >> >>` })
        widgets.push(id)
        return id
      })
      objects.push({ id: parent, body: `<< /FT /Btn /Ff 49152 /T (${field.name}) /V /${field.selected ?? 'Off'} /Kids [${kids.map((kid) => `${kid} 0 R`).join(' ')}] >>` })
      roots.push(parent)
    } else {
      const id = next++
      const value = field.value === undefined ? '' : ` /V (${field.value})`
      const opts = field.options.map((option) => `(${option})`).join(' ')
      objects.push({ id, body: `<< /FT /Ch /Ff 131072 /T (${field.name}) /Subtype /Widget /Rect ${rect()} /P 3 0 R /Opt [${opts}]${value} >>` })
      roots.push(id)
      widgets.push(id)
    }
  }

  const acroFormId = next++
  const encryptId = next++
  const refs = (ids: number[]) => ids.map((id) => `${id} 0 R`).join(' ')
  return assemblePdf([
    { id: 1, body: `<< /Type /Catalog /Pages 2 0 R /AcroForm ${acroFormId} 0 R >>` },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { id: 3, body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Annots [${refs(widgets)}] >>` },
    ...objects,
    { id: acroFormId, body: `<< /Fields [${refs(roots)}] >>` },
    ...(options.encrypted ? [{ id: encryptId, body: '<< /Filter /Standard /V 2 /R 3 /Length 128 /P -44 >>' }] : []),
  ].sort((left, right) => left.id - right.id), options.encrypted ? ` /Encrypt ${encryptId} 0 R` : '')
}

/** One marker line for {@link markerPdf}: a planted encoding followed by an underscore placeholder. */
export interface FixtureMarker {
  signerIndex: number
  fieldType: number
  /** Baseline y in points from the bottom edge. */
  y: number
}

/**
 * Build a one-page PDF whose text layer carries signature markers. Bytes
 * 0x80-0x83 map through a ToUnicode CMap to the four marker glyphs, the way a
 * converter embeds them, so extraction reads the page as it reads real output.
 */
export function markerPdf(markers: FixtureMarker[]): Uint8Array {
  const digits = (signerIndex: number, fieldType: number): number[] => {
    const result: number[] = []
    let remaining = signerIndex
    for (let index = 0; index < 6; index += 1) {
      result.unshift(remaining % 4)
      remaining = Math.floor(remaining / 4)
    }
    return [...result, Math.floor(fieldType / 4), fieldType % 4]
  }
  const hex = (byte: number) => byte.toString(16).padStart(2, '0')
  const content = markers
    .map(({ signerIndex, fieldType, y }) => {
      const bytes = [...digits(signerIndex, fieldType).map((digit) => 0x80 + digit), ...Array(20).fill(0x5f)]
      return `BT /F1 12 Tf 72 ${y} Td <${bytes.map(hex).join('')}> Tj ET`
    })
    .join('\n')
  const cmap = [
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
    '1 begincodespacerange <00> <FF> endcodespacerange',
    '4 beginbfchar <80> <2800> <81> <2801> <82> <2802> <83> <2804> endbfchar',
    'endcmap CMapName currentdict /CMap defineresource pop end end',
  ].join('\n')
  const contentBytes = encoder.encode(content)
  const cmapBytes = encoder.encode(cmap)
  return assemblePdf([
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    {
      id: 3,
      body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    },
    { id: 4, body: `<< /Length ${contentBytes.length} >>\nstream\n`, stream: contentBytes },
    { id: 5, body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /ToUnicode 6 0 R >>' },
    { id: 6, body: `<< /Length ${cmapBytes.length} >>\nstream\n`, stream: cmapBytes },
  ])
}
