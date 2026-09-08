import { KeepTogether, useDocumentTokens, useField } from "@paradoc/react";

export interface FieldProps {
  path: string;
  label?: string | false;
  className?: string;
}

export function Field({ path, label, className }: FieldProps) {
  const binding = useField(path);
  const { dir } = useDocumentTokens();
  const heading = label === false ? undefined : (label ?? binding.field.label ?? path);
  const isolated = dir === "rtl" && ["phone", "identification"].includes(binding.field.type);
  return (
    <KeepTogether keepId={`field:${path}`} data-field-path={path} className={className ?? "flex flex-col gap-0.5"}>
      {heading ? <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{heading}</span> : null}
      <span className="whitespace-pre-line text-neutral-900" style={isolated ? { direction: "ltr", unicodeBidi: "isolate" } : undefined}>
        {binding.text}
      </span>
    </KeepTogether>
  );
}
