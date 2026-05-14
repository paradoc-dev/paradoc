// src/inspect.ts

import {
  PDFDocument,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  PDFButton,
  PDFSignature,
} from "pdf-lib";

import type { BinaryContent } from "@paradoc/types";

export type PdfFieldType =
  | "text"
  | "checkbox"
  | "dropdown"
  | "radio"
  | "button"
  | "signature"
  | "unknown";

export interface PdfFieldInfo {
  name: string;
  type: PdfFieldType;
  value?: string | boolean | string[];
  required?: boolean;
  page?: number;
  rect?: [number, number, number, number];
  maxLen?: number | null;
}

export interface InspectOptions {
  includeButton?: boolean;
  includeSignature?: boolean;
}

/**
 * Inspect a PDF template and return basic information about its AcroForm fields.
 *
 * @param template - PDF bytes (BinaryContent / Uint8Array)
 * @param options - Optional configuration to include button and signature fields
 */
export async function inspectAcroFormFields(
  template: BinaryContent,
  options: InspectOptions = {}
): Promise<PdfFieldInfo[]> {
  const { includeButton = false, includeSignature = false } = options;

  const pdfDoc = await PDFDocument.load(template, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const pages = pdfDoc.getPages();

  // Build page ref → 1-based index lookup
  const pageRefMap = new Map<string, number>();
  for (const [i, p] of pages.entries()) {
    pageRefMap.set(p.ref.toString(), i + 1);
  }

  return fields
    .map((field): PdfFieldInfo | null => {
      const name = field.getName();
      let type: PdfFieldType = "unknown";
      let value: string | boolean | string[] | undefined;
      let required: boolean | undefined;
      let maxLen: number | null | undefined;

      if (field instanceof PDFTextField) {
        type = "text";
        value = field.getText();
        required = field.isRequired();
        maxLen = field.getMaxLength() ?? null;
      } else if (field instanceof PDFCheckBox) {
        type = "checkbox";
        value = field.isChecked();
        required = field.isRequired();
      } else if (field instanceof PDFDropdown) {
        type = "dropdown";
        value = field.getSelected();
        required = field.isRequired();
      } else if (field instanceof PDFRadioGroup) {
        type = "radio";
        value = field.getSelected();
        required = field.isRequired();
      } else if (field instanceof PDFButton) {
        type = "button";
        if (!includeButton) return null;
      } else if (field instanceof PDFSignature) {
        type = "signature";
        if (!includeSignature) return null;
      }

      // Extract page and rect from the first widget
      let page: number | undefined;
      let rect: [number, number, number, number] | undefined;
      const widget = field.acroField.getWidgets()[0];
      if (widget) {
        const r = widget.getRectangle();
        rect = [r.x, r.y, r.x + r.width, r.y + r.height];
        const pageRef = widget.P();
        if (pageRef) {
          page = pageRefMap.get(pageRef.toString());
        }
      }

      return { name, type, value, required, page, rect, maxLen };
    })
    .filter((field): field is PdfFieldInfo => field !== null);
}
