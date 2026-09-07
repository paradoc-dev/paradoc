import { defaultFormatter } from "@paradoc/format";
import type { FormField, Formatter, FormatterProgressivePolicy } from "@paradoc/types";
import { formatFieldValue, formatDefinitionValue } from "@paradoc/render/text/field-formatter";
export { ArtifactFieldFormatError } from "@paradoc/render/text/field-formatter";

export const BLANK = "—";

export interface FormatOptions {
  formatter?: Formatter;
  blank?: string;
  /** Opt into placeholders for missing and incomplete values while filling. */
  partial?: boolean;
  progressive?: FormatterProgressivePolicy;
}

export type ValueFormatter = (field: FormField | undefined, value: unknown, location?: string) => string;

export interface DocumentFormatter {
  format: ValueFormatter;
  formatter: Formatter;
  blank: string;
  partial: boolean;
  progressive?: FormatterProgressivePolicy;
}

export function formatByType(
  type: string | undefined,
  value: unknown,
  formatter: Formatter = defaultFormatter,
  blank: string = BLANK,
  location?: string,
  progressive?: FormatterProgressivePolicy,
): string {
  const formatted = formatDefinitionValue(formatter, type ?? "string", value, location ?? type ?? "value", { progressive });
  return formatted == null ? blank : String(formatted);
}

export function createValueFormatter(options: FormatOptions = {}): DocumentFormatter {
  const formatter = options.formatter ?? defaultFormatter;
  const blank = options.blank ?? BLANK;
  const partial = options.partial ?? false;
  const progressive = options.progressive ?? (partial ? { missing: blank, incomplete: blank } : undefined);
  const format: ValueFormatter = (field, value, location) => {
    const formatted = formatFieldValue(formatter, field ?? { type: "text" } as FormField, value,
      location ?? field?.label ?? field?.type ?? "value", { progressive });
    return formatted == null ? blank : String(formatted);
  };
  return { format, formatter, blank, partial, progressive };
}
