/** @jsxRuntime classic */
import React from "react";
import {
  DrawnPaperProvider,
  PAGE_GAP_PX,
  PageContextProvider,
  useDocumentSettings,
  useFitToWidth,
  usePagination,
  usePaperGeometry,
  type PageContextValue,
  type PagePlan,
} from "@paradoc/react";
import { useMemo, useRef, type ReactNode } from "react";
import { Sheet } from "./paper";

export interface PageProps { plan: PagePlan; index: number; children: ReactNode }

export function Page({ plan, index, children }: PageProps) {
  const value = useMemo<PageContextValue>(() => ({ plan, index, keeps: new Set(plan.pages[index] ?? []), repeats: new Set(plan.repeats[index] ?? []), sections: new Set(plan.sections[index] ?? []) }), [plan, index]);
  const geometry = usePaperGeometry();
  const oversize = plan.oversize.filter((keep) => value.keeps.has(keep.id));
  return <Sheet page={index + 1} style={{ height: geometry.heightPx }}>
    {oversize.map((keep) => <div key={keep.id} data-oversize-keep={keep.id} className="absolute right-2 top-2 rounded bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white">{`Oversize keep "${keep.id}": ${Math.round(keep.height)} px of ${plan.budget} px`}</div>)}
    <PageContextProvider value={value}>{children}</PageContextProvider>
  </Sheet>;
}

export interface PagesProps { className?: string; onPaginate?: (plan: PagePlan) => void; children: ReactNode }

export function Pages({ className, onPaginate, children }: PagesProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const { drawn, geometry, sheetStyle } = useDocumentSettings(children);
  const fit = useFitToWidth(frameRef, stackRef, geometry.widthPx);
  const pagination = usePagination({ budget: geometry.contentHeightPx, onPaginate });
  if (pagination.error) throw pagination.error;
  const sheets = pagination.plan === null ? 0 : Math.max(1, pagination.plan.pages.length);
  return <DrawnPaperProvider value={drawn}>
    <div ref={frameRef} className={className ?? "w-full overflow-hidden bg-neutral-200 p-6"}>
      <div className="mx-auto" style={{ width: geometry.widthPx * fit.scale, height: fit.height || undefined }}>
        <div ref={stackRef} data-page-stack="true" className="flex flex-col" style={{ ...sheetStyle, width: geometry.widthPx, gap: PAGE_GAP_PX, transform: `scale(${fit.scale})`, transformOrigin: "top left" }}>
          {pagination.plan ? Array.from({ length: sheets }, (_sheet, index) => <Page key={index} plan={pagination.plan!} index={index}>{children}</Page>) : null}
        </div>
      </div>
    </div>
    <div ref={pagination.measureRef} data-paper-measure="true" className="paradoc-document" aria-hidden="true" style={{ ...sheetStyle, position: "fixed", insetInlineStart: -10000, top: 0, visibility: "hidden", pointerEvents: "none", width: geometry.contentWidthPx }}>{children}</div>
  </DrawnPaperProvider>;
}
