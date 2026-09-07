import { createContext, useContext, type ReactNode } from "react";
import type { Formatter, FormatterProgressivePolicy } from "@paradoc/types";

export interface ArtifactFormatting {
  formatter?: Formatter;
  progressive?: FormatterProgressivePolicy;
}
const Context = createContext<ArtifactFormatting>({});
export function FormatterProvider({ children, ...value }: ArtifactFormatting & { children?: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useArtifactFormatting(): ArtifactFormatting { return useContext(Context); }
