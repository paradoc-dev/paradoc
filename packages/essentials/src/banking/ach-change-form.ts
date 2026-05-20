// AUTO-GENERATED from artifacts/banking/ach-change-form/design/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-change-form

import { para, createMemoryResolver } from "@paradoc/core";

const schema = {
  "$schema": "https://schema.paradoc.dev/schema.json",
  "kind": "form",
  "name": "ach-change-form",
  "version": "1.0.0",
  "title": "ACH Change Form",
  "description": "Standalone form by which an account holder requests a change to an existing ACH arrangement (direct deposit, ACH credit, or ACH debit) already authorized with an originator. Captures change type, identification of the existing arrangement, new account or amount/frequency information, and an effective date. Governed by NACHA Operating Rules and the legal framework of the underlying authorization.",
  "code": "ACH-CHANGE",
  "releaseDate": "2026-05-02",
  "metadata": {
    "domain": "banking"
  },
  "instructions": {
    "kind": "file",
    "path": "ach-change-form.instructions.md",
    "mimeType": "text/markdown",
    "title": "Instructions for ACH Change Form",
    "description": "Generated instructions derived from the artifact definition.",
    "checksum": "sha256:971b0d17e73385d95208a80ed7da1ad0ac18aa17ddfdc13916274a1c05eb55dc"
  },
  "parties": {
    "originator": {
      "partyType": "organization",
      "label": "Originator (Company)",
      "description": "The company that holds the existing ACH arrangement on file with the account holder (employer for direct deposit, biller for ACH debit, payer for ACH credit). Receives the change request and updates its internal ACH instructions accordingly; does not sign this form.",
      "min": 1,
      "max": 1
    },
    "accountHolder": {
      "partyType": "any",
      "label": "Account Holder",
      "description": "The individual or organization whose existing ACH arrangement is being modified. Identifies the existing arrangement, supplies the requested change details, and signs to authorize the modification.",
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
    "originatorAddress": {
      "type": "address",
      "label": "Originator address (for change-notice correspondence)",
      "description": "Mailing address of the originator. Used by the account holder to mail the completed change form when an electronic submission channel isn't available.",
      "required": false,
      "visible": true
    },
    "originatorPhone": {
      "type": "phone",
      "label": "Originator phone",
      "description": "Telephone number for the originator's ACH or payroll/A-P contact who handles change requests.",
      "required": false,
      "visible": true
    },
    "originatorEmail": {
      "type": "email",
      "label": "Originator email",
      "description": "Email address for the originator's ACH or payroll/A-P contact who handles change requests.",
      "required": false,
      "visible": true
    },
    "accountHolderType": {
      "type": "enum",
      "label": "Account holder type",
      "description": "Selects whether the account holder is a natural person ('individual') or a legal entity ('organization'). Affects which contact-info fields are required.",
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
    "accountHolderAddress": {
      "type": "address",
      "label": "Account holder address",
      "description": "Mailing address of the account holder, used to confirm identity and route change confirmations.",
      "required": true,
      "visible": true
    },
    "accountHolderPhone": {
      "type": "phone",
      "label": "Account holder phone",
      "description": "Phone number of the account holder. Required when accountHolderType is 'organization' (because an org contact channel is essential); optional for individuals.",
      "required": "fields.accountHolderType == 'organization'",
      "visible": true
    },
    "accountHolderEmail": {
      "type": "email",
      "label": "Account holder email",
      "description": "Email address of the account holder. Required when accountHolderType is 'organization'; optional for individuals.",
      "required": "fields.accountHolderType == 'organization'",
      "visible": true
    },
    "customerOrEmployeeId": {
      "type": "text",
      "label": "Customer / employee / vendor ID (originator-assigned)",
      "description": "Identifier the originator already has on file for this account holder (customer ID for billers, employee ID for payroll, vendor number for A/P). Helps the originator locate the existing record quickly.",
      "maxLength": 100,
      "required": false,
      "visible": true
    },
    "originatorReference": {
      "type": "text",
      "label": "Originator reference (contract / agreement / loan number)",
      "description": "Reference number for the underlying agreement that authorized the ACH arrangement (e.g., loan number, service contract, employment ID). Helps the originator scope the change to the correct authorization.",
      "maxLength": 100,
      "required": false,
      "visible": true
    },
    "oldAccountLast4": {
      "type": "text",
      "label": "Last 4 digits of old account number",
      "description": "Last four digits of the existing on-file account number. Used to disambiguate when the account holder has multiple ACH arrangements with the originator without exposing the full account number.",
      "pattern": "^\\d{4}$",
      "required": true,
      "visible": true
    },
    "oldBankName": {
      "type": "text",
      "label": "Old bank name (for reconciliation)",
      "description": "Name of the bank holding the existing on-file account. Optional but helpful when the originator's records show only the routing number.",
      "maxLength": 100,
      "required": false,
      "visible": true
    },
    "changeType": {
      "type": "enum",
      "label": "Change type",
      "description": "What aspect of the existing ACH arrangement is being changed. Drives which subset of new-information fields appear and are required.",
      "enum": [
        {
          "value": "update_account_info",
          "label": "Update account info"
        },
        {
          "value": "change_amount",
          "label": "Change amount"
        },
        {
          "value": "change_frequency",
          "label": "Change frequency"
        },
        {
          "value": "add_secondary_account",
          "label": "Add secondary account"
        },
        {
          "value": "other",
          "label": "Other"
        }
      ],
      "required": true,
      "visible": true
    },
    "changeOtherDescription": {
      "type": "text",
      "label": "Describe the requested change",
      "description": "Free-form description of the change when none of the named change types apply. Required only when changeType == 'other'.",
      "maxLength": 500,
      "required": "fields.changeType == 'other'",
      "visible": "fields.changeType == 'other'"
    },
    "newBankName": {
      "type": "text",
      "label": "New bank name",
      "description": "Name of the bank holding the new account. Required when the change introduces new account information (update or add-secondary).",
      "maxLength": 100,
      "required": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'",
      "visible": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'"
    },
    "newRoutingNumber": {
      "type": "text",
      "label": "New routing/ABA number (9 digits)",
      "description": "Nine-digit ABA routing number for the new account. Must pass the Federal Reserve checksum.",
      "pattern": "^\\d{9}$",
      "required": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'",
      "visible": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'"
    },
    "newAccountNumber": {
      "type": "text",
      "label": "New account number",
      "description": "Account number at the new bank; 4-17 alphanumeric per NACHA conventions. Required when changing account info or adding a secondary account.",
      "pattern": "^[A-Za-z0-9]+$",
      "minLength": 4,
      "maxLength": 17,
      "required": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'",
      "visible": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'"
    },
    "newAccountType": {
      "type": "enum",
      "label": "New account type",
      "description": "Demand-deposit account type for the new account, used to set the NACHA standard entry class code.",
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
      "required": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'",
      "visible": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'"
    },
    "voidedCheckAttached": {
      "type": "boolean",
      "label": "Voided check or bank verification letter attached",
      "description": "Whether supporting documentation (voided check or bank letter) has been attached to verify the new account numbers. Strongly encouraged when changing account information.",
      "required": false,
      "visible": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'"
    },
    "newAmount": {
      "type": "money",
      "label": "New deposit amount (USD)",
      "description": "Updated dollar amount for fixed-amount ACH arrangements (most commonly for partial direct-deposit allotments). Required only when changeType == 'change_amount'.",
      "min": 0.01,
      "required": "fields.changeType == 'change_amount'",
      "visible": "fields.changeType == 'change_amount'"
    },
    "newFrequency": {
      "type": "enum",
      "label": "New frequency",
      "description": "Updated cadence at which the ACH transaction recurs. Required only when changeType == 'change_frequency'.",
      "enum": [
        {
          "value": "weekly",
          "label": "Weekly"
        },
        {
          "value": "biweekly",
          "label": "Bi-weekly"
        },
        {
          "value": "semimonthly",
          "label": "Semi-monthly"
        },
        {
          "value": "monthly",
          "label": "Monthly"
        },
        {
          "value": "quarterly",
          "label": "Quarterly"
        },
        {
          "value": "annual",
          "label": "Annual"
        },
        {
          "value": "other",
          "label": "Other"
        }
      ],
      "required": "fields.changeType == 'change_frequency'",
      "visible": "fields.changeType == 'change_frequency'"
    },
    "effectiveDate": {
      "type": "date",
      "label": "Requested effective date",
      "description": "Date on which the requested change should take effect. The originator typically needs several business days of lead time to apply changes before the next ACH cycle.",
      "required": true,
      "visible": true
    }
  },
  "annexes": {
    "voidedCheck": {
      "title": "Voided check or bank verification letter",
      "description": "Voided check, deposit slip, or official bank-issued letter confirming the new account number, routing number, and account holder name. Required when the change involves new account information.",
      "order": 0,
      "required": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'",
      "visible": "fields.changeType == 'update_account_info' or fields.changeType == 'add_secondary_account'"
    }
  },
  "layers": {
    "pdf": {
      "kind": "file",
      "mimeType": "application/pdf",
      "title": "PDF Form",
      "path": "ach-change-form.pdf",
      "checksum": "sha256:fb4f5d450390a82552888408ce8e1dcc13e3ace85b22491a8dee6b11cfeb3adc",
      "bindings": {
        "originatorName": "parties.originator.legalName",
        "originatorPhone": "originatorPhone.number",
        "originatorAddressLine1": "originatorAddress.line1",
        "originatorCity": "originatorAddress.locality",
        "originatorState": "originatorAddress.region",
        "originatorZip": "originatorAddress.postalCode",
        "originatorEmail": "originatorEmail",
        "accountHolderName": "parties.accountHolder.name",
        "accountHolderType_individual": "accountHolderType:individual",
        "accountHolderType_organization": "accountHolderType:organization",
        "accountHolderAddressLine1": "accountHolderAddress.line1",
        "accountHolderCity": "accountHolderAddress.locality",
        "accountHolderState": "accountHolderAddress.region",
        "accountHolderZip": "accountHolderAddress.postalCode",
        "accountHolderPhone": "accountHolderPhone.number",
        "accountHolderEmail": "accountHolderEmail",
        "customerOrEmployeeId": "customerOrEmployeeId",
        "originatorReference": "originatorReference",
        "oldAccountLast4": "oldAccountLast4",
        "oldBankName": "oldBankName",
        "changeType_updateaccountinfo": "changeType:update_account_info",
        "changeType_changeamount": "changeType:change_amount",
        "changeType_changefrequency": "changeType:change_frequency",
        "changeType_addsecondaryaccount": "changeType:add_secondary_account",
        "changeType_other": "changeType:other",
        "changeOtherDescription": "changeOtherDescription",
        "newBankName": "newBankName",
        "newRoutingNumber": "newRoutingNumber",
        "newAccountNumber": "newAccountNumber",
        "newAccountType_checking": "newAccountType:checking",
        "newAccountType_savings": "newAccountType:savings",
        "voidedCheckAttached": "voidedCheckAttached",
        "newAmount": "newAmount.amount",
        "newFrequency_weekly": "newFrequency:weekly",
        "newFrequency_biweekly": "newFrequency:biweekly",
        "newFrequency_semimonthly": "newFrequency:semimonthly",
        "newFrequency_monthly": "newFrequency:monthly",
        "newFrequency_quarterly": "newFrequency:quarterly",
        "newFrequency_annual": "newFrequency:annual",
        "newFrequency_other": "newFrequency:other",
        "effectiveDate": "effectiveDate"
      },
      "signatureBlocks": {
        "accountHolderSignature": {
          "type": "signature",
          "page": 1,
          "x": 110,
          "y": 660,
          "width": 230,
          "height": 12,
          "partyRole": "accountHolder",
          "partyIndex": 0,
          "label": "Signature of Account Holder"
        },
        "accountHolderDate": {
          "type": "date",
          "page": 1,
          "x": 392,
          "y": 660,
          "width": 90,
          "height": 12,
          "partyRole": "accountHolder",
          "partyIndex": 0,
          "label": "Date"
        },
        "accountHolderPrintedName": {
          "type": "printed_name",
          "page": 1,
          "x": 130,
          "y": 682,
          "width": 230,
          "height": 12,
          "partyRole": "accountHolder",
          "partyIndex": 0,
          "label": "Printed name"
        },
        "accountHolderCapacity": {
          "type": "capacity",
          "page": 1,
          "x": 460,
          "y": 682,
          "width": 100,
          "height": 12,
          "partyRole": "accountHolder",
          "partyIndex": 0,
          "label": "Title / capacity (organizations)"
        }
      }
    },
    "markdown": {
      "kind": "file",
      "mimeType": "text/markdown",
      "title": "Markdown Form",
      "path": "ach-change-form.md",
      "checksum": "sha256:bc31d09635bbc1b551979ffb9cc66448c02f7199dc2b25b55ee79ded9637beb4"
    }
  },
  "defaultLayer": "pdf"
} as const;

const __c_ach_change_form_instructions_md: string = `---
title: Instructions for ACH Change Form
source_url: null
slug: ach-change-form
timestamp: 2026-05-12T02:39:15Z
generated: true
---

# Instructions for ACH Change Form

## Purpose

An account holder uses this form to request a change to an existing ACH arrangement — for example, a direct deposit, an ACH credit, or an ACH debit — already authorized with an originator (a company, employer, or agency). It does **not** create a new authorization; the original authorization stays in place, modified by the change requested here.

## How to fill it out

### 1. Originator (the company on the other side of the existing ACH arrangement)

**1.** Enter the originator's mailing address, phone, and email so the originator can send a confirmation if needed.

### 2. Account holder (the person or organization whose account is changing)

**2.** Select the Account holder type: **Individual** or **Organization**.

**3.** Enter the account holder's mailing address (required).

**4.** If the account holder is an **Organization**, also enter a phone and email for operational contact. These are optional for an individual.

**5.** If the originator assigned a customer, employee, or vendor ID, enter it.

**6.** If a contract, agreement, or loan number applies, enter it under originator reference.

### 3. Identify the existing arrangement

**7.** Enter the **last 4 digits** of the old account number. This is how the originator will locate the existing record.

**8.** Optionally enter the old bank name to help with reconciliation.

### 4. What is changing

**9.** Select the Change type:
   - **Update account info** — new bank, routing number, or account number
   - **Change amount** — change a fixed deposit or payment amount
   - **Change frequency** — switch how often the ACH runs
   - **Add secondary account** — direct part of the payment to an additional account
   - **Other** — anything else

**10.** If **Other** is selected, describe the requested change in plain language.

### 5. New account details (only if updating account info or adding a secondary account)

Complete steps 11–14 if the Change type is **Update account info** or **Add secondary account**.

**11.** Enter the new bank name.

**12.** Enter the new 9-digit routing / ABA number.

**13.** Enter the new account number.

**14.** Select the new account type: **Checking** or **Savings**.

**15.** Check the box if a voided check or bank verification letter is attached. Attaching one is recommended.

### 6. New amount (only if changing amount)

**16.** Enter the new deposit or payment amount in U.S. dollars.

### 7. New frequency (only if changing frequency)

**17.** Select the new frequency: **Weekly**, **Bi-weekly**, **Semi-monthly**, **Monthly**, **Quarterly**, **Annual**, or **Other**.

### 8. Effective date

**18.** Enter the date the change should take effect. Allow the originator enough lead time to process the change before that date — typically one full pay or billing cycle.

### 9. Submit

**19.** Sign and date the form (if a signature block is provided), then return it to the originator using the contact information they provided.
`;
const __c_ach_change_form_pdf_b64 = "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtT2JsaXF1ZSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjMgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUgL0VuY29kaW5nIC9EaWZmZXJlbmNlcyBbMjQgL2JyZXZlIC9jYXJvbiAvY2lyY3VtZmxleCAvZG90YWNjZW50IC9odW5nYXJ1bWxhdXQgL29nb25layAvcmluZyAvdGlsZGUgMzkgL3F1b3Rlc2luZ2xlIDk2IC9ncmF2ZSAxMjggL2J1bGxldCAvZGFnZ2VyIC9kYWdnZXJkYmwgL2VsbGlwc2lzIC9lbWRhc2ggL2VuZGFzaCAvZmxvcmluIC9mcmFjdGlvbiAvZ3VpbHNpbmdsbGVmdCAvZ3VpbHNpbmdscmlnaHQgL21pbnVzIC9wZXJ0aG91c2FuZCAvcXVvdGVkYmxiYXNlIC9xdW90ZWRibGxlZnQgL3F1b3RlZGJscmlnaHQgL3F1b3RlbGVmdCAvcXVvdGVyaWdodCAvcXVvdGVzaW5nbGJhc2UgL3RyYWRlbWFyayAvZmkgL2ZsIC9Mc2xhc2ggL09FIC9TY2Fyb24gL1lkaWVyZXNpcyAvWmNhcm9uIC9kb3RsZXNzaSAvbHNsYXNoIC9vZSAvc2Nhcm9uIC96Y2Fyb24gMTYwIC9FdXJvIDE2NCAvY3VycmVuY3kgMTY2IC9icm9rZW5iYXIgMTY4IC9kaWVyZXNpcyAvY29weXJpZ2h0IC9vcmRmZW1pbmluZSAxNzIgL2xvZ2ljYWxub3QgLy5ub3RkZWYgL3JlZ2lzdGVyZWQgL21hY3JvbiAvZGVncmVlIC9wbHVzbWludXMgL3R3b3N1cGVyaW9yIC90aHJlZXN1cGVyaW9yIC9hY3V0ZSAvbXUgMTgzIC9wZXJpb2RjZW50ZXJlZCAvY2VkaWxsYSAvb25lc3VwZXJpb3IgL29yZG1hc2N1bGluZSAxODggL29uZXF1YXJ0ZXIgL29uZWhhbGYgL3RocmVlcXVhcnRlcnMgMTkyIC9BZ3JhdmUgL0FhY3V0ZSAvQWNpcmN1bWZsZXggL0F0aWxkZSAvQWRpZXJlc2lzIC9BcmluZyAvQUUgL0NjZWRpbGxhIC9FZ3JhdmUgL0VhY3V0ZSAvRWNpcmN1bWZsZXggL0VkaWVyZXNpcyAvSWdyYXZlIC9JYWN1dGUgL0ljaXJjdW1mbGV4IC9JZGllcmVzaXMgL0V0aCAvTnRpbGRlIC9PZ3JhdmUgL09hY3V0ZSAvT2NpcmN1bWZsZXggL090aWxkZSAvT2RpZXJlc2lzIC9tdWx0aXBseSAvT3NsYXNoIC9VZ3JhdmUgL1VhY3V0ZSAvVWNpcmN1bWZsZXggL1VkaWVyZXNpcyAvWWFjdXRlIC9UaG9ybiAvZ2VybWFuZGJscyAvYWdyYXZlIC9hYWN1dGUgL2FjaXJjdW1mbGV4IC9hdGlsZGUgL2FkaWVyZXNpcyAvYXJpbmcgL2FlIC9jY2VkaWxsYSAvZWdyYXZlIC9lYWN1dGUgL2VjaXJjdW1mbGV4IC9lZGllcmVzaXMgL2lncmF2ZSAvaWFjdXRlIC9pY2lyY3VtZmxleCAvaWRpZXJlc2lzIC9ldGggL250aWxkZSAvb2dyYXZlIC9vYWN1dGUgL29jaXJjdW1mbGV4IC9vdGlsZGUgL29kaWVyZXNpcyAvZGl2aWRlIC9vc2xhc2ggL3VncmF2ZSAvdWFjdXRlIC91Y2lyY3VtZmxleCAvdWRpZXJlc2lzIC95YWN1dGUgL3Rob3JuIC95ZGllcmVzaXNdPj4KZW5kb2JqCjYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNyAwIG9iago8PAovQkJveCBbIDAgMCAyMjAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMjJQMATyUrnSuPRDKhScfJ0VuArRpMK58oAiIA3uXIFcrr7OXAAXpQ6NZW5kc3RyZWFtCmVuZG9iago4IDAgb2JqCjw8Ci9BUCA8PAovTiA3IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEwNyAwIFIgL1JlY3QgWyA3OS41NiA2NjkgMjk5LjU2IDY4MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JOYW1lKSAKICAvVFUgKE5hbWUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKOSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMCAwIG9iago8PAovQkJveCBbIDAgMCAyMDYuNDQgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMjDTMzFRMAQKpHKlcemHVCg4+TorcBViyoZz5QEFQdrcuQK5XH2duQBygA/BZW5kc3RyZWFtCmVuZG9iagoxMSAwIG9iago8PAovQVAgPDwKL04gMTAgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTA3IDAgUiAvUmVjdCBbIDMzOC45MTIgNjY5IDU0NS4zNTIgNjgwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvclBob25lKSAKICAvVFUgKFBob25lKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEyIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEzIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIwMCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYyIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTIgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMjBQMATyUrnSuPRDKhScfJ0VuArRpMK58oAiIA3uXIFcrr7OXAAXAw6JZW5kc3RyZWFtCmVuZG9iagoxNCAwIG9iago8PAovQVAgPDwKL04gMTMgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTA3IDAgUiAvUmVjdCBbIDg3LjU2OCA2NTMgMjg3LjU2OCA2NjQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmlnaW5hdG9yQWRkcmVzc0xpbmUxKSAKICAvVFUgKEFkZHJlc3MpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTYgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNjAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDE1IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDNQMARyUrnSuPRDKhScfJ0VuApRZcK58oACIOXuXIFcrr7OXAD8iQ4xZW5kc3RyZWFtCmVuZG9iagoxNyAwIG9iago8PAovQVAgPDwKL04gMTYgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTA3IDAgUiAvUmVjdCBbIDMxMy41NjggNjUzIDM3My41NjggNjY0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvckNpdHkpIAogIC9UVSAoQ2l0eSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxOSAwIG9iago8PAovQkJveCBbIDAgMCAyMiAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMlIwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAPvlDi1lbmRzdHJlYW0KZW5kb2JqCjIwIDAgb2JqCjw8Ci9BUCA8PAovTiAxOSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMDcgMCBSIC9SZWN0IFsgNDA0LjQ3MiA2NTMgNDI2LjQ3MiA2NjQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmlnaW5hdG9yU3RhdGUpIAogIC9UVSAoU3RhdGUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMjEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMjIgMCBvYmoKPDwKL0JCb3ggWyAwIDAgOTMuNTI4IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjkgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAyMSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULA01jM1sjCAAyMFQ6BcKlcal35IhYKTr7MCVyFeheFceUB5kGHuXIFcrr7OXAD0pRP7ZW5kc3RyZWFtCmVuZG9iagoyMyAwIG9iago8PAovQVAgPDwKL04gMjIgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTA3IDAgUiAvUmVjdCBbIDQ0OS44MDggNjUzIDU0My4zMzYgNjY0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvclppcCkgCiAgL1RVIChaaXApIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMjQgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMjUgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjQwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjIgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAyNCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAyMVAwBPJSudK49EMqFJx8nRW4CtGkwrnygCIgDe5cgVyuvs5cABhHDpFlbmRzdHJlYW0KZW5kb2JqCjI2IDAgb2JqCjw8Ci9BUCA8PAovTiAyNSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMDcgMCBSIC9SZWN0IFsgNzguMjI0IDYzNyAzMTguMjI0IDY0OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JFbWFpbCkgCiAgL1RVIChFbWFpbCkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoyNyAwIG9iago8PCAvQmFz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LjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEwNyAwIFIgL1JlY3QgWyAzMzUuNTYgNjAxIDM0My41NiA2MDkgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50SG9sZGVyVHlwZV9pbmRpdmlkdWFsKSAKICAvVFUgKEluZGl2aWR1YWwgXChpbmRpdmlkdWFsXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagozNyAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMyAwIFIgL1llcyAzMiAwIFIKPj4gL04gPDwKL09mZiAzMSAwIFIgL1llcyAzMCAwIFIKPj4gL1IgPDwKL09mZiAzNSAwIFIgL1llcyAzNCAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMDcgMCBSIC9SZWN0IFsgMzkyLjM1MiA2MDEgNDAwLjM1MiA2MDkgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50SG9sZGVyVHlwZV9vcmdhbml6YXRpb24pIAogIC9UVSAoT3JnYW5pemF0aW9uIFwob3JnYW5pemF0aW9uXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagozOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagozOSAwIG9iago8PAovQkJveCBbIDAgMCAyMDAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDM4IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDIwUDAE8lK50rj0QyoUnHydFbgK0aTCufKAIiAN7lyBXK6+zlwAFwMOiWVuZHN0cmVhbQplbmRvYmoKNDAgMCBvYmoKPDwKL0FQIDw8Ci9OIDM5IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEwNyAwIFIgL1JlY3QgWyA4Ny41NjggNTg1IDI4Ny41NjggNTk2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudEhvbGRlckFkZHJlc3NMaW5lMSkgCiAgL1RVIChBZGRyZXNzKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjQxIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjQyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDYwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA0MSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAzUDAEclK50rj0QyoUnHydFbgKUWXCufKAAiDl7lyBXK6+zlwA/IkOMWVuZHN0cmVhbQplbmRvYmoKNDMgMCBvYmoKPDwKL0FQIDw8Ci9OIDQyIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEwNyAwIFIgL1JlY3QgWyAzMTMuNTY4IDU4NSAzNzMuNTY4IDU5NiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnRIb2xkZXJDaXR5KSAKICAvVFUgKENpdHkpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNDQgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDUgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjIgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQ0IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDJSMARyUrnSuPRDKhScfJ0VuApRZcK58oACIOXuXIFcrr7OXAD75Q4tZW5kc3RyZWFtCmVuZG9iago0NiAwIG9iago8PAovQVAgPDwKL04gNDUgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTA3IDAgUiAvUmVjdCBbIDQwNC40NzIgNTg1IDQyNi40NzIgNTk2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudEhvbGRlclN0YXRlKSAKICAvVFUgKFN0YXRlKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjQ3IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjQ4IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDkzLjUyOCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDY5IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNDcgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFCwNNYzNbIwgAMjBUOgXCpXGpd+SIWCk6+zAlchXoXhXHlAeZBh7lyBXK6+zlwA9KUT+2VuZHN0cmVhbQplbmRvYmoKNDkgMCBvYmoKPDwKL0FQIDw8Ci9OIDQ4IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEwNyAwIFIgL1JlY3QgWyA0NDkuODA4IDU4NSA1NDMuMzM2IDU5NiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnRIb2xkZXJaaXApIAogIC9UVSAoWmlwKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjUwIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjUxIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEwMCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNTAgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNABiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABawDodlbmRzdHJlYW0KZW5kb2JqCjUyIDAgb2JqCjw8Ci9BUCA8PAovTiA1MSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMDcgMCBSIC9SZWN0IFsgODEuMzUyIDU2OSAxODEuMzUyIDU4MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnRIb2xkZXJQaG9uZSkgCiAgL1RVIChQaG9uZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago1MyAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago1NCAwIG9iago8PAovQkJveCBbIDAgMCAzMjQuNjQ4IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1MyAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA2MtEzM7FQMASKpHKlcemHVCg4+TorcBVikQ7nygOKgjS6cwVyufo6cwEAlPgQN2VuZHN0cmVhbQplbmRvYmoKNTUgMCBvYmoKPDwKL0FQIDw8Ci9OIDU0IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEwNyAwIFIgL1JlY3QgWyAyMTcuNTc2IDU2OSA1NDIuMjI0IDU4MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnRIb2xkZXJFbWFpbCkgCiAgL1RVIChFbWFpbCkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago1NiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago1NyAwIG9iago8PAovQkJveCBbIDAgMCAxMzAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDU2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQGYiAvlSuNSz+kQsHJ11mBqxBNKpwrDygC0uDOFcjl6uvMBQAXow6NZW5kc3RyZWFtCmVuZG9iago1OCAwIG9iago8PAovQVAgPDwKL04gNTcgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTA3IDAgUiAvUmVjdCBbIDE2OC45MjggNTMzIDI5OC45MjggNTQ0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoY3VzdG9tZXJPckVtcGxveWVlSWQpIAogIC9UVSAoQ3VzdG9tZXIvRW1wbG95ZWUvVmVuZG9yIElEKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjU5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjYwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDE0Ny4wNzIgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDU5IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQx1zMwN1IwBIqkcqVx6YdUKDj5OitwFWKRDufKA4qCNLpzBXK5+jpzAQCTCBArZW5kc3RyZWFtCmVuZG9iago2MSAwIG9iago8PAovQVAgPDwKL04gNjAgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTA3IDAgUiAvUmVjdCBbIDM4Ni4yODggNTMzIDUzMy4zNiA1NDQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmlnaW5hdG9yUmVmZXJlbmNlKSAKICAvVFUgKE9yaWdpbmF0b3IgcmVmZXJlbmNlKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjYyIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjYzIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDYwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA2MiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAzUDAEclK50rj0QyoUnHydFbgKUWXCufKAAiDl7lyBXK6+zlwA/IkOMWVuZHN0cmVhbQplbmRvYmoKNjQgMCBvYmoKPDwKL0FQIDw8Ci9OIDYzIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEwNyAwIFIgL1JlY3QgWyAxNDQuNDk2IDUxNyAyMDQuNDk2IDUyOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9sZEFjY291bnRMYXN0NCkgCiAgL1RVIChMYXN0IDQgb2YgT0xEIGFjY291bnQgIykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago2NSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago2NiAwIG9iago8PAovQkJveCBbIDAgMCAyNTcuNTA0IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA2NSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAyNdczNTBRMASKpHKlcemHVCg4+TorcBVikQ7nygOKgjS6cwVyufo6cwEAk8oQL2VuZHN0cmVhbQplbmRvYmoKNjcgMCBvYmoKPDwKL0FQIDw8Ci9OIDY2IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEwNyAwIFIgL1JlY3QgWyAyNzguOTY4IDUxNyA1MzYuNDcyIDUyOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9sZEJhbmtOYW1lKSAKICAvVFUgKE9sZCBiYW5rIG5hbWUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNjggMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzMgMCBSIC9ZZXMgMzIgMCBSCj4+IC9OIDw8Ci9PZmYgMzEgMCBSIC9ZZXMgMzAgMCBSCj4+IC9SIDw8Ci9PZmYgMzUgMCBSIC9ZZXMgMzQgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTA3IDAgUiAvUmVjdCBbIDU0IDQ4MSA2MiA0ODkgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChjaGFuZ2VUeXBlX3VwZGF0ZWFjY291bnRpbmZvKSAKICAvVFUgKFVwZGF0ZSBhY2NvdW50IGluZm8gXCh1cGRhdGVfYWNjb3VudF9pbmZvXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago2OSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMyAwIFIgL1llcyAzMiAwIFIKPj4gL04gPDwKL09mZiAzMSAwIFIgL1llcyAzMCAwIFIKPj4gL1IgPDwKL09mZiAzNSAwIFIgL1llcyAzNCAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMDcgMCBSIC9SZWN0IFsgMTUwLjE1MiA0ODEgMTU4LjE1MiA0ODkgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChjaGFuZ2VUeXBlX2NoYW5nZWFtb3VudCkgCiAgL1RVIChDaGFuZ2UgYW1vdW50IFwoY2hhbmdlX2Ftb3VudFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNzAgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzMgMCBSIC9ZZXMgMzIgMCBSCj4+IC9OIDw8Ci9PZmYgMzEgMCBSIC9ZZXMgMzAgMCBSCj4+IC9SIDw8Ci9PZmYgMzUgMCBSIC9ZZXMgMzQgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTA3IDAgUiAvUmVjdCBbIDIzMi4wNzIgNDgxIDI0MC4wNzIgNDg5IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoY2hhbmdlVHlwZV9jaGFuZ2VmcmVxdWVuY3kpIAogIC9UVSAoQ2hhbmdlIGZyZXF1ZW5jeSBcKGNoYW5nZV9mcmVxdWVuY3lcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjcxIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMzIDAgUiAvWWVzIDMyIDAgUgo+PiAvTiA8PAovT2ZmIDMxIDAgUiAvWWVzIDMwIDAgUgo+PiAvUiA8PAovT2ZmIDM1IDAgUiAvWWVzIDM0IDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEwNyAwIFIgL1JlY3QgWyA1NCA0NjcgNjIgNDc1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoY2hhbmdlVHlwZV9hZGRzZWNvbmRhcnlhY2NvdW50KSAKICAvVFUgKEFkZCBzZWNvbmRhcnkgYWNjb3VudCBcKGFkZF9zZWNvbmRhcnlfYWNjb3VudFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNzIgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzMgMCBSIC9ZZXMgMzIgMCBSCj4+IC9OIDw8Ci9PZmYgMzEgMCBSIC9ZZXMgMzAgMCBSCj4+IC9SIDw8Ci9PZmYgMzUgMCBSIC9ZZXMgMzQgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTA3IDAgUiAvUmVjdCBbIDE2Mi42IDQ2NyAxNzAuNiA0NzUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChjaGFuZ2VUeXBlX290aGVyKSAKICAvVFUgKE90aGVyIFwoZGVzY3JpYmUgYmVsb3dcKSBcKG90aGVyXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago3MyAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago3NCAwIG9iago8PAovQkJveCBbIDAgMCA0NTQgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NCAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDczIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDE10TNQMATyU7nSuPRDKhScfJ0VuAoxJMO58oBiIE3uXIFcrr7OXABTrA9bZW5kc3RyZWFtCmVuZG9iago3NSAwIG9iago8PAovQVAgPDwKL04gNzQgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTA3IDAgUiAvUmVjdCBbIDgzLjEyOCA0NTEgNTM3LjEyOCA0NjIgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChjaGFuZ2VPdGhlckRlc2NyaXB0aW9uKSAKICAvVFUgKElmIG90aGVyKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjc2IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjc3IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDE1MCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNzYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNAViIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABhFDpFlbmRzdHJlYW0KZW5kb2JqCjc4IDAgb2JqCjw8Ci9BUCA8PAovTiA3NyAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMDcgMCBSIC9SZWN0IFsgNzYuNDU2IDQxNSAyMjYuNDU2IDQyNiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG5ld0JhbmtOYW1lKSAKICAvVFUgKEJhbmspIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNzkgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKODAgMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDc5IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDBQMARyUrnSuPRDKhScfJ0VuApRZcK58oACIOXuXIFcrr7OXAD9KQ41ZW5kc3RyZWFtCmVuZG9iago4MSAwIG9iago8PAovQVAgPDwKL04gODAgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTA3IDAgUiAvUmVjdCBbIDI3Mi45MiA0MTUgMzUyLjkyIDQyNiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG5ld1JvdXRpbmdOdW1iZXIpIAogIC9UVSAoUm91dGluZyAjKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjgyIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjgzIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEzNy4wOCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDY5IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgODIgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNDbXMzC3RAALBUOgZCpXGpd+SIWCk6+zAlchfpXhXHlABSDj3LkCuVx9nbkAQrgVG2VuZHN0cmVhbQplbmRvYmoKODQgMCBvYmoKPDwKL0FQIDw8Ci9OIDgzIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEwNyAwIFIgL1JlY3QgWyA0MDAuNzIgNDE1IDUzNy44IDQyNiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG5ld0FjY291bnROdW1iZXIpIAogIC9UVSAoQWNjb3VudCAjKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjg1IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMzIDAgUiAvWWVzIDMyIDAgUgo+PiAvTiA8PAovT2ZmIDMxIDAgUiAvWWVzIDMwIDAgUgo+PiAvUiA8PAovT2ZmIDM1IDAgUiAvWWVzIDM0IDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEwNyAwIFIgL1JlY3QgWyA1NCAzOTkgNjIgNDA3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAobmV3QWNjb3VudFR5cGVfY2hlY2tpbmcpIAogIC9UVSAoQ2hlY2tpbmcgXChjaGVja2luZ1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKODYgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzMgMCBSIC9ZZXMgMzIgMCBSCj4+IC9OIDw8Ci9PZmYgMzEgMCBSIC9ZZXMgMzAgMCBSCj4+IC9SIDw8Ci9PZmYgMzUgMCBSIC9ZZXMgMzQgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTA3IDAgUiAvUmVjdCBbIDExMC4zNDQgMzk5IDExOC4zNDQgNDA3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAobmV3QWNjb3VudFR5cGVfc2F2aW5ncykgCiAgL1RVIChTYXZpbmdzIFwoc2F2aW5nc1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKODcgMCBvYmoKPDwKL0JCb3ggWyAwIDAgOSA5IF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGgg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UyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAoNCkKPj4gL1AgMTA3IDAgUiAvUmVjdCBbIDE3My44IDM5OCAxODIuOCA0MDcgXSAvU3VidHlwZSAvV2lkZ2V0IC9UICh2b2lkZWRDaGVja0F0dGFjaGVkKSAKICAvVFUgKFZvaWRlZCBjaGVjayBvciBiYW5rIHZlcmlmaWNhdGlvbiBsZXR0ZXIgYXR0YWNoZWQpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago5NCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago5NSAwIG9iago8PAovQkJveCBbIDAgMCA5MCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgOTQgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFCwNFAwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAP15DjdlbmRzdHJlYW0KZW5kb2JqCjk2IDAgb2JqCjw8Ci9BUCA8PAovTiA5NSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMDcgMCBSIC9SZWN0IFsgMTI3LjU2OCAzNjMgMjE3LjU2OCAzNzQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChuZXdBbW91bnQpIAogIC9UVSAoTmV3IGFtb3VudCBcKFVTRFwpKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjk3IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMzIDAgUiAvWWVzIDMyIDAgUgo+PiAvTiA8PAovT2ZmIDMxIDAgUiAvWWVzIDMwIDAgUgo+PiAvUiA8PAovT2ZmIDM1IDAgUiAvWWVzIDM0IDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEwNyAwIFIgL1JlY3QgWyAyMzMuNTY4IDM2MyAyNDEuNTY4IDM3MSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG5ld0ZyZXF1ZW5jeV93ZWVrbHkpIAogIC9UVSAoV2Vla2x5IFwod2Vla2x5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago5OCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMyAwIFIgL1llcyAzMiAwIFIKPj4gL04gPDwKL09mZiAzMSAwIFIgL1llcyAzMCAwIFIKPj4gL1IgPDwKL09mZiAzNSAwIFIgL1llcyAzNCAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMDcgMCBSIC9SZWN0IFsgMjgwLjc5MiAzNjMgMjg4Ljc5MiAzNzEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChuZXdGcmVxdWVuY3lfYml3ZWVrbHkpIAogIC9UVSAoQmktd2Vla2x5IFwoYml3ZWVrbHlcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjk5IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMzIDAgUiAvWWVzIDMyIDAgUgo+PiAvTiA8PAovT2ZmIDMxIDAgUiAvWWVzIDMwIDAgUgo+PiAvUiA8PAovT2ZmIDM1IDAgUiAvWWVzIDM0IDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEwNyAwIFIgL1JlY3QgWyAzMzYuMDE2IDM2MyAzNDQuMDE2IDM3MSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG5ld0ZyZXF1ZW5jeV9zZW1pbW9udGhseSkgCiAgL1RVIChTZW1pLW1vLiBcKHNlbWltb250aGx5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDAgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzMgMCBSIC9ZZXMgMzIgMCBSCj4+IC9OIDw8Ci9PZmYgMzEgMCBSIC9ZZXMgMzAgMCBSCj4+IC9SIDw8Ci9PZmYgMzUgMCBSIC9ZZXMgMzQgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTA3IDAgUiAvUmVjdCBbIDM5MS4yNCAzNjMgMzk5LjI0IDM3MSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG5ld0ZyZXF1ZW5jeV9tb250aGx5KSAKICAvVFUgKE1vbnRobHkgXChtb250aGx5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDEgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzMgMCBSIC9ZZXMgMzIgMCBSCj4+IC9OIDw8Ci9PZmYgMzEgMCBSIC9ZZXMgMzAgMCBSCj4+IC9SIDw8Ci9PZmYgMzUgMCBSIC9ZZXMgMzQgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTA3IDAgUiAvUmVjdCBbIDE2NCAzNDkgMTcyIDM1NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG5ld0ZyZXF1ZW5jeV9xdWFydGVybHkpIAogIC9UVSAoUXVhcnRlcmx5IFwocXVhcnRlcmx5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDIgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzMgMCBSIC9ZZXMgMzIgMCBSCj4+IC9OIDw8Ci9PZmYgMzEgMCBSIC9ZZXMgMzAgMCBSCj4+IC9SIDw8Ci9PZmYgMzUgMCBSIC9ZZXMgMzQgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTA3IDAgUiAvUmVjdCBbIDIxNy44OTYgMzQ5IDIyNS44OTYgMzU3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAobmV3RnJlcXVlbmN5X2FubnVhbCkgCiAgL1RVIChBbm51YWwgXChhbm51YWxcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwMyAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMyAwIFIgL1llcyAzMiAwIFIKPj4gL04gPDwKL09mZiAzMSAwIFIgL1llcyAzMCAwIFIKPj4gL1IgPDwKL09mZiAzNSAwIFIgL1llcyAzNCAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMDcgMCBSIC9SZWN0IFsgMjYzLjggMzQ5IDI3MS44IDM1NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG5ld0ZyZXF1ZW5jeV9vdGhlcikgCiAgL1RVIChPdGhlciBcKG90aGVyXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDQgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTA1IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEwMCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTA0IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQAYiAvlSuNSz+kQsHJ11mBqxBNKpwrDygC0uDOFcjl6uvMBQAWsA6HZW5kc3RyZWFtCmVuZG9iagoxMDYgMCBvYmoKPDwKL0FQIDw8Ci9OIDEwNSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMDcgMCBSIC9SZWN0IFsgMjA0Ljk0NCAzMzEgMzA0Ljk0NCAzNDIgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlZmZlY3RpdmVEYXRlKSAKICAvVFUgKFJlcXVlc3RlZCBlZmZlY3RpdmUgZGF0ZSBcKE1NL0REL1lZWVlcKSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMDcgMCBvYmoKPDwKL0Fubm90cyBbIDggMCBSIDExIDAgUiAxNCAwIFIgMTcgMCBSIDIwIDAgUiAyMyAwIFIgMjYgMCBSIDI5IDAgUiAzNiAwIFIgMzcgMCBSIAogIDQwIDAgUiA0MyAwIFIgNDYgMCBSIDQ5IDAgUiA1MiAwIFIgNTUgMCBSIDU4IDAgUiA2MSAwIFIgNjQgMCBSIDY3IDAgUiAKICA2OCAwIFIgNjkgMCBSIDcwIDAgUiA3MSAwIFIgNzIgMCBSIDc1IDAgUiA3OCAwIFIgODEgMCBSIDg0IDAgUiA4NSAwIFIgCiAgODYgMCBSIDkzIDAgUiA5NiAwIFIgOTcgMCBSIDk4IDAgUiA5OSAwIFIgMTAwIDAgUiAxMDEgMCBSIDEwMiAwIFIgMTAzIDAgUiAKICAxMDYgMCBSIF0gL0NvbnRlbnRzIDExMSAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDExMCAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgCiAgL1RyYW5zIDw8Cgo+PiAvVHlwZSAvUGFnZQo+PgplbmRvYmoKMTA4IDAgb2JqCjw8Ci9BY3JvRm9ybSAxMTIgMCBSIC9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgMTEwIDAgUiAvVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKMTA5IDAgb2JqCjw8Ci9BdXRob3IgKGFub255bW91cykgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDUwMjEzMzYzMS0wNCcwMCcpIC9DcmVhdG9yIChhbm9ueW1vdXMpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDUwMjEzMzYzMS0wNCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0ICh1bnNwZWNpZmllZCkgL1RpdGxlICh1bnRpdGxlZCkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iagoxMTAgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAxMDcgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iagoxMTEgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMjE4Mgo+PgpzdHJlYW0KR2F1YFQ5NjhUUCZBSWBkVkNJQGdQYFtnVjRpLkxaPDJdamxuM1NWKF11XFgnPTBZZls4QClXbT9fP2IzQlhMPTxWLElCKzFkXVl1SixQdDQsX1dxXnI2QDZTXU8kXStHRWJvbigrVl4/K05XT0VIK1M8NWhEN0wvR3FYZzZuPURaUTlJJ1hLPDBFV0ZBP2Q6KllNVDFIaFE0J1s+KjQjJ102Ui1lSiE3aSldZWlMRDViYmMxTGJcVlMsPWsrMGNxLC8/TWZtXjhna3AlI1tgV1hAJlxWNFVnUWtRLFo5MyZLWzNmTjNnVU4jPVg4XmVPM2tsbk5dYE5tQz5yRlFrSiUvLiIwMDxJamYqJk0sRydfdU9qaExNSS8jRHU0ZyFAPWBGXTAiXjshSipoKyZhLFkpYlIiXExxPjsqOVM3KSZbU1szIVhkWFonKCpNLSo/WmNtZyFRamBDbSNeKk8vKmRdOy1FQ0VQJl5XXkMjJGU5Mi5iRExiZ0cxVC0zJT4/IjspOls1Q3BeZTtbMk1SOU5WQ2I2cWpBXUssJVk1VC5XWUAvYENGQiIxX3A4KS5oN1IuOlZjU1JUajIkZWBiP1A/JmsrNypBbmYjSSxiN2tLXjM5alRmMWVDNF8wSFpoJkFvOE8kNW1nKVZQPjc9cGI9TC4nV3BaMyZXP2tQMV1rUWNOXVtOSDhKIUc8RE0sb1I7c0x0TCwqV1U3R2csP0VuOlZqVj5qPiJEZmg3IVtrcVI2NUpqb1dRJnJiYXRdN3AnXWdsP3JBMWU5c1o3MSgpVCpfY2wqVnNxWEdJZ2FxK05DPVR1K1QqY1tBJ3IybyNDJiFXVyUyLitjJHFOYDUrV11NcDozS0xrbkhIQitaRGAmI2tYJGhjNSlRQGhCS1Y5TXQ0Oy1HJC90JjMnP0tLT1A9I1s7RC1caFhFRmJdTlo9XUFQQSIsLDhRMDNRP285SGc0TytUaEE1Ul5dOWgrWSVqQURMQCtVZD0vQkpQTkIrVjQwaCQ8W3E0NkJhXl4uOE5vPEAjT0g+VkpzdSJDKF5NQEQ9aSg7TEQja0xuOSNeMihiKGlvZTBDP1kxMCRxXSthaTFtZyhuPVBOTjJZYl4uT08hSSlXIypwPlc1PW1sSzlAPC4iPV5aYFRaWFY5WmZTXHEiRGxyZDlBQE5NLTsqNWlTWSRVa2RMPS9mMikuaWEudCs4UlNBdVFzaUlyPzRtRG1uWWtxPV51MVJlTUlgXWdZOTEmRicxJiclXGJMLiNPJCNYZCZKWWtjLkEzJjthTVBpMD1waFVfRDZVZWwoIUsqTEk6R2FCWissPmxUNDBTMGc8M2NiZDI8WypVcGUuUF8sVDwvZVMpSUtlPGJCLFJgJFA5Nm1UM1dJYmJjOS1ANC8iXUspbTlkWUopQW8jUWAxYjFdRjFOWlxOUCwpaCFfZTUqciZBMEpXN25LamBKLlc9U3JDW1hDLz1Ua0UsOCVsRD8qLUI8blVla0BSUTwyNVNgbG1PJClpZyNfbzwlQkM0QkM8YDVVIUNjVWFDUU1JUGo5OytKMj0wPThPNjpxVyNOYlVnMCQmXSYrMkpwQjtVL00/O10tQWlsX0dMY1xAW2ghcDVcKypVVDoySThjQU4vXFI2LW5sUEZDKVNaY1hKVFBYcCpSLF5KcF85VUw+NWxzP25tO15qY0gsTXByMFZPKFBWU1trXCg1QF9cJDtvYCNdLihSN3JDUDVScC9KJWs+PHAwIWYjUjYhImJwUVo4R0xKcVMkLUxkW3VTOjtGPzkvRHJkXFVGbUI0Vj81VlNbVG8qLiVCPCQ3Tk1mTFExXGR1O0hlTylpYFoiS2lQSFsyOE8lKD1TSURhIiRXS0c3SEVRQVpLW2xqSjRIK25ZaWVpb0lscTA2SEgsWCY2KyJYXD01XT43dFVVIXVkb1gvPC5kInUxZSRRZ2hTNlooRVYkTWA6dGNCImE6IVs0LEkhUk5FJSRPM2NXOSIhK0s7WilSREJTZWEvS09EbStQSWMiXWciTydQRFlUdWM0KTEqTzFsP19VT0pdLls3ZC1pbm5JOmBmS2dtN0ZfKG5bQCJyZHBvWDxRJyIvamlQUShCQlNHakomN2kqT01Wa1wnZSUxb1RhJVBgODRFNjAuPU5bUFc1I2BDVCRTY2tyJUQsRz5PWigjXHNJImBvbnF0TFJqXT50Tm1pV0k4NzVbLEN1PXQoYiE2Szc6WWgrIT8nVWpwcVE+bko9cDxIVjZXblYkWzRSbiJSTjM2SDw8W2NdRDJdUj8nXTpGaCNaay1Pb1lAPzhCbDlGUlZrZTNoOV9DUE1XXTkjOys/K0EiQUBQYkkrOzk0TUR1MS5xbGcuKSRUTypVJksnVExqVClvakA+dVBCOydxZktTOXJpSXFTMVtbQiUoOmNIOUR0IlI7SF1dSHFLKlBgTE48YTNEU1JyS0xcXzlsZyYuXmJwNkAraG9mQ1A9IWZ0XiZOZzltMyo/XiFYNClZVGNsRTJgWkxIX1NxaW8/NydUMXI2TC1VQVIoPWZaJHRTcnNQUUJMcSFxRVRSYWlVWSJSQkUjRmBlZ1xYVzxuZDFQLTc0dSRLW0RVNFQ/KTdyR0J0LURUXnB0TSMpQ0BeZW9COUkuS0FmSWBnb2QvVjptZydlZ19Cb2FVRisjI0lkUz5JZWxmRGRIQGxpN0Y9OnJDZ3NAWkwzbVxLWC5sYllUY2BZJiRaWUQ4XCo0Wyt0P0EkNEBtRlwqWEFWI0I7YnA5X2pjNDZuc1tsLmlONlRRPSg/SmxFa0RyT1dJNEtQRDxCJyhfbDUuPipfWjFHYUNNaFgzWzBSSk1uclVWaXExLFlcLlM0MEQtWE9rX1QjLHJPbmZtKjgtY2lhUFBNU2ZkMGFnOyFJTGF0OUt+PmVuZHN0cmVhbQplbmRvYmoKMTEyIDAgb2JqCjw8Ci9EQSAoL0hlbHYgMCBUZiAwIGcpIC9EUiA8PCAvRW5jb2RpbmcKPDwKL1JMQUZlbmNvZGluZwo1IDAgUgo+PgovRm9udCA8PCAvSGVsdiA2IDAgUiA+Pgo+PiAvRmllbGRzIFsgOCAwIFIgMTEgMCBSIDE0IDAgUiAxNyAwIFIgMjAgMCBSIDIzIDAgUiAyNiAwIFIgMjkgMCBSIDM2IDAgUiAzNyAwIFIgCiAgNDAgMCBSIDQzIDAgUiA0NiAwIFIgNDkgMCBSIDUyIDAgUiA1NSAwIFIgNTggMCBSIDYxIDAgUiA2NCAwIFIgNjcgMCBSIAogIDY4IDAgUiA2OSAwIFIgNzAgMCBSIDcxIDAgUiA3MiAwIFIgNzUgMCBSIDc4IDAgUiA4MSAwIFIgODQgMCBSIDg1IDAgUiAKICA4NiAwIFIgOTMgMCBSIDk2IDAgUiA5NyAwIFIgOTggMCBSIDk5IDAgUiAxMDAgMCBSIDEwMSAwIFIgMTAyIDAgUiAxMDMgMCBSIAogIDEwNiAwIFIgXQo+PgplbmRvYmoKeHJlZgowIDExMwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQ0NiAwMDAwMCBuIAowMDAwMDAxNzY4IDAwMDAwIG4gCjAwMDAwMDE4NjYgMDAwMDAgbiAKMDAwMDAwMjE1MyAwMDAwMCBuIAowMDAwMDAyNDAzIDAwMDAwIG4gCjAwMDAwMDI1MDEgMDAwMDAgbiAKMDAwMDAwMjc5NSAwMDAwMCBuIAowMDAwMDAzMDUyIDAwMDAwIG4gCjAwMDAwMDMxNTEgMDAwMDAgbiAKMDAwMDAwMzQ0MCAwMDAwMCBuIAowMDAwMDAzNzA1IDAwMDAwIG4gCjAwMDAwMDM4MDQgMDAwMDAgbiAKMDAwMDAwNDA5MSAwMDAwMCBuIAowMDAwMDA0MzQ2IDAwMDAwIG4gCjAwMDAwMDQ0NDUgMDAwMDAgbiAKMDAwMDAwNDczMiAwMDAwMCBuIAowMDAwMDA0OTg5IDAwMDAwIG4gCjAwMDAwMDUwODggMDAwMDAgbiAKMDAwMDAwNTM4NyAwMDAwMCBuIAowMDAwMDA1NjQwIDAwMDAwIG4gCjAwMDAwMDU3MzkgMDAwMDAgbiAKMDAwMDAwNjAyOCAwMDAwMCBuIAowMDAwMDA2Mjg0IDAwMDAwIG4gCjAwMDAwMDYzODMgMDAwMDAgbiAKMDAwMDAwNjY3MiAwMDAwMCBuIAowMDAwMDA2OTI3IDAwMDAwIG4gCjAwMDAwMDcyODggMDAwMDAgbiAKMDAwMDAwNzU0NyAwMDAwMCBuIAowMDAwMDA3OTExIDAwMDAwIG4gCjAwMDAwMDgxNzUgMDAwMDAgbiAKMDAwMDAwODUzOCAwMDAwMCBuIAowMDAwMDA4ODAwIDAwMDAwIG4gCjAwMDAwMDkxOTQgMDAwMDAgbiAKMDAwMDAwOTU5NiAwMDAwMCBuIAowMDAwMDA5Njk1IDAwMDAwIG4gCjAwMDAwMDk5ODQgMDAwMDAgbiAKMDAwMDAxMDI1MiAwMDAwMCBuIAowMDAwMDEwMzUxIDAwMDAwIG4gCjAwMDAwMTA2MzggMDAwMDAgbiAKMDAwMDAxMDg5NiAwMDAwMCBuIAowMDAwMDEwOTk1IDAwMDAwIG4gCjAwMDAwMTEyODIgMDAwMDAgbiAKMDAwMDAxMTU0MiAwMDAwMCBuIAowMDAwMDExNjQxIDAwMDAwIG4gCjAwMDAwMTE5NDAgMDAwMDAgbiAKMDAwMDAxMjE5NiAwMDAwMCBuIAowMDAwMDEyMjk1IDAwMDAwIG4gCjAwMDAwMTI1ODMgMDAwMDAgbiAKMDAwMDAxMjg0MiAwMDAwMCBuIAowMDAwMDEyOTQxIDAwMDAwIG4gCjAwMDAwMTMyMzkgMDAwMDAgbiAKMDAwMDAxMzQ5OSAwMDAwMCBuIAowMDAwMDEzNTk4IDAwMDAwIG4gCjAwMDAwMTM4ODYgMDAwMDAgbiAKMDAwMDAxNDE3MCAwMDAwMCBuIAowMDAwMDE0MjY5IDAwMDAwIG4gCjAwMDAwMTQ1NjcgMDAwMDAgbiAKMDAwMDAxNDg0MiAwMDAwMCBuIAowMDAwMDE0OTQxIDAwMDAwIG4gCjAwMDAwMTUyMjggMDAwMDAgbiAKMDAwMDAxNTUwMyAwMDAwMCBuIAowMDAwMDE1NjAyIDAwMDAwIG4gCjAwMDAwMTU5MDAgMDAwMDAgbiAKMDAwMDAxNjE2MSAwMDAwMCBuIAowMDAwMDE2NTY1IDAwMDAwIG4gCjAwMDAwMTY5NjIgMDAwMDAgbiAKMDAwMDAxNzM2OCAwMDAwMCBuIAowMDAwMDE3Nzc4IDAwMDAwIG4gCjAwMDAwMTgxNjcgMDAwMDAgbiAKMDAwMDAxODI2NiAwMDAwMCBuIAowMDAwMDE4NTU3IDAwMDAwIG4gCjAwMDAwMTg4MjMgMDAwMDAgbiAKMDAwMDAxODkyMiAwMDAwMCBuIAowMDAwMDE5MjEwIDAwMDAwIG4gCjAwMDAwMTk0NjEgMDAwMDAgbiAKMDAwMDAxOTU2MCAwMDAwMCBuIAowMDAwMDE5ODQ3IDAwMDAwIG4gCjAwMDAwMjAxMDcgMDAwMDAgbiAKMDAwMDAyMDIwNiAwMDAwMCBuIAowMDAwMDIwNTA1IDAwMDAwIG4gCjAwMDAwMjA3NjQgMDAwMDAgbiAKMDAwMDAyMTE0MSAwMDAwMCBuIAowMDAwMDIxNTI1IDAwMDAwIG4gCjAwMDAwMjIxMzkgMDAwMDAgbiAKMDAwMDAyMjM5OCAwMDAwMCBuIAowMDAwMDIzMDE2IDAwMDAwIG4gCjAwMDAwMjMyODAgMDAwMDAgbiAKMDAwMDAyMzg5NyAwMDAwMCBuIAowMDAwMDI0MTU5IDAwMDAwIG4gCjAwMDAwMjQ1NjYgMDAwMDAgbiAKMDAwMDAyNDY2NSAwMDAwMCBuIAowMDAwMDI0OTUyIDAwMDAwIG4gCjAwMDAwMjUyMTYgMDAwMDAgbiAKMDAwMDAyNTU5NSAwMDAwMCBuIAowMDAwMDI1OTgxIDAwMDAwIG4gCjAwMDAwMjYzNzIgMDAwMDAgbiAKMDAwMDAyNjc1MyAwMDAwMCBuIAowMDAwMDI3MTM0IDAwMDAwIG4gCjAwMDAwMjc1MTQgMDAwMDAgbiAKMDAwMDAyNzg4NyAwMDAwMCBuIAowMDAwMDI3OTg3IDAwMDAwIG4gCjAwMDAwMjgyNzcgMDAwMDAgbiAKMDAwMDAyODU2OCAwMDAwMCBuIAowMDAwMDI5MDgyIDAwMDAwIG4gCjAwMDAwMjkxNzIgMDAwMDAgbiAKMDAwMDAyOTQzNSAwMDAwMCBuIAowMDAwMDI5NDk4IDAwMDAwIG4gCjAwMDAwMzE3NzMgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8YTIxZDI0ZDc2ZGM5OGI2ZWE5ZTFiZTA2YTFkNGM1OGI+PGEyMWQyNGQ3NmRjOThiNmVhOWUxYmUwNmExZDRjNThiPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyAxMDkgMCBSCi9Sb290IDEwOCAwIFIKL1NpemUgMTEzCj4+CnN0YXJ0eHJlZgozMjIwMgolJUVPRgo=";
const __c_ach_change_form_pdf: Uint8Array = (() => {
  const bin = atob(__c_ach_change_form_pdf_b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
})();
const __c_ach_change_form_md: string = `# ACH Change Form

*This change replaces the prior account / amount / frequency information on the existing ACH authorization between the Account Holder and the Originator named below. The original authorization otherwise remains in full force and effect.*

## Originator

- **Name:** {{parties.originator.legalName}}
- **Address:** {{originatorAddress.line1}}, {{originatorAddress.locality}}, {{originatorAddress.region}} {{originatorAddress.postalCode}}
- **Phone:** {{originatorPhone}}
- **Email:** {{originatorEmail}}

## Account Holder

- **Name:** {{parties.accountHolder.name}}
- **Type:**
  - [{{#if (eq accountHolderType "individual")}}x{{else}} {{/if}}] Individual
  - [{{#if (eq accountHolderType "organization")}}x{{else}} {{/if}}] Organization
- **Address:** {{accountHolderAddress.line1}}, {{accountHolderAddress.locality}}, {{accountHolderAddress.region}} {{accountHolderAddress.postalCode}}
- **Phone:** {{accountHolderPhone}}
- **Email:** {{accountHolderEmail}}

## Existing arrangement

- **Customer / employee / vendor ID:** {{customerOrEmployeeId}}
- **Originator reference (contract / agreement / loan number):** {{originatorReference}}
- **Last 4 digits of OLD account #:** {{oldAccountLast4}}
- **Old bank name:** {{oldBankName}}

## Change type

- [{{#if (eq changeType "update_account_info")}}x{{else}} {{/if}}] Update account info
- [{{#if (eq changeType "change_amount")}}x{{else}} {{/if}}] Change amount
- [{{#if (eq changeType "change_frequency")}}x{{else}} {{/if}}] Change frequency
- [{{#if (eq changeType "add_secondary_account")}}x{{else}} {{/if}}] Add secondary account
- [{{#if (eq changeType "other")}}x{{else}} {{/if}}] Other

{{#if (eq changeType "other")}}
**Description of change:** {{changeOtherDescription}}
{{/if}}

## New account information

*Required when updating account information or adding a secondary account.*

- **Bank:** {{newBankName}}
- **Routing/ABA #:** {{newRoutingNumber}}
- **Account #:** {{newAccountNumber}}
- **Type:**
  - [{{#if (eq newAccountType "checking")}}x{{else}} {{/if}}] Checking
  - [{{#if (eq newAccountType "savings")}}x{{else}} {{/if}}] Savings
- [{{#if voidedCheckAttached}}x{{else}} {{/if}}] Voided check or bank verification letter attached

## Amount / frequency change

- **New deposit amount (USD):** {{newAmount.amount}} {{newAmount.currency}}
- **New frequency:**
  - [{{#if (eq newFrequency "weekly")}}x{{else}} {{/if}}] Weekly
  - [{{#if (eq newFrequency "biweekly")}}x{{else}} {{/if}}] Bi-weekly
  - [{{#if (eq newFrequency "semimonthly")}}x{{else}} {{/if}}] Semi-monthly
  - [{{#if (eq newFrequency "monthly")}}x{{else}} {{/if}}] Monthly
  - [{{#if (eq newFrequency "quarterly")}}x{{else}} {{/if}}] Quarterly
  - [{{#if (eq newFrequency "annual")}}x{{else}} {{/if}}] Annual
  - [{{#if (eq newFrequency "other")}}x{{else}} {{/if}}] Other

## Effective date

- **Requested effective date:** {{effectiveDate}}

## Terms

1. This change replaces the prior account / amount / frequency information on the existing ACH authorization between the parties; the original authorization otherwise remains in full force and effect.
2. I authorize the Originator to debit my account to reverse any erroneous credit posted before or after this change took effect, not to exceed the original amount.
3. This change will take effect after the Originator has had reasonable opportunity to act on it; until then, the prior arrangement governs.
4. I acknowledge that ACH transactions originated under the existing authorization, as modified by this form, must comply with U.S. law and the NACHA Operating Rules.
5. I represent that I am the Account Holder, or I am authorized to act on the Account Holder's behalf with respect to the account(s) identified above.

## Signature

{{#with parties.accountHolder}}
**Signature:** {{signature "accountHolderSignature"}}
**Date:** {{signatureDate "accountHolderSignature"}}
**Printed name:** {{printedName "accountHolderPrintedName"}}
{{/with}}
`;

const contents: Record<string, string | Uint8Array> = {
  "ach-change-form.instructions.md": __c_ach_change_form_instructions_md,
  "ach-change-form.pdf": __c_ach_change_form_pdf,
  "ach-change-form.md": __c_ach_change_form_md,
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
 * ACH Change Form
 *
 * Standalone form by which an account holder requests a change to an existing ACH arrangement (direct deposit, ACH credit, or ACH debit) already authorized with an originator. Captures change type, identification of the existing arrangement, new account or amount/frequency information, and an effective date. Governed by NACHA Operating Rules and the legal framework of the underlying authorization.
 */
export const achChangeForm = Object.assign(baseForm, {
  /** Pre-populated resolver containing every layer and instruction file this artifact references. */
  resolver,
  /** The raw form spec, exactly as authored in artifacts/banking/ach-change-form/. */
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

export default achChangeForm;
