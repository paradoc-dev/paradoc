import { describe, expect, it } from "vitest";
import { createFormatter } from "@paradoc/format";
import { createValueFormatter, formatByType, ArtifactFieldFormatError } from "../src/lib/format";
import { renderText } from "@paradoc/render/text";
import type { Form, FormField, Formatter } from "@paradoc/types";
import { CompositeFieldPathError } from "../src/lib/fields";
const money = { type: "money" } as FormField;

const services = [
  { value: "plumbing", label: "Plumbing" },
  { value: "wiring", label: "Wiring" },
  { value: "roofing", label: "Roofing" },
];
const survey = {
  enabled: { type: "boolean" } as FormField,
  choice: { type: "enum", enum: services } as FormField,
  choices: { type: "multiselect", enum: services } as FormField,
  score: { type: "rating", min: 1, max: 5 } as FormField,
  unscored: { type: "rating" } as FormField,
};

/** The same five values through `@paradoc/render`'s own text output. */
function renderedByText(formatter?: Formatter): string[] {
  return renderText({
    form: { fields: survey } as unknown as Form,
    formatter,
    template: "{{fields.enabled}}|{{fields.choice}}|{{fields.choices}}|{{fields.score}}|{{fields.unscored}}",
    data: { enabled: true, choice: "wiring", choices: ["plumbing", "roofing"], score: 4, unscored: 3 },
  }).split("|");
}

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
  it("prints the same choice and rating text React prints as the text renderer", () => {
    const enUS = createValueFormatter();
    const deDE = createValueFormatter({ formatter: createFormatter({ locale: "de-DE" }) });
    const through = (document: ReturnType<typeof createValueFormatter>) => [
      document.format(survey.enabled, true, "fields.enabled"),
      document.format(survey.choice, "wiring", "fields.choice"),
      document.format(survey.choices, ["plumbing", "roofing"], "fields.choices"),
      document.format(survey.score, 4, "fields.score"),
      document.format(survey.unscored, 3, "fields.unscored"),
    ];
    const arSA = createValueFormatter({ formatter: createFormatter({ locale: "ar-SA" }) });
    expect(through(enUS)).toEqual(renderedByText());
    expect(through(deDE)).toEqual(renderedByText(createFormatter({ locale: "de-DE" })));
    expect(through(arSA)).toEqual(renderedByText(createFormatter({ locale: "ar-SA" })));
    // Pinned, so an identical regression on both sides of the comparison cannot pass.
    expect(through(enUS)).toEqual(["Yes", "Wiring", "Plumbing and Roofing", "4 of 5", "3"]);
    expect(through(deDE)).toEqual(["Ja", "Wiring", "Plumbing und Roofing", "4 von 5", "3"]);
    expect(through(arSA)).toEqual(["نعم", "Wiring", "Plumbing وRoofing", "٤ من ٥", "٣"]);
  });
  it("refuses a fieldset or list path instead of printing an object placeholder", () => {
    const document = createValueFormatter();
    expect(document.format(survey.choice, "wiring", "fields.choice")).toBe("Wiring");
    expect(() => document.format({ type: "list", item: survey.choice } as FormField, ["wiring"], "fields.rows"))
      .toThrowError(CompositeFieldPathError);
    expect(() => document.format({ type: "fieldset", fields: { choice: survey.choice } } as FormField, {}, "fields.row"))
      .toThrowError(/fields\.row.*fieldset.*useList\(\)\/<Table>.*useParty\(\)\/<Signature>/s);
  });
});
