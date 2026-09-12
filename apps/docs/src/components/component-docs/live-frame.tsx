import { ClientOnly } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Shared chrome for a live, client-only render: a bordered card, and a
 * fallback shown before hydration (or with JS disabled, per the spec's
 * accepted no-JS degradation — everything except the live render still
 * shows).
 */
export function LiveFrame({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-fd-border bg-white">
      <ClientOnly fallback={<LiveFrameFallback />}>
        <div className="p-6">{children}</div>
      </ClientOnly>
    </div>
  );
}

function LiveFrameFallback() {
  return (
    <div className="flex h-32 items-center justify-center p-6 text-sm text-fd-muted-foreground">
      Rendering live preview requires JavaScript.
    </div>
  );
}
