---
name: parties
description: Party roles on a form. Role properties, required and optional roles, signature and payment requirements, and the exact party fill value.
metadata:
  tags: parties, roles, partyType, min, max, payment, witnesses, notary, party data
---

# Parties

**Contents:** [Role properties](#role-properties) · [Required and optional roles](#required-and-optional-roles) · [Signature requirements](#signature-requirements) · [Payment](#payment) · [Patterns](#patterns) · [Party fill values](#party-fill-values) · [SDK](#sdk)

A party role names who takes part in a form: `landlord`, `tenant`, `buyer`. Each role is filled with one or more people or organizations. Only forms have parties. Role keys are camelCase, up to 50 characters ([schemas.md § Identifier patterns](./schemas.md#identifier-patterns)). When the task signs or seals (signers, signatories, slots, captures), load [sealing.md](./sealing.md).

## Role properties

| Property | Type | Default | Constraint |
|----------|------|---------|------------|
| `label` | string | none | Required. 1-100 characters. |
| `description` | string | none | Up to 500 characters |
| `partyType` | `"person"`, `"organization"`, `"any"` | `"any"` | Which kind of party may fill the role |
| `min` | number ≥ 0 | `1` | Fewest parties |
| `max` | number ≥ 1 | `1` | Most parties. Must be at least `min`. |
| `required` | CondExpr | none | `true`, `false`, or a boolean expression |
| `signature` | object | none | See [Signature requirements](#signature-requirements) |
| `payment` | object | none | See [Payment](#payment) |

## Required and optional roles

`min` defaults to `1`, so a role is required unless you say otherwise. `prepareForSigning()` fails with `Role "guarantor" requires at least 1 party(ies)` when a required role is empty.

| Intent | Write |
|--------|-------|
| Required, one party | nothing extra (or `"required": true`) |
| Optional | `"min": 0` or `"required": false` |
| Required only when a condition holds | `"required": "fields.creditScore < 650"` |
| One to four parties | `"min": 1, "max": 4` |

A conditional `required` must type-check as boolean ([logic.md § Conditions are boolean](./logic.md#conditions-are-boolean)). When it is false, the role is optional.

## Signature requirements

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `required` | boolean | `false` | The role must sign |
| `witnesses` | number ≥ 0 | `0` | Witnesses required for this role's signature |
| `notarized` | boolean | `false` | At least one witness must be a notary |

Put witnesses on the role they witness. A form's general witness block belongs to the last party that signs. Put `notarized: true` on the role whose signature the notary block certifies. To add witnesses and attestations at runtime, load [sealing.md § Witnesses and attestations](./sealing.md#witnesses-and-attestations).

## Payment

`payment` declares an amount a role owes.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `required` | boolean | `false` | Payment is required |
| `amount` | Money or MoneyExpression | none | Required. A fixed amount, or one computed from filled data. |

A fixed amount is Money: `{ "amount": 100, "currency": "USD" }`. A computed amount is a MoneyExpression: `{ "type": "money", "value": { "amount": "<number expression>", "currency": "<string expression>" } }`. Both component strings are expressions, so a literal currency is quoted: `"'USD'"`, and a money field is read as `fields.fee.amount` ([logic.md § Money](./logic.md#money)).

```json schema=form
"fields": {
  "units": { "type": "number", "label": "Units", "min": 1 }
},
"parties": {
  "applicant": {
    "label": "Applicant",
    "partyType": "person",
    "payment": {
      "required": true,
      "amount": { "type": "money", "value": { "amount": "fields.units * 25", "currency": "'USD'" } }
    }
  },
  "sponsor": {
    "label": "Sponsor",
    "min": 0,
    "payment": { "amount": { "amount": 100, "currency": "USD" } }
  }
}
```

Resolve the amount with `resolvePartyPayment(form, payment, data)` from `@paradoc/sdk`. It returns `{ required, amount: { amount, currency } }` and throws when an input is missing:

```typescript
import { p, resolvePartyPayment } from "@paradoc/sdk";

const form = p.form({
  name: "app-fee",
  fields: { units: { type: "number", min: 1 } },
  parties: {
    applicant: {
      label: "Applicant",
      payment: { required: true, amount: { type: "money", value: { amount: "fields.units * 25", currency: "'USD'" } } },
    },
  },
});

const due = resolvePartyPayment(form, form.parties.applicant.payment, { fields: { units: 3 } });
// { required: true, amount: { amount: 75, currency: "USD" } }
```

## Patterns

Two-party agreement:

```json schema=parties
"landlord": {
  "label": "Landlord",
  "partyType": "any",
  "signature": { "required": true }
},
"tenant": {
  "label": "Tenant",
  "partyType": "person",
  "min": 1,
  "max": 4,
  "signature": { "required": true }
}
```

Conditional guarantor, notarized seller, and an optional co-applicant:

```json schema=form
"fields": {
  "creditScore": { "type": "number", "label": "Credit score" }
},
"parties": {
  "guarantor": {
    "label": "Guarantor",
    "partyType": "person",
    "required": "fields.creditScore < 650",
    "signature": { "required": true }
  },
  "seller": {
    "label": "Seller",
    "signature": { "required": true, "witnesses": 1, "notarized": true }
  },
  "coApplicant": {
    "label": "Co-applicant",
    "partyType": "person",
    "min": 0,
    "signature": { "required": true }
  }
}
```

### Role names by domain

| Domain | Roles |
|--------|-------|
| Lease | `tenant`, `landlord`, `guarantor`, `propertyManager` |
| Purchase | `buyer`, `seller`, `buyerAgent`, `sellerAgent`, `escrowOfficer` |
| Loan | `borrower`, `coBorrower`, `lender`, `loanOfficer` |
| Employment | `applicant`, `hiringManager`, `hrRepresentative` |
| Healthcare | `patient`, `guardian`, `physician` |
| Tax | `taxpayer`, `preparer` |
| Contract | `partyA`, `partyB` |

### partyType

| Source form shows | `partyType` |
|-------------------|-------------|
| A person's name only | `person` |
| Company name, entity type, or EIN | `organization` |
| Either an individual or a business | `any` |

### min and max

| Source form shows | `min` | `max` |
|-------------------|-------|-------|
| One required signer | `1` | `1` |
| An optional signer | `0` | `1` |
| "Tenant(s)", one or more | `1` | an estimate, such as `4` |
| "Buyer 1" and "Buyer 2" blocks | `1` | `2` |
| Up to two co-applicants | `0` | `2` |

To bind one party of a multi-party role into a PDF, load [pdf.md § Binding values](./pdf.md#binding-values).

## Party fill values

Put party data under `parties.<role>` in the payload.

<!-- dep:C3 -->
A role key at the top level of the payload is rejected.

| Role `max` | Value |
|------------|-------|
| `1` (default) | One object. An array fails with `Party value must be an object.` |
| `> 1` | An array, even for one party. An object fails with `Role "tenant" expects an array of parties (max=4).` |

Each party is a person or an organization. The type is inferred from its keys:

| Kind | Keys | Inferred when |
|------|------|---------------|
| Person | `name` (required), `title`, `firstName`, `middleName`, `lastName`, `suffix` | No organization key is present |
| Organization | `name` (required), `legalName`, `domicile`, `entityType`, `entityId`, `taxId` | At least one of `legalName`, `domicile`, `entityType`, `entityId`, `taxId` is present |

So an `organization` role filled with `{ "name": "Acme" }` alone is read as a person and fails with `Party type 'person' not allowed for this role. Expected 'organization'`. Give it one organization key, such as `legalName`. A party takes only these keys; put its email, phone or address in fields.

`id` is optional on input. Core assigns `<role>-<index>` (`tenant-0`, `tenant-1`) and refuses an `id` that does not match the party's position.

```jsonc
// Payload for fill() or update()
{
  "fields": { "creditScore": 720 },
  "parties": {
    "landlord": { "name": "Acme Rentals", "legalName": "Acme Rentals LLC" },
    "tenant": [{ "name": "Jo Park" }, { "name": "Al Park" }]
  }
}
```

Change parties on a draft with `update()`. A role in the patch replaces that role's parties; roles not in the patch stay as they are. For the rest of the draft lifecycle, load [filling.md](./filling.md).

```typescript
// lease: the form built in the SDK section below
let draft = lease.fill({ parties: { tenant: [{ name: "Jo Park" }] } });
draft = draft.update({ parties: { landlord: { name: "Acme Rentals", legalName: "Acme Rentals LLC" } } });

draft.getParty("landlord"); // { name: "Acme Rentals", legalName: "Acme Rentals LLC", id: "landlord-0" }
draft.getParties("tenant"); // [{ name: "Jo Park", id: "tenant-0" }]
```

Expressions and templates read parties as `parties.<role>` and through the party functions ([logic.md § Party and witness functions](./logic.md#party-and-witness-functions)).

## SDK

`p.form({ ... })` takes plain role objects. The builder chain takes `p.party()` builders or plain objects.

```typescript
import { p } from "@paradoc/sdk";

const lease = p
  .form()
  .name("lease")
  .parties({
    landlord: p.party().label("Landlord").signature({ required: true }),
    tenant: p.party().label("Tenant").partyType("person").min(1).max(4).signature({ required: true }),
    guarantor: p.party().label("Guarantor").required("fields.creditScore < 650"),
  })
  .fields({ creditScore: { type: "number" } })
  .build();
```

| Method | Sets |
|--------|------|
| `.label(text)` | `label` |
| `.description(text)` | `description` |
| `.partyType("person" \| "organization" \| "any")` | `partyType` |
| `.min(n)`, `.max(n)` | `min`, `max` |
| `.required(cond = true)` | `required` |
| `.signature({ required?, witnesses?, notarized? })` | `signature` |
| `.from(role)` | Every property of an existing role, including `payment` |
| `.build()` | Validates and returns the role |

Declare `payment` in a plain role object, or seed the builder with `.from({ label, payment })`; the builder has no `payment` method.

