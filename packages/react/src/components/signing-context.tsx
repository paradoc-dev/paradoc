/**
 * The seal's flow markers, on their way to the blocks that draw them.
 *
 * Core seals a flow-placed slot by rendering the document twice: once with an
 * invisible marker in front of each placeholder, once clean. It finds the
 * marker in the first PDF and gives the box to the clean one. For a layer core
 * renders itself it writes the marker into the text. For a composition it
 * cannot, so it hands the markers to the layer's renderer instead, and
 * `@paradoc/react/pdf` puts them here.
 *
 * They travel by context rather than by prop because a composition is written
 * once and rendered in both passes. Threading a seal-only prop from the
 * composition's root down to every `Signature` would put the seal in every
 * document that never seals.
 *
 * **A slot, not a party, is what carries a marker.** One party ordinarily holds
 * more than one: a signature and a set of initials is the common case, and a
 * structure keyed by party alone would collapse them and lose one. So the marks
 * are keyed by slot id, exactly as the layer declares them, and a block finds
 * its own by naming the party and the kind of field it draws. A party may carry
 * one flow slot per field type; two flow slots of the same type on the same
 * party is an authoring error, and `useSigningMark` says so rather than picking
 * one.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { SigningMarker } from "@paradoc/types";

/**
 * Flow markers for one seal pass, keyed by slot id.
 *
 * A value carries the invisible marker alone, never the placeholder: the block
 * owns what it draws, and the marker goes in front of it. Empty for every render
 * that is not a seal's marker pass, which is every render but one.
 */
export type SigningMarks = Record<string, SigningMarker>;

/** The kinds of signing field flow placement supports. */
export type SigningMarkType = SigningMarker["type"];

/** No marks: the ordinary render, and the seal's clean pass. */
const NO_MARKS: SigningMarks = {};

const SigningContext = createContext<SigningMarks>(NO_MARKS);

/** What the provider takes. `children` is optional so `createElement` can pass them positionally. */
export interface SigningMarkerProviderProps {
  /** The marks this render carries, keyed by slot id. */
  marks: SigningMarks;
  children?: ReactNode;
}

/** Supplies the flow markers to the tree below. The React layer's renderer sets it. */
export function SigningMarkerProvider({ marks, children }: SigningMarkerProviderProps) {
  return <SigningContext.Provider value={marks}>{children}</SigningContext.Provider>;
}

/** The flow markers this render carries. Empty outside a seal's marker pass. */
export function useSigningMarks(): SigningMarks {
  return useContext(SigningContext);
}

/** Thrown when two flow slots on one party claim the same field type. */
export class AmbiguousSigningMarkError extends Error {
  /** The slot ids that collided. */
  readonly slots: readonly string[];

  constructor(role: string, index: number, type: SigningMarkType, slots: readonly string[]) {
    super(
      `Slots ${slots.join(" and ")} both place a ${type} in flow for ${role}[${index}], so neither can be ` +
        "drawn without guessing which block is which. A party may carry one flow slot per field type; " +
        "give the extra one absolute or anchor placement, or bind it to a different party index."
    );
    this.name = "AmbiguousSigningMarkError";
    this.slots = slots;
  }
}

/**
 * The marker for one party's slot of one type, or undefined outside a marker
 * pass.
 *
 * @throws {AmbiguousSigningMarkError} when two flow slots on that party place
 * the same field type.
 */
export function findSigningMark(
  marks: SigningMarks,
  role: string,
  index: number,
  type: SigningMarkType
): string | undefined {
  let found: SigningMarker | undefined;
  for (const mark of Object.values(marks)) {
    if (mark.role !== role || mark.index !== index || mark.type !== type) continue;
    if (found) throw new AmbiguousSigningMarkError(role, index, type, [found.slot, mark.slot]);
    found = mark;
  }
  return found?.marker;
}
