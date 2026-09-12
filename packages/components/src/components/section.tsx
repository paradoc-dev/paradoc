/** @jsxRuntime classic */
import React from "react";
import { useDocumentTokens, useSectionVisible } from "@paradoc/react";
import type { ReactNode } from "react";
import { KeepTogether } from "./keep-together";

export interface SectionProps {
  /** Stable id the page plan uses to decide whether this section renders on a page. */
  id: string;
  /** Heading shown above the section's children; omitted renders no heading. */
  title?: string;
  /** Classes replacing the section's default column layout. */
  className?: string;
  /** The fields, tables, or other content grouped under this section. */
  children: ReactNode;
}

export function Section({ id, title, className, children }: SectionProps) {
  const visible = useSectionVisible(id);
  const { accentColor } = useDocumentTokens();
  if (!visible) return null;
  return <section data-section={id} className={className ?? "flex flex-col gap-2"}>
    {title ? <KeepTogether as="h2" keepId={`heading:${id}`} className="text-xs font-semibold uppercase tracking-wider text-neutral-500" style={accentColor ? { color: accentColor } : undefined}>{title}</KeepTogether> : null}
    {children}
  </section>;
}
