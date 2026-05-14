/**
 * Generic field data preprocessing utility using strategy pattern
 * All renderers use this function with their own wrapping strategy
 */

import type { Form } from "@paradoc/types";
import { buildFieldTypeMap } from "./schema-field-mapper";
import { isSerializableFieldType } from "./field-detector";

/**
 * Preprocesses render data by applying a custom wrapping strategy to serializable fields.
 * This enables renderers to implement their own wrapping behavior while reusing field detection.
 *
 * Strategy pattern: Each renderer passes its own wrapper function:
 * - renderer-text: wraps with toString() override
 * - renderer-docx: wraps with form field binding
 * - renderer-pdf: wraps with AcroForm field binding
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

  const fieldTypeMap = buildFieldTypeMap(schema);
  const processedData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const fieldType = fieldTypeMap[key];

    if (fieldType && isSerializableFieldType(fieldType)) {
      // Apply the renderer-specific wrapping strategy
      processedData[key] = wrapperStrategy(value, fieldType);
    } else {
      // Pass through unchanged
      processedData[key] = value;
    }
  }

  return processedData;
}
