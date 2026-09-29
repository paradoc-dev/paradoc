import { describe, expect, test } from "vitest";

import {
  filterMdxComponent,
  stringifyMdxComponent,
} from "@/lib/markdown-components";

type Attribute = { type: string; name: string; value: unknown };

function literal(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { type: "ArrayExpression", elements: value.map(literal) };
  }
  if (value && typeof value === "object") {
    return {
      type: "ObjectExpression",
      properties: Object.entries(value).map(([key, item]) => ({
        type: "Property",
        computed: false,
        key: { type: "Identifier", name: key },
        value: literal(item),
      })),
    };
  }
  return { type: "Literal", value };
}

const expression = (name: string, value: unknown): Attribute => ({
  type: "mdxJsxAttribute",
  name,
  value: {
    type: "mdxJsxAttributeValueExpression",
    data: { estree: { body: [{ type: "ExpressionStatement", expression: literal(value) }] } },
  },
});
const string = (name: string, value: string): Attribute => ({
  type: "mdxJsxAttribute",
  name,
  value,
});

function jsx(name: string, attributes: Attribute[] = [], children: unknown[] = []) {
  return { type: "mdxJsxFlowElement", name, attributes, children };
}

/** Flow content: paragraphs carry their own Markdown, components recurse. */
const state: {
  containerFlow(node: unknown, info: unknown): string;
} = {
  containerFlow: (node) =>
    ((node as { children: { md?: string; type: string }[] }).children ?? [])
      .map(
        (child) =>
          child.md ?? stringifyMdxComponent(child, node, state, {}) ?? "",
      )
      .join("\n\n"),
};
const render = (node: ReturnType<typeof jsx>) =>
  stringifyMdxComponent(node, undefined, state, {});
const md = (text: string) => ({ type: "paragraph", md: text });

describe("docs components as Markdown", () => {
  test("writes a properties table, escaping table syntax and marking optional and method rows", () => {
    const output = render(
      jsx("PropertiesTable", [
        expression("properties", [
          { name: "id", type: "string | number", description: "The id" },
          { name: "note", type: "string", description: "Free\ntext", isOptional: true },
          { name: "render", type: "() => void", description: "Draw it", isMethod: true },
        ]),
      ]),
    );
    expect(output).toBe(
      [
        "| Name | Type | Description |",
        "| --- | --- | --- |",
        "| `id` | `string \\| number` | The id |",
        "| `note?` | `string` | Free text |",
        "",
        "**Methods**",
        "",
        "| Name | Type | Description |",
        "| --- | --- | --- |",
        "| `render` | `() => void` | Draw it |",
      ].join("\n"),
    );
  });

  test("writes method tables and chains with their signatures and return types", () => {
    const table = render(
      jsx("MethodTable", [
        expression("methods", [
          { name: ".parse", params: "input: unknown", returns: "Money", description: "Parse it" },
        ]),
      ]),
    );
    expect(table).toContain("| `parse(input: unknown)` | `Money` | Parse it |");

    const chain = render(
      jsx("MethodChain", [
        string("starter", "p.form()"),
        expression("methods", [
          { name: "name", params: "value: string", description: "Set the name" },
          { name: "build", params: "", description: "Build it", terminal: true },
        ]),
        expression("returns", { intermediate: "FormBuilder", terminal: "Form" }),
      ]),
    );
    expect(chain).toContain("Start with `p.form()`. Each method returns `FormBuilder` and can be chained.");
    expect(chain).toContain("| `name(value: string)` | Set the name |");
    expect(chain).toContain("Terminal methods return `Form`.");
    expect(chain).toContain("| `build()` | Build it |");
  });

  test("keeps every tab alternative under its label", () => {
    const output = render(
      jsx("Tabs", [], [
        jsx("Tab", [string("value", "npm")], [md("```bash\nnpm i x\n```")]),
        jsx("Tab", [string("value", "pnpm")], [md("```bash\npnpm add x\n```")]),
      ]),
    );
    expect((output ?? "").replace(/\n{3,}/g, "\n\n")).toBe(
      "**npm**\n\n```bash\nnpm i x\n```\n\n**pnpm**\n\n```bash\npnpm add x\n```",
    );
    expect(filterMdxComponent({ type: "mdxJsxFlowElement", name: "CodeBlockTabsList" })).toBe(false);
    expect(filterMdxComponent({ type: "mdxJsxFlowElement", name: "Tab" })).toBe(true);
  });

  test("writes callouts as labeled block quotes and cards as a link list", () => {
    expect(
      render(jsx("Callout", [string("type", "warn")], [md("Needs Node.\n\nSee docs.")])),
    ).toBe("> **Warning:** Needs Node.\n>\n> See docs.");
    expect(render(jsx("Callout", [], [md("Heads up.")]))).toBe("> **Note:** Heads up.");
    expect(
      render(
        jsx("Cards", [], [
          jsx("Card", [string("title", "Quickstart"), string("href", "/quickstart")], [md("Start here")]),
          jsx("Card", [string("title", "Guides")], []),
        ]),
      ),
    ).toBe("- [Quickstart](/quickstart): Start here\n- Guides");
  });

  test("leaves registry-backed elements and plain nodes for later expansion", () => {
    expect(render(jsx("ComponentInstallation", [string("name", "text")]))).toBeUndefined();
    expect(
      stringifyMdxComponent({ type: "paragraph" }, undefined, state, {}),
    ).toBeUndefined();
    expect(render(jsx("div"))).toBeUndefined();
  });

  test("fails the build for a component with no Markdown form", () => {
    expect(() => render(jsx("Mystery"))).toThrow(/<Mystery> has no Markdown form/);
  });

  test("reads template literals, and refuses computed keys", () => {
    const table = (properties: unknown) =>
      render(jsx("PropertiesTable", [{ type: "mdxJsxAttribute", name: "properties", value: { data: { estree: { body: [{ type: "ExpressionStatement", expression: properties }] } } } }]));
    const template = (cooked: string[]) => ({
      type: "TemplateLiteral",
      quasis: cooked.map((value) => ({ value: { cooked: value } })),
    });
    const row = (description: unknown) => ({
      type: "ArrayExpression",
      elements: [
        {
          type: "ObjectExpression",
          properties: [
            { type: "Property", computed: false, key: { type: "Identifier", name: "name" }, value: literal("n") },
            { type: "Property", computed: false, key: { type: "Identifier", name: "type" }, value: literal("t") },
            { type: "Property", computed: false, key: { type: "Identifier", name: "description" }, value: description },
          ],
        },
      ],
    });
    expect(table(row(template(["plain"])))).toContain("| `n` | `t` | plain |");
    expect(() => table(row(template(["a", "b"])))).toThrow(/TemplateLiteral/);
    expect(() =>
      table({
        type: "ArrayExpression",
        elements: [{ type: "ObjectExpression", properties: [{ type: "Property", computed: true, key: literal("k"), value: literal(1) }] }],
      }),
    ).toThrow(/plain object properties/);
  });

  test("refuses props it cannot read without running them", () => {
    const bad = {
      type: "mdxJsxAttribute",
      name: "methods",
      value: {
        data: {
          estree: {
            body: [
              { type: "ExpressionStatement", expression: { type: "CallExpression" } },
            ],
          },
        },
      },
    };
    expect(() => render(jsx("MethodTable", [bad]))).toThrow(/cannot use CallExpression/);
  });
});
