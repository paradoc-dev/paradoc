/**
 * The reference document rendered through its React layer.
 *
 * The layer is a pointer, so the interesting part is the binding: core hands
 * the renderer a path and a key and nothing else, and the renderer has to turn
 * that into the same component the direct call renders. The criterion is byte
 * identity with `renderPdf`, because a layer that produced a different document
 * from the tree would break the specification's central invariant.
 */

import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";
import { UnregisteredLayerRendererError } from "@paradoc/core";

import {
  proposal,
  PROPOSAL_REACT_LAYER,
  PROPOSAL_REACT_LAYER_PATH,
  ProposalDocument,
  shortProposalData,
} from "../src/examples";
import { proposalLogoImage } from "../src/examples/pdf";
import { renderPdf } from "../src/pdf";
import {
  reactLayerRenderers,
  reactRenderer,
  UnboundReactLayerError,
} from "../src/pdf/layer";

/** The package root. */
const PACKAGE_ROOT = resolve(import.meta.dirname, "..");

/**
 * The directory the sample's artifact file lives in, which is what its layer
 * path is relative to and what a caller sets `baseDir` to.
 */
const ARTIFACT_DIR = resolve(PACKAGE_ROOT, "src/examples");

/**
 * A base directory the sample's module is not under, so the import route cannot
 * bind from it. A test of the `components` map that left `baseDir` at the
 * working directory would pass through the import and prove nothing.
 */
const NOWHERE = resolve(import.meta.dirname, "fixtures-that-do-not-exist");

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

let logo: Awaited<ReturnType<typeof proposalLogoImage>>;
/** The document as the direct call renders it. Everything else is compared to this. */
let direct: string;

beforeAll(async () => {
  logo = await proposalLogoImage();
  direct = digest(
    (await renderPdf(<ProposalDocument data={shortProposalData} />, { images: [logo] })).bytes
  );
}, 60_000);

/** The proposal filled with the short data set, ready to render. */
function filled() {
  return proposal.fill({
    fields: shortProposalData.fields,
    parties: shortProposalData.parties,
  } as Parameters<typeof proposal.fill>[0]);
}

describe("rendering the sample through its React layer", () => {
  it("produces the same PDF as the direct call, bound by the components map", async () => {
    const bytes = await filled().render<Uint8Array>({
      layer: PROPOSAL_REACT_LAYER,
      // No baseDir: with the import route switched off, only the map can bind.
      renderers: reactLayerRenderers({
        components: { [PROPOSAL_REACT_LAYER_PATH]: ProposalDocument },
        baseDir: NOWHERE,
        pdf: { images: [logo] },
      }),
    });

    expect(digest(bytes)).toBe(direct);
  }, 60_000);

  it("produces the same PDF bound by importing the module the path names", async () => {
    // No components map: the renderer resolves the layer's path against
    // `baseDir` and takes the module's default export.
    const bytes = await filled().render<Uint8Array>({
      layer: PROPOSAL_REACT_LAYER,
      renderers: reactLayerRenderers({ baseDir: ARTIFACT_DIR, pdf: { images: [logo] } }),
    });

    expect(digest(bytes)).toBe(direct);
  }, 60_000);

  it("binds by the layer key as well as by its path", async () => {
    const bytes = await filled().render<Uint8Array>({
      layer: PROPOSAL_REACT_LAYER,
      renderers: reactLayerRenderers({
        components: { [PROPOSAL_REACT_LAYER]: ProposalDocument },
        baseDir: NOWHERE,
        pdf: { images: [logo] },
      }),
    });

    expect(digest(bytes)).toBe(direct);
  }, 60_000);

  it("renders the same document from the unfilled artifact and its data", async () => {
    const bytes = await proposal.render<Uint8Array>({
      layer: PROPOSAL_REACT_LAYER,
      data: {
        fields: shortProposalData.fields,
        parties: shortProposalData.parties,
      } as unknown as Record<string, unknown>,
      renderers: reactLayerRenderers({
        components: { [PROPOSAL_REACT_LAYER_PATH]: ProposalDocument },
        baseDir: NOWHERE,
        pdf: { images: [logo] },
      }),
    });

    expect(digest(bytes)).toBe(direct);
  }, 60_000);

  it("registers both React MIME types under one renderer", () => {
    const renderers = reactLayerRenderers();
    expect(Object.keys(renderers)).toEqual(["text/tsx", "text/jsx"]);
    expect(renderers["text/tsx"]).toBe(renderers["text/jsx"]);
    expect(renderers["text/tsx"].id).toBe("react");
  });
});

describe("choosing between the two binding routes", () => {
  it("prefers the components map over the module the path names", async () => {
    // Both routes could bind here. The map wins, so a bundled application never
    // touches the file system and an artifact never picks the component.
    let called = false;
    const Stub = () => {
      called = true;
      return null;
    };

    const bytes = await filled().render<Uint8Array>({
      layer: PROPOSAL_REACT_LAYER,
      renderers: reactLayerRenderers({
        components: { [PROPOSAL_REACT_LAYER_PATH]: Stub },
        baseDir: ARTIFACT_DIR,
        pdf: { images: [logo] },
      }),
    });

    expect(called).toBe(true);
    expect(digest(bytes)).not.toBe(direct);
  }, 60_000);
});

describe("a layer that cannot be bound", () => {
  it("fails when the layer names no module path at all", async () => {
    const renderer = reactRenderer({ baseDir: ARTIFACT_DIR });

    await expect(
      renderer.render({
        template: { type: "react", mimeType: "text/tsx", key: "composition" },
        form: proposal.toJSON() as never,
        data: { fields: {} },
      })
    ).rejects.toThrow(/the layer names no module path/);
  });

  it("refuses an absolute layer path rather than importing it", async () => {
    // Importing runs the module. An artifact is data, so a path it names is
    // confined to baseDir; an absolute one is not confined at all.
    const renderer = reactRenderer({ baseDir: ARTIFACT_DIR });

    await expect(
      renderer.render({
        template: {
          type: "react",
          mimeType: "text/tsx",
          key: "composition",
          path: resolve(ARTIFACT_DIR, PROPOSAL_REACT_LAYER_PATH),
        },
        form: proposal.toJSON() as never,
        data: { fields: {} },
      })
    ).rejects.toThrow(/the layer path is absolute/);
  });

  it("refuses a relative path that climbs out of baseDir", async () => {
    const renderer = reactRenderer({ baseDir: ARTIFACT_DIR });

    await expect(
      renderer.render({
        template: {
          type: "react",
          mimeType: "text/tsx",
          key: "composition",
          path: "../../../../../etc/passwd",
        },
        form: proposal.toJSON() as never,
        data: { fields: {} },
      })
    ).rejects.toThrow(/outside/);
  });


  it("fails naming the path and both binding options", async () => {
    const missing = "src/compositions/not-here.tsx";
    const renderer = reactRenderer({ baseDir: ARTIFACT_DIR });

    const attempt = renderer.render({
      template: { type: "react", mimeType: "text/tsx", key: "composition", path: missing },
      form: proposal.toJSON() as never,
      data: { fields: {} },
    });

    await expect(attempt).rejects.toThrow(UnboundReactLayerError);
    await expect(attempt).rejects.toThrow(new RegExp(missing.replace(/[/.]/g, "\\$&")));
    await expect(attempt).rejects.toThrow(/`components` map/);
    await expect(attempt).rejects.toThrow(/default export/);
  });

  it("names the export it looked for when the module has no such component", async () => {
    const renderer = reactRenderer({ baseDir: ARTIFACT_DIR, exportName: "NotAComponent" });

    await expect(
      renderer.render({
        template: {
          type: "react",
          mimeType: "text/tsx",
          key: "composition",
          path: PROPOSAL_REACT_LAYER_PATH,
        },
        form: proposal.toJSON() as never,
        data: { fields: {} },
      })
    ).rejects.toThrow(/no `NotAComponent` export that is a component/);
  }, 60_000);

  it("fails from core when no renderer is registered for the layer at all", async () => {
    await expect(filled().render({ layer: PROPOSAL_REACT_LAYER })).rejects.toThrow(
      UnregisteredLayerRendererError
    );
  });
});
