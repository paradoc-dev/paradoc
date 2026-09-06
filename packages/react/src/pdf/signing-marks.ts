/**
 * The seam between core's flow signature placement and a composed document.
 *
 * Core injects an invisible marker into the *rendered layer text* and cannot
 * inject it into a converter's private output, so a composition that wants flow
 * placement declares a layer of one line per slot: the slot id, a tab, and the
 * placeholder core rendered for it. The layer describes no layout, so the React
 * tree remains the only description of the document.
 *
 * This module reads those lines back. A `SealAdapter` then hands each
 * placeholder to the `Signature` component for the same party, which is what
 * puts core's mark on the page the document actually draws.
 *
 * The whole seam is a cost the layer imposes rather than a design: a
 * composition should be able to declare its slots on itself and hand core the
 * positions directly. See "Known limitations" in the README.
 */

import type { SigningMarks } from "../components/document-context";

/** Separates a slot id from its placeholder on one line of a signing layer. */
const MARK_SEPARATOR = "\t";

/** Thrown when a render of a signing layer does not carry every slot. */
export class MissingSigningMarkError extends Error {
  /** Slot ids the rendered layer did not carry, in declaration order. */
  readonly slots: readonly string[];

  constructor(slots: readonly string[]) {
    super(
      `The signing layer rendered without ${slots.length === 1 ? "a placeholder" : "placeholders"} for ${slots.join(", ")}. ` +
        "The seal adapter cannot place a mark it was not given."
    );
    this.name = "MissingSigningMarkError";
    this.slots = slots;
  }
}

/**
 * Reads the placeholders out of a render of a signing layer, keyed the way the
 * document context keys them.
 *
 * `slots` maps a party role to the slot id the artifact declares for it. Every
 * slot binds party index 0, so that is the only index this produces: a role
 * admitting several parties would need one slot and one key per index, which
 * the README records as a limitation.
 *
 * @throws {MissingSigningMarkError} when a declared slot has no line.
 */
export function parseSigningMarks(
  content: string,
  slots: Readonly<Record<string, string>>
): SigningMarks {
  const lines = new Map<string, string>();
  for (const line of content.split("\n")) {
    const separator = line.indexOf(MARK_SEPARATOR);
    if (separator === -1) continue;
    lines.set(line.slice(0, separator), line.slice(separator + 1));
  }

  const marks: SigningMarks = {};
  const missing: string[] = [];
  for (const [role, slotId] of Object.entries(slots)) {
    const mark = lines.get(slotId);
    if (mark === undefined || mark.length === 0) missing.push(slotId);
    else marks[`${role}:0`] = mark;
  }
  if (missing.length > 0) throw new MissingSigningMarkError(missing);
  return marks;
}
