/**
 * `Section` groups related content under a heading.
 *
 * A section is a container, not a pagination unit. It carries `data-section`
 * rather than `data-keep-id` precisely so a long section — the priced scope runs
 * well past a page — is never treated as one thing that must stay together. The
 * keeps inside it are what pagination moves.
 *
 * A section renders on every page that holds one of its keeps and collapses
 * entirely on the pages that hold none, so a continued page carries no empty
 * container and no stray gap.
 */

import type { ReactNode } from "react";

import { KeepTogether } from "./keep-together";
import { useSectionVisible } from "./page-context";

export interface SectionProps {
  /** Stable section id. */
  id: string;
  /** Heading shown above the section. */
  title?: string;
  className?: string;
  children: ReactNode;
}

/** A titled container. */
export function Section({ id, title, className, children }: SectionProps) {
  const visible = useSectionVisible(id);
  if (!visible) return null;

  return (
    <section data-section={id} className={className ?? "flex flex-col gap-2"}>
      {title ? (
        <KeepTogether
          as="h2"
          keepId={`heading:${id}`}
          className="text-xs font-semibold uppercase tracking-wider text-neutral-500"
        >
          {title}
        </KeepTogether>
      ) : null}
      {children}
    </section>
  );
}
