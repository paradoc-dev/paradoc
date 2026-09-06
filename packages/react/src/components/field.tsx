/**
 * `Field` names a path and renders the value the artifact's serializers produce.
 * It never formats a value itself and never carries its own label.
 *
 * A field is a pagination unit: it is a `KeepTogether`, so it is never split across a
 * page break and renders only on the page the plan put it on.
 *
 * **Some values are left to right whatever the document is.** A phone number in
 * E.164 and an identification number are strings of digits and punctuation, and
 * the bidirectional algorithm has no strong direction to give them, so in a
 * right-to-left paragraph it resolves them against the paragraph and moves the
 * leading `+` to the visual end: `+966112345678` reads as `966112345678+`. The
 * value is not wrong, its direction is, so the field isolates it rather than
 * changing what the serializer produced. Nothing about the serializer output
 * changes, and neither does any left-to-right document: the isolate is applied
 * only where there is something to isolate from.
 */

import { KeepTogether } from "./keep-together";
import { useDocument } from "./document-context";
import { useDocumentTokens } from "./tokens-context";

/** The class `styles.css` carries the isolate under. */
export const LTR_ISOLATE_CLASS = "paradoc-ltr-isolate";

/** The same rule as an inline style, for a renderer that reads no stylesheet. */
export const LTR_ISOLATE_STYLE = { direction: "ltr", unicodeBidi: "isolate" } as const;

export interface FieldProps {
  /** Path into the artifact, such as `customerAddress` or `lineItems.0.unitPrice`. */
  path: string;
  /** Overrides the artifact's label. Pass `false` to render the value alone. */
  label?: string | false;
  className?: string;
}

/**
 * The field types whose value is a run of digits and punctuation with no
 * direction of its own, so a right-to-left paragraph would reorder it.
 *
 * Both are formats rather than prose: E.164 and an identifier are written left
 * to right in every language that uses them.
 */
const LTR_FIELD_TYPES = new Set(["phone", "identification"]);

/** One labelled value, formatted by the artifact's serializers. */
export function Field({ path, label, className }: FieldProps) {
  const { field, text } = useDocument();
  const { dir } = useDocumentTokens();
  const definition = field(path);
  const heading = label === false ? undefined : (label ?? definition.label ?? path);
  // Only where there is something to isolate from. A left-to-right document
  // resolves these values left to right already, so applying it there would
  // change the tree, and the bytes, of every document that never had the
  // problem.
  const isolated = dir === "rtl" && LTR_FIELD_TYPES.has(definition.type);

  return (
    <KeepTogether
      keepId={`field:${path}`}
      data-field-path={path}
      className={className ?? "flex flex-col gap-0.5"}
    >
      {heading ? (
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{heading}</span>
      ) : null}
      <span
        // The class is what `styles.css` gives the browser; the inline style is
        // what an engine reading no stylesheet of ours honours. Both say the
        // same thing, for the reason the typeface is said twice.
        className={
          isolated
            ? `${LTR_ISOLATE_CLASS} whitespace-pre-line text-neutral-900`
            : "whitespace-pre-line text-neutral-900"
        }
        style={isolated ? LTR_ISOLATE_STYLE : undefined}
      >
        {text(path)}
      </span>
    </KeepTogether>
  );
}
