import { useKeepVisible, usePage } from "@paradoc/react";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export interface KeepTogetherProps {
  keepId: string;
  as?: ElementType;
  children?: ReactNode;
  [property: string]: unknown;
}

export function KeepTogether({ keepId, as: Tag = "div", children, ...props }: KeepTogetherProps) {
  const visible = useKeepVisible(keepId);
  const repeated = usePage()?.repeats.has(keepId) === true;
  if (!visible) return null;
  return <Tag {...props as ComponentPropsWithoutRef<"div">} data-keep-id={keepId} data-keep-repeat={repeated ? "true" : undefined}>{children}</Tag>;
}
