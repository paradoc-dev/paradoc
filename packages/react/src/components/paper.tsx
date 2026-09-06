/**
 * The paper geometry, and one document shown on a single sheet.
 *
 * The geometry is one geometry, and that is still the point: the preview and
 * the PDF have to agree on it. What changed with tenant branding is where it
 * comes from. It is no longer a constant a caller cannot vary; it is the paper
 * the document's own tokens chose, read off the document element by
 * `documentTokensOf` before anything renders and read again on the other side
 * by the adapters. A caller still cannot set it *here*, on the furniture,
 * because the two outputs would then have two opinions about paper. The
 * constants below are the unbranded default, derived from the same table the
 * tokens resolve through.
 *
 * The sheet keeps its natural width at every window size and only a CSS
 * transform changes, so line wrapping on screen is the wrapping the PDF will
 * have.
 *
 * `Paper` shows a document as one continuous sheet. `Pages` shows it as the
 * pages it paginates into. Both take their sheet and their fit from here, so
 * the two views cannot disagree about paper.
 */

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";

import { documentTokensOf } from "../lib/document-tokens";
import {
  fontFamilyStyle,
  DEFAULT_PAGE_MARGIN_PX,
  PAGE_SIZES,
  type DocumentTokens,
  type PageGeometry,
} from "../lib/tokens";
import {
  drawnPaper,
  DEFAULT_PAGE_GEOMETRY,
  DrawnPaperProvider,
  usePaperGeometry,
  type DrawnPaper,
} from "./paper-geometry";
import { useTokenOverride } from "./tokens-context";

/** US Letter width in CSS pixels at 96 dpi, which is the unbranded paper. */
export const PAPER_WIDTH_PX = PAGE_SIZES.letter.widthPx;
/** US Letter height in CSS pixels at 96 dpi. */
export const PAPER_HEIGHT_PX = PAGE_SIZES.letter.heightPx;
/** Page margin in CSS pixels, when the tokens name none. */
export const PAPER_MARGIN_PX = DEFAULT_PAGE_MARGIN_PX;
/** Content height available on one unbranded page, once both margins are taken. */
export const PAGE_CONTENT_HEIGHT_PX = DEFAULT_PAGE_GEOMETRY.contentHeightPx;
/** Content width available on one unbranded page, once both margins are taken. */
export const PAGE_CONTENT_WIDTH_PX = DEFAULT_PAGE_GEOMETRY.contentWidthPx;
/** Space between stacked pages on the backdrop, before scaling. */
export const PAGE_GAP_PX = 24;

export {
  drawnPaper,
  DEFAULT_PAGE_GEOMETRY,
  DrawnPaperProvider,
  usePaperGeometry,
  type DrawnPaper,
} from "./paper-geometry";

/**
 * The paper the document element chose, and the style the sheet carries for it.
 *
 * `Pages` and `Paper` both need the same two things, resolved the same way, so
 * they ask for them in one place. The resolution is synchronous and pure: the
 * furniture's very first render is already on the right paper, in the browser
 * and in a static render alike, and nothing is read back after a commit.
 */
export function usePaperFor(children: ReactNode): {
  drawn: DrawnPaper;
  tokens: DocumentTokens;
  geometry: PageGeometry;
  sheetStyle: CSSProperties;
} {
  const override = useTokenOverride();
  const drawn = useMemo(
    () => drawnPaper(documentTokensOf(children, override)),
    [children, override]
  );
  const sheetStyle = useMemo<CSSProperties>(() => fontFamilyStyle(drawn.tokens), [drawn]);
  return { drawn, tokens: drawn.tokens, geometry: drawn.geometry, sheetStyle };
}

/** How much of its natural size the sheet is shown at, and the height that reserves. */
export interface Fit {
  scale: number;
  height: number;
}

/**
 * Scales `content` down to `width`, never up past 1.
 *
 * Only the transform changes, so layout inside the sheet is identical at every
 * container width. The measured height is the scaled one, so the transformed
 * element still reserves the room it occupies.
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

export interface SheetProps {
  /** 1-based page number, when the sheet is one page of a plan. */
  page?: number;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/** One sheet of the document's own paper, at its natural size. */
export function Sheet({ page, className, style, ref, children }: SheetProps) {
  const geometry = usePaperGeometry();

  return (
    <div
      ref={ref}
      data-paper-sheet="true"
      data-page={page}
      data-page-size={`${geometry.widthPx}x${geometry.heightPx}`}
      className={className ?? "paradoc-document relative bg-white shadow-md"}
      style={{
        width: geometry.widthPx,
        minHeight: geometry.heightPx,
        padding: geometry.marginPx,
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
  const { drawn, geometry, sheetStyle } = usePaperFor(children);
  const fit = useFitToWidth(frameRef, sheetRef, geometry.widthPx);

  return (
    <DrawnPaperProvider value={drawn}>
      <div ref={frameRef} className={className ?? "w-full overflow-hidden bg-neutral-200 p-6"}>
        <div
          className="mx-auto"
          style={{ width: geometry.widthPx * fit.scale, height: fit.height || undefined }}
        >
          <Sheet
            ref={sheetRef}
            style={{
              ...sheetStyle,
              transform: `scale(${fit.scale})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </Sheet>
        </div>
      </div>
    </DrawnPaperProvider>
  );
}
