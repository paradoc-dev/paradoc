import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { loadDocumentFaces } from "../lib/font";
import { measureKeeps } from "../lib/measure";
import { planPages, type PagePlan } from "../lib/plan";

export interface FontReadiness {
  ready: boolean;
  error: Error | null;
}

/** Tracks the requested document family and exposes loading failures. */
export function useFontReadiness(family: string): FontReadiness {
  const [state, setState] = useState<{ family: string | null; error: Error | null }>({ family: null, error: null });
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.ready) {
      setState({ family, error: null });
      return;
    }
    let live = true;
    setState({ family: null, error: null });
    void loadDocumentFaces(fonts, family).then(
      () => { if (live) setState({ family, error: null }); },
      (cause: unknown) => { if (live) setState({ family: null, error: cause instanceof Error ? cause : new Error(String(cause)) }); }
    );
    return () => { live = false; };
  }, [family]);
  return { ready: state.family === family, error: state.error };
}

export interface PaginationOptions {
  budget: number;
  fontFamily: string;
  onPaginate?: (plan: PagePlan) => void;
}

export interface PaginationBinding extends FontReadiness {
  plan: PagePlan | null;
  measureRef: RefObject<HTMLDivElement | null>;
  repaginate(): void;
}

function sameRows(a: readonly (readonly string[])[], b: readonly (readonly string[])[]): boolean {
  return a.length === b.length && a.every((row, index) =>
    row.length === b[index]?.length && row.every((value, item) => value === b[index]?.[item])
  );
}

export function samePagePlan(a: PagePlan | null, b: PagePlan): boolean {
  return a !== null && a.budget === b.budget && sameRows(a.pages, b.pages) &&
    sameRows(a.repeats, b.repeats) && sameRows(a.sections, b.sections) &&
    sameRows([a.breaks], [b.breaks]) && a.oversize.length === b.oversize.length &&
    a.oversize.every((keep, index) => keep.id === b.oversize[index]?.id && keep.height === b.oversize[index]?.height);
}

/** Measures and plans copy-owned page furniture without rendering any markup. */
export function usePagination({ budget, fontFamily, onPaginate }: PaginationOptions): PaginationBinding {
  const measureRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<PagePlan | null>(null);
  const fonts = useFontReadiness(fontFamily);
  const repaginate = useCallback(() => {
    const container = measureRef.current;
    if (!container) return;
    const next = planPages(measureKeeps(container), budget);
    setPlan((previous) => samePagePlan(previous, next) ? previous : next);
  }, [budget]);
  useLayoutEffect(() => { if (fonts.ready) repaginate(); });
  useEffect(() => {
    if (!fonts.ready || typeof ResizeObserver === "undefined" || !measureRef.current) return;
    const observer = new ResizeObserver(repaginate);
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [fonts.ready, repaginate]);
  const publish = useRef(onPaginate);
  publish.current = onPaginate;
  useEffect(() => { if (plan) publish.current?.(plan); }, [plan]);
  return { ...fonts, plan, measureRef, repaginate };
}
