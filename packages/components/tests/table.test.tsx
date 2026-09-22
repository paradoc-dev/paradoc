/**
 * What `Table`'s three extensions promise, checked on both outputs.
 *
 * A continued label is a claim about *which* header a reader is looking at: it
 * has to read on a repeated header and nowhere else, in the preview and in the
 * PDF, so the PDF claim can only be proven by reading a rendered file back —
 * the same reason `List`'s markers are.
 *
 * A footer is a claim about placement: it is simply the table's last keep, so
 * the tests derive it from a real rendered `Table` and hand its own ids to
 * `planPages`, the same approach `registry-blocks.test.tsx` uses for a header.
 *
 * A cell renderer is a claim about the row staying one pagination unit even
 * though one of its cells no longer prints plain text.
 */

import { fromJsx } from "@takumi-rs/helpers/jsx";
import {
  PageContextProvider,
  UnknownDefinitionError,
  planPages,
  type MeasuredKeep,
  type PageContextValue,
} from "@paradoc/react";
import { renderPdf } from "@paradoc/react-pdf";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Document, Table } from "../src";
import type { TableColumn } from "../src";
import { purchaseOrderData } from "../src/examples/purchase-order-data";
import { purchaseOrderForm } from "../src/examples/purchase-order";
import { readPdf, type ReadPage } from "./pdf-reader";
import { treeKeeps } from "./tree-keeps";

/** The purchase order sample's own line-item columns, reused so the rows are real formatted values. */
const COLUMNS: readonly TableColumn[] = [
  { field: "description", width: "basis-1/2" },
  { field: "quantity", header: "Qty", width: "basis-1/12", align: "right" },
  { field: "unit", width: "basis-1/12" },
  { field: "unitPrice", header: "Unit price", width: "basis-1/6", align: "right" },
  { field: "amount", width: "basis-1/6", align: "right" },
];

function inDocument(children: ReactNode) {
  return (
    <Document artifact={purchaseOrderForm} data={purchaseOrderData} id="order">
      {children}
    </Document>
  );
}

/**
 * `children` as one page of a plan would see them.
 *
 * Mirrors `prose.test.tsx`'s helper: supplying the page context by hand makes
 * a withdrawal or a repeat observable without a browser measuring anything.
 */
function onPage(children: ReactNode, keeps: readonly string[], repeats: readonly string[] = []) {
  const value = {
    plan: planPages([], 1000),
    index: 0,
    keeps: new Set(keeps),
    repeats: new Set(repeats),
    sections: new Set<string>(),
  } satisfies PageContextValue;
  return <PageContextProvider value={value}>{children}</PageContextProvider>;
}

describe("Table continuedLabel", () => {
  it("shows a placeholder, not the label, on the table's own header, which is never a repeat", () => {
    const table = <Table path="lineItems" id="line-items" columns={COLUMNS} continuedLabel="(continued)" />;
    const html = renderToStaticMarkup(
      inDocument(onPage(table, ["line-items:header", "line-items:0"]))
    );
    // The real words travel on the attribute either way — a copy substitutes
    // them in from here — but the rendered text on the header's own place in
    // the flow is a placeholder character, never the label itself.
    expect(html).toContain('data-continued-label="(continued)"');
    expect(html).not.toContain(">(continued)<");
    expect(html).toContain('class="truncate text-xs italic text-neutral-500">\u00a0<');
  });

  it("shows the label once the plan marks the header a repeat", () => {
    const table = <Table path="lineItems" id="line-items" columns={COLUMNS} continuedLabel="(continued)" />;
    const html = renderToStaticMarkup(
      inDocument(onPage(table, ["line-items:header", "line-items:1"], ["line-items:header"]))
    );
    expect(html).toContain('class="truncate text-xs italic text-neutral-500">(continued)<');
  });

  it("adds nothing to the header when no continuedLabel is given", () => {
    const table = <Table path="lineItems" id="line-items" columns={COLUMNS} />;
    const html = renderToStaticMarkup(inDocument(table));
    expect(html).not.toContain("data-continued-label");
    expect(html).not.toContain("(continued)");
  });

  it("treats an empty label as none, so no header measures a line it never fills", () => {
    const plain = renderToStaticMarkup(inDocument(<Table path="lineItems" id="line-items" columns={COLUMNS} />));
    const empty = renderToStaticMarkup(
      inDocument(<Table path="lineItems" id="line-items" columns={COLUMNS} continuedLabel="" />)
    );
    expect(empty).toBe(plain);
  });

  it("keeps the label to one line, so the placeholder measures what a copy draws", () => {
    const table = <Table path="lineItems" id="line-items" columns={COLUMNS} continuedLabel="(continued)" />;
    const html = renderToStaticMarkup(inDocument(table));
    expect(html).toMatch(/data-continued-label="\(continued\)" class="truncate /u);
  });
});

describe("Table footer", () => {
  const footer = [{ def: "subtotal" }, { def: "total", emphasis: true }] as const;

  it("evaluates footer rows from the artifact's definitions as one keep", () => {
    const html = renderToStaticMarkup(
      inDocument(<Table path="lineItems" id="line-items" columns={COLUMNS} footer={[...footer]} />)
    );
    expect(html).toContain('data-keep-id="line-items:footer"');
    expect(html).toContain('data-def="subtotal"');
    expect(html).toContain('data-def="total"');
    // The def's own computed text, the same value `Totals` would print.
    expect(html).toContain("$131,811.70");
  });

  it("withdraws from a page holding none of its keep, and stays on one holding it", () => {
    const table = <Table path="lineItems" id="line-items" columns={COLUMNS} footer={[...footer]} />;
    const withFooter = renderToStaticMarkup(inDocument(onPage(table, ["line-items:footer"])));
    expect(withFooter).toContain('data-keep-id="line-items:footer"');

    const withoutFooter = renderToStaticMarkup(inDocument(onPage(table, ["line-items:0"])));
    expect(withoutFooter).not.toContain('data-keep-id="line-items:footer"');
  });

  it("refuses a footer row naming a definition the artifact does not have", () => {
    expect(() =>
      renderToStaticMarkup(
        inDocument(<Table path="lineItems" id="line-items" columns={COLUMNS} footer={[{ def: "nope" }]} />)
      )
    ).toThrow(UnknownDefinitionError);
  });

  it("renders no footer keep at all when footer is not set", () => {
    const html = renderToStaticMarkup(
      inDocument(<Table path="lineItems" id="line-items" columns={COLUMNS} />)
    );
    expect(html).not.toContain("line-items:footer");
  });
});

describe("Table footer pagination", () => {
  /** The real ids `Table` emits for a footer table, each given a uniform invented height. */
  async function invented(height: number): Promise<MeasuredKeep[]> {
    const { node } = await fromJsx(
      inDocument(<Table path="lineItems" id="line-items" columns={COLUMNS} footer={[{ def: "subtotal" }]} />)
    );
    return treeKeeps(node).map(({ id, table, tableHeader, tableFooter }, index) => ({
      id,
      table,
      tableHeader,
      tableFooter,
      top: index * height,
      bottom: (index + 1) * height,
    }));
  }

  it("lands the footer on the page of the table's last row when it fits", async () => {
    const keeps = await invented(20);
    expect(keeps.at(-1)?.id).toBe("line-items:footer");
    const plan = planPages(keeps, keeps.length * 20);
    expect(plan.pages).toEqual([keeps.map((keep) => keep.id)]);
  });

  it("takes the last row onto the next page with it when it does not fit, under a header copy", async () => {
    const keeps = await invented(20);
    expect(keeps.at(-1)?.tableFooter).toBe(true);
    const budget = (keeps.length - 1) * 20; // exactly fits everything but the footer
    const plan = planPages(keeps, budget);
    const ids = keeps.map((keep) => keep.id);
    expect(plan.pages).toEqual([ids.slice(0, -2), ["line-items:header", ...ids.slice(-2)]]);
    expect(plan.repeats).toEqual([[], ["line-items:header"]]);
  });
});

describe("Table cell renderer", () => {
  const withRenderer = (render: TableColumn["render"]): readonly TableColumn[] => [
    ...COLUMNS.slice(0, -1),
    { field: "amount", width: "basis-1/6", align: "right", render },
  ];

  it("replaces one cell's markup with the renderer's output, given the formatted text and the row it belongs to", () => {
    let seenRow: unknown;
    const columns = withRenderer((text, row) => {
      seenRow = row;
      return <strong data-flag="true">{text}!</strong>;
    });
    const html = renderToStaticMarkup(
      inDocument(<Table path="lineItems" id="line-items" columns={columns} />)
    );
    expect(html).toContain('data-flag="true"');
    expect(html).toMatch(/\$[\d,.]+!<\/strong>/);
    // Genuinely the row, not merely a defined second argument: the last row
    // rendered is the sample's own last line item, identifiable by a field a
    // renderer never sees formatted.
    expect((seenRow as { description?: string } | undefined)?.description).toBe(
      (purchaseOrderData.fields.lineItems as { description: string }[]).at(-1)?.description
    );
  });

  it("still paginates the row as one unit when a column renders custom markup", () => {
    const columns = withRenderer((text) => <em>{text}</em>);
    const html = renderToStaticMarkup(
      inDocument(onPage(<Table path="lineItems" id="line-items" columns={columns} />, ["line-items:0"]))
    );
    // The page holds row 0 alone, and its rendered cell sits inside that one keep.
    expect(html.match(/data-keep-id="line-items:\d+"/gu) ?? []).toEqual(['data-keep-id="line-items:0"']);
    expect(html.match(/<em>/gu) ?? []).toHaveLength(1);
    expect(html).toMatch(/data-keep-id="line-items:0"[^]*<em>\$[\d,.]+<\/em>/u);
  });

  it("falls back to the plain formatted text when no renderer is given", () => {
    const html = renderToStaticMarkup(
      inDocument(<Table path="lineItems" id="line-items" columns={COLUMNS} />)
    );
    expect(html).not.toContain("<strong");
    expect(html).not.toContain("<em>");
    // The positive half of the fallback: the formatted text is still there.
    expect(html).toContain("27-inch 4K monitor");
    expect(html).toContain("$9,240.00");
  });
});

describe("the PDF path", () => {
  it("never prints the continued label on an unpaginated render", async () => {
    const read = await readPdf(
      (
        await renderPdf(
          inDocument(<Table path="lineItems" id="line-items" columns={COLUMNS} continuedLabel="(continued)" />)
        )
      ).bytes
    );
    expect(read.map((page) => page.text).join(" ")).not.toContain("(continued)");
  }, 120_000);

  it("carries the continued label on every repeated header page, and only there", async () => {
    const element = inDocument(
      <Table
        path="lineItems"
        id="line-items"
        columns={COLUMNS}
        continuedLabel="(continued)"
        footer={[{ def: "subtotal" }, { def: "total", emphasis: true }]}
      />
    );

    // A plan is a browser measurement and this file has no browser, so the
    // keeps are the ones the render itself resolves and only the heights are
    // invented — the same approach `registry-blocks.test.tsx` uses for a
    // table header.
    const { node } = await fromJsx(element);
    let y = 0;
    const keeps: MeasuredKeep[] = treeKeeps(node).map(({ id, table, tableHeader, tableFooter }) => {
      const laid = { id, table, tableHeader, tableFooter, top: y, bottom: y + 60 };
      y = laid.bottom;
      return laid;
    });
    const plan = planPages(keeps, 300);
    const repeatedPageIndexes = plan.repeats
      .map((copies, index) => (copies.length > 0 ? index : -1))
      .filter((index) => index >= 0);
    // Without a floor this would pass on a plan that copied nothing at all.
    expect(repeatedPageIndexes.length).toBeGreaterThanOrEqual(1);

    const rendered = await renderPdf(element, { plan });
    expect(rendered.unknownBreaks).toEqual([]);
    expect(rendered.unknownRepeats).toEqual([]);
    const pages = await readPdf(rendered.bytes);

    expect(pages[0]?.text).not.toContain("(continued)");
    for (const index of repeatedPageIndexes) {
      expect(pages[index]?.text, `page ${index + 1}`).toContain("(continued)");
    }
    for (const index of plan.repeats.keys()) {
      if (repeatedPageIndexes.includes(index)) continue;
      expect(pages[index]?.text, `page ${index + 1}`).not.toContain("(continued)");
    }

    // The footer prints its evaluated total on the page that holds the
    // table's last row, never on a page of its own.
    const lastRow = (purchaseOrderData.fields.lineItems as { description: string }[]).at(-1)!.description;
    expect(pages.at(-1)?.text).toContain("Total");
    expect(pages.at(-1)?.text).toContain(lastRow);
  }, 120_000);

  it("draws a cell renderer's markup on the page, through the same class-checked translation as any other text", async () => {
    const columns: readonly TableColumn[] = [
      ...COLUMNS.slice(0, -1),
      {
        field: "amount",
        width: "basis-1/6",
        align: "right",
        render: (text) => <strong className="font-semibold text-neutral-900">{text}*</strong>,
      },
    ];
    const read = await readPdf(
      (await renderPdf(inDocument(<Table path="lineItems" id="line-items" columns={columns} />))).bytes
    );
    const text = read.map((page) => page.text).join(" ");
    // The renderer's own suffix reaching the page is what proves the engine
    // drew the replacement markup rather than the column's plain text.
    expect(text).toMatch(/\$[\d,.]+\*/);
  }, 120_000);
});
