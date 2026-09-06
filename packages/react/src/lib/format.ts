/**
 * Value formatting.
 *
 * Every composite value (money, address, person, organization, party, phone)
 * goes through the serializer registry from `@paradoc/serialization`, so the
 * document shows exactly what the rest of the framework shows. The registry
 * covers only the composite primitives, so dates, numbers, percentages,
 * booleans, and enums are formatted here from the field definition.
 *
 * `formatByType` is the single dispatch into the registry. Nothing else in the
 * package may call `stringify` directly.
 */

import { createSerializer, isSerializableFieldType } from "@paradoc/serialization";
import type { FormField, SerializerRegistry } from "@paradoc/types";

/** Shown in place of a value the data does not carry. */
export const BLANK = "—";

/** How a document formats the values the serializer registry does not cover. */
export interface FormatOptions {
  /** BCP 47 locale used for dates and numbers. Defaults to `en-US`. */
  locale?: string;
  /** Region the serializer registry formats for. Defaults to `us`. */
  regionFormat?: "us" | "eu";
  /** Shown in place of a missing value. Defaults to `BLANK`. */
  blank?: string;
}

/** Formats one field value for display. */
export type ValueFormatter = (field: FormField | undefined, value: unknown) => string;

/** A formatter bound to one serializer registry. */
export interface DocumentFormatter {
  format: ValueFormatter;
  serializers: SerializerRegistry;
  blank: string;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** The registry's own rendering of a value, or `undefined` when it has no serializer for the type. */
function serialize(
  type: string | undefined,
  value: unknown,
  serializers: SerializerRegistry
): string | undefined {
  if (!isSerializableFieldType(type)) return undefined;
  return serializers[type as keyof SerializerRegistry].stringify(value as never) || undefined;
}

/**
 * Formats a value from its declared type alone. Used where there is no field
 * definition to consult: a computed def, or a party.
 */
export function formatByType(
  type: string | undefined,
  value: unknown,
  serializers: SerializerRegistry,
  blank: string = BLANK
): string {
  if (isBlank(value)) return blank;
  return serialize(type, value, serializers) ?? String(value);
}

function formatDate(value: unknown, locale: string): string {
  if (typeof value !== "string") return String(value);
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function enumLabel(field: FormField, value: unknown): string {
  if (field.type !== "enum") return String(value);
  return field.enum.find((candidate) => candidate.value === value)?.label ?? String(value);
}

/** Builds a formatter bound to one serializer registry. */
export function createValueFormatter(options: FormatOptions = {}): DocumentFormatter {
  const locale = options.locale ?? "en-US";
  const blank = options.blank ?? BLANK;
  const serializers = createSerializer({ regionFormat: options.regionFormat ?? "us" });

  const format: ValueFormatter = (field, value) => {
    if (isBlank(value)) return blank;

    const serialized = serialize(field?.type, value, serializers);
    if (serialized) return serialized;

    switch (field?.type) {
      case "date":
      case "datetime":
        return formatDate(value, locale);
      case "number":
        return typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : String(value);
      case "percentage":
        return typeof value === "number" ? `${new Intl.NumberFormat(locale).format(value)}%` : String(value);
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
