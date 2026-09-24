import type { BinaryContent } from '@paradoc/types'
import { acroFields, type AcroWidget } from './acroform'
import { addPageResource, appendPageContent, documentPages, type PageRecord } from './page-tree'
import {
  isDict,
  isName,
  isRef,
  type PdfRef,
  PdfModel,
  type PdfValue,
} from './syntax'


const encoder = new TextEncoder()

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

/** Annotation flags a viewer honours by drawing nothing: Hidden (bit 2) and NoView (bit 6). */
const HIDDEN = 2
const NO_VIEW = 32

/** True when a viewer shows nothing for the widget, so flattening draws nothing for it either. */
function hidden(model: PdfModel, widget: AcroWidget): boolean {
  const flags = model.resolve(widget.dict.entries.get('F'))
  return typeof flags === 'number' && (flags & (HIDDEN | NO_VIEW)) !== 0
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
 * form controls. A widget a viewer does not show (Hidden or NoView) is removed
 * without being drawn. PDFs without an AcroForm are returned unchanged.
 */
export async function flattenPdf(template: BinaryContent): Promise<Uint8Array> {
  const model = await PdfModel.load(template)
  const form = acroFields(model)
  if (!form) return new Uint8Array(template)

  const pages = documentPages(model)
  let appearanceIndex = 0
  for (const field of form.fields) {
    for (const widget of field.widgets) {
      const page = widgetPage(model, pages, widget)
      if (!page) continue
      const appearance = hidden(model, widget) ? undefined : appearanceRef(model, widget)
      if (appearance) {
        const transform = placement(model, widget, appearance)
        if (transform) {
          const name = `PdrA${appearanceIndex++}`
          addPageResource(model, page, 'XObject', name, appearance)
          appendPageContent(
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
