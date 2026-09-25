// @vitest-environment node
import { forwardRef, memo, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { markDocumentRoot } from "../src/components/tokens-context";
import { documentTokensOf } from "../src/lib/document-tokens";

function Letter(_props: { tokens?: unknown; children?: ReactNode }) { return null; }

describe("marked document roots", () => {
  it.each([
    markDocumentRoot(function PlainLetter(_props: { tokens?: unknown }) { return null; }),
    markDocumentRoot(memo(Letter)),
    markDocumentRoot(forwardRef<HTMLDivElement, { tokens?: unknown }>(function RefLetter() { return null; })),
  ])("finds function, memo, and forwardRef component types", (Root) => {
    expect(documentTokensOf(<Root tokens={{ pageSize: "a4" }} />).pageSize).toBe("a4");
  });
});
