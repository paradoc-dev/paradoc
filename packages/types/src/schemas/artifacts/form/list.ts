import type { BaseField, FormField } from "./field";

/** An ordered, variable-length collection of form fields. */
export interface ListField extends BaseField {
  /** Literal `"list"` discriminator. */
  type: "list";
  /** Definition applied to every item in the list. */
  item: FormField;
  /** Minimum number of items accepted. */
  minItems?: number;
  /** Maximum number of items accepted. */
  maxItems?: number;
}
