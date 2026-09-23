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
