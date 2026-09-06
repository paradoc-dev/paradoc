/**
 * `checkComposition` resolves a composition against its artifact and reports
 * what a render would refuse, without producing PDF bytes.
 */

import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { para } from "@paradoc/core";
import type { Form } from "@paradoc/types";

import { checkComposition, checkElement } from "../src/check";
import { Document } from "../src/components/document";
import { Field } from "../src/components/field";
import { KeepTogether } from "../src/components/keep-together";
import { Signature } from "../src/components/signature";
import { Totals } from "../src/components/totals";
import type { DocumentData } from "../src/components/document-context";
import type { ReactLayerComponent } from "../src/pdf/layer";

const spec = {
  $schema: "https://schema.paradoc.dev/schema.json",
  kind: "form",
  name: "check-fixture",
  version: "1.0.0",
  title: "Check fixture",
  parties: {
    customer: {
      label: "Customer",
      partyType: "any",
      min: 1,
      max: 1,
      signature: { required: true, witnesses: 0, notarized: false },
    },
  },
  fields: {
    name: {
      type: "text",
      label: "Name",
      required: true,
      visible: true,
    },
  },
} as const;

const fixtureForm: Form = para.form(spec).toJSON() as Form;

const fixtureData: DocumentData = { fields: { name: "Ada Lovelace" }, parties: {} };

const totalsSpec = {
  $schema: "https://schema.paradoc.dev/schema.json",
  kind: "form",
  name: "check-totals-fixture",
  version: "1.0.0",
  title: "Check totals fixture",
  fields: {
    amount: { type: "number", label: "Amount", required: true, visible: true },
    currency: { type: "text", label: "Currency", required: true, visible: true },
  },
  defs: {
    total: {
      type: "money",
      label: "Total",
      value: { amount: "fields.amount", currency: "fields.currency" },
    },
  },
} as const;

const totalsForm: Form = para.form(totalsSpec).toJSON() as Form;

/** A composition whose only content is a `Totals` block over a money def. */
const TotalsOverDef: ReactLayerComponent = ({ artifact, data }) => (
  <Document artifact={artifact} data={data}>
    <Totals rows={[{ def: "total" }]} />
  </Document>
);

/** A composition with only classes from the verified vocabulary and a valid path. */
const Clean: ReactLayerComponent = ({ artifact, data }) => (
  <Document artifact={artifact} data={data}>
    <Field path="name" className="flex flex-col gap-1" />
  </Document>
);

/** A composition whose `Field` carries a class outside takumi's verified vocabulary. */
const UnsupportedClass: ReactLayerComponent = ({ artifact, data }) => (
  <Document artifact={artifact} data={data}>
    <Field path="name" className="grid-cols-3" />
  </Document>
);

/** A composition whose `Field` names a path the artifact does not declare. */
const UnresolvedPath: ReactLayerComponent = ({ artifact, data }) => (
  <Document artifact={artifact} data={data}>
    <Field path="doesNotExist" />
  </Document>
);

/** A composition whose `Signature` names a party role the artifact does not declare. */
const UnresolvedParty: ReactLayerComponent = ({ artifact, data }) => (
  <Document artifact={artifact} data={data}>
    <Signature party="notary" />
  </Document>
);

/**
 * A composition with two faults of different kinds at once: an unsupported
 * class on one `Field`, and an unresolved path on another. Both must be
 * reported from one check, which is only possible because check mode keeps
 * the tree walk going past the first fault instead of throwing.
 */
const BothFaults: ReactLayerComponent = ({ artifact, data }) => (
  <Document artifact={artifact} data={data}>
    <Field path="name" className="grid-cols-3" />
    <Field path="doesNotExist" />
  </Document>
);

/** A composition with an image whose `src` is not a `data:` URI. */
const RemoteImage: ReactLayerComponent = ({ artifact, data }) => (
  <Document artifact={artifact} data={data}>
    <KeepTogether as="img" keepId="logo" src="https://example.com/logo.png" alt="" />
  </Document>
);

describe("checkComposition", () => {
  it("passes a clean composition", async () => {
    const result = await checkComposition({
      artifact: fixtureForm,
      composition: Clean,
      data: fixtureData,
    });

    expect(result).toEqual({ unsupportedClasses: [], unresolvedPaths: [], missingImages: [] });
  });

  it("runs with no sample data at all", async () => {
    const result = await checkComposition({ artifact: fixtureForm, composition: Clean });

    expect(result).toEqual({ unsupportedClasses: [], unresolvedPaths: [], missingImages: [] });
  });

  it("names a class outside the verified vocabulary", async () => {
    const result = await checkComposition({
      artifact: fixtureForm,
      composition: UnsupportedClass,
      data: fixtureData,
    });

    expect(result.unsupportedClasses).toEqual(["grid-cols-3"]);
    expect(result.unresolvedPaths).toEqual([]);
  });

  it("names an unresolved field path", async () => {
    const result = await checkComposition({
      artifact: fixtureForm,
      composition: UnresolvedPath,
      data: fixtureData,
    });

    expect(result.unresolvedPaths).toEqual(["doesNotExist"]);
    expect(result.unsupportedClasses).toEqual([]);
  });

  it("names an unresolved signature party role", async () => {
    const result = await checkComposition({
      artifact: fixtureForm,
      composition: UnresolvedParty,
      data: fixtureData,
    });

    expect(result.unresolvedPaths).toEqual(["party:notary"]);
  });

  it("reports an unsupported class and an unresolved path from one composition", async () => {
    const result = await checkComposition({
      artifact: fixtureForm,
      composition: BothFaults,
      data: fixtureData,
    });

    expect(result.unsupportedClasses).toEqual(["grid-cols-3"]);
    expect(result.unresolvedPaths).toEqual(["doesNotExist"]);
  });

  it("skips the class check for the chromium adapter", async () => {
    const result = await checkComposition({
      artifact: fixtureForm,
      composition: UnsupportedClass,
      data: fixtureData,
      adapter: "chromium",
    });

    expect(result.unsupportedClasses).toEqual([]);
  });

  it("names an image with no embedded bytes, without failing the class or path checks", async () => {
    const result = await checkComposition({
      artifact: fixtureForm,
      composition: RemoteImage,
      data: fixtureData,
    });

    expect(result.missingImages).toEqual(["https://example.com/logo.png"]);
    expect(result.unsupportedClasses).toEqual([]);
    expect(result.unresolvedPaths).toEqual([]);
  });
});

describe("checking a Totals def with no data to format", () => {
  it("passes with no sample data at all, even though the def has no value to format", async () => {
    // `total` evaluates to `{ amount: null, currency: null }` with empty
    // fields, which the money serializer rejects — but a value with no data
    // anywhere in it is what running a check with no sample data looks
    // like, not a fault, so this must report nothing.
    const result = await checkComposition({ artifact: totalsForm, composition: TotalsOverDef });

    expect(result).toEqual({ unsupportedClasses: [], unresolvedPaths: [], missingImages: [] });
  });

  it("reports the def when its resolved value carries real data a serializer still rejects", async () => {
    const result = await checkComposition({
      artifact: totalsForm,
      composition: TotalsOverDef,
      data: { fields: { amount: "not-a-number", currency: "USD" }, parties: {} },
    });

    expect(result.unresolvedPaths).toEqual(["defs.total"]);
  });
});

describe("checkElement", () => {
  it("checks an already-built element the same way checkComposition checks one it builds", async () => {
    const element = createElement(UnsupportedClass, { artifact: fixtureForm, data: fixtureData });

    const result = await checkElement(element);

    expect(result.unsupportedClasses).toEqual(["grid-cols-3"]);
  });

  it("ignores artifact and data entirely: the element already carries them", async () => {
    const element = createElement(Clean, { artifact: fixtureForm, data: fixtureData });

    const result = await checkElement(element);

    expect(result).toEqual({ unsupportedClasses: [], unresolvedPaths: [], missingImages: [] });
  });
});
