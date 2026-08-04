import { isDict, isName, isRef, type PdfDict, type PdfRef, PdfModel, type PdfValue } from './syntax'

export type AcroFieldType = 'text' | 'checkbox' | 'choice' | 'radio' | 'button' | 'signature' | 'unknown'

export interface AcroWidget {
  ref?: PdfRef
  dict: PdfDict
}

export interface AcroField {
  ref?: PdfRef
  dict: PdfDict
  name: string
  type: AcroFieldType
  flags: number
  widgets: AcroWidget[]
}

function stringValue(value: PdfValue | undefined): string | undefined {
  if (typeof value === 'string') return value
  return isName(value) ? value.value : undefined
}

function fieldType(value: string | undefined, flags: number): AcroFieldType {
  if (value === 'Tx') return 'text'
  if (value === 'Ch') return 'choice'
  if (value === 'Sig') return 'signature'
  if (value !== 'Btn') return 'unknown'
  if ((flags & (1 << 16)) !== 0) return 'button'
  if ((flags & (1 << 15)) !== 0) return 'radio'
  return 'checkbox'
}

function widget(model: PdfModel, value: PdfValue): AcroWidget | undefined {
  const dict = model.dict(value)
  if (!dict) return undefined
  const subtype = dict.entries.get('Subtype')
  if (!isName(subtype) || subtype.value !== 'Widget') return undefined
  return { ref: isRef(value) ? value : undefined, dict }
}

export function acroFields(model: PdfModel): { fields: AcroField[]; acroForm: PdfDict; acroRef?: PdfRef; catalogRef?: PdfRef } {
  const catalogRecord = [...model.objects.values()].find((record) => {
    if (!isDict(record.value)) return false
    const type = record.value.entries.get('Type')
    return isName(type) && type.value === 'Catalog'
  })
  if (!catalogRecord || !isDict(catalogRecord.value)) throw new Error('PDF catalog not found')
  const acroValue = catalogRecord.value.entries.get('AcroForm')
  const acroForm = model.dict(acroValue)
  if (!acroForm) throw new Error('PDF does not contain an AcroForm')
  const roots = model.resolve(acroForm.entries.get('Fields'))
  const fields: AcroField[] = []

  const visit = (
    value: PdfValue,
    inherited: { name?: string; fieldType?: string; flags?: number } = {},
  ) => {
    const dict = model.dict(value)
    if (!dict) return
    const ownName = stringValue(dict.entries.get('T'))
    const name = ownName ? inherited.name ? `${inherited.name}.${ownName}` : ownName : inherited.name
    const typeName = stringValue(dict.entries.get('FT')) ?? inherited.fieldType
    const flags = typeof dict.entries.get('Ff') === 'number' ? dict.entries.get('Ff') as number : inherited.flags ?? 0
    const kids = model.resolve(dict.entries.get('Kids'))
    const widgets = Array.isArray(kids)
      ? kids.map((child) => widget(model, child)).filter((item): item is AcroWidget => item !== undefined)
      : []
    const childFields = Array.isArray(kids)
      ? kids.filter((child) => widget(model, child) === undefined)
      : []
    if (childFields.length > 0) {
      childFields.forEach((child) => visit(child, { name, fieldType: typeName, flags }))
      return
    }
    if (!name) return
    const self = widget(model, value)
    fields.push({
      ref: isRef(value) ? value : undefined,
      dict,
      name,
      type: fieldType(typeName, flags),
      flags,
      widgets: self ? [self] : widgets,
    })
  }

  if (Array.isArray(roots)) roots.forEach((field) => visit(field))
  return {
    fields,
    acroForm,
    acroRef: isRef(acroValue) ? acroValue : undefined,
    catalogRef: { kind: 'ref', object: catalogRecord.object, generation: catalogRecord.generation },
  }
}

function onState(model: PdfModel, widget: AcroWidget): string {
  const appearance = model.dict(widget.dict.entries.get('AP'))
  const normal = model.dict(appearance?.entries.get('N'))
  return [...(normal?.entries.keys() ?? [])].find((name) => name !== 'Off') ?? 'Yes'
}

function updateWidgetState(model: PdfModel, widget: AcroWidget, state: string): void {
  widget.dict.entries.set('AS', { kind: 'name', value: state })
  if (widget.ref) model.markUpdated(widget.ref)
}

const fontRefs = new WeakMap<PdfModel, PdfRef>()

function standardFont(model: PdfModel): PdfRef {
  const existing = fontRefs.get(model)
  if (existing) return existing
  const ref = model.addObject({
    kind: 'dict',
    entries: new Map<string, PdfValue>([
      ['Type', { kind: 'name', value: 'Font' }],
      ['Subtype', { kind: 'name', value: 'Type1' }],
      ['BaseFont', { kind: 'name', value: 'Helvetica' }],
      ['Encoding', { kind: 'name', value: 'WinAnsiEncoding' }],
    ]),
  })
  fontRefs.set(model, ref)
  return ref
}

function contentString(value: string): string {
  return value.replace(/([\\()])/g, '\\$1').replace(/[\r\n]+/g, ' ')
}

function textAppearance(model: PdfModel, widget: AcroWidget, text: string): void {
  const rawRect = model.resolve(widget.dict.entries.get('Rect'))
  if (!Array.isArray(rawRect) || rawRect.length !== 4 || !rawRect.every((item) => typeof item === 'number')) return
  const [x1, y1, x2, y2] = rawRect as number[]
  const width = Math.max(1, x2! - x1!)
  const height = Math.max(1, y2! - y1!)
  const fontSize = Math.max(6, Math.min(12, height - 4))
  const baseline = Math.max(2, (height - fontSize) / 2 + 1)
  const stream = new TextEncoder().encode(
    `q\n0 0 ${width} ${height} re W n\nBT\n/Helv ${fontSize} Tf\n0 g\n2 ${baseline} Td\n(${contentString(text)}) Tj\nET\nQ`,
  )
  const appearance = model.addObject({
    kind: 'dict',
    entries: new Map<string, PdfValue>([
      ['Type', { kind: 'name', value: 'XObject' }],
      ['Subtype', { kind: 'name', value: 'Form' }],
      ['FormType', 1],
      ['BBox', [0, 0, width, height]],
      ['Resources', {
        kind: 'dict',
        entries: new Map<string, PdfValue>([
          ['Font', {
            kind: 'dict',
            entries: new Map<string, PdfValue>([['Helv', standardFont(model)]]),
          }],
        ]),
      }],
    ]),
  }, stream)
  widget.dict.entries.set('AP', {
    kind: 'dict',
    entries: new Map<string, PdfValue>([['N', appearance]]),
  })
  if (widget.ref) model.markUpdated(widget.ref)
}

export function setAcroFieldValue(model: PdfModel, field: AcroField, value: unknown): void {
  if (field.type === 'text' || field.type === 'choice') {
    const text = String(value)
    field.dict.entries.set('V', text)
    field.widgets.forEach((widget) => textAppearance(model, widget, text))
  } else if (field.type === 'checkbox') {
    const checked = Boolean(value)
    const state = checked ? onState(model, field.widgets[0] ?? { dict: field.dict }) : 'Off'
    field.dict.entries.set('V', { kind: 'name', value: state })
    field.widgets.forEach((item) => updateWidgetState(model, item, checked ? onState(model, item) : 'Off'))
  } else if (field.type === 'radio') {
    const selected = String(value)
    field.dict.entries.set('V', { kind: 'name', value: selected })
    field.widgets.forEach((item) => updateWidgetState(model, item, onState(model, item) === selected ? selected : 'Off'))
  } else return
  if (field.ref) model.markUpdated(field.ref)
}
