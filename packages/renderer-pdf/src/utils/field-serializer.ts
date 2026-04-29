/**
 * PDF renderer-specific wrapper utility for automatic serialization
 * Uses toString() override for ergonomic template syntax
 */

import type { SerializerRegistry } from "@paradoc/types";

/**
 * Wraps a field value so that when converted to string via String(value),
 * it automatically calls toString() which returns the serialized representation.
 * Also preserves access to raw properties via nested path access.
 *
 * This is the PDF renderer implementation of the field wrapping strategy.
 */
class FieldValueWrapper {
  constructor(
    private readonly rawValue: unknown,
    private readonly serializer: (value: unknown) => string
  ) {
    // Copy all properties from rawValue to this object
    // This enables nested path access while preserving the wrapper's toString()
    if (rawValue !== null && typeof rawValue === "object") {
      Object.assign(this, rawValue);
    }
  }

  toString(): string {
    return this.serializer(this.rawValue);
  }
}

/**
 * Creates a wrapper for a field value that serializes on toString()
 * This is passed as the wrapperStrategy to the generic preprocessFieldData function
 *
 * @param value - Raw field value to wrap
 * @param fieldType - Type of field (money, address, phone, etc.)
 * @param serializers - Serializer registry with stringify methods
 * @returns Wrapped value or original value if not serializable
 */
export function createSerializedFieldWrapper(
  value: unknown,
  fieldType: string,
  serializers: SerializerRegistry
): FieldValueWrapper | unknown {
  // Return null/undefined as-is
  if (value === null || value === undefined) {
    return value;
  }

  // Get the serializer for this field type
  const serializer = getSerializerForType(fieldType, serializers);
  if (!serializer) {
    return value;
  }

  return new FieldValueWrapper(value, (v) => serializer.stringify(v));
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
      default:
        return null;
    }
  })();

  // Cast to accept unknown values at runtime (serializers handle this)
  return serializer as { stringify: (value: unknown) => string } | null;
}
