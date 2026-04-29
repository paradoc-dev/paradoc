/**
 * Bindings utilities for DOCX renderer
 *
 * Applies bindings to remap data keys from form field names to template field names.
 */

/**
 * Get a value from a nested object using dot notation path.
 * e.g., getNestedValue({ a: { b: 1 } }, 'a.b') => 1
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let value: unknown = obj;
  for (const part of parts) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

/**
 * Apply bindings to remap data keys from form field names to template field names.
 *
 * @param data - Original data object with form field names as keys
 * @param bindings - Mapping from template field names to form field names
 *                   Format: { templateFieldName: 'formFieldName' }
 * @returns New data object with template field names as keys
 *
 * @example
 * ```ts
 * const data = { name: 'Fluffy', species: 'cat' };
 * const bindings = { pet_name: 'name', pet_species: 'species' };
 * const result = applyBindings(data, bindings);
 * // result: { name: 'Fluffy', species: 'cat', pet_name: 'Fluffy', pet_species: 'cat' }
 * ```
 */
export function applyBindings(
  data: Record<string, unknown>,
  bindings: Record<string, string>
): Record<string, unknown> {
  const result = { ...data };

  for (const [templateKey, formKey] of Object.entries(bindings)) {
    const value = getNestedValue(data, formKey);
    if (value !== undefined) {
      result[templateKey] = value;
    }
  }

  return result;
}
