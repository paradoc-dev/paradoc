# @paradoc/react

Compose a document from React components bound to a Paradoc form artifact. One
tree is the source of truth for both outputs: a paginated document on screen,
and the PDF that document renders to.

```sh
pnpm add @paradoc/react
```

Seven entries, because they need different things of the machine they run on:

| Entry                         | Runs   | Holds                                                              |
| ----------------------------- | ------ | ------------------------------------------------------------------ |
| `@paradoc/react`              | Either | The components, the document context, the plan, the preview.       |
| `@paradoc/react/pdf`          | Node   | `renderPdf`, the adapter seam, the default engine, the layer renderer. |
| `@paradoc/react/chromium`     | Node   | The experimental Chromium adapter.                                 |
| `@paradoc/react/check`        | Node   | `checkComposition`: the same tree walk, without rendering a PDF.   |
| `@paradoc/react/discovery`    | Node   | The conventions binding a composition to its artifact and its sample. |
| `@paradoc/react/examples`     | Either | Sample material: two documents, their artifacts, data and token sets. |
| `@paradoc/react/examples/pdf` | Node   | The proposal's logo bytes and seal wiring.                          |

**The two `examples` entries are sample material, not a stable API.** They ship
two worked documents so the pagination tests, the class probe suite and the
parity suite have real documents to measure, and so a reader has a whole
composition to copy from rather than a fragment: a services proposal, and a
short Arabic order-confirmation letter written right to left. Anything under
`examples` may change without a major version. Nothing under it is framework
surface, and nothing in the framework entries depends on it.

`@paradoc/react/styles.css` carries the document's typefaces and the custom
property that selects between them. Import it once, beside your own stylesheet.

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
| `Signature` | One signing block: a party, a field type, and the seal's marker.   |
| `Paper`     | Shows the document at paper width, scaled to fit its container.         |
| `Part`      | One document of a packet, with its own pages and its own numbering.     |
| `PdfPages`  | A PDF part of a packet, painted page by page.                           |
| `Attachment`| A part the packet carries rather than paints.                           |

`Bundle` and `Document` also take `tokens`, which is where a tenant's branding
enters. See [Branding](#branding). `Part`, `PdfPages` and `Attachment` are how a
bundle becomes a sequence of documents in one scroll. See [Packets](#packets).

## The registry

The components are also published as a shadcn registry, so a consumer installs
the source rather than importing a sealed component:

```sh
npx shadcn@latest add @paradoc/field   # or: para add field
```

The file lands in `components/paradoc/` and is theirs to edit. What stays in this
package is what is not a design decision: the document, page, token and signing
contexts, the page plan, the measuring pass, the token resolution, the
serializer-backed formatter. An installed
file imports that from `@paradoc/react`, and a sibling item from
`@/components/paradoc/<name>`, so editing an installed `keep-together` changes
the installed `field` that uses it while nothing can fork the contexts. That last
part matters: a copied context is a different context, and a `KeepTogether`
reading its own copy would never see the page `Pages` is rendering.

`pnpm registry:build` emits it from `scripts/registry/manifest.ts` and the
component sources into `paradoc/apps/docs/public/r/`, which the docs site serves
at `https://docs.paradoc.dev/r/{name}.json`. The output is committed and never
hand-edited; `tests/registry-generator.test.ts` regenerates it and fails on a
difference.

The generator's one real job is rewriting imports, and it is checked rather than
hopeful: a binding it would route to `@paradoc/react` must appear in `src/index.ts`,
an import form it cannot read is an error, a sibling item the manifest did not
declare is an error, and an npm package a file imports that the item does not
declare is an error too (`react` is the one exception, and the manifest says so).
That is what keeps it from shipping the failure this format invites — files that
carry their authoring paths, install cleanly, and do not compile.
`tests/registry/install.test.ts` proves the whole claim end to end: it serves the
registry, runs the stock shadcn CLI against a scratch project, and type-checks
what lands. The one thing it stubs is the package manager, which it records and
asserts rather than runs, because whether npm can fetch a published package is
not what the suite is about.

Every `@paradoc/*` dependency is emitted at this package's own version, read from
`package.json`, so the pin follows the lockstep release without anyone
remembering to move it. An installed component is written against one substrate;
a bare package name would hand a consumer whatever `latest` happened to be the
day they ran the install.

Two things to know about the emitted files. The shadcn CLI drops everything above
a file's first import, so the generator moves each module's opening comment below
the imports, where it survives. And a component's module comment is the only thing
that moves: everything else is the source verbatim.

Adding a component means adding it to the manifest. The generator will not infer
one, because a component is not a file here — `paper.tsx` carries `Paper`, `Sheet`
and `useFitToWidth`, and the context modules carry no component at all.

A manifest file names its own path, shadcn type and install target rather than
having them derived. A component takes all three from the `component()` helper,
but a block does not: it is an artifact's JSON, a composition that binds it and a
module of sample data, and those three are not the same kind of file and do not
land in the same place. Two consequences the generator already handles: a
relative import of a JSON artifact resolves, and one file of an item names
another by where the two land rather than by how they were authored, so an item
whose files install to different directories still compiles. A file that is not
code is shipped verbatim.

The forms it reads are named, default, namespace and side-effect imports, and
named re-exports. A default or namespace clause pointed at the substrate is an
error rather than a rewrite, because `@paradoc/react` exports names and nothing
else.

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
resolves, so a page break never reflects a fallback face. The preview measures
again after every render and when the measuring container resizes, and keeps the
previous plan object unless the measurement moved something. Prop identity is
never read, so a host that passes an inline object, or that sets state from
`onPaginate`, still gets one plan and keeps its sheets mounted.

## Two constraints that shaped the design

**No `<table>`.** The default PDF engine has no table support, so
`Table` renders flex rows. A document that used real table markup on screen could
not be the same tree the PDF renders.

**One paper per document, declared once.** The page furniture takes no geometry
props and never has: `Paper`, `Pages` and `Sheet` draw the paper the *document*
chose, which it declares in its tokens and which both outputs read. Unbranded
that is US Letter at 96 dpi (816 x 1056 CSS pixels) with a 48 pixel margin,
still exported as constants. What a caller must not be able to do is set the
paper on one side only, and stating it on the document rather than on the
furniture is what rules that out. The sheet keeps its full width at every window
size and only a CSS transform changes, so line wrapping on screen is the
wrapping the PDF will have.

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

An unbranded page holds `PAGE_CONTENT_HEIGHT_PX`, which is 960 pixels once both
margins are taken; a branded one holds whatever its own paper and margin leave.
Measured in the lab at a 1280 pixel window, unbranded:

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

The Arabic letter has one data set, `arabicLetterData`: 26 rows of schedule,
which the preview plans onto two pages of US Letter breaking at `items:14`. It
overflows on purpose. A single-page right-to-left document would say nothing
about pagination in a right-to-left document, and the questions worth measuring
are whether both sides break on the same row and whether the repeated table
header comes back on the right edge of the continued page.

## The React layer

An artifact points at a composition with a file layer whose MIME type is
`text/tsx` or `text/jsx` and whose path names the module. Like every layer path,
it is **relative to the artifact file that declares it**.

```ts
layers: {
  composition: {
    kind: "file",
    mimeType: "text/tsx",
    path: "purchase-order.tsx",
  },
},
```

The layer is a pointer and nothing more. Core does not read the file, does not
execute it, and does not depend on React: it selects a renderer by the layer's
MIME type and hands it the path and the layer key. An **inline** layer of either
type is rejected at validation, because source where a pointer belongs is not a
document. MIME types compare without regard to case, so `TEXT/TSX` is the same
layer, and validation and dispatch read it the same way.

Registering the renderer is one line at the render call.

```ts
import { reactLayerRenderers } from "@paradoc/react/pdf";
import { PurchaseOrder } from "./orders/purchase-order";

const pdf = await order.render<Uint8Array>({
  layer: "composition",
  renderers: reactLayerRenderers({
    components: { "purchase-order.tsx": PurchaseOrder },
    pdf: { images: [logo] },
  }),
});
```

It is registered by the caller rather than inside `@paradoc/render` because this
package depends on `@paradoc/render`; registering there would be a cycle.
`reactLayersOf(artifact)` in `@paradoc/core` reports which layers need one.

The renderer binds the module two ways, in this order:

1. a `components` map keyed by the layer's path or by its key, which is what a
   bundled application uses;
2. an import of the module the path names, resolved against `baseDir`, taking
   the module's `default` export.

A path neither covers fails with `UnboundReactLayerError` naming the path and
both options. A React layer with no renderer registered fails from core with
`UnregisteredLayerRendererError` naming the layer and the `renderers` option.

**Import binding executes the module the artifact names.** That is what it is
for, and it is worth stating plainly: an artifact is data, and this is the one
place data becomes code. So the path is confined. It must be relative and it
must resolve inside `baseDir` — an absolute path, or one that climbs out, is
refused rather than loaded. Set `baseDir` to the artifact file's own directory.
If you do not control the artifact you are rendering, bind through `components`
and leave `baseDir` unset.

Nothing here compiles TypeScript. Importing a `.tsx` module works where the
runtime already transforms one; elsewhere point the layer at built JavaScript,
or use the `components` map. The error says so when Node refuses the extension.

The composition receives `{ artifact, data }`, so a component written for the
direct call renders unchanged through the layer.
`tests/react-layer.test.tsx` hashes both and asserts they are the same bytes.

## The sample's one layer, and it describes no layout

The React tree is the only description of this document's layout, which is the
specification's central invariant. A markdown or PDF layer beside it would be a
second one, so there is no layer beside it.

`composition` is the React layer: MIME type `text/tsx`, the path
`proposal-document.tsx` beside the artifact file, no text and no bindings. It is
also the seal target and the default layer. It declares a flow-placed signature
slot per party, and a slot names only the party role it binds to:

```ts
signatures: {
  "provider-signature": { party: { role: "provider" }, type: "signature", placement: "flow" },
  "customer-signature": { party: { role: "customer" }, type: "signature", placement: "flow" },
}
```

Where those signatures land is the composition's business. The seal hands the
layer's renderer one marker per slot, keyed by slot id, and each `Signature`
block finds its own by naming the party and the field type it draws, then writes
it in front of its rule. Nothing describes a position twice.

A block draws one slot, so a party that signs and initials is two blocks:

```tsx
<Signature party="tenant" />
<Signature party="tenant" type="initials" />
```

A party may carry one flow slot per field type. Two of a type on one party is an
authoring error, and the lookup fails with `AmbiguousSigningMarkError` naming
both rather than guessing which block is which.
`tests/seal-two-slots.test.tsx` seals that shape end to end.

## A path that does not resolve is a fault

`resolveField` throws `UnknownFieldPathError` naming the path and the form. A
typo in a composition is a bug, not a blank value, and rendering it as an em dash
would hide it until someone read the finished document.

## Checking a composition without rendering it

`@paradoc/react/check` walks the same tree the takumi adapter walks and reports
what a render would refuse, without producing PDF bytes:

```ts
import { checkComposition } from "@paradoc/react/check";

const result = await checkComposition({ artifact: invoiceForm, composition: Invoice, data });
// { unsupportedClasses: [], unresolvedPaths: [], missingImages: [] }
```

An unresolved `Field`/`Table` path or `Signature` party role would otherwise
throw from inside that component's own render, before the rest of the tree
can be walked. `checkComposition` runs the composition in a check mode that
records each one instead and keeps going, so a composition with several faults
of different kinds — an unsupported class and an unresolved path, say — is
reported for all of them in one call rather than only the first one reached.
`unsupportedClasses` is checked against `takumi`'s verified vocabulary by
default; pass `adapter: "chromium"` to skip it, since a real browser accepts
whatever CSS the tree produces. This is what `para check` runs.

`checkElement` takes an element that is already built, for a caller whose React
has to be its own: `para dev` compiles a composition through the project's Vite
and builds it there, then hands the element over.

## Finding what to check, and what to preview

`@paradoc/react/discovery` holds the conventions that connect a composition to
its artifact and its sample. Two commands read them — `para check` checks one
composition, `para dev` previews every one it finds — and the rules live here so
that a composition which previews is a composition which checks.

| Question | Rule |
| --- | --- |
| What is a composition | A `.tsx` or `.jsx` file under a `compositions/` directory, anywhere in the project. Its default export is the component. `*.sample.*`, `*.test.*`, `*.spec.*` and `*.stories.*` sit beside one without being one. |
| Which artifact renders it | The form artifact whose file layer of MIME type `text/tsx` or `text/jsx` resolves to that file, the layer path being relative to the artifact that declares it. Failing that, an artifact file of the same name beside it — `purchase-order.tsx` next to `purchase-order.yaml` — so a composition written before its layer entry still resolves. |
| Where its sample data comes from | A sibling `<name>.sample.{ts,tsx,js,mjs,jsx}`, whose `default` export is the data, before a `sample` export on the composition module itself. The sibling wins because it is the only one of the two that can be seen without loading a module. |

`discoverCompositions(root)` answers for a whole project;
`findCompositionArtifact`, `siblingArtifact` and `sampleSources` answer for one
composition. None of them loads a module: running the project's code stays with
the caller that has a loader for it.

An artifact is matched loosely, on `kind: form` alone, and held to the schema
only once it has been matched. Validating every candidate would make a broken
artifact indistinguishable from a YAML file that was never one, and the
composition it declares would be reported as unpaired rather than as pointing at
something broken.

## Known limitations

Accepted as they are. The full record of how each was found, with the
measurements behind it, is in `_docs/architecture/react-document-composition-spike.md`.

**In the framework packages.**

- **No list aggregate in the expression language.** `defs` can index a list and read its length, but there is no `sum`, `map` or `reduce`, so a subtotal cannot be written as an expression. The example artifact materializes one into a hidden field instead.
- **No serializer for booleans or enums.** `isSerializableFieldType` now covers every scalar and composite primitive that has one meaning across an artifact — money, address, phone, person, organization, party, coordinate, bbox, duration, identification, attachment, signature, date, datetime, time, number, and percentage. Booleans, enums, and multiselects have no registry entry, because their display depends on the field definition itself (an enum's label, a multiselect's join), not on the value alone, so `createValueFormatter` still formats those three from the field definition directly. There is also no published `(artifact, path, value) => string` helper, and `getFieldType` does not descend into `list.item`, so `resolveField` walks the schema itself.
- **The phone serializer does not localize.** It returns the E.164 string verbatim. That string has no direction of its own, so `Field` isolates a `phone` or `identification` value in a right-to-left document rather than changing what the serializer produced; see "Right to left".
- **Flow placement needs braille coverage in the renderer's fonts, and core says so nowhere.** A renderer whose fonts do not cover core's four marker codepoints loses the marker in silence, and core's own failure is `locate` reporting every slot "not found". The React renderer embeds a braille face on any pass that carries a marker and verifies the marker reached the PDF, so the failure names the slot and the cause; nothing makes core say it.
- **A flow slot is sized off an underscore run**, so a signature rule drawn as a border gives the field nothing to measure. `Signature` draws core's own placeholder.
- **Core does not export that placeholder.** `SIGNATURE_RULE` is a second copy of a private constant; a test catches core changing it, but nothing prevents it.
- **`Signer.person` is always a `Person`**, so an organization party cannot sign. A composition has to name a contact person.
- **A form payload and the components' data do not line up.** `DocumentData` holds `Record<string, unknown>` because a component is given a path as a string; `fill` takes a payload core infers from the artifact. Nothing published bridges the two.
- **`Signature` takes an index but the sample declares one party per role.** A marker names its party's role and index, so a role admitting several parties works as soon as the artifact declares a slot per index; the sample has none to exercise it.

**In the default engine.**

- **It applies user-agent margins the browser has already reset.** `PDF_RESET_STYLESHEET` restates Tailwind's preflight for the engine; without it the same tree lays out a tenth taller on paper.
- **A corrupt image body fails inside the engine, not before it.** The PDF path checks an image's signature, so bytes of an undecodable format are named before the render; a valid signature over a corrupt body is not, and the engine's own error does not name the `src`.
- **The engine-paginated PDF does not repeat the table header.** The engine offers no per-page header option, so this is an engine-mode difference: hint mode copies the header itself.
- **The font registry is global to the process.** Once any render embeds the marker face, `signingMarkers` is advisory for every later render in that process, which is why `tests/seal-marker-font.test.tsx` stands alone and the vitest config states `isolate: true`.
- **It does not initialize itself in the browser.** `takumi-pdf` exports no `browser` condition, and a second initialization on one page faults. PDF rendering is Node only.
- **It has no `direction`.** It shapes Arabic and it reverses a flex main axis for `dir="rtl"`, but an inline run in a block box starts on the left edge whatever the document declares, and `direction: rtl` is dropped from both inline styles and stylesheets. So it declares `directions: ["ltr"]` and refuses a right-to-left document by name. See "Right to left".

**In this package.**

- **The date rule beside a signature is drawn as underscores too.** Nothing places a slot on it; it matches the signature rule for consistency. Whether a signing block should draw rules as text at all is still open.
- **A section heading can end a page.** The orphan rule covers table headers only, so a heading can be the last keep on a page with its content on the next.
- **The lab's PDF endpoint answers any HTTP method** and validates nothing it is sent. It is a comparison viewer on a dev server, and it is not published.
- **A PDF's text layer does not round-trip a shaped script.** Both engines write Arabic as contextual presentation forms in visual order with no map back to the characters the document was written in, so the parity suite's first-keep criterion cannot be read on the Arabic letter and the suite asserts that finding instead. This is a property of PDF text extraction rather than of either engine, and nothing in this package can change it.
- **No parity coverage of a right-to-left bundle.** A `Bundle` takes `dir` and `lang` like any other root and renders a packet right to left; every parity variant is a single document, so the page sequence across documents in a right-to-left script is measured nowhere.
- **`Table`'s `align` is physical.** `left` and `right`, not `start` and `end`, so a right-to-left composition states the physical edge it means. Logical alignment would be the better API; it was left out for scope, not because anything here prevents it.
- **The script check knows four scripts.** `DOCUMENT_SCRIPTS` covers Latin, Cyrillic, Greek and Arabic, which is what the registered families carry. A document in a script no family here carries — Han, Devanagari — is not reported, because naming a failure this package has no remedy for would say nothing useful. It still reaches paper as null glyphs.

## The typeface

`@paradoc/react` owns the document, so it owns the fonts. It declares each
family as a dependency, imports every one of them from
`@paradoc/react/styles.css`, and describes each in one registration —
package, subsets, weights and CSS stack — that the preview and the PDF both read.
Consumers import that stylesheet rather than declaring a family themselves, so
the preview and the PDF embed the same files.

Three families are registered:

| Family                    | Named by              | Scripts            |
| ------------------------- | --------------------- | ------------------ |
| `Inter Variable`          | `DOCUMENT_FONT_NAME`  | Latn, Cyrl, Grek   |
| `Source Serif 4 Variable` | `SERIF_FONT_NAME`     | Latn, Cyrl, Grek   |
| `Noto Sans Arabic Variable` | `ARABIC_FONT_NAME`  | Arab, Latn         |

A document chooses between them with the `fontFamily` token.

**A family that is not registered fails the render, naming it.** Not falling back:
the browser would substitute something and the engine would write null glyphs,
and the two would be different documents with no error between them.
`UnregisteredFontFamilyError` names the family asked for and lists the ones the
package carries files for.

**A registered family that does not carry the document's script fails the same
way, one level down.** A registration declares the scripts it has glyphs for, as
ISO 15924 codes, and the `lang` token decides which one the document needs —
`Intl.Locale` maximizes the tag rather than this package carrying a table that
would drift from the CLDR. An Arabic document set in Inter is null glyphs on
paper and a browser substitution on screen, so `UnsupportedScriptError` names
the script, the family, and the family that would work. It is thrown while the
tokens resolve, which is the one place both sides pass through.

**The tag is a declaration, so the text is checked too.** A composition that
names no language is set in Inter by default and fails nothing — and if it is
Arabic anyway, every letter of it is a null glyph on paper. So the same error is
raised from the document's own text, on both sides and from different vantage
points: the document root reads the artifact's labels and the data's values in
one memoized pass as it resolves, and the PDF path's tree walk reads every text
node after the components have run, which is the last place the resolved text
exists before an engine sees it. `scriptsIn` decides what a string is written in
with Unicode property escapes, so the codepoint-to-script mapping is the
runtime's rather than a table here.

Registering a fourth is a package change — a dependency, an `@import` in
`styles.css`, an entry in `DOCUMENT_FONT_FAMILIES` — because the files have to
travel with the package for the PDF to embed them. It is also a build-size
decision: `styles.css` cannot be conditional, so every registered family's faces
are in the stylesheet every consumer imports, whether or not any document names
it. The three registered families are about 480 KB of woff2 across their
subsets. Weigh a fourth against that rather than adding one because a document
asked for it.

**Every subset the stylesheet loads is embedded, including the ones a script
does not obviously need.** Noto Sans Arabic ships `math` and `symbols` faces
alongside `arabic`, `latin` and `latin-ext`, and the package's own stylesheet
loads all five. The set has to match, or a codepoint the preview reaches is a
null glyph on paper with no error at all.

**The preview waits for the faces, not for the font set.**
`document.fonts.ready` is a promise about the faces the page has *already* asked
for, so on a cold page it is resolved before layout requests a single glyph and
a plan measured behind it is a plan of fallback glyphs. `Pages` therefore calls
`document.fonts.load` for the resolved family, gated on `document.fonts.check`,
and awaits `ready` after that. This was a real failure rather than a precaution:
the parity job was red on a cold CI runner while every local run passed, with
page 1 measuring 7.73% ink against the 6.40% the same document measures once the
face is there.

**The request names a letter per script, because the default names a space.**
`document.fonts.load(font)` defaults its text to `" "`, and a fontsource family
is one face per subset with its own `unicode-range`: a space is answered by the
Latin face alone, so a default-text request leaves every other face of the
family unloaded — including the Arabic one, which is the only face an Arabic
document is measured against. `scriptProbeText` therefore builds the text from
the registration's own `scripts`, one representative codepoint each
(`DOCUMENT_SCRIPTS`), so the browser loads every face the document could reach.

**The weight list is this package's, not the faces'.** `DOCUMENT_FONT_WEIGHTS`
is 400, 500 and 600 — the default, `font-medium` and `font-semibold`. Every
registered family is variable and its one file per subset serves the whole
declared range, so the three requests resolve to the same files and the second
and third cost nothing; the list exists because the browser matches a *request*
against the faces it has. A weight added to a component belongs in it, or the
preview measures that weight before it arrives.

**The browser reaches the family through a custom property.** `styles.css` sets
`font-family: var(--paradoc-font-family, <the Inter stack>)` on
`.paradoc-document`, and the document root and the page furniture write that
property from the resolved tokens. The PDF reaches the same files through the
engine's own font registry instead. One family name, two mechanisms, stated
once.

## Branding

A document carries a small set of tenant tokens, supplied at its root and
overridable per render:

| Token         | Default              | What it changes                                          |
| ------------- | -------------------- | -------------------------------------------------------- |
| `fontFamily`  | `Inter Variable`     | The faces both outputs embed, and the browser's stack.   |
| `accentColor` | none                 | Section headings, and the rule above the emphasised total. |
| `pageSize`    | `letter`             | The sheet: `letter` (816 x 1056) or `a4` (794 x 1123).   |
| `marginPx`    | `48`                 | The margin on all four sides of every page.              |
| `logo`        | none                 | The organization's mark, as bytes or as a source string. |
| `dir`         | `ltr`                | Which way the lines run, as HTML's `dir` means it.       |
| `lang`        | `en`                 | The language, as HTML's `lang` means it. Decides the script. |

**The script is a token, and that is a deliberate widening of what a token is.**
Direction and language are not styling. They are the other thing tokens are for:
values both outputs have to resolve identically before either draws, whose
disagreement is invisible in each output on its own. A page laid out left to
right in the browser and right to left on paper is two documents, and so is one
whose typeface carries no glyphs for its script. Making them tokens is what
gives them the machinery the typeface already had — one resolution read off the
element, the root-only rule, `RootTokenMismatchError` for a composition that
hides them, and the render override — instead of a second, parallel way to say
the same thing.

The document root writes `dir` and `lang` onto its own element, exactly as HTML
carries them, but **only when they are not the defaults**: stamping
`dir="ltr" lang="en"` onto every document that never asked about its script
would change the node tree and the bytes of every rendered PDF to say what they
already said.

```tsx
<Bundle tokens={tokens}>
  <Document artifact={purchaseOrder} data={data}>…</Document>
</Bundle>
```

**A fresh token object costs nothing.** `Pages` re-measures after every commit
and replaces its plan only when the measurement differs, so an object literal in
a component that re-renders does not repaginate the preview. The paper is
re-resolved from the element on each render and compared by value for the same
reason.

**They are declared on the document, and everything above reads them off the
element.** `Bundle` and `Document` both take them and a document layers its own
over the bundle's, field by field. The page furniture and `renderPdf` sit above
the document and cannot be handed anything by a descendant, so both call one
pure function, `documentTokensOf(element)`, which walks the element it was given
and reads the `tokens` prop of the first root it finds. Nothing is rendered to
find out, nothing travels upward, and the very first render is already on the
right paper, in the browser and in a static render alike.

A root is `Document`, `Bundle`, or **any element whose `tokens` prop is shaped
like a token set**. That second clause is what lets a composition forward them:
`<PurchaseOrder tokens={t} />` declares the paper even though the walk cannot see
the `Bundle` inside it. The shape test keeps an unrelated third-party `tokens`
prop out of it; one that happened to hold only keys this package defines would
still collide, and a composition in that position should take the tokens as its
own prop and forward them.

**The walk never calls a component.** It walks the children a component was
*given*, which are already-built elements, so a wrapper — an error boundary, a
`memo`, someone else's provider — is transparent. What it does not follow is
what a component *renders*.

**Paper, typeface and script are declared once, at the root.** A `Document`
inside a `Bundle` that sets `fontFamily`, `pageSize`, `marginPx`, `dir` or
`lang` fails with `NestedPaperTokenError` naming the token: a bundle is one
sequence of pages in one typeface running one way, and both outputs read that
one declaration. A nested document may still set `accentColor` and `logo`, which
are its own.

**A composition that hides its tokens fails loudly.** A composition that sets its
own tokens *inside* itself is invisible to whatever is drawing it. So the
document root compares every root-only token — `pageSize`, `marginPx`,
`fontFamily`, `dir` and `lang` — against what the furniture or the render
resolved, and throws `RootTokenMismatchError` naming the one that disagrees.
This is why the sample Arabic letter takes `arabicLetterTokens` as a prop rather
than declaring the Arabic family inside itself.

The check runs on **both** sides: `renderPdf` supplies the same context `Pages`
and `Paper` do. It has to, because that hidden-token shape is exactly what a
React layer renders — the renderer builds the composition from an artifact and
its data with no `tokens` prop at all — and because the typeface is the token
whose loss is invisible: a PDF with the serif silently dropped is byte-identical
to one that never asked for a serif.

Two document roots handed to one `Pages` fail the same way, with
`MultipleDocumentRootsError`: wrap them in a `Bundle`, which is one root holding
many documents.

**A render may override them.** `renderPdf(element, { tokens })` layers one
tenant's set over whatever the document declares, so the same composition renders
branded without being rewritten. The override is a layer, not a replacement: a
render that names only the accent keeps the paper the document chose.

`TokenOverrideProvider` is the preview's equivalent of that option. Put it above
the page furniture and it brands whatever document is below it, exactly as the
render option does:

```tsx
<TokenOverrideProvider tokens={tenant}>
  <Pages>
    <PurchaseOrder data={data} />
  </Pages>
</TokenOverrideProvider>
```

**Every token is checked before a renderer sees it.** An accent that is not a CSS
colour, a page size that arrived from a database as a string, a margin that is
not a whole number of pixels or that leaves no content box on its own paper: each
fails with `InvalidDocumentTokenError` naming the token. An engine handed a value
it cannot read drops the declaration and says nothing, which is the loss this
package exists to rule out.

**The defaults are the document this package rendered before there were tokens.**
The four reference outputs hash byte for byte to what they hashed before, which
is what makes every token comparison mean something: the same document with the
same tokens renders the same bytes, so a difference is the token.

**The accent is an inline style, not a class.** It is an arbitrary colour and the
PDF path admits only the palette classes it has verified against the engine;
inline style is what both the browser and the engine honour for a colour neither
knew about when the document was written.

**A4 is rounded to whole pixels.** 210 x 297 mm is 793.70 x 1122.52 CSS pixels at
96 dpi, and `PAGE_SIZES.a4` states 794 x 1123. The preview lays out on a pixel
grid, so a fractional sheet would put the two outputs a subpixel apart on every
page; the rounding is at most half a pixel, well inside the parity suite's own
eight pixel drift limit.

**The mark is bytes or a source.** Bytes become a `data:` URI, which is the one
image source neither the browser nor an engine has to fetch. A composition places
it: `useDocumentTokens()` returns the resolved set, and the sample's
`ProposalMark` is a component of its own precisely so it can call that hook
below the `Document` that supplies them.

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

**An adapter declares the writing directions it was measured to lay out**, and
`renderPdf` refuses a pairing it cannot make rather than producing a document
that merely looks wrong. takumi declares `ltr`; Chromium declares both. See
**Right to left** below for what that was measured on.

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

### Right to left

`@paradoc/react/examples` ships an Arabic order-confirmation letter —
`ArabicLetterDocument`, `arabicLetterData`, `arabicLetterTokens` — set in
`Noto Sans Arabic Variable` with `dir="rtl"` and `lang="ar"`. It is a second
document rather than a translated proposal, because a translation would share
the first document's geometry and prove only that the words changed.

It is composed from the same components as everything else. The only thing it
states that a left-to-right document does not is its column alignment:
`Table`'s `align` is physical, so the description column asks for `right` — the
edge a right-to-left row starts at — and the figures ask for `left`. Writing
that out is what makes both engines agree about it rather than each resolving
`start` for itself.

**takumi cannot lay a document out right to left, and it says so by name.** This
was measured, not assumed. The engine does two of the three things:

- it shapes Arabic correctly, joining and reordering a run into visual order;
- it reverses a flex container's main axis for `dir="rtl"`, so a table row's
  columns do come out in the right order;
- but it has **no `direction` property**. `direction: rtl` in an inline style or
  a stylesheet is dropped, and `dir` is not inherited by a box that does not
  carry it, so an inline run in a stretched block starts on the left edge
  whatever the document says. `text-start` renders byte-identical to
  `text-left`, which is the same fact from the allow-list's side.

A document whose columns are right to left and whose every line is still
left-aligned is worse than a refusal, so the takumi adapter declares
`directions: ["ltr"]` and `renderPdf` throws `UnsupportedDirectionError` naming
the adapter, the direction and the script. The parity suite asks it for the
letter every run and records the refusal in `parity-report.json`, so the claim
is a result rather than a note.

**Chromium lays it out, and it is measured against the same four criteria with
nothing loosened.** It is Blink, which is the engine that drew the preview, so
the same code lays out both sides. The numbers are in **The numbers** below.

**One criterion is read differently on it, and the suite says how.** A page is
normally identified by reading the first keep out of the PDF's own text. Shaped
Arabic does not survive a PDF text layer: both engines write the contextual
presentation forms in visual order, and neither maps them back to the characters
the letter was written in, so `pdfjs` reads `العالمب  اب مرح` where the document
says `مرحبا بالعالم`.

The figures beside them do survive, so the criterion is read from those instead.
`digitTokens` reduces a keep and a page to the numbers they carry — `1,850.00`
stays one token — and a page opens on the keep whose tokens are the page's first
tokens, compared as a multiset because a right-to-left row may report its own
figures in a different order from the one the tree wrote them in. A repeated
table header carries no figures, so it is read past without a rule of its own.
Page 2 of the letter names `items:14` on both sides, out of the file rather than
out of the plan that was sent, which is the whole point of the criterion.

The finding is still asserted rather than assumed: every page of every run
records `pdfFirstKeepByText`, and the Arabic run's are all null. The day an
engine round-trips the script, that assertion fails and the variant goes back to
matching on words.

**Latin digits are what makes an amount searchable in the file.** The
`ar` serializer registry pins `ar-u-nu-latn`, so figures reach the PDF intact
even though the Arabic around them does not. See `@paradoc/serialization` for
why that registry chose Latin digits over Arabic-Indic. It is also what lets the
parity suite still name the keep a page opens on: see **The numbers** below.

**A value with no direction of its own is isolated, in the component.** A phone
number in E.164 and an identification number are runs of digits and punctuation,
which the bidirectional algorithm gives no strong direction: inside a
right-to-left paragraph it resolves them against the paragraph and moves the
leading `+` to the visual end, so `+966112345678` reads as `966112345678+`. The
value is not wrong, its direction is, so `Field` wraps a `phone` or
`identification` value in `direction: ltr; unicode-bidi: isolate` — the
`paradoc-ltr-isolate` class for the browser and the same rule inline for a
renderer that reads no stylesheet of ours. It is not a serializer change:
`stringify` still returns the same E.164 string. And it is applied only where
the document runs right to left, so no left-to-right document's tree, or bytes,
changes at all.

**A right-to-left packet works; nothing measures one.** `dir` and `lang` are
root-only tokens and a `Bundle` is a root, so a bundle carries them and writes
them onto its own element exactly as a `Document` does — a packet of
right-to-left documents renders. What does not exist is coverage: every parity
run is a single document, so a bundle's page sequence in a right-to-left script
is untested rather than unsupported.

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

A tenant's own mark arrives as the `logo` token instead, and wins: `ProposalMark`
reads it from `useDocumentTokens()` and falls back to `logoSrc`. Bytes become a
`data:` URI, which carries its own image and needs no `images` entry at all.

### The lab's PDF pane

`react-lab` renders the PDF in the dev server's Node process behind
`/api/document.pdf` and shows it in an iframe beside the preview. It is a
comparison viewer, not a service.

The header's document switch chooses which sample is on screen. The proposal's
data set, token set and serializer registry are offered only while the proposal
is showing: the Arabic letter has one of each, and a control that could not
change it is not drawn.

The pane's mode switch chooses who paginates. **Engine breaks** is a
`GET ?doc=…&set=…&branding=…&adapter=…`, and the engine paginates the tree.
**Preview breaks** is a `POST` carrying `{ doc, set, branding, adapter, plan }`,
the plan the preview just published, and the PDF breaks where the preview did.
Everything travels in one place either way: the query string for a GET, the body
for a POST.

The pane also has an engine switch, and the Arabic letter is what it is worth
having for: choose takumi and the pane shows `UnsupportedDirectionError` beside a
preview that is perfectly fine, which is the refusal doing its job.

The header's branding switch chooses the token set, and it changes both panes at
once because both read it from the same document: the tokens go on
`ProposalDocument`, not on the render call. The lab fetches the bytes
rather than pointing the frame at the URL, because the render reports what it
could not honour on `X-Paradoc-Unknown-Breaks` and `X-Paradoc-Unknown-Repeats`
and a frame navigating to a URL never shows a header to the page. A render that
fails comes back as the error text, so an unsupported class is readable beside
the preview that still shows it.

## The seal

The composition seals through the core seal flow with no auxiliary layer and no
converter, and the signature map resolves a box for both parties.
`@paradoc/core` runs the whole flow: it binds signers, renders the layer twice
through the renderer registered for `text/tsx`, locates the markers, checks for
drift between the two passes, flattens and hashes the canonical document. The
renderer is the same one an ordinary `render` uses, so the sealed document comes
off the same tree the preview draws.

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

`sealProposal` is one line around `seal({ renderers })`:

```ts
fillProposalForSeal(data).seal({ renderers: proposalRenderers({ images }) });
```

**Where the marker comes from.** Core places a flow slot by writing eight
invisible codepoints in front of the slot's placeholder and finding them again in
the PDF. It writes them into the text for a layer it renders itself. It cannot
write into a composition, so it hands them to the layer's renderer as
`ctx.signing` — each one naming the slot, its party role and index, and the
marker string — and `@paradoc/react/pdf` puts them in the signing context. The
`Signature` block for that party and field type writes its marker immediately
before its rule, in the same text run, which is what the locator measures. Every
other render carries no markers and the block draws its rule alone.

Core says something too. When a marker pass produces a PDF carrying no marker
codepoint at all, core appends the glyph-coverage sentence to its own
`LocateError`, so a renderer that does not read its output back still fails
naming the cause.

Measured on the overflow set: both fields land on page 4, the acceptance page,
at the same height, 77 by 26 points, the provider at x 36 and the customer at
x 321. The short set seals both onto its one page, at x 36 and x 321 again and y
700. `tests/seal.test.tsx` pins both sets, so this paragraph checks itself rather
than recording one run. Two seals of the same data give the same hash and the
same map.

**Who signs.** Core binds a signer to a `Person`, never an organization, and
both of the proposal's parties are organizations. The artifact names a contact
for each — `providerContact` and `customerContact` — and `fillProposalForSeal`
binds the signer to that person while the party stays the organization. The
signature block on the page names the party through the artifact's own party
serializer, as it always did.

**The sealed document is the document.** Core's flow path renders the layer
twice: once with the markers, once clean. The clean pass carries none, so the
renderer runs exactly as an ordinary render runs and the canonical PDF is byte
for byte a plain `renderPdf` of the same tree. `tests/seal.test.tsx` asserts the
text page by page, asserts the two byte streams are equal, and asserts no marker
survives into the canonical document.

**Flow placement imposes a font requirement nothing documents.** Core's marker is
eight braille codepoints. The encoding is base 4, so the eight are drawn from
four values: U+2800, U+2801, U+2802 and U+2804. The engine writes U+0000 for a
codepoint no embedded font covers, and Inter covers no braille, so with the
document face alone the marker reaches the PDF as eight nulls and
core's own `locate` would throw `Could not resolve 2 of 2 placements:
provider-signature (not found), customer-signature (not found)` with nothing
naming the cause. The renderer embeds the braille subset of Noto Sans Symbols 2,
as a coverage subset of the document family, on any pass that carries a marker.
The document still names one font and its typography does not change.
`tests/seal-marker-font.test.tsx` holds the evidence and holds it alone: an
unmarked render writing nulls, a whole seal rendered with the face turned off
failing with `MissingSigningMarkerError` naming both slots and the coverage, and
then the same seal resolving once the face is embedded. It stands alone because the
engine's font registry is global to the process, so once any render embeds the
marker face every later render in that process can reach it. The package's
vitest config states `isolate: true` for that reason.

**A signature rule has to be text.** Core sizes a flow field from the underscore
run on the marker's line, so a rule drawn as a one-pixel border leaves the field
nothing to measure. `Signature` draws core's own placeholder — sixteen
underscores, exported as `SIGNATURE_RULE` — which is also why the clean pass and
the plain render agree.

**A marker the PDF did not receive fails at the render.** The renderer reads back
the PDF it just wrote and checks every marker arrived. Without that the loss is
silent and the seal fails two steps later as `locate` reporting each slot "not
found", with nothing naming a font. `MissingSigningMarkerError` names the slots
and says the likeliest cause is glyph coverage.

## Packets

A bundle is several documents a reader receives as one thing, and a signer signs
the thing rather than its third part. `@paradoc/react` puts one on screen and
`@paradoc/core` seals it.

### On screen

`Part` is the boundary between the documents. Everything inside it numbers its
pages from one, because that is what a reader of that document expects; the
packet's own numbering is the sequence of parts, and it comes from the seal.

```tsx
<Bundle id="vendor-packet">
  <Part id="purchase-order" kind="composition" label="Purchase order"
        firstPage={1} pageCount={2} placedFor={packetHash} packetHash={packetHash}>
    <Pages><PurchaseOrderDocument data={data} /></Pages>
  </Part>
  <Part id="w-9" kind="form" label="Form W-9" firstPage={3} pageCount={1}
        placedFor={packetHash} packetHash={packetHash}>
    <PdfPages bytes={filledW9} filename="w-9.pdf" workerSrc={workerSrc}
              standardFontDataUrl="/pdfjs/standard_fonts/" cMapUrl="/pdfjs/cmaps/" />
  </Part>
</Bundle>
```

A part's header says one of four things, and `data-part-placement` carries the
same answer:

| State | Header | When |
| --- | --- | --- |
| `placed` | `Packet pages 3 to 4` | The placement belongs to the packet on screen. |
| `pending` | `Pages pending` | `placedFor` and `packetHash` differ, so the numbers are of a packet that has been superseded. |
| `attached` | `Attached, not paginated` | The part is carried beside the packet rather than merged into it. |
| `unplaced` | nothing | The caller has not sealed the packet. |

`pending` is the state a session cares about. Filling a field repaginates the
composition, which moves every part after it, and the seal that produced the old
numbers has not run again. Until the reseal lands, a part says its pages are
pending rather than naming a page the packet no longer has. `data-part-first-page`
and `data-part-page-count` are stated only in `placed`, so a stale number cannot
be read off the DOM at all.

### Painting a PDF part

`PdfPages` paints a PDF page by page at that PDF's own paper size, not at the
packet's. A document that is already final has already chosen its paper, and
painting it at another size would be a second opinion about it.

Painting uses `pdfjs-dist`, an optional peer loaded on demand. Three things it
needs, and all three are how a paint stalls rather than fails:

- **`workerSrc`.** Pass a worker URL your bundler produced and painting happens
  off the main thread. Leave it unset and pdf.js's worker module is loaded into
  the page instead, which paints on the main thread.
- **`standardFontDataUrl` and `cMapUrl`.** pdf.js bundles neither the standard
  fourteen fonts nor the CMaps. A PDF that names Helvetica rather than embedding
  it waits on the first; a PDF with a predefined CJK encoding waits on the
  second. Serve `pdfjs-dist/standard_fonts/` and `pdfjs-dist/cmaps/` the way the
  worker is served. The lab's dev server does exactly that at `/pdfjs/`.
- **`timeoutMs`, 20 seconds by default.** The whole paint is bounded regardless,
  because a preview that shows an attachment card is a preview and one that
  never resolves is a bug that looks like a slow machine. On the bound, the part
  becomes a named `Attachment` saying why, and `onPaint` reports it.

`bytes` must be a stable reference: painting restarts whenever it changes, and a
host that builds a fresh `Uint8Array` on every render repaints forever. The
sealed packet's own `parts[n].content` already is one.

pdf.js's verbosity is left at its default, so its warnings reach the console
rather than being swallowed.

### Sealed

`sealBundle` is core's, and it composes per-part answers rather than replacing
them. Each part reaches PDF on its own terms, a form with slots through its own
`prepareSeal`, and is flattened so its filled values are page content rather
than form state a merge would drop. The flattened parts are merged in bundle
order by `mergePdfs` from `@paradoc/render`.

**Two hashes, and only one of them is signed.**

- `canonicalPdfHash` is the hash of the merged PDF. **It is what a signing
  ceremony binds to**, because it is the document the signer is shown.
- `packetHash` is the packet's record: the merged document's hash plus every
  part beside it, each named with what it is and what it hashes to. It accounts
  for a part nobody could paint. A ceremony that bound to it would be binding a
  signer to bytes they were never shown.

**Signers are the packet's, not the parts'.** A part binds signer ids in its own
namespace and knows nothing of the parts beside it, so two parts may each call a
signer `signer-1` without meaning the same person. `sealBundle` scopes every
part signer as `<part>/<signerId>` and returns a `signers` registry;
`signerIndex` on the map indexes it. Two part signers are one person only when
the caller says so:

```ts
const packet = await sealBundle(vendorPacketBundle, {
  contents,
  signers: {
    'purchase-order/supplier-signer': 'northgate-principal',
    'w-9/taxpayer-signer': 'northgate-principal',
  },
})
```

Naming a part signer no part binds is an error, so a typo leaves a loud failure
rather than two signers where one was meant.

The rest of the result describes the packet: `signatureMap`, whose `page` is a
packet page and whose `id` is `<part>/<slot>` because two artifacts may each
declare a slot called `signature`; and `parts`, each with its page range, its
digest and whether it was merged. `warnings` names every part carried rather
than merged.

**What a packet refuses.** An entry that is not the part the bundle declares, by
artifact name and version or by registry slug; bytes that do not sniff as the
type the entry declares; a rendered part whose renderer produced something that
is not a PDF, which is a `SealConfigError` naming the part. An annex declared as
a PDF whose bytes cannot be read is not a refusal: it becomes an attachment with
its digest in the packet record, and a warning naming it.

`@paradoc/react/examples` carries the worked packet: the purchase order
composition, the registry W-9 (handed in by the caller, so the package does not
depend on the registry), and a certificate of insurance as the annex. The annex
is checked in at `@paradoc/react/examples/certificate-of-insurance.pdf`, so a
browser project installing the block has bytes without a Node render;
`pnpm --filter @paradoc/react regenerate:annex` redraws it.

## Measured parity

Is a page of the PDF the page of the preview it came from? A suite answers it by
measurement rather than by assertion about the code: it starts the lab, drives
one Chrome, and compares both adapters in both pagination modes on four
variants — the short proposal, the overflow proposal, the overflow proposal
under the sample's second token set, and the Arabic letter. Chrome screenshots the preview sheet and
pdf.js paints the PDF into a canvas in that same Chrome, so one rasterizer draws
both sides; both are drawn at twice the paper size and averaged down to the paper
the run's own tokens chose, and a pixel counts as differing when its grayscale
value moves by more than 32 of 255.

The branded variant is what proves the tokens: it is measured on A4 with a 56
pixel margin in the serif, against the same four criteria with nothing loosened,
and it paginates at different rows from the unbranded one because the page is a
different page.

The Arabic variant is what proves the direction, and it is the one place the two
engines part company: takumi refuses it by name and the refusal is recorded as a
result, so only Chromium is measured. See **Right to left** above.

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

| Variant and mode            | Paper      | Pages | First keeps | Worst residual | Worst drift | Passes   |
| --------------------------- | ---------- | ----- | ----------- | -------------- | ----------- | -------- |
| short / default / engine    | 816 x 1056 | 1 = 1 | all match   | 2.17%          | 2 px        | recorded |
| short / default / hint      | 816 x 1056 | 1 = 1 | all match   | 2.17%          | 2 px        | yes      |
| overflow / default / engine | 816 x 1056 | 4 = 4 | all match   | 9.45%          | 12 px       | recorded |
| overflow / default / hint   | 816 x 1056 | 4 = 4 | all match   | 4.45%          | 6 px        | yes      |
| overflow / branded / engine | 794 x 1123 | 4 = 4 | all match   | 8.44%          | 12 px       | recorded |
| overflow / branded / hint   | 794 x 1123 | 4 = 4 | all match   | 3.44%          | 7 px        | yes      |
| Arabic letter               | —          | —     | —           | —              | —           | **refused** |

takumi refuses the Arabic letter with `UnsupportedDirectionError`, naming itself
and the script. It is not a page count that failed: the render never happens.

Chromium, experimental, measured against the same criteria with nothing loosened:

| Variant and mode            | Paper      | Pages | First keeps | Worst residual | Worst drift | Passes   |
| --------------------------- | ---------- | ----- | ----------- | -------------- | ----------- | -------- |
| short / default / engine    | 816 x 1056 | 1 = 1 | all match   | 1.99%          | 0 px        | recorded |
| short / default / hint      | 816 x 1056 | 1 = 1 | all match   | 1.99%          | 0 px        | recorded |
| overflow / default / engine | 816 x 1056 | 4 = 4 | all match   | 8.74%          | 12 px       | recorded |
| overflow / default / hint   | 816 x 1056 | 4 = 4 | all match   | 3.47%          | 0 px        | yes      |
| overflow / branded / engine | 794 x 1123 | 4 = 4 | two differ  | 8.34%          | 12 px       | recorded |
| overflow / branded / hint   | 794 x 1123 | 4 = 4 | all match   | 3.44%          | 1 px        | yes      |
| Arabic / engine             | 816 x 1056 | 2 = 2 | all match   | 2.66%          | 12 px       | recorded |
| Arabic / hint               | 816 x 1056 | 2 = 2 | all match   | 2.66%          | 0 px        | yes      |

**The Arabic letter reaches parity, and it does it with no drift at all.** Hint
mode is 2.66% and 1.59% residual on its two pages with zero band drift, which is
the two rasterizers and nothing else — the same result the proposal gets on
Chromium, in a script laid out the other way. Its first keeps match on both
pages, read from the figures each page carries rather than from its words: see
**Right to left** above for why the words cannot be read on this script and what
the report records about it.

**Hint mode passes on the branded document too, on both engines.** Its numbers
sit inside the unbranded ones rather than beside them: the serif is a little
lighter than Inter, so there is marginally less ink to disagree about, and the
narrower page changes where the rows fall without changing how well the two
sides agree about them. Blink's own pagination is the one place branding shows:
in engine mode on A4 it lands two of the four pages on different keeps, which is
recorded rather than required, because Blink was never asked to honour the
preview's plan.

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

**The refusal is measured, not asserted from memory.** The suite asks every
engine for every variant and records what a refusal said in
`parity-report.json` under `refusals`, so "takumi cannot lay out right to left"
is a result this run produced.

**The parity numbers are not regression-checked.** Nothing in CI re-measures
them yet, and `parity/parity-report.json` is gitignored, so there is no committed
figure to compare a later change against. The numbers above are the record: they
were measured on the commit that added them, and a change to the document, the
components or the engine pin invalidates them until someone runs the suite again.

## Running it

```sh
pnpm --filter @paradoc/react test    # component, artifact, plan, pagination, PDF and seal tests
pnpm --filter @paradoc/react build   # tsup to dist/, which consumers resolve through
pnpm --filter @paradoc/react registry:build   # regenerate the shadcn registry
```

The registry install suite is not in `pnpm test` either: it runs a CLI against a
scratch project and type-checks it, and it needs the package built first, so it
goes through the task graph like the parity suite.

```sh
pnpm turbo run test:registry --filter=@paradoc/react
```

The parity suite is not in that list. It drives a browser against a lab that
lives in the private monorepo, so it runs there and not from this repository:
see "Where it runs" above.
