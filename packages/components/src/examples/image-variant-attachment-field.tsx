/** @jsxRuntime classic */
import React from "react";

/**
 * The `/components/image` docs page's "Attachment field" variant: `Field` with
 * `as="image"` draws the attachment at an annex slot, at the declared size.
 */

import { Document } from "../components/document";
import { Field } from "../components/field";
import { proposalForm } from "./proposal";
import { shortProposalData } from "./proposal-data";
import { sitePhotoDataUri } from "./sample-image";

export function ImageVariantAttachmentField() {
  return (
    <Document artifact={proposalForm} data={shortProposalData} id="image-variant-attachment-field">
      <Field path="annexes.sitePhoto" as="image" width={160} height={160} src={sitePhotoDataUri} />
    </Document>
  );
}
