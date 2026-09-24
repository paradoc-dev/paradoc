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

import { p } from "@paradoc/core";
import type { Form } from "@paradoc/types";
import { describe, expect, it } from "vitest";

import { Document } from "../../components/src/components/document";
import { Section } from "../../components/src/components/section";
import { INITIALS_RULE, Signature, SIGNATURE_RULE } from "../../components/src/components/signature";
import type { DocumentData } from "@paradoc/react";
import { reactLayerRenderers } from "../src/layer";
import { readPdf } from "./pdf-reader";

const LAYER = "composition";

const SLOTS = { signature: "tenant-signature", initials: "tenant-initials" } as const;

const spec = {
  $schema: "https://schema.paradoc.dev/2026-09-23.json",
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

const rider = p.form(spec);

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
