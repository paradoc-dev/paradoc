/**
 * Utility to detect if a field type is serializable
 * Shared across all renderers
 */

/**
 * Determines if a field type requires automatic serialization
 */
export function isSerializableFieldType(
  fieldType: string | undefined
): boolean {
  if (!fieldType) return false;

  return [
    "money",
    "address",
    "phone",
    "person",
    "organization",
    "party",
    "coordinate",
    "bbox",
    "duration",
    "identification",
    "attachment",
    "signature",
  ].includes(fieldType);
}
