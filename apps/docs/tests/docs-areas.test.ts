/**
 * The header tabs and their sidebar trees derive from the content folders.
 *
 * The first half builds a page tree from the real `content/docs` folder, the
 * way the site does, and checks the three areas and what each one lists. The
 * second half pins the rules on a small synthetic tree.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { loader, type VirtualFile } from "fumadocs-core/source";
import type * as PageTree from "fumadocs-core/page-tree";
import {
  assertPagesHaveAreas,
  findDocsArea,
  getDocsAreas,
} from "@/lib/docs-areas";

const contentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../content/docs",
);

/** The content folder as the virtual files fumadocs builds its tree from. */
function readContentFiles(dir = "") {
  const files: VirtualFile[] = [];
  for (const entry of readdirSync(path.join(contentDir, dir), {
    withFileTypes: true,
  })) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...readContentFiles(relative));
    } else if (entry.name === "meta.json") {
      files.push({
        type: "meta",
        path: relative,
        data: JSON.parse(readFileSync(path.join(contentDir, relative), "utf8")),
      });
    } else if (entry.name.endsWith(".mdx")) {
      const text = readFileSync(path.join(contentDir, relative), "utf8");
      const title = text.match(/^title:\s*"?([^"\n]+)"?$/m)?.[1];
      files.push({ type: "page", path: relative, data: { title } });
    }
  }
  return files;
}

/** Separator names keep the padding from `--- Label ---`; trim it away. */
function label(node: PageTree.Node) {
  return typeof node.name === "string" ? node.name.trim() : node.name;
}

function names(nodes: PageTree.Node[]) {
  return nodes.map((node) =>
    node.type === "separator" ? `--- ${label(node)} ---` : node.name,
  );
}

/** Nodes after the separator named `label`, up to the next separator. */
function group(tree: PageTree.Root, name: string) {
  const start = tree.children.findIndex(
    (node) => node.type === "separator" && label(node) === name,
  );
  expect(start, `group "${name}"`).toBeGreaterThanOrEqual(0);
  const rest = tree.children.slice(start + 1);
  const end = rest.findIndex((node) => node.type === "separator");
  return rest.slice(0, end === -1 ? undefined : end);
}

describe("the docs areas, from the content folders", () => {
  const source = loader({ baseUrl: "/", source: { files: readContentFiles() } });
  const areas = getDocsAreas(source.getPageTree());
  const [docs, components, changelog] = areas;

  test("are Docs, Components and Changelog, in that order", () => {
    expect(areas.map((area) => area.title)).toEqual([
      "Docs",
      "Components",
      "Changelog",
    ]);
    expect(areas.map((area) => area.url)).toEqual([
      "/",
      "/components",
      "/changelog",
    ]);
  });

  test("Docs lists the guides and the Reference group, without the other areas", () => {
    expect(names(docs.tree.children)).toEqual([
      "Welcome",
      "Quickstart",
      "Concepts",
      "Guides",
      "--- Reference ---",
      "Schemas",
      "SDK",
      "CLI",
      "MCP",
      "Skill",
      "AI",
    ]);
    expect(docs.sidebar).toBe(true);
  });

  test("Components lists Getting started, the components alphabetically, then the blocks", () => {
    expect(names(group(components.tree, "Getting started"))).toEqual([
      "Overview",
      "Installation",
      "Typography",
    ]);

    const componentPages = names(group(components.tree, "Components")) as string[];
    expect(componentPages).toEqual(
      [...componentPages].sort((a, b) => a.localeCompare(b)),
    );
    const componentFiles = readdirSync(path.join(contentDir, "components"))
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => file.replace(/\.mdx$/, ""))
      .filter((file) => !["index", "installation", "typography"].includes(file));
    expect(componentPages).toHaveLength(componentFiles.length);

    const blockFiles = readdirSync(path.join(contentDir, "components/blocks"))
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => file.replace(/\.mdx$/, ""));
    expect(names(group(components.tree, "Blocks"))).toHaveLength(
      blockFiles.length,
    );

    expect(
      components.tree.children.filter((node) => node.type === "separator"),
    ).toHaveLength(3);
    expect(components.tree.children.every((node) => node.type !== "folder")).toBe(
      true,
    );
    expect(components.sidebar).toBe(true);
  });

  test("Changelog is a single page without a sidebar", () => {
    expect([...changelog.urls]).toEqual(["/changelog"]);
    expect(changelog.sidebar).toBe(false);
  });

  test("every page belongs to exactly one area", () => {
    const urls = source.getPages().map((page) => page.url);
    expect(() => assertPagesHaveAreas(areas, urls)).not.toThrow();
    expect(findDocsArea(areas, "/components/table")).toBe(components);
    expect(findDocsArea(areas, "/quickstart")).toBe(docs);
  });
});

describe("the docs area rules", () => {
  const page = (url: string): PageTree.Item => ({
    type: "page",
    name: url,
    url,
  });
  const tree: PageTree.Root = {
    name: "Docs",
    children: [
      page("/"),
      { type: "folder", name: "Guides", children: [page("/guides/a")] },
      {
        type: "folder",
        name: "Notes",
        root: true,
        children: [page("/notes"), page("/notes/a")],
      },
      { type: "folder", name: "Log", root: true, children: [page("/log")] },
    ],
  };
  const areas = getDocsAreas(tree);

  test("root folders become areas after the default one", () => {
    expect(areas.map((area) => area.title)).toEqual(["Docs", "Notes", "Log"]);
    expect(names(areas[0].tree.children)).toEqual(["/", "Guides"]);
    expect(areas[1].url).toBe("/notes");
  });

  test("a single-page area renders without a sidebar", () => {
    expect(areas.map((area) => area.sidebar)).toEqual([true, true, false]);
  });

  test("an unknown URL falls back to the default area", () => {
    expect(findDocsArea(areas, "/nowhere")).toBe(areas[0]);
  });

  test("a page outside every area fails the build", () => {
    expect(() => assertPagesHaveAreas(areas, ["/", "/orphan"])).toThrow(
      /\/orphan/,
    );
  });

  test("an area needs a plain-text name", () => {
    expect(() => getDocsAreas({ ...tree, name: undefined })).toThrow(/title/);
  });
});
