import type { PageCounter } from "@paradoc/react";
export const PAGE_COUNTER_CLASSES: Readonly<Record<PageCounter, string>> = {
  current: "pageNumber",
  total: "totalPages",
};
export function isPageCounter(value: string | undefined): value is PageCounter {
  return value !== undefined && value in PAGE_COUNTER_CLASSES;
}
