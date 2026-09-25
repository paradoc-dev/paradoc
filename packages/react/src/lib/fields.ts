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

import type { Attachment, Form, FormAnnex, FormField } from "@paradoc/types";
import { pathSegments as parsePathSegments } from "@paradoc/render";

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

/**
 * Raised when a field component names a path that resolves to a composite: a
 * fieldset or a list. Neither has one value to print, so the binding names the
 * two that do rather than letting an object placeholder reach the page.
 */
export class CompositeFieldPathError extends Error {
  constructor(
    readonly path: string,
    readonly fieldType: "fieldset" | "list"
  ) {
    super(
      `The field at path "${path}" is a ${fieldType}, which has no single value to print. ` +
        `Use useList()/<Table> for a list and useParty()/<Signature> for a party, or name a field inside it.`
    );
    this.name = "CompositeFieldPathError";
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
  const segments = parsePathSegments(path);
  if (segments.length === 0 || segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) {
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

/**
 * The root segment an annex path starts with.
 *
 * An attachment is not a field: the artifact declares annex slots and the
 * filled data carries one `Attachment` per slot. The shared formatter already
 * addresses them as `annexes.<slot>`, so a composition names them the same way
 * rather than inventing a second grammar for the same value.
 */
const ANNEX_ROOT = "annexes";

/** Raised when a component names an annex slot the artifact does not declare. */
export class UnknownAnnexError extends Error {
  constructor(
    readonly path: string,
    readonly formName: string
  ) {
    super(
      `The form "${formName}" declares no annex at path "${path}". An attachment is carried ` +
        `by an annex slot, so its path is "${ANNEX_ROOT}.<slot>".`
    );
    this.name = "UnknownAnnexError";
  }
}

/**
 * The slot a form admits but never declared, shared so two reads of one ad-hoc
 * annex are the same value and a binding that compares by identity is stable.
 */
const AD_HOC_ANNEX: FormAnnex = Object.freeze({});

/** The slot an `annexes.<slot>` path names, or `undefined` for any other path. */
export function annexSlot(path: string): string | undefined {
  const segments = pathSegments(path);
  if (segments.length !== 2 || segments[0] !== ANNEX_ROOT) return undefined;
  return segments[1];
}

/**
 * Resolves the annex slot a path names.
 *
 * A form that admits ad-hoc annexes resolves a slot it never declared, exactly
 * as the shared formatter does, and the slot it returns then carries no title.
 *
 * @throws {UnknownAnnexError} when the path is not an annex path, or names a
 * slot this form neither declares nor admits.
 */
export function resolveAnnex(form: Form, path: string): FormAnnex {
  const slot = annexSlot(path);
  if (slot === undefined) throw new UnknownAnnexError(path, form.name);
  const declared = Object.hasOwn(form.annexes ?? {}, slot) ? form.annexes?.[slot] : undefined;
  if (declared === undefined && form.allowAdditionalAnnexes !== true) {
    throw new UnknownAnnexError(path, form.name);
  }
  return declared ?? AD_HOC_ANNEX;
}

/** Reads the attachment an `annexes.<slot>` path names out of a document's annexes. */
export function readAnnex(
  annexes: Record<string, Attachment> | undefined,
  path: string
): Attachment | undefined {
  const slot = annexSlot(path);
  if (slot === undefined || annexes === undefined) return undefined;
  return Object.hasOwn(annexes, slot) ? annexes[slot] : undefined;
}
