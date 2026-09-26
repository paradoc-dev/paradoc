import type { source } from "@/lib/source";
import type { InferPageType } from "fumadocs-core/source";
import { getPageMarkdown } from "@/lib/page-markdown";
import { canonicalDocsUrl } from "@/lib/canonical-url";

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await getPageMarkdown(page);

  const description = page.data.description?.trim();

  return [
    `# ${page.data.title}`,
    description,
    `Canonical URL: ${canonicalDocsUrl(page.url)}`,
    processed.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}
