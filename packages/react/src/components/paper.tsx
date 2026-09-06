/**
 * The paper geometry, and one document shown on a single sheet.
 *
 * The geometry is fixed, not configurable: US Letter at 96 dpi with a 48 pixel
 * margin. One geometry is the point — the preview and the PDF have to agree on
 * it, so a caller must not be able to vary it. The sheet keeps its 816 pixel
 * width at every window size and only a CSS transform changes, so line wrapping
 * on screen is the wrapping the PDF will have.
 *
 * `Paper` shows a document as one continuous sheet. `Pages` shows it as the
 * pages it paginates into. Both take their sheet and their fit from here, so
 * the two views cannot disagree about paper.
 */

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";

/** US Letter width in CSS pixels at 96 dpi. */
export const PAPER_WIDTH_PX = 816;
/** US Letter height in CSS pixels at 96 dpi. */
export const PAPER_HEIGHT_PX = 1056;
/** Page margin in CSS pixels. */
export const PAPER_MARGIN_PX = 48;
/** Content height available on one page, once both margins are taken. */
export const PAGE_CONTENT_HEIGHT_PX = PAPER_HEIGHT_PX - PAPER_MARGIN_PX * 2;
/** Content width available on one page, once both margins are taken. */
export const PAGE_CONTENT_WIDTH_PX = PAPER_WIDTH_PX - PAPER_MARGIN_PX * 2;
/** Space between stacked pages on the backdrop, before scaling. */
export const PAGE_GAP_PX = 24;

/** How much of its natural size the sheet is shown at, and the height that reserves. */
export interface Fit {
  scale: number;
  height: number;
}

/**
 * Scales `content` down to the width of `frame`, never up past 1.
 *
 * Only the transform changes, so layout inside the sheet is identical at every
 * container width. The measured height is the scaled one, so the transformed
 * element still reserves the room it occupies.
 */
export function useFitToWidth(
  frameRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>
): Fit {
  const [fit, setFit] = useState<Fit>({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const measure = () => {
      const scale = Math.min(1, frame.clientWidth / PAPER_WIDTH_PX);
      setFit({ scale, height: content.scrollHeight * scale });
    };
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, [frameRef, contentRef]);

  return fit;
}

export interface SheetProps {
  /** 1-based page number, when the sheet is one page of a plan. */
  page?: number;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/** One US Letter sheet at its natural size. */
export function Sheet({ page, className, style, ref, children }: SheetProps) {
  return (
    <div
      ref={ref}
      data-paper-sheet="true"
      data-page={page}
      className={className ?? "paradoc-document relative bg-white shadow-md"}
      style={{
        width: PAPER_WIDTH_PX,
        minHeight: PAPER_HEIGHT_PX,
        padding: PAPER_MARGIN_PX,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface PaperProps {
  className?: string;
  children: ReactNode;
}

/** A document on one continuous sheet, centred and scaled to fit its container. */
export function Paper({ className, children }: PaperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const fit = useFitToWidth(frameRef, sheetRef);

  return (
    <div ref={frameRef} className={className ?? "w-full overflow-hidden bg-neutral-200 p-6"}>
      <div
        className="mx-auto"
        style={{ width: PAPER_WIDTH_PX * fit.scale, height: fit.height || undefined }}
      >
        <Sheet
          ref={sheetRef}
          style={{ transform: `scale(${fit.scale})`, transformOrigin: "top left" }}
        >
          {children}
        </Sheet>
      </div>
    </div>
  );
}
