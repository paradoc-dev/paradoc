# RESIDENTIAL LEASE AGREEMENT

This Lease Agreement is entered into on **{{startDate}}** between:

**LANDLORD:** {{parties.landlord.name}}

**TENANT(S):**
{{#each parties.tenant}}
- {{name}}
{{/each}}

---

## 1. PROPERTY

The Landlord agrees to rent to the Tenant the property located at:

{{address}}

**Property Type:** {{propertyType}}
**Bedrooms:** {{bedrooms}}

---

## 2. TERM

The lease term shall be **{{leaseTerm}}**, starting on **{{startDate}}**.

---

## 3. RENT

The Tenant agrees to pay **{{monthlyRent}}** per month, due on the first of each month.

---

## 4. RULES

{{#if petsAllowed}}
Pets are **permitted** with prior written approval.
{{else}}
Pets are **not permitted** on the premises.
{{/if}}

{{#if smokingAllowed}}
Smoking is **permitted** in designated areas only.
{{else}}
Smoking is **not permitted** on the premises.
{{/if}}

---

## 5. SIGNATURES

**LANDLORD:**

Name: {{parties.landlord.name}}

Signature: ___________________________  Date: ____________


**TENANT(S):**

{{#each parties.tenant}}
Name: {{name}}

Signature: ___________________________  Date: ____________

{{/each}}
