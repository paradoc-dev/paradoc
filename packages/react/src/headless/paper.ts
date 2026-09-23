import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { DEFAULT_PAGE_GEOMETRY } from "../components/paper-geometry";
import { assertFurnitureBandFits, PageFurnitureOverflowError } from "../lib/furniture";
import { measureFurnitureBands } from "../lib/measure";
import { useFontReadiness } from "./pagination";
import { DEFAULT_PAGE_MARGIN_PX, PAGE_SIZES } from "../lib/tokens";

export const PAPER_WIDTH_PX = PAGE_SIZES.letter.widthPx;
export const PAPER_HEIGHT_PX = PAGE_SIZES.letter.heightPx;
export const PAPER_MARGIN_PX = DEFAULT_PAGE_MARGIN_PX;
export const PAGE_CONTENT_HEIGHT_PX = DEFAULT_PAGE_GEOMETRY.contentHeightPx;
export const PAGE_CONTENT_WIDTH_PX = DEFAULT_PAGE_GEOMETRY.contentWidthPx;
export const PAGE_GAP_PX = 24;

export interface Fit {
  scale: number;
  height: number;
}

/**
 * Measures copy-owned page furniture without choosing any markup or styles.
 *
 * `frame`'s own horizontal padding is subtracted before dividing: the
 * installed `Paper`/`Pages` markup puts padding directly on the same element
 * it hands this hook as `frame` (their default "desk" styling around the
 * sheet), and `clientWidth` includes that padding. Scaling the content to the
 * full padded width, then placing it flush against the padding's inner edge,
 * overflows past the frame's own right edge by exactly the padding this hook
 * did not know to leave room for. A frame with no padding of its own measures
 * the same as before.
 */
export function useFitToWidth(
  frameRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  width: number = PAPER_WIDTH_PX
): Fit {
  const [fit, setFit] = useState<Fit>({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const measure = () => {
      const { paddingLeft, paddingRight } = getComputedStyle(frame);
      const availableWidth = frame.clientWidth - (parseFloat(paddingLeft) || 0) - (parseFloat(paddingRight) || 0);
      const scale = Math.min(1, availableWidth / width);
      setFit({ scale, height: content.scrollHeight * scale });
    };
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, [frameRef, contentRef, width]);

  return fit;
}

export interface FurnitureFitBinding {
  /**
   * The unscaled layer the preview lays its header and footer bands out in to
   * be measured. It holds the bands only, never the document.
   */
  measureRef: RefObject<HTMLDivElement | null>;
  /** The band that does not fit in the margin, or null while every band fits. */
  error: PageFurnitureOverflowError | null;
}

function sameOverflow(a: PageFurnitureOverflowError | null, b: PageFurnitureOverflowError | null): boolean {
  if (a === null || b === null) return a === b;
  return a.slot === b.slot && a.heightPx === b.heightPx && a.marginPx === b.marginPx;
}

/**
 * Measures the preview's header and footer bands against the margin they are
 * drawn in.
 *
 * It runs the check `renderPdf` runs, on the bands the preview draws, so a
 * band that does not fit fails by name in both outputs instead of printing
 * over the first line of every sheet in the preview. The caller throws the
 * error from render, as it throws a pagination error.
 */
export function useFurnitureFit(marginPx: number): FurnitureFitBinding {
  const measureRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<PageFurnitureOverflowError | null>(null);
  const fonts = useFontReadiness();
  const check = useCallback(() => {
    const container = measureRef.current;
    let next: PageFurnitureOverflowError | null = null;
    if (container) {
      try {
        for (const band of measureFurnitureBands(container)) {
          assertFurnitureBandFits(band.slot, Math.ceil(band.heightPx), marginPx);
        }
      } catch (cause) {
        if (!(cause instanceof PageFurnitureOverflowError)) throw cause;
        next = cause;
      }
    }
    setError((previous) => sameOverflow(previous, next) ? previous : next);
  }, [marginPx]);
  useLayoutEffect(() => { if (fonts.ready) check(); });
  useEffect(() => {
    if (!fonts.ready || typeof ResizeObserver === "undefined" || !measureRef.current) return;
    const observer = new ResizeObserver(check);
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [fonts.ready, check]);
  return { measureRef, error };
}
