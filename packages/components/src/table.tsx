import { KeepTogether, useList } from "@paradoc/react";

export interface TableColumn {
  field: string;
  header?: string;
  width?: string;
  align?: "left" | "right";
}

export interface TableProps {
  path: string;
  columns: readonly TableColumn[];
  id?: string;
  className?: string;
}

export function Table({ path, columns, id, className }: TableProps) {
  const list = useList(path);
  const prefix = id ?? path;
  const header = (column: TableColumn) => column.header ??
    (list.item.type === "fieldset" ? list.item.fields[column.field]?.label : undefined) ?? column.field;
  return (
    <div className={className ?? "flex flex-col"}>
      <KeepTogether keepId={`${prefix}:header`} data-table-header={prefix} className="flex gap-4 border-b border-neutral-800 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
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
