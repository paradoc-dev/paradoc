import { INITIALS_RULE, SIGNATURE_RULE } from "@paradoc/core";

import { useArtifact } from "./artifact";
import { usePartyContact } from "./party";
import { findSigningMark, useSigningMarks, type SigningMarkType } from "../components/signing-context";

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
  const contact = usePartyContact(role, index);
  const marks = useSigningMarks();
  const definition = artifact.parties?.[role];
  const field = FIELDS[type];
  const marker = findSigningMark(marks, role, index, type);
  return {
    role,
    index,
    type,
    roleLabel: contact.roleLabel,
    partyText: contact.nameText,
    fieldLabel: field.label,
    required: definition?.signature?.required ?? false,
    rule: field.rule,
    dateRule: DATE_RULE,
    ...(marker !== undefined ? { marker } : {}),
  };
}
