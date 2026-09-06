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
 * use it, and reads the plain registries from `REGION_REGISTRIES` directly
 * instead, so a rejected value always throws. A value the data does
 * not carry at all (`null`, `undefined`, `""`) is not an invalid value: it is
 * handled before any serializer sees it, and prints as `blank`.
 *
 * **Partial mode** is the one exception, and it is opt-in. A document being
 * filled is partial by definition: `{ amount: null, currency: "USD" }` is what
 * a money def evaluates to while the field behind its amount is still
 * unanswered, and its serializer rejects it because `amount` must be a number.
 * A caller that is showing a fill in progress asks for `partial: true` and gets
 * `blank` for that; every other caller, which is every ordinary `renderPdf` and
 * both of the seal's render passes, still throws. A finished document with a
 * hole in it is a bug, and only the caller knows which kind of document it is
 * looking at.
 *
 * Partial mode does not swallow a wrong value. A rejection counts as
 * "unfinished" only when the rejection is actually about a member the data has
 * not supplied, which is decided by asking the serializer a second question
 * rather than by reading its message — see {@link isInProgress}. A rate stored
 * as a string throws in partial mode exactly as it does outside it, even when
 * the value it sits in is half-empty.
 */

import { isSerializableFieldType, REGION_REGISTRIES } from "@paradoc/serialization";
import type { FormField, RegionFormat, SerializerRegistry } from "@paradoc/types";

/** Shown in place of a value the data does not carry. */
export const BLANK = "—";

/** How a document formats the values the serializer registry does not cover. */
export interface FormatOptions {
  /** Registry the values are serialized through. Defaults to `us`. */
  regionFormat?: RegionFormat;
  /** Shown in place of a missing value. Defaults to `BLANK`. */
  blank?: string;
  /**
   * Renders a document that is still being filled. Off by default.
   *
   * With it on, a value the data has not finished supplying prints `blank`
   * instead of throwing: a money def whose amount has not been answered yet,
   * say. A value that is wrong rather than unfinished still throws, on or off.
   *
   * Turn it on where a document is being answered and every intermediate state
   * is a document somebody is looking at: a session preview, and the
   * composition check, which runs with whatever sample data there is. Leave it
   * off everywhere a finished document is produced, which is every ordinary
   * `renderPdf` and both of the seal's render passes, because a hole in one of
   * those is a bug and printing an em dash would hide it.
   */
  partial?: boolean;
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
  /** Whether this formatter is rendering a document that is still being filled. */
  partial: boolean;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * True when `value` is a plain object — `{}` or `Object.create(null)`, not
 * an instance of some other class. `isIncomplete` only recurses into one of
 * these: a `Date`, a `RegExp`, a `Map`, or any other class instance carries
 * its state outside its own enumerable properties, so `Object.values` on one
 * reports empty and would read as unsupplied when it plainly is not — a `Date`
 * is about as real a value as a value gets.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * True when `value` is a composite the data has not finished supplying: a plain
 * object or array with nothing in it, or one carrying a member that is blank.
 *
 * Structural only, and deliberately generous: it says a value *might* be
 * unfinished, never that its rejection was about that. {@link isInProgress}
 * decides. A non-plain object (a `Date`, an `Attachment` instance, anything
 * with its own class) is never this, however few enumerable properties it
 * carries. See {@link isPlainObject}.
 */
export function hasUnsuppliedMember(value: unknown): boolean {
  if (isBlank(value)) return true;
  if (Array.isArray(value)) return value.length === 0 || value.some(hasUnsuppliedMember);
  if (isPlainObject(value)) {
    const members = Object.values(value);
    return members.length === 0 || members.some(hasUnsuppliedMember);
  }
  return false;
}

/** The same composite with every blank member removed, recursively. */
function withoutBlanks(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((entry) => !isBlank(entry)).map(withoutBlanks);
  if (!isPlainObject(value)) return value;
  const kept: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(value)) {
    if (!isBlank(member)) kept[key] = withoutBlanks(member);
  }
  return kept;
}

/** True when a composite has nothing left in it. */
function isEmptyComposite(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return isPlainObject(value) && Object.keys(value).length === 0;
}

/**
 * True when the only thing wrong with a rejected `value` is that the data has
 * not finished supplying it.
 *
 * The serializers throw plain `Error`s carrying a sentence and no structured
 * issues, so there is no list of offending members to read and no honest way to
 * parse one out. The serializer is still the only thing that knows what it
 * objects to, so it is asked a second question instead: **serialize the same
 * value with its blank members removed.**
 *
 * - It is accepted, or there is nothing left of it: the blanks were the whole
 *   problem, and the value is a fill in progress.
 * - It is rejected with a different complaint: the first complaint was about
 *   something the pruning removed, which is to say about a blank.
 * - It is rejected with the same complaint: the pruning changed nothing, so the
 *   complaint was never about a blank. `{ amount: "12", currency: null }` is
 *   this case — half-supplied and also wrong — and it throws.
 *
 * The comparison is of two rejections, not a parse of one. A serializer whose
 * message quoted the whole value would make this stricter rather than looser,
 * which is the safe direction.
 */
export function isInProgress(
  type: string | undefined,
  value: unknown,
  serializers: SerializerRegistry,
  rejection: unknown
): boolean {
  if (!hasUnsuppliedMember(value)) return false;
  if (!isPlainObject(value) && !Array.isArray(value)) return false;

  const pruned = withoutBlanks(value);
  if (isEmptyComposite(pruned)) return true;

  try {
    serialize(type, pruned, serializers);
    return true;
  } catch (again) {
    return messageOf(again) !== messageOf(rejection);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

/**
 * Runs `serialize`, reporting a rejected value as `InvalidFieldValueError`
 * naming `location`.
 *
 * In partial mode a rejected value the data has not finished supplying prints
 * `blank` instead. The test runs only on the rejection path, so a value the
 * serializer accepts is never second-guessed: an address that legitimately
 * carries `line2: null` serializes as it always has.
 */
function serializeNamed(
  location: string,
  type: string | undefined,
  value: unknown,
  serializers: SerializerRegistry,
  blank: string,
  partial: boolean
): string | undefined {
  try {
    return serialize(type, value, serializers);
  } catch (cause) {
    if (partial && isInProgress(type, value, serializers, cause)) return blank;
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
  location?: string,
  partial = false
): string {
  if (isBlank(value)) return blank;
  return (
    serializeNamed(location ?? type ?? "value", type, value, serializers, blank, partial) ??
    String(value)
  );
}

function enumLabel(field: FormField, value: unknown): string {
  if (field.type !== "enum") return String(value);
  return field.enum.find((candidate) => candidate.value === value)?.label ?? String(value);
}

/** Builds a formatter bound to one serializer registry. */
export function createValueFormatter(options: FormatOptions = {}): DocumentFormatter {
  const blank = options.blank ?? BLANK;
  const partial = options.partial ?? false;
  // The plain registries, not `createSerializer`: its fallback wrapping turns a
  // rejected value into an empty string, and this package throws instead. The
  // map is the serialization package's own, and it is exhaustive over
  // `RegionFormat`, so there is nothing to fall back to.
  const serializers = REGION_REGISTRIES[options.regionFormat ?? "us"];

  const format: ValueFormatter = (field, value, location) => {
    if (isBlank(value)) return blank;

    const serialized = serializeNamed(
      location ?? field?.label ?? field?.type ?? "value",
      field?.type,
      value,
      serializers,
      blank,
      partial
    );
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

  return { format, serializers, blank, partial };
}
