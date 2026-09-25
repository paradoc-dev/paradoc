import { createFileRoute } from '@tanstack/react-router';
import { source } from '@/lib/source';
import { getLLMText } from '@/lib/get-llm-text';

const fullText = Promise.all(source.getPages().map(getLLMText)).then((pages) =>
  pages.join('\n\n'),
);

export const Route = createFileRoute('/llms-full.txt')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(await fullText, {
          headers: {
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      },
    },
  },
});
