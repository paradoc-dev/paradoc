// import { create, docs } from "fumadocs-mdx:collections/server";
// import { loader } from "fumadocs-core/source";
// import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
// import { openapiPlugin } from "fumadocs-openapi/server";
// import { icons } from "lucide-react";
// import { createElement } from "react";

// const mdxSource = await create.sourceAsync(docs.doc, docs.meta);

// export const source = loader({
//   baseUrl: "/",
//   source: mdxSource,
//   plugins: [lucideIconsPlugin(), openapiPlugin()],
//   icon(icon) {
//     if (!icon) {
//       // You may set a default icon
//       return;
//     }
//     if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
//   },
// });

// import type { InferPageType } from "fumadocs-core/source";

// export function getPageImage(page: InferPageType<typeof source>) {
//   const segments = [...page.slugs, "image.webp"];
//   return {
//     segments,
//     url: `/og/docs/${segments.join("/")}`,
//   };
// }

import { icons } from "lucide-react";
import { createElement } from "react";

import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";
import type { InferPageType } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (!icon) {
      // You may set a default icon
      return;
    }
    if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
  },
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"];
  return {
    segments,
    url: `/api/og/docs/${segments.join("/")}`,
  };
}
