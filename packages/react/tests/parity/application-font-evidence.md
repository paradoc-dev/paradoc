# Application typography evidence

Measured on 2026-09-11 with the React lab's unchanged `shortInvoiceData`, Chromium preview-break rendering, 816 × 1056 CSS-pixel pages, and the parity harness's grayscale tolerance of 32/255.

| Application pairing | Pages | First keep | Preview resource (SHA-256) | Embedded PDF families | Total visual | Geometry | Paint / raster | X / Y drift |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: |
| Inter sans | 1 / 1 | `title` | Inter Variable `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` | Inter | 2.59% | 0.00% | 2.59% | 0 / 0 px |
| Source Serif headings, Inter body | 1 / 1 | `title` | Inter Variable `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62`; Source Serif 4 Variable `c1df4596be5029233ed2afbb8b2f6ea20784b3fb1aa5d6b5c6519ccd85eb3dfb` | Inter, SourceSerif4 | 2.59% | 0.00% | 2.59% | 0 / 0 px |
| Source Serif headings, Geist Mono body | 1 / 1 | `title` | Geist Mono Variable `e9fb088eeacced307860d82ceedb0ae9ad2ebfa07a7c0a7279c8c961dd9d5fd3`; Source Serif 4 Variable `c1df4596be5029233ed2afbb8b2f6ea20784b3fb1aa5d6b5c6519ccd85eb3dfb` | GeistMono, SourceSerif4 | 2.67% | 0.00% | 2.67% | 0 / 0 px |

The total visual difference is split additively. A differing pixel is geometry-affecting when ink on one side has no counterpart within one CSS pixel on the other; locally coincident differences are paint/raster residual. Horizontal and vertical band registration independently search up to 12 pixels. A 40-pixel one-sided displacement sensitivity check moved geometry difference from 0.00% to 5.10%, establishing that the geometry classifier responds to material spatial movement.

Every invoice comparison reported one preview page and one PDF page, no missing page, no saturated drift, and the same result under engine and preview-break rendering. The earlier one-off invoice percentages are superseded by these durable parity-suite measurements.
