export function pageMarkdownUrl(url: string): string {
  return `/llms.mdx/docs${url === "/" ? "" : url}`;
}

export function pageGitHubUrl(filePath: string): string {
  if (
    filePath === "changelog/index.mdx" ||
    /^changelog\/v\d+\.\d+\.\d+\.mdx$/.test(filePath)
  ) {
    return "https://github.com/paradoc-dev/paradoc/blob/main/CHANGELOG.md";
  }
  return `https://github.com/paradoc-dev/paradoc/blob/main/apps/docs/content/docs/${filePath}`;
}
