/**
 * Authoring check that a form's PDF layers can be filled.
 *
 * Filling misses a binding whose key is not an AcroForm field of the template,
 * and fails when a value cannot fit its PDF text field at the minimum font
 * size, or has more characters than a comb field has boxes. `validateLayers()`
 * runs these checks on each file-backed PDF layer of a form, so an artifact
 * whose declarations allow such a value is reported before any data is filled.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { FileLayer, Form, Resolver } from '@paradoc/types'
import { resolveLayerBindings } from '@paradoc/render'
import { checkPdfBindingFit, inspectAcroFormFields, type PdfBindingFitIssue } from '@paradoc/render/pdf'

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
 * Each binding key that names no AcroForm field of the layer's template. A key
 * the layer reuses through `bindingsFrom` is reported at its `bindingsFrom`.
 */
async function unknownBindingKeys(layerKey: string, layer: FileLayer, template: Uint8Array, bindings: Record<string, string>): Promise<LayerValidationIssue[]> {
  const names = (await inspectAcroFormFields(template, { includeButton: true, includeSignature: true })).map((field) => field.name)
  const known = new Set(names)
  const available = names.length > 0 ? `Its fields are: ${names.join(', ')}.` : 'It has no AcroForm fields.'
  const reused = layer.bindings ? undefined : layer.bindingsFrom
  return Object.keys(bindings).filter((bindingKey) => !known.has(bindingKey)).map((bindingKey) => ({
    message: `Layer "${layerKey}", binding "${bindingKey}"${reused ? ` (from layer "${reused}")` : ''}: "${bindingKey}" is not an AcroForm field in "${layer.path}". ${available}`,
    path: reused ? ['layers', layerKey, 'bindingsFrom'] : ['layers', layerKey, 'bindings', bindingKey],
    severity: 'error',
  }))
}

/**
 * Check every file-backed PDF layer of a form: each binding key must name an
 * AcroForm field of the template, and each binding to a text field must fit
 * its box for every value the bound field accepts. An unknown key and a value
 * that cannot fit are errors; a text field with no length bound is a warning.
 * A template that cannot be read is skipped: `validateFileReferences` reports it.
 */
export async function validatePdfLayers(form: Form, resolver: Resolver): Promise<LayerValidationIssue[]> {
  const layers = form.layers ?? {}
  const issues: LayerValidationIssue[] = []
  for (const [key, layer] of Object.entries(layers)) {
    if (layer.kind !== 'file' || layer.mimeType.toLowerCase() !== PDF_MIME_TYPE) continue
    const fileLayer = layer as FileLayer
    const { font } = fileLayer
    let template: Uint8Array
    try {
      template = await resolver.read(fileLayer.path)
    } catch {
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
      const bindings = resolveLayerBindings(layers, layer)
      if (bindings) issues.push(...await unknownBindingKeys(key, fileLayer, template, bindings))
      const found = await checkPdfBindingFit({ template, form, bindings, ...(layerFont && { layerFont }) })
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
