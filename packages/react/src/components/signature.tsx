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
 */

import { formatByType } from "../lib/format";
import { KeepTogether } from "./keep-together";
import { useDocument } from "./document-context";

/**
 * The signing rule. Sixteen underscores, because that is what core's flow
 * placeholder renders; changing it would make the sealed render differ from the
 * plain one.
 */
export const SIGNATURE_RULE = "________________";

/** The date rule beside it. Nothing places a slot on it: flow supports signature and initials only. */
export const DATE_RULE = "__________";

export interface SignatureProps {
  /** Party role declared by the artifact, such as `provider`. */
  party: string;
  /** 0-based index for a role that admits several parties. Defaults to 0. */
  index?: number;
  /** Stable keep id. Defaults to `signature:<role>`. */
  id?: string;
  className?: string;
}

/** One party's signature block. */
export function Signature({ party, index = 0, id, className }: SignatureProps) {
  const { form, party: partiesFor, serializers, blank, mark } = useDocument();
  const role = form.parties?.[party];
  const signer = partiesFor(party)[index];

  return (
    <KeepTogether
      keepId={id ?? `signature:${party}`}
      data-party-role={party}
      className={className ?? "flex flex-col gap-1"}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {role?.label ?? party}
      </span>
      <span className="text-sm text-neutral-900">
        {formatByType("party", signer, serializers, blank, `party:${party}:${index}`)}
      </span>
      <div className="mt-6 flex gap-6">
        <div className="flex basis-2/3 flex-col gap-1">
          <span className="text-sm text-neutral-800">{mark(party, index) ?? SIGNATURE_RULE}</span>
          <span className="text-xs text-neutral-500">
            Signature{role?.signature?.required ? " (required)" : ""}
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
