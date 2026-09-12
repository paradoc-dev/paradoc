/**
 * The certificate of insurance the vendor packet carries as an annex.
 *
 * **Sample material, not a stable API**, for the reason `./examples` gives.
 *
 * An annex is a document nobody in the packet composed: a vendor uploads a PDF
 * their broker issued and the packet carries it. There is no such broker here,
 * so the sample composes a plausible one and renders it to PDF through the
 * default adapter, and the packet then treats those bytes exactly as it would
 * treat an upload: opaque content with a name and a type, painted page by page
 * on screen and merged into the packet at the seal.
 *
 * That is the only thing this composition is for. It carries no signature slot
 * and it is not a part of the packet as a composition; only its bytes are.
 */
/** @jsxRuntime classic */
import React from "react";
import { p } from "@paradoc/core";
import type { Form } from "@paradoc/types";

import { Document } from "../components/document";
import type { DocumentData } from "@paradoc/react";
import { scaleTextClasses, useDocumentTokens } from "@paradoc/react";
import { Field } from "../components/field";
import { KeepTogether } from "../components/keep-together";
import { Section } from "../components/section";
import { Table } from "../components/table";

/** The certificate form, exactly as authored. */
export const insuranceCertificateSpec = {
  $schema: "https://schema.paradoc.dev/schema.json",
  kind: "form",
  name: "certificate-of-insurance",
  version: "1.0.0",
  title: "Certificate of Insurance",
  description:
    "Evidence that the named insured carries the coverage listed, issued to a certificate holder. Sample material: it stands in for the PDF a broker would issue.",
  metadata: { domain: "insurance" },
  fields: {
    certificateNumber: { type: "text", label: "Certificate number", maxLength: 40, required: true, visible: true },
    issuedOn: { type: "date", label: "Issued", required: true, visible: true },
    insurer: { type: "organization", label: "Insurer", required: true, visible: true },
    insured: { type: "organization", label: "Named insured", required: true, visible: true },
    insuredAddress: { type: "address", label: "Insured address", required: true, visible: true },
    certificateHolder: { type: "organization", label: "Certificate holder", required: true, visible: true },
    effectiveOn: { type: "date", label: "Effective", required: true, visible: true },
    expiresOn: { type: "date", label: "Expires", required: true, visible: true },
    coverages: {
      type: "list",
      label: "Coverage",
      minItems: 1,
      required: true,
      visible: true,
      item: {
        type: "fieldset",
        label: "Coverage",
        fields: {
          coverage: { type: "text", label: "Coverage", maxLength: 120, required: true, visible: true },
          policyNumber: { type: "text", label: "Policy number", maxLength: 40, required: true, visible: true },
          limit: { type: "money", label: "Limit", min: 0, required: true, visible: true },
        },
      },
    },
    remarks: { type: "text", label: "Remarks", maxLength: 600, required: false, visible: true },
  },
} as const;

/** The parsed certificate form. */
export const insuranceCertificate = p.form(insuranceCertificateSpec);

/** The same artifact as a plain `Form`. */
export const insuranceCertificateForm: Form = insuranceCertificate.toJSON() as Form;

/** The sample certificate's values. */
export const insuranceCertificateData: DocumentData = {
  fields: {
    certificateNumber: "COI-2026-44812",
    issuedOn: "2026-08-28",
    insurer: { name: "Meridian Casualty", legalName: "Meridian Casualty Company", domicile: "US" },
    insured: { name: "Northgate Systems", legalName: "Northgate Systems, LLC", domicile: "US" },
    insuredAddress: {
      line1: "1400 Rio Grande Street",
      line2: "Suite 220",
      locality: "Austin",
      region: "TX",
      postalCode: "78701",
      country: "US",
    },
    certificateHolder: { name: "Harbor Freight Collective", legalName: "Harbor Freight Collective, Inc.", domicile: "US" },
    effectiveOn: "2026-01-01",
    expiresOn: "2026-12-31",
    coverages: [
      { coverage: "Commercial general liability, each occurrence", policyNumber: "GL-8842190", limit: { amount: 2000000, currency: "USD" } },
      { coverage: "Workers compensation, each accident", policyNumber: "WC-5510337", limit: { amount: 1000000, currency: "USD" } },
      { coverage: "Professional liability, each claim", policyNumber: "PL-2298104", limit: { amount: 5000000, currency: "USD" } },
    ],
    remarks:
      "The certificate holder is an additional insured on the general liability policy for work performed under purchase order PO-2026-0512.",
  },
  parties: {},
};

export interface InsuranceCertificateDocumentProps {
  /** The certificate data to render. Defaults to the sample's own. */
  data?: DocumentData;
  /** Overrides the artifact, for tests that vary it. */
  artifact?: Form;
}

/**
 * The composition's content, below the `Document` that supplies its tokens: a
 * hook called in `InsuranceCertificateDocument`'s own body would see the package's defaults.
 * Every size and leading here is routed through the token, so the whole
 * document follows `typography` rather than the components alone.
 */
function InsuranceCertificateBody({ artifact }: { artifact: Form }) {
  const { typography } = useDocumentTokens();
  const type = (classes: string) => scaleTextClasses(classes, typography.scale);
  return (
    <>

      <Section id="masthead" className="flex flex-row justify-between gap-8 border-b border-neutral-800 pb-4">
        <div className="flex basis-1/2 flex-col gap-1">
          <KeepTogether as="span" keepId="title" className={type("text-lg font-semibold text-neutral-900")}>
            {artifact.title}
          </KeepTogether>
          <Field path="insurer" label={false} className={type("text-sm text-neutral-700")} />
        </div>
        <div className="flex basis-1/3 flex-col gap-2">
          <Field path="certificateNumber" />
          <Field path="issuedOn" />
        </div>
      </Section>

      <Section id="insured" title="Named insured" className="flex flex-col gap-1">
        <Field path="insured" label={false} className={type("text-sm font-medium text-neutral-900")} />
        <Field path="insuredAddress" label={false} className={type("text-sm text-neutral-600")} />
      </Section>

      <Section id="holder" title="Certificate holder" className="flex flex-col gap-1">
        <Field path="certificateHolder" label={false} className={type("text-sm font-medium text-neutral-900")} />
      </Section>

      <Section id="period" title="Policy period" className="flex flex-row gap-10">
        <Field path="effectiveOn" />
        <Field path="expiresOn" />
      </Section>

      <Section id="coverages" title="Coverage">
        <Table
          path="coverages"
          id="coverages"
          columns={[
            { field: "coverage", width: "basis-1/2" },
            { field: "policyNumber", header: "Policy", width: "basis-1/4" },
            { field: "limit", width: "basis-1/4", align: "right" },
          ]}
        />
      </Section>

      <Section id="remarks" title="Remarks">
        <Field path="remarks" label={false} className={type("text-sm leading-relaxed text-neutral-800")} />
      </Section>
    </>
  );
}

/** The composed certificate. */
export function InsuranceCertificateDocument({
  data = insuranceCertificateData,
  artifact = insuranceCertificateForm,
}: InsuranceCertificateDocumentProps = {}) {
  return (
    <Document artifact={artifact} data={data} id="certificate-of-insurance">
      <InsuranceCertificateBody artifact={artifact} />
    </Document>
  );
}

export default InsuranceCertificateDocument;
