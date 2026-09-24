/**
 * Authoring check of a form's PDF layer bindings against the form.
 *
 * A PDF layer's `bindings` map AcroForm field names (keys) to Paradoc paths
 * (values). Rendering refuses a value that names no path the form declares,
 * so `validate()` reports each one first. An inverted binding, with a field
 * name in the value position, is the common case.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Form } from '@paradoc/types'
import { bindingSources } from '@paradoc/render'
import { ArtifactFieldFormatError, validateFieldBindings } from '@paradoc/render/text'

const PDF_MIME_TYPE = 'application/pdf'

function unknownSource(form: Form, bindingKey: string, value: string): string | undefined {
  for (const source of bindingSources(value)) {
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
 * Check that every value of every PDF layer's own `bindings` names a Paradoc
 * path the form declares. A layer reusing bindings through `bindingsFrom` is
 * checked where the bindings are declared.
 */
export function validatePdfBindingPaths(form: Form): StandardSchemaV1.Issue[] {
  const issues: StandardSchemaV1.Issue[] = []
  for (const [layerKey, layer] of Object.entries(form.layers ?? {})) {
    if (layer.mimeType.toLowerCase() !== PDF_MIME_TYPE || !layer.bindings) continue
    for (const [bindingKey, value] of Object.entries(layer.bindings)) {
      const problem = unknownSource(form, bindingKey, value)
      if (!problem) continue
      const inverted = Object.hasOwn(form.fields ?? {}, bindingKey)
        ? ` The key "${bindingKey}" is a field of this artifact: bindings map AcroForm field names (keys) to Paradoc paths (values).`
        : ''
      issues.push({ message: `Layer "${layerKey}", binding "${bindingKey}": ${problem}.${inverted}`, path: ['layers', layerKey, 'bindings', bindingKey] })
    }
  }
  return issues
}
