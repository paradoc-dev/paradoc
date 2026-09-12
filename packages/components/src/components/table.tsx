/** @jsxRuntime classic */
import React from "react";
import { scaleTextClasses, useDocumentTokens, useList, usePage } from "@paradoc/react";
import { KeepTogether } from "./keep-together";

export interface TableColumn {
  field: string;
  header?: string;
  width?: string;
  align?: "left" | "right";
}

export interface TableProps {
  /** Path to the list field this table reads its rows from. */
  path: string;
  /** Column definitions: each names a list-item field, its header, width, and alignment. */
  columns: readonly TableColumn[];
  /** Prefix for the header's and each row's pagination id; falls back to `path`. */
  id?: string;
  /** Classes for the table's wrapping element. */
  className?: string;
}

export function Table({ path, columns, id, className }: TableProps) {
  const list = useList(path);
  const page = usePage();
  const { typography } = useDocumentTokens();
  const prefix = id ?? path;
  const keepIds = [`${prefix}:header`, ...list.rows.map((_row, index) => `${prefix}:${index}`)];
  if (page && !keepIds.some((keepId) => page.keeps.has(keepId))) return null;
  const header = (column: TableColumn) => column.header ??
    (list.item.type === "fieldset" ? list.item.fields[column.field]?.label : undefined) ?? column.field;
  return (
    <div className={className ?? "flex flex-col"}>
      <KeepTogether keepId={`${prefix}:header`} data-table-header={prefix} className={scaleTextClasses("flex gap-4 border-b border-neutral-800 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-700", typography.scale)}>
        {columns.map((column) => <span key={column.field} className={`${column.width ?? "basis-1/4"} ${column.align === "right" ? "text-right" : "text-left"}`}>{header(column)}</span>)}
      </KeepTogether>
      {list.rows.map((_row, index) => (
        <KeepTogether key={index} keepId={`${prefix}:${index}`} data-table-row={prefix} className="flex gap-4 border-b border-neutral-200 py-1.5">
          {columns.map((column) => <span key={column.field} data-field-path={`${path}.${index}.${column.field}`} className={`${column.width ?? "basis-1/4"} ${column.align === "right" ? "text-right" : "text-left"}`}>{list.text(index, column.field)}</span>)}
        </KeepTogether>
      ))}
    </div>
  );
}
