/**
 * Static prose in a named role.
 *
 * A composition's headings, paragraphs, captions and fine print were raw
 * markup until now, each one sized by hand, which is how a document ends up
 * with four spellings of the same paragraph. `Text` names the four roles a
 * document actually has and gives each one its size and leading from the
 * document's `typography` token, so an installed heading moves with the fields
 * around it rather than staying where its author left it.
 *
 * **It is a pagination unit.** Prose is the content most likely to sit at a
 * page boundary, so every `Text` is a `KeepTogether` with an id of its own and
 * is never split. That is also why `keepId` is required rather than derived:
 * the plan names a unit by id, and an id the composition did not choose is an
 * id it cannot hint the PDF with. For the same reason a `Text` never goes
 * inside another keep — a keep inside a keep is measured twice.
 *
 * **An explicit `className` wins**, as everywhere else: passing one replaces
 * the role's classes outright, which is how a copy owner pins one piece of
 * prose while the rest of the document still follows the token.
 */
/** @jsxRuntime classic */
import React from "react";
import { scaleTextClasses, useDocumentTokens } from "@paradoc/react";
import type { TypographyLevel } from "@paradoc/react";
import type { ElementType, ReactNode } from "react";
import { KeepTogether } from "./keep-together";

/** The prose roles a document has. */
export type TextRole = "heading" | "body" | "caption" | "small";

/**
 * Each role's own classes, at the document's scale.
 *
 * A function per role rather than a literal per role: the size and the leading
 * have to reach `scaleTextClasses` for the token to move them, and the guard
 * suite reads that call rather than trusting the component to make it.
 */
const ROLE_CLASSES: Record<TextRole, (scale: TypographyLevel) => string> = {
  heading: (scale) => scaleTextClasses("text-lg font-semibold leading-tight text-neutral-900", scale),
  body: (scale) => scaleTextClasses("text-sm leading-relaxed text-neutral-800", scale),
  caption: (scale) => scaleTextClasses("text-xs italic leading-snug text-neutral-500", scale),
  small: (scale) => scaleTextClasses("text-xs leading-snug text-neutral-600", scale),
};

/** The element each role renders as when the caller names none. */
const ROLE_ELEMENTS: Record<TextRole, ElementType> = {
  heading: "h2",
  body: "p",
  caption: "p",
  small: "p",
};

export interface TextProps {
  /** Stable id the page plan tracks this prose by; must be unique within the document. */
  keepId: string;
  /**
   * Which role the prose plays. Sets its size and leading from the document's typography token.
   *
   * @default "body"
   */
  role?: TextRole;
  /**
   * Element the prose renders as.
   *
   * @default "h2" for a heading, "p" for every other role
   */
  as?: ElementType;
  /** Classes replacing the role's own size, leading, weight and colour. */
  className?: string;
  /** The prose. */
  children?: ReactNode;
}

export function Text({ keepId, role = "body", as, className, children }: TextProps) {
  const { typography } = useDocumentTokens();
  return (
    <KeepTogether
      keepId={keepId}
      as={as ?? ROLE_ELEMENTS[role]}
      data-text-role={role}
      className={className ?? ROLE_CLASSES[role](typography.scale)}
    >
      {children}
    </KeepTogether>
  );
}
