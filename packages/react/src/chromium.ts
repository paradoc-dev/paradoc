/**
 * `@paradoc/react/chromium` — the experimental Chromium adapter.
 *
 * It prints the same tree through the browser that draws the preview, which is
 * why it reaches visual parity the WebAssembly engine cannot. It is not the
 * default and it is not a supported production path: it needs a Chrome on the
 * machine, `puppeteer` to drive it and `tailwindcss` to compile the page's
 * styles, and all three are optional peers.
 *
 * It is a subpath of its own so that `@paradoc/react/pdf` loads with none of
 * them installed. `renderPdf({ adapter: "chromium" })` reaches the same adapter
 * through a dynamic import; importing this module is the way to hold it
 * directly, for a caller that registers adapters itself or closes the browser
 * on its own schedule.
 */

export {
  chromiumAdapter,
  chromiumExecutable,
  closeChromium,
} from "./pdf/adapters/chromium";
