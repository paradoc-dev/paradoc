/**
 * Party Builder
 *
 * Provides utilities for parsing and validating Party data (Person or Organization).
 * Party type is inferred from shape - no explicit type discriminator needed.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Party, Person, Organization, RuntimeParty } from '@paradoc/types';
import { validatePerson, validateOrganization, type Validator } from '@/validation/validators';

/** Organization-specific property names (not present on Person). */
const ORG_KEYS = new Set(['legalName', 'domicile', 'entityType', 'entityId', 'taxId']);

function hasOrganizationKey(value: object): boolean {
  return Object.keys(value).some(k => ORG_KEYS.has(k));
}

/**
 * Type guard to check if a party is a Person.
 * Persons are identified by NOT having any organization-specific properties.
 * Both Person and Organization share a `name` field.
 *
 * @param party - The party to check
 * @returns true if the party is a Person
 */
export function isPerson(party: Party): party is Person {
  return !hasOrganizationKey(party);
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
  return hasOrganizationKey(party);
}

/**
 * Infer the party type from its shape.
 *
 * @param party - The party to analyze
 * @returns 'person' if the party has no org-specific keys, 'organization' otherwise
 */
export function inferPartyType(party: Party): 'person' | 'organization' {
  return hasOrganizationKey(party) ? 'organization' : 'person';
}

/**
 * The ids of the signers who sign for a party. A party's listed signatories
 * sign for it. A Person with none signs for itself, so its signer id is its
 * party id (`signerId = party.id`). An Organization with none has no signer:
 * it issues without a personal signature.
 *
 * Seal-slot binding, capture checks and signing status all read this, so
 * they agree on who may sign.
 *
 * @param party - The filled party
 * @param signatories - The party's signatories, if any
 * @returns The signer ids, in signatory order
 */
export function partySignerIds(
  party: RuntimeParty,
  signatories: readonly { signerId: string }[] | undefined,
): string[] {
  if (signatories && signatories.length > 0) return signatories.map((signatory) => signatory.signerId);
  return isPerson(party) ? [party.id] : [];
}

/** The validators {@link checkParty} checks each party type against. */
export interface PartyValidators {
  person: Validator<unknown>;
  organization: Validator<unknown>;
}

/** The result of {@link checkParty}. */
export type PartyCheck =
  | { success: true; type: 'person' | 'organization'; data: Party }
  | { success: false; type?: 'person' | 'organization'; error: string };

function firstMessage(issues: readonly StandardSchemaV1.Issue[]): string {
  return issues[0]?.message ?? 'validation failed';
}

/**
 * Check a value as a party. The type is inferred from shape: a value with any
 * organization-specific key (legalName, domicile, entityType, entityId,
 * taxId) is checked as an Organization, any other as a Person. Every party
 * check in core goes through this; `validators` picks the schemas, such as
 * the runtime schemas that also require the party `id`.
 */
export function checkParty(
  input: unknown,
  validators: PartyValidators = { person: validatePerson, organization: validateOrganization },
): PartyCheck {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { success: false, error: 'Invalid party: must be an object' };
  }
  if (!('name' in input)) {
    return { success: false, error: 'Invalid party: must have a name property' };
  }
  const type = hasOrganizationKey(input) ? 'organization' : 'person';
  const result = validators[type](input);
  if (result.issues) {
    return { success: false, type, error: `Invalid ${type} data: ${firstMessage(result.issues)}` };
  }
  return { success: true, type, data: input as Party };
}

/**
 * Parse an unknown input into a Party (Person or Organization), with the type
 * inferred from shape as {@link checkParty} does.
 *
 * @param input - The input to parse
 * @returns Validated Party data
 * @throws Error if validation fails
 */
function parse(input: unknown): Party {
  const result = checkParty(input);
  if (!result.success) throw new Error(result.error);
  return result.data;
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
