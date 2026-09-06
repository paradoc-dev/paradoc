/**
 * The one place a composed document is bound to its artifact and its data.
 *
 * `Document` supplies this context at the root. Every component below it reads
 * labels, field definitions, computed values, parties, and the serializer
 * registry from here, so no component carries its own copy of the artifact.
 */

import { createContext, useContext } from "react";
import type { Form, FormField, Party, SerializerRegistry } from "@paradoc/types";

import { itemField, readValue, resolveField, UnknownFieldPathError } from "../lib/fields";
import { findSigningMark, type SigningMarks, type SigningMarkType } from "./signing-context";
import { formatByType, InvalidFieldValueError, type DocumentFormatter, type ValueFormatter } from "../lib/format";
import type { UnresolvedPathCollector } from "./check-context";

/** The data one composed document renders. */
export interface DocumentData {
  /** Field values keyed the way the artifact names its fields. */
  fields: Record<string, unknown>;
  /**
   * Parties keyed by role, exactly as `FormData` carries them.
   *
   * A document prints a party; it never needs the runtime id one carries, so
   * this is the wider `Party` rather than `RuntimeParty`. That is what a render
   * request hands over, so nothing has to assert an id that may not be there.
   */
  parties: Record<string, Party | Party[]>;
}

/** What every component below `Document` can read. */
export interface DocumentContextValue {
  form: Form;
  data: DocumentData;
  /** Computed values from the artifact's `defs`, keyed by def name. */
  defs: Map<string, unknown>;
  /** The serializer registry every composite value is formatted through. */
  serializers: SerializerRegistry;
  /** Shown in place of a value the data does not carry. */
  blank: string;
  format: ValueFormatter;
  /** Resolves a field definition by path. Throws when the path names nothing. */
  field: (path: string) => FormField;
  /** Resolves the item definition of a list field. */
  item: (path: string) => FormField;
  /** Reads a field value by path. */
  value: (path: string) => unknown;
  /** Formats a field value by path. */
  text: (path: string) => string;
  /** Formats one computed def by name, through the serializer its type names. */
  defText: (name: string) => string;
  /** Reads the parties filling one role. */
  party: (role: string) => Party[];
  /**
   * The invisible flow marker the seal wants in front of one party's
   * placeholder of one field type, if this render is the seal's marker pass.
   * Undefined for every other render, and the block draws its rule alone.
   *
   * @throws {AmbiguousSigningMarkError} when two flow slots on that party place
   * the same field type.
   */
  mark: (role: string, index: number, type: SigningMarkType) => string | undefined;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

/** Provides the document context. `Document` supplies it; components read it with `useDocument`. */
export const DocumentContextProvider = DocumentContext.Provider;

/** Reads the document context, or throws when a component is used outside a `Document`. */
export function useDocument(): DocumentContextValue {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error("This component must be rendered inside a <Document>.");
  }
  return context;
}

/**
 * A placeholder field a check renders in place of one an unresolved path would
 * have named. It carries the path as its label so the composition still shows
 * something legible in place of the missing value, rather than nothing: check
 * mode's job is to keep the walk going, not to make the missing path invisible.
 */
function placeholderField(path: string): FormField {
  return { type: "text", label: path, required: false, visible: true };
}

/**
 * Runs `attempt`, reporting an `UnknownFieldPathError` to `collector` and
 * returning `placeholderField(path)` in its place. Outside check mode
 * (`collector` undefined) `attempt` runs unguarded, so a normal render still
 * throws exactly as it always has.
 */
function resolveOrCollect(
  collector: UnresolvedPathCollector | undefined,
  path: string,
  attempt: () => FormField
): FormField {
  if (!collector) return attempt();
  try {
    return attempt();
  } catch (error) {
    if (error instanceof UnknownFieldPathError) {
      collector.report(path);
      return placeholderField(path);
    }
    throw error;
  }
}

/**
 * Runs `attempt`, catching an `InvalidFieldValueError` in place of letting it
 * throw. Outside check mode `attempt` runs unguarded, so a normal render
 * still throws exactly as it always has.
 *
 * A value the data has not finished supplying never reaches here: the
 * formatter prints it `blank` rather than rejecting it, which is what lets a
 * `Field`/`Table` path and a `Totals` def resolve against the artifact with no
 * data at all. What does reach here is a value that is complete and still
 * rejected, a rate stored as a string or a stray field the artifact
 * half-declares, and it is reported to `collector` at the location the error
 * names, same as an unresolved path.
 */
function formatOrCollect(
  collector: UnresolvedPathCollector | undefined,
  blank: string,
  attempt: () => string
): string {
  if (!collector) return attempt();
  try {
    return attempt();
  } catch (error) {
    if (error instanceof InvalidFieldValueError) {
      collector.report(error.location);
      return blank;
    }
    throw error;
  }
}

/**
 * Builds the context value from an artifact, its data, and its computed defs.
 *
 * `collector`, present only for a composition check, turns an unresolved
 * `Field`/`Table` path or `Signature` party role into a recorded fault instead
 * of a thrown one — see `check-context.tsx`.
 */
export function createDocumentContext(
  form: Form,
  data: DocumentData,
  defs: Map<string, unknown>,
  formatter: DocumentFormatter,
  marks: SigningMarks = {},
  collector?: UnresolvedPathCollector
): DocumentContextValue {
  const field = (path: string) => resolveOrCollect(collector, path, () => resolveField(form, path));
  const value = (path: string) => readValue(data.fields, path);

  const party = (role: string): Party[] => {
    if (collector && form.parties?.[role] === undefined) {
      collector.report(`party:${role}`);
    }
    const entry = data.parties[role];
    if (!entry) return [];
    return Array.isArray(entry) ? entry : [entry];
  };

  return {
    form,
    data,
    defs,
    serializers: formatter.serializers,
    blank: formatter.blank,
    format: formatter.format,
    field,
    item: (path: string) => resolveOrCollect(collector, path, () => itemField(form, path)),
    value,
    text: (path: string) =>
      formatOrCollect(collector, formatter.blank, () => formatter.format(field(path), value(path), path)),
    mark: (role: string, index: number, type: SigningMarkType) => findSigningMark(marks, role, index, type),
    defText: (name: string) =>
      formatOrCollect(collector, formatter.blank, () =>
        formatByType(
          form.defs?.[name]?.type,
          defs.get(name),
          formatter.serializers,
          formatter.blank,
          `defs.${name}`,
          formatter.partial
        )
      ),
    party,
  };
}
