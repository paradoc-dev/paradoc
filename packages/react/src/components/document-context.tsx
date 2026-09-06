/**
 * The one place a composed document is bound to its artifact and its data.
 *
 * `Document` supplies this context at the root. Every component below it reads
 * labels, field definitions, computed values, parties, and the serializer
 * registry from here, so no component carries its own copy of the artifact.
 */

import { createContext, useContext } from "react";
import type { Form, FormField, Party, SerializerRegistry } from "@paradoc/types";

import { itemField, readValue, resolveField } from "../lib/fields";
import { findSigningMark, type SigningMarks, type SigningMarkType } from "./signing-context";
import { formatByType, type DocumentFormatter, type ValueFormatter } from "../lib/format";

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

/** Builds the context value from an artifact, its data, and its computed defs. */
export function createDocumentContext(
  form: Form,
  data: DocumentData,
  defs: Map<string, unknown>,
  formatter: DocumentFormatter,
  marks: SigningMarks = {}
): DocumentContextValue {
  const field = (path: string) => resolveField(form, path);
  const value = (path: string) => readValue(data.fields, path);

  const party = (role: string): Party[] => {
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
    item: (path: string) => itemField(form, path),
    value,
    text: (path: string) => formatter.format(field(path), value(path), path),
    mark: (role: string, index: number, type: SigningMarkType) => findSigningMark(marks, role, index, type),
    defText: (name: string) =>
      formatByType(form.defs?.[name]?.type, defs.get(name), formatter.serializers, formatter.blank, `defs.${name}`),
    party,
  };
}
