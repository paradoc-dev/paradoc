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
 * until `document.fonts.ready` resolves.
 */

import {
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { measureKeeps } from "../lib/measure";
import { planPages, type PagePlan } from "../lib/plan";
import {
  PAGE_CONTENT_HEIGHT_PX,
  PAGE_CONTENT_WIDTH_PX,
  PAGE_GAP_PX,
  PAPER_HEIGHT_PX,
  PAPER_WIDTH_PX,
  Sheet,
  useFitToWidth,
} from "./paper";
import { PageContextProvider, type PageContextValue } from "./page-context";

/** True once the document's own fonts have loaded, so measurement is not of fallbacks. */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // An environment with no font-loading API has nothing to wait for.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.ready) {
      setReady(true);
      return;
    }
    let live = true;
    void fonts.ready.then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  return ready;
}

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

  return (
    <Sheet page={index + 1} style={{ height: PAPER_HEIGHT_PX }}>
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

/** A document laid out as US Letter pages, stacked and scaled to fit its container. */
export function Pages({ className, onPaginate, children }: PagesProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<PagePlan | null>(null);
  const [revision, setRevision] = useState(0);
  const fit = useFitToWidth(frameRef, stackRef);
  const fontsReady = useFontsReady();

  // A plan describes one document. When the document changes, drop it here
  // rather than rendering the new tree against the old page assignments for a
  // commit. Re-rendering the same document is not a change, so this settles.
  const rendered = useRef(children);
  if (!sameChildren(rendered.current, children)) {
    rendered.current = children;
    setPlan(null);
    setRevision((previous) => previous + 1);
  }

  const repaginate = useCallback(() => {
    const container = measureRef.current;
    if (!container) return;
    const next = planPages(measureKeeps(container), PAGE_CONTENT_HEIGHT_PX);
    setPlan((previous) => (samePlan(previous, next) ? previous : next));
  }, []);

  useEffect(() => {
    if (fontsReady) repaginate();
  }, [fontsReady, revision, repaginate]);

  useEffect(() => {
    if (!fontsReady || typeof ResizeObserver === "undefined") return;
    const container = measureRef.current;
    if (!container) return;
    const observer = new ResizeObserver(repaginate);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fontsReady, repaginate]);

  useEffect(() => {
    if (plan) onPaginate?.(plan);
  }, [plan, onPaginate]);

  // A document with no keeps is still a sheet of paper.
  const sheets = plan === null ? 0 : Math.max(1, plan.pages.length);

  return (
    <>
      <div ref={frameRef} className={className ?? "w-full overflow-hidden bg-neutral-200 p-6"}>
        <div
          className="mx-auto"
          style={{ width: PAPER_WIDTH_PX * fit.scale, height: fit.height || undefined }}
        >
          <div
            ref={stackRef}
            data-page-stack="true"
            className="flex flex-col"
            style={{
              width: PAPER_WIDTH_PX,
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
          position: "fixed",
          top: 0,
          left: -10000,
          width: PAGE_CONTENT_WIDTH_PX,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </>
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

/** Two plans are the same when nothing about the pages changed. */
function samePlan(a: PagePlan | null, b: PagePlan): boolean {
  return (
    a !== null &&
    a.budget === b.budget &&
    sameRows(a.pages, b.pages) &&
    sameRows(a.repeats, b.repeats) &&
    sameRows([a.breaks], [b.breaks]) &&
    a.oversize.length === b.oversize.length &&
    a.oversize.every(
      (keep, index) => keep.id === b.oversize[index]!.id && keep.height === b.oversize[index]!.height
    )
  );
}

/**
 * True when two children describe the same document.
 *
 * React builds new element objects on every render, so identity alone would
 * call every parent render a new document. Same type, same key and the same
 * props by reference is the same document.
 */
function sameChildren(a: ReactNode, b: ReactNode): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((child, index) => sameChildren(child, b[index]));
  }
  if (!isValidElement(a) || !isValidElement(b)) return false;
  if (a.type !== b.type || a.key !== b.key) return false;

  const before = a.props as Record<string, unknown>;
  const after = b.props as Record<string, unknown>;
  const names = Object.keys(before);
  return (
    names.length === Object.keys(after).length &&
    names.every((name) => Object.is(before[name], after[name]))
  );
}
