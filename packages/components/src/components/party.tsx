/**
 * A copy-owned party block. It reads one party of a declared role from the
 * headless runtime and prints its name, then the organization, address, and
 * contact lines the artifact keeps in fields beside the party, through the
 * shared formatter, as a block or inline.
 *
 * A party record carries only its name-shaped person or organization
 * members. The fields a document prints about a party (where it is, how to
 * reach it, whom it acts for) are declared fields with their own labels and
 * requiredness, and this block names them by path. A line with no path, or
 * whose field is blank, is left out, never printed empty.
 */
/** @jsxRuntime classic */
import React from "react";
import { scaleTextClasses, useDocumentTokens, usePartyContact, type PartyContactPaths } from "@paradoc/react";
import { KeepTogether } from "./keep-together";

export interface PartyProps {
  /** Party role declared by the artifact, such as `"buyer"`. */
  role: string;
  /**
   * 0-based index, for a role admitting several parties.
   * @default 0
   */
  index?: number;
  /** Path of the field naming the organization the party acts for, such as `"buyerOrganization"`. */
  organization?: string;
  /** Path of the party's address field, such as `"buyerAddress"`, or `"tenants.1.address"` for a list item. */
  address?: string;
  /** Path of the party's contact field, or several (a phone and an email) printed on one line. */
  contact?: string | readonly string[];
  /**
   * `"block"` stacks the name, organization, address, and contact each on
   * their own line; `"inline"` joins them into one run for a sentence.
   * @default "block"
   */
  variant?: "block" | "inline";
  /** Overrides the role heading: a string replaces it, `false` hides it, omitted uses the artifact's own label. */
  label?: string | false;
  /**
   * Stable keep id.
   * @default "party:<role>" or "party:<role>:<index>" past the first
   */
  keepId?: string;
  /** Classes for the party's wrapping element. */
  className?: string;
}

/** One party's presentation, for one declared role. */
export function Party({
  role,
  index = 0,
  organization,
  address,
  contact,
  variant = "block",
  label,
  keepId,
  className,
}: PartyProps) {
  const paths: PartyContactPaths = { organization, address, contact };
  const binding = usePartyContact(role, index, paths);
  const { typography } = useDocumentTokens();
  const heading = label === false ? undefined : (label ?? binding.roleLabel);
  const id = keepId ?? `party:${role}${index === 0 ? "" : `:${index}`}`;
  // A line the binding leaves `undefined` has no path bound or a blank field,
  // so it is left off rather than printed empty.
  const lines = [binding.nameText, binding.organizationText, binding.addressText, binding.contactText].filter(
    (line): line is string => line !== undefined
  );

  if (variant === "inline") {
    const text = (heading ? [heading, ...lines] : lines).join(", ");
    return (
      <KeepTogether as="span" keepId={id} data-party-role={role} data-party-index={index} className={className}>
        <span className={scaleTextClasses("text-sm text-neutral-900", typography.scale)}>{text}</span>
      </KeepTogether>
    );
  }

  return (
    <KeepTogether
      keepId={id}
      data-party-role={role}
      data-party-index={index}
      className={className ?? "flex flex-col gap-0.5"}
    >
      {heading ? (
        <span className={scaleTextClasses("text-xs font-medium uppercase tracking-wide text-neutral-500", typography.scale)}>
          {heading}
        </span>
      ) : null}
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className={scaleTextClasses("text-sm text-neutral-900", typography.scale)}>
          {line}
        </span>
      ))}
    </KeepTogether>
  );
}
