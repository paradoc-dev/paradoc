/**
 * Deep Clone Utility
 *
 * Provides a consistent deep cloning function across the codebase.
 * Uses structuredClone when available (Node 17+, modern browsers),
 * falls back to JSON parse/stringify for older environments.
 */

/**
 * Creates a deep clone of a value.
 *
 * Uses `structuredClone` when available for better performance and
 * proper handling of more types (Date, RegExp, Map, Set, etc.).
 * Falls back to JSON serialization for older environments.
 *
 * @param value - The value to clone
 * @returns A deep clone of the value
 *
 * @example
 * ```typescript
 * const original = { name: 'John', address: { city: 'NYC' } }
 * const cloned = deepClone(original)
 * cloned.address.city = 'LA'
 * // original.address.city is still 'NYC'
 * ```
 *
 * @remarks
 * The JSON fallback has limitations:
 * - Loses non-JSON types (Date becomes string, undefined is dropped)
 * - Fails on circular references
 * - Functions are not cloned
 *
 * For Paradoc's use cases (cloning form data, schema objects),
 * these limitations are acceptable as the data is JSON-compatible.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

/**
 * Deeply freezes a value without attempting to freeze typed-array views.
 *
 * Typed arrays are used for binary document content and cannot be frozen when
 * they contain elements. They are safe here because callers use this helper
 * on a detached deep clone, so mutating a returned byte view cannot mutate the
 * runtime's internal value.
 */
export function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>()

  const freeze = (current: unknown): void => {
    if (current === null || typeof current !== 'object') return
    if (seen.has(current)) return
    seen.add(current)

    if (ArrayBuffer.isView(current) || current instanceof ArrayBuffer) return

    if (current instanceof Map) {
      for (const [key, entry] of current) {
        freeze(key)
        freeze(entry)
      }
    } else if (current instanceof Set) {
      for (const entry of current) freeze(entry)
    } else {
      for (const key of Reflect.ownKeys(current)) {
        const descriptor = Object.getOwnPropertyDescriptor(current, key)
        if (descriptor && 'value' in descriptor) freeze(descriptor.value)
      }
    }

    Object.freeze(current)
  }

  freeze(value)
  return value
}

/**
 * Creates an immutable detached view of a runtime value.
 *
 * The clone makes the view safe for mutable binary values and collection
 * implementations where Object.freeze cannot prevent every mutator. The
 * freeze protects ordinary nested records and arrays from accidental writes.
 */
export function deepReadonlyClone<T>(value: T): T {
  return deepFreeze(deepClone(value))
}
