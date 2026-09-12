---
name: safe-classes
description: The Tailwind class subset the default PDF engine has verified, how an unsupported class fails, and the tenant branding token set.
metadata:
  tags: tailwind, css, pdf, branding, tokens
---

# The safe class subset

**Contents:** [Why an allow-list](#why-an-allow-list) ·
[The verified families](#the-verified-families) ·
[Colours](#colours) · [What is never on the list](#what-is-never-on-the-list) ·
[Checking against a different adapter](#checking-against-a-different-adapter) ·
[Branding tokens](#branding-tokens)

## Why an allow-list

The preview runs in a real browser, which understands every Tailwind
utility. The default PDF engine (`takumi`) understands a subset and drops
anything else **without an error** — the class disappears and the page comes
out subtly wrong with nothing to explain why. So the PDF path checks every
class first and refuses to render when it finds one outside the verified
list, naming every offender in one error. `paradoc check` runs the identical
check without rendering.

This is a list of what was **proved** to work against the engine, not a
list of what is known to fail — treat anything not below as unsupported
until it is added and verified upstream in `@paradoc/react`.

## The verified families

| Family | Pattern (examples) |
|---|---|
| Display | `block`, `inline-block`, `inline`, `flex`, `hidden` |
| Overflow | `overflow-hidden`, `overflow-x-hidden`, `overflow-clip` |
| Position | `absolute` |
| Flex direction | `flex-row`, `flex-col`, `flex-row-reverse`, `flex-col-reverse` |
| Flex wrapping | `flex-wrap`, `flex-wrap-reverse`, `flex-nowrap` |
| Flex sizing | `flex-1`, `flex-auto`, `grow`, `basis-1/2`, `basis-104`, … |
| Alignment | `items-*`, `self-*`, `justify-*` |
| Gap | `gap-4`, `gap-x-2`, `gap-y-13`, … (open numeric scale) |
| Padding | `p-4`, `px-2`, `py-0.5`, `pt-13`, … |
| Margin | `m-4`, `-mt-2`, `mx-auto`, … |
| Sizing | `w-1/2`, `h-full`, `size-10`, `min-w-0`, `max-h-none`, … |
| Border width | `border`, `border-t`, `border-4` |
| Border colour | `border-neutral-800`, `border-<palette>-<50..950>` |
| Border radius | `rounded`, `rounded-lg`, `rounded-t-none`, `rounded-full` |
| Font size | `text-xs` … `text-9xl` |
| Font weight / style | `font-thin` … `font-black`, `italic`, `not-italic` |
| Line height | `leading-tight`, `leading-13`, … |
| Letter spacing | `tracking-tight` … `tracking-widest` |
| Text transform | `uppercase`, `lowercase`, `capitalize`, `normal-case` |
| Text alignment | `text-left`, `text-center`, `text-right`, `text-justify`, `text-start`, `text-end` |
| Text truncation | `truncate` |
| Text colour | `text-neutral-500`, `text-<palette>-<50..950>`, `text-black`, `text-white` |
| Background colour | `bg-white`, `bg-<palette>-<50..950>` |
| Opacity | `opacity-50`, `opacity-100` |
| Shadow | `shadow`, `shadow-md`, `shadow-none` |
| Whitespace | `whitespace-pre-line`, `whitespace-nowrap`, … |
| Text wrapping | `text-wrap`, `text-nowrap`, `text-balance` |

The spacing, sizing, and border-width scales are Tailwind v4's **open**
numeric scale: `p-13`, `p-104`, `gap-15`, and `border-3` are all valid because
the engine honours arbitrary numeric steps, not only v3's fixed set.

**Fractions are limited to denominators 2, 3, 4, 5, 6, and 12** — `basis-1/2`,
`w-2/3`, `h-5/6`, `basis-7/12`. A fraction with any other denominator
(`w-1/7`, `basis-2/9`) is not on the list, whichever of `w-`, `h-`, `size-`,
or `basis-` it appears on.

Also allowed, with no visible effect either way because they are the
engine's own defaults: `flex-row`, `flex-nowrap`, `items-stretch`,
`self-auto`, `self-stretch`, `justify-start`, `gap-0`, `p-0`, `m-0`,
`max-w-none`, `max-h-none`, `rounded-none`, `font-normal`, `not-italic`,
`tracking-normal`, `normal-case`, `text-left`, `text-start`,
`whitespace-normal`, `text-wrap`, `opacity-100`, `shadow-none`.

## Colours

`<palette>` is one of: `slate`, `gray`, `zinc`, `neutral`, `stone`, `taupe`,
`mauve`, `mist`, `olive`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`,
`emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`,
`fuchsia`, `pink`, `rose` — with a shade from `50` to `950`. `black`,
`white`, and `transparent` are also valid wherever a colour is expected.

An accent that is not one of these (a tenant's arbitrary brand colour) is not
a class at all — pass it through the `accentColor` token instead (see
[Branding tokens](#branding-tokens)), which both outputs apply as an inline
style.

## What is never on the list

These plausibly work in a real browser but probed byte-identical (no
observable effect) against the engine and are therefore **excluded**, even
though they might "just work": text decoration (`underline`,
`line-through`), border styles (`border-dashed`), `order-*`, `align-*`,
`text-ellipsis`, `break-words`, `flex-none`, `shrink-0`, `grow-0`, and
`break-inside-*`/`break-before-*` as classes (the pagination pass applies the
break intent as an inline style instead — a composition never needs these
directly). Arbitrary-value classes (`text-[13px]`, `bg-[#112233]`,
`p-[7px]`) are never in the allow-list either.

If a design needs one of these, restructure with a class that **is** on the
list, or accept the difference between the preview and the PDF for that
detail.

## Checking against a different adapter

`paradoc check --adapter chromium` (and `checkComposition({ adapter: "chromium" })`)
skips the class check entirely, because the Chromium adapter is a real
browser and accepts whatever CSS the tree produces. The default adapter for
both rendering and checking is `takumi`, and that is what a check should run
against unless the render itself explicitly targets Chromium.

## Branding tokens

A document (or bundle) carries a small set of tenant tokens, set once at the
root and read by both outputs:

| Token | Default | What it changes |
|---|---|---|
| `fontFamily` | `"Inter Variable"` | The faces both outputs embed. Only a family `@paradoc/react` registers (`Inter Variable`, `Source Serif 4 Variable`) is valid — an unregistered family fails the render naming it. |
| `accentColor` | none | Section headings and the rule above an emphasised total. A CSS colour string, applied as an inline style (see [What is never on the list](#what-is-never-on-the-list)) — not a Tailwind class. |
| `pageSize` | `"letter"` | `"letter"` (816×1056 px) or `"a4"` (794×1123 px). |
| `marginPx` | `48` | Margin on all four sides of every page. |
| `logo` | none | Bytes (`Uint8Array`, becomes a `data:` URI) or a source string the browser can load. |
| `typography` | `{ scale: "regular", flow: "regular" }` | The document's rhythm. `scale` steps every text role's size and leading one place on the verified scale, `flow` steps the root's block gap; each is `compact`, `regular`, or `roomy`. Root-only. |

```tsx
<Bundle tokens={{ pageSize: "a4", marginPx: 56, fontFamily: "Source Serif 4 Variable", accentColor: "#1d4ed8" }}>
  <Document artifact={changeOrderForm} data={data}>…</Document>
</Bundle>
```

Set these only on the outermost root (see
[pagination.md](./pagination.md#one-paper-declared-once)). Every token is
validated before an adapter sees it — an invalid colour, a non-integer
margin, or a margin that leaves no content box fails naming the token, rather
than being silently dropped.
