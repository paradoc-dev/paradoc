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
