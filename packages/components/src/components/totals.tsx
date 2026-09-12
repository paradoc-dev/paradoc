/** @jsxRuntime classic */
import React from "react";
import { scaleTextClasses, useDocumentTokens, useField, useTotals } from "@paradoc/react";
import { KeepTogether } from "./keep-together";

export interface TotalRow {
  /** Name of the artifact's computed total, evaluated by `@paradoc/core`. */
  def: string;
  /** Overrides the def's own label. Defaults to the def's own label. */
  label?: string;
  /** Path to a percentage field shown beside the label, such as a tax rate. */
  ratePath?: string;
  /** Renders the row as the emphasized grand total: a top rule and bold text. */
  emphasis?: boolean;
}

export interface TotalsProps {
  /** The computed amounts to show, in order. */
  rows: readonly TotalRow[];
  /**
   * Stable keep id.
   * @default "totals"
   */
  id?: string;
  /** Application-owned classes replacing the block's default column layout. */
  className?: string;
}

function Rate({ path }: { path: string }) {
  const field = useField(path);
  return <span data-field-path={path} className="text-neutral-500">{` (${field.text})`}</span>;
}

export function Totals({ rows, id, className }: TotalsProps) {
  const totals = useTotals(rows.map((row) => row.def));
  const { accentColor, typography } = useDocumentTokens();
  return (
    <KeepTogether keepId={id ?? "totals"} className={className ?? "flex w-1/2 flex-col gap-1 self-end"}>
      {rows.map((row, index) => <div key={row.def} data-def={row.def} className={scaleTextClasses(row.emphasis ? "flex w-full justify-between border-t border-neutral-800 pt-1 text-base font-semibold" : "flex w-full justify-between text-sm", typography.scale)} style={row.emphasis && accentColor ? { borderColor: accentColor } : undefined}>
        <span className="text-neutral-600">{row.label ?? totals[index]?.label ?? row.def}{row.ratePath ? <Rate path={row.ratePath} /> : null}</span>
        <span className="text-neutral-900">{totals[index]?.text}</span>
      </div>)}
    </KeepTogether>
  );
}
