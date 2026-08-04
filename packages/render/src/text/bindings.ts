import type { Bindings } from '@paradoc/types'

function getPath(value: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, value)
}

export function applyBindings(data: Record<string, unknown>, bindings: Bindings): Record<string, unknown> {
  const result = { ...data }
  for (const [templateKey, sourcePath] of Object.entries(bindings)) {
    result[templateKey] = getPath(data, sourcePath)
  }
  return result
}
