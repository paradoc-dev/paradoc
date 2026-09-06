# @paradoc/react

Compose a document from React components bound to a Paradoc form artifact. One
tree is the source of truth for both outputs: a paginated document on screen,
and the PDF that document renders to.

```sh
pnpm add @paradoc/react
```

Five entries, because they need different things of the machine they run on:

| Entry                         | Runs   | Holds                                                              |
| ----------------------------- | ------ | ------------------------------------------------------------------ |
| `@paradoc/react`              | Either | The components, the document context, the plan, the preview.       |
| `@paradoc/react/pdf`          | Node   | `renderPdf`, the adapter seam, the default engine, the seal seam.  |
| `@paradoc/react/chromium`     | Node   | The experimental Chromium adapter.                                 |
| `@paradoc/react/examples`     | Either | Sample material: one artifact, two data sets, one composition.     |
| `@paradoc/react/examples/pdf` | Node   | That sample's logo bytes and seal wiring.                          |

**The two `examples` entries are sample material, not a stable API.** They ship a
worked services proposal so the pagination tests, the class probe suite and the
parity suite have a real document to measure, and so a reader has a whole
composition to copy from rather than a fragment. Anything under `examples` may
change without a major version. Nothing under it is framework surface, and
nothing in the framework entries depends on it.

`@paradoc/react/styles.css` carries the document's typeface. Import it once,
beside your own stylesheet.

`react` and `react-dom` are peer dependencies. `puppeteer` and `tailwindcss` are
optional peers that only the Chromium adapter needs, so `@paradoc/react/pdf`
loads without either.

The artifact packages — `@paradoc/core`, `@paradoc/types`, `@paradoc/render` and
`@paradoc/serialization` — are consumed unchanged: this package adds a way to
write a document, not a second description of one.

## Writing one

A composition is a React component. `Document` binds the artifact and its data
and supplies both by context; every component below it names a path rather than
carrying its own copy of a label, a format or a total.

```tsx
import { Document, Field, KeepTogether, Pages, Section, Signature, Table, Totals } from "@paradoc/react";
import "@paradoc/react/styles.css";

import { invoiceForm } from "./invoice-artifact";

export function Invoice({ data }: { data: DocumentData }) {
  return (
    <Document artifact={invoiceForm} data={data}>
      <KeepTogether keepId="title">
        <h1 className="text-lg font-semibold">Invoice</h1>
      </KeepTogether>

      <Section id="parties" title="Billed to">
        <Field path="customer" keepId="field:customer" />
        <Field path="issuedOn" keepId="field:issued" label="Issued" />
      </Section>

      <Section id="lines" title="Scope and pricing">
        <Table
          path="lineItems"
          keepPrefix="line-items"
          columns={[
            { path: "description", header: "Description" },
            { path: "quantity", header: "Qty", align: "right" },
            { path: "amount", header: "Amount", align: "right" },
          ]}
        />
        <Totals defs={["subtotalAmount", "tax", "total"]} />
      </Section>

      <Section id="acceptance" title="Acceptance">
        <Signature party="customer" keepId="signature:customer" />
      </Section>
    </Document>
  );
}
```

On screen, `Pages` paginates it at US Letter and scales the sheet to its
container. The plan it decides is published, and the same plan is what the PDF
is hinted with, so both outputs break in the same places:

```tsx
import { Pages, type PagePlan } from "@paradoc/react";

const [plan, setPlan] = useState<PagePlan | null>(null);

<Pages onPaginate={setPlan}>
  <Invoice data={data} />
</Pages>;
```

On a server, one call takes the same tree and returns bytes. Pass the plan the
preview published and the PDF starts each page where the preview did; leave it
out and the engine paginates:

```tsx
import { renderPdf } from "@paradoc/react/pdf";

const { bytes, unknownBreaks } = await renderPdf(<Invoice data={data} />, {
  images: [{ src: "invoice:logo.png", data: logoBytes }],
  plan, // omit to let the engine paginate
});
```

The engine fetches nothing, so every image the tree names arrives as bytes keyed
by its `src`. Anything the engine cannot express — a class outside the verified
vocabulary, an image it cannot decode — fails the render with every offender
named.

A whole worked composition, its artifact and two data sets ship as
`@paradoc/react/examples`. It is sample material rather than API, as above.

## The components

One tree is the source of truth. `Document` takes the form artifact and its data
and supplies both by context; nothing below it carries its own copy of a label, a
format, or a total.

| Component   | What it does                                                            |
| ----------- | ----------------------------------------------------------------------- |
| `Bundle`    | Holds documents.                                                        |
| `Document`  | Binds one form artifact and its data, and evaluates the artifact's defs. |
| `Section`   | A titled container.                                                     |
| `Field`     | Names a path, renders the value through the artifact's serializers.     |
| `Table`     | Renders a list field as rows.                                           |
| `Totals`    | Renders the artifact's computed defs.                                   |
| `Signature` | Names a party and renders its signing block.                            |
| `Paper`     | Shows the document at paper width, scaled to fit its container.         |

## The pagination rule

`Pages` reads `[data-keep-id]` in document order and assigns each one to a
page, so the rule has to be exact:

- **An element with `data-keep-id` is a pagination unit and is never split.**
  Every field, the table header, every table row, every section heading, the
  totals, and each signature block carries one.
- **A keep never contains another keep.** Keeps are leaves.
- **All rendered text lives inside some keep.** Nothing may fall between them.
- **`Section` is a container, not a keep.** It carries `data-section` instead.
  The priced scope runs well past one page, so treating a section as one
  keep-together unit would be wrong.
- **Keep ids are stable across renders.** `renderPdf` accepts them as `breaks`
  and turns each into a `break-before: page`, and the lab hands it the preview's
  page plan, so changing an id changes both outputs.

The first three are asserted for both data sets in `tests/pagination-units.test.tsx`
against a parsed DOM, not a regular expression.

## How the preview paginates

Nothing moves. `Pages` renders the document tree twice over:

1. Once into a hidden container 720 pixels wide — one page's content width —
   which is what `measureKeeps` reads.
2. Once per page, from the same tree. Each `KeepTogether` asks the page context whether
   its id is on that page and returns `null` when it is not, and a `Section`
   returns `null` on the pages that hold none of its keeps. No DOM node is
   moved between pages, no markup is duplicated, and there is no second
   description of the document anywhere.

Between the two, `planPages` decides everything. It is pure and takes no
elements, so the fill rule is tested without a browser in `tests/plan.test.ts`.
It returns `{ pages, repeats, sections, breaks, oversize, budget }`; `Pages`
publishes it through `onPaginate`, and a component inside a page can read it
with `usePagePlan()`.

**A keep is an interval, not a height.** The masthead puts two columns of
keeps side by side and so does the acceptance section, so adding keep heights
would count the same band of the page twice — the short set planned two pages
that way. `measureKeeps` reports each keep's top and bottom in the measured
flow instead. A shared band is counted once, and the gaps between keeps are
already in the offsets rather than being a separate thing to model.

**The table header repeats.** A page that opens on a row of a table renders that
table's header above it. The copy is not in the flow, so it costs the page its
own height plus the gap the flow puts under the header, and it is listed in that
page's `repeats`. A header left alone at the foot of a page moves forward
instead — rows only ever follow a header, so a page never ends on a header with
nothing under it — and a header moved that way is the keep's one place in the
flow, not a copy.

**A keep that does not fit the page opened for it** overflows that page.
Nothing else joins it, the keep is listed in the plan's `oversize` with what it
actually consumed, and the page carries a red marker naming it, its height and
the budget. A keep taller than a page is the obvious case; a row can also
overflow because the header copy above it left too little room. Splitting long
prose is out of scope.

**The table withdraws.** `Table` is a wrapper, not a keep, so it returns
`null` on a page holding none of its header or rows. An empty wrapper would
still take the section's flex gap, and the rendered page would then be taller
than the flow the plan was measured against.

**Fonts gate the whole thing.** No page renders until `document.fonts.ready`
resolves, so a page break never reflects a fallback face. The preview
repaginates when the data changes and when the measuring container resizes, and
keeps the previous plan object when nothing moved.

## Two constraints that shaped the design

**No `<table>`.** The default PDF engine has no table support, so
`Table` renders flex rows. A document that used real table markup on screen could
not be the same tree the PDF renders.

**One fixed paper geometry.** `Paper` takes no geometry props: US Letter at
96 dpi (816 x 1056 CSS pixels) with a 48 pixel margin, exported as constants. The
preview and the PDF have to agree on it, so a caller must not be able to vary it.
The sheet keeps its 816 pixel width at every window size and only a CSS transform
changes, so line wrapping on screen is the wrapping the PDF will have.

## Hand-off to the PDF path

The PDF path reads the plan, so a few things about it have to be stated plainly.

**`breaks` are the hinted keep ids.** Each entry is the keep that starts a
page from page 2 onward, in the tree's own ids, and it is what the lab passes to
the engine as a page-break hint. A copied header is never a break, because the
tree holds one of it and there is no second element to hint.

**The first real keep on a page is the first one without `data-keep-repeat`.**
On a continued page `pages[i][0]` is usually the header copy while `breaks[i-1]`
is the row under it, and the DOM marks the copy with `data-keep-repeat="true"`.
The parity comparison of "first keep on every page", and the pixel comparison
beside it, both have to read past that attribute, or every continued page reads
as a mismatch. The PDF's own copy carries the same attribute.

**A repeated header has no counterpart in an engine-paginated PDF.** The engine
paginates a tree that holds the header once, and it has no per-page header
option. So hint mode carries the copy instead: see "Hint mode" below. In engine
mode the continued pages still have no header, and the pixel difference on those
pages is the header band.

**The PDF side has no per-page keep map.** The preview publishes one; the PDF
is bytes and page text. So the parity suite reads "the first keep on every
page" off the PDF the only way the PDF allows, in both modes alike: it matches
the start of a page's text against the text each keep carries in the tree the
engine resolved, longest match first, stepping past a repeated header because a
copy is not the page's own keep. Reading it from the plan that was sent would
make hint mode a tautology; reading it from the text makes it a check. A keep
with no text cannot be found this way at all, which is why the criterion is the
first keep on the page **that carries text**: the masthead's logo is a keep
and a PDF has no way to name it.

**A copy paired with a stale break goes with it, and is not named.** A break
naming a keep the tree no longer has is reported in `unknownBreaks` and the
page it would have opened is never opened, so the header copy listed for that
page is simply not placed. `unknownRepeats` names only a copy whose own keep is
missing from the tree. One divergence is reported once, under the break that
caused it.

**Row pitch drifts about 0.25 px a row, in both modes.** The engine lays a table
row out at 36.0 pixels against the browser's 35.75. It is a quarter of a pixel a
row and it accumulates: about 6 pixels lower at the foot of a page full of rows.
Pagination does not change it: the drift is the same in engine mode and in hint
mode. So it is the likely source of the per-page pixel difference the parity suite
measures, rather than the repeated header, which hint mode now matches to within
0.3 px.

The parity suite finds exactly this drift, page by page, and it is the reason
the specification's one percent pixel clause was replaced with a limit on what
survives sliding the drift out. See "Parity" below.

**Known non-protection: a section heading can end a page.** The orphan rule
covers table headers only. `Section` emits its title as an ordinary keep, so a
heading can be the last keep on a page with its content on the next one. It
does not happen in the proposal at the current data sizes, and it is recorded
here rather than stated as a rule the pagination pass does not enforce.

## The sample data and the page budget

One page holds `PAGE_CONTENT_HEIGHT_PX`, which is 960 pixels once both margins
are taken. Measured in the lab at a 1280 pixel window:

| Data set               | Line items | Content height | Pages |
| ---------------------- | ---------- | -------------- | ----- |
| `shortProposalData`    | 4          | 924 px         | 1     |
| `overflowProposalData` | 66         | 3186 px        | 4     |

The short set clears the budget by 36 pixels. The overflow set is 3.32 pages of
content but plans four, because the repeated header costs a row on each
continued page and no keep splits: the lab reports pages of 947, 951, 951 and
400 pixels, breaking at `line-items:13`, `line-items:39` and `line-items:65`.
The row counts behind those numbers are asserted in the tests, so shrinking
either set fails a test rather than quietly breaking the budget.

Measure it with `document.querySelector("[data-paper-measure] article")`, not a
sheet: a sheet is a full page tall by construction, so its `scrollHeight` never
reports less than 960 and a document that fits looks exactly like one that
fills the page.

## The artifact declares one layer, and it describes no layout

The React tree is the only description of this document's layout, which is the
specification's central invariant. A markdown or PDF layer beside it would be a
second one.

The seal flow will not place a signature slot that no layer declares, and flow
placement needs a text layer core can render its marker into, so `proposal.ts`
carries the smallest layer that satisfies both: two slot declarations, and one
line per slot whose whole content is the slot id, a tab, and the placeholder
core renders for it.

```
provider-signature	{{#with parties.provider}}{{signature "provider-signature"}}{{/with}}
customer-signature	{{#with parties.customer}}{{signature "customer-signature"}}{{/with}}
```

Nothing the document shows appears there: no title, no field, no heading, no
total. `tests/proposal-artifact.test.ts` asserts the shape line by line, so a
line of document text cannot be added to it without failing a test. `src/pdf/seal.tsx`
reads the placeholders back and puts each one in the tree's own signature block.

The artifact declares no `defaultLayer`. With one layer, core resolves the seal
target to it, and naming a default would say the document has a default
rendering when the rendering is the React tree.

## A path that does not resolve is a fault

`resolveField` throws `UnknownFieldPathError` naming the path and the form. A
typo in a composition is a bug, not a blank value, and rendering it as an em dash
would hide it until someone read the finished document.

## Known limitations

Accepted as they are. The full record of how each was found, with the
measurements behind it, is in `_docs/architecture/react-document-composition-spike.md`.

**In the framework packages.**

- **No list aggregate in the expression language.** `defs` can index a list and read its length, but there is no `sum`, `map` or `reduce`, so a subtotal cannot be written as an expression. The example artifact materializes one into a hidden field instead.
- **No serializer for dates or numbers.** `isSerializableFieldType` covers the composite primitives only, so `createValueFormatter` formats dates, numbers, percentages, booleans and enums from the field definition with `Intl`. There is also no published `(artifact, path, value) => string` helper, and `getFieldType` does not descend into `list.item`, so `resolveField` walks the schema itself.
- **The phone serializer does not localize.** It returns the E.164 string verbatim.
- **Flow placement needs braille coverage in the renderer's fonts, and says so nowhere.** A renderer whose fonts do not cover core's four marker codepoints loses the marker in silence, and the failure surfaces as `locate` reporting every slot "not found". The seal path embeds a braille face for the marker pass.
- **A flow slot is sized off an underscore run**, so a signature rule drawn as a border gives the field nothing to measure. `Signature` draws core's own placeholder.
- **Core does not export that placeholder.** `SIGNATURE_RULE` is a third copy of a private constant; a test catches core changing it, but nothing prevents it.
- **`Signer.person` is always a `Person`**, so an organization party cannot sign. A composition has to name a contact person.
- **A form payload and the components' data do not line up.** `DocumentData` holds `Record<string, unknown>` because a component is given a path as a string; `fill` takes a payload core infers from the artifact. Nothing published bridges the two.
- **One key per role**, so a multi-party role would seal only its first party. A role admitting several parties needs a slot and a key per index.

**In the default engine.**

- **It applies user-agent margins the browser has already reset.** `PDF_RESET_STYLESHEET` restates Tailwind's preflight for the engine; without it the same tree lays out a tenth taller on paper.
- **A corrupt image body fails inside the engine, not before it.** The PDF path checks an image's signature, so bytes of an undecodable format are named before the render; a valid signature over a corrupt body is not, and the engine's own error does not name the `src`.
- **The engine-paginated PDF does not repeat the table header.** The engine offers no per-page header option, so this is an engine-mode difference: hint mode copies the header itself.
- **The font registry is global to the process.** Once any render embeds the marker face, `signingMarkers` is advisory for every later render in that process, which is why `tests/seal-marker-font.test.tsx` stands alone and the vitest config states `isolate: true`.
- **It does not initialize itself in the browser.** `takumi-pdf` exports no `browser` condition, and a second initialization on one page faults. PDF rendering is Node only.

**In this package.**

- **The date rule beside a signature is drawn as underscores too.** Nothing places a slot on it; it matches the signature rule for consistency. Whether a signing block should draw rules as text at all is still open.
- **A section heading can end a page.** The orphan rule covers table headers only, so a heading can be the last keep on a page with its content on the next.
- **The lab's PDF endpoint answers any HTTP method** and validates nothing it is sent. It is a comparison viewer on a dev server, and it is not published.

## The typeface

`@paradoc/react` owns the document, so it owns the font: it declares
`@fontsource-variable/inter` and exports it through `@paradoc/react/styles.css`
plus the `DOCUMENT_FONT_*` constants. Consumers import that stylesheet rather
than declaring Inter themselves, so the preview and the PDF embed the same
files.

## The PDF

`@paradoc/react/pdf` is a Node-only subpath. One call takes the same tree and
returns PDF bytes:

```ts
import { renderPdf } from "@paradoc/react/pdf";
import { proposalLogoImage } from "@paradoc/react/examples/pdf";

const { bytes, unknownBreaks } = await renderPdf(<ProposalDocument data={shortProposalData} />, {
  images: [await proposalLogoImage()],
  plan, // omit to let the engine paginate
});
```

The call returns a `PdfRenderResult`, not bare bytes, because a hint can name a
keep the tree no longer has. The specification says a stale hint is ignored and
the divergence reported, so `unknownBreaks` and `unknownRepeats` list them and
the render carries on.

The default engine is `takumi-pdf`, pinned exactly in the workspace catalog and
consumed only by this package. It lays the tree out and writes vector PDF from
WebAssembly: no Chromium, no browser process, selectable text, subset fonts. It
is not the only one — see **Adapters** below — but everything up to that point
describes it, because it is the engine the numbers below were measured on.

**Three translations, and nothing else.** `@takumi-rs/helpers` resolves the React
tree — components, contexts, the hooks they use — into a plain node tree that
still carries `className` and the `data-*` attributes the components wrote. That
is the only level at which the walk in `src/pdf/tree.ts` is possible: above it
the tree is function components that have not run, below it the classes have
already become styles. The walk moves `className` to `tw`, gives every
`[data-keep-id]` element `break-inside: avoid` and a `break-before: page` for a
hinted break, and collects the images the engine needs bytes for. It never moves
a node and never writes markup.

`KeepTogether` is what the walk sees, because `KeepTogether` is where `data-keep-id` comes
from. Outside a page context it renders unconditionally, so the PDF path — which
renders the document, not `Pages` — gets the whole document exactly once, with
no `data-keep-repeat` copies for the engine to lay out twice.

**The geometry is the engine's page margin, not padding on the tree.** A padded
root would indent the first page only; the engine reapplies its own margin to
every page. Page size and margin both come from `Paper`'s constants, so the two
outputs cannot disagree about them.

**Fonts are the same files.** `styles.css` loads `@fontsource-variable/inter`
through the bundler; `src/pdf/resources.ts` reads the same package's files
through Node's resolver. All seven subsets, not only the Latin ones: a face the
preview has and the PDF lacks renders as null glyphs on paper with no error at
all, which is exactly the silent loss this package is meant to rule out.

**The browser's preflight is restated for the engine.** The preview is a
Tailwind page, so preflight has already zeroed the user agent's margins before a
component renders. The engine has no preflight, and a `text-xs` `<h2>` measures
36 pixels there against 16 in the browser. `PDF_RESET_STYLESHEET` carries the
layout-affecting part of Tailwind v4 preflight through the engine's
`stylesheets` option. Without it the same tree lays out a tenth taller on paper;
with it the two agree to within one percent.

**Nothing degrades silently.** The engine drops a class it cannot express and
says nothing, so the PDF path checks every class against `src/pdf/tailwind.ts`
first and refuses to render otherwise. Both spellings are checked: `className`
and the engine's own `tw`, so writing `tw` directly is not a way past the list.

That list is an allow-list of what was **proved**, not a deny-list of what is
known to fail. Every family carries a representative class and the fragment that
makes it observable, and `tests/pdf-class-support.test.tsx` renders that
fragment with and without the class and fails if the bytes are identical. The
few classes admitted because their value is the one the engine already applies
are asserted byte-identical in the same file, so no entry in the list is
unverified in either direction. A utility the probe cannot show the engine
honours is excluded even when it plausibly works: text decoration (`underline`,
`line-through`), border styles (`border-dashed`), `order-*`, `align-*`,
`text-ellipsis`, `break-words`, `flex-none`, `shrink-0`, `grow-0`, and
`break-inside-*` and `break-before-*` **as classes** all probed byte-identical.
The walk applies the page-break intent as an inline style instead, which the
engine does honour.

The spacing, sizing and border-width scales are Tailwind v4's open numeric
scales rather than v3's fixed steps, because the engine honours `p-13`, `p-104`,
`gap-15` and `border-3`.

Images are checked the same way: an image with no bytes, or bytes whose
signature is not an encoding the engine decodes, is named. One error lists every
offender.

### Adapters

There is a second engine, and it is not a second call. A document that needs a
different renderer is still the same document, so `renderPdf` takes an `adapter`
option and everything an engine has no opinion about is assembled once and
handed over as a `PreparedPdfInput`: the React element, the plan, the image
bytes, the font **files**, and the page geometry.

```ts
const { bytes } = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
  adapter: "chromium", // "takumi" is the default
  images: [await proposalLogoImage()],
  plan,
});
```

**The default is takumi, and it is a choice rather than a fallback.** It is the
engine the parity numbers below were measured on and the only one that needs no
browser, so a call that names no adapter keeps reaching it whether or not a
Chrome exists on the machine.

**The Chromium adapter prints the same tree through the browser that draws the
preview.** `src/pdf/adapters/chromium.ts`, Node only. `react-dom/server` renders
the element to static markup; Tailwind v4 is compiled in Node from the package's
own `src/styles.css` against the class names that markup carries; the faces are
`@font-face` rules pointing at the files `resources.ts` names, as `file://`
URLs, with the fontsource package's own weights and unicode ranges; the page is
written to a file in the OS temporary directory and printed with `page.pdf`.

**`puppeteer` stays out of the entry.** It is an optional peer dependency, as
`tailwindcss` is, and the adapter is reached through a dynamic import.
`@paradoc/react/pdf` therefore still loads with neither installed, and a caller
who never names the adapter never pulls one in. `@paradoc/react/chromium` is the
same adapter held directly, for a caller that wants `closeChromium` or the
executable lookup; importing it is the one way to need both peers at load.

**The margin is the page box's, not the tree's.** `@page { margin: 48px }` gives
every page the preview's 48 pixel padding and a 720 x 960 content box, which is
the same decision the takumi path makes when it hands the engine a margin rather
than padding the tree. Padding on the root would indent the first page only.

**The plan is applied to the document, not to a template.** There is no resolved
node tree here, so a short script in the page does to the DOM what `tree.ts`
does to the tree: `break-inside: avoid` on every keep, `break-before: page` on a
hinted one, and the table header cloned from the header already in the page and
placed above the row that opens it. The break sits on the copy rather than on
the row, for the same reason. `unknownBreaks` and `unknownRepeats` come back the
same way. Without a plan the adapter states only that a keep is not to be
split, and Blink paginates on its own.

**Nothing is embedded that the preview does not load.** Images reach the page as
`data:` URIs built from the bytes the caller supplied, so this adapter fetches
nothing either, and a render whose faces did not load fails rather than printing
against a fallback. What it does not do is check classes against the verified
vocabulary: that list exists because takumi drops what it cannot express in
silence, and the browser is the thing the list was written against.

### Hint mode

Without a `plan` the engine paginates the tree itself. With one, every keep the
plan breaks on gets `break-before: page` and the page starts there.

**It is one option, not two.** `plan` is `Pick<PagePlan, "breaks" | "repeats">`:
the keep that starts each page from page 2 on, and that same plan's per-page
list of header copies. They are one decision, so they cannot be passed
separately. A caller handed the page starts alone would ask for a page that
opens on a continued row with no header above it, which is a page the preview
never drew.

**The copy is a copy.** A page opened on a continued row needs the table header
above it, exactly as the preview puts it there, or the two outputs differ by a
header band on every continued page. The walk translates the header node already
in the tree a second time, marks the translation `data-keep-repeat="true"`, and
puts it immediately before the keep that opens the page. It writes no markup of
its own and it moves nothing: the header keeps its one place in the flow and the
copy sits beside the row it belongs to.

**The break sits on the copy, not on the row.** A break before the row would
close the previous page after the copy, which strands the header at the foot of
the page it was meant to open. So the copy takes `break-before: page` and the
row keeps only `break-inside: avoid`.

**A copy's pagination is built, never inherited.** A header can be a planned
break in its own right, because the plan carries a header left alone at the foot
of a page forward to open the next one. That header still gets copied above a
later continued row, and the copy is given the break the plan means for it
rather than the one its source carries. A page opened by two copies breaks on
the first only.

**A hint the tree cannot honour is named.** A break naming a missing keep comes
back in `unknownBreaks` and a repeat in `unknownRepeats`; the page opens without
it and the render carries on. The lab shows both.

Measured on the overflow set: hint mode renders four pages, the four the preview
plans, opening at `line-items:13`, `line-items:39` and `line-items:65` with the
header repeated above each. Engine mode renders four pages that break on the
same three rows, so on this data the modes differ only by that header. Whether
they agree pixel for pixel is what the parity suite measures.

### The logo

The engine fetches nothing, so an image reaches it as bytes keyed by the `src`
string in the tree, while the preview needs a `src` a browser can load. The two
agree on the key rather than on the URL: `PROPOSAL_LOGO_SRC` is
`ProposalDocument`'s default and the key `proposalLogoImage()` supplies bytes
under, and the lab passes the URL Vite resolves for the same PNG as `logoSrc`.
The mark sits in the masthead row rather than above the title so it costs the
page no height, which keeps the measured budget above intact.

### The lab's PDF pane

`react-lab` renders the PDF in the dev server's Node process behind
`/api/proposal.pdf` and shows it in an iframe beside the preview. It is a
comparison viewer, not a service.

The pane's mode switch chooses who paginates. **Engine breaks** is a
`GET ?set=short|overflow`, and the engine paginates the tree. **Preview breaks**
is a `POST` carrying `{ set, plan }`, the plan the preview just published, and
the PDF breaks where the preview did. The data set travels in one place either
way: the query string for a GET, the body for a POST. The lab fetches the bytes
rather than pointing the frame at the URL, because the render reports what it
could not honour on `X-Paradoc-Unknown-Breaks` and `X-Paradoc-Unknown-Repeats`
and a frame navigating to a URL never shows a header to the page. A render that
fails comes back as the error text, so an unsupported class is readable beside
the preview that still shows it.

## The seal

The generated PDF seals through the existing core seal flow, and the signature
map resolves a box for both parties. `@paradoc/core` runs the whole flow: it
binds signers, renders the layer twice, locates the markers, checks for drift
between the two passes, flattens and hashes the canonical document. This
package supplies one thing core does not have, a converter from the layer to a
PDF, and
builds that PDF from the same tree the preview renders.

```ts
import { overflowProposalData } from "@paradoc/react/examples";
import { proposalLogoImage, sealProposal } from "@paradoc/react/examples/pdf";

const sealed = await sealProposal({
  data: overflowProposalData,
  images: [await proposalLogoImage()],
});
// sealed.signatureMap: one field per party, both on page 4
// sealed.canonicalPdfHash: sha256 of the flattened document
```

Measured on the overflow set: both fields land on page 4, the acceptance page,
at the same height, 77 by 26 points, the provider at x 36 and the customer at
x 321. `tests/seal.test.tsx` pins those numbers, so this paragraph checks itself
rather than recording one run. The short set seals both onto its one page. Two
seals of the same data give the same hash and the same map.

**Who signs.** Core binds a signer to a `Person`, never an organization, and
both of the proposal's parties are organizations. The artifact names a contact
for each — `providerContact` and `customerContact` — and `fillProposalForSeal`
binds the signer to that person while the party stays the organization. The
signature block on the page names the party through the artifact's own party
serializer, as it always did.

**The sealed document is the document.** Core's flow path renders the layer
twice: once with an invisible marker before each placeholder, once clean. The
clean pass hands the adapter core's bare placeholder, which is exactly what the
signature block draws on its own, so the canonical PDF carries the same text as
a plain `renderPdf` of the same tree. `tests/seal.test.tsx` asserts it page by
page.

**Flow placement imposes a font requirement nothing documents.** Core's marker is
eight braille codepoints. The encoding is base 4, so the eight are drawn from
four values: U+2800, U+2801, U+2802 and U+2804. The engine writes U+0000 for a
codepoint no embedded font covers, and Inter covers no braille, so with the
document face alone the marker reaches the PDF as eight nulls and
`locate` throws `Could not resolve 2 of 2 placements: provider-signature (not
found), customer-signature (not found)` with nothing naming the cause. The seal
path passes `renderPdf({ signingMarkers: true })`, which embeds the braille
subset of Noto Sans Symbols 2 as a coverage subset of the document family. The
document still names one font and its typography does not change.
`tests/seal-marker-font.test.tsx` holds the evidence and holds it alone: an
unmarked render writing nulls, a whole seal through an unmarked converter
failing with `LocateError` naming both slots and nothing about a font, and then
the same seal resolving once the face is embedded. It stands alone because the
engine's font registry is global to the process, so once any render embeds the
marker face every later render in that process can reach it. The package's
vitest config states `isolate: true` for that reason.

**A signature rule has to be text.** Core sizes a flow field from the underscore
run on the marker's line, so a rule drawn as a one-pixel border leaves the field
nothing to measure. `Signature` draws core's own placeholder — sixteen
underscores, exported as `SIGNATURE_RULE` — which is also why the clean pass and
the plain render agree.

**What the React layer still owes.** The layer is the seam's cost: the
artifact carries two lines that exist only so core has somewhere to put a
marker, and the adapter parses them back out. A component model that graduates
should be able to declare its slots on the composition itself and hand core the
positions directly, or core should accept a renderer that injects markers into a
non-text layer. Both are framework changes, and both are ahead of this package.

## Measured parity

Is a page of the PDF the page of the preview it came from? A suite answers it by
measurement rather than by assertion about the code: it starts the lab, drives
one Chrome, and compares both adapters on both sample data sets in both
pagination modes. Chrome screenshots the preview sheet and pdf.js paints the PDF
into a canvas in that same Chrome, so one rasterizer draws both sides; both are
drawn at twice the paper size and averaged down to 816 x 1056, and a pixel counts
as differing when its grayscale value moves by more than 32 of 255.

### The criteria

A page passes on four things:

1. the page count is equal;
2. the first text-bearing keep that is not a repeat is the same keep, read out of
   the PDF's own text rather than out of the plan that was sent, which would make
   hint mode a tautology;
3. once each 48 pixel band is allowed to slide vertically, under **five percent**
   of the page still differs; and
4. no band had to slide more than **eight pixels** to find its counterpart,
   measured over inked bands only, and failing if the search saturates at its own
   12 pixel limit.

Criteria 3 and 4 replace the specification's original "under one percent of a
page's pixels differ", which this suite measured and found unusable on a text
page: moving a preview down a single pixel and comparing it with itself already
differs by 6.06%, so a one percent budget says "nothing moved" rather than
anything about layout. The argument, the control that demonstrates it and the
per-page figures behind it are in
`_docs/architecture/react-document-composition-spike.md`.

Hint mode is asserted against all four criteria, for both adapters. Engine mode
is recorded and not asserted: neither engine repeats a table header, so a
continued page sits a header band high, and Blink was never asked to land on the
preview's page starts.

### The numbers

takumi, the default:

| Set and mode      | Pages | First keeps | Worst residual | Worst drift | Passes   |
| ----------------- | ----- | ----------- | -------------- | ----------- | -------- |
| short / engine    | 1 = 1 | all match   | 2.17%          | 2 px        | recorded |
| short / hint      | 1 = 1 | all match   | 2.17%          | 2 px        | yes      |
| overflow / engine | 4 = 4 | all match   | 9.45%          | 12 px       | recorded |
| overflow / hint   | 4 = 4 | all match   | 4.45%          | 6 px        | yes      |

Chromium, experimental, measured against the same criteria with nothing loosened:

| Set and mode      | Pages | First keeps | Worst residual | Worst drift | Passes   |
| ----------------- | ----- | ----------- | -------------- | ----------- | -------- |
| short / engine    | 1 = 1 | all match   | 1.99%          | 0 px        | recorded |
| short / hint      | 1 = 1 | all match   | 1.99%          | 0 px        | recorded |
| overflow / engine | 4 = 4 | all match   | 8.74%          | 12 px       | recorded |
| overflow / hint   | 4 = 4 | all match   | 3.47%          | 0 px        | yes      |

**Hint mode is the mode that reaches parity, on both engines.** Chromium's
hint-mode drift is zero on every page and its residual is its raw difference,
which is the two rasterizers and nothing else: the two layouts are the same
layout to the pixel. takumi's extra 1 to 6 pixels are its table row pitch, 36.0
against the browser's 35.75, accumulating about a quarter of a pixel a row. That
pitch is a property of the engine and this package cannot change it.

**Neither engine is under one percent on any page**, including the case with no
layout difference left in it at all. That is the evidence the clause was
replaced on.

### Where it runs

Not in `pnpm test`. It needs a Chrome and it starts a dev server, so it has its
own config and its own script.

**It measures the built package**, because the lab imports `@paradoc/react`
through the export map the way any consumer does. Run it through the task graph,
which builds first:

```sh
pnpm turbo run test:parity --filter=@paradoc/react
```

`pnpm --filter @paradoc/react test:parity` runs the same suite against whatever
`dist/` already holds, which is what a CI job that has just built the package
wants and is a trap anywhere else.

**It runs from the monorepo only.** The lab is a comparison viewer on a dev
server, so it is not part of the published surface and does not exist in the
public repository. The suite says so rather than failing obscurely.

Chrome comes from `PUPPETEER_EXECUTABLE_PATH` or from a well-known install path;
nothing here downloads a browser. The Chromium adapter's own tests are in `pnpm
test` and **fail** where there is no Chrome, because a suite that skipped on its
own subject would cover nothing quietly; set `PARADOC_SKIP_CHROMIUM_TESTS=1` to
opt out of that file deliberately.

**The parity numbers are not regression-checked.** Nothing in CI re-measures
them yet, and `parity/parity-report.json` is gitignored, so there is no committed
figure to compare a later change against. The numbers above are the record: they
were measured on the commit that added them, and a change to the document, the
components or the engine pin invalidates them until someone runs the suite again.

## Running it

```sh
pnpm --filter @paradoc/react test    # component, artifact, plan, pagination, PDF and seal tests
pnpm --filter @paradoc/react build   # tsup to dist/, which consumers resolve through
```

The parity suite is not in that list. It drives a browser against a lab that
lives in the private monorepo, so it runs there and not from this repository:
see "Where it runs" above.
