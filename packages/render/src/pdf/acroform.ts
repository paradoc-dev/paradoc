import type { PdfFontSet } from './drawing-fonts'
import { layoutFieldText, parseDefaultAppearance } from './field-appearance'
import { catalogRecord } from './page-tree'
import { isDict, isName, isRef, type PdfDict, type PdfRef, PdfModel, type PdfValue } from './syntax'

/** What kind of control an AcroForm field is, read from its `/FT` and `/Ff`. */
export type PdfFieldType = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'button' | 'signature' | 'unknown'

export interface AcroWidget {
  ref?: PdfRef
  dict: PdfDict
}

export interface AcroField {
  ref?: PdfRef
  dict: PdfDict
  name: string
  type: PdfFieldType
  flags: number
  widgets: AcroWidget[]
  /** Default appearance (`/DA`), inherited from ancestors or the AcroForm. */
  defaultAppearance?: string
  /** Quadding (`/Q`): 0 left, 1 centered, 2 right. */
  alignment: number
  /** Maximum length (`/MaxLen`), the box count of a comb field. */
  maxLength?: number
}

/** Field flag bits (PDF 32000-1, tables 226, 228, and 230). */
const MULTILINE = 1 << 12
const COMBO = 1 << 17
const MULTI_SELECT = 1 << 21
const COMB = 1 << 24

function stringValue(value: PdfValue | undefined): string | undefined {
  if (typeof value === 'string') return value
  return isName(value) ? value.value : undefined
}

/**
 * Classify a field from its (inherited) field type and flags: a `/Ch` field is
 * a dropdown, and a `/Btn` field is a push button, a radio group, or a checkbox
 * by its flag bits.
 */
export function classifyField(value: string | undefined, flags: number): PdfFieldType {
  if (value === 'Tx') return 'text'
  if (value === 'Ch') return 'dropdown'
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

/**
 * Whether an entry of a field's `/Kids` is a child field rather than one of
 * the field's own widget annotations. A kid that is not a widget, or that
 * carries its own name, type, or kids, is a field in its own right.
 */
export function isChildField(model: PdfModel, kid: PdfValue): boolean {
  const dict = model.dict(kid)
  return widget(model, kid) === undefined
    || dict?.entries.has('T') === true
    || dict?.entries.has('FT') === true
    || dict?.entries.has('Kids') === true
}

export function acroFields(model: PdfModel): { fields: AcroField[]; acroForm: PdfDict; acroRef?: PdfRef; catalogRef?: PdfRef } {
  const catalog = catalogRecord(model)
  if (!catalog || !isDict(catalog.value)) throw new Error('PDF catalog not found')
  const acroValue = catalog.value.entries.get('AcroForm')
  const acroForm = model.dict(acroValue)
  if (!acroForm) throw new Error('PDF does not contain an AcroForm')
  const roots = model.resolve(acroForm.entries.get('Fields'))
  const fields: AcroField[] = []

  const formAppearance = model.resolve(acroForm.entries.get('DA'))
  const formAlignment = model.resolve(acroForm.entries.get('Q'))

  interface Inherited {
    name?: string
    fieldType?: string
    flags?: number
    defaultAppearance?: string
    alignment?: number
    maxLength?: number
  }

  const visit = (value: PdfValue, inherited: Inherited = {}) => {
    const dict = model.dict(value)
    if (!dict) return
    const ownName = stringValue(dict.entries.get('T'))
    const name = ownName ? inherited.name ? `${inherited.name}.${ownName}` : ownName : inherited.name
    const typeName = stringValue(dict.entries.get('FT')) ?? inherited.fieldType
    const flags = typeof dict.entries.get('Ff') === 'number' ? dict.entries.get('Ff') as number : inherited.flags ?? 0
    const ownAppearance = model.resolve(dict.entries.get('DA'))
    const ownAlignment = model.resolve(dict.entries.get('Q'))
    const ownMaxLength = model.resolve(dict.entries.get('MaxLen'))
    const settings: Inherited = {
      name,
      fieldType: typeName,
      flags,
      defaultAppearance: typeof ownAppearance === 'string' ? ownAppearance : inherited.defaultAppearance,
      alignment: typeof ownAlignment === 'number' ? ownAlignment : inherited.alignment,
      maxLength: typeof ownMaxLength === 'number' ? ownMaxLength : inherited.maxLength,
    }
    const kids = model.resolve(dict.entries.get('Kids'))
    const widgets = Array.isArray(kids)
      ? kids.filter((child) => !isChildField(model, child)).map((child) => widget(model, child)).filter((item): item is AcroWidget => item !== undefined)
      : []
    const childFields = Array.isArray(kids)
      ? kids.filter((child) => isChildField(model, child))
      : []
    if (childFields.length > 0) {
      childFields.forEach((child) => visit(child, settings))
      return
    }
    if (!name) return
    const self = widget(model, value)
    fields.push({
      ref: isRef(value) ? value : undefined,
      dict,
      name,
      type: classifyField(typeName, flags),
      flags,
      widgets: self ? [self] : widgets,
      defaultAppearance: settings.defaultAppearance ?? (typeof formAppearance === 'string' ? formAppearance : undefined),
      alignment: settings.alignment ?? (typeof formAlignment === 'number' ? formAlignment : 0),
      maxLength: settings.maxLength,
    })
  }

  if (Array.isArray(roots)) roots.forEach((field) => visit(field))
  return {
    fields,
    acroForm,
    acroRef: isRef(acroValue) ? acroValue : undefined,
    catalogRef: { kind: 'ref', object: catalog.object, generation: catalog.generation },
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

interface DrawnValue {
  text: string
  multiline: boolean
  comb?: number
}

function textAppearance(model: PdfModel, fonts: PdfFontSet, field: AcroField, widget: AcroWidget, value: DrawnValue): void {
  const rawRect = model.resolve(widget.dict.entries.get('Rect'))
  if (!Array.isArray(rawRect) || rawRect.length !== 4 || !rawRect.every((item) => typeof item === 'number')) return
  const [x1, y1, x2, y2] = rawRect as number[]
  const width = Math.max(1, Math.abs(x2! - x1!))
  const height = Math.max(1, Math.abs(y2! - y1!))
  const widgetAppearance = model.resolve(widget.dict.entries.get('DA'))
  const widgetAlignment = model.resolve(widget.dict.entries.get('Q'))
  const appearance = parseDefaultAppearance(typeof widgetAppearance === 'string' ? widgetAppearance : field.defaultAppearance)
  const font = fonts.select(field.name, value.text, appearance.fontName)
  const text = layoutFieldText(
    {
      field: field.name,
      width,
      height,
      appearance,
      alignment: typeof widgetAlignment === 'number' ? widgetAlignment : field.alignment,
      comb: value.comb,
      multiline: value.multiline,
    },
    value.text,
    font,
  )
  const stream = new TextEncoder().encode(
    `/Tx BMC\nq\n0 0 ${width} ${height} re W n\nBT\n${appearance.color}\n${text}\nET\nQ\nEMC`,
  )
  const appearanceRef = model.addObject({
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
            entries: new Map<string, PdfValue>([[font.resourceName, font.reference()]]),
          }],
        ]),
      }],
    ]),
  }, stream)
  widget.dict.entries.set('AP', {
    kind: 'dict',
    entries: new Map<string, PdfValue>([['N', appearanceRef]]),
  })
  if (widget.ref) model.markUpdated(widget.ref)
}

/** Each option's export value and the text a viewer displays for it. */
function choiceOptions(model: PdfModel, field: AcroField): Array<{ value: string; display: string }> {
  const options = model.resolve(field.dict.entries.get('Opt'))
  if (!Array.isArray(options)) return []
  return options.flatMap((option) => {
    const resolved = model.resolve(option)
    if (typeof resolved === 'string') return [{ value: resolved, display: resolved }]
    if (Array.isArray(resolved)) {
      const [exported, display] = resolved.map((item) => model.resolve(item))
      if (typeof exported === 'string') return [{ value: exported, display: typeof display === 'string' ? display : exported }]
    }
    return []
  })
}

function setChoiceValue(model: PdfModel, fonts: PdfFontSet, field: AcroField, value: unknown): void {
  const multiSelect = (field.flags & MULTI_SELECT) !== 0
  const selected = multiSelect && Array.isArray(value) ? value.map(String) : [String(value)]
  const options = choiceOptions(model, field)
  field.dict.entries.set('V', multiSelect && selected.length !== 1 ? selected : selected[0] ?? '')
  const indices = selected.map((item) => options.findIndex((option) => option.value === item))
  if (indices.length > 0 && indices.every((index) => index >= 0)) {
    field.dict.entries.set('I', [...new Set(indices)].sort((left, right) => left - right))
  } else field.dict.entries.delete('I')
  const shown = selected.map((item) => options.find((option) => option.value === item)?.display ?? item)
  const listBox = (field.flags & COMBO) === 0
  field.widgets.forEach((widget) => textAppearance(model, fonts, field, widget, {
    text: listBox ? shown.join('\n') : shown.join(', '),
    multiline: listBox,
  }))
}

function setTextValue(model: PdfModel, fonts: PdfFontSet, field: AcroField, value: unknown): void {
  const text = String(value)
  const multiline = (field.flags & MULTILINE) !== 0
  const comb = (field.flags & COMB) !== 0 && !multiline && field.maxLength !== undefined && field.maxLength > 0
    ? field.maxLength
    : undefined
  field.dict.entries.set('V', text)
  field.widgets.forEach((widget) => textAppearance(model, fonts, field, widget, { text, multiline, comb }))
}

export function setAcroFieldValue(model: PdfModel, fonts: PdfFontSet, field: AcroField, value: unknown): void {
  if (field.type === 'text') setTextValue(model, fonts, field, value)
  else if (field.type === 'dropdown') setChoiceValue(model, fonts, field, value)
  else if (field.type === 'checkbox') {
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
