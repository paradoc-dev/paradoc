import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { pageSchema } from "fumadocs-core/source/schema";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";

import { remarkSchemaVersion } from './src/lib/schema-version';

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    files:
      process.env.PARADOC_DOCS_PLATFORM_API === "true"
        ? ["**/*.{md,mdx}"]
        : ["**/!(hosted-sealing-and-conversion).{md,mdx}"],
    schema: pageSchema.extend({
      ogTitle: z.string().optional(),
      ogDescription: z.string().optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkSchemaVersion],
  },
  plugins: [lastModified()],
});
