/**
 * Generic field data preprocessing utility using strategy pattern
 * All renderers use this function with their own wrapping strategy
 */

import type { Form, FormField } from "@paradoc/types";
import { isSerializableFieldType } from "./field-detector";

function preprocessValue(
  value: unknown,
  field: FormField,
  wrapperStrategy: (value: unknown, fieldType: string) => unknown,
): unknown {
  if (field.type === 'list') {
    return Array.isArray(value)
      ? value.map((item) => preprocessValue(item, field.item, wrapperStrategy))
      : value;
  }

  if (field.type === 'fieldset') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.entries(record).map(([key, nestedValue]) => {
      const nestedField = field.fields[key];
      return [key, nestedField ? preprocessValue(nestedValue, nestedField, wrapperStrategy) : nestedValue];
    }));
  }

  return isSerializableFieldType(field.type)
    ? wrapperStrategy(value, field.type)
    : value;
}

/**
 * Preprocesses render data by applying a custom wrapping strategy to serializable fields.
 * This enables renderers to implement their own wrapping behavior while reusing field detection.
 *
 * Strategy pattern: Each format implementation passes its own wrapper function
 * for text templates, DOCX bindings, or PDF AcroForm bindings.
 *
 * @param data - Raw render data
 * @param schema - Form schema containing field type definitions
 * @param wrapperStrategy - Function that wraps a value for serialization (renderer-specific)
 * @returns Preprocessed data with serializable fields wrapped
 */
export function preprocessFieldData(
  data: Record<string, unknown>,
  schema: Form,
  wrapperStrategy: (value: unknown, fieldType: string) => unknown
): Record<string, unknown> {
  if (!data || !schema || !schema.fields) {
    return data;
  }

  const processedData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const field = schema.fields[key];
    processedData[key] = field ? preprocessValue(value, field, wrapperStrategy) : value;
  }

  return processedData;
}
