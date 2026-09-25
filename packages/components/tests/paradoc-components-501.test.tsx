import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PartyDemo, PartyVariantInline } from "../src/examples";

it("renders the Party docs demo and its inline variant with default props", () => {
  expect(() => renderToStaticMarkup(<PartyDemo />)).not.toThrow();
  expect(() => renderToStaticMarkup(<PartyVariantInline />)).not.toThrow();
});
