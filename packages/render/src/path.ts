const blockedSegments = new Set(['__proto__', 'prototype', 'constructor'])

/** Parse Paradoc paths with object dots and zero-based list brackets. */
export function pathSegments(path: string): string[] {
  const normalized = path.replace(/\[(\d+)\]/g, '.$1')
  if (normalized.includes('[') || normalized.includes(']')) return []
  return normalized.split('.').filter(Boolean)
}

export function getPath(value: unknown, path: string): unknown {
  const segments = pathSegments(path)
  if (segments.length === 0) return undefined
  let current = value
  for (const segment of segments) {
    if (blockedSegments.has(segment) || current === null || current === undefined) return undefined
    if (typeof current !== 'object' && typeof current !== 'function') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}
