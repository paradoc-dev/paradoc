import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { describe, expect, test } from "vitest";

const CONTENT_DIR = path.resolve(__dirname, "../content/docs");

const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

function mdxPages(): string[] {
	return readdirSync(CONTENT_DIR, { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(".mdx"))
		.map((file) => file.split(path.sep).join("/"))
		.sort();
}

/** Compile MDX source the way the docs build parses it: GFM, no frontmatter. */
async function compileMdx(source: string): Promise<void> {
	await compile(source.replace(FRONTMATTER, ""), {
		remarkPlugins: [remarkGfm],
	});
}

describe("docs MDX pages", () => {
	const pages = mdxPages();

	test("finds the docs pages", () => {
		expect(pages.length).toBeGreaterThan(50);
	});

	test.each(pages)("%s compiles", async (page) => {
		const source = readFileSync(path.join(CONTENT_DIR, page), "utf8");
		await expect(compileMdx(source)).resolves.toBeUndefined();
	});

	test("rejects an unescaped quote inside a JS string", async () => {
		const source =
			"<TypeTable type={{ code: { description: 'a self-issued form's own number' } }} />\n";
		await expect(compileMdx(source)).rejects.toThrow();
	});
});
