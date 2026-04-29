/**
 * Party Builder
 *
 * Provides utilities for parsing and validating Party data (Person or Organization).
 * Party type is inferred from shape - no explicit type discriminator needed.
 */

import { validatePerson, validateOrganization } from '@/validation';
import type { Party, Person, Organization } from '@paradoc/types';

/** Organization-specific property names (not present on Person). */
const ORG_KEYS = new Set(['legalName', 'domicile', 'entityType', 'entityId', 'taxId']);

/**
 * Type guard to check if a party is a Person.
 * Persons are identified by NOT having any organization-specific properties.
 * Both Person and Organization share a `name` field.
 *
 * @param party - The party to check
 * @returns true if the party is a Person
 */
export function isPerson(party: Party): party is Person {
  return !Object.keys(party).some(k => ORG_KEYS.has(k));
}

/**
 * Type guard to check if a party is an Organization.
 * Organizations are identified by having at least one organization-specific property
 * (legalName, domicile, entityType, entityId, or taxId).
 *
 * @param party - The party to check
 * @returns true if the party is an Organization
 */
export function isOrganization(party: Party): party is Organization {
  return Object.keys(party).some(k => ORG_KEYS.has(k));
}

/**
 * Infer the party type from its shape.
 *
 * @param party - The party to analyze
 * @returns 'person' if the party has no org-specific keys, 'organization' otherwise
 */
export function inferPartyType(party: Party): 'person' | 'organization' {
  return isPerson(party) ? 'person' : 'organization';
}

/**
 * Parse an unknown input into a Party (Person or Organization).
 * Type is inferred from shape:
 * - If any org-specific key is present (legalName, domicile, entityType, entityId, taxId), validates as Organization
 * - Otherwise validates as Person
 *
 * @param input - The input to parse
 * @returns Validated Party data
 * @throws Error if validation fails or shape cannot be determined
 */
function parse(input: unknown): Party {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid party: must be an object');
  }

  const obj = input as Record<string, unknown>;

  if (!('name' in obj)) {
    throw new Error('Invalid party: must have a name property');
  }

  // Check if it has org-specific keys
  const hasOrgKey = Object.keys(obj).some(k => ORG_KEYS.has(k));

  if (hasOrgKey) {
    // Validate as Organization
    if (!validateOrganization(obj)) {
      const errors = (validateOrganization as unknown as { errors: Array<{ message?: string }> }).errors;
      throw new Error(`Invalid organization data: ${errors?.[0]?.message || 'validation failed'}`);
    }
    return obj as unknown as Party;
  }

  // Validate as Person
  if (!validatePerson(obj)) {
    const errors = (validatePerson as unknown as { errors: Array<{ message?: string }> }).errors;
    throw new Error(`Invalid person data: ${errors?.[0]?.message || 'validation failed'}`);
  }
  return obj as unknown as Party;
}

/**
 * Safely parse an unknown input into a Party.
 *
 * @param input - The input to parse
 * @returns Result object with success flag and either data or error
 */
function safeParse(input: unknown): { success: true; data: Party } | { success: false; error: Error } {
  try {
    return { success: true, data: parse(input) };
  } catch (err) {
    return { success: false, error: err as Error };
  }
}

/**
 * Party data utilities for parsing and type inference.
 *
 * Use this for parsing unknown data into Party (Person | Organization).
 * For creating new parties, use `person()` or `organization()` builders.
 *
 * @example
 * ```typescript
 * // Parse a person
 * const personParty = partyData.parse({ name: 'John Doe' });
 * partyData.inferType(personParty); // 'person'
 *
 * // Parse an organization
 * const orgParty = partyData.parse({ name: 'Acme Corp', legalName: 'Acme Corporation Inc.' });
 * partyData.inferType(orgParty); // 'organization'
 *
 * // Safe parse
 * const result = partyData.safeParse({ name: 'Jane' });
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */
export const partyData = {
  parse,
  safeParse,
  inferType: inferPartyType,
};
