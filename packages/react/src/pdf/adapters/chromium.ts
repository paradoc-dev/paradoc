/**
 * The Chromium adapter: the same tree, printed by the browser that draws the
 * preview.
 *
 * takumi answers "does a second layout engine agree with the browser?". This
 * adapter answers a different question, and the one the parity suite was built
 * to ask: how close can the PDF get when the engine laying it out is the engine
 * that laid out the preview? Nothing about the composition changes to make that
 * work — the same components, the same artifact, the same plan, the same font
 * files.
 *
 * It is Node-only and it is not the default. `puppeteer` is an optional peer
 * dependency and is reached through a dynamic import, so `@paradoc/react/pdf`
 * still loads with no browser driver installed and a caller who never names
 * this adapter never pays for one.
 *
 * **The plan is applied to the document, not to a template.** The takumi path
 * walks the resolved node tree; there is no node tree here, so the same three
 * things are done to the DOM the markup produced: `break-inside: avoid` on
 * every keep, `break-before: page` on a hinted one, and a copy of the table
 * header cloned from the header already in the page and placed above the row
 * that opens the page. The break sits on the copy rather than on the row, for
 * the reason it does in `tree.ts`: a break before the row would strand the
 * header at the foot of the page it was meant to open.
 *
 * **Engine mode is Blink's own pagination.** Without a plan the adapter states
 * only that a keep is not to be split, and the browser decides where the pages
 * end. It has no obligation to land on the preview's page starts, and what it
 * does land on is measured rather than asserted.
 *
 * **One browser per process.** Launching Chrome costs more than the render, so
 * the instance is shared and killed when the process exits. `closeChromium`
 * closes it early, which is what a test suite that owns its own browsers wants.
 */

import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import type { Browser, Page } from "puppeteer";

import {
  UnsupportedPdfContentError,
  type PdfAdapter,
  type PdfAdapterOptions,
  type PdfRenderResult,
  type PreparedPdfInput,
} from "../adapter";
import { imageFormat } from "../resources";
import { KEEP_ID_ATTRIBUTE, KEEP_REPEAT_ATTRIBUTE } from "../tree";
import { chromiumStylesheet, cssPixelsToInches } from "./chromium-stylesheet";

/**
 * Where a Chrome is looked for when the workspace does not name one.
 *
 * The same list the parity suite uses. Nothing here downloads a browser: a
 * machine with none says so, and the tests that need one skip.
 */
const KNOWN_BROWSERS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

/**
 * The Chrome this adapter would drive, or `undefined` when there is none.
 *
 * Puppeteer's own bundled browser is the last resort rather than the first,
 * because the workspace names the browser it wants through the environment and
 * a render that quietly used a different build would be measuring a different
 * Blink from the one the preview was captured in.
 */
export async function chromiumExecutable(): Promise<string | undefined> {
  const named = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (named !== undefined && named.length > 0) return named;

  const known = KNOWN_BROWSERS.find((path) => existsSync(path));
  if (known !== undefined) return known;

  try {
    const { default: puppeteer } = await import("puppeteer");
    const bundled = puppeteer.executablePath();
    return bundled.length > 0 && existsSync(bundled) ? bundled : undefined;
  } catch {
    return undefined;
  }
}

let shared: Promise<Browser> | undefined;

/**
 * The process's one Chrome.
 *
 * The flags are the parity suite's: subpixel antialiasing paints a glyph in
 * colour and hinting snaps its stems to the pixel grid, and the preview is
 * captured with both off. A render made with them on would differ from the
 * preview by the browser's own settings rather than by the document.
 */
async function chromium(): Promise<Browser> {
  shared ??= (async () => {
    const executablePath = await chromiumExecutable();
    if (executablePath === undefined) {
      throw new Error(
        "The Chromium PDF adapter needs a Chrome. None of the well-known install paths " +
          "exists and puppeteer has no bundled browser; set PUPPETEER_EXECUTABLE_PATH to one."
      );
    }
    const { default: puppeteer } = await import("puppeteer");
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      protocolTimeout: 600_000,
      args: [
        "--font-render-hinting=none",
        "--disable-lcd-text",
        "--hide-scrollbars",
        // GitHub's Ubuntu runners restrict user namespaces, which the sandbox
        // needs; unsandboxed only in CI, never on a developer's machine.
        ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
      ],
    });
    // A browser outliving the process that started it would be a leaked Chrome
    // per render. `close` cannot be awaited from an exit handler, so the child
    // is signalled instead.
    process.once("exit", () => {
      browser.process()?.kill("SIGKILL");
    });
    return browser;
  })().catch((error: unknown) => {
    shared = undefined;
    throw error;
  });
  return shared;
}

/** Closes the shared browser, if one was ever started. */
export async function closeChromium(): Promise<void> {
  const running = shared;
  if (running === undefined) return;
  shared = undefined;
  await (await running).close();
}

/** The `data:` URI for one supplied image, or `undefined` when it cannot be decoded. */
function dataUri(data: Uint8Array): string | undefined {
  const format = imageFormat(data);
  if (format === undefined) return undefined;
  const mime = format === "svg" ? "image/svg+xml" : `image/${format}`;
  return `data:${mime};base64,${Buffer.from(data).toString("base64")}`;
}

/** The page, as one file a browser can open. */
function documentHtml(markup: string, css: string, lang: string, dir: string): string {
  return [
    "<!doctype html>",
    // The direction is on the root the way HTML puts it there, so it reaches
    // the page box and the body as well as the document element. The document
    // element carries its own `dir` too, which is what the preview renders; the
    // two agree because both are read from the one declaration on the root.
    `<html lang="${lang}" dir="${dir}">`,
    "<head>",
    '<meta charset="utf-8">',
    `<style>\n${css}\n</style>`,
    "</head>",
    // The sheet's own classes, minus the ones that are about being on screen:
    // the preview's shadow and its explicit width belong to a sheet sitting on
    // a backdrop, and the page box supplies both here.
    `<body><div class="paradoc-document relative">${markup}</div></body>`,
    "</html>",
  ].join("\n");
}

/** What the in-page pass could not honour. */
interface PageOutcome {
  unknownBreaks: string[];
  unknownRepeats: string[];
  missingImages: string[];
  fontsLoaded: boolean;
}

/** The plan, flattened for a function that is sent to the page as source. */
interface PagePlanInput {
  breaks: string[];
  repeats: string[][];
}

/**
 * Runs inside the page: swaps in the image bytes, applies the plan, and reports
 * what the document could not honour.
 *
 * It is one self-contained function because `page.evaluate` sends its source to
 * the browser, so it closes over nothing and every name it needs is an
 * argument.
 */
function applyInPage(
  plan: PagePlanInput | null,
  images: Record<string, string>,
  attributes: { keep: string; repeat: string },
  faces: { family: string; weight: string; style: string }[]
): PageOutcome {
  const { keep: KEEP, repeat: REPEAT } = attributes;

  const missingImages: string[] = [];
  for (const image of [...document.querySelectorAll("img")]) {
    const src = image.getAttribute("src") ?? "";
    const supplied = images[src];
    if (supplied !== undefined) {
      image.setAttribute("src", supplied);
    } else if (!src.startsWith("data:") && !missingImages.includes(src)) {
      missingImages.push(src);
    }
  }

  // The preview refuses to split a keep; the browser is told the same thing.
  const sheet = document.createElement("style");
  sheet.textContent = `[${KEEP}] { break-inside: avoid }`;
  document.head.append(sheet);

  const own = (id: string): HTMLElement | null =>
    document.querySelector<HTMLElement>(`[${KEEP}="${CSS.escape(id)}"]:not([${REPEAT}="true"])`);

  const unknownBreaks: string[] = [];
  const unknownRepeats: string[] = [];

  for (const copies of plan?.repeats ?? []) {
    for (const id of copies) {
      if (own(id) === null && !unknownRepeats.includes(id)) unknownRepeats.push(id);
    }
  }

  (plan?.breaks ?? []).forEach((id, index) => {
    const target = own(id);
    if (target === null) {
      if (!unknownBreaks.includes(id)) unknownBreaks.push(id);
      return;
    }

    // A header copy above the keep takes the break, so the copy opens the page
    // and the row it belongs to keeps only its keep-together rule. Two breaks in
    // a row would leave the copy alone on a page of its own.
    let taken = false;
    for (const copyId of plan?.repeats[index + 1] ?? []) {
      const source = own(copyId);
      if (source === null) continue;
      const copy = source.cloneNode(true) as HTMLElement;
      copy.setAttribute(REPEAT, "true");
      copy.style.breakInside = "avoid";
      // Built, never inherited: a header that is itself a planned break carries
      // `break-before` in its own place in the flow, and a copy that kept it
      // would break the page it was meant to open. Only the first copy opens
      // the page; a second break would leave the first alone on a page.
      copy.style.breakBefore = taken ? "auto" : "page";
      target.parentNode?.insertBefore(copy, target);
      taken = true;
    }

    if (!taken) target.style.breakBefore = "page";
  });

  const configured = new Set(faces.map((face) => face.family));
  const fontsLoaded = [...document.querySelectorAll<HTMLElement>(".paradoc-document, .paradoc-document *")]
    .filter((element) => (element.textContent?.length ?? 0) > 0)
    .every((element) => {
      const style = getComputedStyle(element);
      const families = style.fontFamily.split(",").map((family) => family.trim().replaceAll('"', "").replaceAll("'", ""));
      const selected = families.find((family) => configured.has(family));
      if (selected === undefined) return true;
      return [...document.fonts].some((face) =>
        face.family.replaceAll('"', "") === selected && face.status === "loaded" &&
        face.style === style.fontStyle && (() => {
          if (face.weight === style.fontWeight) return true;
          const range = face.weight.split(/\s+/u).map(Number);
          const requested = Number(style.fontWeight);
          return range.length === 2 && Number.isFinite(requested) && requested >= range[0]! && requested <= range[1]!;
        })()
      );
    });

  return { unknownBreaks, unknownRepeats, missingImages, fontsLoaded };
}

/** Waits for every face and every image the page will print with. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map(async (image) => {
        if (image.complete) return;
        await new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      })
    );
  });
}

/** The browser that draws the preview, printing the same document. */
export const chromiumAdapter: PdfAdapter = {
  name: "chromium",

  // Both directions. It is Blink, which is the engine that draws the preview,
  // so a document laid out right to left on screen is laid out right to left
  // here by the same code. The parity suite measures that claim rather than
  // taking it: see "Right to left" in the README.
  directions: ["ltr", "rtl"],

  async render(input: PreparedPdfInput, options: PdfAdapterOptions): Promise<PdfRenderResult> {
    const images: Record<string, string> = {};
    const undecodable: string[] = [];
    for (const image of input.images) {
      const uri = dataUri(image.data);
      if (uri === undefined) undecodable.push(image.src);
      else images[image.src] = uri;
    }
    if (undecodable.length > 0) throw new UnsupportedPdfContentError([], undecodable);

    const markup = renderToStaticMarkup(input.element);
    const css = await chromiumStylesheet(markup, input.fonts, input.geometry, input.applicationCss);
    const html = documentHtml(markup, css, options.lang, options.dir);

    // The page is written outside the repository, because it is a render's
    // scratch file and not an artefact of it.
    const directory = await mkdtemp(join(tmpdir(), "paradoc-paper-chromium-"));
    const file = join(directory, "document.html");
    const browser = await chromium();
    const page = await browser.newPage();

    try {
      await writeFile(file, html, "utf8");
      await page.goto(pathToFileURL(file).href, { waitUntil: "load" });

      await settle(page);
      const outcome = await page.evaluate(
        applyInPage,
        input.plan === undefined
          ? null
          : {
              breaks: [...input.plan.breaks],
              repeats: input.plan.repeats.map((copies) => [...copies]),
            },
        images,
        { keep: KEEP_ID_ATTRIBUTE, repeat: KEEP_REPEAT_ATTRIBUTE },
        input.fonts.map((font) => ({ family: font.family, weight: font.weight, style: font.style ?? "normal" }))
      );

      if (outcome.missingImages.length > 0) {
        throw new UnsupportedPdfContentError([], outcome.missingImages);
      }

      if (!outcome.fontsLoaded) {
        throw new Error(
          `The Chromium adapter could not load every configured document face (${[...new Set(input.fonts.map((font) => `"${font.family}"`))].join(", ")}). ` +
            "A page printed against a fallback is not the page the preview drew."
        );
      }

      const bytes = await page.pdf({
        width: cssPixelsToInches(input.geometry.widthPx),
        height: cssPixelsToInches(input.geometry.heightPx),
        // The margin is the page box's, stated in the stylesheet, so every page
        // carries it. A margin given here would be a second opinion about it.
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        printBackground: true,
        preferCSSPageSize: false,
      });

      return {
        bytes: new Uint8Array(bytes),
        unknownBreaks: outcome.unknownBreaks,
        unknownRepeats: outcome.unknownRepeats,
      };
    } finally {
      await page.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
};
