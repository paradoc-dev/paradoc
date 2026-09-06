/**
 * `Bundle` holds the documents of one composition, mirroring the artifact
 * hierarchy's outermost level. It carries no artifact of its own; each
 * `Document` beneath it binds its own.
 */

import type { ReactNode } from "react";

export interface BundleProps {
  /** Stable identifier for the bundle. */
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Groups one or more documents. */
export function Bundle({ id, className, children }: BundleProps) {
  return (
    <div data-bundle-id={id ?? "bundle"} className={className ?? "flex flex-col gap-12"}>
      {children}
    </div>
  );
}
