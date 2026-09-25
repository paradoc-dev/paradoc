import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Form } from "@paradoc/types";
import { pathSegments as renderPathSegments } from "@paradoc/render";

import { ArtifactProvider, InvalidFieldPathError, useField } from "../src";
import { pathSegments as reactPathSegments } from "../src/lib/fields";

const form = {
  name: "paths",
  fields: {
    lineItems: {
      type: "list",
      label: "Items",
      item: { type: "fieldset", label: "Item", fields: { description: { type: "text", label: "Description" } } },
    },
  },
} as unknown as Form;

const data = { fields: { lineItems: [{ description: "Widget" }] }, parties: {} };

function Probe({ path }: { path: string }) {
  return <span>{useField(path).text}</span>;
}

describe("framework-react-seams-002: shared field-path grammar", () => {
  it("resolves bracket and dotted list indexes identically", () => {
    const render = (path: string) => renderToStaticMarkup(
      <ArtifactProvider artifact={form} data={data}><Probe path={path} /></ArtifactProvider>
    );
    expect(render("lineItems[0].description")).toBe(render("lineItems.0.description"));
    expect(render("lineItems[0].description")).toContain("Widget");
    expect(reactPathSegments("lineItems[0].description")).toEqual(renderPathSegments("lineItems[0].description"));
  });

  it.each(["", ".lineItems", "lineItems.", "lineItems..0", "lineItems[].description"])(
    "rejects malformed path %j",
    (path) => expect(() => reactPathSegments(path)).toThrow(InvalidFieldPathError)
  );

  it.each(["__proto__.polluted", "constructor.name", "prototype.value"])(
    "keeps the unsafe-member guard for %j",
    (path) => expect(() => reactPathSegments(path)).toThrow(InvalidFieldPathError)
  );
});
