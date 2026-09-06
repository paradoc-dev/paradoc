/**
 * What a keep reads to decide whether it renders on the page it is inside.
 *
 * Pagination moves no DOM node and duplicates no markup. The one tree is
 * rendered once per page, and each keep asks this context whether it belongs
 * on that page. Outside a page — the measuring pass, a plain `Paper`, a test
 * rendering the document on its own — there is no context and every keep
 * renders, which is what makes the measuring pass see the whole document.
 */

import { createContext, useContext } from "react";

import type { PagePlan } from "../lib/plan";

/** What one page of the plan supplies to the tree rendered inside it. */
export interface PageContextValue {
  /** The plan the whole preview was laid out from. */
  plan: PagePlan;
  /** 0-based index of this page. */
  index: number;
  /** KeepTogether ids on this page, including a repeated table header. */
  keeps: ReadonlySet<string>;
  /** KeepTogether ids on this page that are copies rather than the keep's own place. */
  repeats: ReadonlySet<string>;
  /** Section ids with at least one keep on this page. */
  sections: ReadonlySet<string>;
}

const PageContext = createContext<PageContextValue | null>(null);

/** Provides one page's slice of the plan. `Page` supplies it. */
export const PageContextProvider = PageContext.Provider;

/** The page currently rendering, or `null` outside a paginated preview. */
export function usePage(): PageContextValue | null {
  return useContext(PageContext);
}

/** The plan the preview was laid out from, or `null` outside a paginated preview. */
export function usePagePlan(): PagePlan | null {
  return useContext(PageContext)?.plan ?? null;
}

/** True when this keep renders here. Unpaginated, every keep renders. */
export function useKeepVisible(id: string): boolean {
  const page = useContext(PageContext);
  return page === null || page.keeps.has(id);
}

/** True when this section has a keep on this page. Unpaginated, every section renders. */
export function useSectionVisible(id: string): boolean {
  const page = useContext(PageContext);
  return page === null || page.sections.has(id);
}
