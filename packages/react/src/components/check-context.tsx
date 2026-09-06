/**
 * The document context's check mode.
 *
 * Normal rendering treats a `Field`/`Table` path, or a `Signature` party role,
 * the artifact does not declare as a fault worth stopping for: `resolveField`
 * and `itemField` throw `UnknownFieldPathError` immediately, which is correct
 * for a render that is about to produce a real document — better to fail
 * loudly than print an em dash where a typo hides.
 *
 * A composition check wants the opposite. It wants every fault the tree
 * carries, not just the first one a depth-first walk happens to reach, so
 * `fromJsx` can finish resolving the whole tree and the class and image
 * checks that follow can run over all of it rather than the fragment before
 * the first throw.
 *
 * `CheckModeProvider` supplies a collector that `Document`'s context reads.
 * When present, `field`, `item`, and `party` record an unresolved reference
 * instead of throwing and return something harmless enough to keep
 * rendering going: a blank placeholder field, or the empty party list
 * `party` already returns for an unknown role in every mode. Nothing outside
 * `@paradoc/react/check` ever supplies a collector, so ordinary rendering —
 * and every other consumer of this package — is unchanged.
 */

import { createContext, useContext, type ReactNode } from "react";

/** Records one unresolved `Field`/`Table` path or `Signature` party role. */
export interface UnresolvedPathCollector {
  report(path: string): void;
}

const CheckModeContext = createContext<UnresolvedPathCollector | null>(null);

export interface CheckModeProviderProps {
  /** Where an unresolved path or party role is recorded, in place of a throw. */
  collector: UnresolvedPathCollector;
  children?: ReactNode;
}

/** Turns on check mode for the tree below. `@paradoc/react/check` supplies this. */
export function CheckModeProvider({ collector, children }: CheckModeProviderProps) {
  return <CheckModeContext.Provider value={collector}>{children}</CheckModeContext.Provider>;
}

/** The active collector, or `undefined` outside a check. */
export function useUnresolvedPathCollector(): UnresolvedPathCollector | undefined {
  return useContext(CheckModeContext) ?? undefined;
}
