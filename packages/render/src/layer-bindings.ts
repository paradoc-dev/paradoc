/** The part of a layer that decides which bindings it fills with. */
export interface LayerBindingsSpec {
  bindings?: Record<string, string>
  bindingsFrom?: string
}

/**
 * The bindings a layer fills with: its own, or else those of the sibling layer
 * its `bindingsFrom` names. The reference is one hop: the sibling's own
 * `bindings`, never its `bindingsFrom`. Only bindings carry over; a layer's
 * `format` is always its own.
 *
 * Throws when `bindingsFrom` names a layer that does not exist.
 */
export function resolveLayerBindings(
  layers: Record<string, LayerBindingsSpec>,
  layer: LayerBindingsSpec,
): Record<string, string> | undefined {
  if (layer.bindings || !layer.bindingsFrom) return layer.bindings
  const source = layers[layer.bindingsFrom]
  if (!source) {
    throw new Error(`bindingsFrom "${layer.bindingsFrom}" references unknown layer. Available: ${Object.keys(layers).join(', ')}`)
  }
  return source.bindings
}

/**
 * The Paradoc paths a binding value reads: each comma-joined part, trimmed,
 * without its `:` qualifier. `'fields.first, fields.last'` reads two paths;
 * `'ssn:3'` reads `ssn`.
 */
export function bindingSources(binding: string): string[] {
  return binding.split(',').map((part) => {
    const path = part.trim()
    const qualifier = path.indexOf(':')
    return qualifier === -1 ? path : path.slice(0, qualifier)
  })
}

/** Where a binding path sits in fill data, which holds field values at the top level: `fields.x` is `x`. */
export function bindingDataPath(path: string): string {
  const trimmed = path.trim()
  return trimmed.startsWith('fields.') ? trimmed.slice('fields.'.length) : trimmed
}
