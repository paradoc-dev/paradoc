import { describe, expect, it } from "vitest";

import { pathSegments } from "../src";

describe("pathSegments", () => {
  it("parses dotted members and bracket indexes", () => {
    expect(pathSegments("lineItems[0].description")).toEqual(["lineItems", "0", "description"]);
  });

  it.each(["", ".items", "items.", "items..0", "items[]", "items[nope]"])(
    "rejects malformed path %j",
    (path) => expect(pathSegments(path)).toEqual([])
  );
});
