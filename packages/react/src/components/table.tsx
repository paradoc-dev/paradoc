/**
 * `Table` renders a list field as rows.
 *
 * The rows are flex, not `<table>`. The default PDF engine has no
 * table support, so a document that used real table markup on screen could not
 * be the same tree the PDF renders. Column widths are fractions of the row.
 *
 * The header and every row are pagination units with stable keep ids, and both
 * name their table: the header with `data-table-header`, each row with
 * `data-table-row`. That naming is what lets the page plan repeat the header at
 * the top of a page that opens on a continued row.
 *
 * The wrapper is not a keep, so it has to withdraw on its own: a page holding
 * none of the table's keeps renders no table at all. Left in place it would be
 * an empty flex child and would still take the section's gap, which would make
 * the rendered page taller than the flow the plan was measured against.
 */

import { KeepTogether } from "./keep-together";
import { useDocument } from "./document-context";
import { usePage } from "./page-context";

/** One column of the list. */
export interface TableColumn {
  /** Field name inside the list item. */
  field: string;
  /** Column heading. Defaults to the item field's label. */
  header?: string;
  /** Share of the row width, as a Tailwind basis class such as `basis-1/2`. */
  width?: string;
  /** Aligns the cell text. Defaults to `left`. */
  align?: "left" | "right";
}

export interface TableProps {
  /** Path of the list field to render. */
  path: string;
  /** Columns, in order. */
  columns: TableColumn[];
  /** Stable keep id prefix. Defaults to the path. */
  id?: string;
  className?: string;
}

function alignClass(align: TableColumn["align"]): string {
  return align === "right" ? "text-right" : "text-left";
}

/** A list field rendered as a header row plus one row per item. */
export function Table({ path, columns, id, className }: TableProps) {
  const { field, item, value, format } = useDocument();
  const page = usePage();
  const keepPrefix = id ?? path;
  const rows = value(path);
  const definition = item(path);

  const keepIds = [
    `${keepPrefix}:header`,
    ...(Array.isArray(rows) ? rows.map((_row, index) => `${keepPrefix}:${index}`) : []),
  ];
  if (page && !keepIds.some((keepId) => page.keeps.has(keepId))) return null;

  const headerFor = (column: TableColumn): string => {
    if (column.header) return column.header;
    if (definition.type === "fieldset") return definition.fields[column.field]?.label ?? column.field;
    return column.field;
  };

  return (
    <div className={className ?? "flex flex-col"}>
      <KeepTogether
        keepId={`${keepPrefix}:header`}
        data-table-header={keepPrefix}
        className="flex gap-4 border-b border-neutral-800 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-700"
      >
        {columns.map((column) => (
          <span key={column.field} className={`${column.width ?? "basis-1/4"} ${alignClass(column.align)}`}>
            {headerFor(column)}
          </span>
        ))}
      </KeepTogether>
      {Array.isArray(rows)
        ? rows.map((_row, index) => (
            <KeepTogether
              key={`${keepPrefix}:${index}`}
              keepId={`${keepPrefix}:${index}`}
              data-table-row={keepPrefix}
              className="flex gap-4 border-b border-neutral-200 py-1.5"
            >
              {columns.map((column) => {
                const cellPath = `${path}.${index}.${column.field}`;
                return (
                  <span
                    key={column.field}
                    data-field-path={cellPath}
                    className={`${column.width ?? "basis-1/4"} ${alignClass(column.align)}`}
                  >
                    {format(field(cellPath), value(cellPath))}
                  </span>
                );
              })}
            </KeepTogether>
          ))
        : null}
    </div>
  );
}
