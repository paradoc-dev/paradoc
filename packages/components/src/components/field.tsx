/**
 * A copy-owned field row. It reads labels and formatted values from the
 * headless runtime and stays together as one pagination unit.
 *
 * `as="image"` prints the other thing a document binds by path: an attachment,
 * which the artifact declares as an annex slot and the filled data carries as
 * one `Attachment` per slot. An attachment whose MIME type is a picture is
 * drawn at the declared size; anything else prints its file name, because a
 * contract PDF is not the place to discover that a photograph was a
 * spreadsheet.
 *
 * **Newlines inside a value are line breaks, in both outputs.** The value is
 * drawn with `whitespace-pre-line`, so a value the filler typed on three lines
 * reaches the preview and the PDF on three lines rather than being collapsed
 * into one. That is all a newline does: it wraps, it never paginates.
 *
 * **`paragraphs` is what paginates.** A field is one keep, and a keep is never
 * split, so a value long enough to pass a page overflows it and is reported as
 * oversize. Splitting the value at its blank lines turns each paragraph into a
 * keep of its own, keyed `field:<path>:<index>`, and long prose then breaks
 * between paragraphs like any other run of units. A single paragraph taller
 * than a page is still oversize: a pagination unit is never split inside
 * itself.
 *
 * The label stays with the first paragraph, for the reason the field is a keep
 * at all — a heading on the page above its own words is what pagination is
 * supposed to prevent. The wrapper is not a keep, so it withdraws from a page
 * holding none of its paragraphs, exactly as `Table`'s and `List`'s do: an
 * empty flex child still takes its parent's gap and would make the drawn page
 * taller than the flow the plan was measured against.
 *
 * **`rule` is for a document printed before it is filled.** A value the
 * artifact has no answer for prints the document's blank placeholder, an em
 * dash, which is the right mark for a document nobody is going to write on and
 * the wrong one for a document somebody is. `rule` draws the underscore run a
 * person signs or writes on instead, the same way `Signature` draws its own.
 */
/** @jsxRuntime classic */
import React from "react";
import {
  flowGapClasses,
  imageSource,
  MissingImageSizeError,
  scaleTextClasses,
  useAnnexPicture,
  useDocumentTokens,
  useField,
  usePage,
} from "@paradoc/react";
import { KeepTogether } from "./keep-together";

/**
 * The fill line `rule` draws: twenty-four underscores.
 *
 * Underscores rather than a bottom border, for the reason `Signature`'s rules
 * are underscores — a rule drawn as a border is a box the engine sizes from
 * the text inside it, and there is no text inside an unanswered field.
 */
export const FIELD_RULE = "________________________";

/**
 * A blank line: two line endings with nothing but spaces or tabs between them.
 *
 * `\r\n` as well as `\n`, because the value is whatever a filler pasted, and
 * prose pasted out of a Windows editor arrives with carriage returns. A
 * pattern that missed them would silently leave that value as one keep — the
 * oversize case this component exists to remove.
 */
const PARAGRAPH_BREAK = /\r?\n(?:[ \t]*\r?\n)+/u;

/**
 * `text` split into paragraphs at its blank lines, each one trimmed.
 *
 * Trimmed because the split leaves the whitespace that surrounded a blank line
 * on the paragraphs either side of it, and a paragraph that began with a
 * newline would draw an empty first line. So a value padded with whitespace
 * prints tighter here than it does in the single-keep path, which draws the
 * value exactly as the formatter returned it.
 *
 * Never empty: a value that is nothing but blank lines is still a field the
 * composition asked for, and a field that vanished would take its label with
 * it and leave the plan a keep short.
 */
export function fieldParagraphs(text: string): string[] {
  const parts = text.split(PARAGRAPH_BREAK).map((part) => part.trim()).filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [text];
}

export interface FieldProps {
  /** Path into the artifact this field reads its label and value from. `as="image"` names an annex slot as `annexes.<slot>`. */
  path: string;
  /** Overrides the field's heading: a string replaces it, `false` hides it, omitted uses the artifact's own label. */
  label?: string | false;
  /**
   * How the value is printed. `"image"` draws the attachment at `annexes.<slot>`
   * as a picture, and prints its file name when its MIME type is not one.
   * @default "text"
   */
  as?: "text" | "image";
  /** Rendered width in CSS pixels. Required by `as="image"`, whatever the slot holds; ignored by `as="text"`. */
  width?: number;
  /** Rendered height in CSS pixels. Required by `as="image"`, whatever the slot holds; ignored by `as="text"`. */
  height?: number;
  /** Where a browser preview loads an `as="image"` picture from. Defaults to the attachment's own file name, which is the key the PDF path supplies its bytes under. Ignored by `as="text"`. */
  src?: string;
  /**
   * Splits the value at its blank lines and paginates each paragraph on its own, keyed `field:<path>:<index>`. Text only: ignored by `as="image"`, which is always one keep.
   *
   * @default false
   */
  paragraphs?: boolean;
  /**
   * Draws a fill line in place of the blank placeholder when the artifact has no value at this path. Text only: ignored by `as="image"`, which prints the slot's own placeholder.
   *
   * @default false
   */
  rule?: boolean;
  /** Classes for the field's wrapping element: the keep itself, or the element holding the paragraphs. */
  className?: string;
}

/** The heading a field row carries, or nothing when the caller hid it. */
function FieldHeading({ heading }: { heading: string | undefined }) {
  const { typography } = useDocumentTokens();
  if (!heading) return null;
  return (
    <span className={scaleTextClasses("text-xs font-medium uppercase tracking-wide text-neutral-500", typography.scale)}>
      {heading}
    </span>
  );
}

function FieldValue({ path, label, paragraphs = false, rule = false, className }: FieldProps) {
  const binding = useField(path);
  const { dir, typography } = useDocumentTokens();
  const page = usePage();
  const heading = label === false ? undefined : (label ?? binding.field.label ?? path);
  const isolated = dir === "rtl" && ["phone", "identification"].includes(binding.field.type);
  const text = rule && binding.blank ? FIELD_RULE : binding.text;
  const headingText = <FieldHeading heading={heading} />;
  const valueText = (part: string) => (
    <span className="whitespace-pre-line text-neutral-900" style={isolated ? { direction: "ltr", unicodeBidi: "isolate" } : undefined}>
      {part}
    </span>
  );

  if (!paragraphs) {
    return (
      <KeepTogether keepId={`field:${path}`} data-field-path={path} className={className ?? "flex flex-col gap-0.5"}>
        {headingText}
        {valueText(text)}
      </KeepTogether>
    );
  }

  const parts = fieldParagraphs(text);
  const keepIds = parts.map((_part, index) => `field:${path}:${index}`);
  if (page && !keepIds.some((keepId) => page.keeps.has(keepId))) return null;
  // `gap-3` rather than `gap-2`, for the reason `List` starts there: `flow`
  // moves a gap two spacing units per level, so a paragraph gap set at `gap-2`
  // would reach `gap-0` at compact and run the paragraphs together.
  return (
    <div className={className ?? flowGapClasses("flex flex-col gap-3", typography.flow)} data-field-path={path}>
      {parts.map((part, index) => (
        <KeepTogether key={keepIds[index]} keepId={keepIds[index]!} className="flex flex-col gap-0.5">
          {index === 0 ? headingText : null}
          {valueText(part)}
        </KeepTogether>
      ))}
    </div>
  );
}

/**
 * One annex's attachment, drawn when it is a picture and named when it is not.
 *
 * The mismatch is reported to a running check rather than thrown: the document
 * still says truthfully what is attached, and the composition's author learns
 * before a render that the slot they asked to draw holds something else. The
 * report is the binding's, not this file's, so a copy of this component that
 * draws the picture differently still produces it.
 */
function FieldImage({ path, label, width, height, src, className }: FieldProps) {
  const binding = useAnnexPicture(path);
  const heading = label === false ? undefined : (label ?? binding.label);
  // Checked whatever the slot holds, so a composition cannot pass a check
  // against a sample with nothing attached and then throw on the day a real
  // photograph arrives.
  if (width === undefined || height === undefined) {
    throw new MissingImageSizeError(`attachment at "${path}"`);
  }
  const { attachment, picture } = binding;
  return (
    <KeepTogether keepId={`field:${path}`} data-field-path={path} className={className ?? "flex flex-col gap-0.5"}>
      <FieldHeading heading={heading} />
      {picture === undefined ? (
        <span className="whitespace-pre-line text-neutral-900">{attachment?.name ?? binding.text}</span>
      ) : (
        <img
          src={imageSource({ src: src ?? picture.name }, `attachment at "${path}"`)}
          // The slot's own declared title, which is human copy; the file name
          // would read out an extension to anyone listening to the document.
          alt={binding.label}
          width={width}
          height={height}
          // Declared twice: the engine reads the attributes, and a browser reads
          // the inline size, because Tailwind's preflight sets
          // `img { height: auto }` and an author rule beats a presentational
          // hint. See `Image`.
          style={{ width, height }}
        />
      )}
    </KeepTogether>
  );
}

/**
 * One value at a path, printed as text or drawn as a picture.
 *
 * The two forms are separate components rather than one branching body: each
 * binds what it actually reads, a field or an annex, and switching `as` at
 * runtime remounts rather than reordering hooks.
 */
export function Field({ as = "text", ...props }: FieldProps) {
  return as === "image" ? <FieldImage {...props} /> : <FieldValue {...props} />;
}
