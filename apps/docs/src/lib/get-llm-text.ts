import type { source } from "@/lib/source";
import type { InferPageType } from "fumadocs-core/source";
import { getPageMarkdown } from "@/lib/page-markdown";

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await getPageMarkdown(page);

  return `# ${page.data.title} (${page.url})

${processed}`;
}
