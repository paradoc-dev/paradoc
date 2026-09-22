import { formatParties } from "@paradoc/render/text/field-formatter";
import type { Address, Formatter, Organization, Party, Phone } from "@paradoc/types";

import { useUnresolvedPathCollector } from "../components/check-context";
import { formatByType } from "../lib/format";
import { useArtifact, useFormatter, useParty } from "./artifact";

/**
 * A filled `Party` that also carries an affiliated organization, an address,
 * or a phone.
 *
 * `Party` (`Person | Organization`) carries only name-shaped fields — the
 * artifact's own schema has no place for a party's address or contact
 * details. A composition that wants `Party`'s organization, address, and
 * contact lines fills that role's data with a record shaped like this
 * instead; a member the record does not carry is left off the printed
 * block, never printed blank.
 */
export type PartyWithContact = Party & {
  organization?: Organization | string;
  address?: Address;
  phone?: Phone | string;
};

/**
 * Raised when a role's filled parties do not reach `index`.
 *
 * `useParty` already fails an undeclared role by name; this fails the other
 * half of the same fault — a role the artifact does declare, asked for a
 * party past how many it was actually filled with.
 */
export class PartyIndexOutOfRangeError extends Error {
  constructor(readonly role: string, readonly index: number, readonly count: number) {
    super(
      `Party role "${role}" has ${count} ${count === 1 ? "party" : "parties"} filled; index ${index} is out of range.`
    );
    this.name = "PartyIndexOutOfRangeError";
  }
}

export interface PartyContactBinding {
  role: string;
  index: number;
  roleLabel: string;
  /** The party's own name, or an organization's name and legal details, through the shared formatter. */
  nameText: string;
  /**
   * The affiliated organization's formatted name and details, when the
   * filled party record carries an `organization` member beyond the
   * artifact's own person/organization schema. Undefined, not blank, when
   * the record carries none.
   */
  organizationText?: string;
  /** The party's formatted address, when the record carries one. */
  addressText?: string;
  /** The party's formatted phone, when the record carries one. */
  contactText?: string;
}

// The same placeholder `useSignature` (`../headless/signing.ts`) prints for a
// party's own name, kept here for its extension members too: a party mid-fill
// — an organization whose name has not been answered yet, say — is the normal
// state of a document being filled, not a fault, so it prints a placeholder
// rather than throwing formatting a record that is not finished.
const PARTY_PROGRESSIVE = { progressive: { missing: "—", incomplete: "—" } };

function formatExtension(kind: "organization" | "address" | "phone", value: unknown, formatter: Formatter, path: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return formatByType(kind, value, formatter, undefined, path, PARTY_PROGRESSIVE.progressive);
}

/**
 * Resolves one party's contact presentation without rendering its markup.
 *
 * The artifact's own `Person`/`Organization` schema carries only name-shaped
 * fields; a filled party record beyond that may carry its own `organization`,
 * `address`, or `phone` member (a person signing for a firm, say), each
 * formatted through the same shared formatter a `Field` reads through.
 */
export function usePartyContact(role: string, index = 0): PartyContactBinding {
  const artifact = useArtifact();
  const parties = useParty(role);
  const formatter = useFormatter();
  const collector = useUnresolvedPathCollector();
  const definition = artifact.parties?.[role];
  const roleLabel = definition?.label ?? role;
  const party = parties[index];

  if (party === undefined) {
    if (collector) {
      // An undeclared role was already reported by `useParty` above; only a
      // declared role with too few filled parties is a fresh fault here.
      if (Object.hasOwn(artifact.parties ?? {}, role)) collector.report(`party:${role}[${index}]`);
      return { role, index, roleLabel, nameText: "—" };
    }
    throw new PartyIndexOutOfRangeError(role, index, parties.length);
  }

  const path = `parties.${role}[${index}]`;
  const nameText = String(formatParties(formatter, artifact, party, path, PARTY_PROGRESSIVE, role) ?? "—");
  const record = party as PartyWithContact;

  return {
    role,
    index,
    roleLabel,
    nameText,
    organizationText: formatExtension("organization", record.organization, formatter, `${path}.organization`),
    addressText: formatExtension("address", record.address, formatter, `${path}.address`),
    contactText: formatExtension("phone", record.phone, formatter, `${path}.phone`),
  };
}
