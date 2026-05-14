/**
 * Form fieldset type for design-time fieldset definitions
 */

import type { FormField } from "./field";

/**
 * Design-time fieldset definition.
 * A logical grouping of fields rendered together as a section.
 */
export interface FormFieldset {
  /** Optional title/heading for the fieldset. */
  title?: string;
  /** Optional description/help text for the fieldset. */
  description?: string;
  /** Map of field identifiers to field definitions. */
  fields: Record<string, FormField>;
  /** Whether completion of the entire fieldset is required. */
  required?: boolean;
  /** Display order hint (lower numbers first). */
  order?: number;
}

