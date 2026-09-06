/**
 * One document of a packet.
 *
 * A bundle on screen is a sequence of documents in one scroll, not one long
 * document. `Part` is the boundary between them: everything inside it numbers
 * its pages from one, because that is what a reader of that document expects
 * to see.
 *
 * The packet's own numbering is the sequence of parts, and it comes from the
 * seal rather than from the screen: core's `sealBundle` answers with a first
 * page and a page count per part. Those numbers are only true of the packet
 * they were computed for, so a placement carries the `packetHash` it belongs to
 * and `Part` shows page numbers only while that matches the packet on screen.
 *
 * That matters for a document being filled. A session that changes a field
 * repaginates the composition, which moves every part after it, and the seal
 * that produced the old numbers has not run again. Until it does, the part says
 * its pages are pending rather than naming a page the packet no longer has.
 * The session-fill ticket drives exactly that: reseal, hand back the new
 * `packetHash` with the new placements, and the numbers return.
 */

import type { ReactNode } from "react";

/** What kind of document this part is. */
export type PartKind = "composition" | "form" | "annex";

/** Whether the part's packet pages are known, stale, or not pages at all. */
export type PartPlacementState = "placed" | "pending" | "attached" | "unplaced";

export interface PartProps {
  /** The bundle content key. */
  id: string;
  /** What the part is: a composition rendered live, a filled PDF form, or an annex. */
  kind: PartKind;
  /** Shown above the document. Nothing is shown when it is omitted. */
  label?: ReactNode;
  /** 1-based packet page this part's first page is, when the caller has sealed the packet. */
  firstPage?: number;
  /** Pages this part contributes, when the caller has sealed the packet. */
  pageCount?: number;
  /** True when the part is carried beside the packet rather than merged into it. */
  attached?: boolean;
  /** The `packetHash` the placement above was computed for. */
  placedFor?: string;
  /** The `packetHash` of the packet on screen now. Page numbers show only while it matches. */
  packetHash?: string;
  className?: string;
  children: ReactNode;
}

/** Which of the four things the header can say about this part's pages. */
function placementState(props: PartProps): PartPlacementState {
  if (props.attached) return "attached";
  if (props.firstPage === undefined || props.pageCount === undefined) return "unplaced";
  if (props.placedFor !== undefined && props.packetHash !== undefined && props.placedFor !== props.packetHash) {
    return "pending";
  }
  return "placed";
}

/** What the header says about where this part sits in the packet. */
function placementLabel(props: PartProps, state: PartPlacementState): string | null {
  if (state === "attached") return "Attached, not paginated";
  if (state === "pending") return "Pages pending";
  if (state === "unplaced") return null;
  const first = props.firstPage!;
  const count = props.pageCount!;
  return count === 1 ? `Packet page ${first}` : `Packet pages ${first} to ${first + count - 1}`;
}

/** One document within a packet, with its own pages and its own numbering. */
export function Part(props: PartProps) {
  const { id, kind, label, firstPage, pageCount, attached, className, children } = props;
  const state = placementState(props);
  const placement = placementLabel(props, state);

  return (
    <section
      data-part-id={id}
      data-part-kind={kind}
      data-part-placement={state}
      // Only stated when they are true of the packet on screen. A stale number
      // read by a test is worse than no number.
      data-part-first-page={state === "placed" ? firstPage : undefined}
      data-part-page-count={state === "placed" ? pageCount : undefined}
      data-part-attached={attached ? "true" : undefined}
      className={className ?? "flex flex-col gap-2"}
    >
      {label === undefined ? null : (
        <header
          data-part-label={id}
          className="flex items-baseline justify-between px-6 text-xs font-medium text-neutral-600"
        >
          <span>{label}</span>
          {placement === null ? null : <span className="text-neutral-500">{placement}</span>}
        </header>
      )}
      {children}
    </section>
  );
}
