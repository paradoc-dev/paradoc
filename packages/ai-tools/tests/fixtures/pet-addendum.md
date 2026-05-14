# Pet Addendum to Lease Agreement

This Pet Addendum ("Addendum") is entered into by and between the Landlord and Tenant identified below, and is hereby incorporated into and made a part of the Lease Agreement between the parties.

---

## Parties

**Landlord:** {{landlord.name}}

**Tenant:** {{tenant.name}}

---

## Pet Information

The Tenant is permitted to keep the following pet on the leased premises, subject to the terms and conditions set forth below.

**Name of pet:** {{petName}}

**Species:** {{species}}

**Weight (lbs):** {{weight}}

**Vaccinated:** [{{#if isVaccinated}}x{{else}} {{/if}}] Pet is current on all required vaccinations

---

## Terms and Conditions

1. The Tenant agrees to keep the pet under control at all times and to prevent the pet from causing damage to the premises or disturbing other tenants.

2. The Tenant is responsible for any damage caused by the pet to the premises, common areas, or other tenants' property.

3. The Tenant agrees to promptly clean up after the pet in all common areas and outdoor spaces.

4. The Landlord reserves the right to revoke this Addendum with 30 days written notice if the pet becomes a nuisance or causes damage to the property.

5. {{#unless isVaccinated}}The Tenant acknowledges that the pet is not currently vaccinated and agrees to obtain all required vaccinations within 30 days of the effective date of this Addendum.{{/unless}}{{#if isVaccinated}}The Tenant agrees to maintain all required vaccinations for the duration of this Addendum.{{/if}}

---

## Signatures

{{#with tenant}}
Tenant signature: {{signature "tenant-sig"}}

Date: {{signatureDate "tenant-date"}}
{{/with}}

{{#with landlord}}
Landlord signature: {{signature "landlord-sig"}}

Date: {{signatureDate "landlord-date"}}
{{/with}}
