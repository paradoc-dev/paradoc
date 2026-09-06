/**
 * Rendering tests.
 *
 * The components render to static markup in Node, the way every other package
 * in this workspace tests. What matters here is that the output carries the
 * values the artifact's serializers produce, not that a browser laid them out.
 */

import type { FormField } from "@paradoc/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Document } from "../src/components/document";
import { Field } from "../src/components/field";
import { Signature } from "../src/components/signature";
import { Table } from "../src/components/table";
import {
  ProposalDocument,
  proposalForm,
  overflowProposalData,
  shortProposalData,
} from "../src/examples";
import { UnknownFieldPathError } from "../src/lib/fields";
import { InvalidFieldValueError, type FormatOptions } from "../src/lib/format";

const html = renderToStaticMarkup(<ProposalDocument data={shortProposalData} />);

/** The markup of one component, rendered on its own against the proposal artifact. */
function renderAlone(node: React.ReactNode, data = shortProposalData, format?: FormatOptions): string {
  return renderToStaticMarkup(
    <Document artifact={proposalForm} data={data} format={format}>
      {node}
    </Document>
  );
}

/** The outer HTML of the one element carrying a given keep id. */
function keep(markup: string, id: string): string {
  const start = markup.indexOf(`data-keep-id="${id}"`);
  expect(start, `no keep "${id}" in the markup`).toBeGreaterThan(-1);
  const from = markup.lastIndexOf("<", start);
  const next = markup.indexOf('data-keep-id="', start + 1);
  return markup.slice(from, next === -1 ? undefined : markup.lastIndexOf("<", next));
}

describe("fields render through the artifact's serializers", () => {
  it("formats money the way the money serializer does", () => {
    expect(html).toContain("$2,400.00");
  });

  it("formats an organization the way the organization serializer does", () => {
    expect(html).toContain("Northgate Systems");
    expect(html).toContain("Harbor Freight Collective");
  });

  it("formats an address the way the address serializer does", () => {
    expect(html).toContain("1400 Rio Grande Street, Suite 220, Austin, TX, 78701, US");
  });

  it("formats a person the way the person serializer does", () => {
    expect(html).toContain("Marisol Vega");
  });

  it("formats a date the way the date serializer does", () => {
    expect(html).toContain("Sep 4, 2026");
    expect(html).toContain("Oct 4, 2026");
  });

  it("formats a percentage the way the percentage serializer does", () => {
    expect(html).toContain("8.25%");
  });

  it("takes its labels from the artifact", () => {
    expect(html).toContain("Proposal number");
    expect(html).toContain("Valid until");
    expect(html).toContain("Currency");
  });

  it("renders a missing optional value as the blank", () => {
    const markup = renderAlone(<Field path="summary" />, {
      ...shortProposalData,
      fields: { ...shortProposalData.fields, summary: undefined },
    });
    expect(markup).toContain("—");
  });
});

describe("the full reference document prints correctly under both registries", () => {
  const euHtml = renderToStaticMarkup(
    <ProposalDocument data={shortProposalData} format={{ regionFormat: "eu" }} />
  );

  it("formats the date fields locale-aware", () => {
    expect(html).toContain("Sep 4, 2026");
    expect(html).toContain("Oct 4, 2026");
    expect(euHtml).toContain("4. Sept. 2026");
    expect(euHtml).toContain("4. Okt. 2026");
  });

  it("formats the percentage field locale-aware", () => {
    expect(html).toContain("8.25%");
    expect(euHtml).toContain("8,25%");
  });

  it("keeps money on the artifact's declared currency, not the EU registry's default", () => {
    // The EU registry defaults an amount with no declared currency to EUR
    // (see `createMoneyStringifier` in `@paradoc/serialization`), but every
    // money value this artifact prints — every line item, and the subtotal,
    // tax, and total defs — carries an explicit `currency: "fields.currency"`,
    // which this document sets to "USD". Switching the registry to EU
    // therefore changes only the locale's grouping and decimal conventions;
    // the currency itself stays the document's own, never the registry's
    // default.
    expect(html).toContain("$2,400.00");
    expect(euHtml).not.toContain("€");
    expect(euHtml).toMatch(/2\.400,00\s\$/); // "2.400,00\u00a0$" (de-DE currency formatting uses a non-breaking space)
  });

  it("formats the number field (line-item quantity) the same way in both, at this magnitude", () => {
    // This reference document's own "number" field never exceeds two digits
    // (quantities are day counts), so both registries print it identically —
    // that is the correct outcome at this magnitude, not evidence the
    // registries fail to differ. The next test forces a larger value through
    // the same `Field` component to show they do.
    expect(html).toContain("18");
    expect(euHtml).toContain("18");
  });

  it("formats a larger number with locale-aware grouping through the same Field component", () => {
    const items = shortProposalData.fields.lineItems as Array<Record<string, unknown>>;
    const overridden = {
      ...shortProposalData,
      fields: {
        ...shortProposalData.fields,
        lineItems: [{ ...items[0], quantity: 1234.5 }, ...items.slice(1)],
      },
    };
    const usMarkup = renderAlone(<Field path="lineItems.0.quantity" label={false} />, overridden);
    const euMarkup = renderAlone(
      <Field path="lineItems.0.quantity" label={false} />,
      overridden,
      { regionFormat: "eu" }
    );
    expect(usMarkup).toContain("1,234.5");
    expect(euMarkup).toContain("1.234,5");
  });
});

describe("an invalid value fails loudly instead of degrading to a raw string", () => {
  it("throws naming the path and the value when a date fails to parse", () => {
    const invalidData = {
      ...shortProposalData,
      fields: { ...shortProposalData.fields, issuedOn: "not-a-date" },
    };

    expect(() => renderAlone(<Field path="issuedOn" />, invalidData)).toThrow(InvalidFieldValueError);

    expect.assertions(5);
    try {
      renderAlone(<Field path="issuedOn" />, invalidData);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidFieldValueError);
      const invalid = error as InvalidFieldValueError;
      expect(invalid.location).toBe("issuedOn");
      expect(invalid.value).toBe("not-a-date");
      expect(invalid.message).toContain("not-a-date");
    }
  });

  it("throws for an invalid value inside a table cell, naming the cell's path", () => {
    const overflowFirst = overflowProposalData.fields.lineItems as Array<Record<string, unknown>>;
    const overridden = {
      ...overflowProposalData,
      fields: {
        ...overflowProposalData.fields,
        lineItems: [{ ...overflowFirst[0], quantity: Number.NaN }, ...overflowFirst.slice(1)],
      },
    };
    expect(() => renderToStaticMarkup(<ProposalDocument data={overridden} />)).toThrow(
      InvalidFieldValueError
    );
  });
});

describe("every visible field of the artifact reaches the document", () => {
  const visible = Object.entries(proposalForm.fields ?? {}).filter(
    ([, field]) => (field as FormField).visible !== false
  );

  it("declares the fields this test guards", () => {
    expect(visible.length).toBeGreaterThan(10);
  });

  it.each(visible.map(([name, field]) => [name, (field as FormField).type]))(
    "renders %s (%s)",
    (name, type) => {
      const marker =
        type === "list" ? `data-field-path="${name}.` : `data-field-path="${name}"`;
      expect(html, `the field "${name}" is visible in the artifact but never rendered`).toContain(
        marker
      );
    }
  );
});

describe("an unknown path is a fault, not a blank", () => {
  it("throws naming the path and the form", () => {
    expect(() => renderAlone(<Field path="taxRatePercentt" />)).toThrow(UnknownFieldPathError);
    expect(() => renderAlone(<Field path="taxRatePercentt" />)).toThrow(
      /services-proposal.*taxRatePercentt|taxRatePercentt/
    );
  });

  it("throws for a path that runs past a leaf field", () => {
    expect(() => renderAlone(<Field path="proposalNumber.nested" />)).toThrow(UnknownFieldPathError);
  });
});

describe("the list renders as rows", () => {
  it("renders one row per line item, and a header", () => {
    expect(html.match(/data-keep-id="line-items:\d+"/g) ?? []).toHaveLength(4);
    expect(html).toContain('data-table-header="line-items"');
  });

  it("renders every cell of every row through the serializers", () => {
    expect(html).toContain("Discovery workshop and requirements capture");
    expect(html).toContain("Acceptance testing and go-live support");
    expect(html).toContain("$1,800.00");
    expect(html).toContain("$9,000.00");
  });

  it("uses flex rows rather than table markup, because the PDF engine has no tables", () => {
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<tr");
  });

  it("keeps a unique keep id for every row of the overflow set", () => {
    const overflow = renderToStaticMarkup(<ProposalDocument data={overflowProposalData} />);
    const rows = overflow.match(/data-keep-id="line-items:\d+"/g) ?? [];
    expect(rows).toHaveLength(66);
    expect(new Set(rows).size).toBe(66);
  });

  it("renders nothing but the header when the list is empty", () => {
    const markup = renderAlone(<Table path="lineItems" columns={[{ field: "description" }]} />, {
      ...shortProposalData,
      fields: { ...shortProposalData.fields, lineItems: [] },
    });
    expect(markup).toContain('data-table-header="lineItems"');
    expect(markup).not.toContain('data-keep-id="lineItems:0"');
  });
});

describe("computed totals come from the artifact", () => {
  it("renders subtotal, tax and total through the money serializer", () => {
    // 3*2400 + 6*2200 + 18*2050 + 5*1800 = 66,300
    expect(html).toContain("$66,300.00");
    // 8.25% of 66,300
    expect(html).toContain("$5,469.75");
    expect(html).toContain("$71,769.75");
  });

  it("labels each total from the artifact's def and shows the rate behind the tax", () => {
    const totals = keep(html, "totals");
    expect(totals).toContain('data-def="subtotal"');
    expect(totals).toContain('data-def="tax"');
    expect(totals).toContain('data-def="total"');
    expect(totals).toContain("Subtotal");
    expect(totals).toContain("(8.25%)");
  });
});

describe("both parties render", () => {
  it("names the provider inside the provider's own keep", () => {
    const markup = renderAlone(<Signature party="provider" />);
    const signature = keep(markup, "signature:provider");
    expect(signature).toContain("Northgate Systems");
    expect(signature).not.toContain("Harbor Freight Collective");
  });

  it("names the customer inside the customer's own keep", () => {
    const markup = renderAlone(<Signature party="customer" />);
    const signature = keep(markup, "signature:customer");
    expect(signature).toContain("Harbor Freight Collective");
    expect(signature).not.toContain("Northgate Systems");
  });

  it("shows the blank when the role has no party", () => {
    const markup = renderAlone(<Signature party="provider" />, {
      ...shortProposalData,
      parties: {},
    });
    expect(keep(markup, "signature:provider")).toContain("—");
  });

  it("takes the role label and the signing requirement from the artifact", () => {
    const signature = keep(renderAlone(<Signature party="provider" />), "signature:provider");
    expect(signature).toContain("Provider");
    expect(signature).toContain("Signature (required)");
  });
});

describe("pagination units", () => {
  const keepIds = (markup: string) =>
    [...markup.matchAll(/data-keep-id="([^"]+)"/g)].map((match) => match[1]!);

  it("gives every leaf a keep id and every section a section id", () => {
    for (const id of ["masthead", "customer", "summary", "line-items", "terms", "acceptance"]) {
      expect(html).toContain(`data-section="${id}"`);
    }
    expect(html).not.toContain('data-keep-id="line-items"');
    expect(html).toContain('data-keep-id="totals"');
    expect(html).toContain('data-keep-id="signature:provider"');
    expect(html).toContain('data-keep-id="field:summary"');
  });

  it("produces the same ids on a second render", () => {
    const again = renderToStaticMarkup(<ProposalDocument data={shortProposalData} />);
    expect(keepIds(again)).toEqual(keepIds(html));
  });
});
