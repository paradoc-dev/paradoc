/**
 * Authoring check that bound values can fill a form's PDF layers.
 *
 * Filling fails when a value cannot fit its PDF text field at the minimum font
 * size, or has more characters than a comb field has boxes. `validateLayers()`
 * runs this check on each file-backed PDF layer of a form, so an artifact whose
 * declarations allow such a value is reported before any data is filled.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { FileLayer, Form, Resolver } from '@paradoc/types'
import { resolveLayerBindings } from '@paradoc/render'
import { checkPdfBindingFit, type PdfBindingFitIssue } from '@paradoc/render/pdf'

/** A validation issue with the severity the validation model gives it. */
export interface LayerValidationIssue extends StandardSchemaV1.Issue {
  readonly severity: 'error' | 'warning'
}

const PDF_MIME_TYPE = 'application/pdf'

function issueFor(key: string, issue: PdfBindingFitIssue): LayerValidationIssue {
  return {
    message: `Layer "${key}", PDF field "${issue.field}" (bound to ${issue.paths.join(', ')}): ${issue.message}`,
    path: ['layers', key, 'bindings', issue.field],
    severity: issue.severity,
  }
}

function readFailure(key: string, what: string, path: string, error: unknown): LayerValidationIssue {
  return {
    message: `Layer "${key}" ${what} could not be read from "${path}": ${error instanceof Error ? error.message : String(error)}`,
    path: ['layers', key],
    severity: 'error',
  }
}

/**
 * Check every file-backed PDF layer of a form: each binding to a text field
 * must fit its box for every value the bound field accepts. Values that cannot
 * fit are errors; a text field with no length bound is a warning.
 */
export async function validatePdfBindingFit(form: Form, resolver: Resolver): Promise<LayerValidationIssue[]> {
  const layers = form.layers ?? {}
  const issues: LayerValidationIssue[] = []
  for (const [key, layer] of Object.entries(layers)) {
    if (layer.kind !== 'file' || layer.mimeType.toLowerCase() !== PDF_MIME_TYPE) continue
    const { path, font } = layer as FileLayer
    let template: Uint8Array
    try {
      template = await resolver.read(path)
    } catch (error) {
      issues.push(readFailure(key, 'PDF', path, error))
      continue
    }
    let layerFont: { bytes: Uint8Array; source: string } | undefined
    if (font) {
      try {
        layerFont = { bytes: await resolver.read(font.path), source: font.path }
      } catch (error) {
        issues.push(readFailure(key, 'font', font.path, error))
        continue
      }
    }
    try {
      const found = await checkPdfBindingFit({ template, form, bindings: resolveLayerBindings(layers, layer), ...(layerFont && { layerFont }) })
      issues.push(...found.map((issue) => issueFor(key, issue)))
    } catch (error) {
      issues.push({
        message: `Layer "${key}" could not be checked: ${error instanceof Error ? error.message : String(error)}`,
        path: ['layers', key],
        severity: 'error',
      })
    }
  }
  return issues
}
