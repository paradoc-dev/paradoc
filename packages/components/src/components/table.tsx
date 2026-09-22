/** @jsxRuntime classic */
import React from "react";
import type { ReactNode } from "react";
import { scaleTextClasses, useDocumentTokens, useList, usePage, useTotals } from "@paradoc/react";
import { KeepTogether } from "./keep-together";

export interface TableColumn {
  field: string;
  header?: string;
  width?: string;
  align?: "left" | "right";
  /** Replaces a cell's plain text with markup built from the formatted text and the row value. */
  render?: (text: string, row: unknown) => ReactNode;
}

/** One footer row, evaluated from one of the artifact's definitions. */
export interface TableFooterRow {
  /** The definition to evaluate. */
  def: string;
  /** Replaces the definition's own label. */
  label?: string;
  /** Draws the row larger, above a rule, the way a grand total reads. */
  emphasis?: boolean;
}

/**
 * The character the label span carries on the header's own place in the flow.
 *
 * Not empty: an empty text node can collapse to no line box at all, which
 * would measure the header one line short of what a copy actually draws. A
 * non-breaking space keeps the same font metrics, and so the same line
 * height, as the real label the copy substitutes in its place — see
 * `revealContinuedLabel` in `pdf/tree.ts`, the translation that makes the
 * substitution on the PDF path's one flat render.
 */
const CONTINUED_LABEL_PLACEHOLDER = "\u00a0";

export interface TableProps {
  /** Path to the list field this table reads its rows from. */
  path: string;
  /** Column definitions: each names a list-item field, its header, width, and alignment. */
  columns: readonly TableColumn[];
  /** Prefix for the header's and each row's pagination id; falls back to `path`. */
  id?: string;
  /** Classes for the table's wrapping element. */
  className?: string;
  /** Shown on the repeated header when the table continues onto a later page, never on the first. Kept to one line. */
  continuedLabel?: string;
  /** Footer rows evaluated from the artifact's definitions; the page plan never opens a page on them without the table's last row. */
  footer?: readonly TableFooterRow[];
}

export function Table({ path, columns, id, className, continuedLabel, footer }: TableProps) {
  const list = useList(path);
  const page = usePage();
  const { typography, accentColor } = useDocumentTokens();
  const prefix = id ?? path;
  const headerId = `${prefix}:header`;
  const footerId = `${prefix}:footer`;
  const footerTotals = useTotals((footer ?? []).map((row) => row.def));
  const headerRepeated = page?.repeats.has(headerId) === true;
  const keepIds = [
    headerId,
    ...list.rows.map((_row, index) => `${prefix}:${index}`),
    ...(footer ? [footerId] : []),
  ];
  if (page && !keepIds.some((keepId) => page.keeps.has(keepId))) return null;
  const header = (column: TableColumn) => column.header ??
    (list.item.type === "fieldset" ? list.item.fields[column.field]?.label : undefined) ?? column.field;
  const columnHeaders = columns.map((column) => (
    <span key={column.field} className={`${column.width ?? "basis-1/4"} ${column.align === "right" ? "text-right" : "text-left"}`}>
      {header(column)}
    </span>
  ));
  return (
    <div className={className ?? "flex flex-col"}>
      {!continuedLabel ? (
        <KeepTogether keepId={headerId} data-table-header={prefix} className={scaleTextClasses("flex gap-4 border-b border-neutral-800 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-700", typography.scale)}>
          {columnHeaders}
        </KeepTogether>
      ) : (
        // A second, full-width line rather than a squeezed flex sibling: the
        // columns already claim the row's width, so a label competing for
        // what is left of it can be laid out at zero width by an engine that
        // does not overflow the way a browser does.
        <KeepTogether keepId={headerId} data-table-header={prefix} className="flex flex-col gap-0.5 border-b border-neutral-800 pb-1">
          <div className={scaleTextClasses("flex gap-4 text-xs font-semibold uppercase tracking-wide text-neutral-700", typography.scale)}>
            {columnHeaders}
          </div>
          <span
            data-continued-label={continuedLabel}
            className={scaleTextClasses("truncate text-xs italic text-neutral-500", typography.scale)}
          >
            {headerRepeated ? continuedLabel : CONTINUED_LABEL_PLACEHOLDER}
          </span>
        </KeepTogether>
      )}
      {list.rows.map((row, index) => (
        <KeepTogether key={index} keepId={`${prefix}:${index}`} data-table-row={prefix} className="flex gap-4 border-b border-neutral-200 py-1.5">
          {columns.map((column) => {
            const text = list.text(index, column.field);
            return (
              <span key={column.field} data-field-path={`${path}.${index}.${column.field}`} className={`${column.width ?? "basis-1/4"} ${column.align === "right" ? "text-right" : "text-left"}`}>
                {column.render ? column.render(text, row) : text}
              </span>
            );
          })}
        </KeepTogether>
      ))}
      {footer ? (
        <KeepTogether keepId={footerId} data-table-footer={prefix} className="flex flex-col gap-1 pt-1">
          {footer.map((row, index) => (
            <div
              key={row.def}
              data-def={row.def}
              className={scaleTextClasses(row.emphasis ? "flex w-full justify-between border-t border-neutral-800 pt-1 text-sm font-semibold" : "flex w-full justify-between text-xs", typography.scale)}
              style={row.emphasis && accentColor ? { borderColor: accentColor } : undefined}
            >
              <span className="text-neutral-600">{row.label ?? footerTotals[index]?.label}</span>
              <span className="text-neutral-900">{footerTotals[index]?.text}</span>
            </div>
          ))}
        </KeepTogether>
      ) : null}
    </div>
  );
}
