/**
 * Defs section type for named computed values
 */

import type { Expression } from "./expression";

/**
 * Defs section for named computed values with type information.
 * Keys are definition names, values are typed expressions.
 */
export interface DefsSection {
  /** Named computed values that can be referenced in expressions. */
  [key: string]: Expression;
}
