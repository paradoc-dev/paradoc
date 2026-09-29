/** The explicit Markdown URL of a docs page, as a path on the docs host. */
export function pageMarkdownUrl(url: string): string {
  return url === "/" ? "/index.md" : `${url.replace(/\/+$/, "")}.md`;
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
