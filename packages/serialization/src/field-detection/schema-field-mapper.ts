/**
 * Utility for mapping field names to their types from a form schema
 * Shared across all renderers (text, docx, pdf, etc.)
 */

import type { Form, FormField } from "@paradoc/types";

/**
 * Represents the mapping of field names to their types
 */
export type FieldTypeMap = Record<string, string>;

/**
 * Extracts all field types from a form schema and returns a map of fieldName -> fieldType
 * Handles nested fieldsets by flattening them with dot notation (e.g., "address.line1" -> "text")
 */
export function buildFieldTypeMap(schema: Form): FieldTypeMap {
  const fieldMap: FieldTypeMap = {};

  if (!schema.fields) {
    return fieldMap;
  }

  for (const [fieldName, field] of Object.entries(schema.fields)) {
    if (!field) continue;

    const fieldType = (field as FormField & { type: string }).type;

    // Map the field itself
    fieldMap[fieldName] = fieldType;

    // If this is a fieldset or similar composite field, also map nested fields
    if (isCompositeField(field)) {
      const compositeField = field as FormField & { fields?: Record<string, FormField> };
      if (compositeField.fields) {
        for (const [nestedName, nestedField] of Object.entries(compositeField.fields)) {
          if (!nestedField) continue;
          const nestedType = (nestedField as FormField & { type: string }).type;
          const fullPath = `${fieldName}.${nestedName}`;
          fieldMap[fullPath] = nestedType;
        }
      }
    }
  }

  return fieldMap;
}

/**
 * Gets the field type for a specific field name from the schema
 */
export function getFieldType(
  schema: Form,
  fieldName: string
): string | undefined {
  const fieldMap = buildFieldTypeMap(schema);
  return fieldMap[fieldName];
}

/**
 * Checks if a field is a composite field that can contain nested fields
 */
function isCompositeField(field: unknown): boolean {
  if (!field || typeof field !== "object") return false;
  const f = field as Record<string, unknown>;
  // Check if field has a fields property (indicates composite field)
  return !!f.fields && typeof f.fields === "object";
}
