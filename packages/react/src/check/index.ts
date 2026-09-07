/**
 * Checks a composition against its artifact without rendering a PDF.
 *
 * A composition can fail three ways the PDF path would only discover at
 * render time: a class the default engine has not verified, a `Field`/`Table`
 * path (or `Signature` party role) the artifact does not declare, or an image
 * with no bytes a render would need to embed. All three are worth catching
 * before a render is attempted, so this walks the same tree the PDF path
 * walks and never produces PDF bytes.
 *
 * **Check mode.** Normal rendering throws `UnknownFieldPathError` the instant
 * a `Field` or `Table` names a path the artifact does not declare, which stops
 * `@takumi-rs/helpers` from resolving the rest of the tree — the walk that
 * would otherwise find every unsupported class and every missing image never
 * finishes. `checkElement` wraps the element in a `PartialValuesProvider` and a
 * `CheckModeProvider`
 * (`../components/check-context.tsx`), which `Document`'s context reads: with
 * a collector present, `field`, `item`, and `party` record a fault and return
 * a placeholder instead of throwing, so the walk completes and every check
 * runs over the whole tree in one pass. Nothing outside this module ever
 * supplies a collector, so ordinary rendering is unchanged.
 *
 * **A resolved path can still fail to format, and that is not always a
 * fault.** A `Totals` def, or a `Field`, formats the value it resolves to,
 * and a money/percentage/etc. serializer throws `ArtifactFieldFormatError` on
 * a value it rejects — including `{ amount: null, currency: null }`, what a
 * money def computes from fields the caller's sample data never set.
 * `text`/`defText` catch that throw the same collector catches everything
 * else with, and tell the two cases apart: a value with no data anywhere in
 * it is exactly what "no sample data" looks like and is substituted with the
 * blank placeholder unreported, so a composition with a `Totals` block still
 * checks its schema with no sample data at all, exactly as the module doc
 * above claims; a value that does carry data and is still rejected is a real
 * problem and is reported into `unresolvedPaths` at the failing location
 * (`defs.<name>` for a def, the field path for a `Field`).
 *
 * **A component, or an already-built element.** `checkComposition` builds the
 * element itself from a component and `artifact`/`data`, which is what a layer
 * binds to. A caller that has already built the element — `para dev`, which
 * compiles a composition through the project's own Vite and must build it with
 * the project's own React rather than this package's — passes the element
 * straight to `checkElement` instead; `artifact` and `data` are meaningless
 * there, since the element already carries whatever `<Document artifact={...}
 * data={...}>` call it renders.
 *
 * **`missingImages` is not a verdict.** A render needs bytes for every image
 * `src` that is not a `data:` URI, and this check supplies none — it never
 * renders — so every such `src` is reported unconditionally, whether or not
 * the caller would in fact have bytes for it at render time. `para check`, who
 * never resolves bytes either, treats a non-empty list as a failure. `para
 * dev`, who resolves image sources from disk itself before handing them to
 * `renderPdf`, must not: a composition whose images the tool can in fact
 * supply is not broken for still needing them. Whether `missingImages` fails
 * a check is therefore the caller's call, never this module's — the three
 * arrays are returned independently, and none of them combine into a single
 * pass/fail flag here.
 *
 * **No PDF is produced.** Fonts are never resolved, geometry is never applied,
 * and no engine is invoked. What this proves is confined to what a render
 * would fail on before it starts writing bytes, which is what makes it fast
 * enough to run on every save.
 */

import { createElement, type ReactElement, type ReactNode } from "react";
import { fromJsx } from "@takumi-rs/helpers/jsx";
import type { Form } from "@paradoc/types";

import { CheckModeProvider, type UnresolvedPathCollector } from "../components/check-context";
import { PartialValuesProvider } from "../components/partial-context";
import type { DocumentData } from "../components/document-context";
import { UnknownFieldPathError } from "../lib/fields";
import { ArtifactFieldFormatError } from "../lib/format";
import type { ReactLayerComponent } from "../pdf/layer";
import { preparePdfTree } from "../pdf/tree";
import type { PdfAdapterName } from "../pdf/adapter";

/** Data a check runs with when the caller has no sample to hand over. */
const EMPTY_DATA: DocumentData = { fields: {}, parties: {} };

export interface CheckCompositionOptions {
  /**
   * The artifact `Field`/`Table` paths are resolved against. Required: this
   * is what `composition` is called with as a prop, the same as a layer's
   * renderer calls it.
   */
  artifact: Form;
  /** The composition, not yet built into an element. */
  composition: ReactLayerComponent;
  /** Sample data to render the composition with. Defaults to empty fields and parties. */
  data?: DocumentData;
  /**
   * Which adapter's rules to check the tree's classes against. Only `takumi`
   * carries a verified class vocabulary today: `chromium` prints through a real
   * browser and accepts whatever CSS the tree produces, so `unsupportedClasses`
   * is always empty for it. Defaults to `takumi`.
   */
  adapter?: PdfAdapterName;
}

export interface CheckElementOptions {
  /** Which adapter's rules to check the tree's classes against. Defaults to `takumi`. */
  adapter?: PdfAdapterName;
}

/**
 * What a composition check found. Every array is empty when the composition
 * is clean, and none of the three combine into a single verdict — see the
 * module doc for why `missingImages` in particular is not automatically a
 * failure.
 */
export interface CompositionCheckResult {
  /** Classes outside the chosen adapter's verified vocabulary, in document order. */
  unsupportedClasses: string[];
  /**
   * `Field`/`Table` paths the artifact does not declare, any `Signature`
   * party role it does not declare (reported as `party:<role>`), and any
   * `Field` path or `Totals` def whose resolved value carries real data a
   * serializer still rejects (a def reported as `defs.<name>`) — in the
   * order the tree first names each one, each named once. A value with no
   * data anywhere in it (a def computed from fields the sample never set,
   * say) is not reported here: that is what running with no sample data
   * looks like, not a fault.
   */
  unresolvedPaths: string[];
  /** Image `src` values that are not `data:` URIs, in document order. */
  missingImages: string[];
}

function collectInto(paths: string[]): UnresolvedPathCollector {
  return {
    report(path: string) {
      if (!paths.includes(path)) paths.push(path);
    },
  };
}

/**
 * Builds a composition's element from `artifact` and `data`, then checks it.
 * Use this when you have the component, not yet an element — binding a
 * layer's module produces one. Pass an already-built element to
 * {@link checkElement} instead.
 *
 * @throws Whatever the composition itself throws for a reason other than an
 * unresolved field path or party role — a value a serializer rejects, for one
 * — because that is a defect in the sample data or the artifact rather than
 * something this check is scoped to name.
 */
export async function checkComposition(
  options: CheckCompositionOptions
): Promise<CompositionCheckResult> {
  const { artifact, composition, data = EMPTY_DATA, adapter } = options;
  const element = createElement(composition, { artifact, data });
  return checkElement(element, { adapter });
}

/**
 * Checks an already-built element the same way {@link checkComposition} checks
 * one it builds itself.
 *
 * For a caller whose composition must be built by its own React instance —
 * `para dev` compiles a composition through the project's own Vite — pass the
 * element you already have. `artifact` and `data` play no part here: the
 * element already carries whatever it was built with.
 *
 * @throws Whatever the element itself throws for a reason other than an
 * unresolved field path or party role.
 */
export async function checkElement(
  element: ReactElement,
  options: CheckElementOptions = {}
): Promise<CompositionCheckResult> {
  const { adapter = "takumi" } = options;
  const unresolvedPaths: string[] = [];
  const collector = collectInto(unresolvedPaths);

  // Partial mode, because a check runs against whatever sample data there is
  // and often against none. A def computed from fields the sample never set is
  // the state a document being filled is in, not a fault in the composition,
  // and the check is about the composition. A value that is wrong rather than
  // unfinished is still reported.
  const wrapped: ReactNode = createElement(
    PartialValuesProvider,
    { partial: true },
    createElement(CheckModeProvider, { collector }, element)
  );

  // Check mode means every `Field`/`Table`/`Signature` fault the tree carries,
  // and every value a `Totals` def or a `Field` formats, is collected above
  // rather than thrown, so this should never reject with either error. The
  // catch stays as a defensive fallback for a composition that resolves a
  // path or formats a value itself, outside the document context check mode
  // instruments — reported the same way rather than escaping uncaught and
  // losing whatever classes and images the walk found first.
  let node: Awaited<ReturnType<typeof fromJsx>>["node"];
  try {
    ({ node } = await fromJsx(wrapped));
  } catch (error) {
    if (error instanceof UnknownFieldPathError) {
      collector.report(error.path);
      return { unsupportedClasses: [], unresolvedPaths, missingImages: [] };
    }
    if (error instanceof ArtifactFieldFormatError) {
      collector.report(error.path);
      return { unsupportedClasses: [], unresolvedPaths, missingImages: [] };
    }
    throw error;
  }

  // No image is ever supplied to a check: it never renders, so there is
  // nothing to embed and nothing an image's absence would block here. Every
  // `src` that is not self-contained is reported unconditionally; whether that
  // is a failure is the caller's call, not this function's (see module doc).
  const prepared = preparePdfTree(node);

  return {
    unsupportedClasses: adapter === "chromium" ? [] : prepared.unsupportedClasses,
    unresolvedPaths,
    missingImages: prepared.missingImages,
  };
}

