/**
 * Party Validation Utilities
 *
 * Provides utilities for validating party data against FormParty constraints.
 * Party type is inferred from shape, then checked against FormParty.partyType.
 *
 * Party data format rules:
 * - max = 1 (default): single party object with required `id`
 * - max > 1: array of party objects, each with required `id`
 *
 * ID convention: `{role}-{index}` (e.g., "tenant-0", "landlord-1")
 */

import type { FormParty, Party } from '@paradoc/types';
import { inferPartyType, isPerson, isOrganization } from '@/primitives/party';
import { validatePerson, validateOrganization } from './validators';

/**
 * Result of party validation for a form role.
 */
export interface PartyValidationResult {
  /** Whether the party data is valid for this role. */
  success: boolean;
  /** Error message if validation failed. */
  error?: string;
  /** The inferred party type based on shape. */
  inferredType?: 'person' | 'organization';
}

/**
 * Extended validation result with additional details.
 */
export interface ExtendedValidationResult {
  /** Whether the party data is valid for this role. */
  success: boolean;
  /** Error messages if validation failed. */
  errors: string[];
}

/**
 * Validate party data for a specific form role.
 *
 * This function:
 * 1. Infers the party type from shape (Organization has org-specific keys, Person does not)
 * 2. Validates the data against the appropriate schema
 * 3. Checks the inferred type against FormParty.partyType constraint
 *
 * @param data - The party data to validate
 * @param formParty - The FormParty definition that specifies constraints
 * @returns Validation result with success status and inferred type
 *
 * @example
 * ```typescript
 * const formParty = { id: 'buyer', label: 'Buyer', partyType: 'person' };
 *
 * // Valid - person data for person-only role
 * validatePartyForRole({ name: 'John' }, formParty);
 * // { success: true, inferredType: 'person' }
 *
 * // Invalid - organization data for person-only role
 * validatePartyForRole({ name: 'Acme Corp', legalName: 'Acme Corporation Inc.' }, formParty);
 * // { success: false, error: "Party type 'organization' not allowed...", inferredType: 'organization' }
 * ```
 */
export function validatePartyForRole(
  data: unknown,
  formParty: FormParty
): PartyValidationResult {
  // Basic object check
  if (typeof data !== 'object' || data === null) {
    return { success: false, error: 'Invalid party data: must be an object' };
  }

  const obj = data as Record<string, unknown>;
  let inferredType: 'person' | 'organization';

  // Must have name
  if (!('name' in obj)) {
    return {
      success: false,
      error: 'Party must have a name property',
    };
  }

  // Infer type from shape: org-specific keys → organization, otherwise → person
  if (isOrganization(obj as unknown as Party)) {
    inferredType = 'organization';
    if (!validateOrganization(obj)) {
      const errors = (validateOrganization as unknown as { errors: Array<{ message?: string }> }).errors;
      return {
        success: false,
        error: `Invalid organization data: ${errors?.[0]?.message || 'validation failed'}`,
        inferredType,
      };
    }
  } else {
    inferredType = 'person';
    if (!validatePerson(obj)) {
      const errors = (validatePerson as unknown as { errors: Array<{ message?: string }> }).errors;
      return {
        success: false,
        error: `Invalid person data: ${errors?.[0]?.message || 'validation failed'}`,
        inferredType,
      };
    }
  }

  // Check FormParty.partyType constraint
  const allowed = formParty.partyType ?? 'any';
  if (allowed !== 'any' && inferredType !== allowed) {
    return {
      success: false,
      error: `Party type '${inferredType}' not allowed for this role. Expected '${allowed}'`,
      inferredType,
    };
  }

  return { success: true, inferredType };
}

/**
 * Check if a party matches the FormParty.partyType constraint.
 *
 * @param party - A validated Party object
 * @param formParty - The FormParty definition
 * @returns true if the party type is allowed for this role
 */
export function isPartyTypeAllowed(party: Party, formParty: FormParty): boolean {
  const allowed = formParty.partyType ?? 'any';
  if (allowed === 'any') return true;
  return inferPartyType(party) === allowed;
}

// Re-export type guards for convenience
export { isPerson, isOrganization, inferPartyType };

/**
 * Determine if a role expects array format based on max value.
 * Rule: max > 1 → array required; max = 1 (default) → object
 *
 * @param formParty - The FormParty definition
 * @returns true if the role expects an array of parties
 */
export function expectsArrayFormat(formParty: FormParty): boolean {
  const max = formParty.max ?? 1;
  return max > 1;
}

/**
 * Validate party ID format matches convention: {role}-{index}
 *
 * @param partyId - The party ID to validate
 * @param roleId - The expected role ID
 * @returns Validation result with error if invalid
 *
 * @example
 * ```typescript
 * validatePartyId('tenant-0', 'tenant')  // { success: true, errors: [] }
 * validatePartyId('tenant-1', 'tenant')  // { success: true, errors: [] }
 * validatePartyId('wrong-0', 'tenant')   // { success: false, errors: ['Party ID...'] }
 * validatePartyId('tenant', 'tenant')    // { success: false, errors: ['Party ID...'] }
 * ```
 */
export function validatePartyId(partyId: string, roleId: string): ExtendedValidationResult {
  const errors: string[] = [];

  // Check format: {role}-{index}
  const pattern = new RegExp(`^${roleId}-\\d+$`);
  if (!pattern.test(partyId)) {
    errors.push(
      `Party ID "${partyId}" does not match expected format "${roleId}-{index}" (e.g., "${roleId}-0")`
    );
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Validate parties for a role.
 * Checks:
 * - Format (object vs array based on max)
 * - All parties have id field
 * - ID uniqueness
 * - ID format convention
 * - Count against min/max constraints
 *
 * @param parties - The party data to validate
 * @param formParty - The FormParty definition
 * @param roleId - The role identifier
 * @returns Validation result with errors if invalid
 *
 * @example
 * ```typescript
 * // Single party role (max = 1)
 * validatePartiesForRole({ id: 'landlord-0', legalName: 'ABC Corp' }, formParty, 'landlord')
 *
 * // Multi-party role (max > 1)
 * validatePartiesForRole([
 *   { id: 'tenant-0', name: 'Jane' },
 *   { id: 'tenant-1', name: 'John' }
 * ], formParty, 'tenant')
 * ```
 */
export function validatePartiesForRole(
  parties: unknown,
  formParty: FormParty,
  roleId: string
): ExtendedValidationResult {
  const errors: string[] = [];
  const min = formParty.min ?? 1;
  const max = formParty.max ?? 1;
  const expectsArray = max > 1;

  // Handle undefined/null parties
  if (parties === undefined || parties === null) {
    if (min > 0 && (formParty.required === true || formParty.required === undefined)) {
      errors.push(`Role "${roleId}" requires at least ${min} party(ies)`);
    }
    return { success: errors.length === 0, errors };
  }

  // Check format matches expectation
  const isArray = Array.isArray(parties);
  if (expectsArray && !isArray) {
    errors.push(
      `Role "${roleId}" expects an array of parties (max=${max}), but received an object`
    );
    return { success: false, errors };
  }
  if (!expectsArray && isArray) {
    errors.push(
      `Role "${roleId}" expects a single party object (max=${max}), but received an array`
    );
    return { success: false, errors };
  }

  // Normalize to array for validation
  const partyList = isArray ? (parties as unknown[]) : [parties];

  // Check count constraints
  if (partyList.length < min) {
    errors.push(
      `Role "${roleId}" requires at least ${min} party(ies), but only ${partyList.length} provided`
    );
  }
  if (partyList.length > max) {
    errors.push(
      `Role "${roleId}" allows at most ${max} party(ies), but ${partyList.length} provided`
    );
  }

  // Validate each party
  const seenIds = new Set<string>();
  partyList.forEach((party, index) => {
    if (typeof party !== 'object' || party === null) {
      errors.push(`Party at index ${index} must be an object`);
      return;
    }

    const p = party as Record<string, unknown>;

    // Check id field exists
    if (!('id' in p) || typeof p.id !== 'string') {
      errors.push(`Party at index ${index} is missing required "id" field`);
      return;
    }

    const partyId = p.id;

    // Check ID uniqueness
    if (seenIds.has(partyId)) {
      errors.push(`Duplicate party ID "${partyId}" at index ${index}`);
    }
    seenIds.add(partyId);

    // Check ID format
    const idValidation = validatePartyId(partyId, roleId);
    if (!idValidation.success) {
      errors.push(...idValidation.errors);
    }

    // Validate party type
    const partyValidation = validatePartyForRole(party, formParty);
    if (!partyValidation.success && partyValidation.error) {
      errors.push(`Party "${partyId}": ${partyValidation.error}`);
    }
  });

  return {
    success: errors.length === 0,
    errors,
  };
}
