import { createFileRoute, notFound } from '@tanstack/react-router';
import { source } from '@/lib/source';
import { getPageMarkdown } from '@/lib/page-markdown';

export const Route = createFileRoute('/llms.mdx/docs/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = params._splat?.split('/') ?? [];
        const page = source.getPage(slugs);
        if (!page) throw notFound();

        return new Response(await getPageMarkdown(page), {
          headers: {
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'Content-Type': 'text/markdown; charset=utf-8',
          },
        });
      },
    },
  },
});
