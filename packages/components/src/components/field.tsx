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
 */
/** @jsxRuntime classic */
import React from "react";
import {
  imageSource,
  MissingImageSizeError,
  scaleTextClasses,
  useAnnexPicture,
  useDocumentTokens,
  useField,
} from "@paradoc/react";
import { KeepTogether } from "./keep-together";

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
  /** Rendered width in CSS pixels. Required by `as="image"`, whatever the slot holds. */
  width?: number;
  /** Rendered height in CSS pixels. Required by `as="image"`, whatever the slot holds. */
  height?: number;
  /** Where a browser preview loads the picture from. Defaults to the attachment's own file name, which is the key the PDF path supplies its bytes under. */
  src?: string;
  /** Classes for the field's wrapping element. */
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

function FieldValue({ path, label, className }: FieldProps) {
  const binding = useField(path);
  const { dir } = useDocumentTokens();
  const heading = label === false ? undefined : (label ?? binding.field.label ?? path);
  const isolated = dir === "rtl" && ["phone", "identification"].includes(binding.field.type);
  return (
    <KeepTogether keepId={`field:${path}`} data-field-path={path} className={className ?? "flex flex-col gap-0.5"}>
      <FieldHeading heading={heading} />
      <span className="whitespace-pre-line text-neutral-900" style={isolated ? { direction: "ltr", unicodeBidi: "isolate" } : undefined}>
        {binding.text}
      </span>
    </KeepTogether>
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
