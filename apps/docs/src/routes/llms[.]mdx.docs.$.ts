import { createFileRoute, notFound } from '@tanstack/react-router';
import { source } from '@/lib/source';
import { getPageMarkdown } from '@/lib/page-markdown';
import { canonicalDocsUrl } from '@/lib/canonical-url';

export const Route = createFileRoute('/llms.mdx/docs/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = params._splat?.split('/') ?? [];
        const page = source.getPage(slugs);
        if (!page) throw notFound();

        const body = await getPageMarkdown(page);
        const markdown = [
          `# ${page.data.title}`,
          page.data.description?.trim(),
          `Canonical URL: ${canonicalDocsUrl(page.url)}`,
          body.trim(),
        ]
          .filter(Boolean)
          .join('\n\n');

        return new Response(`${markdown}\n`, {
          headers: {
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'Content-Type': 'text/markdown; charset=utf-8',
          },
        });
      },
    },
  },
});
