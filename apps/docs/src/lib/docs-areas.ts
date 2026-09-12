import type { ReactNode } from "react";
import { flattenTree } from "fumadocs-core/page-tree";
import type * as PageTree from "fumadocs-core/page-tree";

/**
 * One header tab: a subtree of the page tree with its own sidebar.
 *
 * Areas derive from the content folders, not from a list kept in the app. A
 * top-level folder whose meta.json sets `root: true` is an area of its own;
 * every other top-level entry belongs to the default area, named after the
 * page tree root (the `title` in `content/docs/meta.json`). An area made of a
 * single page has nothing to list, so it renders without a sidebar.
 */
export interface DocsArea {
  title: string;
  /** Where the tab links to: the area's first page. */
  url: string;
  /** Every page URL in the area, for picking the active tab. */
  urls: ReadonlySet<string>;
  /** The area's own page tree, what the sidebar renders. */
  tree: PageTree.Root;
  sidebar: boolean;
}

export function getDocsAreas(tree: PageTree.Root): DocsArea[] {
  const defaultArea: PageTree.Root = {
    ...tree,
    children: tree.children.filter((node) => !isRootFolder(node)),
  };
  const rootAreas = tree.children.filter(isRootFolder).map(folderToRoot);

  return [defaultArea, ...rootAreas].map(toArea);
}

/** The area holding `url`; the default area when none does. */
export function findDocsArea(areas: readonly DocsArea[], url: string): DocsArea {
  return areas.find((area) => area.urls.has(url)) ?? areas[0];
}

/**
 * Every page belongs to exactly one area. A page that no area lists (a file
 * its folder's meta.json leaves out) would otherwise be dropped from the
 * sidebar without a trace, so this fails the build instead.
 */
export function assertPagesHaveAreas(
  areas: readonly DocsArea[],
  urls: Iterable<string>,
): void {
  const missing: string[] = [];
  const shared: string[] = [];

  for (const url of urls) {
    const count = areas.filter((area) => area.urls.has(url)).length;
    if (count === 0) missing.push(url);
    if (count > 1) shared.push(url);
  }

  if (missing.length > 0) {
    throw new Error(
      `Pages outside every docs area (list them in their folder's meta.json): ${missing.join(", ")}`,
    );
  }
  if (shared.length > 0) {
    throw new Error(`Pages in more than one docs area: ${shared.join(", ")}`);
  }
}

function isRootFolder(node: PageTree.Node): node is PageTree.Folder {
  return node.type === "folder" && node.root === true;
}

function folderToRoot(folder: PageTree.Folder): PageTree.Root {
  return {
    type: "root",
    $id: folder.$id,
    $ref: folder.$ref,
    name: folder.name,
    description: folder.description,
    children: folder.index ? [folder.index, ...folder.children] : folder.children,
  };
}

function toArea(tree: PageTree.Root): DocsArea {
  const title = textOf(tree.name);
  const pages = flattenTree(tree.children);
  if (pages.length === 0) throw new Error(`Docs area "${title}" has no pages`);

  return {
    title,
    url: pages[0].url,
    urls: new Set(pages.map((page) => page.url)),
    tree,
    sidebar: pages.length > 1,
  };
}

function textOf(name: ReactNode): string {
  if (typeof name === "string" && name.length > 0) return name;
  throw new Error(
    "A docs area needs a plain-text name: set `title` in the folder's meta.json",
  );
}
