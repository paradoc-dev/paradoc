/**
 * The assets the examples ship, loaded the way a consumer loads them.
 *
 * A sample document's bytes are not source in the sense the rest of the package
 * is: the PNG and the annex PDF are files that must survive into the published
 * tarball and be reachable from the built bundle, which lives one directory
 * deeper than the source that names them. Resolving either relative to the
 * module that reads it works in `src/` and fails in `dist/`, silently until a
 * consumer calls it. So these run Node against the built entry rather than
 * against the source, because that is the resolution a consumer gets.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));

/** Runs one expression in Node from the package root and returns its output. */
async function inNode(expression: string): Promise<string> {
  const { stdout } = await run(process.execPath, ["--input-type=module", "-e", expression], {
    cwd: packageRoot,
  });
  return stdout.trim();
}

describe("the examples' shipped assets", () => {
  it("are declared in `files` and named by the export map", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8")
    ) as { files: string[]; exports: Record<string, unknown> };

    for (const asset of [
      "src/examples/proposal-logo.png",
      "src/examples/certificate-of-insurance.pdf",
    ]) {
      expect(manifest.files, `${asset} must ship`).toContain(asset);
    }
    expect(manifest.exports["./examples/certificate-of-insurance.pdf"]).toBe(
      "./src/examples/certificate-of-insurance.pdf"
    );
    expect(manifest.exports["./examples/proposal-logo.png"]).toBe(
      "./src/examples/proposal-logo.png"
    );
  });

  it("loads the annex from the built package", async () => {
    const checkedIn = new Uint8Array(
      await readFile(new URL("../src/examples/certificate-of-insurance.pdf", import.meta.url))
    );

    const output = await inNode(
      "const m = await import('./dist/examples/pdf.js');" +
        "const bytes = await m.insuranceCertificateFixture();" +
        "process.stdout.write(`${bytes.length} ${new TextDecoder().decode(bytes.slice(0, 5))}`);"
    );
    const [length, header] = output.split(" ");

    expect(header).toBe("%PDF-");
    expect(Number(length)).toBe(checkedIn.length);
  }, 120_000);

  it("loads the proposal's mark from the built package", async () => {
    const output = await inNode(
      "const m = await import('./dist/examples/pdf.js');" +
        "const image = await m.proposalLogoImage();" +
        "process.stdout.write(`${image.src} ${image.data.length}`);"
    );
    const [src, length] = output.split(" ");

    expect(src).toBeTruthy();
    expect(Number(length)).toBeGreaterThan(0);
  }, 120_000);
});
