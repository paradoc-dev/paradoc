/**
 * One party, two flow slots.
 *
 * A signature and a set of initials on the same party is the ordinary shape, and
 * it is the one a marker structure keyed by party alone quietly breaks: the two
 * slots collapse into one, the second marker never reaches the page, and the
 * seal fails blaming glyph coverage for something that is not a font at all.
 * So the markers are keyed by slot, and a block finds its own by naming the
 * party and the field type it draws.
 *
 * This is its own artifact rather than the sample proposal, because adding an
 * initials block to the reference document would change every measured output
 * this package pins.
 */

import { para } from "@paradoc/core";
import type { Form } from "@paradoc/types";
import { describe, expect, it } from "vitest";

import { Document } from "../src/components/document";
import { Section } from "../src/components/section";
import { INITIALS_RULE, Signature, SIGNATURE_RULE } from "../src/components/signature";
import type { DocumentData } from "../src/components/document-context";
import { AmbiguousSigningMarkError, findSigningMark } from "../src/components/signing-context";
import { reactLayerRenderers } from "../src/pdf/layer";
import { readPdf } from "./pdf-reader";

const LAYER = "composition";

const SLOTS = { signature: "tenant-signature", initials: "tenant-initials" } as const;

const spec = {
  $schema: "https://schema.paradoc.dev/schema.json",
  kind: "form",
  name: "lease-rider",
  version: "1.0.0",
  title: "Lease Rider",
  parties: {
    tenant: {
      label: "Tenant",
      partyType: "person",
      min: 1,
      max: 1,
      signature: { required: true, witnesses: 0, notarized: false },
    },
  },
  fields: {
    reference: { type: "text", label: "Reference", maxLength: 40, required: true, visible: true },
  },
  defaultLayer: LAYER,
  layers: {
    [LAYER]: {
      kind: "file",
      mimeType: "text/tsx",
      path: "lease-rider.tsx",
      title: "Composition",
      signatures: {
        [SLOTS.signature]: {
          party: { role: "tenant" },
          type: "signature",
          label: "Tenant signature",
          placement: "flow",
        },
        [SLOTS.initials]: {
          party: { role: "tenant" },
          type: "initials",
          label: "Tenant initials",
          placement: "flow",
        },
      },
    },
  },
} as const;

const rider = para.form(spec);

/** The composition: one block per slot, both for the same party. */
function LeaseRider({ artifact, data }: { artifact: Form; data: DocumentData }) {
  return (
    <Document artifact={artifact} data={data} id="rider">
      <Section id="acceptance" title="Acceptance" className="flex flex-col gap-6">
        <Signature party="tenant" />
        <Signature party="tenant" type="initials" />
      </Section>
    </Document>
  );
}

const data = {
  fields: { reference: "LR-2026-04" },
  parties: { tenant: { id: "tenant-0", name: "Robin Tenant" } },
};

const draft = () =>
  rider
    .fill(data as Parameters<typeof rider.fill>[0])
    .addSigner("tenant-signer", { person: { name: "Robin Tenant" } })
    .addSignatory("tenant", "tenant-0", { signerId: "tenant-signer" });

describe("a party that signs and initials", () => {
  it("resolves both slots to boxes of their own", async () => {
    const sealed = await draft().seal({
      renderers: reactLayerRenderers({ components: { [LAYER]: LeaseRider } }),
    });

    expect(sealed.signatureMap).toHaveLength(2);
    const [signature, initials] = sealed.signatureMap!;
    expect(signature).toMatchObject({ id: SLOTS.signature, type: "signature", signerId: "tenant-signer" });
    expect(initials).toMatchObject({ id: SLOTS.initials, type: "initials", signerId: "tenant-signer" });

    // Two distinct boxes on the page, the initials block below the signature
    // one, and the initials rule the narrower of the two because it is shorter.
    expect(signature!.width).toBeGreaterThan(0);
    expect(initials!.width).toBeGreaterThan(0);
    expect(initials!.width).toBeLessThan(signature!.width);
    expect(initials!.y).toBeGreaterThan(signature!.y);
  }, 120_000);

  it("draws both rules and no marker in the canonical document", async () => {
    const sealed = await draft().seal({
      renderers: reactLayerRenderers({ components: { [LAYER]: LeaseRider } }),
    });
    const pages = await readPdf(sealed.canonicalPdfBytes!);

    expect(pages).toHaveLength(1);
    expect(pages[0]!.text).toContain(SIGNATURE_RULE);
    expect(pages[0]!.text).toContain(INITIALS_RULE);
    expect(pages[0]!.text).toMatch(/Signature/);
    expect(pages[0]!.text).toMatch(/Initials/);
  }, 120_000);
});

describe("finding a block's own marker", () => {
  const marks = {
    [SLOTS.signature]: {
      slot: SLOTS.signature,
      role: "tenant",
      index: 0,
      type: "signature" as const,
      marker: "SIG",
    },
    [SLOTS.initials]: {
      slot: SLOTS.initials,
      role: "tenant",
      index: 0,
      type: "initials" as const,
      marker: "INI",
    },
  };

  it("keys on the party and the field type, so two slots on one party stay apart", () => {
    expect(findSigningMark(marks, "tenant", 0, "signature")).toBe("SIG");
    expect(findSigningMark(marks, "tenant", 0, "initials")).toBe("INI");
    expect(findSigningMark(marks, "tenant", 1, "signature")).toBeUndefined();
    expect(findSigningMark(marks, "landlord", 0, "signature")).toBeUndefined();
    expect(findSigningMark({}, "tenant", 0, "signature")).toBeUndefined();
  });

  it("refuses to guess when two flow slots claim the same type on one party", () => {
    const ambiguous = {
      a: { slot: "a", role: "tenant", index: 0, type: "signature" as const, marker: "A" },
      b: { slot: "b", role: "tenant", index: 0, type: "signature" as const, marker: "B" },
    };
    expect(() => findSigningMark(ambiguous, "tenant", 0, "signature")).toThrowError(
      AmbiguousSigningMarkError
    );
    expect(() => findSigningMark(ambiguous, "tenant", 0, "signature")).toThrowError(
      /one flow slot per field type/
    );
  });
});
