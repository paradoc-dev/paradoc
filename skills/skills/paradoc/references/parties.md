---
name: parties
description: Party roles, signature requirements, and signers — JSON shape, SDK builders, witness/notary handling, conditional parties
metadata:
  tags: parties, signatures, signers, roles, witnesses, notary, partyType
---

# Parties

**Contents:** [Identifier rules](#party-role-identifier-rules) · [FormParty properties](#formparty-properties) · [Signature object](#signature-object) · [Common patterns](#common-patterns) · [Signature lifecycle](#signature-lifecycle-sdk)

Parties represent roles in a form (landlord, tenant, buyer, seller). Each role can have one or more signers. Parties are **form-only** — documents, bundles, and checklists do NOT have parties.

## Party Role Identifier Rules

- Pattern: `^[a-z][a-zA-Z0-9_]*$`
- camelCase: `buyer`, `seller`, `landlord`, `buyerRepresentative`
- Max length: 50 characters

## FormParty Properties

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `label` | YES | string | Display name for this role (max 100 chars) |
| `description` | No | string | Description (max 500 chars) |
| `partyType` | No | string | `"person"`, `"organization"`, or `"any"` (default `"any"`) |
| `min` | No | number | Minimum parties required (default `1`, min `0`) |
| `max` | No | number | Maximum parties allowed (default `1`, min `1`) |
| `required` | No | CondExpr | Whether this role is required |
| `signature` | No | object | Signature requirements |

## Signature Object

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `required` | boolean | `false` | Whether signature is required |
| `witnesses` | number | `0` | Number of witnesses required |
| `notarized` | boolean | `false` | Whether at least one witness must be a notary |

## Common Patterns

### Two-party agreement (landlord/tenant, buyer/seller)

```json
"parties": {
  "tenant": {
    "label": "Tenant",
    "partyType": "person",
    "min": 1, "max": 4,
    "required": true,
    "signature": { "required": true }
  },
  "landlord": {
    "label": "Landlord",
    "partyType": "any",
    "required": true,
    "signature": { "required": true }
  }
}
```

### Single signer with witness

```json
"applicant": {
  "label": "Applicant",
  "partyType": "person",
  "required": true,
  "signature": { "required": true, "witnesses": 1 }
}
```

### Conditional party

```json
"guarantor": {
  "label": "Guarantor",
  "partyType": "person",
  "required": "fields.creditScore < 650",
  "signature": { "required": true }
}
```

### Notarized signature

```json
"seller": {
  "label": "Seller",
  "partyType": "any",
  "required": true,
  "signature": { "required": true, "witnesses": 1, "notarized": true }
}
```

### Multi-party role (multiple tenants)

Set `max > 1`. In layers, use `partyIndex` (0-based) to target individual parties — see [layers.md](./layers.md).

```json
"tenant": {
  "label": "Tenant",
  "partyType": "person",
  "min": 1, "max": 4,
  "signature": { "required": true }
}
```

## Witnesses

Do NOT create a separate party role for witnesses. Set `witnesses` count on the party that requires witnessing.

If the PDF/form has a general witness block not tied to a specific party, attach it to the most relevant party (typically the last signing party).

## Notary

If the notary block is attached to a specific party's signature, set `notarized: true` on that party. If standalone, set on the primary party role.

## Common Role Names by Domain

| Domain | Common Roles |
|--------|-------------|
| Real estate lease | `tenant`, `landlord`, `guarantor`, `propertyManager` |
| Purchase agreement | `buyer`, `seller`, `buyerAgent`, `sellerAgent`, `escrowOfficer` |
| Loan application | `borrower`, `coBorrower`, `lender`, `loanOfficer` |
| Employment | `applicant`, `hiringManager`, `hrRepresentative` |
| Healthcare | `patient`, `guardian`, `physician` |
| Tax forms | `taxpayer`, `preparer`, `paidPreparer` |
| Legal/contracts | `partyA`, `partyB`, `notary` |

### partyType selection

| Indicator | `partyType` |
|-----------|-------------|
| "Print Name" only (no company fields) | `person` |
| "Company Name" or "Organization" | `organization` |
| Could be either individual or business | `any` (default) |

### min/max selection

| Scenario | `min` | `max` |
|----------|-------|-------|
| Single required signer | `1` | `1` |
| Optional signer | `0` | `1` |
| "Tenant(s)" — one or more | `1` | `4` (estimate from context) |
| "Buyer 1" + "Buyer 2" blocks | `1` | `2` |
| Co-applicants | `0` | `2` |

## SDK Builders

```typescript
import { para } from "@paradoc/core";

// Object pattern (preferred)
const form = para.form({
  name: "lease",
  parties: {
    landlord: { label: "Landlord", required: true, signature: { required: true } },
    tenant: { label: "Tenant", min: 1, max: 4, signature: { required: true } },
  },
  fields: { /* ... */ },
});

// Builder pattern
const form = para.form()
  .name("lease")
  .parties({
    landlord: para.party().label("Landlord").signature({ required: true }),
    tenant: para.party().label("Tenant").multiple(true).min(1).max(4).signature({ required: true }),
  })
  .build();
```

### Party builder methods

| Method | Description |
|--------|-------------|
| `.label(string)` | Human-readable role name |
| `.description(string)` | Role description |
| `.partyType("person" \| "organization")` | Restrict to specific type |
| `.multiple(bool)` | Allow multiple individuals in this role |
| `.min(n)` / `.max(n)` | Min/max count |
| `.required(bool)` | Whether this role is required |
| `.signature({ required })` | Signature requirements |
| `.from(data)` | Create from existing party data |

## Party Data (runtime)

Party data is shape-inferred — no explicit discriminator field. The `id` is REQUIRED at runtime for signature tracking.

```typescript
// Person — default when no organization-specific fields present
{ id: "p1", name: "Jane Smith", firstName: "Jane", lastName: "Smith" }

// Organization — detected by legalName, taxId, entityType, etc.
{ id: "o1", name: "Acme Corp", legalName: "Acme Corporation LLC", taxId: "12-3456789" }
```

Party values are ALWAYS arrays at fill time, even for single-party roles:

```typescript
form.fill({
  fields: { /* ... */ },
  parties: {
    landlord: [{ id: "landlord-1", name: "Jane Smith" }],
    tenant: [
      { id: "tenant-1", name: "John Doe" },
      { id: "tenant-2", name: "Alice Doe" },
    ],
  },
});
```

## Signature Lifecycle (SDK)

```typescript
// 1. Fill the form (draft phase)
const draft = form.fill(data);

// 2. Manage signers
draft.addSigner("s1", { person: { name: "Jane Smith" } });

// 3. Transition to signable
const signable = draft.prepareForSigning();

// 4. Capture signatures (positional: role, partyId, signerId, locationId)
signable.captureSignature("landlord", "landlord-1", "s1", "sig-loc-1");

// 5. Status check
const status = signable.getOverallSignatureStatus();

// 6. Finalize
const executed = signable.finalize();
```

Phase transitions are one-way: `draft → signable → executed`. NEVER attempt to go backwards.

## Available Functions in Expressions

Party functions can be referenced in CondExpr (see [logic.md](./logic.md)):

| Function | Returns | Description |
|----------|---------|-------------|
| `partyCount(roleId)` | number | Count of parties in role |
| `partyType(roleId)` | string | `"person"` or `"organization"` |
| `allSigned(roleId)` | boolean | All parties signed |
| `signedCount(roleId)` | number | Count of signed parties |
| `anySigned(roleId)` | boolean | Any party signed |
| `witnessCount()` | number | Total witnesses |
| `allWitnessesSigned()` | boolean | All witnesses signed |
| `anyWitnessSigned()` | boolean | Any witness signed |

## See Also

- [layers.md](./layers.md) — signature blocks reference party roles
- [logic.md](./logic.md) — CondExpr and party functions
- [pdf-bindings.md](./pdf-bindings.md) — placing signature blocks in PDF layers
- [sdk.md](./sdk.md) — full signature lifecycle
