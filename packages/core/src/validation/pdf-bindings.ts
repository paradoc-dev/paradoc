/**
 * Authoring check of a form's PDF layer bindings against the form.
 *
 * A PDF layer's `bindings` map AcroForm field names (keys) to Paradoc paths
 * (values). Rendering refuses a value it cannot parse or that names no path
 * the form declares, so `validate()` reports each one first. An inverted binding, with a field
 * name in the value position, is the common case.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import { isPdfMimeType } from '@paradoc/schemas'
import type { Form } from '@paradoc/types'
import { parseBinding, PdfBindingSyntaxError, type PdfBindingPart } from '@paradoc/render'
import { ArtifactFieldFormatError, validateFieldBindings } from '@paradoc/render/text'

function bindingProblem(form: Form, bindingKey: string, value: string): string | undefined {
  let parts: PdfBindingPart[]
  try {
    parts = parseBinding(value)
  } catch (error) {
    if (!(error instanceof PdfBindingSyntaxError)) throw error
    return error.message.replace(/\.$/, '')
  }
  for (const { source } of parts) {
    try {
      validateFieldBindings(form, { [bindingKey]: source })
    } catch (error) {
      if (!(error instanceof ArtifactFieldFormatError)) throw error
      const detail = (error.issues[0]?.message ?? error.message).replace(/\.$/, '')
      return `"${source}" is not a known Paradoc path (${detail})`
    }
  }
  return undefined
}

/**
 * Check that every value of every PDF layer's own `bindings` parses and names
 * only Paradoc paths the form declares. A layer reusing bindings through
 * `bindingsFrom` is checked where the bindings are declared.
 */
export function validatePdfBindingPaths(form: Form): StandardSchemaV1.Issue[] {
  const issues: StandardSchemaV1.Issue[] = []
  for (const [layerKey, layer] of Object.entries(form.layers ?? {})) {
    if (layer.kind !== 'file' || !isPdfMimeType(layer.mimeType) || !layer.bindings) continue
    for (const [bindingKey, value] of Object.entries(layer.bindings)) {
      const problem = bindingProblem(form, bindingKey, value)
      if (!problem) continue
      const inverted = Object.hasOwn(form.fields ?? {}, bindingKey)
        ? ` The key "${bindingKey}" is a field of this artifact: bindings map AcroForm field names (keys) to Paradoc paths (values).`
        : ''
      issues.push({ message: `Layer "${layerKey}", binding "${bindingKey}": ${problem}.${inverted}`, path: ['layers', layerKey, 'bindings', bindingKey] })
    }
  }
  return issues
}
