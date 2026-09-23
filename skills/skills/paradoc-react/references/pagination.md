---
name: pagination
description: The page planner's rules. Keeps, keep-with-next headings, table header repeat, footer carry, explicit breaks, oversize keeps, unique ids, and the data-* attributes the planner reads.
metadata:
  tags: pagination, keep-together, keep-with-next, tables, page-break, plan
---

# Pagination

**Contents:** [How a page is planned](#how-a-page-is-planned) ·
[The planner rules](#the-planner-rules) · [Keep ids](#keep-ids) ·
[The data attributes](#the-data-attributes) ·
[Newlines, paragraphs and oversize keeps](#newlines-paragraphs-and-oversize-keeps) ·
[The plan and the PDF](#the-plan-and-the-pdf) ·
[Writing for the planner](#writing-for-the-planner)

## How a page is planned

A **keep** is one pagination unit: an element with `data-keep-id`. The planner
places each keep whole on one page. `KeepTogether` sets `data-keep-id`, and
every shipped component that prints content renders one or more keeps. For
which component is a keep and its keep ids, see
[components.md § Keeps and containers](./components.md#keeps-and-containers).

`Pages` renders the document once, hidden, at page content width. It measures
every `[data-keep-id]` in document order as an interval (top and bottom), and
`planPages(keeps, budget)` assigns the keeps to pages. Then each sheet renders
the whole tree, and every keep that is not on that sheet renders `null`.

The budget is the page content height: the sheet height minus two margins.
`letter` with the default 48 px margin gives 1056 - 96 = 960 px. To change the
paper or the margin, set the `pageSize` and `marginPx` tokens
([safe-classes.md § Branding tokens](./safe-classes.md#branding-tokens)).

## The planner rules

The rules apply in this order:

1. **Greedy fill.** Keeps fill a page in document order. A keep whose bottom
   passes the budget opens the next page, and that page starts at the keep's
   top. Two keeps side by side in a flex row share one band, so they count once.
2. **Keep with next.** A table header, or a keep marked `data-keep-with-next`
   (a `Section` title), moves to the next page together with the keep that
   follows it. A run of them, such as a section title over a table header,
   moves as one. The last keep of the document stays where it is.
3. **Header repeat.** A page that opens on a table row gets a copy of that
   table's header above the row. The copy costs its own height plus the gap to
   the first row, and it is listed in `plan.repeats`. The copy carries
   `data-keep-repeat="true"`, and `Table` shows its `continuedLabel` only there.
4. **Footer carry.** A page opened for a table footer takes the table's last row
   with it, so totals always print below at least one row. A row that is alone
   on its page stays.
5. **Oversize.** A keep taller than a fresh page overflows that page. The
   planner reports it in `plan.oversize` with the height it used, and the next
   keep opens a new page.
6. **Sections.** A section is present on a page when any of its keeps is.
   `Section` renders `null` on a page with none of its keeps.

An explicit break (`PageBreak`) takes the same path as an overflow: it opens a
new page, and rules 2 and 3 still apply to it.

## Keep ids

- **Unique and not empty.** A duplicate or empty keep id fails the whole plan
  with `InvalidPagePlanInputError`, and `Pages` throws it. Give every
  hand-chosen id (`Text keepId`, `List id`, `Image keepId`, `Table id`) a value
  that no other keep in the document uses.
- **Stable.** `plan.breaks` names keeps by id, and `renderPdf` breaks the PDF at
  those ids. Build ids from values that hold their order between renders.
  `Table` uses the row index because rows hold their order in one render.
- **Leaves.** A keep holds content only. Nothing checks nesting: a keep inside
  a keep is measured twice and can be planned apart from its parent. `Field`,
  `Text`, `Table`, `Party`, `Signature` and `Image` are keeps already, so place
  them directly, with no `KeepTogether` around them.
- **All content in a keep.** Each sheet renders the whole tree, and only keeps
  and their containers withdraw. Content outside every keep (a bare `<p>` or a
  rule under `Document`) prints on **every** preview sheet but once in the PDF,
  so the two outputs disagree. Nothing checks this either. Put it in a `Text`,
  an `Image` or a `KeepTogether`.

## The data attributes

The planner reads these attributes from the measured DOM. Shipped components
set them. A hand-built component sets them on its own `KeepTogether`
([custom-components.md § Hand-built keeps](./custom-components.md#hand-built-keeps)
has examples).

| Attribute | Put it on | Value | What the planner does |
|---|---|---|---|
| `data-keep-id` | Every keep. `KeepTogether` sets it from `keepId`. | the keep id | Measures the element as one unit (all rules). |
| `data-keep-with-next` | A heading keep | `""` (present) | Moves it to the next page with the keep that follows (rule 2). |
| `data-table-header` | A table's header keep | the table id | Moves it forward when it would end a page (rule 2). Copies it above a continued row (rule 3). |
| `data-table-row` | Each row keep of that table | the same table id | Pages that open on it get the header copy (rule 3). |
| `data-table-footer` | The table's footer keep | the same table id | Takes the last row with it to a new page (rule 4). |
| `data-break-before` | A zero-height keep (`PageBreak`) | `"page"` | Opens a new page there. |
| `data-section` | A container that is **not** a keep | the section id | Adds the id to `plan.sections` for each page with one of its keeps. |

The planner writes one attribute itself: `data-keep-repeat="true"` on a header
copy. Read it to style a copy; the planner alone sets it.

## Newlines, paragraphs and oversize keeps

- A newline inside a value is a line break inside its keep. `Field` prints
  values with `whitespace-pre-line`, so both outputs wrap there.
- A blank line (two or more newlines) splits a value into paragraphs only with
  `<Field paragraphs />`. Each paragraph is then its own keep,
  `field:<path>:<index>`, with the label on the first one.
- A keep taller than the budget is oversize. The preview marks its sheet with a
  red "Oversize keep" badge, and the PDF overflows that page. Split the content
  into more keeps: `Field paragraphs` for long prose, `List` for clauses, one
  `Text` per paragraph for static prose. A single paragraph taller than a page
  stays oversize, because a keep is the smallest unit the planner places.

## The plan and the PDF

`Pages` calls `onPaginate(plan)` with each new `PagePlan`:

| Field | Meaning |
|---|---|
| `pages` | Keep ids on each page, in order, header copies included. |
| `repeats` | Keep ids on each page that are header copies. |
| `sections` | Section ids present on each page. |
| `breaks` | The keep that starts each page from page 2 on. |
| `oversize` | `{ id, height }` for each keep that overflows its page. |
| `budget` | The content height the plan used, in CSS pixels. |
| `fonts` | The application fonts the preview measured with. |

A PDF rendered with the plan breaks at `breaks`, repeats the headers in
`repeats`, and embeds the fonts in `fonts`. Without a plan, the engine
paginates on its own: it places each keep whole, and it applies none of rules 2
to 4 and no `PageBreak`. To make the PDF match the preview, render with the
plan as in
[render-and-seal.md § Match the preview](./render-and-seal.md#match-the-preview).

## Writing for the planner

- Use the shipped components first: `Text` for static prose, `Field` for
  values, `List` for clauses, `Table` for list fields, `Totals`, `Party`,
  `Signature`, `Image` for pictures, `Section` to group, and `PageBreak` for a
  forced break. Each one carries correct keeps.
- Use `KeepTogether` only for content none of them covers, such as a masthead
  that pairs a logo with an address. Give it a hand-chosen, stable id.
- Put a heading that must stay with its content in a `Section` `title`. A
  `Text role="heading"` is a plain keep with no `data-keep-with-next`, so it can
  end a page alone. For a heading outside a section, use a `KeepTogether` with
  `data-keep-with-next=""`.
- Place a table's rows one after another. The one keep that belongs between
  two rows is a `PageBreak` that names the table with its `table` prop, so the
  header still repeats after it. `Table` builds its rows from the list field,
  so a break inside a table needs a hand-built table.
