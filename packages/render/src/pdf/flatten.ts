import type { BinaryContent } from '@paradoc/types'
import { acroFields, type AcroWidget } from './acroform'
import {
  isDict,
  isName,
  isRef,
  type PdfDict,
  type PdfObject,
  type PdfRef,
  PdfModel,
  type PdfValue,
} from './syntax'

interface PageRecord {
  record: PdfObject
  inheritedResources?: PdfValue
}

const encoder = new TextEncoder()

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

function cloneDict(dict: PdfDict | undefined): PdfDict {
  return { kind: 'dict', entries: new Map(dict?.entries) }
}

function appearanceRef(model: PdfModel, widget: AcroWidget): PdfRef | undefined {
  const appearance = model.dict(widget.dict.entries.get('AP'))
  const normal = appearance?.entries.get('N')
  if (isRef(normal) && model.record(normal)?.stream) return normal
  const states = model.dict(normal)
  if (!states) return undefined
  const state = widget.dict.entries.get('AS')
  const selected = isName(state) ? state.value : 'Off'
  const candidate = states.entries.get(selected) ?? states.entries.get('Off')
  return isRef(candidate) && model.record(candidate)?.stream ? candidate : undefined
}

function widgetPage(model: PdfModel, pages: PageRecord[], widget: AcroWidget): PageRecord | undefined {
  const page = widget.dict.entries.get('P')
  if (isRef(page)) return pages.find(({ record }) => record.object === page.object)
  if (!widget.ref) return undefined
  return pages.find(({ record }) => {
    if (!isDict(record.value)) return false
    const annotations = model.resolve(record.value.entries.get('Annots'))
    return Array.isArray(annotations)
      && annotations.some((annotation) => isRef(annotation) && annotation.object === widget.ref!.object)
  })
}

function addAppearanceResource(
  model: PdfModel,
  page: PageRecord,
  name: string,
  appearance: PdfRef,
): void {
  if (!isDict(page.record.value)) return
  const resources = cloneDict(model.dict(page.record.value.entries.get('Resources') ?? page.inheritedResources))
  const xObjects = cloneDict(model.dict(resources.entries.get('XObject')))
  xObjects.entries.set(name, appearance)
  resources.entries.set('XObject', xObjects)
  page.record.value.entries.set('Resources', resources)
  model.markUpdated(page.record)
}

function appendContent(model: PdfModel, page: PageRecord, stream: PdfRef): void {
  if (!isDict(page.record.value)) return
  const current = page.record.value.entries.get('Contents')
  const resolved = model.resolve(current)
  if (Array.isArray(resolved)) page.record.value.entries.set('Contents', [...resolved, stream])
  else if (current === undefined) page.record.value.entries.set('Contents', stream)
  else page.record.value.entries.set('Contents', [current, stream])
  model.markUpdated(page.record)
}

function removeWidgetAnnotation(model: PdfModel, page: PageRecord, widget: AcroWidget): void {
  if (!widget.ref || !isDict(page.record.value)) return
  const annotationsValue = page.record.value.entries.get('Annots')
  const annotations = model.resolve(annotationsValue)
  if (!Array.isArray(annotations)) return
  const filtered = annotations.filter(
    (annotation) => !isRef(annotation) || annotation.object !== widget.ref!.object,
  )
  if (filtered.length === annotations.length) return
  if (isRef(annotationsValue)) {
    const record = model.record(annotationsValue)
    if (record) {
      record.value = filtered
      model.markUpdated(record)
    }
  } else {
    page.record.value.entries.set('Annots', filtered)
    model.markUpdated(page.record)
  }
}

function placement(model: PdfModel, widget: AcroWidget, appearance: PdfRef): string | undefined {
  const rectangle = model.resolve(widget.dict.entries.get('Rect'))
  const appearanceDict = model.dict(appearance)
  const box = model.resolve(appearanceDict?.entries.get('BBox'))
  if (
    !Array.isArray(rectangle)
    || rectangle.length !== 4
    || !rectangle.every((value) => typeof value === 'number')
    || !Array.isArray(box)
    || box.length !== 4
    || !box.every((value) => typeof value === 'number')
  ) return undefined
  const [left, bottom, right, top] = rectangle as number[]
  const [boxLeft, boxBottom, boxRight, boxTop] = box as number[]
  const boxWidth = boxRight! - boxLeft!
  const boxHeight = boxTop! - boxBottom!
  if (boxWidth === 0 || boxHeight === 0) return undefined
  const scaleX = (right! - left!) / boxWidth
  const scaleY = (top! - bottom!) / boxHeight
  const translateX = left! - boxLeft! * scaleX
  const translateY = bottom! - boxBottom! * scaleY
  return `${scaleX} 0 0 ${scaleY} ${translateX} ${translateY} cm`
}

/**
 * Burn AcroForm widget appearances into their pages and remove the interactive
 * form controls. PDFs without an AcroForm are returned unchanged.
 */
export async function flattenPdf(template: BinaryContent): Promise<Uint8Array> {
  const model = await PdfModel.load(template)
  let form: ReturnType<typeof acroFields>
  try {
    form = acroFields(model)
  } catch (error) {
    if (error instanceof Error && error.message === 'PDF does not contain an AcroForm') {
      return new Uint8Array(template)
    }
    throw error
  }

  const pages = pageRecords(model)
  let appearanceIndex = 0
  for (const field of form.fields) {
    for (const widget of field.widgets) {
      const page = widgetPage(model, pages, widget)
      if (!page) continue
      const appearance = appearanceRef(model, widget)
      if (appearance) {
        const transform = placement(model, widget, appearance)
        if (transform) {
          const name = `PdrA${appearanceIndex++}`
          addAppearanceResource(model, page, name, appearance)
          appendContent(
            model,
            page,
            model.addObject(
              { kind: 'dict', entries: new Map<string, PdfValue>() },
              encoder.encode(`q\n${transform}\n/${name} Do\nQ`),
            ),
          )
        }
      }
      removeWidgetAnnotation(model, page, widget)
    }
  }

  const catalog = form.catalogRef ? model.record(form.catalogRef) : undefined
  if (catalog && isDict(catalog.value)) {
    catalog.value.entries.delete('AcroForm')
    model.markUpdated(catalog)
  }
  return model.save()
}
