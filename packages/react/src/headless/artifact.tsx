import { evaluateFormDefs } from "@paradoc/core";
import type { Form, FormField, Formatter, Party } from "@paradoc/types";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { itemField, readValue, resolveField } from "../lib/fields";
import {
  createValueFormatter,
  formatByType,
  type DocumentFormatter,
  type FormatOptions,
} from "../lib/format";
import type { DocumentData } from "../components/document-context";
import { useUnresolvedPathCollector, type UnresolvedPathCollector } from "../components/check-context";
import { usePartialValues } from "../components/partial-context";

export class MissingArtifactProviderError extends Error {
  constructor() {
    super("This hook must be rendered inside an <ArtifactProvider>.");
    this.name = "MissingArtifactProviderError";
  }
}

export class UnknownDefinitionError extends Error {
  constructor(readonly name: string, readonly formName: string) {
    super(`The form "${formName}" declares no computed definition named "${name}".`);
    this.name = "UnknownDefinitionError";
  }
}

export class InvalidListValueError extends Error {
  constructor(readonly path: string, value: unknown) {
    super(`The list field at path "${path}" requires an array value; received ${value === null ? "null" : typeof value}.`);
    this.name = "InvalidListValueError";
  }
}

export class UnknownPartyRoleError extends Error {
  constructor(readonly role: string, readonly formName: string) {
    super(`The form "${formName}" declares no party role "${role}".`);
    this.name = "UnknownPartyRoleError";
  }
}

interface ArtifactSnapshot {
  artifact: Form;
  data: DocumentData;
  defs: Map<string, unknown>;
  formatting: DocumentFormatter;
  collector?: UnresolvedPathCollector;
}

interface ArtifactStore {
  getSnapshot(): ArtifactSnapshot;
  setSnapshot(snapshot: ArtifactSnapshot): boolean;
  subscribe(listener: () => void): () => void;
  emit(): void;
}

function createStore(initial: ArtifactSnapshot): ArtifactStore {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    setSnapshot(next) {
      if (snapshot === next) return false;
      snapshot = next;
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit() {
      for (const listener of listeners) listener();
    },
  };
}

const ArtifactContext = createContext<ArtifactStore | null>(null);
const useStoreLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface ArtifactProviderProps {
  artifact: Form;
  data: DocumentData;
  format?: FormatOptions;
  children: ReactNode;
}

function snapshotOf(artifact: Form, data: DocumentData, formatting: DocumentFormatter, collector?: UnresolvedPathCollector): ArtifactSnapshot {
  const evaluated = evaluateFormDefs(artifact, { fields: data.fields, parties: data.parties });
  return {
    artifact,
    data,
    defs: "value" in evaluated && evaluated.value ? evaluated.value.defsValues : new Map(),
    formatting,
    collector,
  };
}

/** Supplies artifact data to headless hooks without rendering a DOM element. */
export function ArtifactProvider({ artifact, data, format, children }: ArtifactProviderProps) {
  const inheritedPartial = usePartialValues();
  const collector = useUnresolvedPathCollector();
  const formatterOption = format?.formatter;
  const blank = format?.blank;
  const partial = format?.partial ?? inheritedPartial;
  const progressive = format?.progressive;
  const formatting = useMemo(
    () => createValueFormatter({ formatter: formatterOption, blank, partial, progressive }),
    [formatterOption, blank, partial, progressive]
  );
  const snapshot = useMemo(() => snapshotOf(artifact, data, formatting, collector), [artifact, data, formatting, collector]);
  const storeRef = useRef<ArtifactStore | undefined>(undefined);
  const changedRef = useRef(false);
  if (!storeRef.current) storeRef.current = createStore(snapshot);
  changedRef.current = storeRef.current.setSnapshot(snapshot) || changedRef.current;
  useStoreLayoutEffect(() => {
    if (changedRef.current) {
      changedRef.current = false;
      storeRef.current?.emit();
    }
  }, [snapshot]);
  return <ArtifactContext.Provider value={storeRef.current}>{children}</ArtifactContext.Provider>;
}

function useStore(): ArtifactStore {
  const store = useContext(ArtifactContext);
  if (!store) throw new MissingArtifactProviderError();
  return store;
}

function useSelection<T>(key: string, select: (snapshot: ArtifactSnapshot) => T, equal: (a: T, b: T) => boolean): T {
  const store = useStore();
  const selectRef = useRef(select);
  selectRef.current = select;
  const selectedRef = useRef<{ key: string; snapshot: ArtifactSnapshot; value: T } | undefined>(undefined);
  const getSnapshot = useMemo(
    () => () => {
      const snapshot = store.getSnapshot();
      const previous = selectedRef.current;
      if (previous?.key === key && previous.snapshot === snapshot) return previous.value;
      const value = selectRef.current(snapshot);
      if (previous?.key === key && equal(previous.value, value)) {
        selectedRef.current = { key, snapshot, value: previous.value };
        return previous.value;
      }
      selectedRef.current = { key, snapshot, value };
      return value;
    },
    [store, key, equal]
  );
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

const same = <T,>(a: T, b: T) => Object.is(a, b);

/** Reads the current artifact. Prefer a focused hook when only one output is needed. */
export function useArtifact(): Form {
  return useSelection("artifact", (snapshot) => snapshot.artifact, same);
}

export interface FieldBinding {
  field: FormField;
  value: unknown;
  text: string;
}

function sameField(a: FieldBinding, b: FieldBinding): boolean {
  return a.field === b.field && Object.is(a.value, b.value) && a.text === b.text;
}

/** Reads and formats one declared field path. */
export function useField(path: string): FieldBinding {
  return useSelection(`field:${path}`, (snapshot) => {
    let field: FormField;
    try {
      field = resolveField(snapshot.artifact, path);
    } catch (error) {
      if (!snapshot.collector) throw error;
      snapshot.collector.report(path);
      field = { type: "text", label: path, required: false, visible: true };
    }
    const value = readValue(snapshot.data.fields, path);
    return { field, value, text: snapshot.formatting.format(field, value, path) };
  }, sameField);
}

export interface ListBinding {
  field: FormField;
  item: FormField;
  rows: readonly unknown[];
  format: DocumentFormatter["format"];
  text(index: number, path?: string): string;
}

function sameList(a: ListBinding, b: ListBinding): boolean {
  return a.field === b.field && a.item === b.item && a.rows === b.rows && a.format === b.format;
}

/** Reads one declared list and formats scalar items or fields within its rows. */
export function useList(path: string): ListBinding {
  return useSelection(`list:${path}`, (snapshot) => {
    let field: FormField;
    let item: FormField;
    try {
      field = resolveField(snapshot.artifact, path);
      item = itemField(snapshot.artifact, path);
    } catch (error) {
      if (!snapshot.collector) throw error;
      snapshot.collector.report(path);
      field = { type: "list", label: path, required: false, visible: true, item: { type: "text", required: false, visible: true } } as FormField;
      item = { type: "text", label: path, required: false, visible: true };
    }
    const value = readValue(snapshot.data.fields, path);
    if (value !== undefined && !Array.isArray(value)) throw new InvalidListValueError(path, value);
    const rows = value ?? [];
    const text = (index: number, childPath?: string) => {
      const rowPath = childPath ? `${path}.${index}.${childPath}` : `${path}.${index}`;
      const rowField = resolveField(snapshot.artifact, rowPath);
      return snapshot.formatting.format(rowField, readValue(snapshot.data.fields, rowPath), rowPath);
    };
    return { field, item, rows, format: snapshot.formatting.format, text };
  }, sameList);
}

export interface TotalBinding {
  name: string;
  label: string;
  value: unknown;
  text: string;
}

function sameTotals(a: readonly TotalBinding[], b: readonly TotalBinding[]): boolean {
  return a.length === b.length && a.every((row, index) => {
    const other = b[index];
    return !!other && row.name === other.name && row.label === other.label &&
      Object.is(row.value, other.value) && row.text === other.text;
  });
}

/** Reads computed definitions in caller-selected display order. */
export function useTotals(names: readonly string[]): readonly TotalBinding[] {
  return useSelection(`totals:${names.join("\u0000")}`, (snapshot) => names.map((name) => {
    const definition = snapshot.artifact.defs?.[name];
    if (!definition) throw new UnknownDefinitionError(name, snapshot.artifact.name);
    const value = snapshot.defs.get(name);
    return {
      name,
      label: definition.label ?? name,
      value,
      text: formatByType(
        definition.type,
        value,
        snapshot.formatting.formatter,
        snapshot.formatting.blank,
        `defs.${name}`,
        snapshot.formatting.progressive
      ),
    };
  }), sameTotals);
}

/** Reads parties for one declared artifact role. */
export function useParty(role: string): readonly Party[] {
  return useSelection(`party:${role}`, (snapshot) => {
    if (!Object.hasOwn(snapshot.artifact.parties ?? {}, role)) {
      if (snapshot.collector) {
        snapshot.collector.report(`party:${role}`);
        return [];
      }
      throw new UnknownPartyRoleError(role, snapshot.artifact.name);
    }
    const value = snapshot.data.parties[role];
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  }, same);
}

/** Reads the formatter registry for advanced copy-owned components. */
export function useFormatter(): Formatter {
  return useSelection("formatter", (snapshot) => snapshot.formatting.formatter, same);
}
