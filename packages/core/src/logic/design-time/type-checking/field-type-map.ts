/**
 * Maps Paradoc field types to their runtime value types.
 *
 * This mapping is used during type inference to determine what type
 * a field's `.value` property will have at runtime.
 */

import type { InferredType } from './inferred-types'

/**
 * Maps field type strings to their inferred runtime value types.
 *
 * - String-like fields (text, email, uuid, uri) -> 'string'
 * - Numeric fields (number) -> 'number'
 * - Boolean fields -> 'boolean'
 * - Composite fields (coordinate, money, address, phone, duration) -> their composite type
 * - Structured fields (bbox, fieldset) -> 'object'
 * - Enum fields -> 'string' (enum values are string | number, but typically string)
 */
export const FIELD_TYPE_TO_VALUE_TYPE: Record<string, InferredType> = {
  // String-valued fields
  text: 'string',
  email: 'string',
  uuid: 'string',
  uri: 'string',

  // Numeric fields
  number: 'number',

  // Boolean fields
  boolean: 'boolean',

  // Composite/structured types (field-specific)
  coordinate: 'coordinate',
  money: 'money',
  address: 'address',
  phone: 'phone',
  duration: 'duration',
  date: 'date',

  // Object types
  bbox: 'object',
  fieldset: 'object',

  // Enum is typically string-valued (could be number, but string is more common)
  enum: 'string',
}

/**
 * Gets the inferred value type for a field type.
 *
 * @param fieldType - The field's type property (e.g., 'text', 'number', 'boolean')
 * @returns The inferred type, or 'unknown' if the field type is not recognized
 */
export function getFieldValueType(fieldType: string): InferredType {
  return FIELD_TYPE_TO_VALUE_TYPE[fieldType] ?? 'unknown'
}
