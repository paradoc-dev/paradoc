import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { SCHEMA_VERSION } from "../src/zod/config";
import { LAYER_BINDINGS_RULE, LayerSchema } from "../src/zod/artifacts/shared/layer";
import { RegistryLayerSchema } from "../src/zod/registry/registry-item";

type Result = { success: boolean; error?: { issues: Array<{ message: string; path: PropertyKey[]; keys?: string[] }> } };

const messages = (result: Result) =>
  result.error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}${issue.keys ? ` ${issue.keys.join(",")}` : ""}`) ?? [];

const pdfLayer = { kind: "file", mimeType: "application/pdf", path: "w-9.pdf" };

const bindingKeys = [
  ["bindings", { bindings: { f1_01: "fields.name" } }],
  ["bindingsFrom", { bindingsFrom: "copyA" }],
] as const;

const nonPdfFileLayers = [
  ["markdown", { kind: "file", mimeType: "text/markdown", path: "notice.md" }],
  ["HTML", { kind: "file", mimeType: "text/html", path: "notice.html" }],
  ["DOCX", { kind: "file", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", path: "notice.docx" }],
] as const;

const inlineLayers = [
  ["markdown", { kind: "inline", mimeType: "text/markdown", text: "{{fields.name}}" }],
  ["HTML", { kind: "inline", mimeType: "text/html", text: "<p>{{fields.name}}</p>" }],
  ["plain text", { kind: "inline", mimeType: "text/plain", text: "{{fields.name}}" }],
] as const;

type JsonSchema = {
  description?: string;
  properties?: Record<string, JsonSchema>;
  propertyNames?: JsonSchema;
  additionalProperties?: JsonSchema;
  maxLength?: number;
  allOf?: Array<{ if?: { required?: string[] }; then?: { properties?: { mimeType?: { pattern?: string } } } }>;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
};

describe("layer bindings", () => {
  it("a PDF file layer takes bindings and bindingsFrom", () => {
    expect(LayerSchema.safeParse({ ...pdfLayer, bindings: { f1_01: "fields.name" } }).success).toBe(true);
    expect(LayerSchema.safeParse({ ...pdfLayer, bindingsFrom: "copyA" }).success).toBe(true);
    expect(LayerSchema.safeParse({ ...pdfLayer, mimeType: "APPLICATION/PDF", bindings: { f1_01: "fields.name" } }).success).toBe(true);
  });

  it("a key fits a fully qualified AcroForm name", () => {
    const qualified = `topmostSubform[0].${"Page1[0].Table_Part1[0].Row1[0].".repeat(5)}f1_01[0]`;
    expect(qualified.length).toBeGreaterThan(100);
    expect(LayerSchema.safeParse({ ...pdfLayer, bindings: { [qualified]: "fields.name" } }).success).toBe(true);
    expect(LayerSchema.safeParse({ ...pdfLayer, bindings: { ["x".repeat(501)]: "fields.name" } }).success).toBe(false);
  });

  describe.each(nonPdfFileLayers)("a %s file layer", (_label, layer) => {
    it.each(bindingKeys)("rejects %s, naming the rule", (key, value) => {
      const result = LayerSchema.safeParse({ ...layer, ...value });
      expect(result.success).toBe(false);
      expect(messages(result)).toContain(`${key}: ${LAYER_BINDINGS_RULE}`);
    });

    it("is valid without them", () => {
      expect(LayerSchema.safeParse(layer).success).toBe(true);
    });
  });

  describe.each(inlineLayers)("an inline %s layer", (_label, layer) => {
    it.each(bindingKeys)("rejects %s as a key it does not declare", (key, value) => {
      const result = LayerSchema.safeParse({ ...layer, ...value });
      expect(result.success).toBe(false);
      expect(messages(result).join("\n")).toContain(key);
    });

    it("is valid without them", () => {
      expect(LayerSchema.safeParse(layer).success).toBe(true);
    });
  });

  it("an inline layer with a PDF MIME type takes no bindings either", () => {
    const result = LayerSchema.safeParse({ kind: "inline", mimeType: "application/pdf", text: "x", bindings: { f1_01: "fields.name" } });
    expect(result.success).toBe(false);
  });
});

describe("registry item layer bindings", () => {
  const registryPdf = { ...pdfLayer, url: "https://registry.example.com/w-9.pdf" };

  it("a PDF file layer takes bindings and bindingsFrom", () => {
    const result = RegistryLayerSchema.safeParse({ ...registryPdf, bindings: { f1_01: "fields.name" }, bindingsFrom: "copyA" });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ bindings: { f1_01: "fields.name" }, bindingsFrom: "copyA" });
  });

  it.each(bindingKeys)("a markdown file layer rejects %s, naming the rule", (key, value) => {
    const result = RegistryLayerSchema.safeParse({ kind: "file", mimeType: "text/markdown", path: "n.md", url: "https://registry.example.com/n.md", ...value });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain(`${key}: ${LAYER_BINDINGS_RULE}`);
  });

  it.each(bindingKeys)("an inline layer rejects %s, naming the rule", (key, value) => {
    const inline = { kind: "inline", mimeType: "text/markdown", text: "{{fields.name}}" };
    expect(RegistryLayerSchema.safeParse(inline).success).toBe(true);
    const result = RegistryLayerSchema.safeParse({ ...inline, ...value });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain(`${key}: ${LAYER_BINDINGS_RULE}`);
  });
});

/** Find the definition a generated schema gives a layer kind. */
function layerDefinition(schema: JsonSchema, kind: "inline" | "file"): JsonSchema {
  const members = schema.oneOf ?? schema.anyOf ?? [];
  const member = members.find((entry) => entry.properties?.kind && JSON.stringify(entry.properties.kind).includes(`"${kind}"`));
  if (!member) throw new Error(`no ${kind} layer in the generated schema`);
  return member;
}

/** An inline layer either leaves the PDF-only keys out or forbids them outright. */
function expectNoInlineBindings(inline: JsonSchema) {
  for (const key of ["bindings", "bindingsFrom"]) {
    const property = inline.properties?.[key] as { not?: unknown } | undefined;
    if (property !== undefined) expect(property.not, key).toEqual({});
  }
}

function expectPublishedDirection(inline: JsonSchema, file: JsonSchema, allOf: JsonSchema["allOf"]) {
  expectNoInlineBindings(inline);
  expect(inline.properties?.text?.description).toContain("{{fields.fieldName}}");

  const bindings = file.properties?.bindings;
  expect(bindings?.description).toMatch(/AcroForm field name.*Paradoc path/);
  expect(bindings?.propertyNames?.description).toMatch(/AcroForm field name/);
  expect(bindings?.additionalProperties?.description).toMatch(/Paradoc path/);
  expect(file.properties?.bindingsFrom?.description).toMatch(/PDF/);

  for (const key of ["bindings", "bindingsFrom"]) {
    const pattern = allOf?.find((entry) => entry.if?.required?.includes(key))?.then?.properties?.mimeType?.pattern;
    expect(pattern, key).toBeDefined();
    expect(new RegExp(pattern!).test("application/pdf")).toBe(true);
    expect(new RegExp(pattern!).test("text/markdown")).toBe(false);
  }
}

describe("the published JSON Schema", () => {
  it("describes bindings as AcroForm name to Paradoc path, on PDF layers only", () => {
    const json = z.toJSONSchema(LayerSchema, { target: "draft-2020-12" }) as unknown as JsonSchema;
    const file = layerDefinition(json, "file");
    expect(file.properties?.bindings?.propertyNames?.maxLength).toBe(500);
    expectPublishedDirection(layerDefinition(json, "inline"), file, json.allOf);
  });

  it("describes the same rule for registry item layers", () => {
    const json = z.toJSONSchema(RegistryLayerSchema, { target: "draft-2020-12" }) as unknown as JsonSchema;
    expectPublishedDirection(layerDefinition(json, "inline"), layerDefinition(json, "file"), json.allOf);
  });

  it("ships the corrected text in the current dated snapshot and leaves 2026-09-22 as published", () => {
    const layerIn = (version: string) =>
      (JSON.parse(readFileSync(join(__dirname, "..", "schemas", `${version}.json`), "utf-8")) as { $defs: { Layer: JsonSchema } }).$defs.Layer;

    const current = layerIn(SCHEMA_VERSION);
    expectPublishedDirection(layerDefinition(current, "inline"), layerDefinition(current, "file"), current.allOf);

    const previous = layerIn("2026-09-22");
    expect(layerDefinition(previous, "inline").properties?.bindings).toBeDefined();
  });
});
