/**
 * Checklist item and status types
 */

/**
 * Boolean checklist status specification.
 * Simple done/not-done tracking.
 */
export interface BooleanStatusSpec {
  /** Discriminator for boolean status type. */
  kind: "boolean";
  /** Default status value. */
  default?: boolean;
}

/**
 * Enumerated status option for enum-based checklist items.
 */
export interface EnumStatusOption {
  /** The status value. */
  value: string;
  /** Human-readable label for the status. */
  label: string;
  /** Optional description of what this status means. */
  description?: string;
}

/**
 * Enum-based checklist status specification.
 * Allows multiple status states beyond done/not-done.
 */
export interface EnumStatusSpec {
  /** Discriminator for enum status type. */
  kind: "enum";
  /** Available status options. */
  options: EnumStatusOption[];
  /** Default status value. */
  default?: string;
}

/**
 * Status specification definition for checklist items.
 * Either boolean (done/not-done) or enum (multiple states).
 */
export type StatusSpec = BooleanStatusSpec | EnumStatusSpec;

/**
 * Template-time checklist item definition.
 * Defines an item to be tracked in a checklist.
 */
export interface ChecklistItem {
  /** Unique item identifier. */
  id: string;
  /** Title or label for the checklist item. */
  title: string;
  /** Optional description providing more detail. */
  description?: string;
  /** Status specification defining how this item's status is tracked. */
  status?: StatusSpec;
}
