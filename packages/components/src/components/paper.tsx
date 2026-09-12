/** @jsxRuntime classic */
import React from "react";
import {
  DrawnPaperProvider,
  useDocumentSettings,
  useFitToWidth,
  usePaperGeometry,
} from "@paradoc/react";
import { useRef, type CSSProperties, type ReactNode, type Ref } from "react";

export interface SheetProps { page?: number; className?: string; style?: CSSProperties; ref?: Ref<HTMLDivElement>; children: ReactNode }

export function Sheet({ page, className, style, ref, children }: SheetProps) {
  const geometry = usePaperGeometry();
  return <div ref={ref} data-paper-sheet="true" data-page={page} data-page-size={`${geometry.widthPx}x${geometry.heightPx}`} className={className ?? "paradoc-document relative bg-white shadow-md"} style={{ width: geometry.widthPx, minHeight: geometry.heightPx, padding: geometry.marginPx, ...style }}>{children}</div>;
}

export interface PaperProps {
  /** Classes for the outer frame that scales and centers the sheet. */
  className?: string;
  /** Content drawn on the one sheet. */
  children: ReactNode;
}

export function Paper({ className, children }: PaperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { drawn, geometry, sheetStyle } = useDocumentSettings(children);
  const fit = useFitToWidth(frameRef, sheetRef, geometry.widthPx);
  return <DrawnPaperProvider value={drawn}>
    <div ref={frameRef} className={className ?? "w-full overflow-hidden bg-neutral-200 p-6"}>
      <div className="mx-auto" style={{ width: geometry.widthPx * fit.scale, height: fit.height || undefined }}>
        <Sheet ref={sheetRef} style={{ ...sheetStyle, transform: `scale(${fit.scale})`, transformOrigin: "top left" }}>{children}</Sheet>
      </div>
    </div>
  </DrawnPaperProvider>;
}

export { useFitToWidth };
