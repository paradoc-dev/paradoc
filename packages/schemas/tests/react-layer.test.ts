import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  isReactLayerMimeType,
  LayerSchema,
  REACT_LAYER_MIME_PATTERN,
  REACT_LAYER_MIME_TYPES,
  REACT_LAYER_RULE,
  REACT_LAYER_FORM_ONLY_RULE,
} from "../src/zod/artifacts/shared/layer";
import { ChecklistSchema } from "../src/zod/artifacts/checklist";
import { DocumentSchema } from "../src/zod/artifacts/document";
import { FormSchema } from "../src/zod/artifacts/form";

describe("React layers by MIME type", () => {
  it("names both composition MIME types", () => {
    expect([...REACT_LAYER_MIME_TYPES]).toEqual(["text/tsx", "text/jsx"]);
    expect(isReactLayerMimeType("text/tsx")).toBe(true);
    expect(isReactLayerMimeType("text/jsx")).toBe(true);
    expect(isReactLayerMimeType("text/markdown")).toBe(false);
    expect(isReactLayerMimeType(undefined)).toBe(false);
  });

  for (const mimeType of REACT_LAYER_MIME_TYPES) {
    it(`accepts a file layer of ${mimeType}`, () => {
      const result = LayerSchema.safeParse({
        kind: "file",
        mimeType,
        path: "src/compositions/purchase-order.tsx",
        title: "Composition",
      });
      expect(result.success).toBe(true);
    });

    it(`rejects an inline layer of ${mimeType}, naming the rule`, () => {
      const result = LayerSchema.safeParse({
        kind: "inline",
        mimeType,
        text: "export default function PurchaseOrder() { return null }",
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain(REACT_LAYER_RULE);
      expect(REACT_LAYER_RULE).toContain("must be file layers");
    });
  }

  it("compares case the way MIME types do", () => {
    // RFC 2045 compares type and subtype without regard to case, so `TEXT/TSX`
    // is the same layer. Core lowercases before it dispatches; if validation did
    // not, a cased layer would validate and then fail at render.
    for (const cased of ["TEXT/TSX", "Text/Tsx", "text/JSX"]) {
      expect(isReactLayerMimeType(cased)).toBe(true);
      expect(LayerSchema.safeParse({ kind: "inline", mimeType: cased, text: "x" }).success).toBe(
        false
      );
      expect(
        LayerSchema.safeParse({ kind: "file", mimeType: cased, path: "a.tsx" }).success
      ).toBe(true);
      expect(new RegExp(REACT_LAYER_MIME_PATTERN).test(cased)).toBe(true);
    }
  });

  it("leaves every other inline MIME type alone", () => {
    for (const mimeType of ["text/plain", "text/markdown", "text/html"]) {
      expect(LayerSchema.safeParse({ kind: "inline", mimeType, text: "x" }).success).toBe(true);
    }
  });

  it("states the exclusion in the published JSON Schema, not only at runtime", () => {
    // A Zod refinement validates and then vanishes from the generated schema, so
    // the rule is attached as a JSON Schema keyword as well. Without this a
    // consumer validating against schema.paradoc.dev would accept the shape the
    // framework rejects.
    const json = z.toJSONSchema(LayerSchema, { target: "draft-2020-12" }) as unknown as {
      oneOf: Array<{ properties: Record<string, { not?: { pattern?: string } }> }>;
    };
    const inline = json.oneOf.find((entry) => "text" in entry.properties);
    // A pattern rather than an enum, because an enum compares case-sensitively
    // and would let TEXT/TSX through the published schema.
    expect(inline?.properties.mimeType?.not?.pattern).toBe(REACT_LAYER_MIME_PATTERN);
    for (const mimeType of REACT_LAYER_MIME_TYPES) {
      expect(new RegExp(REACT_LAYER_MIME_PATTERN).test(mimeType)).toBe(true);
    }
    expect(new RegExp(REACT_LAYER_MIME_PATTERN).test("text/markdown")).toBe(false);
  });
});

describe("React layers belong to forms", () => {
  const composition = { kind: "file", mimeType: "text/tsx", path: "composition.tsx" };
  const base = { name: "x", version: "1.0.0", title: "X" };
  const document = { ...base, kind: "document", layers: { composition } };
  const checklist = { ...base, kind: "checklist", items: [{ id: "a", title: "A" }], layers: { composition } };

  for (const [kind, schema, artifact] of [
    ["document", DocumentSchema, document],
    ["checklist", ChecklistSchema, checklist],
  ] as const) {
    it(`rejects a React layer on a ${kind}, at the layer's MIME type`, () => {
      for (const mimeType of [...REACT_LAYER_MIME_TYPES, "TEXT/TSX"]) {
        const result = schema.safeParse({ ...artifact, layers: { composition: { ...composition, mimeType } } });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.issues).toEqual([
          expect.objectContaining({ message: REACT_LAYER_FORM_ONLY_RULE, path: ["layers", "composition", "mimeType"] }),
        ]);
      }
    });

    it(`accepts a ${kind} file layer of another MIME type`, () => {
      const layers = { page: { kind: "file", mimeType: "text/html", path: "page.html" } };
      expect(schema.safeParse({ ...artifact, layers }).success).toBe(true);
    });

    it(`states the ${kind} rule in the published JSON Schema`, () => {
      const json = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" }) as unknown as {
        properties: { layers: { allOf?: Array<{ additionalProperties: { not: { properties: { mimeType: { pattern: string } } } } }> } };
      };
      const pattern = json.properties.layers.allOf?.[0]?.additionalProperties.not.properties.mimeType.pattern;
      expect(pattern).toBe(REACT_LAYER_MIME_PATTERN);
    });
  }

  it("still accepts a React layer on a form", () => {
    const form = { ...base, kind: "form", fields: { v: { type: "text", label: "V" } }, layers: { composition } };
    expect(FormSchema.safeParse(form).success).toBe(true);
  });
});
