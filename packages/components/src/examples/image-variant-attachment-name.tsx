/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/image` docs page's "Attachment that is not a picture"
 * variant: the same `Field` prints the attachment's file name, because the
 * survey report is a PDF.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";

export function ImageVariantAttachmentName() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="image-variant-attachment-name">
      <Field path="annexes.surveyReport" as="image" width={160} height={160} />
    </Document>
  );
}
