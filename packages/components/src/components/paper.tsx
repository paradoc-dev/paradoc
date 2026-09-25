/** @jsxRuntime classic */
import React from "react";
import {
  DocumentTokensProvider,
  DrawnPaperProvider,
  FURNITURE_EDGE_INSET_PX,
  FURNITURE_BAND_ATTRIBUTES,
  hasPageFurniture,
  useDocumentSettings,
  useDrawnPaper,
  useFitToWidth,
  useFurnitureFit,
  usePaperGeometry,
  type PageFurniture,
} from "@paradoc/react";
import { useRef, type CSSProperties, type ReactNode, type Ref } from "react";

export interface SheetProps { page?: number; className?: string; style?: CSSProperties; ref?: Ref<HTMLDivElement>; children: ReactNode }

/**
 * One sheet of paper.
 *
 * `isolation` makes the sheet its own stacking context, which is what lets a
 * stamp sit behind the document rather than over it: a layer below the content
 * is a negative z-index, and without a stacking context here that layer would
 * be painted behind the sheet's own white background and disappear.
 */
export function Sheet({ page, className, style, ref, children }: SheetProps) {
  const geometry = usePaperGeometry();
  return <div ref={ref} data-paper-sheet="true" data-page={page} data-page-size={`${geometry.widthPx}x${geometry.heightPx}`} className={className ?? "paradoc-document relative bg-white shadow-md"} style={{ width: geometry.widthPx, minHeight: geometry.heightPx, padding: geometry.marginPx, isolation: "isolate", ...style }}>{children}</div>;
}

export interface PageFurnitureBandsProps {
  /** What this sheet carries outside the flow: a header, a footer, a stamp. */
  furniture?: PageFurniture;
}

/**
 * What a sheet carries on top of the document: the running head, the foot, and
 * the stamp behind both.
 *
 * Every band is drawn inside the margin the document already declares, at the
 * same inset from the paper's edge the PDF engine draws its own bands at, so
 * the content box is untouched and the two outputs put the furniture in the
 * same place. The bands are outside the document's own tree, so they are given
 * its tokens explicitly: a page number that read the package defaults would be
 * a step off the document it numbers.
 */
export function PageFurnitureBands({ furniture }: PageFurnitureBandsProps) {
  const geometry = usePaperGeometry();
  const drawn = useDrawnPaper();
  if (!hasPageFurniture(furniture)) return null;
  const band = (edge: "top" | "bottom"): CSSProperties => ({
    position: "absolute",
    [edge]: FURNITURE_EDGE_INSET_PX,
    left: 0,
    right: 0,
    paddingLeft: geometry.marginPx,
    paddingRight: geometry.marginPx,
  });
  const bands = <>
    {furniture.stamp === undefined ? null : <div data-page-stamp="true" style={{ position: "absolute", inset: 0, zIndex: -1, display: "flex", alignItems: "center", justifyContent: "center" }}>{furniture.stamp}</div>}
    {furniture.header === undefined ? null : <div {...{ [FURNITURE_BAND_ATTRIBUTES.header]: "true" }} style={band("top")}>{furniture.header}</div>}
    {furniture.footer === undefined ? null : <div {...{ [FURNITURE_BAND_ATTRIBUTES.footer]: "true" }} style={band("bottom")}>{furniture.footer}</div>}
  </>;
  return drawn === null ? bands : <DocumentTokensProvider tokens={drawn.tokens}>{bands}</DocumentTokensProvider>;
}

export interface PageFurnitureMeasureProps {
  /** What every sheet carries; only its header and footer are measured. */
  furniture?: PageFurniture;
  /** The layer `useFurnitureFit` measures the bands in. */
  measureRef: Ref<HTMLDivElement>;
  /** The document's settings, so a band lays out as it does on a sheet. */
  style?: CSSProperties;
}

/**
 * The header and footer laid out once, off screen and unscaled, at the sheet's
 * width, so their heights can be checked against the margin before a band is
 * drawn over the first line of a sheet.
 */
export function PageFurnitureMeasure({ furniture, measureRef, style }: PageFurnitureMeasureProps) {
  const geometry = usePaperGeometry();
  if (furniture?.header === undefined && furniture?.footer === undefined) return null;
  return <div ref={measureRef} data-furniture-measure="true" className="paradoc-document" aria-hidden="true" style={{ ...style, position: "fixed", insetInlineStart: -10000, top: 0, visibility: "hidden", pointerEvents: "none", width: geometry.widthPx, height: geometry.heightPx }}>
    <PageFurnitureBands furniture={{ header: furniture.header, footer: furniture.footer }} />
  </div>;
}

export interface PaperProps {
  /** Classes for the outer frame that scales and centers the sheet. */
  className?: string;
  /**
   * What every sheet carries outside the flow: a header, a footer, a stamp.
   * Drawn inside the document's margin, so the page count does not change.
   */
  furniture?: PageFurniture;
  /** Content drawn on the one sheet. */
  children: ReactNode;
}

export function Paper({ className, furniture, children }: PaperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { drawn, geometry, sheetStyle } = useDocumentSettings(children);
  const fit = useFitToWidth(frameRef, sheetRef, geometry.widthPx);
  const bands = useFurnitureFit(geometry.marginPx);
  if (bands.error) throw bands.error;
  return <DrawnPaperProvider value={drawn}>
    <div ref={frameRef} className={className ?? "w-full overflow-hidden bg-neutral-200 p-6"}>
      <div className="mx-auto" style={{ width: geometry.widthPx * fit.scale, height: fit.height || undefined }}>
        <Sheet ref={sheetRef} style={{ ...sheetStyle, transform: `scale(${fit.scale})`, transformOrigin: "top left" }}><PageFurnitureBands furniture={furniture} />{children}</Sheet>
      </div>
    </div>
    <PageFurnitureMeasure furniture={furniture} measureRef={bands.measureRef} style={sheetStyle} />
  </DrawnPaperProvider>;
}

export { useFitToWidth };
