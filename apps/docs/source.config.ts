import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { pageSchema } from "fumadocs-core/source/schema";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";

import {
  filterMdxComponent,
  stringifyMdxComponent,
} from "./src/lib/markdown-components";
import { remarkSchemaVersion } from './src/lib/schema-version';
import { DOCS_FILES_WITHOUT_PLATFORM_API } from "./src/lib/docs-features";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    files:
      process.env.PARADOC_DOCS_PLATFORM_API === "true"
        ? ["**/*.{md,mdx}"]
        : [DOCS_FILES_WITHOUT_PLATFORM_API],
    schema: pageSchema.extend({
      ogTitle: z.string().optional(),
      ogDescription: z.string().optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: {
        headingIds: false,
        filterElement: filterMdxComponent,
        stringify: stringifyMdxComponent,
      },
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkSchemaVersion],
  },
  plugins: [lastModified()],
});
