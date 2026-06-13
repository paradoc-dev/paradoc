/**
 * Form party type for design-time party role definitions
 */

import type { Money } from "../../primitives";
import type { MoneyExpression } from "../shared/expressions/expression";

export interface FormSignature {
  /** Whether signature is required. Defaults to false. */
  required?: boolean;
  /** Number of witnesses required for this signature. */
  witnesses?: number;
  /** Whether at least one witness must be a notary. */
  notarized?: boolean;
}

/**
 * Design-time payment requirement for a party role.
 *
 * Declares that a party owes a payment. The amount is either a fixed `Money`
 * (amount + currency known at authoring time) or a `MoneyExpression` whose
 * amount/currency resolve from the respondent's filled data at request time
 * (via the same expression engine that drives field `visible`/`required`).
 *
 * A payment requirement is a separate phase from data collection — analogous to
 * a signature, it is settled outside the web form (in the payment ceremony), so
 * declaring it does not block web-form submission.
 */
export interface FormPayment {
  /** Whether payment is required. Defaults to false. */
  required?: boolean;
  /**
   * The amount owed: a fixed `Money` value, or a `MoneyExpression` resolved
   * from filled data at request time.
   */
  amount: Money | MoneyExpression;
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
  /** Payment requirement for this role. */
  payment?: FormPayment;
}
