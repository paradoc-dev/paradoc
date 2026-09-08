/**
 * Field and value lookup by path.
 *
 * A path names a field the way the artifact does: `customerAddress` for a
 * top-level field, `lineItems.0.unitPrice` for one cell of a list row. The
 * numeric segment addresses the data, never the schema, because a list declares
 * one `item` definition that every row shares.
 *
 * A path that does not resolve is a fault in the composition, not a blank value,
 * so `resolveField` throws rather than letting a typo render as an em dash.
 */

import type { Form, FormField } from "@paradoc/types";

/** Raised when a component names a path the artifact does not declare. */
export class UnknownFieldPathError extends Error {
  constructor(
    readonly path: string,
    readonly formName: string
  ) {
    super(`The form "${formName}" declares no field at path "${path}".`);
    this.name = "UnknownFieldPathError";
  }
}

/** Raised when a path does not use Paradoc's explicit dot-path grammar. */
export class InvalidFieldPathError extends Error {
  constructor(readonly path: string) {
    super(`Invalid field path "${path}". Use non-empty dot-separated own-property names and numeric list indexes.`);
    this.name = "InvalidFieldPathError";
  }
}

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/** Splits and validates a Paradoc field path. */
export function pathSegments(path: string): string[] {
  const segments = path.split(".");
  if (
    path.length === 0 ||
    segments.some((segment) => segment.length === 0 || FORBIDDEN_SEGMENTS.has(segment))
  ) {
    throw new InvalidFieldPathError(path);
  }
  return segments;
}

function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function walk(form: Form, path: string): FormField | undefined {
  const segments = pathSegments(path);
  if (segments.length === 0) return undefined;

  let field: FormField | undefined = Object.hasOwn(form.fields ?? {}, segments[0]!)
    ? form.fields?.[segments[0]!]
    : undefined;

  for (const segment of segments.slice(1)) {
    if (!field) return undefined;
    if (field.type === "list") {
      // A numeric segment selects a row; every row shares the list's item definition.
      if (!isIndex(segment)) return undefined;
      field = field.item;
      continue;
    }
    if (field.type === "fieldset") {
      field = Object.hasOwn(field.fields, segment) ? field.fields[segment] : undefined;
      continue;
    }
    return undefined;
  }

  return field;
}

/**
 * Resolves the field definition a path names, walking fieldsets and list items.
 * Throws `UnknownFieldPathError` when the path names nothing.
 */
export function resolveField(form: Form, path: string): FormField {
  const field = walk(form, path);
  if (!field) throw new UnknownFieldPathError(path, form.name);
  return field;
}

/** The item definition of a list field, for reading an item's labels. */
export function itemField(form: Form, path: string): FormField {
  const list = resolveField(form, path);
  if (list.type !== "list") {
    throw new Error(`The field at path "${path}" is a ${list.type}, not a list.`);
  }
  return list.item;
}

/** Reads the value a path names out of a field data record. */
export function readValue(fields: Record<string, unknown>, path: string): unknown {
  let current: unknown = fields;
  for (const segment of pathSegments(path)) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      if (!isIndex(segment)) return undefined;
      current = current[Number(segment)];
      continue;
    }
    if (typeof current !== "object") return undefined;
    const record = current as Record<string, unknown>;
    if (!Object.hasOwn(record, segment)) return undefined;
    current = record[segment];
  }
  return current;
}
