/**
 * The browser's stylesheet, restated for the engine.
 *
 * The preview is a Tailwind page, so its preflight has already zeroed the user
 * agent's margins before a single component renders. The engine has no
 * preflight and applies its own user-agent defaults, so the identical tree lays
 * out taller there: a `text-xs` `<h2>` measures 36 pixels in the engine against
 * 16 in the browser, and five section headings are a hundred pixels of drift.
 * That is not a property of the engine's layout, it is a missing reset.
 *
 * This is the layout-affecting part of Tailwind v4's preflight, restricted to
 * the elements the components actually render. Anything cosmetic is left out:
 * the components state their own colour and type, and a reset that reached
 * further would be a second description of the document.
 */

/** Preflight-equivalent rules, passed to the engine on every render. */
export const PDF_RESET_STYLESHEET = `
*, ::before, ::after {
  box-sizing: border-box;
  border-width: 0;
  border-style: solid;
}

article, section, div, p, h1, h2, h3, h4, h5, h6 {
  margin: 0;
  padding: 0;
}

h1, h2, h3, h4, h5, h6 {
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
}

img, svg {
  display: block;
}
`;
