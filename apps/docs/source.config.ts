import { defineDocs, defineConfig, frontmatterSchema } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";

// Typescript (for AutoTypeTable)
import {
  remarkAutoTypeTable,
  createGenerator,
  createFileSystemGeneratorCache,
} from 'fumadocs-typescript';

const generator = createGenerator({
  // recommended: choose a directory for cache
  cache: createFileSystemGeneratorCache('.tanstack/fumadocs-typescript'),
});

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: frontmatterSchema.extend({
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
    remarkPlugins: [[remarkAutoTypeTable, { generator }]],
  },
  plugins: [lastModified()],
});
