// AUTO-GENERATED from artifacts/banking/ach-bank-account-info/design/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-bank-account-info

import { para, createMemoryResolver } from "@paradoc/core";

const schema = {
  "$schema": "https://schema.paradoc.dev/schema.json",
  "kind": "form",
  "name": "ach-bank-account-info",
  "version": "1.0.0",
  "title": "ACH Bank Account Information",
  "description": "Standalone vendor / payee bank-account-information collection form for ACH credit destination setup. Captures account-holder identity (individual or organization), bank routing/account/type, and (for organizations) W-9-adjacent entity classification. Pairs with a separate authorization document (vendor agreement, W-9, MSA); the form itself is data-collection only and does not carry an authorization clause.",
  "code": "ACH-BANK-INFO",
  "releaseDate": "2026-05-02",
  "metadata": {
    "domain": "banking"
  },
  "instructions": {
    "kind": "file",
    "path": "ach-bank-account-info.instructions.md",
    "mimeType": "text/markdown",
    "title": "Instructions for ACH Bank Account Information",
    "description": "Generated instructions derived from the artifact definition.",
    "checksum": "sha256:73fee15f2a7b4c08c717279a6e7d223163a32354986379c18aff45b6b6b76c93"
  },
  "parties": {
    "requestor": {
      "partyType": "organization",
      "label": "Requestor (Company)",
      "description": "The company that issued and will retain this form, typically the payer or accounts-payable counterparty collecting ACH destination details from a vendor or payee. The requestor identifies itself for traceability but does not sign the form.",
      "min": 1,
      "max": 1
    },
    "accountHolder": {
      "partyType": "any",
      "label": "Account Holder (Payee)",
      "description": "The individual or organization that owns the bank account being identified for ACH credits. Provides identification, bank routing/account information, and (for organizations) W-9 adjacent classification, and signs to certify the bank details are accurate.",
      "min": 1,
      "max": 1,
      "signature": {
        "required": true,
        "witnesses": 0,
        "notarized": false
      }
    }
  },
  "fields": {
    "actionType": {
      "type": "enum",
      "label": "Action",
      "description": "Specifies whether this submission establishes a new ACH destination, changes an existing one, or cancels ACH for the account holder. Drives the visibility of prior-bank-info fields when changing.",
      "enum": [
        {
          "value": "new",
          "label": "New"
        },
        {
          "value": "change",
          "label": "Change"
        },
        {
          "value": "cancel",
          "label": "Cancel"
        }
      ],
      "required": true,
      "visible": true
    },
    "requestorDba": {
      "type": "text",
      "label": "Requestor DBA / 'doing business as' name",
      "description": "Optional trade or doing-business-as name used by the requestor if different from its legal name. Provided so the account holder can recognize the requesting entity.",
      "maxLength": 200,
      "required": false,
      "visible": true
    },
    "requestorContactName": {
      "type": "text",
      "label": "Requestor A/P contact name",
      "description": "Name of the accounts-payable representative at the requestor for follow-up questions about this submission. Optional but recommended for back-and-forth on data validation.",
      "maxLength": 100,
      "required": false,
      "visible": true
    },
    "requestorContactEmail": {
      "type": "email",
      "label": "Requestor A/P contact email",
      "description": "Email address of the requestor's A/P contact for questions about this submission.",
      "required": false,
      "visible": true
    },
    "requestorVendorNumber": {
      "type": "text",
      "label": "Vendor / payee number assigned by Requestor",
      "description": "Internal vendor or payee identifier assigned by the requestor's A/P system; helps the requestor route the submission to the right vendor record.",
      "maxLength": 50,
      "required": false,
      "visible": true
    },
    "accountHolderType": {
      "type": "enum",
      "label": "Account holder type",
      "description": "Selects whether the account holder is a natural person ('individual') or a legal entity ('organization'). Gates which identification fields appear below.",
      "enum": [
        {
          "value": "individual",
          "label": "Individual"
        },
        {
          "value": "organization",
          "label": "Organization"
        }
      ],
      "required": true,
      "visible": true
    },
    "individualSsn": {
      "type": "text",
      "label": "Social Security number",
      "description": "Individual account holder's nine-digit U.S. Social Security Number, formatted XXX-XX-XXXX (hyphens optional). Used for tax-reporting on payments. Visible only when accountHolderType == 'individual'.",
      "pattern": "^\\d{3}-?\\d{2}-?\\d{4}$",
      "required": false,
      "visible": "fields.accountHolderType == 'individual'"
    },
    "individualAddress": {
      "type": "address",
      "label": "Individual address",
      "description": "Mailing address of the individual account holder, used for payment notices and tax reporting. Captured as a structured address (line1, locality, region, postalCode).",
      "required": false,
      "visible": "fields.accountHolderType == 'individual'"
    },
    "individualPhone": {
      "type": "phone",
      "label": "Individual phone",
      "description": "Phone number of the individual account holder for verification or fraud-prevention contact.",
      "required": false,
      "visible": "fields.accountHolderType == 'individual'"
    },
    "individualEmail": {
      "type": "email",
      "label": "Individual email",
      "description": "Email address of the individual account holder for payment notifications.",
      "required": false,
      "visible": "fields.accountHolderType == 'individual'"
    },
    "orgDba": {
      "type": "text",
      "label": "Organization DBA / disregarded-entity name",
      "description": "Trade or doing-business-as name of the organization if different from its legal name (which is captured on parties.accountHolder.legalName). Equivalent to W-9 line 2.",
      "maxLength": 200,
      "required": false,
      "visible": "fields.accountHolderType == 'organization'"
    },
    "orgTin": {
      "type": "text",
      "label": "Organization TIN / EIN",
      "description": "Organization's nine-digit Taxpayer Identification Number (typically an EIN), formatted XX-XXXXXXX. Used for 1099 tax reporting on payments. Hyphen optional.",
      "pattern": "^\\d{2}-?\\d{7}$",
      "required": false,
      "visible": "fields.accountHolderType == 'organization'"
    },
    "orgEntityType": {
      "type": "enum",
      "label": "Entity type",
      "description": "Federal tax classification of the organization, mirroring W-9 line 3a categories. Determines withholding and 1099 reporting behavior.",
      "enum": [
        {
          "value": "sole_prop",
          "label": "Sole proprietorship"
        },
        {
          "value": "llc",
          "label": "LLC"
        },
        {
          "value": "s_corp",
          "label": "S corporation"
        },
        {
          "value": "c_corp",
          "label": "C corporation"
        },
        {
          "value": "partnership",
          "label": "Partnership"
        },
        {
          "value": "nonprofit",
          "label": "Nonprofit"
        },
        {
          "value": "other",
          "label": "Other"
        }
      ],
      "required": "fields.accountHolderType == 'organization'",
      "visible": "fields.accountHolderType == 'organization'"
    },
    "orgDomicileState": {
      "type": "text",
      "label": "Organization domicile state",
      "description": "U.S. state in which the organization is legally formed or registered (two-letter code or full name). Used for state-tax classification and reporting jurisdiction.",
      "maxLength": 50,
      "required": false,
      "visible": "fields.accountHolderType == 'organization'"
    },
    "orgAddress": {
      "type": "address",
      "label": "Organization business address",
      "description": "Principal business address of the organization, used for payment notices and tax reporting.",
      "required": false,
      "visible": "fields.accountHolderType == 'organization'"
    },
    "orgContactName": {
      "type": "text",
      "label": "Organization contact name",
      "description": "Name of the individual at the organization who should be contacted regarding this bank-account submission.",
      "maxLength": 100,
      "required": false,
      "visible": "fields.accountHolderType == 'organization'"
    },
    "orgContactTitle": {
      "type": "text",
      "label": "Organization contact title",
      "description": "Job title of the organization contact (e.g., 'CFO', 'A/R Manager'); helps the requestor confirm the contact has authority to provide bank details.",
      "maxLength": 100,
      "required": false,
      "visible": "fields.accountHolderType == 'organization'"
    },
    "orgContactEmail": {
      "type": "email",
      "label": "Organization contact email",
      "description": "Email address of the organization contact.",
      "required": false,
      "visible": "fields.accountHolderType == 'organization'"
    },
    "notSubjectToBackupWithholding": {
      "type": "boolean",
      "label": "Not subject to backup withholding (W-9 Part II attestation)",
      "description": "Organization's attestation, mirroring W-9 Part II item 2, that it is not subject to IRS backup withholding. When true, the requestor will not withhold a percentage from ACH payments for tax purposes.",
      "required": false,
      "visible": "fields.accountHolderType == 'organization'"
    },
    "bankName": {
      "type": "text",
      "label": "Bank name",
      "description": "Name of the financial institution holding the account (e.g., 'Chase Bank', 'Bank of America'). Helps the requestor verify routing-number validity against a known institution.",
      "maxLength": 100,
      "required": "fields.actionType != 'cancel'",
      "visible": "fields.actionType != 'cancel'"
    },
    "routingNumber": {
      "type": "text",
      "label": "Routing / ABA number",
      "description": "Nine-digit ABA routing number that uniquely identifies the bank for ACH transactions. Must pass the standard checksum used by the Federal Reserve.",
      "pattern": "^\\d{9}$",
      "required": "fields.actionType != 'cancel'",
      "visible": "fields.actionType != 'cancel'"
    },
    "accountNumber": {
      "type": "text",
      "label": "Account number",
      "description": "Bank account number at the institution; alphanumeric, 4-17 characters per NACHA conventions. Treated as sensitive data and typically masked in receipts.",
      "minLength": 4,
      "maxLength": 17,
      "pattern": "^[A-Za-z0-9]+$",
      "required": "fields.actionType != 'cancel'",
      "visible": "fields.actionType != 'cancel'"
    },
    "accountType": {
      "type": "enum",
      "label": "Account type",
      "description": "Type of demand-deposit account for ACH routing. 'checking' or 'savings' map directly to NACHA standard entry class codes for the credit.",
      "enum": [
        {
          "value": "checking",
          "label": "Checking"
        },
        {
          "value": "savings",
          "label": "Savings"
        }
      ],
      "required": "fields.actionType != 'cancel'",
      "visible": "fields.actionType != 'cancel'"
    },
    "nameOnAccount": {
      "type": "text",
      "label": "Name on bank account (if different from account holder)",
      "description": "The literal name printed on the bank account, if different from the account holder's legal name on this form. Helps the requestor avoid ACH rejects when the bank's name match is strict.",
      "maxLength": 200,
      "required": false,
      "visible": "fields.actionType != 'cancel'"
    },
    "voidedCheckAttached": {
      "type": "boolean",
      "label": "Voided check or bank letter attached",
      "description": "Indicates whether the account holder has attached a voided check or bank-issued letter as supporting evidence of the account numbers. Strongly encouraged by most requestors to reduce ACH errors.",
      "required": false,
      "visible": "fields.actionType != 'cancel'"
    },
    "priorRoutingNumber": {
      "type": "text",
      "label": "Prior routing number (on file)",
      "description": "When changing bank accounts, the previously-on-file routing number, used by the requestor to confirm which account to retire. Visible only when actionType == 'change'.",
      "pattern": "^\\d{9}$",
      "required": false,
      "visible": "fields.actionType == 'change'"
    },
    "priorAccountNumber": {
      "type": "text",
      "label": "Prior account number (on file)",
      "description": "When changing bank accounts, the previously-on-file account number. Visible only when actionType == 'change'.",
      "minLength": 4,
      "maxLength": 17,
      "pattern": "^[A-Za-z0-9]+$",
      "required": false,
      "visible": "fields.actionType == 'change'"
    },
    "priorAccountType": {
      "type": "enum",
      "label": "Prior account type (on file)",
      "description": "When changing bank accounts, the previously-on-file account type. Visible only when actionType == 'change'.",
      "enum": [
        {
          "value": "checking",
          "label": "Checking"
        },
        {
          "value": "savings",
          "label": "Savings"
        }
      ],
      "required": false,
      "visible": "fields.actionType == 'change'"
    }
  },
  "rules": {
    "individualFieldsOnlyWhenIndividual": {
      "expr": "accountHolderType == 'individual' or (individualSsn == null and individualPhone == null and individualEmail == null)",
      "message": "Individual-branch fields should only be populated when accountHolderType is 'individual'.",
      "severity": "warning"
    },
    "organizationFieldsOnlyWhenOrganization": {
      "expr": "accountHolderType == 'organization' or (orgTin == null and orgDba == null and orgContactName == null)",
      "message": "Organization-branch fields should only be populated when accountHolderType is 'organization'.",
      "severity": "warning"
    },
    "priorBankOnlyOnChange": {
      "expr": "actionType == 'change' or (priorRoutingNumber == null and priorAccountNumber == null and priorAccountType == null)",
      "message": "Prior bank info should only be supplied when actionType is 'change'.",
      "severity": "warning"
    }
  },
  "layers": {
    "pdf": {
      "kind": "file",
      "mimeType": "application/pdf",
      "title": "PDF Form",
      "path": "ach-bank-account-info.pdf",
      "checksum": "sha256:32cad71c08879557322d5a939483c8ee39a5a03b3a470d9c30a8e1f97d6b72bc",
      "bindings": {
        "actionType_new": "actionType:new",
        "actionType_change": "actionType:change",
        "actionType_cancel": "actionType:cancel",
        "requestorName": "parties.requestor.legalName",
        "requestorDba": "requestorDba",
        "requestorContactName": "requestorContactName",
        "requestorContactEmail": "requestorContactEmail",
        "requestorVendorNumber": "requestorVendorNumber",
        "accountHolderType_individual": "accountHolderType:individual",
        "accountHolderType_organization": "accountHolderType:organization",
        "individualName": "parties.accountHolder.name",
        "individualSsn": "individualSsn",
        "individualAddressLine1": "individualAddress.line1",
        "individualCity": "individualAddress.locality",
        "individualState": "individualAddress.region",
        "individualZip": "individualAddress.postalCode",
        "individualPhone": "individualPhone.number",
        "individualEmail": "individualEmail",
        "orgLegalName": "parties.accountHolder.legalName",
        "orgDba": "orgDba",
        "orgTin": "orgTin",
        "orgDomicileState": "orgDomicileState",
        "orgEntityType_soleprop": "orgEntityType:sole_prop",
        "orgEntityType_llc": "orgEntityType:llc",
        "orgEntityType_scorp": "orgEntityType:s_corp",
        "orgEntityType_ccorp": "orgEntityType:c_corp",
        "orgEntityType_partnership": "orgEntityType:partnership",
        "orgEntityType_nonprofit": "orgEntityType:nonprofit",
        "orgEntityType_other": "orgEntityType:other",
        "orgAddressLine1": "orgAddress.line1",
        "orgCity": "orgAddress.locality",
        "orgState": "orgAddress.region",
        "orgZip": "orgAddress.postalCode",
        "orgContactName": "orgContactName",
        "orgContactTitle": "orgContactTitle",
        "orgContactEmail": "orgContactEmail",
        "notSubjectToBackupWithholding": "notSubjectToBackupWithholding",
        "bankName": "bankName",
        "nameOnAccount": "nameOnAccount",
        "routingNumber": "routingNumber",
        "accountNumber": "accountNumber",
        "accountType_checking": "accountType:checking",
        "accountType_savings": "accountType:savings",
        "voidedCheckAttached": "voidedCheckAttached",
        "priorRoutingNumber": "priorRoutingNumber",
        "priorAccountNumber": "priorAccountNumber",
        "priorAccountType_checking": "priorAccountType:checking",
        "priorAccountType_savings": "priorAccountType:savings"
      },
      "signatureBlocks": {
        "accountHolderSignature": {
          "type": "signature",
          "page": 1,
          "x": 90,
          "y": 730,
          "width": 220,
          "height": 12,
          "partyRole": "accountHolder",
          "partyIndex": 0,
          "label": "Signature of Account Holder"
        },
        "accountHolderDate": {
          "type": "date",
          "page": 1,
          "x": 350,
          "y": 730,
          "width": 90,
          "height": 12,
          "partyRole": "accountHolder",
          "partyIndex": 0,
          "label": "Date"
        },
        "accountHolderPrintedName": {
          "type": "printed_name",
          "page": 1,
          "x": 110,
          "y": 752,
          "width": 230,
          "height": 12,
          "partyRole": "accountHolder",
          "partyIndex": 0,
          "label": "Printed name"
        },
        "accountHolderCapacity": {
          "type": "capacity",
          "page": 1,
          "x": 380,
          "y": 752,
          "width": 150,
          "height": 12,
          "partyRole": "accountHolder",
          "partyIndex": 0,
          "label": "Title / capacity (organization signers)"
        }
      }
    },
    "markdown": {
      "kind": "file",
      "mimeType": "text/markdown",
      "title": "Markdown Form",
      "path": "ach-bank-account-info.md",
      "checksum": "sha256:b8605835c89ba7f3686d21babb6c697e858005072615d5b7faa3fcc0a4c7154c"
    }
  },
  "defaultLayer": "pdf"
} as const;

const __c_ach_bank_account_info_instructions_md: string = `---
title: Instructions for ACH Bank Account Information
source_url: null
slug: ach-bank-account-info
timestamp: 2026-05-12T02:39:15Z
generated: true
---

# Instructions for ACH Bank Account Information

## Purpose

This form gives a company (the Requestor) the bank account details needed to send ACH credit payments to a payee — either an individual or an organization. It is used to set up a new payment destination, change an existing one, or cancel one.

## How to fill it out

### 1. Choose the action

**1.** Select one Action: **New** (first-time setup), **Change** (update bank details on file), or **Cancel** (stop sending ACH credits to this account).

### 2. Requestor information

**2.** If the Requestor uses a "doing business as" name, enter it.

**3.** Enter the name and email of the Requestor's accounts-payable contact, if known.

**4.** Enter the vendor or payee number the Requestor assigned to the account holder, if one was provided.

### 3. Account holder

**5.** Select the Account holder type: **Individual** or **Organization**.

**6.** If **Individual** is selected, complete the individual fields: Social Security number, address, phone, and email.

**7.** If **Organization** is selected, complete the organization fields:
   - DBA / disregarded-entity name (if any)
   - Organization TIN or EIN
   - Entity type (sole proprietor, LLC, S corp, C corp, partnership, nonprofit, or other) — **required**
   - Domicile state
   - Business address
   - Contact name, title, and email

**8.** Check the **Not subject to backup withholding** box only if the account holder can attest to the W-9 Part II statement.

### 4. Bank account details

Steps 9–13 are required for **New** and **Change**. Skip them for **Cancel**.

**9.** Enter the bank name.

**10.** Enter the 9-digit routing / ABA number.

**11.** Enter the account number.

**12.** Select the account type: **Checking** or **Savings**.

**13.** If the name on the bank account differs from the account holder, enter the name on the account.

**14.** Check the box if a voided check or bank letter is attached. Attaching one is recommended; it helps the Requestor verify the account.

### 5. Change details (only if Action is "Change")

**15.** Enter the prior routing number, prior account number, and prior account type that were on file. These help the Requestor match the change to the existing record.

### 6. Submit

**16.** Return the completed form to the Requestor's accounts-payable contact.

## Notes

- This form collects bank-account information only. It does not, by itself, authorize any payment. The legal authorization to send ACH credits is governed by a separate document (a vendor agreement, MSA, W-9, or similar).
- A voided check or bank verification letter is the most reliable way to confirm the routing and account numbers. Attaching one reduces the chance of a payment being rejected or misrouted.
`;
const __c_ach_bank_account_info_pdf_b64 = "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PAovT2ZmIDggMCBSIC9ZZXMgNyAwIFIKPj4gL04gPDwKL09mZiA2IDAgUiAvWWVzIDUgMCBSCj4+IC9SIDw8Ci9PZmYgMTAgMCBSIC9ZZXMgOSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjYgMCBSIC9SZWN0IFsgMTQ4Ljk5OSA2ODcgMTU2Ljk5OSA2OTUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY3Rpb25UeXBlX2NoYW5nZSkgCiAgL1RVIChDaGFuZ2UgXChjaGFuZ2VcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEzIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDggMCBSIC9ZZXMgNyAwIFIKPj4gL04gPDwKL09mZiA2IDAgUiAvWWVzIDUgMCBSCj4+IC9SIDw8Ci9PZmYgMTAgMCBSIC9ZZXMgOSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjYgMCBSIC9SZWN0IFsgMjA0LjAxNSA2ODcgMjEyLjAxNSA2OTUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY3Rpb25UeXBlX2NhbmNlbCkgCiAgL1RVIChDYW5jZWwgXChjYW5jZWxcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjE0IDAgb2JqCjw8L1R5cGUgL0VuY29kaW5nIC9EaWZmZXJlbmNlcyBbMjQgL2JyZXZlIC9jYXJvbiAvY2lyY3VtZmxleCAvZG90YWNjZW50IC9odW5nYXJ1bWxhdXQgL29nb25layAvcmluZyAvdGlsZGUgMzkgL3F1b3Rlc2luZ2xlIDk2IC9ncmF2ZSAxMjggL2J1bGxldCAvZGFnZ2VyIC9kYWdnZXJkYmwgL2VsbGlwc2lzIC9lbWRhc2ggL2VuZGFzaCAvZmxvcmluIC9mcmFjdGlvbiAvZ3VpbHNpbmdsbGVmdCAvZ3VpbHNpbmdscmlnaHQgL21pbnVzIC9wZXJ0aG91c2FuZCAvcXVvdGVkYmxiYXNlIC9xdW90ZWRibGxlZnQgL3F1b3RlZGJscmlnaHQgL3F1b3RlbGVmdCAvcXVvdGVyaWdodCAvcXVvdGVzaW5nbGJhc2UgL3RyYWRlbWFyayAvZmkgL2ZsIC9Mc2xhc2ggL09FIC9TY2Fyb24gL1lkaWVyZXNpcyAvWmNhcm9uIC9kb3RsZXNzaSAvbHNsYXNoIC9vZSAvc2Nhcm9uIC96Y2Fyb24gMTYwIC9FdXJvIDE2NCAvY3VycmVuY3kgMTY2IC9icm9rZW5iYXIgMTY4IC9kaWVyZXNpcyAvY29weXJpZ2h0IC9vcmRmZW1pbmluZSAxNzIgL2xvZ2ljYWxub3QgLy5ub3RkZWYgL3JlZ2lzdGVyZWQgL21hY3JvbiAvZGVncmVlIC9wbHVzbWludXMgL3R3b3N1cGVyaW9yIC90aHJlZXN1cGVyaW9yIC9hY3V0ZSAvbXUgMTgzIC9wZXJpb2RjZW50ZXJlZCAvY2VkaWxsYSAvb25lc3VwZXJpb3IgL29yZG1hc2N1bGluZSAxODggL29uZXF1YXJ0ZXIgL29uZWhhbGYgL3RocmVlcXVhcnRlcnMgMTkyIC9BZ3JhdmUgL0FhY3V0ZSAvQWNpcmN1bWZsZXggL0F0aWxkZSAvQWRpZXJlc2lzIC9BcmluZyAvQUUgL0NjZWRpbGxhIC9FZ3JhdmUgL0VhY3V0ZSAvRWNpcmN1bWZsZXggL0VkaWVyZXNpcyAvSWdyYXZlIC9JYWN1dGUgL0ljaXJjdW1mbGV4IC9JZGllcmVzaXMgL0V0aCAvTnRpbGRlIC9PZ3JhdmUgL09hY3V0ZSAvT2NpcmN1bWZsZXggL090aWxkZSAvT2RpZXJlc2lzIC9tdWx0aXBseSAvT3NsYXNoIC9VZ3JhdmUgL1VhY3V0ZSAvVWNpcmN1bWZsZXggL1VkaWVyZXNpcyAvWWFjdXRlIC9UaG9ybiAvZ2VybWFuZGJscyAvYWdyYXZlIC9hYWN1dGUgL2FjaXJjdW1mbGV4IC9hdGlsZGUgL2FkaWVyZXNpcyAvYXJpbmcgL2FlIC9jY2VkaWxsYSAvZWdyYXZlIC9lYWN1dGUgL2VjaXJjdW1mbGV4IC9lZGllcmVzaXMgL2lncmF2ZSAvaWFjdXRlIC9pY2lyY3VtZmxleCAvaWRpZXJlc2lzIC9ldGggL250aWxkZSAvb2dyYXZlIC9vYWN1dGUgL29jaXJjdW1mbGV4IC9vdGlsZGUgL29kaWVyZXNpcyAvZGl2aWRlIC9vc2xhc2ggL3VncmF2ZSAvdWFjdXRlIC91Y2lyY3VtZmxleCAvdWRpZXJlc2lzIC95YWN1dGUgL3Rob3JuIC95ZGllcmVzaXNdPj4KZW5kb2JqCjE1IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iagoxNiAwIG9iago8PAovQkJveCBbIDAgMCAyMDAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDE1IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDIwUDAE8lK50rj0QyoUnHydFbgK0aTCufKAIiAN7lyBXK6+zlwAFwMOiWVuZHN0cmVhbQplbmRvYmoKMTcgMCBvYmoKPDwKL0FQIDw8Ci9OIDE2IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyA3OS41NiA2NTMgMjc5LjU2IDY2NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHJlcXVlc3Rvck5hbWUpIAogIC9UVSAoTmFtZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDE0IDAgUiA+PgplbmRvYmoKMTkgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjM2LjQ0IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjUgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxOCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAyNtMzMVEwBAqkcqVx6YdUKDj5OitwFWLKhnPlAQVB2ty5ArlcfZ25AHOOD8dlbmRzdHJlYW0KZW5kb2JqCjIwIDAgb2JqCjw8Ci9BUCA8PAovTiAxOSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgMzEyLjIzMiA2NTMgNTQ4LjY3MiA2NjQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChyZXF1ZXN0b3JEYmEpIAogIC9UVSAoREJBKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjIxIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iagoyMiAwIG9iago8PAovQkJveCBbIDAgMCAxNjAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDIxIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQDYiAvlSuNSz+kQsHJ11mBqxBNKpwrDygC0uDOFcjl6uvMBQAYlg6TZW5kc3RyZWFtCmVuZG9iagoyMyAwIG9iago8PAovQVAgPDwKL04gMjIgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI2IDAgUiAvUmVjdCBbIDg1Ljc5MiA2MzcgMjQ1Ljc5MiA2NDggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChyZXF1ZXN0b3JDb250YWN0TmFtZSkgCiAgL1RVIChDb250YWN0KSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjI0IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iagoyNSAwIG9iago8PAovQkJveCBbIDAgMCAxNjAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDI0IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQDYiAvlSuNSz+kQsHJ11mBqxBNKpwrDygC0uDOFcjl6uvMBQAYlg6TZW5kc3RyZWFtCmVuZG9iagoyNiAwIG9iago8PAovQVAgPDwKL04gMjUgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI2IDAgUiAvUmVjdCBbIDI3OC4wMTYgNjM3IDQzOC4wMTYgNjQ4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocmVxdWVzdG9yQ29udGFjdEVtYWlsKSAKICAvVFUgKEVtYWlsKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjI3IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iagoyOCAwIG9iago8PAovQkJveCBbIDAgMCA1MS45ODQgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2OSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDI3IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDXUs7QwtoQDCwVDoFwqVxqXfkiFgpOvswJXIV6F4Vx5QHmQYe5cgVyuvs5cABrjFLllbmRzdHJlYW0KZW5kb2JqCjI5IDAgb2JqCjw8Ci9BUCA8PAovTiAyOCAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgNDgyLjcwNCA2MzcgNTM0LjY4OCA2NDggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChyZXF1ZXN0b3JWZW5kb3JOdW1iZXIpIAogIC9UVSAoVmVuZG9yICMpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMzAgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgOCAwIFIgL1llcyA3IDAgUgo+PiAvTiA8PAovT2ZmIDYgMCBSIC9ZZXMgNSAwIFIKPj4gL1IgPDwKL09mZiAxMCAwIFIgL1llcyA5IDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNiAwIFIgL1JlY3QgWyA4MC4wMDggNjAzIDg4LjAwOCA2MTEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50SG9sZGVyVHlwZV9pbmRpdmlkdWFsKSAKICAvVFUgKEluZGl2aWR1YWwgXChpbmRpdmlkdWFsXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagozMSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA4IDAgUiAvWWVzIDcgMCBSCj4+IC9OIDw8Ci9PZmYgNiAwIFIgL1llcyA1IDAgUgo+PiAvUiA8PAovT2ZmIDEwIDAgUiAvWWVzIDkgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI2IDAgUiAvUmVjdCBbIDE0MC44IDYwMyAxNDguOCA2MTEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50SG9sZGVyVHlwZV9vcmdhbml6YXRpb24pIAogIC9UVSAoT3JnYW5pemF0aW9uIFwob3JnYW5pemF0aW9uXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagozMiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDE0IDAgUiA+PgplbmRvYmoKMzMgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjIwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjIgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAzMiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAyMlAwBPJSudK49EMqFJx8nRW4CtGkwrnygCIgDe5cgVyuvs5cABelDo1lbmRzdHJlYW0KZW5kb2JqCjM0IDAgb2JqCjw8Ci9BUCA8PAovTiAzMyAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgMTE0LjI0OCA1ODcgMzM0LjI0OCA1OTggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChpbmRpdmlkdWFsTmFtZSkgCiAgL1RVIChJbmRpdmlkdWFsIG5hbWUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMzUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyAxNCAwIFIgPj4KZW5kb2JqCjM2IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDE4NS43NTIgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDM1IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMLQw1TM3NVIwBIqkcqVx6YdUKDj5OitwFWKRDufKA4qCNLpzBXK5+jpzAQCVfRA5ZW5kc3RyZWFtCmVuZG9iagozNyAwIG9iago8PAovQVAgPDwKL04gMzYgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI2IDAgUiAvUmVjdCBbIDM2Mi45MiA1ODcgNTQ4LjY3MiA1OTggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChpbmRpdmlkdWFsU3NuKSAKICAvVFUgKFNTTikgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagozOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDE0IDAgUiA+PgplbmRvYmoKMzkgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjAwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjIgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAzOCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAyMFAwBPJSudK49EMqFJx8nRW4CtGkwrnygCIgDe5cgVyuvs5cABcDDollbmRzdHJlYW0KZW5kb2JqCjQwIDAgb2JqCjw8Ci9BUCA8PAovTiAzOSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgODcuNTY4IDU3MSAyODcuNTY4IDU4MiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGluZGl2aWR1YWxBZGRyZXNzTGluZTEpIAogIC9UVSAoQWRkcmVzcykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago0MSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDE0IDAgUiA+PgplbmRvYmoKNDIgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNjAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQxIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDNQMARyUrnSuPRDKhScfJ0VuApRZcK58oACIOXuXIFcrr7OXAD8iQ4xZW5kc3RyZWFtCmVuZG9iago0MyAwIG9iago8PAovQVAgPDwKL04gNDIgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI2IDAgUiAvUmVjdCBbIDMxMS41NjggNTcxIDM3MS41NjggNTgyIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoaW5kaXZpZHVhbENpdHkpIAogIC9UVSAoQ2l0eSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago0NCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDE0IDAgUiA+PgplbmRvYmoKNDUgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjIgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQ0IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDJSMARyUrnSuPRDKhScfJ0VuApRZcK58oACIOXuXIFcrr7OXAD75Q4tZW5kc3RyZWFtCmVuZG9iago0NiAwIG9iago8PAovQVAgPDwKL04gNDUgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI2IDAgUiAvUmVjdCBbIDQwMC40NzIgNTcxIDQyMi40NzIgNTgyIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoaW5kaXZpZHVhbFN0YXRlKSAKICAvVFUgKFN0YXRlKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjQ3IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iago0OCAwIG9iago8PAovQkJveCBbIDAgMCAxMDEuNTI4IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNzAgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA0NyAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA0MNQzNbIwgAMjBUOgZCpXGpd+SIWCk6+zAlchfpXhXHlABSDj3LkCuVx9nbkAFs4UR2VuZHN0cmVhbQplbmRvYmoKNDkgMCBvYmoKPDwKL0FQIDw8Ci9OIDQ4IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyA0NDMuODA4IDU3MSA1NDUuMzM2IDU4MiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGluZGl2aWR1YWxaaXApIAogIC9UVSAoWmlwKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjUwIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iago1MSAwIG9iago8PAovQkJveCBbIDAgMCAxMDAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDUwIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQAYiAvlSuNSz+kQsHJ11mBqxBNKpwrDygC0uDOFcjl6uvMBQAWsA6HZW5kc3RyZWFtCmVuZG9iago1MiAwIG9iago8PAovQVAgPDwKL04gNTEgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI2IDAgUiAvUmVjdCBbIDgxLjM1MiA1NTUgMTgxLjM1MiA1NjYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChpbmRpdmlkdWFsUGhvbmUpIAogIC9UVSAoUGhvbmUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNTMgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyAxNCAwIFIgPj4KZW5kb2JqCjU0IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDMyNC42NDggMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDUzIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDYy0TMzsVAwBIqkcqVx6YdUKDj5OitwFWKRDufKA4qCNLpzBXK5+jpzAQCU+BA3ZW5kc3RyZWFtCmVuZG9iago1NSAwIG9iago8PAovQVAgPDwKL04gNTQgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI2IDAgUiAvUmVjdCBbIDIxNy41NzYgNTU1IDU0Mi4yMjQgNTY2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoaW5kaXZpZHVhbEVtYWlsKSAKICAvVFUgKEVtYWlsKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjU2IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iago1NyAwIG9iago8PAovQkJveCBbIDAgMCAyMDAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDU2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDIwUDAE8lK50rj0QyoUnHydFbgK0aTCufKAIiAN7lyBXK6+zlwAFwMOiWVuZHN0cmVhbQplbmRvYmoKNTggMCBvYmoKPDwKL0FQIDw8Ci9OIDU3IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyAxMDAuMDI0IDUyNSAzMDAuMDI0IDUzNiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yZ0xlZ2FsTmFtZSkgCiAgL1RVIChMZWdhbCBuYW1lKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjU5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iago2MCAwIG9iago8PAovQkJveCBbIDAgMCAyMTkuOTc2IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1OSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAytNSzNDdTMASKpHKlcemHVCg4+TorcBVikQ7nygOKgjS6cwVyufo6cwEAl2EQRWVuZHN0cmVhbQplbmRvYmoKNjEgMCBvYmoKPDwKL0FQIDw8Ci9OIDYwIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyAzMjguNjk2IDUyNSA1NDguNjcyIDUzNiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yZ0RiYSkgCiAgL1RVIChEQkEpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNjIgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyAxNCAwIFIgPj4KZW5kb2JqCjYzIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEwMCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNjIgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNABiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABawDodlbmRzdHJlYW0KZW5kb2JqCjY0IDAgb2JqCjw8Ci9BUCA8PAovTiA2MyAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgODYuNjcyIDUwOSAxODYuNjcyIDUyMCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yZ1RpbikgCiAgL1RVIChUSU4vRUlOKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjY1IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iago2NiAwIG9iago8PAovQkJveCBbIDAgMCAzMCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNjUgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNlAwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAPuZDitlbmRzdHJlYW0KZW5kb2JqCjY3IDAgb2JqCjw8Ci9BUCA8PAovTiA2NiAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgMjQ5LjEyOCA1MDkgMjc5LjEyOCA1MjAgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmdEb21pY2lsZVN0YXRlKSAKICAvVFUgKERvbWljaWxlIHN0YXRlKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjY4IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDggMCBSIC9ZZXMgNyAwIFIKPj4gL04gPDwKL09mZiA2IDAgUiAvWWVzIDUgMCBSCj4+IC9SIDw8Ci9PZmYgMTAgMCBSIC9ZZXMgOSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjYgMCBSIC9SZWN0IFsgOTkuNTc2IDQ5MyAxMDcuNTc2IDUwMSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yZ0VudGl0eVR5cGVfc29sZXByb3ApIAogIC9UVSAoU29sZSBwcm9wIFwoc29sZV9wcm9wXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago2OSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA4IDAgUiAvWWVzIDcgMCBSCj4+IC9OIDw8Ci9PZmYgNiAwIFIgL1llcyA1IDAgUgo+PiAvUiA8PAovT2ZmIDEwIDAgUiAvWWVzIDkgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI2IDAgUiAvUmVjdCBbIDE1Mi44MTYgNDkzIDE2MC44MTYgNTAxIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JnRW50aXR5VHlwZV9sbGMpIAogIC9UVSAoTExDIFwobGxjXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago3MCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA4IDAgUiAvWWVzIDcgMCBSCj4+IC9OIDw8Ci9PZmYgNiAwIFIgL1llcyA1IDAgUgo+PiAvUiA8PAovT2ZmIDEwIDAgUiAvWWVzIDkgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI2IDAgUiAvUmVjdCBbIDE4Ni40ODggNDkzIDE5NC40ODggNTAxIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JnRW50aXR5VHlwZV9zY29ycCkgCiAgL1RVIChTIENvcnAgXChzX2NvcnBcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjcxIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDggMCBSIC9ZZXMgNyAwIFIKPj4gL04gPDwKL09mZiA2IDAgUiAvWWVzIDUgMCBSCj4+IC9SIDw8Ci9PZmYgMTAgMCBSIC9ZZXMgOSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjYgMCBSIC9SZWN0IFsgMjMwLjM4NCA0OTMgMjM4LjM4NCA1MDEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmdFbnRpdHlUeXBlX2Njb3JwKSAKICAvVFUgKEMgQ29ycCBcKGNfY29ycFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNzIgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgOCAwIFIgL1llcyA3IDAgUgo+PiAvTiA8PAovT2ZmIDYgMCBSIC9ZZXMgNSAwIFIKPj4gL1IgPDwKL09mZiAxMCAwIFIgL1llcyA5IDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNiAwIFIgL1JlY3QgWyAyNzQuNzIgNDkzIDI4Mi43MiA1MDEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmdFbnRpdHlUeXBlX3BhcnRuZXJzaGlwKSAKICAvVFUgKFBhcnRuZXJzaGlwIFwocGFydG5lcnNoaXBcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjczIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDggMCBSIC9ZZXMgNyAwIFIKPj4gL04gPDwKL09mZiA2IDAgUiAvWWVzIDUgMCBSCj4+IC9SIDw8Ci9PZmYgMTAgMCBSIC9ZZXMgOSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjYgMCBSIC9SZWN0IFsgMzM0LjYyNCA0OTMgMzQyLjYyNCA1MDEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmdFbnRpdHlUeXBlX25vbnByb2ZpdCkgCiAgL1RVIChOb25wcm9maXQgXChub25wcm9maXRcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjc0IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDggMCBSIC9ZZXMgNyAwIFIKPj4gL04gPDwKL09mZiA2IDAgUiAvWWVzIDUgMCBSCj4+IC9SIDw8Ci9PZmYgMTAgMCBSIC9ZZXMgOSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjYgMCBSIC9SZWN0IFsgMzg2LjA4IDQ5MyAzOTQuMDggNTAxIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JnRW50aXR5VHlwZV9vdGhlcikgCiAgL1RVIChPdGhlciBcKG90aGVyXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago3NSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDE0IDAgUiA+PgplbmRvYmoKNzYgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjAwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjIgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA3NSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAyMFAwBPJSudK49EMqFJx8nRW4CtGkwrnygCIgDe5cgVyuvs5cABcDDollbmRzdHJlYW0KZW5kb2JqCjc3IDAgb2JqCjw8Ci9BUCA8PAovTiA3NiAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgODcuNTY4IDQ3NyAyODcuNTY4IDQ4OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yZ0FkZHJlc3NMaW5lMSkgCiAgL1RVIChBZGRyZXNzKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjc4IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iago3OSAwIG9iago8PAovQkJveCBbIDAgMCA2MCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNzggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwM1AwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAPyJDjFlbmRzdHJlYW0KZW5kb2JqCjgwIDAgb2JqCjw8Ci9BUCA8PAovTiA3OSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgMzExLjU2OCA0NzcgMzcxLjU2OCA0ODggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmdDaXR5KSAKICAvVFUgKENpdHkpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKODEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyAxNCAwIFIgPj4KZW5kb2JqCjgyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA4MSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAyUjAEclK50rj0QyoUnHydFbgKUWXCufKAAiDl7lyBXK6+zlwA++UOLWVuZHN0cmVhbQplbmRvYmoKODMgMCBvYmoKPDwKL0FQIDw8Ci9OIDgyIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyA0MDAuNDcyIDQ3NyA0MjIuNDcyIDQ4OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yZ1N0YXRlKSAKICAvVFUgKFN0YXRlKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjg0IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iago4NSAwIG9iago8PAovQkJveCBbIDAgMCAxMDEuNTI4IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNzAgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA4NCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA0MNQzNbIwgAMjBUOgZCpXGpd+SIWCk6+zAlchfpXhXHlABSDj3LkCuVx9nbkAFs4UR2VuZHN0cmVhbQplbmRvYmoKODYgMCBvYmoKPDwKL0FQIDw8Ci9OIDg1IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyA0NDMuODA4IDQ3NyA1NDUuMzM2IDQ4OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yZ1ppcCkgCiAgL1RVIChaaXApIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKODcgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyAxNCAwIFIgPj4KZW5kb2JqCjg4IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDE2MCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgODcgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNANiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABiWDpNlbmRzdHJlYW0KZW5kb2JqCjg5IDAgb2JqCjw8Ci9BUCA8PAovTiA4OCAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgODUuNzkyIDQ2MSAyNDUuNzkyIDQ3MiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yZ0NvbnRhY3ROYW1lKSAKICAvVFUgKENvbnRhY3QpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKOTAgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyAxNCAwIFIgPj4KZW5kb2JqCjkxIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEwMCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgOTAgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNABiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABawDodlbmRzdHJlYW0KZW5kb2JqCjkyIDAgb2JqCjw8Ci9BUCA8PAovTiA5MSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgMjcxLjEyOCA0NjEgMzcxLjEyOCA0NzIgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmdDb250YWN0VGl0bGUpIAogIC9UVSAoVGl0bGUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKOTMgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyAxNCAwIFIgPj4KZW5kb2JqCjk0IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDE0MC44NzIgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkzIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQx0LMwN1IwBIqk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eCBbIDAgMCA5IDkgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGXSA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJwr5DJUSFcwVHBX0LMwAmJTC3MgryhdwQAILYGwKFUhjUvP0FIBhoPcFQz0TBXKgaSRKYSw0INgoNpirkAAxrMRIWVuZHN0cmVhbQplbmRvYmoKMTAyIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDk5IDAgUiAvWWVzIDk4IDAgUgo+PiAvTiA8PAovT2ZmIDk3IDAgUiAvWWVzIDk2IDAgUgo+PiAvUiA8PAovT2ZmIDEwMSAwIFIgL1llcyAxMDAgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAoNCkKPj4gL1AgMTI2IDAgUiAvUmVjdCBbIDU0IDQ0NiA2MyA0NTUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChub3RTdWJqZWN0VG9CYWNrdXBXaXRoaG9sZGluZykgCiAgL1RVIChOb3Qgc3ViamVjdCB0byBiYWNrdXAgd2l0aGhvbGRpbmcgXChXLTkgUGFydCBJSVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTAzIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iagoxMDQgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjAwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjIgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMDMgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMjBQMATyUrnSuPRDKhScfJ0VuArRpMK58oAiIA3uXIFcrr7OXAAXAw6JZW5kc3RyZWFtCmVuZG9iagoxMDUgMCBvYmoKPDwKL0FQIDw8Ci9OIDEwNCAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjYgMCBSIC9SZWN0IFsgOTguNjg4IDQxMyAyOTguNjg4IDQyNCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGJhbmtOYW1lKSAKICAvVFUgKEJhbmsgbmFtZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMDYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyAxNCAwIFIgPj4KZW5kb2JqCjEwNyAwIG9iago8PAovQkJveCBbIDAgMCAxNjEuMzEyIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMDYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNDPUMzY0UjAEiqRypXHph1QoOPk6K3AVYpEO58oDioI0unMFcrn6OnMBAJCnEB1lbmRzdHJlYW0KZW5kb2JqCjEwOCAwIG9iago8PAovQVAgPDwKL04gMTA3IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyAzNzMuNjA4IDQxMyA1MzQuOTIgNDI0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAobmFtZU9uQWNjb3VudCkgCiAgL1RVIChOYW1lIG9uIGFjY291bnQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTA5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iagoxMTAgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTAwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMDkgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNABiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABawDodlbmRzdHJlYW0KZW5kb2JqCjExMSAwIG9iago8PAovQVAgPDwKL04gMTEwIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyA5Mi40NjQgMzk3IDE5Mi40NjQgNDA4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocm91dGluZ051bWJlcikgCiAgL1RVIChSb3V0aW5nICMpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTEyIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iagoxMTMgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTMwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTIgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNAZiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABejDo1lbmRzdHJlYW0KZW5kb2JqCjExNCAwIG9iago8PAovQVAgPDwKL04gMTEzIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyAyNDAuMjY0IDM5NyAzNzAuMjY0IDQwOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnROdW1iZXIpIAogIC9UVSAoQWNjb3VudCAjKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjExNSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA4IDAgUiAvWWVzIDcgMCBSCj4+IC9OIDw8Ci9PZmYgNiAwIFIgL1llcyA1IDAgUgo+PiAvUiA8PAovT2ZmIDEwIDAgUiAvWWVzIDkgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI2IDAgUiAvUmVjdCBbIDM4Ni4yNjQgMzk3IDM5NC4yNjQgNDA1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudFR5cGVfY2hlY2tpbmcpIAogIC9UVSAoQ2hlY2tpbmcgXChjaGVja2luZ1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTE2IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDggMCBSIC9ZZXMgNyAwIFIKPj4gL04gPDwKL09mZiA2IDAgUiAvWWVzIDUgMCBSCj4+IC9SIDw8Ci9PZmYgMTAgMCBSIC9ZZXMgOSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjYgMCBSIC9SZWN0IFsgNDQyLjYwOCAzOTcgNDUwLjYwOCA0MDUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50VHlwZV9zYXZpbmdzKSAKICAvVFUgKFNhdmluZ3MgXChzYXZpbmdzXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMTcgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgOTkgMCBSIC9ZZXMgOTggMCBSCj4+IC9OIDw8Ci9PZmYgOTcgMCBSIC9ZZXMgOTYgMCBSCj4+IC9SIDw8Ci9PZmYgMTAxIDAgUiAvWWVzIDEwMCAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBICg0KQo+PiAvUCAxMjYgMCBSIC9SZWN0IFsgNTQgMzgyIDYzIDM5MSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHZvaWRlZENoZWNrQXR0YWNoZWQpIAogIC9UVSAoVm9pZGVkIGNoZWNrIG9yIGJhbmsgbGV0dGVyIGF0dGFjaGVkKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTE4IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iagoxMTkgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTAwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNABiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABawDodlbmRzdHJlYW0KZW5kb2JqCjEyMCAwIG9iago8PAovQVAgPDwKL04gMTE5IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyAxMDguNDY0IDM0OSAyMDguNDY0IDM2MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHByaW9yUm91dGluZ051bWJlcikgCiAgL1RVIChQcmlvciByb3V0aW5nICMpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTIxIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgMTQgMCBSID4+CmVuZG9iagoxMjIgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTMwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMjEgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNAZiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABejDo1lbmRzdHJlYW0KZW5kb2JqCjEyMyAwIG9iago8PAovQVAgPDwKL04gMTIyIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNiAwIFIgL1JlY3QgWyAyNzQuNDg4IDM0OSA0MDQuNDg4IDM2MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHByaW9yQWNjb3VudE51bWJlcikgCiAgL1RVIChQcmlvciBhY2NvdW50ICMpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTI0IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDggMCBSIC9ZZXMgNyAwIFIKPj4gL04gPDwKL09mZiA2IDAgUiAvWWVzIDUgMCBSCj4+IC9SIDw8Ci9PZmYgMTAgMCBSIC9ZZXMgOSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjYgMCBSIC9SZWN0IFsgNDIwLjQ4OCAzNDkgNDI4LjQ4OCAzNTcgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwcmlvckFjY291bnRUeXBlX2NoZWNraW5nKSAKICAvVFUgKENoZWNraW5nIFwoY2hlY2tpbmdcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEyNSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA4IDAgUiAvWWVzIDcgMCBSCj4+IC9OIDw8Ci9PZmYgNiAwIFIgL1llcyA1IDAgUgo+PiAvUiA8PAovT2ZmIDEwIDAgUiAvWWVzIDkgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI2IDAgUiAvUmVjdCBbIDQ3Ni44MzIgMzQ5IDQ4NC44MzIgMzU3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocHJpb3JBY2NvdW50VHlwZV9zYXZpbmdzKSAKICAvVFUgKFNhdmluZ3MgXChzYXZpbmdzXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMjYgMCBvYmoKPDwKL0Fubm90cyBbIDExIDAgUiAxMiAwIFIgMTMgMCBSIDE3IDAgUiAyMCAwIFIgMjMgMCBSIDI2IDAgUiAyOSAwIFIgMzAgMCBSIDMxIDAgUiAKICAzNCAwIFIgMzcgMCBSIDQwIDAgUiA0MyAwIFIgNDYgMCBSIDQ5IDAgUiA1MiAwIFIgNTUgMCBSIDU4IDAgUiA2MSAwIFIgCiAgNjQgMCBSIDY3IDAgUiA2OCAwIFIgNjkgMCBSIDcwIDAgUiA3MSAwIFIgNzIgMCBSIDczIDAgUiA3NCAwIFIgNzcgMCBSIAogIDgwIDAgUiA4MyAwIFIgODYgMCBSIDg5IDAgUiA5MiAwIFIgOTUgMCBSIDEwMiAwIFIgMTA1IDAgUiAxMDggMCBSIDExMSAwIFIgCiAgMTE0IDAgUiAxMTUgMCBSIDExNiAwIFIgMTE3IDAgUiAxMjAgMCBSIDEyMyAwIFIgMTI0IDAgUiAxMjUgMCBSIF0gL0NvbnRlbnRzIDEzMCAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDEyOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgCiAgL1RyYW5zIDw8Cgo+PiAvVHlwZSAvUGFnZQo+PgplbmRvYmoKMTI3IDAgb2JqCjw8Ci9BY3JvRm9ybSAxMzEgMCBSIC9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgMTI5IDAgUiAvVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKMTI4IDAgb2JqCjw8Ci9BdXRob3IgKGFub255bW91cykgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDUwMjEzMzQ1Mi0wNCcwMCcpIC9DcmVhdG9yIChhbm9ueW1vdXMpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDUwMjEzMzQ1Mi0wNCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0ICh1bnNwZWNpZmllZCkgL1RpdGxlICh1bnRpdGxlZCkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iagoxMjkgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAxMjYgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iagoxMzAgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMjIwNAo+PgpzdHJlYW0KR2F0PSw9YDwlYSY6WEFXKG5gTyppQHMmPj0sVDclTU1oZnEqJFxLZlReVz1gWHQ3VEI7QypiImxFQltDNic2MiRIISg4QTFyUltlMVVEL2kmRmYzI2RKbWZvSjU2UkpwY0FMQ0BCZnNQNFYhQWhcNmJdaW1oPyZWaFpHT3VeQ3IsTHFRVWhBOyNoMiZAJ1BJWFg0XFRhLkAmNHVRIkFLSFtQNCZrV2E7VD87OTkySkkjI1xlI0xOcigwMlNzPCtsTSMpJVBIWk5UbjdpTXFVUHBjPSUqMnUhODdjPEZuSlluIVpoc1I2WWMvV0M+ME5wJCQrRmo3QiRmTTtEUDpBP0Y2cS5wTTFyLGBlMjVyPCprQ2NBQ1gjWEQtJ19DciRyblRIWT47XS8hYFUuRDRTZnJjJzFmN1UnQlVyRFQnXGtrJ2dccTgiY2Q+NzdfKzEtRVlgdFBeQFg3YHQoMFtRVGlxZC4lTiFMWTdKYCRpMjpfT1slYlJob2gxRkBETUtHSShaJnIqO1dUak0wJk1SV3I+M0o5XFoia1taRGNPRzlVWzEsWDxAallyTXRWSzFFLkxCXjZaI2ArPS1UQixYSS9lOT47NFJmOD8sMCYhQTEyZmRgN19AWXQ7R25gYzcxUV1UP2BQYHFYT1JPSi5icm4zMSs3RnNib2NgNlhCWVEqUWpnZklxNnEkTVUzcSs+WWM/Z1hfNC9VZVNbal1aUGRHWDcuQChsRzFSaT9Yc0BgMS9hbFQwSFZAISYtYCZiLEMiIkdqTCtyRmlSO28wXkltb1tbN0NIKGllSiYjbXQ3ZDYnViwuUmkpNzUkalBtQE5TLUNGNkRHQ2Q0Z1pvNW9vcCp1a0ZsSEAwUm9OMnIrUTpqYTQtI3BETlAiPzRWX2EmOEZNOUxZc20qbFZFXyg5KEZtR21kXy0zMTcyUyRRKG10cUReOkY5X0lXSDMzbisncl9walJWS1Q/Rm1fVTpPJ0thSklBXTlZPV1PUWhpLnJVWGVtPzFCTyZrXWMmJDZGLCIoMFRLR1tSalkiUSFiL240UjtwL1BLbipiMjhuZzouUiMsVDAiZGAqLmxmbjhJMSJRWGhbUlYiKmZZa3MtUTdtcD4xJG4wMF9COXBCbGJfZ1IuUmY/b0tfQkxgRUtnakIkYidmMTJDYjAuRmhyRGpIKU1WMTpUXFBdb2BnNEhWcio9LVk1V0pARV5VIzYlNkdscGglXGJRWmxfVGJvXCNTTVYpKTpZYEo4LDRlL1dwLnJlZisnTiRxIzlOT3FEZU4nTyRraGA/WEtiMEs5dCJSITpUYSVJSVEjXVpjXiUyIlc1QCNvVTFVO1JBYiQvISI4LDRpPSRDWDUwU2dURShvRmlDNXIjODQ6KzQ/WU45IypHZSFPYD4yNDVMKjhcMF5iQFVeLGRcXEw5UVVHOFtMaD0xYVNHNURsaE9ZZ2EuWCsxLWkyUERiNDQyckBCX19gWConTz5WMUBdZkE+KS1VI2BVRi1DQVQlNUMoYTw5XXRLXmBWRU06YjkwXjg0Vic8Li1GJ2tXUDMpamZDI21pPSw4TUIvZUFpPksvTSotZVVwbi5gNVdkOWcwUFtmPGJdZjBRUC0pZjRGKlgoOHBGWG9vOlhHVFNJKGZtQW1wM1BMcCZxLjtBZy49V1gqSWRJOjA6OVFKYDIpS2xtKy0zJSdGZTYrVSpkOjwlZDBDS0BvMGImaixERW9TLj1Zb1E9Rj02UUsmRCZbQEBgaEZOWkJdPy1AM2w7M3FublwrLGxBQTIkMXRiJk1lVVFHTUsxTVJGS1YzZDsxOGJTVjBUVFVdcj4wW1Ejc05WZlNlKU9SXDozUSRPNj5dKFhMcGFnP2xPNUVDV1dbSWdWUlFZUkpZVWVHWCRBVz9nZCFuJHFCLz9LXkwmKFhbVktTRVVcUXJfU1FQY0s9M04oXDxZJ3JCPDRRNCFLMmBiVWJsX2FuNnFZYEBHKiNpUikpPlo5PTwiZU9hQTFUU19rKFM2aFcqVkEzRWE4Ll0uJGc3RHEuYisqQSdfJVUxR01qIVEuTyotRWY0UnFlbVhXaF1xRUIsLi8sbE5KNztBT1xiUWIvL2ZkNCU8WylsW1gvOytlKlowcl0xQEVVLVBnRSk5Sk1GQD5SIXQ5Izc0clclUFRqaV9WIlMjQ286NE1AVihMOFpRLG9rWDM9RihdbEUyYTlVNWheTldQZSklQUBbSikkImNJK15PXVAtXV5cJG8rZ1k9RUlRN1gsaSIrMyMnNEY3SSo3UGVOb2kqY0BndT0nQUw+YENsNFZeKmxmKXBnMGpGMG44MiVXNGNLKkQwW2Q9WCMxQihSNStOVGJaXk1BXCx1THE2VDViTGM0T18nUk8qXTBwc1VrSzJsa1plTEZvRjdPOE5GMyQwSmNDTSNDZUx1b1Y/aT4vW2ZqJU9PSVZGYD9cK05lbzA5ZisjLHQ8MlxmMyRyb04oMGc5bXUiRE0pZCtDbDVlaXBBLGphZV9MSlA+LUNZREk7WChpLjBVYWlXMC8uN2xnWEVfRnMzJjhNS1xyW0AyY1dnIVlsMmpuJWY4bFpXWDRUJUhiVTk1MWRpKVs7UDE/XUxcVW1pbDpjbWdVVTo9Ji1Ybk4nTEQzOzhRWUliVHVvQm5haWUiKFo0ZGVqayw+ZXViZFcpS2g6ZjUyclRtcWkvU0BXLW03S2tkbS9FRE9bLFcuUSJrYyojYk1ZVk5nPEFXbEJyaDBJPiVXJVVJdG9nYy8sUUhucnA0LG9YN2pQaWIubUMiJ1FIRFZxNlImWmxUSEhOQCdlKD9EbVVzSilNK2Y7TFxgI1QxdDRsb2tYQkxvXiQsJFQwQFJ1Y0otWl1eJ1doRjJTJWgrWjUuWk9USjlEWFw3REZIXj1zUDtXKVMjZkdXRFRFUlZXLjZLVGUmIkdAME1afj5lbmRzdHJlYW0KZW5kb2JqCjEzMSAwIG9iago8PAovREEgKC9IZWx2IDAgVGYgMCBnKSAvRFIgPDwgL0VuY29kaW5nCjw8Ci9STEFGZW5jb2RpbmcKMTQgMCBSCj4+Ci9Gb250IDw8IC9IZWx2IDE1IDAgUiA+Pgo+PiAvRmllbGRzIFsgMTEgMCBSIDEyIDAgUiAxMyAwIFIgMTcgMCBSIDIwIDAgUiAyMyAwIFIgMjYgMCBSIDI5IDAgUiAzMCAwIFIgMzEgMCBSIAogIDM0IDAgUiAzNyAwIFIgNDAgMCBSIDQzIDAgUiA0NiAwIFIgNDkgMCBSIDUyIDAgUiA1NSAwIFIgNTggMCBSIDYxIDAgUiAKICA2NCAwIFIgNjcgMCBSIDY4IDAgUiA2OSAwIFIgNzAgMCBSIDcxIDAgUiA3MiAwIFIgNzMgMCBSIDc0IDAgUiA3NyAwIFIgCiAgODAgMCBSIDgzIDAgUiA4NiAwIFIgODkgMCBSIDkyIDAgUiA5NSAwIFIgMTAyIDAgUiAxMDUgMCBSIDEwOCAwIFIgMTExIDAgUiAKICAxMTQgMCBSIDExNSAwIFIgMTE2IDAgUiAxMTcgMCBSIDEyMCAwIFIgMTIzIDAgUiAxMjQgMCBSIDEyNSAwIFIgXQo+PgplbmRvYmoKeHJlZgowIDEzMgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQ0NiAwMDAwMCBuIAowMDAwMDAwODA2IDAwMDAwIG4gCjAwMDAwMDEwNjQgMDAwMDAgbiAKMDAwMDAwMTQyNyAwMDAwMCBuIAowMDAwMDAxNjkwIDAwMDAwIG4gCjAwMDAwMDIwNTIgMDAwMDAgbiAKMDAwMDAwMjMxNCAwMDAwMCBuIAowMDAwMDAyNjc3IDAwMDAwIG4gCjAwMDAwMDMwNDkgMDAwMDAgbiAKMDAwMDAwMzQyMSAwMDAwMCBuIAowMDAwMDA0NzQ0IDAwMDAwIG4gCjAwMDAwMDQ4NDQgMDAwMDAgbiAKMDAwMDAwNTEzMyAwMDAwMCBuIAowMDAwMDA1Mzg0IDAwMDAwIG4gCjAwMDAwMDU0ODQgMDAwMDAgbiAKMDAwMDAwNTc3OSAwMDAwMCBuIAowMDAwMDA2MDMxIDAwMDAwIG4gCjAwMDAwMDYxMzEgMDAwMDAgbiAKMDAwMDAwNjQxOSAwMDAwMCBuIAowMDAwMDA2NjgyIDAwMDAwIG4gCjAwMDAwMDY3ODIgMDAwMDAgbiAKMDAwMDAwNzA3MCAwMDAwMCBuIAowMDAwMDA3MzMzIDAwMDAwIG4gCjAwMDAwMDc0MzMgMDAwMDAgbiAKMDAwMDAwNzczMiAwMDAwMCBuIAowMDAwMDA3OTk4IDAwMDAwIG4gCjAwMDAwMDgzODcgMDAwMDAgbiAKMDAwMDAwODc4MCAwMDAwMCBuIAowMDAwMDA4ODgwIDAwMDAwIG4gCjAwMDAwMDkxNjkgMDAwMDAgbiAKMDAwMDAwOTQzNSAwMDAwMCBuIAowMDAwMDA5NTM1IDAwMDAwIG4gCjAwMDAwMDk4MzMgMDAwMDAgbiAKMDAwMDAxMDA4NSAwMDAwMCBuIAowMDAwMDEwMTg1IDAwMDAwIG4gCjAwMDAwMTA0NzQgMDAwMDAgbiAKMDAwMDAxMDczOSAwMDAwMCBuIAowMDAwMDEwODM5IDAwMDAwIG4gCjAwMDAwMTExMjYgMDAwMDAgbiAKMDAwMDAxMTM4MSAwMDAwMCBuIAowMDAwMDExNDgxIDAwMDAwIG4gCjAwMDAwMTE3NjggMDAwMDAgbiAKMDAwMDAxMjAyNSAwMDAwMCBuIAowMDAwMDEyMTI1IDAwMDAwIG4gCjAwMDAwMTI0MjYgMDAwMDAgbiAKMDAwMDAxMjY3OSAwMDAwMCBuIAowMDAwMDEyNzc5IDAwMDAwIG4gCjAwMDAwMTMwNjcgMDAwMDAgbiAKMDAwMDAxMzMyMyAwMDAwMCBuIAowMDAwMDEzNDIzIDAwMDAwIG4gCjAwMDAwMTM3MjEgMDAwMDAgbiAKMDAwMDAxMzk3OCAwMDAwMCBuIAowMDAwMDE0MDc4IDAwMDAwIG4gCjAwMDAwMTQzNjcgMDAwMDAgbiAKMDAwMDAxNDYyNiAwMDAwMCBuIAowMDAwMDE0NzI2IDAwMDAwIG4gCjAwMDAwMTUwMjQgMDAwMDAgbiAKMDAwMDAxNTI3MCAwMDAwMCBuIAowMDAwMDE1MzcwIDAwMDAwIG4gCjAwMDAwMTU2NTggMDAwMDAgbiAKMDAwMDAxNTkwNyAwMDAwMCBuIAowMDAwMDE2MDA3IDAwMDAwIG4gCjAwMDAwMTYyOTQgMDAwMDAgbiAKMDAwMDAxNjU2MSAwMDAwMCBuIAowMDAwMDE2OTQzIDAwMDAwIG4gCjAwMDAwMTczMDkgMDAwMDAgbiAKMDAwMDAxNzY4MyAwMDAwMCBuIAowMDAwMDE4MDU3IDAwMDAwIG4gCjAwMDAwMTg0NDUgMDAwMDAgbiAKMDAwMDAxODgyOSAwMDAwMCBuIAowMDAwMDE5MTk5IDAwMDAwIG4gCjAwMDAwMTkyOTkgMDAwMDAgbiAKMDAwMDAxOTU4OCAwMDAwMCBuIAowMDAwMDE5ODQ2IDAwMDAwIG4gCjAwMDAwMTk5NDYgMDAwMDAgbiAKMDAwMDAyMDIzMyAwMDAwMCBuIAowMDAwMDIwNDgxIDAwMDAwIG4gCjAwMDAwMjA1ODEgMDAwMDAgbiAKMDAwMDAyMDg2OCAwMDAwMCBuIAowMDAwMDIxMTE4IDAwMDAwIG4gCjAwMDAwMjEyMTggMDAwMDAgbiAKMDAwMDAyMTUxOSAwMDAwMCBuIAowMDAwMDIxNzY1IDAwMDAwIG4gCjAwMDAwMjE4NjUgMDAwMDAgbiAKMDAwMDAyMjE1MyAwMDAwMCBuIAowMDAwMDIyNDEwIDAwMDAwIG4gCjAwMDAwMjI1MTAgMDAwMDAgbiAKMDAwMDAyMjc5OCAwMDAwMCBuIAowMDAwMDIzMDU1IDAwMDAwIG4gCjAwMDAwMjMxNTUgMDAwMDAgbiAKMDAwMDAyMzQ1MyAwMDAwMCBuIAowMDAwMDIzNzEwIDAwMDAwIG4gCjAwMDAwMjQzMjQgMDAwMDAgbiAKMDAwMDAyNDU4MyAwMDAwMCBuIAowMDAwMDI1MjAxIDAwMDAwIG4gCjAwMDAwMjU0NjUgMDAwMDAgbiAKMDAwMDAyNjA4MyAwMDAwMCBuIAowMDAwMDI2MzQ2IDAwMDAwIG4gCjAwMDAwMjY3NjAgMDAwMDAgbiAKMDAwMDAyNjg2MSAwMDAwMCBuIAowMDAwMDI3MTUyIDAwMDAwIG4gCjAwMDAwMjc0MDcgMDAwMDAgbiAKMDAwMDAyNzUwOCAwMDAwMCBuIAowMDAwMDI3ODA4IDAwMDAwIG4gCjAwMDAwMjgwNzQgMDAwMDAgbiAKMDAwMDAyODE3NSAwMDAwMCBuIAowMDAwMDI4NDY1IDAwMDAwIG4gCjAwMDAwMjg3MjUgMDAwMDAgbiAKMDAwMDAyODgyNiAwMDAwMCBuIAowMDAwMDI5MTE2IDAwMDAwIG4gCjAwMDAwMjkzNzcgMDAwMDAgbiAKMDAwMDAyOTc1NyAwMDAwMCBuIAowMDAwMDMwMTM0IDAwMDAwIG4gCjAwMDAwMzA1MjUgMDAwMDAgbiAKMDAwMDAzMDYyNiAwMDAwMCBuIAowMDAwMDMwOTE2IDAwMDAwIG4gCjAwMDAwMzExODggMDAwMDAgbiAKMDAwMDAzMTI4OSAwMDAwMCBuIAowMDAwMDMxNTc5IDAwMDAwIG4gCjAwMDAwMzE4NTEgMDAwMDAgbiAKMDAwMDAzMjIzNiAwMDAwMCBuIAowMDAwMDMyNjE4IDAwMDAwIG4gCjAwMDAwMzMxODkgMDAwMDAgbiAKMDAwMDAzMzI3OSAwMDAwMCBuIAowMDAwMDMzNTQyIDAwMDAwIG4gCjAwMDAwMzM2MDUgMDAwMDAgbiAKMDAwMDAzNTkwMiAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzxkMGQyODc3MTFjMDMzZGFlYjE5NDQxNjRkZTljOGNlNj48ZDBkMjg3NzExYzAzM2RhZWIxOTQ0MTY0ZGU5YzhjZTY+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDEyOCAwIFIKL1Jvb3QgMTI3IDAgUgovU2l6ZSAxMzIKPj4Kc3RhcnR4cmVmCjM2MzkwCiUlRU9GCg==";
const __c_ach_bank_account_info_pdf: Uint8Array = (() => {
  const bin = atob(__c_ach_bank_account_info_pdf_b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
})();
const __c_ach_bank_account_info_md: string = `# ACH Bank Account Information

*Use this form to provide bank-account routing details for ACH credit payments. This form does not authorize any specific transaction; the authorization is granted separately (vendor agreement, W-9, or master services agreement).*

## Action

- [{{#if (eq actionType "new")}}x{{else}} {{/if}}] New
- [{{#if (eq actionType "change")}}x{{else}} {{/if}}] Change
- [{{#if (eq actionType "cancel")}}x{{else}} {{/if}}] Cancel

## Requestor (Company)

- **Name:** {{parties.requestor.legalName}}{{#if requestorDba}} (DBA {{requestorDba}}){{/if}}
- **A/P contact:** {{requestorContactName}}
- **A/P email:** {{requestorContactEmail}}
- **Vendor / payee number:** {{requestorVendorNumber}}

## Account Holder (Payee)

- **Type:**
  - [{{#if (eq accountHolderType "individual")}}x{{else}} {{/if}}] Individual
  - [{{#if (eq accountHolderType "organization")}}x{{else}} {{/if}}] Organization

{{#if (eq accountHolderType "individual")}}
- **Name:** {{parties.accountHolder.name}}
- **SSN:** {{individualSsn}}
- **Address:** {{individualAddress.line1}}{{#if individualAddress.line2}}, {{individualAddress.line2}}{{/if}}, {{individualAddress.locality}}, {{individualAddress.region}} {{individualAddress.postalCode}}
- **Phone:** {{individualPhone}}
- **Email:** {{individualEmail}}
{{/if}}

{{#if (eq accountHolderType "organization")}}
- **Legal name:** {{parties.accountHolder.legalName}}{{#if orgDba}} (DBA {{orgDba}}){{/if}}
- **TIN / EIN:** {{orgTin}}
- **Entity type:**
  - [{{#if (eq orgEntityType "sole_prop")}}x{{else}} {{/if}}] Sole proprietor
  - [{{#if (eq orgEntityType "llc")}}x{{else}} {{/if}}] LLC
  - [{{#if (eq orgEntityType "s_corp")}}x{{else}} {{/if}}] S corporation
  - [{{#if (eq orgEntityType "c_corp")}}x{{else}} {{/if}}] C corporation
  - [{{#if (eq orgEntityType "partnership")}}x{{else}} {{/if}}] Partnership
  - [{{#if (eq orgEntityType "nonprofit")}}x{{else}} {{/if}}] Nonprofit
  - [{{#if (eq orgEntityType "other")}}x{{else}} {{/if}}] Other
- **Domicile state:** {{orgDomicileState}}
- **Address:** {{orgAddress.line1}}{{#if orgAddress.line2}}, {{orgAddress.line2}}{{/if}}, {{orgAddress.locality}}, {{orgAddress.region}} {{orgAddress.postalCode}}
- **Contact:** {{orgContactName}}{{#if orgContactTitle}}, {{orgContactTitle}}{{/if}}
- **Contact email:** {{orgContactEmail}}
- [{{#if notSubjectToBackupWithholding}}x{{else}} {{/if}}] Not subject to backup withholding (W-9 Part II attestation)
{{/if}}

## Bank Account

- **Bank name:** {{bankName}}
- **Routing / ABA #:** {{routingNumber}}
- **Account #:** {{accountNumber}}
- **Type:**
  - [{{#if (eq accountType "checking")}}x{{else}} {{/if}}] Checking
  - [{{#if (eq accountType "savings")}}x{{else}} {{/if}}] Savings
- **Name on account (if different):** {{nameOnAccount}}
- [{{#if voidedCheckAttached}}x{{else}} {{/if}}] Voided check or bank letter attached

{{#if (eq actionType "change")}}
## Prior Bank Info (on file)

- **Prior routing #:** {{priorRoutingNumber}}
- **Prior account #:** {{priorAccountNumber}}
- **Prior type:**
  - [{{#if (eq priorAccountType "checking")}}x{{else}} {{/if}}] Checking
  - [{{#if (eq priorAccountType "savings")}}x{{else}} {{/if}}] Savings
{{/if}}

## Certification

1. I certify that the information provided on this form is true, complete, and correct.
2. I will notify the Requestor in writing of any change to the named financial institution, routing number, or account number.
3. I acknowledge that ACH transactions to my account will comply with U.S. law and the NACHA Operating Rules.
4. I represent that I am the account holder or an authorized representative of the account holder.

## Signature

{{#with parties.accountHolder}}
**Signature:** {{signature "accountHolderSignature"}}
**Date:** {{signatureDate "accountHolderSignature"}}
**Printed name:** {{printedName "accountHolderPrintedName"}}
{{#if (eq ../accountHolderType "organization")}}
**Title / capacity:** {{capacity "accountHolderCapacity"}}
{{/if}}
{{/with}}
`;

const contents: Record<string, string | Uint8Array> = {
  "ach-bank-account-info.instructions.md": __c_ach_bank_account_info_instructions_md,
  "ach-bank-account-info.pdf": __c_ach_bank_account_info_pdf,
  "ach-bank-account-info.md": __c_ach_bank_account_info_md,
};

const baseForm = para.form(schema);
const resolver = createMemoryResolver({ contents });

const originalFill = baseForm.fill.bind(baseForm);
const originalSafeFill = baseForm.safeFill.bind(baseForm);

type Draft = ReturnType<typeof baseForm.fill>;
type RenderArg = Parameters<Draft["render"]>[0];

function bindResolver(draft: Draft): Draft {
  const originalRender = draft.render.bind(draft);
  draft.render = ((opts: RenderArg) => originalRender({ resolver, ...opts })) as Draft["render"];
  return draft;
}

/**
 * ACH Bank Account Information
 *
 * Standalone vendor / payee bank-account-information collection form for ACH credit destination setup. Captures account-holder identity (individual or organization), bank routing/account/type, and (for organizations) W-9-adjacent entity classification. Pairs with a separate authorization document (vendor agreement, W-9, MSA); the form itself is data-collection only and does not carry an authorization clause.
 */
export const achBankAccountInfo = Object.assign(baseForm, {
  /** Pre-populated resolver containing every layer and instruction file this artifact references. */
  resolver,
  /** The raw form spec, exactly as authored in artifacts/banking/ach-bank-account-info/. */
  spec: schema,
  fill(data: Parameters<typeof originalFill>[0], options?: Parameters<typeof originalFill>[1]) {
    return bindResolver(originalFill(data, options));
  },
  safeFill(data: Parameters<typeof originalSafeFill>[0], options?: Parameters<typeof originalSafeFill>[1]) {
    const result = originalSafeFill(data, options);
    if (result.success) bindResolver(result.data);
    return result;
  },
});

export default achBankAccountInfo;
