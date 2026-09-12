/**
 * A copy-owned field row. It reads labels and formatted values from the
 * headless runtime and stays together as one pagination unit.
 */
/** @jsxRuntime classic */
import React from "react";
import { scaleTextClasses, useDocumentTokens, useField } from "@paradoc/react";
import { KeepTogether } from "./keep-together";

export interface FieldProps {
  /** Path into the artifact this field reads its label and value from. */
  path: string;
  /** Overrides the field's heading: a string replaces it, `false` hides it, omitted uses the artifact's own label. */
  label?: string | false;
  /** Classes for the field's wrapping element. */
  className?: string;
}

export function Field({ path, label, className }: FieldProps) {
  const binding = useField(path);
  const { dir, typography } = useDocumentTokens();
  const heading = label === false ? undefined : (label ?? binding.field.label ?? path);
  const isolated = dir === "rtl" && ["phone", "identification"].includes(binding.field.type);
  return (
    <KeepTogether keepId={`field:${path}`} data-field-path={path} className={className ?? "flex flex-col gap-0.5"}>
      {heading ? <span className={scaleTextClasses("text-xs font-medium uppercase tracking-wide text-neutral-500", typography.scale)}>{heading}</span> : null}
      <span className="whitespace-pre-line text-neutral-900" style={isolated ? { direction: "ltr", unicodeBidi: "isolate" } : undefined}>
        {binding.text}
      </span>
    </KeepTogether>
  );
}
