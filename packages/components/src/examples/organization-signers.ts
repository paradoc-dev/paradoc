import type { Person, RuntimeParty } from "@paradoc/types";

type OrganizationData = {
  fields: Record<string, unknown>;
  parties: Record<string, RuntimeParty | RuntimeParty[]>;
};

/** Thrown when the data names no person to sign for an organization party. */
export class MissingOrganizationSignerError extends Error {
  constructor(readonly role: string, readonly field: string) {
    super(
      `Cannot seal: "${field}" names no person, so the ${role} party has no signatory. ` +
        "Core binds a signer to a Person, and this party is an organization."
    );
    this.name = "MissingOrganizationSignerError";
  }
}

/** Thrown when no party fills a role the seal must bind. */
export class MissingOrganizationPartyError extends Error {
  constructor(readonly role: string) {
    super(
      `Cannot seal: no party fills the "${role}" role, so there is nobody to bind a signatory to. ` +
        "A document is sealed from a completed fill; this one is not complete."
    );
    this.name = "MissingOrganizationPartyError";
  }
}

/** Binds the contact named for every organization party to its filled runtime party. */
export function bindOrganizationSigners<Role extends string, Draft>(
  draft: Draft,
  data: OrganizationData,
  contactFields: Record<Role, string>,
  bind: (draft: Draft, binding: { role: Role; partyId: string; signerId: string; person: Person }) => Draft
): Draft {
  let bound = draft;
  for (const role of Object.keys(contactFields) as Role[]) {
    const field = contactFields[role];
    const contact = data.fields[field];
    if (typeof contact !== "object" || contact === null || typeof (contact as Person).name !== "string") {
      throw new MissingOrganizationSignerError(role, field);
    }
    const filling = data.parties[role];
    const party = Array.isArray(filling) ? filling[0] : filling;
    if (party === undefined || typeof party.id !== "string" || party.id.length === 0) {
      throw new MissingOrganizationPartyError(role);
    }
    bound = bind(bound, { role, partyId: party.id, signerId: `${role}-signer`, person: contact as Person });
  }
  return bound;
}
