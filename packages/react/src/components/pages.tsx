/**
 * The paginated preview.
 *
 * One tree stays the only source of truth. `Pages` renders the document once
 * into a hidden container at page content width, waits for the fonts, measures
 * every `[data-keep-id]`, and computes a plan. It then renders the same tree
 * again once per page; each keep asks the page context whether it belongs
 * there and returns null when it does not. No DOM node is moved, and there is
 * no second description of the document anywhere.
 *
 * Measurement never runs against fallback fonts: nothing is planned or rendered
 * until the faces the document is set in have loaded.
 *
 * A plan is replaced only when a fresh measurement differs from it, and prop
 * identity is never consulted. A host that hands `Pages` a new element tree on
 * every render, which is what an inline object prop or state set from
 * `onPaginate` produces, measures to the same plan, so nothing changes and no
 * sheet is unmounted.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { measureKeeps } from "../lib/measure";
import { planPages, type PagePlan } from "../lib/plan";
import { captureApplicationFonts } from "../lib/application-fonts";
import { PAGE_GAP_PX, Sheet, useFitToWidth, usePaperFor } from "./paper";
import { DrawnPaperProvider, usePaperGeometry } from "./paper-geometry";
import { PageContextProvider, type PageContextValue } from "./page-context";

export interface PageProps {
  /** The plan this page comes from. */
  plan: PagePlan;
  /** 0-based index of this page within the plan. */
  index: number;
  children: ReactNode;
}

/** One page of a plan: a sheet holding only the keeps the plan put on it. */
export function Page({ plan, index, children }: PageProps) {
  const value = useMemo<PageContextValue>(
    () => ({
      plan,
      index,
      keeps: new Set(plan.pages[index] ?? []),
      repeats: new Set(plan.repeats[index] ?? []),
      sections: new Set(plan.sections[index] ?? []),
    }),
    [plan, index]
  );

  const overflowing = plan.oversize.filter((keep) => value.keeps.has(keep.id));
  const geometry = usePaperGeometry();

  return (
    <Sheet page={index + 1} style={{ height: geometry.heightPx }}>
      {overflowing.map((keep) => (
        <div
          key={keep.id}
          data-oversize-keep={keep.id}
          className="absolute right-2 top-2 rounded bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white"
        >
          {`Oversize keep "${keep.id}": ${Math.round(keep.height)} px of ${plan.budget} px`}
        </div>
      ))}
      <PageContextProvider value={value}>{children}</PageContextProvider>
    </Sheet>
  );
}

export interface PagesProps {
  className?: string;
  /** Called with every new plan, so a host can show the page count and the breaks. */
  onPaginate?: (plan: PagePlan) => void;
  children: ReactNode;
}

/** A document laid out as pages of its own paper, stacked and scaled to fit its container. */
export function Pages({ className, onPaginate, children }: PagesProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<PagePlan | null>(null);
  const [fontError, setFontError] = useState<Error | null>(null);
  const paginationGeneration = useRef(0);
  const { drawn, geometry, sheetStyle } = usePaperFor(children);
  const fit = useFitToWidth(frameRef, stackRef, geometry.widthPx);
  const fontsReady = true;

  // The paper is part of what a plan is a plan of. It needs no invalidation of
  // its own: the measuring container is the width the new margin leaves, the
  // budget is the new page's, and the measurement after the commit answers with
  // a different plan. A page break never paints against the old paper because
  // that measurement runs before paint.
  const budget = geometry.contentHeightPx;
  const repaginate = useCallback(async () => {
    const container = measureRef.current;
    if (!container) return;
    const generation = ++paginationGeneration.current;
    try {
      const snapshot = await captureApplicationFonts(container);
      if (generation !== paginationGeneration.current || container !== measureRef.current) return;
      const next = planPages(measureKeeps(container), budget);
      next.fonts = snapshot;
      setFontError(null);
      setPlan((previous) => (samePlan(previous, next) ? previous : next));
    } catch (cause) {
      if (generation === paginationGeneration.current) setFontError(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }, [budget]);

  // React builds a new element tree on every render, so children identity says
  // nothing about whether the document changed. Measure after every commit and
  // let the measurement answer: an equal document plans to an equal plan and no
  // state changes, while a real edit produces exactly one new plan. The plan is
  // never dropped, so the sheets that survive an edit keep their DOM nodes and a
  // host that re-renders on every plan has nothing to re-render.
  //
  // Before paint, not after: an edit that moves a page break would otherwise
  // paint the new document against the old page assignments for one frame.
  useLayoutEffect(() => {
    if (fontsReady) void repaginate();
  });

  useEffect(() => {
    if (!fontsReady || typeof ResizeObserver === "undefined") return;
    const container = measureRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => { void repaginate(); });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fontsReady, repaginate]);

  // A host that sets state from onPaginate hands back a new callback on every
  // render. Publishing on the callback's identity would then call it forever, so
  // the plan alone decides when a plan is published, and the callback is only
  // ever the latest one.
  const publish = useRef(onPaginate);
  publish.current = onPaginate;

  useEffect(() => {
    if (plan) publish.current?.(plan);
  }, [plan]);

  if (fontError) {
    return (
      <div role="alert" data-font-resource-error="true">
        <p>{fontError.message}</p>
        <button type="button" onClick={() => { setFontError(null); void repaginate(); }}>Retry font loading</button>
      </div>
    );
  }

  // A document with no keeps is still a sheet of paper.
  const sheets = plan === null ? 0 : Math.max(1, plan.pages.length);

  return (
    <DrawnPaperProvider value={drawn}>
      <div ref={frameRef} className={className ?? "w-full overflow-hidden bg-neutral-200 p-6"}>
        <div
          className="mx-auto"
          style={{ width: geometry.widthPx * fit.scale, height: fit.height || undefined }}
        >
          <div
            ref={stackRef}
            data-page-stack="true"
            className="flex flex-col"
            style={{
              ...sheetStyle,
              width: geometry.widthPx,
              gap: PAGE_GAP_PX,
              transform: `scale(${fit.scale})`,
              transformOrigin: "top left",
            }}
          >
            {plan === null
              ? null
              : Array.from({ length: sheets }, (_sheet, index) => (
                  <Page key={index} plan={plan} index={index}>
                    {children}
                  </Page>
                ))}
          </div>
        </div>
      </div>
      <div
        ref={measureRef}
        aria-hidden="true"
        data-paper-measure="true"
        className="paradoc-document"
        style={{
          ...sheetStyle,
          position: "fixed",
          top: 0,
          left: -10000,
          width: geometry.contentWidthPx,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </DrawnPaperProvider>
  );
}

/** True when two lists of keep ids hold the same ids in the same order. */
function sameRows(a: readonly (readonly string[])[], b: readonly (readonly string[])[]): boolean {
  return (
    a.length === b.length &&
    a.every((row, index) => {
      const other = b[index]!;
      return row.length === other.length && row.every((id, position) => id === other[position]);
    })
  );
}

/**
 * Two plans are the same when nothing about the pages changed.
 *
 * This is the only thing that decides whether the preview repaginates, so it
 * compares every field of the plan a page reads.
 */
function samePlan(a: PagePlan | null, b: PagePlan): boolean {
  return (
    a !== null &&
    a.budget === b.budget &&
    a.fonts?.identity === b.fonts?.identity &&
    sameRows(a.pages, b.pages) &&
    sameRows(a.repeats, b.repeats) &&
    sameRows(a.sections, b.sections) &&
    sameRows([a.breaks], [b.breaks]) &&
    a.oversize.length === b.oversize.length &&
    a.oversize.every(
      (keep, index) => keep.id === b.oversize[index]!.id && keep.height === b.oversize[index]!.height
    )
  );
}
