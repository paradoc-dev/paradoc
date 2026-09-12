/**
 * A PDF part of a packet, page by page.
 *
 * The specification says a bundle shows a PDF-form part's filled pages in line
 * and an annex as its pages, or as a named attachment when it cannot be
 * painted. That is this file: `PdfPages` paints, `Attachment` is the fallback,
 * and the fallback is visible and says why rather than leaving a gap.
 *
 * These pages are not planned. A composition's pages come from a plan this
 * package computes, because the composition is a tree it owns. A PDF already
 * has its pages, at its own paper size, and painting them at any size but their
 * own would be a second opinion about a document that is already final. So a
 * painted part keeps its own paper even inside a packet branded to another.
 */
/** @jsxRuntime classic */
import React from "react";
import { useRef } from "react";
import { scaleTextClasses, useDocumentTokens, useFitToWidth, usePdfPages, type PdfPaintReport } from "@paradoc/react";

export interface AttachmentProps {
  /** Name the packet carries the content under. */
  filename: string;
  /** What the content is. */
  mimeType: string;
  /** Size of the content in bytes, when the caller knows it. */
  byteLength?: number;
  /** Why it is an attachment rather than pages. */
  reason: string;
  /** Application-owned classes on the attachment card. */
  className?: string;
}

/** How many bytes, in the units a reader uses. */
function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A part of the packet that is carried rather than painted. */
export function Attachment({
  filename,
  mimeType,
  byteLength,
  reason,
  className,
}: AttachmentProps) {
  const { typography } = useDocumentTokens();
  return (
    <div
      data-attachment={filename}
      className={
        className ??
        "mx-6 flex flex-col gap-1 rounded border border-dashed border-neutral-400 bg-white p-4"
      }
    >
      <span className={scaleTextClasses("text-sm font-medium text-neutral-900", typography.scale)}>{filename}</span>
      <span className={scaleTextClasses("text-xs text-neutral-600", typography.scale)}>
        {mimeType}
        {byteLength === undefined ? "" : ` · ${readableSize(byteLength)}`}
      </span>
      <span data-attachment-reason="true" className={scaleTextClasses("text-xs text-neutral-500", typography.scale)}>
        {reason}
      </span>
    </div>
  );
}

/** What a paint produced, whether or not it painted anything. */
export type { PdfPaintReport } from "@paradoc/react";

export interface PdfPagesProps {
  /**
   * The PDF to paint.
   *
   * **The reference must be stable.** Painting restarts whenever this changes,
   * and a host that builds a fresh `Uint8Array` on every render repaints
   * forever. Hold the bytes in state or a memo, as the sealed packet's own
   * `parts[n].content` already is.
   */
  bytes: Uint8Array;
  /** Name to fall back to when the content cannot be painted. */
  filename: string;
  /**
   * What the content is.
   * @default "application/pdf"
   */
  mimeType?: string;
  /** Where pdf.js loads its worker from. See `paintPdfPages`. */
  workerSrc?: string;
  /** Where pdf.js loads the standard fourteen fonts from. See `paintPdfPages`. */
  standardFontDataUrl?: string;
  /** Where pdf.js loads its CMaps from. See `paintPdfPages`. */
  cMapUrl?: string;
  /**
   * CSS pixels per PDF point. See `paintPdfPages`.
   * @default 96 / 72
   */
  scale?: number;
  /**
   * How long the paint may take before the part becomes an attachment.
   * @default 20000
   */
  timeoutMs?: number;
  /** Called once the paint has settled, painted or not. */
  onPaint?: (report: PdfPaintReport) => void;
  /** Application-owned classes on the frame the painted pages sit in. */
  className?: string;
}

/**
 * Every page of a PDF, painted at its own size and scaled to fit the container.
 *
 * A document that cannot be painted becomes an `Attachment` naming the reason.
 * That is the specification's fallback, not a failure to report: the part is
 * still in the packet and still sealed.
 */
export function PdfPages({
  bytes,
  filename,
  mimeType = "application/pdf",
  workerSrc,
  standardFontDataUrl,
  cMapUrl,
  scale,
  timeoutMs,
  onPaint,
  className,
}: PdfPagesProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const { typography } = useDocumentTokens();
  const stackRef = useRef<HTMLDivElement>(null);
  const binding = usePdfPages({ bytes, filename, onPaint, workerSrc, standardFontDataUrl, cMapUrl, scale, timeoutMs });
  const pages = binding.pages;

  const naturalWidth = pages?.reduce((widest, page) => Math.max(widest, page.widthPx), 0) ?? 0;
  const fit = useFitToWidth(frameRef, stackRef, naturalWidth || 1);

  if (binding.attachmentReason !== null) {
    return (
      <Attachment
        filename={filename}
        mimeType={mimeType}
        byteLength={bytes.length}
        reason={binding.attachmentReason}
      />
    );
  }

  return (
    <div ref={frameRef} className={className ?? "w-full overflow-hidden bg-neutral-200 p-6"}>
      {binding.status === "painting" ? (
        <p data-painting="true" className={scaleTextClasses("text-xs text-neutral-500", typography.scale)}>
          Painting {filename}…
        </p>
      ) : (
        <div
          className="mx-auto"
          style={{ width: naturalWidth * fit.scale, height: fit.height || undefined }}
        >
          <div
            ref={stackRef}
            data-painted-stack={filename}
            className="flex flex-col"
            style={{
              width: naturalWidth,
              gap: 24,
              transform: `scale(${fit.scale})`,
              transformOrigin: "top left",
            }}
          >
            {pages.map((page) => (
              <img
                key={page.pageNumber}
                src={page.src}
                alt={`${filename} page ${page.pageNumber}`}
                data-paper-sheet="true"
                data-painted-page="true"
                data-page={page.pageNumber}
                width={page.widthPx}
                height={page.heightPx}
                className="bg-white shadow-md"
                style={{ width: page.widthPx, height: page.heightPx }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
