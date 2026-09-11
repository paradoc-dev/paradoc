# @paradoc/react-pdf

Explicit Node integration for rendering `@paradoc/react` compositions to PDF and checking them before rendering. The default entry installs Takumi. Install the optional `puppeteer` and `tailwindcss` peers only when using `@paradoc/react-pdf/chromium`.

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

Document components inherit typography from the consumer application. A paginated browser preview records the application CSS and exact font-resource identities in its page plan; Chromium rendering consumes that same snapshot. Headless callers may instead provide shared explicit font resources. The constrained Takumi adapter refuses application CSS rather than silently substituting it. A missing Chromium peer raises `MissingAdapterPeerError`; an installed engine that fails during rendering keeps its original initialization error.
