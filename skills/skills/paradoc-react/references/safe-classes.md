---
name: safe-classes
description: The verified vocabulary. The exact Tailwind classes the default PDF engine honors, the scales they use, the classes it refuses with substitutes, and the branding tokens.
metadata:
  tags: tailwind, css, pdf, verified vocabulary, branding, tokens
---

# The verified vocabulary

**Contents:** [How a class is checked](#how-a-class-is-checked) ·
[The verified families](#the-verified-families) · [Scales](#scales) ·
[Commonly used, refused](#commonly-used-refused) ·
[The Chromium adapter](#the-chromium-adapter) ·
[Branding tokens](#branding-tokens)

## How a class is checked

The preview runs in a browser and honors every Tailwind class. The default PDF
engine (takumi) honors a subset and drops the rest with no error. So the PDF
path checks every class first. The **verified vocabulary** is the set of
classes proved to change the PDF. A class outside it is refused:

- `renderPdf` throws `UnsupportedPdfContentError` before it renders. Its
  `.classes` lists every refused class in document order, and `.images` lists
  image sources with no bytes.
- `paradoc check` and `checkComposition` report the same classes in
  `unsupportedClasses` without rendering. They check the document tree only,
  not the furniture slots, so a bad class in a header, footer or stamp fails at
  render time.
- Test one class with `isSupportedClass(name)`, or a whole string with
  `unsupportedClasses(className)`, both from `@paradoc/react-pdf`.

<!-- dep:R4 -->
```ts
import { isSupportedClass, unsupportedClasses } from "@paradoc/react-pdf";

isSupportedClass("self-end"); // true
unsupportedClasses("flex place-self-end space-y-2"); // ["place-self-end", "space-y-2"]
```

Treat a class that is not listed below as refused, variants and arbitrary
values included.

## The verified families

`<n>`, `<size>` and `<colour>` are defined in [Scales](#scales).

| Family | Exact classes |
|---|---|
| Display | `block`, `inline-block`, `inline`, `flex`, `hidden` |
| Overflow | `overflow-hidden`, `overflow-clip`, `overflow-x-hidden`, `overflow-x-clip`, `overflow-y-hidden`, `overflow-y-clip` |
| Absolute positioning | `absolute` (no offset classes, no `relative`) |
| Flex direction | `flex-row`, `flex-col`, `flex-row-reverse`, `flex-col-reverse` |
| Flex wrapping | `flex-wrap`, `flex-wrap-reverse`, `flex-nowrap` |
| Flex sizing | `flex-1`, `flex-auto`, `grow`, `basis-<size>` |
| Alignment | `items-start`, `items-end`, `items-center`, `items-baseline`, `items-stretch`; `self-auto`, `self-start`, `self-end`, `self-center`, `self-baseline`, `self-stretch`; `justify-start`, `justify-end`, `justify-center`, `justify-between`, `justify-around`, `justify-evenly` |
| Gap | `gap-<n>`, `gap-x-<n>`, `gap-y-<n>` |
| Padding | `p-<n>`, `px-<n>`, `py-<n>`, `pt-<n>`, `pr-<n>`, `pb-<n>`, `pl-<n>` |
| Margin | `m-`, `mx-`, `my-`, `mt-`, `mr-`, `mb-`, `ml-` with `<n>` or `auto`; a leading `-` for a negative margin (`-mt-2`) |
| Sizing | `w-<size>`, `h-<size>`, `size-<size>`; `min-w-`, `min-h-`, `max-w-`, `max-h-` with `<size>` or `none` |
| Border width | `border`, `border-x`, `border-y`, `border-t`, `border-r`, `border-b`, `border-l`, each with an optional width `-0` to `-99` (`border-2`, `border-t-4`) |
| Border colour | `border-<colour>`, and per side `border-t-<colour>` (`x`, `y`, `t`, `r`, `b`, `l`) |
| Border radius | `rounded`, optional corner or side `-t`, `-r`, `-b`, `-l`, `-tl`, `-tr`, `-br`, `-bl`, optional size `-none`, `-xs`, `-sm`, `-md`, `-lg`, `-xl`, `-2xl`, `-3xl`, `-4xl`, `-full` (`rounded-t-lg`) |
| Font size | `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl` to `text-9xl` |
| Font weight and style | `font-thin`, `font-extralight`, `font-light`, `font-normal`, `font-medium`, `font-semibold`, `font-bold`, `font-extrabold`, `font-black`, `italic`, `not-italic` |
| Line height | `leading-none`, `leading-tight`, `leading-snug`, `leading-relaxed`, `leading-loose`, `leading-<n>` |
| Letter spacing | `tracking-tighter`, `tracking-tight`, `tracking-normal`, `tracking-wide`, `tracking-wider`, `tracking-widest` |
| Text transform | `uppercase`, `lowercase`, `capitalize`, `normal-case` |
| Text alignment | `text-left`, `text-center`, `text-right`, `text-justify`, `text-start`, `text-end` |
| Text truncation | `truncate` |
| Text decoration | `underline`, `line-through`, `overline`, `no-underline` |
| Rotation | `rotate-0`, `rotate-1`, `rotate-2`, `rotate-3`, `rotate-6`, `rotate-12`, `rotate-45`, `rotate-90`, `rotate-180`, each also negative (`-rotate-45`) |
| Text colour | `text-<colour>` |
| Background colour | `bg-<colour>` |
| Opacity | `opacity-0` to `opacity-99`, `opacity-100` |
| Shadow | `shadow`, `shadow-2xs`, `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, `shadow-none` |
| Whitespace | `whitespace-normal`, `whitespace-pre`, `whitespace-pre-line`, `whitespace-pre-wrap`, `whitespace-nowrap` |
| Text wrapping | `text-wrap`, `text-nowrap`, `text-balance` |

Two non-utility classes also pass: `paradoc-document` and
`paradoc-ltr-isolate`. The installed stylesheet loads Tailwind and defines
only `paradoc-ltr-isolate`; the consuming application supplies font faces and
uses `paradoc-document` to apply them.

Rotation is for the page stamp
([components.md § Furniture slots](./components.md#furniture-slots)). It turns a box without
moving it in the layout, so rotated content in the flow can reach past its keep.

## Scales

| Placeholder | Values | Examples |
|---|---|---|
| `<n>` | `px`, or a whole number from `0` to `999` with an optional `.5` | `p-px`, `gap-0.5`, `p-13`, `w-104`, `leading-6` |
| `<size>` | `<n>`, a fraction, `full`, `auto`, or `screen` | `w-full`, `basis-1/2`, `h-auto` |
| fraction | numerator of 1 or 2 digits, denominator `2`, `3`, `4`, `5`, `6` or `12` | `basis-7/12`, `w-2/3`; not `w-1/7` |
| `<colour>` | `black`, `white`, `transparent`, or `<palette>-<shade>` | `text-neutral-500`, `bg-sky-50` |

`<palette>` is one of `slate`, `gray`, `zinc`, `neutral`, `stone`, `taupe`,
`mauve`, `mist`, `olive`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`,
`emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`,
`fuchsia`, `pink`, `rose`. `<shade>` is one of `50`, `100`, `200` ... `900`,
`950`.

A brand colour outside the palette is not a class. Pass it as the `accentColor`
token (see [Branding tokens](#branding-tokens)).

## Commonly used, refused

Each class below fails the check. Use the substitute.

| Refused | Use instead |
|---|---|
| `grid`, `inline-grid`, `col-span-2`, `table`, and `<table>`, `<tr>`, `<td>` markup | `flex` rows with `basis-*` fractions, or `Table` |
| `inline-flex` | `flex` |
| `relative`, `static`, `fixed`, `sticky`, `top-0`, `inset-0`, `z-10` | `flex` layout and margins. For a watermark, the furniture `stamp`. |
| `space-y-2`, `space-x-4`, `divide-y` | `gap-*` on the parent; `border-b` on each item |
| `ps-4`, `pe-2`, `ms-2`, `me-auto`, `border-s`, `rounded-s` | `px-*`, `mx-*`, `border-x` for symmetric spacing, or `pl-*`, `pr-*`, `ml-*`, `mr-*` for a fixed side |
| `leading-normal` | `leading-snug`, `leading-relaxed`, or `leading-<n>` |
| `max-w-md`, `max-w-prose`, `w-fit`, `w-min`, `w-max` | a numeric or fraction size: `max-w-96`, `w-1/2` |
| `shrink`, `shrink-0`, `flex-none`, `grow-0` | a fixed `w-<n>` or `basis-<size>` |
| `place-self-end`, `place-items-center`, `justify-self-end`, `justify-items-center`, `content-center`, `items-normal`, `justify-normal`, `justify-stretch` | the exact `items-*`, `self-*`, `justify-*` values above |
| `font-mono`, `font-sans`, `font-serif` | the application stylesheet sets the typeface; `renderPdf` takes the same faces as `fonts` |
| `tabular-nums` | `text-right` on the number column |
| `sr-only` | leave the text out of the document |
| `list-disc`, `list-decimal` | `List`, whose markers are text |
| `break-all`, `break-words`, `text-ellipsis`, `line-clamp-2` | `truncate` for one line, otherwise let the text wrap |
| `text-pretty` | `text-balance` or `text-wrap` |
| `decoration-2`, `underline-offset-4` | `underline` alone |
| `border-dashed`, `border-dotted` | a solid `border` |
| `align-super`, `align-sub` | plain text, such as `10^2` |
| `overflow-auto`, `overflow-visible` | `overflow-hidden` or `overflow-clip` |
| `order-1` | reorder the JSX |
| `aspect-square`, `object-cover` | a declared `width` and `height` on `Image` |
| `rotate-30`, `rotate-[30deg]` | a listed rotation step |
| `bg-black/50`, `text-white/80` | `opacity-50` on the element, or a lighter shade |
| `sm:flex`, `print:hidden`, `hover:underline`, `dark:bg-black` | one class set for every output: a document has no breakpoints or states |
| `text-[13px]`, `bg-[#112233]`, `p-[7px]` | the nearest scale step; `accentColor` for a brand colour |

## The Chromium adapter

`paradoc check --adapter chromium` and `checkComposition({ adapter: "chromium" })`
skip the class check, because the Chromium adapter prints through a real
browser. Check against the default, `takumi`, unless the render also uses
Chromium.

## Branding tokens

A document root (`Document`, `Bundle`, or a wrapper registered with
`markDocumentRoot`) takes a `tokens` prop. Both outputs read the tokens from
the root.

| Token | Default | Root only | What it changes |
|---|---|---|---|
| `accentColor` | none | no | Any CSS colour string, applied as an inline style. Colours `Section` titles and the rule above an emphasized `Totals` row or `Table` footer row. |
| `logo` | none | no | `Uint8Array` (embedded as a `data:` URI) or a URL string. No component draws it by itself: read it with `useDocumentTokens().logo`. Use an image under 64 KB. |
| `pageSize` | `"letter"` | yes | `"letter"` (816 × 1056 px) or `"a4"` (794 × 1123 px). |
| `marginPx` | `48` | yes | The margin on all four sides, in CSS pixels. A header or footer band gets `marginPx - 20`. |
| `dir` | `"ltr"` | yes | `"ltr"` or `"rtl"`, as HTML `dir`. |
| `lang` | `"en"` | yes | A BCP-47 tag, as HTML `lang`. It names the script the typeface must carry. |
| `typography` | `{ scale: "regular", flow: "regular" }` | yes | `scale` steps every text size and leading one place; `flow` steps the root's block gap. Each is `"compact"`, `"regular"` or `"roomy"`. |

```tsx
<Bundle tokens={{ pageSize: "a4", marginPx: 56, accentColor: "#1d4ed8", typography: { scale: "compact" } }}>
  <Document artifact={invoiceForm} data={data}>…</Document>
</Bundle>
```

Rules:

- Set root-only tokens on the outermost root. A `Document` inside a `Bundle`
  that sets one throws `NestedPaperTokenError`. It can still set `accentColor`
  and `logo`.
- An invalid token (a bad colour, a non-integer margin, a margin that leaves no
  content box) throws `InvalidDocumentTokenError` naming the token.
- A wrapper component that renders the root sets root-only tokens by
  forwarding `tokens` from its caller. For the wrapper rules and
  `RootTokenMismatchError`, see
  [custom-components.md § Wrap a Document](./custom-components.md#wrap-a-document).
- Override tokens for one render with `renderPdf(element, { tokens })`, and in
  the preview with `<TokenOverrideProvider tokens={…}>` from `@paradoc/react`
  around `Pages`. The override is the last layer over the root's own tokens, so
  a render that changes only the accent keeps the document's paper.
- Custom markup follows `typography` only through `scaleTextClasses` and
  `flowGapClasses`. When you write your own component, see
  [custom-components.md § Follow the typography token](./custom-components.md#follow-the-typography-token).
