import { ClientOnly } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Shared chrome for a live, client-only render: a bordered card, and a
 * fallback shown before hydration (or with JS disabled, per the spec's
 * accepted no-JS degradation — everything except the live render still
 * shows).
 *
 * The rendered content gets an explicit, generic `font-family` rather than
 * inheriting the docs site's own "Geist Sans Variable" chrome font. A real
 * consuming project supplies its own typography for an installed component
 * (see `@paradoc/components`'s own `styles.css`), so this preview sandbox
 * should not stand in for one; it also keeps `Pages`' pagination measurement
 * from failing here, since that measurement requires an embeddable
 * `@font-face` for every font family it finds in the tree it measures, and
 * the docs site's own font is not one.
 */
export function LiveFrame({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-fd-border bg-white">
      <ClientOnly fallback={<LiveFrameFallback />}>
        <div className="p-6" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
          {children}
        </div>
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
