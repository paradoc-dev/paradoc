import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { pageSchema } from "fumadocs-core/source/schema";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import { z } from "zod";

// Typescript (for AutoTypeTable)
import {
  remarkAutoTypeTable,
  createGenerator,
  createFileSystemGeneratorCache,
} from 'fumadocs-typescript';
import { remarkSchemaVersion } from './src/lib/schema-version';

const generator = createGenerator({
  // recommended: choose a directory for cache
  cache: createFileSystemGeneratorCache('.tanstack/fumadocs-typescript'),
});

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
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
    remarkPlugins: [remarkSchemaVersion, [remarkAutoTypeTable, { generator }]],
  },
  plugins: [lastModified()],
});
