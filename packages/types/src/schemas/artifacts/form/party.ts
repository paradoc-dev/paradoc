/**
 * Form party type for design-time party role definitions
 */

export interface FormSignature {
  /** Whether signature is required. Defaults to false. */
  required?: boolean;
  /** Number of witnesses required for this signature. */
  witnesses?: number;
  /** Whether at least one witness must be a notary. */
  notarized?: boolean;
}

/**
 * Design-time party role definition.
 * Defines what roles exist and what constraints apply when filling a form.
 *
 * Party data format is determined by max:
 * - max = 1 (default): single party object with required `id`
 * - max > 1: array of party objects, each with required `id`
 *
 * ID convention: `{role}-{index}` (e.g., "tenant-0", "landlord-1")
 */
export interface FormParty {
  /** Human-readable role name. */
  label: string;
  /** Description of this role. */
  description?: string;
  /** Constraint on party type (person, organization, or any). */
  partyType?: "person" | "organization" | "any";
  /** Minimum parties required (0 or more). Defaults to 1. */
  min?: number;
  /** Maximum parties allowed. Defaults to 1. */
  max?: number;
  /** Whether this role is required. Can be boolean or expression. */
  required?: boolean | string;
  /** Signature requirements for this role. */
  signature?: FormSignature;
}
