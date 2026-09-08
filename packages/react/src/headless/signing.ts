import { formatParties } from "@paradoc/render/text/field-formatter";

import { useArtifact, useFormatter, useParty } from "./artifact";
import { findSigningMark, useSigningMarks, type SigningMarkType } from "../components/signing-context";

export const SIGNATURE_RULE = "________________";
export const INITIALS_RULE = "______";
export const DATE_RULE = "__________";

const FIELDS = {
  signature: { rule: SIGNATURE_RULE, label: "Signature" },
  initials: { rule: INITIALS_RULE, label: "Initials" },
} as const;

export interface SignatureBinding {
  role: string;
  index: number;
  type: SigningMarkType;
  roleLabel: string;
  partyText: string;
  fieldLabel: string;
  required: boolean;
  rule: string;
  dateRule: string;
  marker?: string;
}

/** Resolves one signing slot without rendering its markup. */
export function useSignature(role: string, index = 0, type: SigningMarkType = "signature"): SignatureBinding {
  const artifact = useArtifact();
  const parties = useParty(role);
  const formatter = useFormatter();
  const marks = useSigningMarks();
  const definition = artifact.parties?.[role];
  const field = FIELDS[type];
  const party = parties[index];
  const partyText = party === undefined
    ? "—"
    : String(formatParties(formatter, artifact, party, `parties.${role}[${index}]`, { progressive: { missing: "—", incomplete: "—" } }, role) ?? "—");
  const marker = findSigningMark(marks, role, index, type);
  return {
    role,
    index,
    type,
    roleLabel: definition?.label ?? role,
    partyText,
    fieldLabel: field.label,
    required: definition?.signature?.required ?? false,
    rule: field.rule,
    dateRule: DATE_RULE,
    ...(marker !== undefined ? { marker } : {}),
  };
}
