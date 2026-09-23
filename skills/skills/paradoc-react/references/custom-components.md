---
name: custom-components
description: Write your own composition component. Headless hooks, hand-built keeps with the data-* attributes, scaleTextClasses and flowGapClasses, markDocumentRoot for a wrapper, data-page-counter for page numbers, and partial-aware output.
metadata:
  tags: custom components, headless hooks, keep-together, markDocumentRoot, typography, page counter
---

# Custom components

**Contents:** [Before you write one](#before-you-write-one) ·
[Headless hooks](#headless-hooks) · [Hand-built keeps](#hand-built-keeps) ·
[Follow the typography token](#follow-the-typography-token) ·
[Wrap a Document](#wrap-a-document) · [Page counters](#page-counters) ·
[Blank and partial values](#blank-and-partial-values) ·
[What nothing checks](#what-nothing-checks)

## Before you write one

Compose the shipped components in [components.md](./components.md) first.
Write a component of your own only for output none of them gives, such as a
masthead that pairs a logo with an address.

A custom component follows the same contract as a shipped one:

- Read every value through a headless hook, which formats it for you.
- Put all content in leaf keeps
  ([pagination.md § Keep ids](./pagination.md#keep-ids)).
- Call hooks in a component that renders **below** `Document`. A hook in the
  same function that renders `Document` sees no artifact and the default
  tokens.

## Headless hooks

All from `@paradoc/react`. Artifact hooks need a `Document` above them. Page
hooks need `Pages` above them, and return the unpaginated answer otherwise.

| Hook | Returns | Use it for |
|---|---|---|
| `useField(path)` | `{ field, value, text, blank }` | One value. `text` is formatted; `blank` is `true` when `text` is the blank placeholder. |
| `useList(path)` | `{ field, item, rows, format, text(index, childPath?) }` | A list field. `text(2, "amount")` formats one cell. |
| `useTotals(defs)` | `{ name, label, value, text }[]` | Computed `defs`, in the order you pass. |
| `useParty(role)` | `Party[]` | The raw party records of a role. |
| `usePartyContact(role, index?, paths?)` | `{ roleLabel, nameText, organizationText?, addressText?, contactText? }` | A party's printed lines, as `Party` prints them. `paths` is `{ organization?, address?, contact? }`. |
| `useSignature(role, index?, type?)` | `{ roleLabel, partyText, fieldLabel, required, rule, dateRule, marker? }` | A signing block. Print `marker` and `rule` as **one** string so the seal finds the slot. |
| `useAnnex(path)` | `{ annex, label, attachment, text }` | An annex slot, `annexes.<slot>`. |
| `useAnnexPicture(path)` | `useAnnex` plus `picture` | An annex that may be an image. `picture` is set only for `image/*`. |
| `useArtifact()` | `Form` | The whole artifact, such as `artifact.title`. |
| `useFormatter()` | `Formatter` | The document's formatter, for a value that is not a field. |
| `useDocumentTokens()` | `DocumentTokens` | The resolved tokens: `accentColor`, `logo` (a string source), `pageSize`, `marginPx`, `dir`, `lang`, `typography`. |
| `usePartialValues()` | `boolean` | `true` when the caller rendered in partial mode. |
| `usePage()` | `{ plan, index, keeps, repeats, sections } \| null` | The page being drawn. `null` outside `Pages`. |
| `usePagePlan()` | `PagePlan \| null` | The whole plan. |
| `useKeepVisible(id)` | `boolean` | Whether a keep is on this page. Always `true` outside `Pages`. |
| `useSectionVisible(id)` | `boolean` | Whether a section has a keep on this page. |
| `usePageNumber()` | `{ page, pages }` | Preview page numbers. The PDF engine does not use it: see [Page counters](#page-counters). |

Helpers: `imageSource({ src, bytes }, what)` returns the one image source both
outputs read. `scaleTextClasses` and `flowGapClasses` are below.

## Hand-built keeps

`KeepTogether` from the installed `keep-together.tsx` renders a keep. It sets
`data-keep-id` from `keepId`, renders `null` on a page that does not hold the
keep, and spreads every other prop onto the element. Add the planner's `data-*`
attributes as props. Their meaning is in
[pagination.md](./pagination.md#the-data-attributes).

A masthead as one keep. The logo comes from the `logo` token:

```tsx
import { useDocumentTokens } from "@paradoc/react";
import { Field } from "@/components/paradoc/field";
import { Image } from "@/components/paradoc/image";
import { KeepTogether } from "@/components/paradoc/keep-together";

export function Masthead() {
  const { logo } = useDocumentTokens();
  return (
    <div className="flex flex-row items-center justify-between gap-4 border-b border-neutral-800 pb-4">
      {logo ? <Image keepId="masthead:logo" src={logo} width={40} height={40} /> : null}
      <Field path="invoiceNumber" />
    </div>
  );
}
```

The row `div` is not a keep. It holds two keeps side by side, so they share one
band on the page.

A heading that stays with the next keep, outside a `Section`:

```tsx
<KeepTogether keepId="terms:heading" as="h3" data-keep-with-next="" className="text-sm font-semibold text-neutral-900">
  Payment terms
</KeepTogether>
<Field path="paymentTerms" label={false} />
```

A hand-built table. Give the header, the rows and the footer the same table id,
and withdraw the container from a page that holds none of its keeps, as `Table`
does:

```tsx
import { useList, usePage, useTotals } from "@paradoc/react";
import { KeepTogether } from "@/components/paradoc/keep-together";

export function ItemTable() {
  const list = useList("lineItems");
  const [total] = useTotals(["total"]);
  const page = usePage();
  const ids = ["items:header", ...list.rows.map((_row, index) => `items:${index}`), "items:footer"];
  if (page && !ids.some((id) => page.keeps.has(id))) return null;
  return (
    <div className="flex flex-col">
      <KeepTogether keepId="items:header" data-table-header="items" className="flex gap-4 border-b border-neutral-800 pb-1 text-xs font-semibold">
        <span className="basis-3/4">Item</span>
        <span className="basis-1/4 text-right">Amount</span>
      </KeepTogether>
      {list.rows.map((_row, index) => (
        <KeepTogether key={index} keepId={`items:${index}`} data-table-row="items" className="flex gap-4 border-b border-neutral-200 py-1">
          <span className="basis-3/4">{list.text(index, "description")}</span>
          <span className="basis-1/4 text-right">{list.text(index, "amount")}</span>
        </KeepTogether>
      ))}
      <KeepTogether keepId="items:footer" data-table-footer="items" className="flex justify-between pt-1 font-semibold">
        <span>{total?.label}</span>
        <span>{total?.text}</span>
      </KeepTogether>
    </div>
  );
}
```

To force a break between two rows, render `<PageBreak keepId="items:break" table="items" />`
between them.

## Follow the typography token

The `typography` token steps text sizes, leadings and gaps. It moves a class
only when the component passes its classes through a helper:

| Helper | Steps | Per level |
|---|---|---|
| `scaleTextClasses(classes, typography.scale)` | `text-*` sizes and `leading-*` | one size or leading step |
| `flowGapClasses(classes, typography.flow)` | `gap-*`, `gap-x-*`, `gap-y-*` | two spacing units |

Both leave every other class as it is, and both return the string unchanged at
`regular`. A literal `text-sm` written without the helper stays `text-sm` in a
compact or roomy document.

```tsx
import { flowGapClasses, scaleTextClasses, useDocumentTokens } from "@paradoc/react";
import { KeepTogether } from "@/components/paradoc/keep-together";

export function Notice({ keepId, children }: { keepId: string; children: React.ReactNode }) {
  const { typography } = useDocumentTokens();
  return (
    <KeepTogether
      keepId={keepId}
      className={flowGapClasses(scaleTextClasses("flex flex-col gap-2 border-l-4 border-amber-400 bg-amber-50 p-3 text-sm leading-snug", typography.scale), typography.flow)}
    >
      {children}
    </KeepTogether>
  );
}
```

The installed stylesheet lists the stepped classes for the browser, because
they are built at runtime: every text size, the named leadings, `leading-0` to
`leading-16`, and `gap-0` to `gap-24`. Start from `gap-22` or less and
`leading-15` or less, so the roomy step still has a browser rule.

## Wrap a Document

A composition that renders `Document` or `Bundle` inside its own component is a
**wrapper**. `Pages`, `Paper` and `renderPdf` read the paper from the element
tree without calling components. They see a wrapper's `tokens` prop only when
the wrapper is registered with `markDocumentRoot`.

```tsx
import { markDocumentRoot, type DocumentData, type DocumentTokensInput } from "@paradoc/react";
import type { Form } from "@paradoc/types";
import { Document } from "@/components/paradoc/document";
import { Section } from "@/components/paradoc/section";
import { Field } from "@/components/paradoc/field";
import { invoiceForm } from "./invoice";

export interface InvoiceLetterProps {
  data: DocumentData;
  artifact?: Form;
  tokens?: DocumentTokensInput;
}

export function InvoiceLetter({ data, artifact = invoiceForm, tokens }: InvoiceLetterProps) {
  return (
    <Document artifact={artifact} data={data} tokens={tokens}>
      <Masthead />
      <Section id="terms" title="Payment">
        <Field path="paymentTerms" label={false} />
      </Section>
    </Document>
  );
}

markDocumentRoot(InvoiceLetter);
export default InvoiceLetter;
```

Rules for a wrapper:

- Take `tokens` as a prop, forward it to the root, and call
  `markDocumentRoot(Wrapper)` once at module level.
- Set root-only tokens (`pageSize`, `marginPx`, `dir`, `lang`, `typography`)
  only through the forwarded `tokens`. The preview and the PDF cannot see a
  value set in the wrapper's body, so one that differs from the caller's
  throws `RootTokenMismatchError`. An unregistered wrapper that forwards
  `tokens={{ pageSize: "a4" }}` fails the same way. A default `accentColor` or
  `logo` inside the wrapper is fine.

## Page counters

The PDF engine numbers pages itself. It fills only elements marked with
`data-page-counter`: `"current"` for the page number and `"total"` for the
count. `usePageNumber()` returns 1 of 1 in a PDF render, so a counter that
prints only the hook's numbers prints "1 of 1" on every PDF page.

```tsx
import { usePageNumber } from "@paradoc/react";

export function SheetCounter() {
  const { page, pages } = usePageNumber();
  return (
    <span className="text-xs text-neutral-500">
      Sheet <span data-page-counter="current">{page}</span> of <span data-page-counter="total">{pages}</span>
    </span>
  );
}
```

Put a counter in a furniture `header` or `footer`
([components.md § Furniture slots](./components.md#furniture-slots) lists what
each adapter draws). For the standard "Page 3 of 7", use `PageNumber`.

## Blank and partial values

`useField(path).blank` is `true` when the value printed as the blank
placeholder. Use it to print something else in its place, such as a fill line:

```tsx
import { useField } from "@paradoc/react";
import { KeepTogether } from "@/components/paradoc/keep-together";

export function WriteIn({ path }: { path: string }) {
  const binding = useField(path);
  return (
    <KeepTogether keepId={`write-in:${path}`} className="flex flex-col gap-0.5">
      <span className="text-xs text-neutral-500">{binding.field.label}</span>
      <span>{binding.blank ? "________________" : binding.text}</span>
    </KeepTogether>
  );
}
```

Hook output follows partial mode
([render-and-seal.md § Drafts](./render-and-seal.md#drafts)): an incomplete
value or an unfilled party prints the placeholder instead of throwing. For
output a hook does not format, read `usePartialValues()` and print a
placeholder when it is `true`.

## What nothing checks

`paradoc check` finds refused classes, unknown paths, parties and defs, and
missing images. Review a custom component by hand for these faults:

| Fault | Symptom and rule |
|---|---|
| Content outside every keep, a keep inside a keep, a duplicate or empty keep id | [pagination.md § Keep ids](./pagination.md#keep-ids) |
| A counter without `data-page-counter` | Every PDF page says 1 of 1 ([Page counters](#page-counters)). |
| A literal text size | The text ignores `typography` ([Follow the typography token](#follow-the-typography-token)). |
| An unregistered wrapper with root tokens | `RootTokenMismatchError` at preview or render ([Wrap a Document](#wrap-a-document)). |
| A bad class in a furniture slot | `UnsupportedPdfContentError` at render ([safe-classes.md § How a class is checked](./safe-classes.md#how-a-class-is-checked)). |

To surface them, preview with `paradoc dev`
([cli.md § paradoc dev](./cli.md#paradoc-dev)) and render with the preview's
plan ([render-and-seal.md § Match the preview](./render-and-seal.md#match-the-preview)).
