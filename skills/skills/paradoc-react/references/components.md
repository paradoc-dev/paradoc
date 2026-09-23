---
name: components
description: Props, defaults and errors for every registry component. Bundle, Document, Section, Text, List, Field, Table, Totals, Party, Signature, Image, QRCode, Part, PdfPages, Pages, Paper, the furniture slots, PageNumber, KeepTogether and PageBreak.
metadata:
  tags: components, props, react, registry, composition
---

# Components

**Contents:** [Imports](#imports) · [Keeps and containers](#keeps-and-containers) ·
[Document tree](#document-tree) (`Bundle`, `Document`, `Section`, `Text`,
`List`, `Field`, `Table`, `Totals`, `Party`, `Signature`, `Image`, `QRCode`) ·
[Packet parts](#packet-parts) (`Part`, `PdfPages`) ·
[Preview and furniture](#preview-and-furniture) (`Pages`, `Paper`,
[Furniture slots](#furniture-slots), `PageNumber`) ·
[Pagination primitives](#pagination-primitives) (`KeepTogether`, `PageBreak`) ·
[Other exports](#other-exports)

## Imports

<!-- dep:R4 -->
| What | Import from |
|---|---|
| Components | `@/components/paradoc/<name>` after `paradoc add <name>` ([cli.md § paradoc add](./cli.md#paradoc-add)). |
| Types, hooks, headless helpers | `@paradoc/react` |
| `renderPdf`, `isSupportedClass`, layer renderers | `@paradoc/react-pdf` |
| `checkComposition`, `checkElement` | `@paradoc/react-pdf/check` |
| The stylesheet | the installed `styles/paradoc.css`, imported once from the app's global CSS. Composition modules import no CSS, because Node loads them directly for `paradoc check`, layer renders and seals. |

A `className` prop **replaces** the component's default classes, including the
text sizes the `typography` token steps. Each section lists the default.

## Keeps and containers

A **keep** is one pagination unit. A container holds keeps and withdraws from a
page that holds none of them. For how keeps are placed on pages, see
[pagination.md](./pagination.md).

| Component | Role | Keep id |
|---|---|---|
| `Bundle`, `Document` | document root, container | none |
| `Section` | container; its title is a keep-with-next keep | `heading:<id>` |
| `Text` | keep | `keepId` |
| `List` | container; each item is a keep | `<id>:<index>`, nested `<id>:<index>:<index>` |
| `Field` | keep; a container with `paragraphs` | `field:<path>`, or `field:<path>:<index>` per paragraph |
| `Table` | container; header, each row and footer are keeps | `<id>:header`, `<id>:<row>`, `<id>:footer` |
| `Totals` | keep | `id`, default `totals` |
| `Party` | keep | `party:<role>`, `party:<role>:<index>` after the first |
| `Signature` | keep | `<type>:<role>`, `<type>:<role>:<index>` after the first |
| `Image`, `KeepTogether` | keep | `keepId` |
| `PageBreak` | zero-height keep that opens a page | `keepId` |
| `QRCode` | neither; wrap it in a keep | none |
| `Part`, `PdfPages` | packet frames, not in the plan | none |
| `Pages`, `Paper`, `PageNumber` | preview and furniture, outside the flow | none |

## Document tree

### `Bundle`

The root for several documents. Use it when one `Pages`, `Paper` or
`renderPdf` call holds more than one `Document`, and for packets. A single
`Document` can be the root on its own and carries every token.

| Prop | Type | Notes |
|---|---|---|
| `id` | `string?` | Default `"bundle"`. |
| `tokens` | `DocumentTokensInput?` | Branding for every document inside. See [safe-classes.md](./safe-classes.md#branding-tokens). |
| `className` | `string?` | Default `flex flex-col gap-12`, stepped by `typography.flow`. |
| `children` | `ReactNode` | The documents. |

### `Document`

Binds one form artifact and its data to everything below it, and evaluates the
artifact's `defs`. Every component below names a path, a def or a party role.

| Prop | Type | Notes |
|---|---|---|
| `artifact` | `Form` | The parsed form artifact. |
| `data` | `DocumentData` | `{ fields: Record<string, unknown>; parties: Record<string, Party \| Party[]>; annexes?: Record<string, Attachment> }`. `parties` is required; pass `{}` for none. |
| `format` | `FormatOptions?` | `{ formatter?, blank?, partial?, progressive? }`. See below. |
| `tokens` | `DocumentTokensInput?` | Branding. Inside a `Bundle`, only `accentColor` and `logo`. |
| `id` | `string?` | Default `artifact.name`. |
| `className` | `string?` | Default `flex flex-col gap-6 text-sm leading-relaxed text-neutral-900`, stepped by `typography`. |
| `children` | `ReactNode` | The content. |

`FormatOptions`:

| Field | Type | Notes |
|---|---|---|
| `formatter` | `Formatter?` | From `createFormatter(options)` in `@paradoc/format`: `locale`, `timeZone`, and per-kind options. Default `defaultFormatter` (`en-US`, UTC). |
| `blank` | `string?` | What an empty value prints. Default `"—"`. |
| `partial` | `boolean?` | Partial mode, for a draft that is still being filled. Default `false`. |
| `progressive` | `{ missing?, incomplete? }?` | Placeholders in partial mode, for an absent value and for a composite with members missing. Both default to `blank`. |

```tsx
import { createFormatter } from "@paradoc/format";

const german = createFormatter({ locale: "de-DE", timeZone: "Europe/Berlin" });

<Document artifact={invoiceForm} data={data} format={{ formatter: german }}>…</Document>;
```

For what partial mode prints and the other ways to turn it on, see
[render-and-seal.md § Drafts](./render-and-seal.md#drafts).

### `Section`

A titled container, not a keep, so a long section breaks between its keeps
([pagination.md § The planner rules](./pagination.md#the-planner-rules), rule 6).

| Prop | Type | Notes |
|---|---|---|
| `id` | `string` | Stable section id. |
| `title` | `string?` | Renders as keep `heading:<id>` with `data-keep-with-next`, so it moves with the keep after it (planner rule 2). Coloured by `accentColor`. |
| `className` | `string?` | Default `flex flex-col gap-2`. |
| `children` | `ReactNode` | |

### `Text`

Static prose in a role. The size and leading come from the `typography` token.
For a value from the artifact, use `Field`.

| Prop | Type | Notes |
|---|---|---|
| `keepId` | `string` | Required and unique in the document. |
| `role` | `"heading" \| "body" \| "caption" \| "small"?` | Default `"body"`. |
| `as` | `ElementType?` | Default `h2` for `heading`, `p` otherwise. |
| `className` | `string?` | Replaces the role's classes. |
| `children` | `ReactNode?` | The prose. |

```tsx
<Text keepId="scope:intro">The provider will survey the site and commission the equipment.</Text>
```

For a heading that must stay with its content, see
[pagination.md § Writing for the planner](./pagination.md#writing-for-the-planner).

### `List`

Numbered or bulleted items. The markers are text, because the engine draws no
list markers.

| Prop | Type | Notes |
|---|---|---|
| `id` | `string` | Required keep-id prefix, unique in the document. |
| `items` | `ListItem[]` | `{ text: ReactNode; items?: ListItem[] }`. Nested markers carry the parent's, such as `2.b.`. |
| `marker` | `"decimal" \| "lower-alpha" \| "roman" \| "bullet"?` | Top level. Default `"decimal"`. |
| `nestedMarker` | same | Every nested level. Default `"lower-alpha"`. |
| `className` | `string?` | Top level only. Default `flex flex-col gap-3`, stepped by `typography.flow`. |

```tsx
<List
  id="clauses"
  items={[
    { text: "The provider performs the services." },
    { text: "The customer provides:", items: [{ text: "Site access." }] },
  ]}
/>
```

An item's `text` is content inside a keep: strings or inline markup only.

### `Field`

One labelled value at a path, formatted through the artifact's serializers.

| Prop | Type | Notes |
|---|---|---|
| `path` | `string` | Dotted path, such as `customerAddress` or `lineItems.0.unitPrice`. An annex is `annexes.<slot>`. |
| `label` | `string \| false?` | Replaces the artifact's label. `false` prints no label. |
| `as` | `"text" \| "image"?` | Default `"text"`. `"image"` draws an annex attachment. |
| `width` | `number?` | CSS pixels. Required with `as="image"`. |
| `height` | `number?` | CSS pixels. Required with `as="image"`. |
| `src` | `string?` | Where a browser preview loads an `as="image"` picture. Default: the attachment's file name. |
| `paragraphs` | `boolean?` | One keep per paragraph (see [pagination.md](./pagination.md#newlines-paragraphs-and-oversize-keeps)). Default `false`. |
| `rule` | `boolean?` | Prints a fill line where the value is blank, for a form printed before it is filled. Default `false`. |
| `className` | `string?` | Default `flex flex-col gap-0.5`. |

```tsx
<Field path="scopeOfServices" paragraphs />
<Field path="annexes.sitePhoto" as="image" width={160} height={160} />
```

Errors, all thrown in a finished render:

| Error | Cause |
|---|---|
| `UnknownFieldPathError` | The artifact declares no field at `path`. |
| `InvalidFieldPathError` | The path is malformed. |
| `CompositeFieldPathError` | The path is a `fieldset` or `list`. Use `Table` for a list, or name a member path. |
| `UnknownAnnexError` | The artifact declares no annex slot at `annexes.<slot>`. |
| `MissingImageSizeError` | `as="image"` without `width` or `height`. |

With `as="image"`, an attachment whose MIME type is not `image/*` prints its
file name, and `paradoc check` reports it as `image:<path>`.

### `Table`

A list field as flex rows. The header, each row and the footer are keeps,
planned by rules 2 to 4 in
[pagination.md § The planner rules](./pagination.md#the-planner-rules).

| Prop | Type | Notes |
|---|---|---|
| `path` | `string` | Path of the list field. |
| `columns` | `TableColumn[]` | See below. |
| `id` | `string?` | Keep-id prefix. Default `path`. |
| `continuedLabel` | `string?` | Shown on a repeated header only, on one line. |
| `footer` | `{ def: string; label?: string; emphasis?: boolean }[]?` | Rows from the artifact's `defs`, as keep `<id>:footer`. `emphasis` draws a rule coloured by `accentColor`. |
| `className` | `string?` | Default `flex flex-col`. |

`TableColumn`:

| Prop | Type | Notes |
|---|---|---|
| `field` | `string` | Field name inside the list item, not the full path. |
| `header` | `string?` | Default: the item field's label. |
| `width` | `string?` | A verified `basis-*` class. Default `"basis-1/4"`. |
| `align` | `"left" \| "right"?` | Default `"left"`. |
| `render` | `(text: string, row: unknown) => ReactNode` | Replaces the cell text with markup built from the formatted text and the row. |

```tsx
<Table
  path="lineItems"
  id="line-items"
  continuedLabel="(continued)"
  footer={[{ def: "subtotal" }, { def: "total", emphasis: true }]}
  columns={[
    { field: "description", width: "basis-1/2" },
    { field: "quantity", header: "Qty", width: "basis-1/12", align: "right" },
    { field: "amount", width: "basis-1/6", align: "right", render: (text) => <strong>{text}</strong> },
  ]}
/>
```

A value at `path` that is not an array throws `InvalidListValueError`. A footer
`def` the artifact does not declare throws `UnknownDefinitionError`.

### `Totals`

Prints computed `defs`. It does no arithmetic.

| Prop | Type | Notes |
|---|---|---|
| `rows` | `TotalRow[]` | `{ def: string; label?: string; ratePath?: string; emphasis?: boolean }`. `ratePath` prints a field beside the label, such as the tax rate. `emphasis` draws a rule coloured by `accentColor`. |
| `id` | `string?` | Keep id. Default `"totals"`. |
| `className` | `string?` | Default `flex w-1/2 flex-col gap-1 self-end`. |

```tsx
<Totals rows={[{ def: "subtotal" }, { def: "tax", ratePath: "taxRatePercent" }, { def: "total", emphasis: true }]} />
```

An undeclared `def` throws `UnknownDefinitionError`.

### `Party`

One party of a declared role, as a block or one inline run. The name comes
from the party record. The organization, address and contact lines come from
fields the artifact declares beside the role, named by path. A line with no
path or a blank value is left out.

| Prop | Type | Notes |
|---|---|---|
| `role` | `string` | A party role the artifact declares. |
| `index` | `number?` | 0-based. Default `0`. |
| `organization` | `string?` | Path of the organization field. |
| `address` | `string?` | Path of the address field. For a list, the item path, such as `tenants.1.address`. |
| `contact` | `string \| string[]?` | Path of a contact field, or several printed on one line. |
| `variant` | `"block" \| "inline"?` | Default `"block"`. |
| `label` | `string \| false?` | Replaces the role label. `false` prints none. |
| `keepId` | `string?` | Default `party:<role>`, or `party:<role>:<index>` after the first. |
| `className` | `string?` | Default `flex flex-col gap-0.5` (block). |

```tsx
<Party role="customer" address="customerAddress" contact={["customerPhone", "customerEmail"]} />
```

| Error | Cause |
|---|---|
| `UnknownPartyRoleError` | The artifact declares no such role. |
| `PartyIndexOutOfRangeError` | A finished render and no party at `index`. In partial mode the name prints the placeholder instead. |
| `UnknownFieldPathError` | A line path the artifact does not declare. |

### `Signature`

One party's signing block for one mark type. It draws the invisible marker the
seal finds, the signing rule, the field label, and a "Date" column. The label
reads "(required)" when the role's `signature.required` is `true`.

| Prop | Type | Notes |
|---|---|---|
| `party` | `string` | A party role the artifact declares. |
| `index` | `number?` | 0-based. Default `0`. |
| `type` | `"signature" \| "initials"?` | Default `"signature"`. |
| `id` | `string?` | Keep id. Default `<type>:<party>`, or `<type>:<party>:<index>` after the first. |
| `className` | `string?` | Default `flex flex-col gap-1`. |

```tsx
<Signature party="tenant" />
<Signature party="tenant" type="initials" />
```

Each flow slot on the layer matches one block by party, index and type. To
declare slots and read the seal errors, see
[render-and-seal.md § Slot limits](./render-and-seal.md#slot-limits).

### `Image`

One picture at a declared size. Neither output measures an image, so the size
is required.

| Prop | Type | Notes |
|---|---|---|
| `bytes` | `Uint8Array?` | Embedded as a `data:` URI (PNG, JPEG, GIF, WebP, SVG). Wins over `src`. |
| `src` | `string?` | A URL for the preview, and the key `renderPdf({ images })` supplies bytes under. |
| `width` | `number` | CSS pixels. |
| `height` | `number` | CSS pixels. |
| `alt` | `string?` | Default `""`, for a decorative mark. |
| `keepId` | `string` | Required and unique. |
| `className` | `string?` | No default. |

```tsx
<Image bytes={logoBytes} width={40} height={40} keepId="masthead:logo" />
```

Bytes no engine decodes throw `UndecodableImageError`. Neither `bytes` nor
`src` throws `MissingImageSourceError`. For a `src` alone, supply its bytes
with `renderPdf({ images })`: `paradoc check` reports it in `missingImages`,
and `renderPdf` refuses it without them.

### `QRCode`

Draws a URL as an inline SVG, which the PDF keeps as vectors. It reads nothing
from the artifact and is not a keep. Wrap it in a `KeepTogether` with the
content beside it.

| Prop | Type | Notes |
|---|---|---|
| `url` | `string` | The URL to encode. An empty string throws `EmptyQRCodeUrlError`. |
| `size` | `number?` | Pixels. Default `128`. |
| `color` | `string?` | Default `"#000000"`. |
| `backgroundColor` | `string?` | Default `"#ffffff"`. |
| `label` | `string?` | Accessible name. Default `QR code for <url>`. |
| `className` | `string?` | No default. |

```tsx
<KeepTogether keepId="verify" className="flex flex-col items-end gap-1">
  <QRCode url={`https://example.com/verify/${invoiceNumber}`} size={96} />
  <span className="text-xs text-neutral-500">Scan to verify</span>
</KeepTogether>
```

## Packet parts

A packet shows several documents in one scroll: a live composition, a filled
PDF form, an annex. Each document is a `Part` inside a `Bundle`. To seal a
packet, see [render-and-seal.md § Seal a packet](./render-and-seal.md#seal-a-packet).

### `Part`

| Prop | Type | Notes |
|---|---|---|
| `id` | `string` | The bundle content key. |
| `kind` | `"composition" \| "form" \| "annex"` | What the part holds. |
| `label` | `ReactNode?` | Header text. No header when omitted. |
| `firstPage` | `number?` | 1-based packet page of the first page, from `sealBundle`. |
| `pageCount` | `number?` | Pages in this part, from `sealBundle`. |
| `attached` | `boolean?` | Carried beside the packet, not counted in its pages. |
| `placedFor` | `string?` | The `packetHash` the placement was computed for. |
| `packetHash` | `string?` | The `packetHash` on screen now. Page numbers show only while it equals `placedFor`. |
| `className` | `string?` | Default `flex flex-col gap-2`. |
| `children` | `ReactNode` | A composition, `PdfPages`, or an `Attachment`. |

The header reads "Packet page 2", "Packet pages 2 to 4", "Attached, not
paginated", or "Pages pending" when the hashes differ. `resolvePartPlacement`
in `@paradoc/react` computes the same states.

```tsx
<Bundle id="packet">
  <Part id="order" kind="composition" label="Purchase order" firstPage={1} pageCount={3}
    placedFor={sealedHash} packetHash={packetHash}>
    <Document artifact={orderForm} data={orderData}>…</Document>
  </Part>
  <Part id="coi" kind="annex" label="Certificate of insurance">
    <PdfPages bytes={coiBytes} filename="certificate-of-insurance.pdf" />
  </Part>
</Bundle>
```

### `PdfPages`

Paints a PDF part in the browser with pdf.js, at the PDF's own paper size. It
is a preview surface: the sealed packet merges the original PDF bytes.

Install the optional peer `pdfjs-dist` and pass `workerSrc`. Without
`pdfjs-dist`, the part renders as an `Attachment` card that says no PDF viewer
is installed (the cause is `MissingPdfPainterError`). An unreadable PDF or a
paint that times out falls back to the card the same way.

| Prop | Type | Notes |
|---|---|---|
| `bytes` | `Uint8Array` | The PDF. Hold the reference stable (state or memo); a new reference repaints. |
| `filename` | `string` | Shown on the fallback card. |
| `mimeType` | `string?` | Default `"application/pdf"`. |
| `workerSrc` | `string?` | The pdf.js worker URL. |
| `standardFontDataUrl` | `string?` | Where pdf.js loads the standard fonts. |
| `cMapUrl` | `string?` | Where pdf.js loads CMaps. |
| `scale` | `number?` | CSS pixels per PDF point. Default `96 / 72`. |
| `timeoutMs` | `number?` | Default `20000`. |
| `onPaint` | `(report: PdfPaintReport) => void?` | Called once the paint settles. |
| `className` | `string?` | Default `w-full overflow-hidden bg-neutral-200 p-6`. |

## Preview and furniture

### `Pages`

The paginated preview. It measures the document, plans the pages (see
[pagination.md](./pagination.md)), and renders one sheet per page. It takes no
paper props: the paper comes from the root's tokens.

| Prop | Type | Notes |
|---|---|---|
| `children` | `ReactNode` | Exactly one document root. Two roots throw `MultipleDocumentRootsError`; wrap them in a `Bundle`. |
| `onPaginate` | `(plan: PagePlan) => void?` | Called when the plan changes. An inline function is safe. |
| `furniture` | `PageFurniture?` | See [Furniture slots](#furniture-slots). |
| `className` | `string?` | The outer frame. Default `w-full overflow-hidden bg-neutral-200 p-6`. |

```tsx
const [plan, setPlan] = useState<PagePlan | null>(null);

<Pages onPaginate={setPlan} furniture={furniture}>
  <InvoiceLetter data={data} />
</Pages>;
```

To render a PDF that breaks where the preview does, see
[render-and-seal.md § Match the preview](./render-and-seal.md#match-the-preview).

### `Paper`

One continuous, unpaginated sheet at paper width, for a proof view.

| Prop | Type | Notes |
|---|---|---|
| `children` | `ReactNode` | One document root. |
| `furniture` | `PageFurniture?` | The same slots; one sheet is page 1 of 1. |
| `className` | `string?` | Default `w-full overflow-hidden bg-neutral-200 p-6`. |

### Furniture slots

`PageFurniture` is `{ header?, footer?, stamp? }`, each a React node. The
preview draws them on every sheet, and the PDF engine repeats them on every
page. Declare the object once and pass it to both.

```tsx
const furniture: PageFurniture = {
  header: <span className="text-xs text-neutral-500">Northwind Partners LLP</span>,
  footer: <PageNumber />,
  stamp: <span className="-rotate-45 text-9xl font-bold text-neutral-200">DRAFT</span>,
};
```

- The header and the footer sit **inside the margin**, so the plan and the
  page count ignore them. A band gets `marginPx - 20` pixels: 28 px at the
  default 48 px margin. A taller band throws `PageFurnitureOverflowError` in the
  preview and in the render. Widen `marginPx` for a taller band.
- The `stamp` is centred on the whole sheet, behind the content. A stamp taller
  than the sheet throws `PageFurnitureOverflowError`. A word or a
  `whitespace-nowrap` line wider than the sheet throws `PageStampTooWideError`.
  Both are measured before rotation.
- Furniture sits outside the artifact binding, so paths do not resolve there.
  Pass a slot its text as props.
- Only `renderPdf` checks furniture classes
  ([safe-classes.md § How a class is checked](./safe-classes.md#how-a-class-is-checked)).
- The default (takumi) and the Chromium adapter draw all three slots. Chromium
  refuses a page counter in the `stamp` with `UnsupportedFurnitureContentError`.
  An adapter that does not draw a declared slot throws
  `UnsupportedFurnitureError`.

### `PageNumber`

Prints "Page 3 of 7". The preview counts its sheets. The PDF engine fills the
numbers into the spans marked `data-page-counter`. Use it in a furniture slot;
elsewhere it prints "Page 1 of 1". For a counter of your own, see
[custom-components.md § Page counters](./custom-components.md#page-counters).

| Prop | Type | Notes |
|---|---|---|
| `label` | `string?` | Default `"Page"`. `""` prints the number alone. |
| `separator` | `string?` | Default `"of"`. |
| `total` | `boolean?` | Prints the count. Default `true`. |
| `className` | `string?` | Default `text-xs text-neutral-500`, stepped by `typography.scale`. |

```tsx
<PageNumber label="Sheet" separator="/" />
```

## Pagination primitives

### `KeepTogether`

The element every keep is built from. Use it for content no shipped component
covers. When you build a keep by hand, see
[custom-components.md § Hand-built keeps](./custom-components.md#hand-built-keeps).

| Prop | Type | Notes |
|---|---|---|
| `keepId` | `string` | Required, unique and stable. |
| `as` | `ElementType?` | Default `"div"`. |
| `children` | `ReactNode?` | |
| *(rest)* | attributes | Spread onto the element: `className`, `style`, `data-*`, and `src`, `width`, `height` with `as="img"`. |

### `PageBreak`

A zero-height keep that opens a new page in the preview and, through the plan,
in the PDF.

| Prop | Type | Notes |
|---|---|---|
| `keepId` | `string` | Required and unique. |
| `table` | `string?` | The table id, when the break sits between two rows of a hand-built table, so the header repeats after it. |

```tsx
<Section id="summary" title="Summary">…</Section>
<PageBreak keepId="break:signatures" />
<Section id="signatures" title="Signatures">…</Section>
```

To break inside a table, build the table by hand
([custom-components.md § Hand-built keeps](./custom-components.md#hand-built-keeps)).

## Other exports

The installed files also export these. Reach for them only when a shipped
component does not fit.

| Export | From | Use |
|---|---|---|
| `Page`, `Sheet`, `PageFurnitureBands` | `pages.tsx`, `paper.tsx` | Draw sheets yourself from a `PagePlan`. `Page` takes `plan`, `index`, `furniture`, `children`. |
| `Attachment` | `pdf-pages.tsx` | A card for a part carried as a file: `filename`, `mimeType`, `byteLength?`, `reason`. Preview only: its default classes include `border-dashed`, which the PDF path refuses. |
| `FIELD_RULE`, `SIGNATURE_RULE`, `INITIALS_RULE`, `DATE_RULE` | `field.tsx`, `signature.tsx` | The underscore runs the components print. |
| `ListMarker`, `TextRole`, `PartKind`, `TotalRow`, `TableColumn` | the component files | Prop types. |
