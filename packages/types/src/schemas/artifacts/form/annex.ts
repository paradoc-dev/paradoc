/**
 * Form annex type for design-time annex slot definitions
 */

import type { CondExpr } from "../shared/expressions/cond-expr";

/**
 * Design-time annex slot definition.
 * Defines a placeholder for supplementary documents to be attached at runtime.
 */
export interface FormAnnex {
  /** Title for the annex slot. */
  title?: string;
  /** Description of what document should be attached. */
  description?: string;
  /** Whether required. Can be boolean or expression. */
  required?: CondExpr;
  /** Whether visible. Can be boolean or expression. */
  visible?: CondExpr;
  /** Display order for rendering. */
  order?: number;
}
