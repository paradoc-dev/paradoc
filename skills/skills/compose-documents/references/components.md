---
name: components
description: The composition component vocabulary — Bundle, Document, Section, Text, List, Field, Table, Totals, Party, Signature, Image, QRCode, PageNumber, and the page furniture — with exact props.
metadata:
  tags: components, props, react
---

# The component vocabulary

**Contents:** [Import](#import) · [Document tree](#document-tree-components) ·
[Page furniture](#page-furniture) · [Hooks a composition may call directly](#hooks-a-composition-may-call-directly)

Install components from the registry and import them from
`@/components/paradoc/<name>` (see
[cli.md](./cli.md#installing-components)). Import types and headless hooks from
`@paradoc/react`. The component source and its Tailwind preset belong to the
project; the public runtime exports no visible document components and no
stylesheet. Import the installed `styles/paradoc.css` once from the app's
global stylesheet. Never import CSS from a composition module because Node
loads that module directly for checks, layer renders, and seals.

`paradoc dev` (see the CLI docs) previews a composition live through this same
binding — it resolves the artifact's React layer and calls the component the
way a render or a check does, not through a separate preview-only path.

## Document tree components

These compose the artifact into content. Every one of them (except `Section`,
`Bundle`, `Document` and `List` themselves, and `QRCode`, which carries no
pagination unit) is a `KeepTogether` leaf — a `List` is not one, but each of
its items is. See [pagination.md](./pagination.md).

### `Bundle`

Holds one or more `Document`s. Required when a composition is one document
among several in a packet, or when a document needs no `Bundle`-level
branding; otherwise a lone `Document` may sit at the tree's root on its own.

| Prop | Type | Notes |
|---|---|---|
| `id` | `string?` | Stable identifier. Defaults to `"bundle"`. |
| `tokens` | `DocumentTokensInput?` | Branding for every document inside. See [safe-classes.md](./safe-classes.md#branding-tokens). |
| `className` | `string?` | |
| `children` | `ReactNode` | One or more `Document`s. |

### `Document`

Binds one form artifact and its data to everything beneath it, and evaluates
the artifact's `defs` (what `Totals` reads). The only component that knows
how the artifact is loaded — everything below it names a path or a party
role.

| Prop | Type | Notes |
|---|---|---|
| `artifact` | `Form` | The parsed, validated form artifact. |
| `data` | `DocumentData` | `{ fields: Record<string, unknown>, parties?: Record<string, unknown> }`. |
| `format` | `FormatOptions?` | How values the serializer registry does not cover are formatted, and which locale registry (`us` \| `eu`) covers the rest. |
| `tokens` | `DocumentTokensInput?` | Branding. A nested `Document` inside a `Bundle` may only add `accentColor`/`logo` — paper tokens are the bundle's. |
| `id` | `string?` | Stable identifier within its bundle. |
| `className` | `string?` | |
| `children` | `ReactNode` | The document's content. |

### `Section`

A titled container, **not** a pagination unit — it carries `data-section`,
not `data-keep-id`, precisely so a long section is never one keep. It
collapses to `null` on a page that holds none of its keeps.

| Prop | Type | Notes |
|---|---|---|
| `id` | `string` | Stable section id. |
| `title` | `string?` | Rendered as a heading `KeepTogether` (`heading:<id>`). Omit for an untitled section. |
| `className` | `string?` | Defaults to `"flex flex-col gap-2"`. |
| `children` | `ReactNode` | | |

### `Text`

Static prose in a named role: `heading`, `body`, `caption`, or `small`. Each
role's size and leading come from the document's `typography` token, so never
write a heading as a raw element with a hand-picked `text-*` class. Reads
nothing from the artifact — a value belongs to `Field`.

| Prop | Type | Notes |
|---|---|---|
| `keepId` | `string` | Stable id, unique in the document. Required: the plan names a unit by id. |
| `role` | `"heading" \| "body" \| "caption" \| "small"?` | Defaults to `"body"`. |
| `as` | `ElementType?` | Defaults to `h2` for `heading`, `p` for every other role. |
| `className` | `string?` | Replaces the role's own classes outright. |
| `children` | `ReactNode` | The prose. |

```tsx
<Text keepId="scope:heading" role="heading">Scope of services</Text>
<Text keepId="scope:body">The provider will survey the site and commission the equipment.</Text>
```

Each `Text` is a `KeepTogether`, so never put one inside another keep.

### `List`

Ordered or unordered items. The markers are **text**, because the engine
draws no list markers and `list-*` classes are outside the verified
vocabulary — never write `<ul>`/`<ol>` with a marker class and expect the PDF
to draw one.

| Prop | Type | Notes |
|---|---|---|
| `items` | `ListItem[]` | See below. |
| `marker` | `"decimal" \| "lower-alpha" \| "roman" \| "bullet"?` | Top level. Defaults to `"decimal"`. |
| `nestedMarker` | same | Every level below the top. Defaults to `"lower-alpha"`. |
| `id` | `string` | Keep-id prefix, unique in the document; an item's own id is `<id>:<index>`. Two lists sharing one would claim the same keeps. |
| `className` | `string?` | Replaces the top level's default column layout. |

`ListItem`:

| Prop | Type | Notes |
|---|---|---|
| `text` | `ReactNode` | The item's own text. |
| `items` | `ListItem[]?` | A nested level. Its markers carry this item's as a prefix, so `2.b.`. |

```tsx
<List
  id="clauses"
  items={[
    { text: "The provider performs the services." },
    { text: "The customer provides:", items: [{ text: "Site access." }] },
  ]}
/>
```

Every item is its own pagination unit (`clauses:1:0` for a nested one), so a
list breaks between items and never inside one. A level withdraws from a page
holding none of its items, as `Table` does.

An item's `text` is content, never another keep: no `Field`, `Text`, `Table`
or `KeepTogether` inside it. A value from the artifact reaches an item as the
text the composition read for it.

### `Field`

One labelled value at a path into the artifact, printed through the
artifact's serializers. Never format a value yourself — pass the path and let
`Field` resolve type and locale.

| Prop | Type | Notes |
|---|---|---|
| `path` | `string` | Dotted path into the artifact, e.g. `customerAddress` or `lineItems.0.unitPrice`. |
| `label` | `string \| false?` | Overrides the artifact's label. `false` renders the value with no heading. |
| `as` | `"text" \| "image"?` | Defaults to `"text"`. `"image"` draws an attachment — see [`Image`](#image). |
| `width` | `number?` | Rendered width in CSS pixels. Required by `as="image"`, whatever the slot holds. |
| `height` | `number?` | Rendered height in CSS pixels. Required by `as="image"`, whatever the slot holds. |
| `src` | `string?` | Where a browser preview loads an `as="image"` picture from. Defaults to the attachment's own file name. |
| `paragraphs` | `boolean?` | Splits the value at blank lines, one keep per paragraph. Defaults to `false`. |
| `rule` | `boolean?` | Draws a fill line where the value is blank. Defaults to `false`. |
| `className` | `string?` | |

A path the artifact does not declare throws `UnknownFieldPathError` — it is
a fault, never a blank.

**Newlines are line breaks, blank lines are paragraphs.** A newline inside a
value wraps as a line break in both outputs — the value carries
`whitespace-pre-line`, which the browser and the default engine both honour —
so never replace one with markup of your own. A newline never paginates. A **blank line** (two or more newlines) splits the value only with
`paragraphs`, and then each paragraph is its own keep, `field:<path>:<index>`,
with the label on the first one; the wrapper is not a keep and withdraws from
a page holding none of them.

```tsx
<Field path="scopeOfServices" paragraphs />
```

Reach for `paragraphs` on any field whose value is running prose a filler
supplies: without it the whole value is one keep, and a value longer than a
page overflows it as an oversize unit. A single paragraph taller than a page
is still oversize — a pagination unit is never split inside itself.

`rule` is for a document printed before it is filled: where the artifact has
no value, it draws an underscore run (`FIELD_RULE`) to write on instead of the
document's blank placeholder.

### `Table`

Renders a list field as flex rows (never a real `<table>` — see
[pagination.md](./pagination.md#no-table)). The header and every row are
independent pagination units; the header repeats on a page that opens on a
continued row.

| Prop | Type | Notes |
|---|---|---|
| `path` | `string` | Path of the list field. |
| `columns` | `TableColumn[]` | See below. |
| `id` | `string?` | Keep-id prefix. Defaults to `path`. |
| `className` | `string?` | |
| `continuedLabel` | `string?` | Shown on the repeated header once rows carry it past a page break, never on the table's own, first header. Kept to one line. |
| `footer` | `TableFooterRow[]?` | Rows `{ def, label?, emphasis? }` evaluated from the artifact's own definitions. Rendered as one more keep, `` `${id}:footer` ``. When it does not fit on the last row's page, the plan moves the last row onto the next page with it. |

`TableColumn`:

| Prop | Type | Notes |
|---|---|---|
| `field` | `string` | Field name **inside** the list item — not the full dotted path. |
| `header` | `string?` | Defaults to the item field's own label. |
| `width` | `string?` | A Tailwind basis class, e.g. `"basis-1/2"`. Defaults to `"basis-1/4"`. |
| `align` | `"left" \| "right"?` | Defaults to `"left"`. |
| `render` | `(text: string, row: unknown) => ReactNode` | Replaces the cell's plain text with markup built from the column's already-formatted text and the row value. The row still paginates as one unit. |

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

### `Totals`

Renders the artifact's computed `defs`. Does no arithmetic itself — every
value is a def the artifact evaluates and a serializer formats.

| Prop | Type | Notes |
|---|---|---|
| `rows` | `TotalRow[]` | See below. |
| `id` | `string?` | Keep id. Defaults to `"totals"`. |
| `className` | `string?` | Defaults to `"flex w-1/2 flex-col gap-1 self-end"`. |

`TotalRow`:

| Prop | Type | Notes |
|---|---|---|
| `def` | `string` | Name of the def to read. |
| `label` | `string?` | Defaults to the def's own label. |
| `ratePath` | `string?` | Path of a field shown beside the label, e.g. the tax rate behind the tax line. |
| `emphasis` | `boolean?` | Heavier row for the amount due; draws the accent-coloured rule above it. |

```tsx
<Totals rows={[{ def: "subtotal" }, { def: "tax", ratePath: "taxRatePercent" }, { def: "total", emphasis: true }]} />
```

### `Party`

One party of a declared role — name, organization, address, and contact
each on its own line, as a block, or joined into one run inline — through
the shared formatter. The artifact's own person/organization schema carries
only name-shaped fields; a filled party record that also carries its own
`organization`, `address`, or `phone` member has each one printed, and a
member the record does not carry is left out rather than printed blank.

| Prop | Type | Notes |
|---|---|---|
| `role` | `string` | Party role declared by the artifact, e.g. `"buyer"`. |
| `index` | `number?` | 0-based, for a role admitting several parties. Defaults to `0`. |
| `variant` | `"block" \| "inline"?` | `"block"` stacks each line; `"inline"` joins them into one run. Defaults to `"block"`. |
| `label` | `string \| false?` | Overrides the role heading. `false` renders with no heading. |
| `keepId` | `string?` | Keep id. Defaults to `` `party:${role}` `` or `` `party:${role}:${index}` `` past the first. |
| `className` | `string?` | |

A role the artifact does not declare throws `UnknownPartyRoleError`; an
`index` past how many the role was actually filled with throws
`PartyIndexOutOfRangeError` — both faults, never a blank. This includes an
optional role (`min: 0`) nothing has filled yet: unlike `Signature`, which
prints an em dash for the same case, `Party` fails rather than printing a
placeholder for a party that is not there.

```tsx
<Party role="buyer" />
<Party role="witness" index={1} variant="inline" />
```

### `Signature`

One party's signing block for one field type. Draws the marker the seal
locates — see [artifact-binding.md](./artifact-binding.md#the-seal) — and the
core placeholder rule the seal measures a field from. Never draw a rule with
a border or write your own marker.

| Prop | Type | Notes |
|---|---|---|
| `party` | `string` | Party role declared by the artifact, e.g. `"customer"`. |
| `index` | `number?` | 0-based, for a role admitting several parties. Defaults to `0`. |
| `type` | `"signature" \| "initials"?` | Which signing field this block draws. Defaults to `"signature"`. |
| `id` | `string?` | Keep id. Defaults to `` `${type}:${party}` ``. |
| `className` | `string?` | |

A party signing **and** initialling is two blocks:

```tsx
<Signature party="tenant" />
<Signature party="tenant" type="initials" />
```

Two blocks for the same party and the same `type` throw
`AmbiguousSigningMarkError` — one flow slot per type per party.

### `Image`

One picture at a declared size. `bytes` are sniffed for their encoding (PNG,
JPEG, GIF, WebP, SVG) and embedded as a `data:` URI, so nothing is fetched;
`src` is a key the PDF path supplies bytes under and a URL a browser preview
loads, never rewritten by the component. Declare the size: neither output
measures an image while it lays the page out.

| Prop | Type | Notes |
|---|---|---|
| `bytes` | `Uint8Array?` | The picture's own bytes. Wins over `src`. |
| `src` | `string?` | Where the render loads the picture from. |
| `width` | `number` | Rendered width in CSS pixels. |
| `height` | `number` | Rendered height in CSS pixels. |
| `alt` | `string?` | Accessible description. Defaults to `""` for a decorative mark. |
| `keepId` | `string` | Keep id. Required and unique: an image names no path to derive one from. |
| `className` | `string?` | |

```tsx
<Image bytes={logoBytes} width={40} height={40} alt="" keepId="logo" />
```

Bytes no engine can decode throw `UndecodableImageError`; neither bytes nor a
source throws `MissingImageSourceError`; and a `Field` asked to draw with no
`width` or `height` throws `MissingImageSizeError`. A `src` with no bytes behind
it is reported by `paradoc check` as a missing image.

**An attachment is not a field value.** The artifact declares annex slots and
the filled data carries one `Attachment` (`name`, `mimeType`) per slot, so a
composition draws one with `Field` at the annex path:

```tsx
<Field path="annexes.sitePhoto" as="image" width={160} height={160} />
```

The attachment is drawn when its MIME type starts with `image/` and its file
name is printed when it does not; `paradoc check` reports the mismatch as
`image:<path>`. A slot the artifact does not declare throws
`UnknownAnnexError`.

### `QRCode`

Links a document to a URL. The one component here that reads nothing from
the artifact: it takes the URL directly and draws it as an inline SVG. takumi
serializes that SVG straight into the PDF rather than rasterising it, so the
code stays sharp at any output scale.

| Prop | Type | Notes |
|---|---|---|
| `url` | `string` | The URL the code encodes. |
| `size` | `number?` | Width and height in pixels. Defaults to `128`. |
| `color` | `string?` | Module colour. Defaults to `"#000000"`. |
| `backgroundColor` | `string?` | Colour behind the modules. Defaults to `"#ffffff"`. |
| `label` | `string?` | Accessible name for the SVG. Defaults to `` `QR code for ${url}` ``. |

An empty `url` throws `EmptyQRCodeUrlError` rather than drawing a code with
nothing encoded in it.
| `className` | `string?` | |

```tsx
<QRCode url={`https://docs.paradoc.dev/forms/${id}`} size={96} className="place-self-end" />
```

It needs no `Document` above it and carries no pagination unit of its own:
it is not a `KeepTogether`. To hold it with the content beside it, wrap both
in one.

## Page furniture

Not part of the artifact tree; these lay the document out.

### `Pages`

Paginates the document on screen: measures once, plans page breaks at
keep-together boundaries, and renders the tree once per page.

| Prop | Type | Notes |
|---|---|---|
| `className` | `string?` | |
| `onPaginate` | `(plan: PagePlan) => void?` | Called with the fresh plan whenever measurement changes it — not on every render. Safe to pass an inline function; `Pages` never keys off prop identity. |
| `furniture` | `PageFurniture?` | What every sheet carries outside the flow. See [Furniture slots](#furniture-slots). |
| `children` | `ReactNode` | One document root (`Document` or `Bundle`). |

```tsx
const [plan, setPlan] = useState<PagePlan | null>(null);

<Pages onPaginate={setPlan}>
  <ChangeOrder data={data} />
</Pages>;
```

Hand `plan.breaks`/`plan.repeats` to `renderPdf({ plan })` from
`@paradoc/react-pdf` so the PDF starts
each page where the preview did (see the react package README's "Hand-off to
the PDF path"). Omit `plan` and the engine paginates on its own.

### `Paper`

Shows the document as one continuous sheet at paper width, scaled to fit its
container — used for a proof view rather than the paginated preview. Takes no
geometry props; paper size comes from the document's own `tokens`.

| Prop | Type | Notes |
|---|---|---|
| `className` | `string?` | |
| `furniture` | `PageFurniture?` | The same slots `Pages` takes; one sheet is page 1 of 1. |
| `children` | `ReactNode` | The document root shown as one sheet. |

### Furniture slots

`PageFurniture` is `{ header?, footer?, stamp? }`, each composed content. The
preview draws the bands on every sheet; the PDF engine repeats them on every
page. Declare the object once and hand the same one to the preview and to the
render:

```tsx
const furniture = {
  header: <span className="text-xs text-neutral-500">Northwind Partners LLP</span>,
  footer: <PageNumber />,
  stamp: <span className="text-6xl text-neutral-200">DRAFT</span>,
};

<Pages furniture={furniture}>{document}</Pages>;
await renderPdf(document, { plan, furniture });
```

Rules:

- A band is drawn **inside the margin the document declares**, so the content
  budget, the page plan and the page count never change because furniture
  exists. A band taller than that margin fails the render with
  `PageFurnitureOverflowError`, naming the slot, the height and the margin.
  With the default 48 px margin a band has about 28 px; widen `marginPx` for
  a taller one.
- The `stamp` is drawn across the whole sheet, behind the content, and takes no
  room in the margin.
- Furniture renders **outside** the document's artifact binding, so a slot
  cannot use `Field` or name a path. Pass what it prints in as props.
- Every class in a slot is checked against the verified vocabulary exactly as
  the document tree is.
- Each engine declares the slots it draws. The default (takumi) draws all
  three; the experimental Chromium adapter draws none yet, and a render that
  names it with furniture fails with `UnsupportedFurnitureError` rather than
  writing a document with every page missing its header.

### `PageNumber`

The page being drawn and how many there are. The preview counts the sheets it
laid out; the PDF engine fills the same two numbers itself, which is why the
wording is two words rather than a format function.

| Prop | Type | Notes |
|---|---|---|
| `label` | `string?` | Words before the number. Defaults to `"Page"`; `""` prints the number alone. |
| `separator` | `string?` | Words between the number and the count. Defaults to `"of"`. |
| `total` | `boolean?` | Prints the count after the separator. Defaults to `true`. |
| `className` | `string?` | |

```tsx
<PageNumber label="Sheet" separator="/" />
```

Put it in a furniture slot. Anywhere with nothing paginating above it, it reads
"Page 1 of 1". It carries no pagination unit of its own: furniture is not part
of the flow.

### `KeepTogether`

The primitive every pagination unit is built from. Reach for it directly only
when composing something the shipped components do not cover (a masthead
image, a custom banner) — never wrap it around a `Field`, `Table`, or another
`KeepTogether`.

| Prop | Type | Notes |
|---|---|---|
| `keepId` | `string` | Stable id. Also the id `renderPdf`'s `plan.breaks` names. |
| `as` | `ElementType?` | Element to render. Defaults to `"div"`. |
| `children` | `ReactNode?` | |
| *(rest)* | HTML attributes | Spread onto the rendered element — `src`, `alt`, `width`, `height`, etc. when `as="img"`. |

```tsx
<KeepTogether as="img" keepId="logo" src={logoSrc} alt="" width={40} height={40} className="h-10 w-10" />
```

### `PageBreak`

A `KeepTogether` with no content: starts a new page at its position and
occupies no height of its own in either output — a flex flow around it
still puts its own gap where the break sits. The plan opens a page there
the same way it opens one for an overflowing keep, so an orphaned table
header still carries forward ahead of it rather than being stranded.

| Prop | Type | Notes |
|---|---|---|
| `keepId` | `string` | Stable id, like any other `KeepTogether`. |
| `table` | `string?` | Set to the id a hand-built table's rows carry when the break sits between two of them, so the table's header still repeats on the page it opens. Omit it for a break anywhere else. |

```tsx
<Section id="summary" title="Summary">…</Section>
<PageBreak keepId="signature-page" />
<Section id="signature" title="Signature">…</Section>
```

`Table` generates its own rows from a bound list and cannot be interrupted
this way; a table a break needs to split is built directly with
`KeepTogether`, the way `Table` itself is, and the break's `table` names the
same id the rows carry.

## Hooks a composition may call directly

- `useDocumentTokens()` — the resolved branding (`accentColor`, `pageSize`,
  `marginPx`, `logo`, `dir`, `lang`, `typography`) for a component below `Document`/`Bundle`
  that needs to read a token itself (the sample's masthead mark does this to
  prefer a tenant `logo` over its own default).
- `usePagePlan()` — the current `PagePlan` for a component inside a page that
  needs to know what the plan decided.
- `usePageNumber()` — `{ page, pages }` for a component drawn in a furniture
  slot. Outside a paginated preview it is page 1 of 1.

Everything else — `field`, `text`, `value`, `item`, `party` resolution — is
already wrapped by `Field`, `Table`, `Totals`, and `Signature`. A composition
should not need `useDocument()` directly; if it seems to, prefer composing
existing components first.
