# @paradoc/react-pdf

Explicit Node integration for rendering `@paradoc/react` compositions to PDF and checking them before rendering. The default entry installs Takumi and Paradoc's PDF font resources. Install the optional `puppeteer` and `tailwindcss` peers only when using `@paradoc/react-pdf/chromium`.

The headless `@paradoc/react` package does not install a PDF engine, browser driver, CSS compiler, or font files.

```sh
pnpm add @paradoc/react-pdf
```

| Entry | Purpose |
| --- | --- |
| `@paradoc/react-pdf` | `renderPdf`, PDF adapter types, Takumi, resources, and React layer renderers |
| `@paradoc/react-pdf/check` | `checkComposition` and `checkElement` without producing PDF bytes |
| `@paradoc/react-pdf/chromium` | The Chromium adapter; requires the optional `puppeteer` and `tailwindcss` peers |

```tsx
import { renderPdf, type PdfAdapter } from "@paradoc/react-pdf";

const result = await renderPdf(<Invoice data={data} />);

const companyEngine: PdfAdapter = {
  name: "company-engine",
  directions: ["ltr"],
  async render(input, options) {
    return renderWithCompanyEngine(input, options);
  },
};

await renderPdf(<Invoice data={data} />, { adapter: companyEngine });
```

The default resources register Inter Variable, Source Serif 4 Variable, Noto Sans Arabic Variable, and the marker face used while placing signatures. Preview CSS and PDF rendering must use the same registration. The built-in Takumi adapter is verified for left-to-right documents; use an adapter that declares `rtl` support for right-to-left output. A missing Chromium peer raises `MissingAdapterPeerError`; an installed engine that fails during rendering keeps its original initialization error.
