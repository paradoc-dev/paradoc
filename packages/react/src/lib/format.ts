/**
 * Value formatting.
 *
 * Every scalar and composite value the serializer registry from
 * `@paradoc/serialization` covers (money, address, person, organization,
 * party, phone, date, datetime, time, number, percentage, ...) goes through
 * it, so the document shows exactly what the rest of the framework shows.
 * Booleans, enums, and multiselects have no registry serializer and are
 * formatted here from the field definition.
 *
 * `formatByType` is the single dispatch into the registry. Nothing else in the
 * package may call `stringify` directly.
 *
 * A value the registry rejects for its declared type throws an
 * `InvalidFieldValueError` naming the location the value came from (a field
 * path, a def name, or a party role) and the value itself, rather than
 * degrading silently to `String(value)`. `createSerializer`'s fallback
 * wrapping exists precisely to swallow that kind of error into an empty
 * string for callers that want graceful degradation; this package does not
 * use it, and reads the plain `usaSerializers`/`euSerializers` registries
 * directly instead, so a rejected value always throws. A value the data does
 * not carry at all (`null`, `undefined`, `""`) is not an invalid value: it is
 * handled before any serializer sees it, and prints as `blank`.
 */

import { euSerializers, isSerializableFieldType, usaSerializers } from "@paradoc/serialization";
import type { FormField, SerializerRegistry } from "@paradoc/types";

/** Shown in place of a value the data does not carry. */
export const BLANK = "—";

/** How a document formats the values the serializer registry does not cover. */
export interface FormatOptions {
  /** Region the serializer registry formats for. Defaults to `us`. */
  regionFormat?: "us" | "eu";
  /** Shown in place of a missing value. Defaults to `BLANK`. */
  blank?: string;
}

/**
 * A value the serializer registry rejects for its declared type. Thrown
 * instead of silently falling through to `String(value)`: a value that fails
 * its own type's validation is a data or artifact bug, and printing it raw
 * would hide that until someone read the finished document.
 */
export class InvalidFieldValueError extends Error {
  constructor(
    /** The field path, def name, or party role the invalid value was read from. */
    public readonly location: string,
    /** The value the serializer rejected. */
    public readonly value: unknown,
    cause: unknown
  ) {
    super(
      `Cannot format "${location}" (value: ${JSON.stringify(value)}): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause }
    );
    this.name = "InvalidFieldValueError";
  }
}

/** Formats one field value for display. `location` names it for `InvalidFieldValueError`. */
export type ValueFormatter = (field: FormField | undefined, value: unknown, location?: string) => string;

/** A formatter bound to one serializer registry. */
export interface DocumentFormatter {
  format: ValueFormatter;
  serializers: SerializerRegistry;
  blank: string;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * The registry's own rendering of a value, or `undefined` when it has no
 * serializer for the type. Throws the serializer's own error, uncaught, when
 * the type is serializable but the value fails that serializer's validation.
 */
function serialize(
  type: string | undefined,
  value: unknown,
  serializers: SerializerRegistry
): string | undefined {
  if (!isSerializableFieldType(type)) return undefined;
  return serializers[type as keyof SerializerRegistry].stringify(value as never) || undefined;
}

/** Runs `serialize`, reporting a rejected value as `InvalidFieldValueError` naming `location`. */
function serializeNamed(
  location: string,
  type: string | undefined,
  value: unknown,
  serializers: SerializerRegistry
): string | undefined {
  try {
    return serialize(type, value, serializers);
  } catch (cause) {
    throw new InvalidFieldValueError(location, value, cause);
  }
}

/**
 * Formats a value from its declared type alone. Used where there is no field
 * definition to consult: a computed def, or a party. `location` names the def
 * or role for `InvalidFieldValueError`; defaults to `type` when omitted.
 */
export function formatByType(
  type: string | undefined,
  value: unknown,
  serializers: SerializerRegistry,
  blank: string = BLANK,
  location?: string
): string {
  if (isBlank(value)) return blank;
  return serializeNamed(location ?? type ?? "value", type, value, serializers) ?? String(value);
}

function enumLabel(field: FormField, value: unknown): string {
  if (field.type !== "enum") return String(value);
  return field.enum.find((candidate) => candidate.value === value)?.label ?? String(value);
}

/** Builds a formatter bound to one serializer registry. */
export function createValueFormatter(options: FormatOptions = {}): DocumentFormatter {
  const blank = options.blank ?? BLANK;
  const serializers = options.regionFormat === "eu" ? euSerializers : usaSerializers;

  const format: ValueFormatter = (field, value, location) => {
    if (isBlank(value)) return blank;

    const serialized = serializeNamed(location ?? field?.label ?? field?.type ?? "value", field?.type, value, serializers);
    if (serialized) return serialized;

    switch (field?.type) {
      case "boolean":
        return value ? "Yes" : "No";
      case "enum":
        return enumLabel(field, value);
      case "multiselect":
        return Array.isArray(value) ? value.join(", ") : String(value);
      default:
        return String(value);
    }
  };

  return { format, serializers, blank };
}
