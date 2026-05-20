// AUTO-GENERATED from artifacts/banking/ach-debit-authorization/design/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-debit-authorization

import { para, createMemoryResolver } from "@paradoc/core";

const schema = {
  "$schema": "https://schema.paradoc.dev/schema.json",
  "kind": "form",
  "name": "ach-debit-authorization",
  "version": "1.0.0",
  "title": "ACH Debit Authorization",
  "description": "Authorization by which a payer (consumer or business) authorizes a named originator to initiate ACH debit entries against a deposit account at a named financial institution. Supports one-time and recurring debits, fixed or variable amounts, and is governed by NACHA Operating Rules and (for consumers) Regulation E.",
  "code": "ACH-DEBIT-AUTH",
  "releaseDate": "2026-05-01",
  "metadata": {
    "domain": "banking"
  },
  "instructions": {
    "kind": "file",
    "path": "ach-debit-authorization.instructions.md",
    "mimeType": "text/markdown",
    "title": "Instructions for ACH Debit Authorization",
    "description": "Generated instructions derived from the artifact definition.",
    "checksum": "sha256:d3f96d4fc0e3413447bd6fe26ff5cea671404bbe56c1cb1371b00e3a63c1bd8e"
  },
  "parties": {
    "originator": {
      "partyType": "organization",
      "label": "Originator (Company)",
      "description": "The company that will initiate ACH debit entries against the payer's account (utility, lender, subscription biller, insurer, etc.). The originator is identified for traceability but does not sign the authorization.",
      "min": 1,
      "max": 1
    },
    "payer": {
      "partyType": "any",
      "label": "Payer (Account Holder)",
      "description": "The individual or organization whose bank account will be debited. Identifies the account, schedule, and amount, and signs to grant the originator authorization to pull funds. For consumers, Regulation E applies and the payer retains revocation rights.",
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
      "label": "Originator address (for revocation notices)",
      "description": "Principal business address of the originator. Used so the payer knows where to mail a revocation notice if they wish to cancel the authorization.",
      "required": true,
      "visible": true
    },
    "originatorPhone": {
      "type": "phone",
      "label": "Originator phone",
      "description": "Phone number for the originator's billing or A/R contact regarding this authorization.",
      "required": false,
      "visible": true
    },
    "originatorEmail": {
      "type": "email",
      "label": "Originator email",
      "description": "Email address for the originator's billing or A/R contact regarding this authorization.",
      "required": false,
      "visible": true
    },
    "payerType": {
      "type": "enum",
      "label": "Payer type",
      "description": "Selects whether the payer is a natural person ('individual') or a legal entity ('organization'). Affects which contact-info fields are required and which regulatory regime applies (Reg E for consumers, NACHA-only for businesses).",
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
    "payerAddress": {
      "type": "address",
      "label": "Payer address",
      "description": "Mailing address of the payer; used for transaction notices, return-item handling, and any non-electronic correspondence.",
      "required": true,
      "visible": true
    },
    "payerPhone": {
      "type": "phone",
      "label": "Payer phone (operational contact)",
      "description": "Phone number of the payer or their A/P contact. Required when payerType is 'organization' since the originator typically needs a phone channel for B2B operational issues.",
      "required": "fields.payerType == 'organization'",
      "visible": true
    },
    "payerEmail": {
      "type": "email",
      "label": "Payer email (operational contact)",
      "description": "Email address for transaction notifications and operational correspondence. Required for organizations; optional for individuals.",
      "required": "fields.payerType == 'organization'",
      "visible": true
    },
    "payerBankName": {
      "type": "text",
      "label": "Bank name",
      "description": "Name of the financial institution that holds the payer's account.",
      "maxLength": 100,
      "required": true,
      "visible": true
    },
    "accountType": {
      "type": "enum",
      "label": "Account type",
      "description": "Type of demand-deposit account being debited; maps to the NACHA standard entry class code for the receiving entry.",
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
      "required": true,
      "visible": true
    },
    "payerRoutingNumber": {
      "type": "text",
      "label": "Routing/ABA number (9 digits)",
      "description": "Nine-digit ABA routing number of the payer's bank. Must pass the Federal Reserve checksum.",
      "pattern": "^\\d{9}$",
      "required": true,
      "visible": true
    },
    "payerAccountNumber": {
      "type": "text",
      "label": "Account number",
      "description": "Bank account number to be debited; 4-17 alphanumeric per NACHA conventions. Treated as sensitive data and typically masked in receipts.",
      "minLength": 4,
      "maxLength": 17,
      "pattern": "^[A-Za-z0-9]+$",
      "required": true,
      "visible": true
    },
    "nameOnAccount": {
      "type": "text",
      "label": "Name on account (if different from payer)",
      "description": "Literal name printed on the bank account, if different from the payer's legal name on this form. Helps avoid ACH rejects when the bank performs strict name matching.",
      "maxLength": 200,
      "required": false,
      "visible": true
    },
    "voidedCheckAttached": {
      "type": "boolean",
      "label": "Voided check or deposit slip attached",
      "description": "Whether a voided check or deposit slip has been attached to verify the routing and account numbers. Strongly encouraged to reduce ACH-return rates.",
      "required": false,
      "visible": true
    },
    "paymentMode": {
      "type": "enum",
      "label": "Payment mode",
      "description": "Whether this authorization covers a single one-time debit or a recurring series. Drives which schedule fields appear below.",
      "enum": [
        {
          "value": "one_time",
          "label": "One time"
        },
        {
          "value": "recurring",
          "label": "Recurring"
        }
      ],
      "required": true,
      "visible": true
    },
    "amount": {
      "type": "money",
      "label": "Amount (USD)",
      "description": "Dollar amount of the debit. Required for one-time payments and for fixed-amount recurring payments. For variable-amount recurring debits the amount is derived per-cycle.",
      "min": 0.01,
      "required": "fields.paymentMode == 'one_time' or (fields.paymentMode == 'recurring' and fields.amountMode == 'fixed')",
      "visible": "fields.paymentMode == 'one_time' or (fields.paymentMode == 'recurring' and fields.amountMode == 'fixed')"
    },
    "paymentMemo": {
      "type": "text",
      "label": "Memo or purpose",
      "description": "Free-form description of the purpose of the debit(s), e.g., 'Monthly utility bill', 'Loan payment'. Appears on transaction notices.",
      "maxLength": 200,
      "required": false,
      "visible": true
    },
    "paymentDate": {
      "type": "date",
      "label": "Debit date (one-time)",
      "description": "Date on which a one-time debit is to be drafted. Subject to standard ACH lead time (typically 2-3 business days).",
      "required": "fields.paymentMode == 'one_time'",
      "visible": "fields.paymentMode == 'one_time'"
    },
    "amountMode": {
      "type": "enum",
      "label": "Amount mode (recurring)",
      "description": "For recurring debits, whether each cycle's amount is a fixed value or derived from an external source (e.g. monthly statement). Drives which amount fields are visible.",
      "enum": [
        {
          "value": "fixed",
          "label": "Fixed"
        },
        {
          "value": "variable",
          "label": "Variable"
        }
      ],
      "required": "fields.paymentMode == 'recurring'",
      "visible": "fields.paymentMode == 'recurring'"
    },
    "frequency": {
      "type": "enum",
      "label": "Frequency",
      "description": "Cadence at which recurring debits occur. Drives which day-of-month / day-of-week fields are visible.",
      "enum": [
        {
          "value": "weekly",
          "label": "Weekly"
        },
        {
          "value": "bi_weekly",
          "label": "Bi-weekly"
        },
        {
          "value": "semi_monthly",
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
      "required": "fields.paymentMode == 'recurring'",
      "visible": "fields.paymentMode == 'recurring'"
    },
    "startDate": {
      "type": "date",
      "label": "Start date (first scheduled debit)",
      "description": "Date of the first debit in a recurring series. Subsequent debits are derived from this date and the chosen frequency.",
      "required": "fields.paymentMode == 'recurring'",
      "visible": "fields.paymentMode == 'recurring'"
    },
    "amountRangeMin": {
      "type": "money",
      "label": "Minimum debit amount (variable)",
      "description": "For variable-amount recurring debits, the lowest dollar amount the payer expects in any cycle. NACHA encourages disclosure of a range when the amount can vary.",
      "min": 0,
      "required": false,
      "visible": "fields.paymentMode == 'recurring' and fields.amountMode == 'variable'"
    },
    "amountRangeMax": {
      "type": "money",
      "label": "Maximum debit amount (variable)",
      "description": "For variable-amount recurring debits, the highest dollar amount the payer authorizes in any cycle. Acts as a cap protecting the payer from unexpectedly large drafts.",
      "min": 0,
      "required": false,
      "visible": "fields.paymentMode == 'recurring' and fields.amountMode == 'variable'"
    },
    "amountSource": {
      "type": "text",
      "label": "Amount source (e.g. amount shown on monthly statement)",
      "description": "Free-form description of how each cycle's debit amount will be determined (e.g. 'amount on monthly statement'). Required when amountMode is 'variable' so the payer knows what to expect.",
      "maxLength": 200,
      "required": "fields.paymentMode == 'recurring' and fields.amountMode == 'variable'",
      "visible": "fields.paymentMode == 'recurring' and fields.amountMode == 'variable'"
    },
    "dayOfMonth": {
      "type": "number",
      "label": "Day of month (monthly)",
      "description": "Day of each month on which monthly debits are drafted (1-31). Used only when frequency is 'monthly'.",
      "min": 1,
      "max": 31,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'monthly'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'monthly'"
    },
    "semiMonthlyDay1": {
      "type": "number",
      "label": "First draft day of month (semi-monthly)",
      "description": "First of two days per month on which semi-monthly debits are drafted (e.g. 1st). Used only when frequency is 'semi_monthly'.",
      "min": 1,
      "max": 31,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'semi_monthly'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'semi_monthly'"
    },
    "semiMonthlyDay2": {
      "type": "number",
      "label": "Second draft day of month (semi-monthly)",
      "description": "Second of two days per month for semi-monthly debits (e.g. 15th). Must differ from semiMonthlyDay1.",
      "min": 1,
      "max": 31,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'semi_monthly'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'semi_monthly'"
    },
    "dayOfWeek": {
      "type": "enum",
      "label": "Day of week (weekly or bi-weekly)",
      "description": "Day of the week on which weekly or bi-weekly debits are drafted. Used only when frequency is 'weekly' or 'bi_weekly'.",
      "enum": [
        {
          "value": "monday",
          "label": "Monday"
        },
        {
          "value": "tuesday",
          "label": "Tuesday"
        },
        {
          "value": "wednesday",
          "label": "Wednesday"
        },
        {
          "value": "thursday",
          "label": "Thursday"
        },
        {
          "value": "friday",
          "label": "Friday"
        },
        {
          "value": "saturday",
          "label": "Saturday"
        },
        {
          "value": "sunday",
          "label": "Sunday"
        }
      ],
      "required": "fields.paymentMode == 'recurring' and (fields.frequency == 'weekly' or fields.frequency == 'bi_weekly')",
      "visible": "fields.paymentMode == 'recurring' and (fields.frequency == 'weekly' or fields.frequency == 'bi_weekly')"
    },
    "quarterMonth": {
      "type": "enum",
      "label": "Month within quarter (quarterly)",
      "description": "Which month of each calendar quarter the debit occurs in (first/second/third). Used only when frequency is 'quarterly'.",
      "enum": [
        {
          "value": "first",
          "label": "First month of quarter"
        },
        {
          "value": "second",
          "label": "Second month of quarter"
        },
        {
          "value": "third",
          "label": "Third month of quarter"
        }
      ],
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'quarterly'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'quarterly'"
    },
    "quarterDay": {
      "type": "number",
      "label": "Day of month within quarter (quarterly)",
      "description": "Day-of-month (1-31) when quarterly debits occur.",
      "min": 1,
      "max": 31,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'quarterly'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'quarterly'"
    },
    "annualMonth": {
      "type": "enum",
      "label": "Month (annual)",
      "description": "Calendar month in which the annual debit occurs. Used only when frequency is 'annual'.",
      "enum": [
        {
          "value": "january",
          "label": "January"
        },
        {
          "value": "february",
          "label": "February"
        },
        {
          "value": "march",
          "label": "March"
        },
        {
          "value": "april",
          "label": "April"
        },
        {
          "value": "may",
          "label": "May"
        },
        {
          "value": "june",
          "label": "June"
        },
        {
          "value": "july",
          "label": "July"
        },
        {
          "value": "august",
          "label": "August"
        },
        {
          "value": "september",
          "label": "September"
        },
        {
          "value": "october",
          "label": "October"
        },
        {
          "value": "november",
          "label": "November"
        },
        {
          "value": "december",
          "label": "December"
        }
      ],
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'annual'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'annual'"
    },
    "annualDay": {
      "type": "number",
      "label": "Day of month (annual)",
      "description": "Day-of-month (1-31) when the annual debit occurs.",
      "min": 1,
      "max": 31,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'annual'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'annual'"
    },
    "frequencyOther": {
      "type": "text",
      "label": "Custom frequency description",
      "description": "Free-form description of a custom cadence when none of the named frequencies apply. Required when frequency is 'other'.",
      "maxLength": 200,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'other'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'other'"
    },
    "endCondition": {
      "type": "enum",
      "label": "End condition",
      "description": "How the recurring authorization terminates: explicit end date, fixed number of debits, or until the payer cancels in writing.",
      "enum": [
        {
          "value": "until_cancelled",
          "label": "Until cancelled"
        },
        {
          "value": "end_date",
          "label": "On a specific end date"
        },
        {
          "value": "count",
          "label": "After a number of payments"
        }
      ],
      "required": "fields.paymentMode == 'recurring'",
      "visible": "fields.paymentMode == 'recurring'"
    },
    "endDate": {
      "type": "date",
      "label": "End date",
      "description": "Last date on which a debit may occur. Required when endCondition is 'end_date'; must be after startDate.",
      "required": "fields.paymentMode == 'recurring' and fields.endCondition == 'end_date'",
      "visible": "fields.paymentMode == 'recurring' and fields.endCondition == 'end_date'"
    },
    "debitCount": {
      "type": "number",
      "label": "Number of debits",
      "description": "Total number of recurring debits to be drafted before the authorization expires. Required when endCondition is 'count'.",
      "min": 1,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.endCondition == 'count'",
      "visible": "fields.paymentMode == 'recurring' and fields.endCondition == 'count'"
    },
    "referenceNumber": {
      "type": "text",
      "label": "Reference number (customer #, loan #, invoice ID)",
      "description": "External reference identifying the underlying obligation being paid (customer ID, loan number, invoice ID). Carried into the originator's records for reconciliation.",
      "maxLength": 80,
      "required": false,
      "visible": true
    }
  },
  "rules": {
    "amountRangeOrder": {
      "expr": "not (amountRangeMin and amountRangeMax) or amountRangeMax.amount >= amountRangeMin.amount",
      "message": "Maximum debit amount must be greater than or equal to minimum debit amount.",
      "severity": "error"
    },
    "endDateAfterStart": {
      "expr": "not (paymentMode == 'recurring' and endCondition == 'end_date') or not endDate or not startDate or endDate > startDate",
      "message": "End date must be after start date.",
      "severity": "error"
    },
    "semiMonthlyDistinct": {
      "expr": "not (paymentMode == 'recurring' and frequency == 'semi_monthly') or not (semiMonthlyDay1 and semiMonthlyDay2) or semiMonthlyDay1 != semiMonthlyDay2",
      "message": "The two semi-monthly draft days must differ.",
      "severity": "error"
    }
  },
  "layers": {
    "markdown": {
      "kind": "file",
      "mimeType": "text/markdown",
      "title": "Markdown Form",
      "path": "ach-debit-authorization.md",
      "checksum": "sha256:ff9b07c5fe0fd534d1015c68649c23a6180e1daa44bdc52e1238d9f0163e2d44"
    },
    "pdf": {
      "kind": "file",
      "mimeType": "application/pdf",
      "title": "PDF Form",
      "path": "ach-debit-authorization.pdf",
      "checksum": "sha256:51b3322fb21ba4431dac7e46c89df8d06a8b382e41362fc583b9d08fa6de02df",
      "signatureBlocks": {
        "payerSignature": {
          "type": "signature",
          "page": 1,
          "x": 128,
          "y": 494,
          "width": 230,
          "height": 14,
          "partyRole": "payer",
          "partyIndex": 0,
          "label": "Signature of Payer"
        },
        "payerDate": {
          "type": "date",
          "page": 1,
          "x": 410,
          "y": 494,
          "width": 90,
          "height": 14,
          "partyRole": "payer",
          "partyIndex": 0,
          "label": "Date"
        },
        "payerPrintedName": {
          "type": "printed_name",
          "page": 1,
          "x": 146,
          "y": 522,
          "width": 200,
          "height": 14,
          "partyRole": "payer",
          "partyIndex": 0,
          "label": "Printed name"
        },
        "payerCapacity": {
          "type": "capacity",
          "page": 1,
          "x": 505,
          "y": 522,
          "width": 53,
          "height": 14,
          "partyRole": "payer",
          "partyIndex": 0,
          "label": "Title (organizations only)"
        }
      },
      "bindings": {
        "originatorName": "parties.originator.legalName",
        "originatorAddressLine1": "originatorAddress.line1",
        "originatorCity": "originatorAddress.locality",
        "originatorState": "originatorAddress.region",
        "originatorZip": "originatorAddress.postalCode",
        "originatorPhone": "originatorPhone.number",
        "originatorEmail": "originatorEmail",
        "payerType_individual": "payerType:individual",
        "payerType_organization": "payerType:organization",
        "payerName": "parties.payer.name",
        "payerAddressLine1": "payerAddress.line1",
        "payerCity": "payerAddress.locality",
        "payerState": "payerAddress.region",
        "payerZip": "payerAddress.postalCode",
        "payerPhone": "payerPhone.number",
        "payerEmail": "payerEmail",
        "payerBankName": "payerBankName",
        "payerRoutingNumber": "payerRoutingNumber",
        "payerAccountNumber": "payerAccountNumber",
        "accountType_checking": "accountType:checking",
        "accountType_savings": "accountType:savings",
        "nameOnAccount": "nameOnAccount",
        "voidedCheckAttached": "voidedCheckAttached",
        "paymentMode_onetime": "paymentMode:one_time",
        "paymentMode_recurring": "paymentMode:recurring",
        "oneTimeAmount": "amount.amount",
        "paymentDate": "paymentDate",
        "amountMode_fixed": "amountMode:fixed",
        "recurringFixedAmount": "amount.amount",
        "amountMode_variable": "amountMode:variable",
        "amountRangeMin": "amountRangeMin.amount",
        "amountRangeMax": "amountRangeMax.amount",
        "amountSource": "amountSource",
        "frequency_weekly": "frequency:weekly",
        "frequency_biweekly": "frequency:bi_weekly",
        "frequency_semimonthly": "frequency:semi_monthly",
        "frequency_monthly": "frequency:monthly",
        "frequency_quarterly": "frequency:quarterly",
        "frequency_annual": "frequency:annual",
        "frequency_other": "frequency:other",
        "startDate": "startDate",
        "endCondition_untilcancelled": "endCondition:until_cancelled",
        "endCondition_enddate": "endCondition:end_date",
        "endDate": "endDate",
        "endCondition_count": "endCondition:count",
        "debitCount": "debitCount",
        "paymentMemo": "paymentMemo",
        "referenceNumber": "referenceNumber"
      }
    }
  },
  "defaultLayer": "pdf"
} as const;

const __c_ach_debit_authorization_instructions_md: string = `---
title: Instructions for ACH Debit Authorization
source_url: null
slug: ach-debit-authorization
timestamp: 2026-05-12T02:39:15Z
generated: true
---

# Instructions for ACH Debit Authorization

## Purpose

This form authorizes a named Originator (a company or agency) to withdraw money from the Payer's bank account by ACH debit. It can be used for a one-time withdrawal or for recurring withdrawals at a fixed or variable amount.

## How to fill it out

### 1. Originator

**1.** Enter the Originator's mailing address (required), phone, and email. The address is where the Payer will send a written revocation if needed.

### 2. Payer

**2.** Select the Payer type: **Individual** or **Organization**.

**3.** Enter the Payer's mailing address (required).

**4.** If the Payer is an **Organization**, also enter a phone and email for operational contact. These are optional for an individual.

### 3. Bank account to be debited

**5.** Enter the bank name.

**6.** Select the account type: **Checking** or **Savings**.

**7.** Enter the 9-digit routing / ABA number.

**8.** Enter the account number.

**9.** If the name on the account is different from the Payer, enter the name on the account.

**10.** Check the box if a voided check or deposit slip is attached. Attaching one is recommended.

### 4. Payment mode

**11.** Select the Payment mode: **One-time** or **Recurring**.

### 5. One-time debit details

Complete steps 12–14 if **One-time** is selected.

**12.** Enter the amount in U.S. dollars.

**13.** Enter the Debit date — the date the withdrawal should occur.

**14.** Optionally enter a memo or purpose.

### 6. Recurring debit details

Complete steps 15–21 if **Recurring** is selected.

**15.** Select the Amount mode: **Fixed** (the same amount every time) or **Variable** (the amount changes per cycle).

**16.** If **Fixed**, enter the amount in U.S. dollars.

**17.** If **Variable**, optionally enter a minimum and maximum debit amount, and describe the amount source (for example, "the amount shown on the monthly statement").

**18.** Select the Frequency: **Weekly**, **Bi-weekly**, **Semi-monthly**, **Monthly**, **Quarterly**, **Annual**, or **Other**.

**19.** Enter the Start date — the date of the first scheduled debit.

**20.** Provide the timing details for the frequency selected:
   - **Monthly** — enter the day of the month.
   - **Semi-monthly** — enter the two days of the month (first and second).
   - **Weekly** or **Bi-weekly** — enter the day of the week.

**21.** Optionally enter a memo or purpose.

### 7. Sign and submit

**22.** Sign and date the form, then return it to the Originator.

## Notes

- The Payer may revoke this authorization at any time by sending written notice to the Originator at the address provided. Allow the Originator a reasonable time (typically 10 business days) to act on the revocation before the next scheduled debit.
- For consumer accounts (an individual Payer), Regulation E gives the Payer the right to dispute an unauthorized or incorrect ACH debit. Contact the bank promptly if an entry was not authorized.
`;
const __c_ach_debit_authorization_md: string = `# ACH Debit Authorization

*I authorize the Originator named below to initiate ACH debit entries to the account identified below.*

## Originator

- **Name:** {{parties.originator.legalName}}{{#if parties.originator.name}} (DBA {{parties.originator.name}}){{/if}}
- **Address:** {{originatorAddress.line1}}{{#if originatorAddress.line2}}, {{originatorAddress.line2}}{{/if}}, {{originatorAddress.locality}}, {{originatorAddress.region}} {{originatorAddress.postalCode}}
- **Phone:** {{originatorPhone}}
- **Email:** {{originatorEmail}}

## Payer

- **Type:**
  - [{{#if (eq payerType "individual")}}x{{else}} {{/if}}] Individual
  - [{{#if (eq payerType "organization")}}x{{else}} {{/if}}] Organization
- **Name:** {{#if (eq payerType "organization")}}{{parties.payer.legalName}}{{#if parties.payer.name}} (DBA {{parties.payer.name}}){{/if}}{{else}}{{parties.payer.name}}{{/if}}
- **Address:** {{payerAddress.line1}}{{#if payerAddress.line2}}, {{payerAddress.line2}}{{/if}}, {{payerAddress.locality}}, {{payerAddress.region}} {{payerAddress.postalCode}}
- **Phone:** {{payerPhone}}
- **Email:** {{payerEmail}}

## Account

- **Bank:** {{payerBankName}}
- **Routing/ABA #:** {{payerRoutingNumber}}
- **Account #:** {{payerAccountNumber}}
- **Account type:**
  - [{{#if (eq accountType "checking")}}x{{else}} {{/if}}] Checking
  - [{{#if (eq accountType "savings")}}x{{else}} {{/if}}] Savings
- **Name on account:** {{nameOnAccount}}
- [{{#if voidedCheckAttached}}x{{else}} {{/if}}] Voided check or deposit slip attached

## Payment

- **Mode:**
  - [{{#if (eq paymentMode "one_time")}}x{{else}} {{/if}}] One-time
  - [{{#if (eq paymentMode "recurring")}}x{{else}} {{/if}}] Recurring

{{#if (eq paymentMode "one_time")}}
- **Amount:** \${{amount.amount}} {{amount.currency}}
- **Debit date:** {{paymentDate}}
{{/if}}

{{#if (eq paymentMode "recurring")}}
- **Amount mode:**
  - [{{#if (eq amountMode "fixed")}}x{{else}} {{/if}}] Fixed amount: \${{amount.amount}} {{amount.currency}}
  - [{{#if (eq amountMode "variable")}}x{{else}} {{/if}}] Variable amount: min \${{amountRangeMin.amount}} – max \${{amountRangeMax.amount}}, source: {{amountSource}}
- **Frequency:**
  - [{{#if (eq frequency "weekly")}}x{{else}} {{/if}}] Weekly
  - [{{#if (eq frequency "bi_weekly")}}x{{else}} {{/if}}] Bi-weekly
  - [{{#if (eq frequency "semi_monthly")}}x{{else}} {{/if}}] Semi-monthly
  - [{{#if (eq frequency "monthly")}}x{{else}} {{/if}}] Monthly
  - [{{#if (eq frequency "quarterly")}}x{{else}} {{/if}}] Quarterly
  - [{{#if (eq frequency "annual")}}x{{else}} {{/if}}] Annual
  - [{{#if (eq frequency "other")}}x{{else}} {{/if}}] Other
- **Draft day(s):**
{{#if (eq frequency "monthly")}} day {{dayOfMonth}} of each month{{/if}}
{{#if (eq frequency "semi_monthly")}} days {{semiMonthlyDay1}} and {{semiMonthlyDay2}} of each month{{/if}}
{{#if (eq frequency "weekly")}} every {{dayOfWeek}}{{/if}}
{{#if (eq frequency "bi_weekly")}} every other {{dayOfWeek}} starting from start date{{/if}}
{{#if (eq frequency "quarterly")}} {{quarterMonth}} month of each quarter, day {{quarterDay}}{{/if}}
{{#if (eq frequency "annual")}} {{annualMonth}} {{annualDay}} each year{{/if}}
{{#if (eq frequency "other")}} {{frequencyOther}}{{/if}}
- **Start date:** {{startDate}}
- **End condition:**
  - [{{#if (eq endCondition "until_cancelled")}}x{{else}} {{/if}}] Until cancelled
  - [{{#if (eq endCondition "end_date")}}x{{else}} {{/if}}] End date: {{endDate}}
  - [{{#if (eq endCondition "count")}}x{{else}} {{/if}}] After {{debitCount}} debits
{{/if}}

- **Memo:** {{paymentMemo}}
- **Reference #:** {{referenceNumber}}

## Terms

1. This authorization remains in effect until I provide written notice of termination to the Originator.
2. Erroneous debits may be reversed by notifying the Financial Institution within statutory time limits.
3. Origination of these debits will comply with U.S. law and NACHA Operating Rules.
4. I represent that I am authorized to act with respect to the account identified above.

## Signature

{{#with parties.payer}}
**Signature:** {{signature "payerSignature"}}
**Date:** {{signatureDate "payerSignature"}}
**Printed name:** {{printedName "payerPrintedName"}}
{{#if (eq ../payerType "organization")}}
**Title (organization):** {{capacity "payerCapacity"}}
{{/if}}
{{/with}}
`;
const __c_ach_debit_authorization_pdf_b64 = "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtT2JsaXF1ZSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjMgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUgL0VuY29kaW5nIC9EaWZmZXJlbmNlcyBbMjQgL2JyZXZlIC9jYXJvbiAvY2lyY3VtZmxleCAvZG90YWNjZW50IC9odW5nYXJ1bWxhdXQgL29nb25layAvcmluZyAvdGlsZGUgMzkgL3F1b3Rlc2luZ2xlIDk2IC9ncmF2ZSAxMjggL2J1bGxldCAvZGFnZ2VyIC9kYWdnZXJkYmwgL2VsbGlwc2lzIC9lbWRhc2ggL2VuZGFzaCAvZmxvcmluIC9mcmFjdGlvbiAvZ3VpbHNpbmdsbGVmdCAvZ3VpbHNpbmdscmlnaHQgL21pbnVzIC9wZXJ0aG91c2FuZCAvcXVvdGVkYmxiYXNlIC9xdW90ZWRibGxlZnQgL3F1b3RlZGJscmlnaHQgL3F1b3RlbGVmdCAvcXVvdGVyaWdodCAvcXVvdGVzaW5nbGJhc2UgL3RyYWRlbWFyayAvZmkgL2ZsIC9Mc2xhc2ggL09FIC9TY2Fyb24gL1lkaWVyZXNpcyAvWmNhcm9uIC9kb3RsZXNzaSAvbHNsYXNoIC9vZSAvc2Nhcm9uIC96Y2Fyb24gMTYwIC9FdXJvIDE2NCAvY3VycmVuY3kgMTY2IC9icm9rZW5iYXIgMTY4IC9kaWVyZXNpcyAvY29weXJpZ2h0IC9vcmRmZW1pbmluZSAxNzIgL2xvZ2ljYWxub3QgLy5ub3RkZWYgL3JlZ2lzdGVyZWQgL21hY3JvbiAvZGVncmVlIC9wbHVzbWludXMgL3R3b3N1cGVyaW9yIC90aHJlZXN1cGVyaW9yIC9hY3V0ZSAvbXUgMTgzIC9wZXJpb2RjZW50ZXJlZCAvY2VkaWxsYSAvb25lc3VwZXJpb3IgL29yZG1hc2N1bGluZSAxODggL29uZXF1YXJ0ZXIgL29uZWhhbGYgL3RocmVlcXVhcnRlcnMgMTkyIC9BZ3JhdmUgL0FhY3V0ZSAvQWNpcmN1bWZsZXggL0F0aWxkZSAvQWRpZXJlc2lzIC9BcmluZyAvQUUgL0NjZWRpbGxhIC9FZ3JhdmUgL0VhY3V0ZSAvRWNpcmN1bWZsZXggL0VkaWVyZXNpcyAvSWdyYXZlIC9JYWN1dGUgL0ljaXJjdW1mbGV4IC9JZGllcmVzaXMgL0V0aCAvTnRpbGRlIC9PZ3JhdmUgL09hY3V0ZSAvT2NpcmN1bWZsZXggL090aWxkZSAvT2RpZXJlc2lzIC9tdWx0aXBseSAvT3NsYXNoIC9VZ3JhdmUgL1VhY3V0ZSAvVWNpcmN1bWZsZXggL1VkaWVyZXNpcyAvWWFjdXRlIC9UaG9ybiAvZ2VybWFuZGJscyAvYWdyYXZlIC9hYWN1dGUgL2FjaXJjdW1mbGV4IC9hdGlsZGUgL2FkaWVyZXNpcyAvYXJpbmcgL2FlIC9jY2VkaWxsYSAvZWdyYXZlIC9lYWN1dGUgL2VjaXJjdW1mbGV4IC9lZGllcmVzaXMgL2lncmF2ZSAvaWFjdXRlIC9pY2lyY3VtZmxleCAvaWRpZXJlc2lzIC9ldGggL250aWxkZSAvb2dyYXZlIC9vYWN1dGUgL29jaXJjdW1mbGV4IC9vdGlsZGUgL29kaWVyZXNpcyAvZGl2aWRlIC9vc2xhc2ggL3VncmF2ZSAvdWFjdXRlIC91Y2lyY3VtZmxleCAvdWRpZXJlc2lzIC95YWN1dGUgL3Rob3JuIC95ZGllcmVzaXNdPj4KZW5kb2JqCjYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNyAwIG9iago8PAovQkJveCBbIDAgMCAxODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwtABiI4WiVK40Lv2QCgUnX2cFrkI0qXCuPKAISIM7VyCXq68zFwAZgQ6ZZW5kc3RyZWFtCmVuZG9iago4IDAgb2JqCjw8Ci9BUCA8PAovTiA3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA4Mi41MDUgNjYwIDI2Mi41MDUgNjcyIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvck5hbWUpIAogIC9UVSAoTmFtZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyOS40OTUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2OCAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMrLUM7E0VTA0UihK5Urj0g+pUHDydVbgKsQiHc6VBxQFaXTnCuRy9XXmAgCWrxBBZW5kc3RyZWFtCmVuZG9iagoxMSAwIG9iago8PAovQVAgPDwKL04gMTAgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDMxNi4wMTkgNjYwIDU0NS41MTQgNjcyIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvckFkZHJlc3NMaW5lMSkgCiAgL1RVIChBZGRyZXNzKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEyIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEzIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULAwUDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD9cQ43ZW5kc3RyZWFtCmVuZG9iagoxNCAwIG9iago8PAovQVAgPDwKL04gMTMgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDc0IDY0MiAxNTQgNjU0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvckNpdHkpIAogIC9UVSAoQ2l0eSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxNSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxNiAwIG9iago8PAovQkJveCBbIDAgMCAyNSAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTUgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMlUwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/RcONWVuZHN0cmVhbQplbmRvYmoKMTcgMCBvYmoKPDwKL0FQIDw8Ci9OIDE2IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAxODcuNTE3IDY0MiAyMTIuNTE3IDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JTdGF0ZSkgCiAgL1RVIChTdGF0ZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxOSAwIG9iago8PAovQkJveCBbIDAgMCA1MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNVAwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/IEOMWVuZHN0cmVhbQplbmRvYmoKMjAgMCBvYmoKPDwKL0FQIDw8Ci9OIDE5IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAyMzcuNTIgNjQyIDI4Ny41MiA2NTQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmlnaW5hdG9yWmlwKSAKICAvVFUgKFppcCkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoyMSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoyMiAwIG9iago8PAovQkJveCBbIDAgMCA4MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMjEgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFCwMFAwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/XEON2VuZHN0cmVhbQplbmRvYmoKMjMgMCBvYmoKPDwKL0FQIDw8Ci9OIDIyIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAzMjYuMDQxIDY0MiA0MDYuMDQxIDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JQaG9uZSkgCiAgL1RVIChQaG9uZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoyNCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoyNSAwIG9iago8PAovQkJveCBbIDAgMCA5My45NTkgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDI0IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDTWszS1VDA0UihK5Urj0g+pUHDydVbgKsSUDefKAwqCtLlzBXK5+jpzAQB5Pg/pZW5kc3RyZWFtCmVuZG9iagoyNiAwIG9iago8PAovQVAgPDwKL04gMjUgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDQ0MS4wNDMgNjQyIDUzNS4wMDIgNjU0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvckVtYWlsKSAKICAvVFUgKEVtYWlsKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjI3IDAgb2JqCjw8Ci9CQm94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0FIBhoPcFQz0TBXKgaSRKYSw0INgoNpirkAAxrMRIWVuZHN0cmVhbQplbmRvYmoKMzMgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDEwNS4yNCA2MjAgMTE0LjI0IDYyOSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVyVHlwZV9pbmRpdmlkdWFsKSAKICAvVFUgKEluZGl2aWR1YWwgXChpbmRpdmlkdWFsXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagozNCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMTcyLjI1NiA2MjAgMTgxLjI1NiA2MjkgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllclR5cGVfb3JnYW5pemF0aW9uKSAKICAvVFUgKE9yZ2FuaXphdGlvbiBcKG9yZ2FuaXphdGlvblwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMzUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMzYgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjIgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAzNSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDC0AGIjhaJUrjQu/ZAKBSdfZwWuQjSpcK48oAhIgztXIJerrzMXABmBDpllbmRzdHJlYW0KZW5kb2JqCjM3IDAgb2JqCjw8Ci9BUCA8PAovTiAzNiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgODIuNTA1IDU5NiAyNjIuNTA1IDYwOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVyTmFtZSkgCiAgL1RVIChOYW1lKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjM4IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjM5IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyOS40OTUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2OCAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDM4IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDKy1DOxNFUwNFIoSuVK49IPqVBw8nVW4CrEIh3OlQcUBWl05wrkcvV15gIAlq8QQWVuZHN0cmVhbQplbmRvYmoKNDAgMCBvYmoKPDwKL0FQIDw8Ci9OIDM5IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAzMTYuMDE5IDU5NiA1NDUuNTE0IDYwOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVyQWRkcmVzc0xpbmUxKSAKICAvVFUgKEFkZHJlc3MpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNDEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDIgMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQxIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDBQMDRSKErlSuPSD6lQcPJ1VuAqRJUJ58oDCoCUu3MFcrn6OnMBAP1xDjdlbmRzdHJlYW0KZW5kb2JqCjQzIDAgb2JqCjw8Ci9BUCA8PAovTiA0MiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgNzQgNTc4IDE1NCA1OTAgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllckNpdHkpIAogIC9UVSAoQ2l0eSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago0NCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago0NSAwIG9iago8PAovQkJveCBbIDAgMCAyNSAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNDQgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMlUwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/RcONWVuZHN0cmVhbQplbmRvYmoKNDYgMCBvYmoKPDwKL0FQIDw8Ci9OIDQ1IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAxODcuNTE3IDU3OCAyMTIuNTE3IDU5MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVyU3RhdGUpIAogIC9UVSAoU3RhdGUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNDcgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDggMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQ3IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDVQMDRSKErlSuPSD6lQcPJ1VuAqRJUJ58oDCoCUu3MFcrn6OnMBAPyBDjFlbmRzdHJlYW0KZW5kb2JqCjQ5IDAgb2JqCjw8Ci9BUCA8PAovTiA0OCAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMjM3LjUyIDU3OCAyODcuNTIgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJaaXApIAogIC9UVSAoWmlwKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjUwIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjUxIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1MCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULAwUDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD9cQ43ZW5kc3RyZWFtCmVuZG9iago1MiAwIG9iago8PAovQVAgPDwKL04gNTEgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDMyNi4wNDEgNTc4IDQwNi4wNDEgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJQaG9uZSkgCiAgL1RVIChQaG9uZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago1MyAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago1NCAwIG9iago8PAovQkJveCBbIDAgMCA5My45NTkgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDUzIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDTWszS1VDA0UihK5Urj0g+pUHDydVbgKsSUDefKAwqCtLlzBXK5+jpzAQB5Pg/pZW5kc3RyZWFtCmVuZG9iago1NSAwIG9iago8PAovQVAgPDwKL04gNTQgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDQ0MS4wNDMgNTc4IDUzNS4wMDIgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJFbWFpbCkgCiAgL1RVIChFbWFpbCkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago1NiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago1NyAwIG9iago8PAovQkJveCBbIDAgMCAxMzAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDU2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQGYiOFolSuNC79kAoFJ19nBa5CNKlwrjygCEiDO1cgl6uvMxcAF+wOj2VuZHN0cmVhbQplbmRvYmoKNTggMCBvYmoKPDwKL0FQIDw8Ci9OIDU3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA3OS4wMTMgNTM0IDIwOS4wMTMgNTQ2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJCYW5rTmFtZSkgCiAgL1RVIChCYW5rKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjU5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjYwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDkwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1OSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULA0UDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD9wQ45ZW5kc3RyZWFtCmVuZG9iago2MSAwIG9iago8PAovQVAgPDwKL04gNjAgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDI2NC4wMzUgNTM0IDM1NC4wMzUgNTQ2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJSb3V0aW5nTnVtYmVyKSAKICAvVFUgKFJvdXRpbmcgIykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago2MiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago2MyAwIG9iago8PAovQkJveCBbIDAgMCAxMzEuOTY1IDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNzIgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA2MiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA0NtSzNDOxhANzBUMjhaJUrjQu/ZAKBSdfZwWuQvwqw7nygApAxrlzBXK5+jpzAQBBSBUVZW5kc3RyZWFtCmVuZG9iago2NCAwIG9iago8PAovQVAgPDwKL04gNjMgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDQxMC41NiA1MzQgNTQyLjUyNSA1NDYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllckFjY291bnROdW1iZXIpIAogIC9UVSAoQWNjb3VudCAjKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjY1IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyA1NCA1MTYgNjMgNTI1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudFR5cGVfY2hlY2tpbmcpIAogIC9UVSAoQ2hlY2tpbmcgXChjaGVja2luZ1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNjYgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDEyMC41MTIgNTE2IDEyOS41MTIgNTI1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudFR5cGVfc2F2aW5ncykgCiAgL1RVIChTYXZpbmdzIFwoc2F2aW5nc1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNjcgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250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QW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNzcgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDU0IDQ3MiA2MyA0ODEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXltZW50TW9kZV9vbmV0aW1lKSAKICAvVFUgKE9uZS10aW1lIFwob25lX3RpbWVcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjc4IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAxMjAuMDA4IDQ3MiAxMjkuMDA4IDQ4MSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheW1lbnRNb2RlX3JlY3VycmluZykgCiAgL1RVIChSZWN1cnJpbmcgXChyZWN1cnJpbmdcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjc5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjgwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA3OSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULAwUDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD9cQ43ZW5kc3RyZWFtCmVuZG9iago4MSAwIG9iago8PAovQVAgPDwKL04gODAgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDE1NC41MiA0NTQgMjM0LjUyIDQ2NiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9uZVRpbWVBbW91bnQpIAogIC9UVSAoQW1vdW50ICQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKODIgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKODMgMCBvYmoKPDwKL0JCb3ggWyAwIDAgOTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDgyIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDRQMDRSKErlSuPSD6lQcPJ1VuAqRJUJ58oDCoCUu3MFcrn6OnMBAP3BDjllbmRzdHJlYW0KZW5kb2JqCjg0IDAgb2JqCjw8Ci9BUCA8PAovTiA4MyAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMjkyLjA0NCA0NTQgMzgyLjA0NCA0NjYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXltZW50RGF0ZSkgCiAgL1RVIChEZWJpdCBkYXRlKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjg1IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAxMTQgNDM2IDEyMyA0NDUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhbW91bnRNb2RlX2ZpeGVkKSAKICAvVFUgKEZpeGVkICQgXChmaXhlZFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKODYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKODcgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNjAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDg2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDNQMDRSKErlSuPSD6lQcPJ1VuAqRJUJ58oDCoCUu3MFcrn6OnMBAPzRDjNlbmRzdHJlYW0KZW5kb2JqCjg4IDAgb2JqCjw8Ci9BUCA8PAovTiA4NyAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMTY0LjUxMSA0MzYgMjI0LjUxMSA0NDggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChyZWN1cnJpbmdGaXhlZEFtb3VudCkgCiAgL1RVIChyZWN1cnJpbmdGaXhlZEFtb3VudCkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago4OSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMjM2LjUxMSA0MzYgMjQ1LjUxMSA0NDUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhbW91bnRNb2RlX3ZhcmlhYmxlKSAKICAvVFUgKFZhcmlhYmxlOiBtaW4gJCBcKHZhcmlhYmxlXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago5MCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago5MSAwIG9iago8PAovQkJveCBbIDAgMCA1MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgOTAgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNVAwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/IEOMWVuZHN0cmVhbQplbmRvYmoKOTIgMCBvYmoKPDwKL0FQIDw8Ci9OIDkxIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAzMTcuNTMyIDQzNiAzNjcuNTMyIDQ0OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFtb3VudFJhbmdlTWluKSAKICAvVFUgKGFtb3VudFJhbmdlTWluKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjkzIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjk0IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDUwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA5MyAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA1UDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD8gQ4xZW5kc3RyZWFtCmVuZG9iago5NSAwIG9iago8PAovQVAgPDwKL04gOTQgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDQwMi4wMzkgNDM2IDQ1Mi4wMzkgNDQ4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYW1vdW50UmFuZ2VNYXgpIAogIC9UVSAobWF4ICQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKOTYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKOTcgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNDcuOTYxIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNzAgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA5NiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAx17M0MzSAA0MFQyOFolSuNC79kAoFJ19nBa5CvArDufKA8iDD3LkCuVx9nbkA9KUT+2VuZHN0cmVhbQplbmRvYmoKOTggMCBvYmoKPDwKL0FQIDw8Ci9OIDk3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA0OTEuNTUgNDM2IDUzOS41MTEgNDQ4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYW1vdW50U291cmNlKSAKICAvVFUgKHNvdXJjZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago5OSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMTE0IDQxNiAxMjMgNDI1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZnJlcXVlbmN5X3dlZWtseSkgCiAgL1RVIChXZWVrbHkgXCh3ZWVrbHlcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwMCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMTY0LjUwMiA0MTYgMTczLjUwMiA0MjUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChmcmVxdWVuY3lfYml3ZWVrbHkpIAogIC9UVSAoQmktd2tseSBcKGJpX3dlZWtseVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTAxIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAyMTMuOTk2IDQxNiAyMjIuOTk2IDQyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV9zZW1pbW9udGhseSkgCiAgL1RVIChTZW1pLW1vIFwoc2VtaV9tb250aGx5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDIgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDI3MC45OTYgNDE2IDI3OS45OTYgNDI1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZnJlcXVlbmN5X21vbnRobHkpIAogIC9UVSAoTW9udGhseSBcKG1vbnRobHlcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwMyAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMzIzLjUwNSA0MTYgMzMyLjUwNSA0MjUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChmcmVxdWVuY3lfcXVhcnRlcmx5KSAKICAvVFUgKFF0ciBcKHF1YXJ0ZXJseVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTA0IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAzNTcuMDA2IDQxNiAzNjYuMDA2IDQyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV9hbm51YWwpIAogIC9UVSAoQW5udWFsIFwoYW5udWFsXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDUgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDQwNi4wMjMgNDE2IDQxNS4wMjMgNDI1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZnJlcXVlbmN5X290aGVyKSAKICAvVFUgKE90aGVyIFwob3RoZXJcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwNiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMDcgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjM2LjQ5MSAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDcxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTA2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDI20zOxNLBEAAVDI4WiVK40Lv2QCgUnX2cFrkL8KsO58oAKQMa5cwVyufo6cwEAQioVGWVuZHN0cmVhbQplbmRvYmoKMTA4IDAgb2JqCjw8Ci9BUCA8PAovTiAxMDcgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDI5NS4wMzUgMzk2IDUzMS41MjYgNDA4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoc3RhcnREYXRlKSAKICAvVFUgKFN0YXJ0IGRhdGUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTA5IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyA4MiAzNzYgOTEgMzg1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZW5kQ29uZGl0aW9uX3VudGlsY2FuY2VsbGVkKSAKICAvVFUgKFVudGlsIGNhbmNlbGxlZCBcKHVudGlsX2NhbmNlbGxlZFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTEwIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAxNjkuNTE4IDM3NiAxNzguNTE4IDM4NSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVuZENvbmRpdGlvbl9lbmRkYXRlKSAKICAvVFUgKEVuZCBkYXRlIFwoZW5kX2RhdGVcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjExMSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMTIgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNzAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDExMSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA3UDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD9IQ41ZW5kc3RyZWFtCmVuZG9iagoxMTMgMCBvYmoKPDwKL0FQIDw8Ci9OIDExMiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMjI2LjU0NSAzNzYgMjk2LjU0NSAzODggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbmREYXRlKSAKICAvVFUgKGVuZERhdGUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTE0IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAzMTIuNTQ1IDM3NiAzMjEuNTQ1IDM4NSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVuZENvbmRpdGlvbl9jb3VudCkgCiAgL1RVIChDb3VudCBcKGNvdW50XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMTUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTE2IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDUwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTUgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNVAwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/IEOMWVuZHN0cmVhbQplbmRvYmoKMTE3IDAgb2JqCjw8Ci9BUCA8PAovTiAxMTYgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDM1Ny41NTcgMzc2IDQwNy41NTcgMzg4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZGViaXRDb3VudCkgCiAgL1RVIChkZWJpdENvdW50KSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjExOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMTkgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjQwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjQgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMjFQMDRSKErlSuPSD6lQcPJ1VuAqRJMK58oDioA0uHMFcrn6OnMBABiQDpNlbmRzdHJlYW0KZW5kb2JqCjEyMCAwIG9iago8PAovQVAgPDwKL04gMTE5IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA4My41MDQgMzU2IDMyMy41MDQgMzY4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5bWVudE1lbW8pIAogIC9UVSAoTWVtbykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMjEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTIyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEzOC40OTYgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA3MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEyMSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA0ttAzsTS1hAMLBUMjhaJUrjQu/ZAKBSdfZwWuQvwqw7nygApAxrlzBXK5+jpzAQBEiBUjZW5kc3RyZWFtCmVuZG9iagoxMjMgMCBvYmoKPDwKL0FQIDw8Ci9OIDEyMiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMzkzLjAyOSAzNTYgNTMxLjUyNSAzNjggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChyZWZlcmVuY2VOdW1iZXIpIAogIC9UVSAoUmVmZXJlbmNlICMpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTI0IDAgb2JqCjw8Ci9Bbm5vdHMgWyA4IDAgUiAxMSAwIFIgMTQgMCBSIDE3IDAgUiAyMCAwIFIgMjMgMCBSIDI2IDAgUiAzMyAwIFIgMzQgMCBSIDM3IDAgUiAKICA0MCAwIFIgNDMgMCBSIDQ2IDAgUiA0OSAwIFIgNTIgMCBSIDU1IDAgUiA1OCAwIFIgNjEgMCBSIDY0IDAgUiA2NSAwIFIgCiAgNjYgMCBSIDY5IDAgUiA3NiAwIFIgNzcgMCBSIDc4IDAgUiA4MSAwIFIgODQgMCBSIDg1IDAgUiA4OCAwIFIgODkgMCBSIAogIDkyIDAgUiA5NSAwIFIgOTggMCBSIDk5IDAgUiAxMDAgMCBSIDEwMSAwIFIgMTAyIDAgUiAxMDMgMCBSIDEwNCAwIFIgMTA1IDAgUiAKICAxMDggMCBSIDEwOSAwIFIgMTEwIDAgUiAxMTMgMCBSIDExNCAwIFIgMTE3IDAgUiAxMjAgMCBSIDEyMyAwIFIgXSAvQ29udGVudHMgMTI4IDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgMTI3IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAKICAvVHJhbnMgPDwKCj4+IC9UeXBlIC9QYWdlCj4+CmVuZG9iagoxMjUgMCBvYmoKPDwKL0Fjcm9Gb3JtIDEyOSAwIFIgL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyAxMjcgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iagoxMjYgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwNTAxMjA0ODU4LTA0JzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwNTAxMjA0ODU4LTA0JzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjEyNyAwIG9iago8PAovQ291bnQgMSAvS2lkcyBbIDEyNCAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEyOCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxOTYwCj4+CnN0cmVhbQpHYXQ9LGdNWWUpJjpPOlMmODMsVCFgP3ErL3BWTFgpYD8hXldVNktIaT42ZyxsWGNpTC5yanJtXlY3VVRacnRSWVdYJ1NYPGduKUFhPnEvIzBNOjpHW2Y4IXFLS2UxYT9kOkNDIlBwLWpBZExnYF5TLyEnLFBzUVI/Z1I1YTtOL0EjJW1eSW8tblM3amkxViYwVDpHbjw1MD5zYGRFK2tdZ0o3XHRadGMpPmtpUWYqb0NEclM7LjIwJSxeVSNYLjhFdT86bkFGPG5jQisuLSc7TSxGUDNYP2VIanVTVyJIRkJVLHVNYzpJcXJjMitmQm0sci89S0QlczsnU1deW3NDT0YqMWQ7QmteZS5RWXRQbVpCaUlYbU4mQzlvODUiNjlsJSJnUD1sWjBWSDkqJ0c8Im1dZEpWTSJBSmk8VHM7IzA2TSE2ZSM9Jz5EQWZuSFQtMWlBXT4yVmwoRjdyZ0xTa1A/YVtSZUBKRTJGWUUlRUJbQUxJQShKciU6OFZtdUBtU0ZNOEIyTTksSV9QZWJAPEktYUNPSUlVJ0o3SiNNaWRjIzwjMzlQLzQkRVwpTV1CVVk0Wy1cbVlUZkVqVXUnI1pyMXRHXT05bydHJmtJbnJMdV10cEYpVmhjZjUzPS8kNzJuZSUhcmJVTmBJLC8iJjFpZmEpYjhoPEREczpMPmIvWEdyWG5XUmRSIm44L0VPb1I+QHRtNW5eWzVQKDlVU21EX1JdJShJaD9NZThxMGVUKW43SUZaJmw7WGZBL0NrMChfbVI/XzZJbF5RW11aX1Q3YjArVGtUdU5QIWQoalsoVG9MUU0xbk1nYlAqWkNmYjRFSiNlNktzQzFhIWw8VzVCLFFOVFVRUyU2VWdEZTw6VCEwaFwza2lmSEpJOTJLOmE5aSxOXTNNXUtsJyw6OUZjTi9gPzprNVlzRzdtWWNQZictQlc0QGVoLGclXzIjTFJwZ1doXjgiJ2dlZiZTPjtucF1BKHRiMzBwVWdVSylBcklbXSFeJSRoUXVGJ09yajxaRHEjMUBOJicoTWYxbCE8ZkwnVVopXT5SKjs4SFRSTy8wcTw7JzheLVBCX1xmLkNmIV0jOjJNYXI8XUI2TTtDNz8sP2pMPiF0SjkucWojOEsrKSw2ZCo8JVhFTlRoYmdVdVdAMnJMR0toMz9tWFRfcl1CK0FJUkFEdUlHalU1WUU5JmUlSj5YYFFBYk1CLkNmdVNBQGVUMUJXVWJLam9PPVJsb0ZQWGteXkdaW25mWSkpUzxqNDsyTnFgLEhfJDdpRUYpQHVSYnNZMi9XQmUoKltLLXEjKG0sR0JSPCo9KG1RRnI8aD5CaTlUVF8qKzc+b1AzXC4xKHMvXSpabUA5JHNDJCVecC9YcEVBKEdHcj46b0RIa1ROY0RrZT49cCtQSGRgSCpBQCxlXlplUF5LcltLclRtT0ojUmVaLCNULilnLl87KTAuP2BPV2B0YExNb2dBQCdMMCEnZFgqcFNsU00uO1VeajRVcEdIKCJrRkxlOWEwRF4+M21oV1FKWnI6N3FZLyYjXE81Rlo1VEkpcTAnW3M0UEoqWjJHYlVqV1hWZm5sck1ta0ZUUiRebzhAdDUsYFskRiJtc0UsOi0kNyFUUkE3bDxXNWtfXk9eWihyKlA+P0krUl9kYGJJbCFUT15IYzFCN2llJ2clK1BHWGEwcCttLEAjLCkuO1YtXz5qNXNSazg1RGFtVmA2LEhvbUhubkNxZlpfTzlnSzIlI25DIy9GTDM1bGNhITVjX3NIMGxkUjFQYztdSFtRaShDOW1BMSJTOm5YTUpbR3N1JzFfPXBUdDxKOzNfPWlkVWhJVz9NSTRcUTU4RzJvZ1tjRSkyJlkmIkFXRGltOWxtXFxnJkVqUiVGKXJcRWVhLz04b0VzKU9MIkovREU3c1hOQGc6IUIvPHI9IlowMlBmXDtfT24iK0siOU1nWVUlYzdIU01MQktFRyhhZCk0Yy5FXWJIUiRLR3BPT0NKR1AydUxWT0o9dGtWbUUoMmlvWiROQHNlWG1DWGlyJiE6QHJqKjtBcktlRlgkbDYrTDFAS2dtImNKZiFYRUNFSHVQNnIwQiU9dU48bls9VXMoKCIwQ2djJ0xLT21scSM6KzdCaGFIVkF0VVhRczkqQyxgaidISiJ1ckNzZWRWX0ZOO1BrJSFCJDZFW2NDLUZoaz84QkFUTlMtKTNkOl1lTExIRUhoWkxARCMyKVQodCVlVF8vc0NsdC5MOm8ubzcyOjU2Vi1IJ1BnMl04XS4wMTAsQ1dXTDtNb2c/LXA9UWlDdVNZL1M7K1RWckhGRTc2RCQrYk1HU1pxUVI9LjtmYz05YnVHT05wMnU9U2xbQlJmWFgwJi9uZUE0YXIpalJLWEQwbEJXOUsqbT5ENHIuUy8rWz8nbjMoWTFyUiVFRk9xSkVlMyxAKy5oLV5iVVtTLE9kK2RWKi8iRVYlKF0jR3JWZ2JkcXRFNWJSUVVtTDFSK3AvUShMdGltMDxTQzA2WDJxUls/WjBHVC5GTGA7NHFYT3BpWkdSbTtnVU5AZWpnWTg4cD5zNWhjPDg1TzRNXShkTDVnU2lFMzNdMFFyckROU1RCSH4+ZW5kc3RyZWFtCmVuZG9iagoxMjkgMCBvYmoKPDwKL0RBICgvSGVsdiAwIFRmIDAgZykgL0RSIDw8IC9FbmNvZGluZwo8PAovUkxBRmVuY29kaW5nCjUgMCBSCj4+Ci9Gb250IDw8IC9IZWx2IDYgMCBSID4+Cj4+IC9GaWVsZHMgWyA4IDAgUiAxMSAwIFIgMTQgMCBSIDE3IDAgUiAyMCAwIFIgMjMgMCBSIDI2IDAgUiAzMyAwIFIgMzQgMCBSIDM3IDAgUiAKICA0MCAwIFIgNDMgMCBSIDQ2IDAgUiA0OSAwIFIgNTIgMCBSIDU1IDAgUiA1OCAwIFIgNjEgMCBSIDY0IDAgUiA2NSAwIFIgCiAgNjYgMCBSIDY5IDAgUiA3NiAwIFIgNzcgMCBSIDc4IDAgUiA4MSAwIFIgODQgMCBSIDg1IDAgUiA4OCAwIFIgODkgMCBSIAogIDkyIDAgUiA5NSAwIFIgOTggMCBSIDk5IDAgUiAxMDAgMCBSIDEwMSAwIFIgMTAyIDAgUiAxMDMgMCBSIDEwNCAwIFIgMTA1IDAgUiAKICAxMDggMCBSIDEwOSAwIFIgMTEwIDAgUiAxMTMgMCBSIDExNCAwIFIgMTE3IDAgUiAxMjAgMCBSIDEyMyAwIFIgXQo+PgplbmRvYmoKeHJlZgowIDEzMAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQ0NiAwMDAwMCBuIAowMDAwMDAxNzY4IDAwMDAwIG4gCjAwMDAwMDE4NjYgMDAwMDAgbiAKMDAwMDAwMjE1MyAwMDAwMCBuIAowMDAwMDAyNDA1IDAwMDAwIG4gCjAwMDAwMDI1MDMgMDAwMDAgbiAKMDAwMDAwMjgwMSAwMDAwMCBuIAowMDAwMDAzMDY3IDAwMDAwIG4gCjAwMDAwMDMxNjYgMDAwMDAgbiAKMDAwMDAwMzQ1NSAwMDAwMCBuIAowMDAwMDAzNzAxIDAwMDAwIG4gCjAwMDAwMDM4MDAgMDAwMDAgbiAKMDAwMDAwNDA4OSAwMDAwMCBuIAowMDAwMDA0MzQ2IDAwMDAwIG4gCjAwMDAwMDQ0NDUgMDAwMDAgbiAKMDAwMDAwNDczNCAwMDAwMCBuIAowMDAwMDA0OTg1IDAwMDAwIG4gCjAwMDAwMDUwODQgMDAwMDAgbiAKMDAwMDAwNTM3MyAwMDAwMCBuIAowMDAwMDA1NjMwIDAwMDAwIG4gCjAwMDAwMDU3MjkgMDAwMDAgbiAKMDAwMDAwNjAyNiAwMDAwMCBuIAowMDAwMDA2MjgzIDAwMDAwIG4gCjAwMDAwMDY2NDEgMDAwMDAgbiAKMDAwMDAwNjkwMCAwMDAwMCBuIAowMDAwMDA3MjYyIDAwMDAwIG4gCjAwMDAwMDc1MjYgMDAwMDAgbiAKMDAwMDAwNzg4NiAwMDAwMCBuIAowMDAwMDA4MTQ4IDAwMDAwIG4gCjAwMDAwMDg1MzQgMDAwMDAgbiAKMDAwMDAwODkyOCAwMDAwMCBuIAowMDAwMDA5MDI3IDAwMDAwIG4gCjAwMDAwMDkzMTYgMDAwMDAgbiAKMDAwMDAwOTU2NSAwMDAwMCBuIAowMDAwMDA5NjY0IDAwMDAwIG4gCjAwMDAwMDk5NjMgMDAwMDAgbiAKMDAwMDAxMDIyNCAwMDAwMCBuIAowMDAwMDEwMzIzIDAwMDAwIG4gCjAwMDAwMTA2MTIgMDAwMDAgbiAKMDAwMDAxMDg1MyAwMDAwMCBuIAowMDAwMDEwOTUyIDAwMDAwIG4gCjAwMDAwMTEyNDEgMDAwMDAgbiAKMDAwMDAxMTQ5MyAwMDAwMCBuIAowMDAwMDExNTkyIDAwMDAwIG4gCjAwMDAwMTE4ODEgMDAwMDAgbiAKMDAwMDAxMjEyNyAwMDAwMCBuIAowMDAwMDEyMjI2IDAwMDAwIG4gCjAwMDAwMTI1MTUgMDAwMDAgbiAKMDAwMDAxMjc2NyAwMDAwMCBuIAowMDAwMDEyODY2IDAwMDAwIG4gCjAwMDAwMTMxNjMgMDAwMDAgbiAKMDAwMDAxMzQxNSAwMDAwMCBuIAowMDAwMDEzNTE0IDAwMDAwIG4gCjAwMDAwMTM4MDMgMDAwMDAgbiAKMDAwMDAxNDA1NiAwMDAwMCBuIAowMDAwMDE0MTU1IDAwMDAwIG4gCjAwMDAwMTQ0NDQgMDAwMDAgbiAKMDAwMDAxNDcwOCAwMDAwMCBuIAowMDAwMDE0ODA3IDAwMDAwIG4gCjAwMDAwMTUxMTAgMDAwMDAgbiAKMDAwMDAxNTM3MyAwMDAwMCBuIAowMDAwMDE1NzQ3IDAwMDAwIG4gCjAwMDAwMTYxMjggMDAwMDAgbiAKMDAwMDAxNjIyNyAwMDAwMCBuIAowMDAwMDE2NTE2IDAwMDAwIG4gCjAwMDAwMTY3NzkgMDAwMDAgbiAKMDAwMDAxNzQwMiAwMDAwMCBuIAowMDAwMDE3NjYzIDAwMDAwIG4gCjAwMDAwMTgyODggMDAwMDAgbiAKMDAwMDAxODU1NCAwMDAwMCBuIAowMDAwMDE5MTc5IDAwMDAwIG4gCjAwMDAwMTk0NDMgMDAwMDAgbiAKMDAwMDAxOTgyNCAwMDAwMCBuIAowMDAwMDIwMTk3IDAwMDAwIG4gCjAwMDAwMjA1ODQgMDAwMDAgbiAKMDAwMDAyMDY4MyAwMDAwMCBuIAowMDAwMDIwOTcyIDAwMDAwIG4gCjAwMDAwMjEyMjggMDAwMDAgbiAKMDAwMDAyMTMyNyAwMDAwMCBuIAowMDAwMDIxNjE2IDAwMDAwIG4gCjAwMDAwMjE4NzQgMDAwMDAgbiAKMDAwMDAyMjI0MiAwMDAwMCBuIAowMDAwMDIyMzQxIDAwMDAwIG4gCjAwMDAwMjI2MzAgMDAwMDAgbiAKMDAwMDAyMjkwNyAwMDAwMCBuIAowMDAwMDIzMjk3IDAwMDAwIG4gCjAwMDAwMjMzOTYgMDAwMDAgbiAKMDAwMDAyMzY4NSAwMDAwMCBuIAowMDAwMDIzOTUwIDAwMDAwIG4gCjAwMDAwMjQwNDkgMDAwMDAgbiAKMDAwMDAyNDMzOCAwMDAwMCBuIAowMDAwMDI0NTk0IDAwMDAwIG4gCjAwMDAwMjQ2OTMgMDAwMDAgbiAKMDAwMDAyNDk5MyAwMDAwMCBuIAowMDAwMDI1MjQ3IDAwMDAwIG4gCjAwMDAwMjU2MTUgMDAwMDAgbiAKMDAwMDAyNTk5OCAwMDAwMCBuIAowMDAwMDI2Mzg3IDAwMDAwIG4gCjAwMDAwMjY3NjcgMDAwMDAgbiAKMDAwMDAyNzE0NyAwMDAwMCBuIAowMDAwMDI3NTI0IDAwMDAwIG4gCjAwMDAwMjc4OTggMDAwMDAgbiAKMDAwMDAyNzk5OCAwMDAwMCBuIAowMDAwMDI4MzAyIDAwMDAwIG4gCjAwMDAwMjg1NjAgMDAwMDAgbiAKMDAwMDAyODk1NiAwMDAwMCBuIAowMDAwMDI5MzQxIDAwMDAwIG4gCjAwMDAwMjk0NDEgMDAwMDAgbiAKMDAwMDAyOTczMiAwMDAwMCBuIAowMDAwMDI5OTg1IDAwMDAwIG4gCjAwMDAwMzAzNjIgMDAwMDAgbiAKMDAwMDAzMDQ2MiAwMDAwMCBuIAowMDAwMDMwNzUzIDAwMDAwIG4gCjAwMDAwMzEwMTIgMDAwMDAgbiAKMDAwMDAzMTExMiAwMDAwMCBuIAowMDAwMDMxNDA1IDAwMDAwIG4gCjAwMDAwMzE2NTggMDAwMDAgbiAKMDAwMDAzMTc1OCAwMDAwMCBuIAowMDAwMDMyMDYzIDAwMDAwIG4gCjAwMDAwMzIzMjggMDAwMDAgbiAKMDAwMDAzMjkwMCAwMDAwMCBuIAowMDAwMDMyOTkwIDAwMDAwIG4gCjAwMDAwMzMyNTMgMDAwMDAgbiAKMDAwMDAzMzMxNiAwMDAwMCBuIAowMDAwMDM1MzY5IDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDUyNzFkOWI3NzczYmVjNTg3MTliNDZlNWQ3NjRlNjhiPjw1MjcxZDliNzc3M2JlYzU4NzE5YjQ2ZTVkNzY0ZTY4Yj5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gMTI2IDAgUgovUm9vdCAxMjUgMCBSCi9TaXplIDEzMAo+PgpzdGFydHhyZWYKMzU4NTYKJSVFT0YK";
const __c_ach_debit_authorization_pdf: Uint8Array = (() => {
  const bin = atob(__c_ach_debit_authorization_pdf_b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
})();

const contents: Record<string, string | Uint8Array> = {
  "ach-debit-authorization.instructions.md": __c_ach_debit_authorization_instructions_md,
  "ach-debit-authorization.md": __c_ach_debit_authorization_md,
  "ach-debit-authorization.pdf": __c_ach_debit_authorization_pdf,
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
 * ACH Debit Authorization
 *
 * Authorization by which a payer (consumer or business) authorizes a named originator to initiate ACH debit entries against a deposit account at a named financial institution. Supports one-time and recurring debits, fixed or variable amounts, and is governed by NACHA Operating Rules and (for consumers) Regulation E.
 */
export const achDebitAuthorization = Object.assign(baseForm, {
  /** Pre-populated resolver containing every layer and instruction file this artifact references. */
  resolver,
  /** The raw form spec, exactly as authored in artifacts/banking/ach-debit-authorization/. */
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

export default achDebitAuthorization;
