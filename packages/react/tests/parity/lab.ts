/**
 * The two long-lived resources the parity suite needs: the lab's dev server and
 * a Chrome.
 *
 * The preview is a browser artefact. There is no way to measure what a page of
 * it looks like without rendering it in a browser at the paper's own scale, so
 * the suite starts the lab exactly as a developer starts it — the same Vite
 * config, the same Tailwind, the same font files — and drives it.
 *
 * Chrome is the machine's own. Puppeteer is already the workspace's browser
 * driver (`@paradoc/documents-service` renders with it), and the workspace
 * already passes it a browser through `PUPPETEER_EXECUTABLE_PATH`, so nothing
 * here downloads one. When neither that variable nor a well-known install path
 * points at a browser, the suite says so rather than failing obscurely.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser } from "puppeteer";

/** Where the lab is started. Fixed, so a stray server from a previous run is obvious. */
export const PARITY_LAB_PORT = 5182;

/** The workspace package this suite drives. */
const LAB_PACKAGE = "@paradoc/react-lab";

/** Where that package sits, relative to the workspace root. */
const LAB_DIRECTORY = "incubator/apps/react-lab";

/**
 * The workspace root the lab is a package of.
 *
 * The outermost `pnpm-workspace.yaml` inside this Git work tree, not the
 * nearest one: `paradoc/` is itself a workspace root, the one projected to the
 * public repository, and the lab is a sibling of that projection rather than a
 * member of it. Stopping at the nearest marker would look for the lab in a
 * workspace that does not contain it.
 *
 * The walk stops at the work tree so it cannot wander into whatever happens to
 * sit above the checkout on the machine, and it checks that the root it found
 * actually holds the lab, because the failure otherwise arrives much later as a
 * dev server that never answers.
 */
export function workspaceRoot(): string {
  const start = dirname(fileURLToPath(import.meta.url));
  let directory = start;
  let outermost: string | undefined;
  for (;;) {
    if (existsSync(join(directory, "pnpm-workspace.yaml"))) outermost = directory;
    // The work tree bounds the walk: `.git` is a directory in a checkout and a
    // file in a linked worktree, so its presence is the test rather than its kind.
    if (existsSync(join(directory, ".git"))) break;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  if (outermost === undefined) {
    throw new Error(`No pnpm-workspace.yaml between ${start} and the Git work tree above it.`);
  }
  if (!existsSync(join(outermost, LAB_DIRECTORY))) {
    throw new Error(
      `The parity suite drives ${LAB_PACKAGE}, and the workspace at ${outermost} does not ` +
        `contain it at ${LAB_DIRECTORY}. The lab lives in the private monorepo beside the ` +
        "public projection, so this suite cannot run from the projected repository alone."
    );
  }
  return outermost;
}

/** A Chrome to drive: the one the workspace names, or one the machine already has. */
function browserExecutable(): string {
  const named = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (named !== undefined && named.length > 0) return named;

  const known = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = known.find((path) => existsSync(path));
  if (found !== undefined) return found;

  throw new Error(
    "The parity suite needs a Chrome. None of the well-known install paths exists; " +
      "set PUPPETEER_EXECUTABLE_PATH to one."
  );
}

/**
 * A Chrome whose text rasterization does not depend on the machine's display.
 *
 * Subpixel antialiasing paints a glyph in colour, and hinting snaps its stems to
 * the pixel grid by a rule the PDF rasterizer does not share. Both would show up
 * as a difference the document does not have, so both are off and the comparison
 * sees grayscale-antialiased outlines on either side.
 */
export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: browserExecutable(),
    headless: true,
    protocolTimeout: 600_000,
    args: ["--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars"],
  });
}

/** A running lab, and the way to stop it. */
export interface Lab {
  url: string;
  stop: () => Promise<void>;
}

/** True once the dev server answers on `url`. */
async function answering(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Starts the lab on a fixed port and resolves once it answers.
 *
 * `--strictPort` rather than Vite's usual hunt for a free one: a suite that
 * quietly measured against a server it did not start would report whatever that
 * server happened to be serving.
 */
export async function startLab(port: number = PARITY_LAB_PORT): Promise<Lab> {
  const url = `http://127.0.0.1:${port}`;
  if (await answering(url)) {
    throw new Error(`Something is already listening on ${url}. Stop it and run the suite again.`);
  }

  const child: ChildProcess = spawn(
    "pnpm",
    [
      "--filter",
      LAB_PACKAGE,
      "exec",
      "vite",
      "--port",
      String(port),
      "--strictPort",
      "--host",
      "127.0.0.1",
    ],
    // Inherited output, so a dev server that will not start says why in the
    // test run rather than in a buffer nobody reads.
    { cwd: workspaceRoot(), detached: true, stdio: ["ignore", "inherit", "inherit"] }
  );

  /** True once the process is gone, without needing an event listener. */
  const exited = () => child.exitCode !== null || child.signalCode !== null;

  const stop = async () => {
    if (exited() || child.pid === undefined) return;

    // The dev server is a child of pnpm, so signalling the process alone leaves
    // Vite holding the port. `detached` put both in one group; kill the group.
    const signal = (name: "SIGTERM" | "SIGKILL") => {
      try {
        process.kill(-child.pid!, name);
      } catch {
        child.kill(name);
      }
    };
    const settle = async (attempts: number) => {
      for (let attempt = 0; attempt < attempts && !exited(); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };

    signal("SIGTERM");
    await settle(50);
    // A dev server that ignored the polite signal still holds port 5182, and
    // the next run of this suite refuses to start against a server it did not
    // start. Leaving one behind would fail that run for a reason belonging to
    // this one, so the wait is followed through rather than given up on.
    if (!exited()) {
      signal("SIGKILL");
      await settle(50);
    }
  };

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (exited()) throw new Error("The lab exited before it answered. Its output is above.");
    if (await answering(url)) return { url, stop };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await stop();
  throw new Error(`The lab did not answer on ${url} within 90 seconds. Its output is above.`);
}
