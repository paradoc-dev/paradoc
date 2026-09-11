# Application typography evidence

Measured on 2026-09-11 with the React lab's unchanged `shortInvoiceData`, Chromium preview-break rendering, 816 × 1056 CSS-pixel pages, and the parity harness's grayscale tolerance of 32/255.

| Application pairing | Pages | First keep | Preview resource (SHA-256) | Embedded PDF families | Differing / aligned | Drift |
| --- | ---: | --- | --- | --- | ---: | ---: |
| Inter sans | 1 / 1 | `masthead` | Inter Variable `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` | Inter | 1.45% / 1.45% | 0 px |
| Source Serif headings, Inter body | 1 / 1 | `masthead` | Inter Variable `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`; Source Serif 4 Variable `c1df4596be5029233ed2afbb8b2f6ea20784b3fb1aa5d6b5c6519ccd85eb3dfb` | Inter, SourceSerif4 | 1.44% / 1.44% | 0 px |
| Source Serif headings, Geist Mono body | 1 / 1 | `masthead` | Geist Mono Variable `e9fb088eeacced307860d82ceedb0ae9ad2ebfa07a7c0a7279c8c961dd9d5fd3`; Source Serif 4 Variable `c1df4596be5029233ed2afbb8b2f6ea20784b3fb1aa5d6b5c6519ccd85eb3dfb` | GeistMono, SourceSerif4 | 1.89% / 1.89% | 0 px |

Every comparison reported one preview page and one PDF page, no missing page, and no saturated drift. Reviewer screenshots are attached to the Atlas shipment; the source PDFs and matching raster pages remain machine-local run evidence.
