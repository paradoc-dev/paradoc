// @vitest-environment jsdom
/**
 * A document being filled by a session.
 *
 * The engine is the real one: `createParadocRuntime` over the purchase order
 * artifact, `execute` for every answer, and `sessionPayload` for what has been
 * answered so far. Nothing here fakes a session, because what is under test is
 * the whole path an agent drives, from an empty log to a document that is ready
 * to seal.
 *
 * Three claims, and they are the ticket's:
 *
 * 1. **Every state renders.** A document mid-fill is a document, and there are
 *    as many of them as there are fields. The composition may not throw on any
 *    of them.
 * 2. **An accepted answer changes the field it answered, and nothing else.**
 *    The plan is not dropped and no sheet or keep is unmounted, so every keep in
 *    the preview is the same DOM node before and after; only the text inside the
 *    answered one differs.
 * 3. **A rejected answer changes nothing at all.** `execute` hands back no
 *    session, the host keeps the one it had, and the preview does not even
 *    re-render.
 *
 * jsdom has no layout engine, so every keep measures zero and the plan is one
 * page. That is fine here: what is being measured is which DOM nodes survive an
 * edit, not where the page breaks fall. The breaks are `plan.test.ts` and the
 * parity suite.
 */

import { act, useMemo } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  deriveView,
  execute,
  project,
  sessionPayload,
  type ArtifactRuntime,
  type FormSession,
  type SessionPayload,
} from "@paradoc/sessions";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Pages } from "../../components/src/components/pages";
import type { FormatOptions } from "../src/lib/format";
import {
  purchaseOrderAnswers,
  purchaseOrderData,
  purchaseOrderDocumentData,
  PurchaseOrderDocument,
  purchaseOrderSpec,
  type PurchaseOrderPayload,
} from "../../components/src/examples";
import {
  emptySession,
  fillBySession,
  fillStep,
  runtimeFor,
  SCRIPT_AT,
} from "./session-driver";

const ACTOR = { kind: "user" } as const;
const CLOCK = { now: () => SCRIPT_AT };
const NAME = "purchase-order";

/** Memoized at module scope: a fresh object every render is a fresh context. */
const PARTIAL: FormatOptions = { partial: true };

/**
 * What a session projects is what a document renders, at every point of a fill.
 * A compile-time assertion rather than a runtime one: it is the two packages
 * agreeing on a shape, and the place that would break is a build.
 */
const _payloadIsDocumentData: PurchaseOrderPayload = {} as SessionPayload;
void _payloadIsDocumentData;

let container: HTMLDivElement;
let root: Root;

/** A font set that is already loaded, so `Pages` plans on the first commit. */
function loadedFonts(): void {
  Object.defineProperty(document, "fonts", {
    value: {
      ready: Promise.resolve(),
      check: () => true,
      load: () => Promise.resolve([]),
    },
    configurable: true,
  });
}

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  loadedFonts();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function purchaseOrderRuntime(): ArtifactRuntime {
  return runtimeFor(purchaseOrderSpec);
}

/** Answers, or skips, whatever the session asks for next, from the sample. */
function step(session: FormSession, runtime: ArtifactRuntime) {
  return fillStep(session, runtime, purchaseOrderAnswers);
}

/**
 * The host: it holds the session, and derives the document from it.
 *
 * `useMemo` on the session is the whole of the live binding. A session the
 * engine did not change is the same object, so the data is the same object, so
 * there is nothing for React to do — which is claim 3, and it is a property of
 * the engine's contract rather than of anything this package memoizes.
 */
function Preview({ session }: { session: FormSession }) {
  const data = useMemo(
    () => purchaseOrderDocumentData(sessionPayload(project(session.events))),
    [session]
  );
  return (
    <Pages>
      {/* Partial, because that is exactly what this is: a document somebody is
          part-way through answering. Without it the composition throws on the
          first money def whose amount has not landed. */}
      <PurchaseOrderDocument data={data} format={PARTIAL} />
    </Pages>
  );
}

async function show(session: FormSession): Promise<void> {
  await act(async () => {
    root.render(<Preview session={session} />);
  });
}

/** The paginated preview, not the hidden container the measuring pass reads. */
function stack(): HTMLElement {
  const found = container.querySelector<HTMLElement>("[data-page-stack]");
  if (!found) throw new Error("the preview rendered no page stack");
  return found;
}

/** Every keep in the preview, by its keep id. */
function keeps(): Map<string, HTMLElement> {
  const found = new Map<string, HTMLElement>();
  for (const element of stack().querySelectorAll<HTMLElement>("[data-keep-id]")) {
    const id = element.dataset.keepId;
    if (id !== undefined && !found.has(id)) found.set(id, element);
  }
  return found;
}

/** What one field prints right now. */
function fieldText(path: string): string {
  return keeps().get(`field:${path}`)?.textContent ?? "";
}

describe("a purchase order filled by a session", () => {
  it("renders every state between empty and complete", async () => {
    const runtime = purchaseOrderRuntime();
    let session = emptySession(NAME);

    await show(session);
    expect(stack().querySelectorAll("[data-keep-id]").length).toBeGreaterThan(0);
    // Nothing has been answered, so every value is blank and the totals have
    // nothing to add up. The document is still a document.
    expect(fieldText("orderNumber")).toContain("—");

    for (let count = 0; count < 60; count++) {
      const answered = step(session, runtime);
      if (!answered) break;
      session = answered.session;
      await show(session);
      expect(stack().querySelectorAll("[data-keep-id]").length).toBeGreaterThan(0);
    }

    expect(deriveView(session, runtime).phase).toBe("ready");
    expect(fieldText("orderNumber")).toContain(purchaseOrderData.fields.orderNumber as string);
  });

  it("asks for every field the seal needs, including the one nothing prints", () => {
    const { order } = fillBySession(NAME, purchaseOrderSpec, purchaseOrderAnswers);

    // The buyer's contact is the person the seal binds the buyer's signer to.
    // The composition prints no `Field` for it, which is the composition's
    // decision; the artifact still has to collect it or the packet cannot seal.
    expect(order).toContain("buyerContact");
    expect(order).toContain("party:buyer");
    expect(order).toContain("party:supplier");
    // Derived, so a session never asks for it.
    expect(order).not.toContain("subtotalAmount");
  });

  it("computes the totals from the rows the session answered", async () => {
    // What the sample prints when it is handed over whole, which is what a
    // session that answered all of it must reproduce. Compared rather than
    // written down, so a sample that grows a row needs nothing here changed.
    await act(async () => {
      root.render(
        <Pages>
          <PurchaseOrderDocument data={purchaseOrderData} format={PARTIAL} />
        </Pages>
      );
    });
    const fromTheSample = keeps().get("totals")?.textContent;
    expect(fromTheSample).toMatch(/\$[\d,]+\.\d\d/);

    const { session } = fillBySession(NAME, purchaseOrderSpec, purchaseOrderAnswers);
    await show(session);
    expect(keeps().get("totals")?.textContent).toBe(fromTheSample);
  });

  it("changes the answered field and leaves every other keep's node alone", async () => {
    const runtime = purchaseOrderRuntime();
    let session = emptySession(NAME);
    await show(session);

    let before = keeps();
    let beforeText = new Map([...before].map(([id, node]) => [id, node.textContent ?? ""]));

    for (let count = 0; count < 60; count++) {
      const answered = step(session, runtime);
      if (!answered) break;
      session = answered.session;
      await show(session);

      const after = keeps();
      for (const [id, node] of before) {
        // The plan did not change, so no sheet was unmounted and every keep the
        // preview already had is the very same element.
        expect(after.get(id), `keep "${id}" was replaced`).toBe(node);
      }

      // A field answer changes exactly its own keep. A party answer changes the
      // signature blocks, and answering the currency reprints every money value
      // there is, so only the field case is pinned down this precisely.
      if (answered.did === "orderNumber") {
        const changed = [...after].filter(([id, node]) => beforeText.get(id) !== node.textContent);
        expect(changed.map(([id]) => id)).toEqual(["field:orderNumber"]);
      }

      before = after;
      beforeText = new Map([...after].map(([id, node]) => [id, node.textContent ?? ""]));
    }
  });

  it("leaves the document exactly as it was when a value is rejected", async () => {
    const runtime = purchaseOrderRuntime();
    const { session } = fillBySession(NAME, purchaseOrderSpec, purchaseOrderAnswers);
    await show(session);

    const painted = stack().outerHTML;
    const nodes = keeps();

    // The artifact wants an ISO 4217 code, and "dollars" is not one. The engine
    // hands back no session at all on a rejection, so the host still holds the
    // one it had.
    const rejected = execute(
      session,
      runtime,
      { kind: "revise", fieldPath: "currency", value: "dollars" },
      ACTOR,
      CLOCK
    );
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error("unreachable");
    expect(rejected.code).toBe("invalid-value");

    await show(session);
    expect(stack().outerHTML).toBe(painted);
    for (const [id, node] of nodes) expect(keeps().get(id), `keep "${id}"`).toBe(node);
  });
});
