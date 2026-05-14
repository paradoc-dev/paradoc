/**
 * DOCX renderer-specific utility for automatic serialization
 */

import type { SerializerRegistry } from "@paradoc/types";

/**
 * Creates a serialized value for DOCX templates
 * For DOCX, we convert objects to their string representation directly
 *
 * @param value - Raw field value
 * @param fieldType - Type of field (money, address, phone, etc.)
 * @param serializers - Serializer registry with stringify methods
 * @returns Serialized value or original value if not serializable
 */
export function createSerializedFieldWrapper(
  value: unknown,
  fieldType: string,
  serializers: SerializerRegistry
): string | unknown {
  // Return null/undefined as-is
  if (value === null || value === undefined) {
    return value;
  }

  // Get the serializer for this field type
  const serializer = getSerializerForType(fieldType, serializers);
  if (!serializer) {
    return value;
  }

  // For DOCX, return the serialized string directly
  return serializer.stringify(value);
}

/**
 * Gets the stringifier function for a given field type
 */
function getSerializerForType(
  fieldType: string,
  serializers: SerializerRegistry
): { stringify: (value: unknown) => string } | null {
  const serializer = (() => {
    switch (fieldType) {
      case "money":
        return serializers.money;
      case "address":
        return serializers.address;
      case "phone":
        return serializers.phone;
      case "person":
        return serializers.person;
      case "organization":
        return serializers.organization;
      case "party":
        return serializers.party;
      case "coordinate":
        return serializers.coordinate;
      case "bbox":
        return serializers.bbox;
      case "duration":
        return serializers.duration;
      case "identification":
        return serializers.identification;
      default:
        return null;
    }
  })();

  // Cast to accept unknown values at runtime (serializers handle this)
  return serializer as { stringify: (value: unknown) => string } | null;
}
