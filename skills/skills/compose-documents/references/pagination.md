---
name: pagination
description: The keep-together pagination rule, the table header repeat, and the two layout constraints a composition must respect.
metadata:
  tags: pagination, keep-together, tables, layout
---

# The pagination rule

**Contents:** [The rule](#the-rule) · [No `<table>`](#no-table) ·
[One paper, declared once](#one-paper-declared-once) ·
[What this means when writing a composition](#what-this-means-when-writing-a-composition)

`Pages` reads every `[data-keep-id]` in the rendered tree, in document order,
and assigns each one to a page. The rule has to be exact because both the
preview and the PDF read it:

- **An element with `data-keep-id` is a pagination unit and is never split.**
  Every `Field`, the table header, every table row, every section heading,
  `Totals`, and each `Signature` block already carries one — `KeepTogether` is
  where `data-keep-id` comes from.
- **A keep never contains another keep.** Keeps are leaves. Do not nest a
  `Field` or `Table` inside a custom `KeepTogether`, and do not nest one
  `KeepTogether` inside another.
- **All rendered text lives inside some keep.** Nothing may fall between
  them. If a composition needs a decorative element outside any component
  (a rule, a background band), give it its own `KeepTogether` rather than
  leaving it as a bare sibling.
- **`Section` is a container, not a keep.** It carries `data-section` instead
  of `data-keep-id` precisely because a section commonly runs past one page —
  treating it as one pagination unit would force the whole section onto one
  page or fail it outright.
- **Keep ids are stable across renders.** `renderPdf` accepts them as
  `plan.breaks` and turns each into a page break, so changing an id (or
  generating one from an index that can shift) changes where both outputs
  paginate.

**The table header repeats.** A page that opens on a continued row of a
`Table` renders a copy of that table's header above it, marked
`data-keep-repeat="true"`. The copy is not a second description of the
header — it is built by the pagination pass from the header already in the
tree — and a composition never has to draw it itself.

**An oversize keep overflows its own page**, reported with what it consumed;
nothing else joins it. This is a signal to shorten the content or split it
into more than one keep (e.g. more than one `Field` per long block of text),
not something a composition can suppress.

## No `<table>`

The default PDF engine has no table support, so `Table` renders flex rows
instead of `<table>`/`<tr>`/`<td>`. A composition must never use real table
markup: the same tree that lays out on screen is the tree the PDF renders, so
a `<table>` there would be a document the PDF cannot reproduce. Build a
grid-like layout with `flex` rows and Tailwind basis classes, the way `Table`
itself does, or use `Table`.

## One paper, declared once

The page furniture (`Paper`, `Pages`) takes **no geometry props** — page size
and margin are the document's own `tokens`, read once at the root (`Bundle`
or `Document`) and by both outputs. A composition:

- never renders `Paper`/`Pages` with a size or margin prop (there is none to
  pass);
- sets `pageSize`, `marginPx`, and `fontFamily` **only** on the outermost
  root, never on a `Document` nested inside a `Bundle` (that throws
  `NestedPaperTokenError`);
- never sets its own `tokens` on itself and swallows them — if a composition
  wraps `Document`/`Bundle` internally, it must forward a `tokens` prop from
  its own caller rather than deciding branding internally. A composition that
  hides its tokens fails loudly with `RootTokenMismatchError`.

See [safe-classes.md](./safe-classes.md#branding-tokens) for the full token
set.

## What this means when writing a composition

- Reach first for `Field`, `Table`, `Totals`, `Signature`, and `Section` —
  they already carry correct keep ids. Only reach for `KeepTogether` directly
  for content none of them cover (a masthead image, a custom banner), and
  give it a stable, hand-chosen id.
- Never generate a keep id from an array index that can reorder between
  renders unless the array itself is stable in that order (`Table` uses the
  row index because rows do not reorder mid-render).
- A section heading can legally end a page with its content starting the
  next one — the orphan rule protects table headers only, not section
  headings. This is accepted framework behavior, not a bug to work around.
