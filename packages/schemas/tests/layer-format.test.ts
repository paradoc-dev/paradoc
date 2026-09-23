import { describe, expect, it } from "vitest";
import { z } from "zod";

import { LAYER_FORMAT_RULE, LayerSchema } from "../src/zod/artifacts/shared/layer";

const pdfLayer = (format: unknown) => ({
  kind: "file",
  mimeType: "application/pdf",
  path: "1099-nec-A.pdf",
  format,
});

const messages = (result: { success: boolean; error?: { issues: Array<{ message: string; path: PropertyKey[] }> } }) =>
  result.error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) ?? [];

describe("a layer's format", () => {
  it("lets a PDF layer print money without a currency symbol", () => {
    expect(LayerSchema.safeParse(pdfLayer({ money: { currencyDisplay: "none" } })).success).toBe(true);
    expect(LayerSchema.safeParse({ ...pdfLayer({}), mimeType: "APPLICATION/PDF" }).success).toBe(true);
  });

  it("rejects a format on a layer other than a PDF, naming the rule", () => {
    const result = LayerSchema.safeParse({
      kind: "file",
      mimeType: "text/markdown",
      path: "1099-nec.md",
      format: { money: { currencyDisplay: "none" } },
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain(`format: ${LAYER_FORMAT_RULE}`);
  });

  it("rejects a format on an inline layer", () => {
    const result = LayerSchema.safeParse({
      kind: "inline",
      mimeType: "text/markdown",
      text: "{{fields.amount}}",
      format: { money: { currencyDisplay: "none" } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts only the currency display the decision allows", () => {
    for (const currencyDisplay of ["symbol", "code", "name", "narrowSymbol"]) {
      expect(LayerSchema.safeParse(pdfLayer({ money: { currencyDisplay } })).success).toBe(false);
    }
    expect(LayerSchema.safeParse(pdfLayer({ money: {} })).success).toBe(false);
  });

  it("rejects keys it does not declare, by name", () => {
    const money = LayerSchema.safeParse(pdfLayer({ money: { currencyDisplay: "none", minimumFractionDigits: 2 } }));
    expect(money.success).toBe(false);
    expect(messages(money).join("\n")).toContain("minimumFractionDigits");

    const format = LayerSchema.safeParse(pdfLayer({ number: { useGrouping: false } }));
    expect(format.success).toBe(false);
    expect(messages(format).join("\n")).toContain("number");
  });

  it("states the PDF-only rule in the published JSON Schema, not only at runtime", () => {
    const json = z.toJSONSchema(LayerSchema, { target: "draft-2020-12" }) as unknown as {
      allOf?: Array<{ if?: { required?: string[] }; then?: { properties?: { mimeType?: { pattern?: string } } } }>;
    };
    const rule = json.allOf?.find((entry) => entry.if?.required?.includes("format"));
    const pattern = rule?.then?.properties?.mimeType?.pattern;
    expect(pattern).toBeDefined();
    expect(new RegExp(pattern!).test("application/pdf")).toBe(true);
    expect(new RegExp(pattern!).test("text/markdown")).toBe(false);
    // The font rule is still stated beside it.
    expect(json.allOf?.some((entry) => entry.if?.required?.includes("font"))).toBe(true);
  });
});
