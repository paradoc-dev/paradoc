declare const __PARADOC_DOCS_PLATFORM_API__: boolean | undefined;

export const platformApiDocsEnabled =
  typeof __PARADOC_DOCS_PLATFORM_API__ !== "undefined"
    ? __PARADOC_DOCS_PLATFORM_API__
    : typeof process !== "undefined" &&
      process.env.PARADOC_DOCS_PLATFORM_API === "true";

export const PLATFORM_API_PAGE = "guides/hosted-sealing-and-conversion.mdx";
export const PLATFORM_ACCESS_PAGE = "guides/platform-access.mdx";
export const PLATFORM_REGISTRY_VERSIONS_PAGE = "guides/registry-versions.mdx";
export const PLATFORM_API_PAGES = [
  PLATFORM_API_PAGE,
  PLATFORM_ACCESS_PAGE,
  PLATFORM_REGISTRY_VERSIONS_PAGE,
] as const;
const PLATFORM_API_META = "guides/meta.json";
const PLATFORM_API_META_ENTRIES = new Set(
  PLATFORM_API_PAGES.map((page) => page.replace(/^.*\//, "").replace(/\.mdx$/, "")),
);

/**
 * The content glob `source.config.ts` compiles when the platform API pages
 * are gated off: every page except the gated ones, by file name.
 */
export const DOCS_FILES_WITHOUT_PLATFORM_API = `**/!(${[
  ...PLATFORM_API_META_ENTRIES,
].join("|")}).{md,mdx}`;

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
    if (file.type === "page" && PLATFORM_API_PAGES.includes(file.path as typeof PLATFORM_API_PAGES[number])) {
      return [];
    }

    if (file.type === "meta" && file.path === PLATFORM_API_META) {
      const data = file.data as { pages?: string[] };
      if (!data.pages) return [file];

      return [
        {
          ...file,
          data: {
            ...data,
            pages: data.pages.filter(
              (page) => !PLATFORM_API_META_ENTRIES.has(page),
            ),
          },
        } as T,
      ];
    }

    return [file];
  });
}
