import type { ReactNode } from "react";

export interface BundleProps {
  className?: string;
  children: ReactNode;
}

export function Bundle({ className, children }: BundleProps) {
  return <div className={className ?? "flex flex-col gap-8"}>{children}</div>;
}
