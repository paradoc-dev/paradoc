/**
 * A copy-owned party block. It reads one party of a declared role from the
 * headless runtime and prints its name, its affiliated organization, its
 * address, and its contact line, through the shared formatter, as a block
 * or inline.
 *
 * The artifact's own person/organization schema carries only name-shaped
 * fields. A filled party record may carry its own `organization`, `address`,
 * or `phone` member beyond that schema — a person signing for a firm, say —
 * and each one prints as its own line when present. A member the record does
 * not carry is left out, never printed blank.
 */
/** @jsxRuntime classic */
import React from "react";
import { scaleTextClasses, useDocumentTokens, usePartyContact } from "@paradoc/react";
import { KeepTogether } from "./keep-together";

export interface PartyProps {
  /** Party role declared by the artifact, such as `"buyer"`. */
  role: string;
  /**
   * 0-based index, for a role admitting several parties.
   * @default 0
   */
  index?: number;
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
export function Party({ role, index = 0, variant = "block", label, keepId, className }: PartyProps) {
  const binding = usePartyContact(role, index);
  const { typography } = useDocumentTokens();
  const heading = label === false ? undefined : (label ?? binding.roleLabel);
  const id = keepId ?? `party:${role}${index === 0 ? "" : `:${index}`}`;
  // A member the binding leaves `undefined` is one the party record does not
  // carry at all, so it is left off; a member the record carries but is still
  // being filled comes back as the binding's own placeholder text and prints
  // like any other in-progress value.
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
