import { describe, expect, it } from "vitest";
import { createFormatter } from "@paradoc/format";
import { createValueFormatter, formatByType, ArtifactFieldFormatError } from "../src/lib/format";
import type { FormField } from "@paradoc/types";
const money = { type: "money" } as FormField;

describe("shared structured formatting", () => {
  it("uses the selected formatter for fields and computed values", () => {
    const formatter = createFormatter({ locale: "de-DE", overrides: { money: (value, options, context) => `CUSTOM ${context.delegate(value, options)}` } });
    const document = createValueFormatter({ formatter });
    const value = { amount: 12.5, currency: "EUR" };
    expect(document.format(money, value, "amount")).toBe(formatByType("money", value, formatter));
    expect(document.format(money, value)).toBe("CUSTOM 12,50\u00a0€");
  });
  it("keeps missing and incomplete placeholders distinct", () => {
    const document = createValueFormatter({ progressive: { missing: "MISSING", incomplete: "INCOMPLETE" } });
    expect(document.format(money, undefined)).toBe("MISSING");
    expect(document.format(money, { currency: "USD" })).toBe("INCOMPLETE");
  });
  it("supports the document's explicit partial placeholder", () => {
    expect(createValueFormatter({ partial: true, blank: "Pending" }).format(money, { currency: "USD" })).toBe("Pending");
  });
  it("rejects malformed supplied values even in an incomplete object", () => {
    const document = createValueFormatter({ partial: true });
    expect(() => document.format(money, { amount: "bad", currency: null }, "rows[2].amount"))
      .toThrowError(expect.objectContaining({ path: "rows[2].amount", status: "invalid" }));
  });
  it("rejects incomplete final values with structured diagnostics", () => {
    expect(() => createValueFormatter().format(money, { currency: "USD" }, "amount"))
      .toThrowError(ArtifactFieldFormatError);
  });
  it("localizes boolean and selection labels through the shared field adapter", () => {
    const document = createValueFormatter({ formatter: createFormatter({ locale: "de-DE" }) });
    expect(document.format({ type: "boolean" } as FormField, false)).toBe("Nein");
    expect(document.format({ type: "multiselect", enum: [{ value: "a", label: "Alpha" }] } as FormField, ["a"])).toBe("Alpha");
  });
});
