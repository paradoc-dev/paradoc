/** @jsxRuntime classic */
import React from "react";
import { useKeepVisible, usePage } from "@paradoc/react";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export interface KeepTogetherProps {
  /** Stable id the page plan tracks this content by; must be unique within the document. */
  keepId: string;
  /**
   * Element or component the keep renders as.
   *
   * @default "div"
   */
  as?: ElementType;
  /** Content kept together as one pagination unit. */
  children?: ReactNode;
  [property: string]: unknown;
}

export function KeepTogether({ keepId, as: Tag = "div", children, ...props }: KeepTogetherProps) {
  const visible = useKeepVisible(keepId);
  const repeated = usePage()?.repeats.has(keepId) === true;
  if (!visible) return null;
  return <Tag {...props as ComponentPropsWithoutRef<"div">} data-keep-id={keepId} data-keep-repeat={repeated ? "true" : undefined}>{children}</Tag>;
}
