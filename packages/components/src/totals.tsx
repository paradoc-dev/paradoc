import { useDocumentTokens, useField, useTotals } from "@paradoc/react";
import { KeepTogether } from "./keep-together";

export interface TotalRow {
  def: string;
  label?: string;
  ratePath?: string;
  emphasis?: boolean;
}

export interface TotalsProps {
  rows: readonly TotalRow[];
  id?: string;
  className?: string;
}

function Rate({ path }: { path: string }) {
  const field = useField(path);
  return <span data-field-path={path} className="text-neutral-500">{` (${field.text})`}</span>;
}

export function Totals({ rows, id, className }: TotalsProps) {
  const totals = useTotals(rows.map((row) => row.def));
  const { accentColor } = useDocumentTokens();
  return (
    <KeepTogether keepId={id ?? "totals"} className={className ?? "flex w-1/2 flex-col gap-1 self-end"}>
      {rows.map((row, index) => <div key={row.def} data-def={row.def} className={row.emphasis ? "flex w-full justify-between border-t border-neutral-800 pt-1 text-base font-semibold" : "flex w-full justify-between text-sm"} style={row.emphasis && accentColor ? { borderColor: accentColor } : undefined}>
        <span className="text-neutral-600">{row.label ?? totals[index]?.label ?? row.def}{row.ratePath ? <Rate path={row.ratePath} /> : null}</span>
        <span className="text-neutral-900">{totals[index]?.text}</span>
      </div>)}
    </KeepTogether>
  );
}
