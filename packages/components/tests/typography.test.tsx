import { NestedPaperTokenError, TYPOGRAPHY_LEVELS } from "@paradoc/react";
import { renderPdf } from "@paradoc/react/pdf";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { purchaseOrderData } from "../src/examples/purchase-order-data";
import { purchaseOrderForm } from "../src/examples/purchase-order";
import { EngagementLetterDocument, InvoiceDocument, engagementLetterData, overflowInvoiceData } from "../src/examples";
import { Attachment, Bundle, Document, Field, Part, Section, Signature, Table, Totals } from "../src";
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

describe("the typography token", () => {
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

  it("steps Signature and Totals with the scale, mirrored at compact where the scale has a step", () => {
    const composed = (tokens?: Tokens) =>
      renderToStaticMarkup(
        <Document artifact={purchaseOrderForm} data={purchaseOrderData} tokens={tokens}>
          <Signature party="buyer" />
          <Totals rows={[{ def: "subtotal" }, { def: "total", emphasis: true }]} />
        </Document>
      );

    const roomy = composed({ typography: { scale: "roomy" } });
    expect(roomy).toContain('data-party-role="buyer"');
    expect(roomy).toContain('class="text-sm font-semibold uppercase tracking-wider text-neutral-500"');
    expect(roomy).toContain('class="text-base text-neutral-900"');
    expect(roomy).toContain('class="text-base text-neutral-800">________________</span><span class="text-sm text-neutral-500">');
    expect(roomy).toContain('class="text-base text-neutral-800">__________</span><span class="text-sm text-neutral-500">Date</span>');
    expect(roomy).toContain('class="flex w-full justify-between text-base"');
    expect(roomy).toContain('class="flex w-full justify-between border-t border-neutral-800 pt-1 text-lg font-semibold"');

    const compact = composed({ typography: { scale: "compact" } });
    expect(compact).toContain('class="text-xs font-semibold uppercase tracking-wider text-neutral-500"');
    expect(compact).toContain('class="text-xs text-neutral-900"');
    expect(compact).toContain('class="text-xs text-neutral-800">________________</span><span class="text-xs text-neutral-500">');
    expect(compact).toContain('class="text-xs text-neutral-800">__________</span><span class="text-xs text-neutral-500">Date</span>');
    expect(compact).toContain('class="flex w-full justify-between text-xs"');
    expect(compact).toContain('class="flex w-full justify-between border-t border-neutral-800 pt-1 text-sm font-semibold"');

    expect(composed()).toBe(composed({ typography: { scale: "regular", flow: "regular" } }));
  });

  it("steps a Part header and an Attachment from the Bundle around them", () => {
    const packet = (tokens?: Tokens) =>
      renderToStaticMarkup(
        <Bundle tokens={tokens}>
          <Part id="order" kind="composition" label="Order">
            <Document artifact={purchaseOrderForm} data={purchaseOrderData}>
              <Field path="orderNumber" />
            </Document>
          </Part>
          <Part id="w9" kind="form" label="W-9" attached>
            <Attachment filename="w9.pdf" mimeType="application/pdf" reason="encrypted" />
          </Part>
        </Bundle>
      );

    const roomy = packet({ typography: { scale: "roomy", flow: "roomy" } });
    expect(roomy).toContain('data-part-label="order" class="flex items-baseline justify-between px-6 text-sm font-medium text-neutral-600"');
    expect(roomy).toContain('class="text-base font-medium text-neutral-900">w9.pdf</span>');
    expect(roomy).toContain('data-attachment-reason="true" class="text-sm text-neutral-500"');
    expect(roomy).toContain('class="flex flex-col gap-14"');
    expect(roomy).toContain('class="flex flex-col gap-8 text-base leading-loose text-neutral-900"');

    const compact = packet({ typography: { scale: "compact", flow: "compact" } });
    expect(compact).toContain('data-part-label="order" class="flex items-baseline justify-between px-6 text-xs font-medium text-neutral-600"');
    expect(compact).toContain('class="text-xs font-medium text-neutral-900">w9.pdf</span>');
    expect(compact).toContain('data-attachment-reason="true" class="text-xs text-neutral-500"');
    expect(compact).toContain('class="flex flex-col gap-10"');

    expect(packet()).toContain('class="flex flex-col gap-12"');
    expect(packet()).toBe(packet({ typography: { scale: "regular", flow: "regular" } }));
  });

  it("steps a Part header from the document below it when no Bundle is the root", () => {
    const framed = (tokens?: Tokens) =>
      renderToStaticMarkup(
        <Part id="order" kind="composition" label="Order">
          <Document artifact={purchaseOrderForm} data={purchaseOrderData} tokens={tokens}>
            <Field path="orderNumber" />
          </Document>
        </Part>
      );
    expect(framed({ typography: { scale: "roomy" } })).toContain(
      'data-part-label="order" class="flex items-baseline justify-between px-6 text-sm font-medium text-neutral-600"'
    );
    expect(framed()).toContain(
      'data-part-label="order" class="flex items-baseline justify-between px-6 text-xs font-medium text-neutral-600"'
    );
  });

  it("renders every scale and flow on the default engine through the per-render override", async () => {
    // The PDF path refuses any class outside the verified vocabulary, so a
    // render that returns pages is the class check passing for that level.
    const pages: Record<string, number> = {};
    for (const scale of TYPOGRAPHY_LEVELS) {
      for (const flow of TYPOGRAPHY_LEVELS) {
        const tokens = { typography: { scale, flow } };
        const invoice = await readPdf(
          (await renderPdf(<InvoiceDocument data={overflowInvoiceData} />, { tokens })).bytes
        );
        expect(invoice[0]?.text, `invoice ${scale}/${flow}`).toContain("INV-2026-0432");
        pages[`${scale}/${flow}`] = invoice.length;
        const letter = await readPdf(
          (await renderPdf(<EngagementLetterDocument data={engagementLetterData} />, { tokens })).bytes
        );
        expect(letter.map((page) => page.text).join(" "), `letter ${scale}/${flow}`).toContain("Date");
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
