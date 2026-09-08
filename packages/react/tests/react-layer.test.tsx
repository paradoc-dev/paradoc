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
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UnregisteredLayerRendererError } from "@paradoc/core";

import {
  proposal,
  PROPOSAL_REACT_LAYER,
  PROPOSAL_REACT_LAYER_PATH,
  ProposalDocument,
  shortProposalData,
} from "../../components/src/examples";
import { proposalLogoImage } from "../../components/src/examples/pdf";
import { renderPdf } from "../src/pdf";
import {
  bindComponent,
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
const ARTIFACT_DIR = resolve(PACKAGE_ROOT, "../components/src/examples");

/**
 * A base directory the sample's module is not under, so the import route cannot
 * bind from it. A test of the `components` map that left `baseDir` at the
 * working directory would pass through the import and prove nothing.
 */
const NOWHERE = resolve(import.meta.dirname, "fixtures-that-do-not-exist");

let bindingRoot: string;
let bindingBase: string;
let bindingBaseLink: string;

const OUTSIDE_FILE_EXECUTED = "__paradocOutsideFileExecuted";
const OUTSIDE_DIRECTORY_EXECUTED = "__paradocOutsideDirectoryExecuted";

beforeAll(async () => {
  bindingRoot = await mkdtemp(join(tmpdir(), "paradoc-react-binding-"));
  bindingBase = join(bindingRoot, "base");
  bindingBaseLink = join(bindingRoot, "base-link");
  await mkdir(join(bindingBase, "inside"), { recursive: true });
  await writeFile(join(bindingBase, "..valid.mjs"), "export default function DotValid() {}\n");
  await writeFile(join(bindingBase, "inside", "component.mjs"), "export default function Inside() {}\n");
  await writeFile(
    join(bindingRoot, "outside.mjs"),
    `globalThis.${OUTSIDE_FILE_EXECUTED} = true; export default function Outside() {}\n`
  );
  await mkdir(join(bindingRoot, "outside"));
  await writeFile(
    join(bindingRoot, "outside", "component.mjs"),
    `globalThis.${OUTSIDE_DIRECTORY_EXECUTED} = true; export default function OutsideDirectory() {}\n`
  );
  await symlink(join(bindingBase, "inside", "component.mjs"), join(bindingBase, "inside-link.mjs"));
  await symlink(join(bindingRoot, "outside.mjs"), join(bindingBase, "outside-link.mjs"));
  await symlink(join(bindingRoot, "outside"), join(bindingBase, "outside-directory"), "dir");
  await symlink(bindingBase, bindingBaseLink, "dir");
});

afterAll(async () => {
  await rm(bindingRoot, { recursive: true, force: true });
});

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
  it("loads valid dot-prefixed files and links whose targets stay inside baseDir", async () => {
    const dot = await bindComponent(
      { type: "react", mimeType: "text/jsx", key: "dot", path: "..valid.mjs" },
      { baseDir: bindingBase }
    );
    const linked = await bindComponent(
      { type: "react", mimeType: "text/jsx", key: "linked", path: "inside-link.mjs" },
      { baseDir: bindingBase }
    );
    const throughLinkedBase = await bindComponent(
      { type: "react", mimeType: "text/jsx", key: "root", path: "inside/component.mjs" },
      { baseDir: bindingBaseLink }
    );

    expect(dot.name).toBe("DotValid");
    expect(linked.name).toBe("Inside");
    expect(throughLinkedBase.name).toBe("Inside");
  });

  it("refuses file and directory links whose targets leave baseDir", async () => {
    delete (globalThis as Record<string, unknown>)[OUTSIDE_FILE_EXECUTED];
    delete (globalThis as Record<string, unknown>)[OUTSIDE_DIRECTORY_EXECUTED];

    await expect(
      bindComponent(
        { type: "react", mimeType: "text/jsx", key: "file", path: "outside-link.mjs" },
        { baseDir: bindingBase }
      )
    ).rejects.toThrow(/resolves through the filesystem.*outside/s);

    await expect(
      bindComponent(
        {
          type: "react",
          mimeType: "text/jsx",
          key: "directory",
          path: "outside-directory/component.mjs",
        },
        { baseDir: bindingBase }
      )
    ).rejects.toThrow(/resolves through the filesystem.*outside/s);

    expect((globalThis as Record<string, unknown>)[OUTSIDE_FILE_EXECUTED]).toBeUndefined();
    expect((globalThis as Record<string, unknown>)[OUTSIDE_DIRECTORY_EXECUTED]).toBeUndefined();
  });

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
