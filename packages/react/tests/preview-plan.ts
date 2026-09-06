/**
 * The page plan the preview produces for the overflow sample, in one place.
 *
 * A plan is a browser measurement and neither adapter test has a browser, so
 * both are held to the plan the lab measured and the README records: four
 * pages, breaking at these rows, with the table header copied onto each
 * continued page. Two copies of it could drift apart and then each adapter
 * would be checked against a different document.
 */

import type { PageBreakPlan } from "../src/pdf";

/** The plan itself, plus the page count it describes. */
export const PREVIEW_PLAN: PageBreakPlan & { pages: number } = {
  pages: 4,
  breaks: ["line-items:13", "line-items:39", "line-items:65"],
  repeats: [[], ["line-items:header"], ["line-items:header"], ["line-items:header"]],
};
