import { useEffect, useRef, useState } from "react";

import { MissingPdfPainterError, paintPdfPages, type PaintedPdfPage, type PaintPdfOptions } from "../lib/pdf-painter";

export type PartPlacementState = "placed" | "pending" | "attached" | "unplaced";

export interface PartPlacementInput {
  firstPage?: number;
  pageCount?: number;
  attached?: boolean;
  placedFor?: string;
  packetHash?: string;
}

export interface PartPlacementBinding {
  state: PartPlacementState;
  label: string | null;
  firstPage?: number;
  pageCount?: number;
}

/** Resolves packet placement while suppressing stale page numbers. */
export function resolvePartPlacement(input: PartPlacementInput): PartPlacementBinding {
  if (input.attached) return { state: "attached", label: "Attached, not paginated" };
  if (input.firstPage === undefined || input.pageCount === undefined) return { state: "unplaced", label: null };
  if (input.placedFor !== undefined && input.packetHash !== undefined && input.placedFor !== input.packetHash) {
    return { state: "pending", label: "Pages pending" };
  }
  const label = input.pageCount === 1
    ? `Packet page ${input.firstPage}`
    : `Packet pages ${input.firstPage} to ${input.firstPage + input.pageCount - 1}`;
  return { state: "placed", label, firstPage: input.firstPage, pageCount: input.pageCount };
}

export interface PdfPagesOptions extends PaintPdfOptions {
  bytes: Uint8Array;
  filename: string;
  onPaint?: (report: PdfPaintReport) => void;
}

export interface PdfPaintReport { pageCount: number; attached: boolean; warnings: readonly string[]; }
export interface PdfPagesBinding {
  status: "painting" | "painted" | "attached";
  pages: readonly PaintedPdfPage[];
  attachmentReason: string | null;
}

/** Owns the optional PDF painter lifecycle without rendering viewer markup. */
export function usePdfPages({ bytes, onPaint, workerSrc, standardFontDataUrl, cMapUrl, scale, resolution, timeoutMs }: PdfPagesOptions): PdfPagesBinding {
  const [state, setState] = useState<PdfPagesBinding>({ status: "painting", pages: [], attachmentReason: null });
  const publish = useRef(onPaint);
  publish.current = onPaint;
  useEffect(() => {
    let live = true;
    setState({ status: "painting", pages: [], attachmentReason: null });
    const options: PaintPdfOptions = {
      ...(workerSrc !== undefined && { workerSrc }),
      ...(standardFontDataUrl !== undefined && { standardFontDataUrl }),
      ...(cMapUrl !== undefined && { cMapUrl }),
      ...(scale !== undefined && { scale }),
      ...(resolution !== undefined && { resolution }),
      ...(timeoutMs !== undefined && { timeoutMs }),
    };
    void paintPdfPages(bytes, options).then(
      (pages) => {
        if (!live) return;
        setState({ status: "painted", pages, attachmentReason: null });
        publish.current?.({ pageCount: pages.length, attached: false, warnings: [] });
      },
      (error: unknown) => {
        if (!live) return;
        const reason = error instanceof MissingPdfPainterError
          ? "No PDF viewer is installed, so this part is carried as an attachment."
          : `This PDF could not be painted, so it is carried as an attachment. ${error instanceof Error ? error.message : String(error)}`;
        setState({ status: "attached", pages: [], attachmentReason: reason });
        publish.current?.({ pageCount: 0, attached: true, warnings: [reason] });
      }
    );
    return () => { live = false; };
  }, [bytes, workerSrc, standardFontDataUrl, cMapUrl, scale, resolution, timeoutMs]);
  return state;
}
