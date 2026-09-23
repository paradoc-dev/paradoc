# RESIDENTIAL LEASE AGREEMENT

This Lease Agreement is entered into on **{{fields.startDate}}** between:

**LANDLORD:** {{parties.landlord.name}}

**TENANT(S):**
{{#each parties.tenant}}
- {{item.name}}
{{/each}}

---

## 1. PROPERTY

The Landlord agrees to rent to the Tenant the property located at:

{{fields.address}}

**Property Type:** {{fields.propertyType}}
**Bedrooms:** {{fields.bedrooms}}

---

## 2. TERM

The lease term shall be **{{fields.leaseTerm}}**, starting on **{{fields.startDate}}**.

---

## 3. RENT

The Tenant agrees to pay **{{fields.monthlyRent}}** per month, due on the first of each month.

---

## 4. RULES

{{#if fields.petsAllowed}}
Pets are **permitted** with prior written approval.
{{else}}
Pets are **not permitted** on the premises.
{{/if}}

{{#if fields.smokingAllowed}}
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
Name: {{item.name}}

Signature: ___________________________  Date: ____________

{{/each}}
