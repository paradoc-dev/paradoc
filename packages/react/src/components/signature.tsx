/**
 * `Signature` names a party and renders its signing block.
 *
 * The role label, the signing requirement, and the party's own name all come
 * from the artifact: the label from `parties[role].label`, the name through the
 * party serializer. The keep is one pagination unit and is never split.
 *
 * The signing rule is text, not a border. The core seal flow places a
 * flow-positioned slot by locating an invisible marker in the converted PDF and
 * sizing the field from the underscore run on the same line, so a document that
 * draws its rule with a one-pixel div gives the seal nothing to measure. The
 * default is the exact placeholder core's flow renderer produces, so the sealed
 * document and the plain one are the same page. `tests/seal.test.tsx` asserts
 * that, page by page.
 *
 * The block is also where the marker goes. On the seal's marker pass the layer's
 * renderer supplies one per slot through the signing context, and the block
 * writes its own immediately before its rule; every other render carries none
 * and the rule is drawn alone. That is what lets a composition be a seal target
 * with no auxiliary layer describing where its signatures are.
 *
 * **One block per slot.** A block draws a signature or a set of initials, named
 * by `type`, and finds its marker by the party and that type. A party may carry
 * one flow slot per type, so a party signing and initialling is two blocks and
 * two slots.
 */

import { KeepTogether } from "./keep-together";
import { useDocument } from "./document-context";
import type { SigningMarkType } from "./signing-context";

/**
 * The signature rule. Sixteen underscores, because that is what core's flow
 * placeholder renders; changing it would make the sealed render differ from the
 * plain one.
 */
export const SIGNATURE_RULE = "________________";

/** The initials rule, six underscores, for the same reason. */
export const INITIALS_RULE = "______";

/** The date rule beside them. Nothing places a slot on it: flow supports signature and initials only. */
export const DATE_RULE = "__________";

/** The rule and the caption each field type draws. */
const FIELD = {
  signature: { rule: SIGNATURE_RULE, label: "Signature" },
  initials: { rule: INITIALS_RULE, label: "Initials" },
} as const satisfies Record<SigningMarkType, { rule: string; label: string }>;

export interface SignatureProps {
  /** Party role declared by the artifact, such as `provider`. */
  party: string;
  /** 0-based index for a role that admits several parties. Defaults to 0. */
  index?: number;
  /** Which signing field this block draws. Defaults to a signature. */
  type?: SigningMarkType;
  /** Stable keep id. Defaults to `<type>:<role>`. */
  id?: string;
  className?: string;
}

/** One party's signing block, for one field type. */
export function Signature({ party, index = 0, type = "signature", id, className }: SignatureProps) {
  const { form, partyText, mark } = useDocument();
  const role = form.parties?.[party];
  const field = FIELD[type];

  return (
    <KeepTogether
      keepId={id ?? `${type}:${party}`}
      data-party-role={party}
      data-signing-type={type}
      className={className ?? "flex flex-col gap-1"}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {role?.label ?? party}
      </span>
      <span className="text-sm text-neutral-900">
        {partyText(party, index)}
      </span>
      <div className="mt-6 flex gap-6">
        <div className="flex basis-2/3 flex-col gap-1">
          {/* One string, not two children: the locator sizes the field from the
              underscore run that carries the marker, so they must reach the PDF
              as a single text run. */}
          <span className="text-sm text-neutral-800">{`${mark(party, index, type) ?? ""}${field.rule}`}</span>
          <span className="text-xs text-neutral-500">
            {field.label}
            {role?.signature?.required ? " (required)" : ""}
          </span>
        </div>
        <div className="flex basis-1/3 flex-col gap-1">
          <span className="text-sm text-neutral-800">{DATE_RULE}</span>
          <span className="text-xs text-neutral-500">Date</span>
        </div>
      </div>
    </KeepTogether>
  );
}
