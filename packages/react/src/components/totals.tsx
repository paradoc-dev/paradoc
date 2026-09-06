/**
 * `Totals` renders the artifact's computed values.
 *
 * Every amount it shows comes from the artifact's `defs`, evaluated by
 * `@paradoc/core`, and is formatted by the serializer its declared type names.
 * The component does no arithmetic of its own. It is one pagination unit.
 */

import { KeepTogether } from "./keep-together";
import { useDocument } from "./document-context";

/** One computed row. */
export interface TotalRow {
  /** Name of the def to read. */
  def: string;
  /** Row label. Defaults to the def's own label. */
  label?: string;
  /** Path of a field shown beside the label, such as the rate behind the tax. */
  ratePath?: string;
  /** Renders the row heavier, for the amount due. */
  emphasis?: boolean;
}

export interface TotalsProps {
  /** The computed rows, in order. */
  rows: TotalRow[];
  /** Stable keep id. Defaults to `totals`. */
  id?: string;
  className?: string;
}

/** The computed totals keep. */
export function Totals({ rows, id, className }: TotalsProps) {
  const { form, defText, text } = useDocument();

  return (
    <KeepTogether keepId={id ?? "totals"} className={className ?? "flex w-1/2 flex-col gap-1 self-end"}>
      {rows.map((row) => (
        <div
          key={row.def}
          data-def={row.def}
          className={
            row.emphasis
              ? "flex w-full justify-between border-t border-neutral-800 pt-1 text-base font-semibold"
              : "flex w-full justify-between text-sm"
          }
        >
          <span className="text-neutral-600">
            {row.label ?? form.defs?.[row.def]?.label ?? row.def}
            {row.ratePath ? (
              <span data-field-path={row.ratePath} className="text-neutral-500">
                {` (${text(row.ratePath)})`}
              </span>
            ) : null}
          </span>
          <span className="text-neutral-900">{defText(row.def)}</span>
        </div>
      ))}
    </KeepTogether>
  );
}
