import { icons } from "lucide-react";
import { createElement } from "react";

import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";
import type { InferPageType } from "fumadocs-core/source";
import {
  filterDocsFiles,
  platformApiDocsEnabled,
} from "@/lib/docs-features";
import { assertPagesHaveAreas, getDocsAreas } from "@/lib/docs-areas";

const docsSource = docs.toFumadocsSource();

export const source = loader({
  baseUrl: "/",
  source: {
    ...docsSource,
    files: filterDocsFiles(docsSource.files, platformApiDocsEnabled),
  },
  icon(icon) {
    if (!icon) {
      // You may set a default icon
      return;
    }
    if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
  },
});

/**
 * The header tabs and their sidebar trees, one per content area. Built once;
 * a page outside every area fails the build here rather than vanishing from
 * the sidebar.
 */
export const docsAreas = getDocsAreas(source.getPageTree());
assertPagesHaveAreas(
  docsAreas,
  source.getPages().map((page) => page.url),
);

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"];
  return {
    segments,
    url: `/api/og/docs/${segments.join("/")}`,
  };
}
