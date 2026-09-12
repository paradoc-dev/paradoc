import { NestedPaperTokenError, TYPOGRAPHY_LEVELS } from "@paradoc/react";
import { renderPdf } from "@paradoc/react/pdf";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { purchaseOrderData } from "../src/examples/purchase-order-data";
import { purchaseOrderForm } from "../src/examples/purchase-order";
import { InvoiceDocument, overflowInvoiceData } from "../src/examples";
import { Bundle, Document, Field, Section, Table } from "../src";
import { readPdf } from "./pdf-reader";

type Tokens = Parameters<typeof Document>[0]["tokens"];

function render(tokens?: Tokens, className?: string) {
  return renderToStaticMarkup(
    <Document artifact={purchaseOrderForm} data={purchaseOrderData} tokens={tokens} className={className}>
      <Section id="order" title="Order">
        <Field path="orderNumber" />
        <Table path="lineItems" columns={[{ field: "description" }, { field: "amount" }]} />
      </Section>
    </Document>
  );
}

const ROOT_REGULAR = 'class="flex flex-col gap-6 text-sm leading-relaxed text-neutral-900"';

describe("the typography token in Field, Section, Table, and the root", () => {
  it("changes nothing when no rhythm is named", () => {
    const baseline = render();
    expect(baseline).toContain(ROOT_REGULAR);
    expect(render({ typography: { scale: "regular", flow: "regular" } })).toBe(baseline);
  });

  it("steps the root's size, leading, and gap at compact", () => {
    expect(render({ typography: { scale: "compact", flow: "compact" } })).toContain(
      'class="flex flex-col gap-4 text-xs leading-snug text-neutral-900"'
    );
  });

  it("steps the root's size, leading, and gap at roomy", () => {
    expect(render({ typography: { scale: "roomy", flow: "roomy" } })).toContain(
      'class="flex flex-col gap-8 text-base leading-loose text-neutral-900"'
    );
  });

  it("moves only the gap when only flow is named", () => {
    expect(render({ typography: { flow: "roomy" } })).toContain(
      'class="flex flex-col gap-8 text-sm leading-relaxed text-neutral-900"'
    );
  });

  it("steps the section heading, the field label, and the table header with the scale", () => {
    const roomy = render({ typography: { scale: "roomy" } });
    expect(roomy).toContain('class="text-sm font-semibold uppercase tracking-wider text-neutral-500"');
    expect(roomy).toContain('class="text-sm font-medium uppercase tracking-wide text-neutral-500"');
    expect(roomy).toContain(
      'class="flex gap-4 border-b border-neutral-800 pb-1 text-sm font-semibold uppercase tracking-wide text-neutral-700"'
    );

    const compact = render({ typography: { scale: "compact" } });
    expect(compact).toContain('class="text-xs font-semibold uppercase tracking-wider text-neutral-500"');
    expect(compact).toContain('class="text-xs font-medium uppercase tracking-wide text-neutral-500"');
    expect(compact).toContain(
      'class="flex gap-4 border-b border-neutral-800 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-700"'
    );
  });

  it("lets an explicit root className win over the token", () => {
    expect(render({ typography: { scale: "roomy", flow: "roomy" } }, "flex flex-col gap-2 text-sm")).toContain(
      'class="flex flex-col gap-2 text-sm"'
    );
  });

  it("renders every scale and flow on the default engine through the per-render override", async () => {
    // The PDF path refuses any class outside the verified vocabulary, so a
    // render that returns pages is the class check passing for that level.
    const pages: Record<string, number> = {};
    for (const scale of TYPOGRAPHY_LEVELS) {
      for (const flow of TYPOGRAPHY_LEVELS) {
        const result = await renderPdf(<InvoiceDocument data={overflowInvoiceData} />, {
          tokens: { typography: { scale, flow } },
        });
        const read = await readPdf(result.bytes);
        expect(read[0]?.text, `${scale}/${flow}`).toContain("INV-2026-0432");
        pages[`${scale}/${flow}`] = read.length;
      }
    }
    expect(pages["roomy/roomy"]).toBeGreaterThan(pages["regular/regular"] ?? 0);
    expect(pages["compact/compact"]).toBeLessThanOrEqual(pages["regular/regular"] ?? 0);
  });

  it("refuses the token on a document nested in a bundle", () => {
    expect(() =>
      renderToStaticMarkup(
        <Bundle>
          <Document artifact={purchaseOrderForm} data={purchaseOrderData} tokens={{ typography: { scale: "compact" } }}>
            <Field path="orderNumber" />
          </Document>
        </Bundle>
      )
    ).toThrowError(NestedPaperTokenError);
  });
});
