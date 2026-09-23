import { formatParties } from "@paradoc/render/text/field-formatter";

import { useUnresolvedPathCollector } from "../components/check-context";
import { useArtifact, useFields, useFormatter, useParty, usePartialPlaceholder, type FieldBinding } from "./artifact";

/**
 * The field paths a party's organization, address, and contact lines print
 * from.
 *
 * A party record carries only its name-shaped person or organization
 * members. What else a document prints about a party lives in fields the
 * artifact declares beside it, each with its own label, requiredness, and
 * layer binding, so a party block names those fields rather than reading
 * members the record does not have. Each path resolves as a `Field` path does;
 * for a role filled more than once, pass the list item's concrete path, such
 * as `witnessContacts.1.address`, for each index.
 */
export interface PartyContactPaths {
  /** Path of the field naming the organization the party acts for. */
  organization?: string;
  /** Path of the party's address field. */
  address?: string;
  /** Path of the party's contact field, or several (a phone and an email) printed together. */
  contact?: string | readonly string[];
}

/**
 * Raised when a role's filled parties do not reach `index` in a finished
 * document. A partial one prints its placeholder instead.
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
  /** The bound organization field's text. Undefined when no path is bound or the field is blank. */
  organizationText?: string;
  /** The bound address field's text. Undefined when no path is bound or the field is blank. */
  addressText?: string;
  /**
   * The bound contact fields' texts, joined into one line. Undefined when no
   * path is bound or every bound field is blank.
   */
  contactText?: string;
}

// The same placeholder `useSignature` (`../headless/signing.ts`) prints for a
// party's own name: a party mid-fill, an organization whose name has not been
// answered yet, say, is the normal state of a document being filled, not a
// fault, so it prints a placeholder rather than throwing.
const PARTY_PROGRESSIVE = { progressive: { missing: "—", incomplete: "—" } };

const EMPTY_PATHS: PartyContactPaths = {};

function lineText(bindings: readonly FieldBinding[]): string | undefined {
  const texts = bindings.filter((binding) => !binding.blank).map((binding) => binding.text);
  return texts.length > 0 ? texts.join(", ") : undefined;
}

/**
 * Resolves one party's presentation without rendering its markup: its name
 * from the party record, and its organization, address, and contact lines
 * from the fields `paths` names.
 *
 * Each bound path reads and formats exactly as `useField` does, so an
 * unresolved path fails by name, or is reported to a check. A bound field
 * that is blank is left off, so an optional line never prints empty.
 */
export function usePartyContact(role: string, index = 0, paths: PartyContactPaths = EMPTY_PATHS): PartyContactBinding {
  const artifact = useArtifact();
  const parties = useParty(role);
  const formatter = useFormatter();
  const collector = useUnresolvedPathCollector();
  const partialPlaceholder = usePartialPlaceholder();
  const contactPaths = paths.contact === undefined ? [] : typeof paths.contact === "string" ? [paths.contact] : paths.contact;
  const bound = [paths.organization, paths.address].filter((path): path is string => path !== undefined);
  const fields = useFields([...bound, ...contactPaths]);
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
    // A partial document is still being filled, so a party not answered yet
    // prints the document's placeholder, as an unanswered `Field` does. A
    // finished document missing one is a fault and fails by name.
    if (partialPlaceholder !== undefined) return { role, index, roleLabel, nameText: partialPlaceholder };
    throw new PartyIndexOutOfRangeError(role, index, parties.length);
  }

  const path = `parties.${role}[${index}]`;
  const nameText = String(formatParties(formatter, artifact, party, path, PARTY_PROGRESSIVE, role) ?? "—");
  let next = 0;
  const organizationText = paths.organization === undefined ? undefined : lineText([fields[next++]!]);
  const addressText = paths.address === undefined ? undefined : lineText([fields[next++]!]);
  const contactText = contactPaths.length === 0 ? undefined : lineText(fields.slice(next));

  return { role, index, roleLabel, nameText, organizationText, addressText, contactText };
}
