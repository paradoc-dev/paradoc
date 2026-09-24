---
name: filling
description: Progressive fill of a form draft. fill, update as the one way to change a draft, fill state and issues, checking input before applying it, clear and reset, persisting and resuming runtime instances, and @paradoc/sessions for conversational intake. Reading a filled PDF lives in pdf.md.
metadata:
  tags: fill, update, draft, progressive, fill-state, validation, persist, resume, rehydrate, sessions, intake
---

# Filling

**Contents:** [The draft](#the-draft) · [Fill](#fill) · [Update](#update) · [Fill state](#fill-state) · [Check input first](#check-input-first) · [Readiness](#readiness) · [Persist and resume](#persist-and-resume) · [Sessions](#sessions) · [Extract from a filled PDF](#extract-from-a-filled-pdf)

A **draft** is a filled but unsealed form. `fill()` creates it, `update()` changes it, and each call returns a new draft: reassign it. To build a value, look up its shape per field type in [fields.md](./fields.md) and per party in [parties.md § Party fill values](./parties.md#party-fill-values). To sign a finished draft, load [sealing.md](./sealing.md).

The examples use this form:

```typescript
import { p } from "@paradoc/sdk";

const lease = p.form({
  name: "residential-lease",
  fields: {
    propertyAddress: { type: "address", label: "Property address", required: true },
    monthlyRent: { type: "money", label: "Monthly rent", required: true },
    hasPets: { type: "boolean", label: "Pets allowed", default: false },
    petDeposit: { type: "money", label: "Pet deposit", visible: "fields.hasPets", required: "fields.hasPets" },
  },
  parties: {
    tenant: { label: "Tenant", partyType: "person", signature: { required: true } },
  },
  layers: {
    markdown: { kind: "inline", mimeType: "text/markdown", text: "Rent: {{fields.monthlyRent}}. Deposit: {{fields.petDeposit}}" },
  },
});
```

## The draft

<!-- dep:C1 -->
`update()` is the one way to change a draft's values.

| Step | Call | Returns |
|------|------|---------|
| Start | `form.fill(seed?, options?)` | `DraftForm` (throws `FormValidationError`) |
| Start, no throw | `form.safeFill(seed?, options?)` | `{ success: true, data: DraftForm }` or `{ success: false, error }` |
| Change | `draft.update(patch)` | `DraftForm` (throws `FormValidationError`) |
| Change, no throw | `draft.safeUpdate(patch)` | Same result shape as `safeFill` |
| Remove a value | `draft.clear("fields.<path>")` | `DraftForm` |
| Restore a default | `draft.reset("fields.<path>")` | `DraftForm` |
| Ask what is open | `draft.getFillState()` | `FillState` |
| Ask if complete | `draft.validate()` | `{ valid, errors, rules }` |

## Fill

```typescript
let draft = lease.fill(
  { fields: { monthlyRent: { amount: 1500, currency: "USD" } } },
  { context: { asOf: "2026-09-23T00:00:00Z" } },
);
```

- The seed is optional and may be partial. Supplied values are validated at once; omitted ones stay open.
- A field with a `default` gets it when the seed omits it, required or not.
- Seed keys: `fields`, `parties`, and `annexes`. Any other top-level key fails, naming it; a key that matches a declared party role says party data belongs under `parties.<role>`. To register signers, call `addSigner`/`addSignatory` on the draft ([sealing.md](./sealing.md)) instead of seeding them through `fill()`.
- `context.asOf` fixes the clock for `today()` and `now()` ([logic.md § Dates and the clock](./logic.md#dates-and-the-clock)). Set it for reproducible date logic and tests.
- `fill()` also checks the form's logic. A bad reference throws `Invalid form definition: Unknown variable: ...`.

## Update

```typescript
draft = draft.update({ fields: { hasPets: true } });
draft = draft.update({ parties: { tenant: { name: "Ada Lovelace" } } });
draft = draft.update({ fields: { propertyAddress: { line1: "1 Main St", locality: "Portland", region: "OR", postalCode: "97201", country: "US" } } });

const patch = JSON.parse('{"fields":{"monthlyRent":{"amount":"a lot"}}}'); // untyped input, such as a request body
const result = draft.safeUpdate(patch);
if (!result.success) console.error(result.error.message); // "Form data validation failed: Invalid input: expected number, received string"
```

| Patch value | Effect |
|-------------|--------|
| Object (address, money, fieldset) | Deep-merged into the stored value |
| List | Replaces the stored list |
| Party role | Replaces the role's parties. `update()` assigns ids `<role>-<index>`. |
| `null` | Rejected. Use `clear()`. |

`clear()` and `reset()` take a schema path: `fields.<id>`, a nested path such as `fields.employer.since`, or `annexes.<id>`. `reset()` restores the declared default, or removes the value when there is none. An unknown path throws `Invalid form path "fields.<id>": unknown field "<id>".`

`setParty(role, party)`, `addParty(role, party)`, `removeParty(role, index)` and `setAnnex(id, attachment)` are shortcuts for role and annex patches. Each returns a new draft. `removeParty` renumbers the later parties and keeps their signatories.

## Fill state

```typescript
const state = draft.getFillState();
state.summary;        // { requiredTotal, requiredDone, requiredRemaining, completionPercent }
state.next;           // { kind: "field" | "party" | "annex", key, required, order } or null
state.openRequired;   // visible, unfilled, required items
state.blocked;        // hidden until a prerequisite is filled; item.blockedBy lists it
state.rules;          // { valid, errors, warnings }: failed rules, same objects as validateRules()
state.issues;         // expressions that failed to evaluate: { message, path, expression? }
```

| Member | Detail |
|--------|--------|
| `candidates`, `next` | Fill targets, parties first, then fields, then annexes. Required only, unless you pass `{ includeOptional: true }`. |
| `openOptional`, `done` | Visible unfilled optional items; filled items |
| Item `status` | `hidden`, `optional` or `required`. `required` implies visible. |
| `issues` | Any issue blocks completion. When a `visible` or `required` condition fails, the rules are not run and `rules.valid` is `false`. |
| `defsValues` | Current def values |

`getNextFillTarget(options)` returns `state.next`. `getAvailableFillTargets(options)` returns the candidates. The options are `requiredFirst` (default `true`) and `includeOptional` (default `false`).

The per-field getters read the same logic: `isFieldVisible(id)`, `isFieldRequired(id)`, `isFieldDisabled(id)`, `getVisibleFields()`, `getRequiredVisibleFields()`, `isAnnexVisible(id)`, `isAnnexRequired(id)`, and `getLogicValue(defName)`.

A fill loop asks for the next target until nothing required is open:

```typescript
async function completeLease(ask: (target: { kind: string; key: string }) => Promise<unknown>) {
  let draft = lease.fill();
  for (let target = draft.getNextFillTarget(); target; target = draft.getNextFillTarget()) {
    const value = await ask(target);
    const section = target.kind === "party" ? "parties" : target.kind === "annex" ? "annexes" : "fields";
    const result = draft.safeUpdate({ [section]: { [target.key]: value } });
    if (result.success) draft = result.data; // otherwise ask again
  }
  return draft;
}
```

## Check input first

Check one answer before you apply it. These run on the design-time form, need no draft, and never require unrelated fields.

| Call | Input | Checks |
|------|-------|--------|
| `form.validateFieldInput({ fieldPath, value })` | `fieldPath` without the `fields.` prefix: `monthlyRent`, `propertyAddress.line1`, `pets[0]` | One field value |
| `form.validateFieldsPatch(fields)` | A partial `fields` object | Each supplied field |
| `form.validatePartyInput({ roleId, index?, value })` | One party | The party for the role; returns its normalized id |
| `form.validatePartiesPatch(parties)` | A partial `parties` object | Each supplied role |
| `form.validateAnnexInput({ annexId, value })` | One attachment | The annex key and the Attachment shape |
| `form.validateAnnexesPatch(annexes)` | A partial `annexes` object | Each supplied annex |

Each returns `{ success: true, value, errors: null }` or `{ success: false, value: null, errors: [{ field, message }] }`.

```typescript
const check = lease.validateFieldInput({ fieldPath: "monthlyRent", value: "ten" });
if (!check.success) console.error(check.errors[0].message); // "Invalid input: expected object, received string"
```

`form.parseData(payload)` and `form.safeParseData(payload)` check a **complete** submission. Missing required fields fail there, so use them on the final payload only.

## Readiness

```typescript
const report = draft.validate();
if (!report.valid) console.error(report.errors, report.rules.errors);
```

`validate()` reports value errors, effectively required fields that are missing, and failed error-severity rules. `isValid()` returns `report.valid`. `validateRules()` runs the rules alone.

Preview a draft with blanks marked before it is complete: `await draft.render({ progressive: { missing: "(missing)" } })` ([rendering.md § Render options](./rendering.md#render-options)).

## Persist and resume

`toJSON()` on a runtime instance returns plain data: phase, definition, values, clock, signers, captures. Store it and rebuild the instance with the matching function.

```typescript
import { runtimeFormFromJSON } from "@paradoc/sdk";

const saved = JSON.stringify(draft.toJSON());
const resumed = runtimeFormFromJSON(JSON.parse(saved)); // add { resolver } when the form has file layers
if (resumed.phase === "draft") {
  const next = resumed.update({ fields: { hasPets: false } }); // a live draft again
}
```

| Instance | Rebuild with |
|----------|--------------|
| Form (any phase) | `runtimeFormFromJSON(json, { resolver? })` |
| Document | `runtimeDocumentFromJSON(json, { resolver? })` |
| Checklist | `runtimeChecklistFromJSON(json, { resolver? })` |
| Bundle | `runtimeBundleFromJSON(json, deserializeContent?)` |

A bundle stores its clock and each member with its kind, phase, and data. `runtimeBundleFromJSON(json)` rebuilds every member kind, nested bundles too. To bind a resolver, pass a `deserializeContent` that calls `runtimeContentFromJSON`:

```typescript
import { runtimeBundleFromJSON, runtimeContentFromJSON } from "@paradoc/sdk";

const bundleJson = JSON.parse(storedBundle);
const resumedBundle = runtimeBundleFromJSON(bundleJson);
const withFiles = runtimeBundleFromJSON(bundleJson, (member) => runtimeContentFromJSON(member, { resolver }));
```

Loading checks each member like `prepare()` does. An undeclared key, a member of the wrong kind, or a member in the wrong phase for the bundle phase throws.

A sealed form serializes `signatureMap` and `canonicalPdfHash`, not `canonicalPdfBytes`. Store the PDF bytes yourself, keyed by the hash.

## Sessions

`@paradoc/sessions` (re-exported by `@paradoc/sdk`) runs a conversational intake as an event log. Every change is a command; the state is the replayed log. Use it when answers arrive turn by turn, get deferred or revised, and must be stored and replayed.

```typescript
import { p, createParadocRuntime, execute, deriveView, sessionPayload, type FormSession } from "@paradoc/sdk";

const definition = {
  $schema: "https://schema.paradoc.dev/2026-09-24.json",
  kind: "form",
  name: "intake",
  fields: {
    fullName: { type: "text", label: "Full name", required: true },
    age: { type: "number", label: "Age", required: true },
  },
  parties: { applicant: { label: "Applicant", partyType: "person" } },
} as const;

const runtime = createParadocRuntime(definition);
let session: FormSession = {
  formSessionId: "s-1",
  chatId: "c-1",
  artifactRef: { name: "intake" },
  events: [],
  createdAt: new Date().toISOString(),
};

const result = execute(session, runtime, { kind: "answer", fieldPath: "age", value: "36", source: "user" }, { kind: "user" });
if (result.ok) session = result.session;   // "36" is stored as 36
else console.error(result.code, result.reason); // a rejection carries no session: keep the old one

const view = deriveView(session, runtime);
view.phase;      // "collecting-required", "revisit-deferred", "collecting-optional", "unresolved", "ready", "rendered", "abandoned"
view.next;       // { fieldPath, required, deferred } or null
view.nextParty;  // { roleId, label } or null
view.nextAnnex;  // { annexId, label } or null
view.progress;   // { answered, requiredRemaining, optionalRemaining, deferredCount, ... }

const draft = p.form(definition).fill(sessionPayload(view.projected, runtime)); // { fields, parties, annexes } answered so far
```

| Part | Detail |
|------|--------|
| Commands | `answer`, `revise`, `clear`, `defer`/`undefer`, `skip`/`unskip`, `answerParty` (`roleId`, `index?`, `value`; indices in order from 0 for a role with `max` above 1), `answerAnnex` (`annexId`, `value`), `clearAnnex`, `present`, `validate`, `render`, `abandon` |
| Actor | `{ kind: "user" }`, `{ kind: "agent", model }`, `{ kind: "system", reason }` |
| Error codes | `field-not-found`, `field-not-visible`, `field-locked`, `invalid-value`, `stale-state`, `party-not-found`, `party-index-out-of-order`, `annex-not-found`, `session-not-active`, and others on `CommandErrorCode` |
| Options | `execute(..., { expectedEventCount, now })`: `expectedEventCount` rejects with `stale-state` when another writer appended first |
| View | Also `pendingParties`, `pendingAnnexes`, `fieldIndex` (status and `locked` per field), `partyIndex` (status, `max`, `filled`) and `annexIndex`. The phase is `ready` only when no required field, party, or annex is open. |
| Storage | Persist `session.events` append-only, in order, with no duplicates. `deriveView` replays the log as given. |

To give an AI agent fill tools instead of running the engine yourself, load [ai-tools.md](./ai-tools.md).

## Extract from a filled PDF

To start a draft from a filled PDF, call `form.extract(pdfBytes, { layer? })` and pass its `data` to `safeFill()`. The report, the statuses and the error codes are in [pdf.md § Read a filled PDF back](./pdf.md#read-a-filled-pdf-back).
