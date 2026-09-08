import { useLayoutEffect, useState, type RefObject } from "react";

import { DEFAULT_PAGE_GEOMETRY } from "../components/paper-geometry";
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

/** Measures copy-owned page furniture without choosing any markup or styles. */
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
      const scale = Math.min(1, frame.clientWidth / width);
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
