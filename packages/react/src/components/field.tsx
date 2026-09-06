/**
 * `Field` names a path and renders the value the artifact's serializers produce.
 * It never formats a value itself and never carries its own label.
 *
 * A field is a pagination unit: it is a `KeepTogether`, so it is never split across a
 * page break and renders only on the page the plan put it on.
 */

import { KeepTogether } from "./keep-together";
import { useDocument } from "./document-context";

export interface FieldProps {
  /** Path into the artifact, such as `customerAddress` or `lineItems.0.unitPrice`. */
  path: string;
  /** Overrides the artifact's label. Pass `false` to render the value alone. */
  label?: string | false;
  className?: string;
}

/** One labelled value, formatted by the artifact's serializers. */
export function Field({ path, label, className }: FieldProps) {
  const { field, text } = useDocument();
  const definition = field(path);
  const heading = label === false ? undefined : (label ?? definition.label ?? path);

  return (
    <KeepTogether
      keepId={`field:${path}`}
      data-field-path={path}
      className={className ?? "flex flex-col gap-0.5"}
    >
      {heading ? (
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{heading}</span>
      ) : null}
      <span className="whitespace-pre-line text-neutral-900">{text(path)}</span>
    </KeepTogether>
  );
}
