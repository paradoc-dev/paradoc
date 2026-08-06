declare const __PARADOC_DOCS_PLATFORM_API__: boolean | undefined;

export const platformApiDocsEnabled =
  typeof __PARADOC_DOCS_PLATFORM_API__ !== "undefined"
    ? __PARADOC_DOCS_PLATFORM_API__
    : typeof process !== "undefined" &&
      process.env.PARADOC_DOCS_PLATFORM_API === "true";

const PLATFORM_API_PAGE = "guides/hosted-sealing-and-conversion.mdx";
const PLATFORM_API_META = "guides/meta.json";
const PLATFORM_API_META_ENTRY = "hosted-sealing-and-conversion";

interface DocsFile {
  type: string;
  path: string;
  data: unknown;
}

/** Remove unreleased platform API pages before Fumadocs builds its source. */
export function filterDocsFiles<T extends DocsFile>(
  files: readonly T[],
  enabled: boolean,
): T[] {
  if (enabled) return [...files];

  return files.flatMap((file) => {
    if (file.type === "page" && file.path === PLATFORM_API_PAGE) return [];

    if (file.type === "meta" && file.path === PLATFORM_API_META) {
      const data = file.data as { pages?: string[] };
      if (!data.pages) return [file];

      return [
        {
          ...file,
          data: {
            ...data,
            pages: data.pages.filter(
              (page) => page !== PLATFORM_API_META_ENTRY,
            ),
          },
        } as T,
      ];
    }

    return [file];
  });
}
