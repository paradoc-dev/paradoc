// AUTO-GENERATED from artifacts/banking/ach-debit-authorization/design/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-debit-authorization

import { p } from "@paradoc/core";
import { createMemoryResolver } from "@paradoc/resolvers/memory";

const schema = {
  "$schema": "https://schema.paradoc.dev/2026-09-23.json",
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
      "maxLength": 45,
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
      "maxLength": 45,
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
      "maxLength": 70,
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
      "maxLength": 100,
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
      "maxLength": 45,
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
      "expr": "not (paymentMode == 'recurring' and endCondition == 'end_date') or not endDate or not startDate or dateDiff(startDate, endDate) > 0",
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
      "checksum": "sha256:75ed0668599b488d4c95b0908564cf8bcd5fb55b630d84fcef97a6c111996e63"
    },
    "pdf": {
      "kind": "file",
      "mimeType": "application/pdf",
      "title": "PDF Form",
      "path": "ach-debit-authorization.pdf",
      "checksum": "sha256:114a1c297d03f74eb30b196a0cd1b6f48b9fec03f70da8a8dc2f2a6ecc03f08d",
      "signatures": {
        "payerSignature": {
          "party": {
            "role": "payer",
            "index": 0
          },
          "type": "signature",
          "label": "Signature of Payer",
          "placement": {
            "page": 1,
            "x": 97.02,
            "y": 518,
            "width": 230,
            "height": 14
          }
        },
        "payerDate": {
          "party": {
            "role": "payer",
            "index": 0
          },
          "type": "date_signed",
          "label": "Date",
          "placement": {
            "page": 1,
            "x": 374.53,
            "y": 518,
            "width": 90,
            "height": 14
          }
        },
        "payerPrintedName": {
          "party": {
            "role": "payer",
            "index": 0
          },
          "type": "printed_name",
          "label": "Printed name",
          "placement": {
            "page": 1,
            "x": 112.03,
            "y": 546,
            "width": 200,
            "height": 14
          }
        },
        "payerCapacity": {
          "party": {
            "role": "payer",
            "index": 0
          },
          "type": "capacity",
          "label": "Title (organizations only)",
          "placement": {
            "page": 1,
            "x": 430.55,
            "y": 546,
            "width": 84.98,
            "height": 14
          }
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

- **Name:** {{parties.originator.legalName}}{{#if parties.originator.name != null}} (DBA {{parties.originator.name}}){{/if}}
- **Address:** {{fields.originatorAddress.line1}}{{#if fields.originatorAddress.line2 != null}}, {{fields.originatorAddress.line2}}{{/if}}, {{fields.originatorAddress.locality}}, {{fields.originatorAddress.region}} {{fields.originatorAddress.postalCode}}
- **Phone:** {{fields.originatorPhone}}
- **Email:** {{fields.originatorEmail}}

## Payer

- **Type:**
  - [{{#if fields.payerType == "individual"}}x{{else}} {{/if}}] Individual
  - [{{#if fields.payerType == "organization"}}x{{else}} {{/if}}] Organization
- **Name:** {{#if fields.payerType == "organization"}}{{parties.payer.legalName}}{{#if parties.payer.name != null}} (DBA {{parties.payer.name}}){{/if}}{{else}}{{parties.payer.name}}{{/if}}
- **Address:** {{fields.payerAddress.line1}}{{#if fields.payerAddress.line2 != null}}, {{fields.payerAddress.line2}}{{/if}}, {{fields.payerAddress.locality}}, {{fields.payerAddress.region}} {{fields.payerAddress.postalCode}}
- **Phone:** {{fields.payerPhone}}
- **Email:** {{fields.payerEmail}}

## Account

- **Bank:** {{fields.payerBankName}}
- **Routing/ABA #:** {{fields.payerRoutingNumber}}
- **Account #:** {{fields.payerAccountNumber}}
- **Account type:**
  - [{{#if fields.accountType == "checking"}}x{{else}} {{/if}}] Checking
  - [{{#if fields.accountType == "savings"}}x{{else}} {{/if}}] Savings
- **Name on account:** {{fields.nameOnAccount}}
- [{{#if fields.voidedCheckAttached}}x{{else}} {{/if}}] Voided check or deposit slip attached

## Payment

- **Mode:**
  - [{{#if fields.paymentMode == "one_time"}}x{{else}} {{/if}}] One-time
  - [{{#if fields.paymentMode == "recurring"}}x{{else}} {{/if}}] Recurring

{{#if fields.paymentMode == "one_time"}}
- **Amount:** \${{fields.amount.amount}} {{fields.amount.currency}}
- **Debit date:** {{fields.paymentDate}}
{{/if}}

{{#if fields.paymentMode == "recurring"}}
- **Amount mode:**
  - [{{#if fields.amountMode == "fixed"}}x{{else}} {{/if}}] Fixed amount: \${{fields.amount.amount}} {{fields.amount.currency}}
  - [{{#if fields.amountMode == "variable"}}x{{else}} {{/if}}] Variable amount: min \${{fields.amountRangeMin.amount}} – max \${{fields.amountRangeMax.amount}}, source: {{fields.amountSource}}
- **Frequency:**
  - [{{#if fields.frequency == "weekly"}}x{{else}} {{/if}}] Weekly
  - [{{#if fields.frequency == "bi_weekly"}}x{{else}} {{/if}}] Bi-weekly
  - [{{#if fields.frequency == "semi_monthly"}}x{{else}} {{/if}}] Semi-monthly
  - [{{#if fields.frequency == "monthly"}}x{{else}} {{/if}}] Monthly
  - [{{#if fields.frequency == "quarterly"}}x{{else}} {{/if}}] Quarterly
  - [{{#if fields.frequency == "annual"}}x{{else}} {{/if}}] Annual
  - [{{#if fields.frequency == "other"}}x{{else}} {{/if}}] Other
- **Draft day(s):**
{{#if fields.frequency == "monthly"}} day {{fields.dayOfMonth}} of each month{{/if}}
{{#if fields.frequency == "semi_monthly"}} days {{fields.semiMonthlyDay1}} and {{fields.semiMonthlyDay2}} of each month{{/if}}
{{#if fields.frequency == "weekly"}} every {{fields.dayOfWeek}}{{/if}}
{{#if fields.frequency == "bi_weekly"}} every other {{fields.dayOfWeek}} starting from start date{{/if}}
{{#if fields.frequency == "quarterly"}} {{fields.quarterMonth}} month of each quarter, day {{fields.quarterDay}}{{/if}}
{{#if fields.frequency == "annual"}} {{fields.annualMonth}} {{fields.annualDay}} each year{{/if}}
{{#if fields.frequency == "other"}} {{fields.frequencyOther}}{{/if}}
- **Start date:** {{fields.startDate}}
- **End condition:**
  - [{{#if fields.endCondition == "until_cancelled"}}x{{else}} {{/if}}] Until cancelled
  - [{{#if fields.endCondition == "end_date"}}x{{else}} {{/if}}] End date: {{fields.endDate}}
  - [{{#if fields.endCondition == "count"}}x{{else}} {{/if}}] After {{fields.debitCount}} debits
{{/if}}

- **Memo:** {{fields.paymentMemo}}
- **Reference #:** {{fields.referenceNumber}}

## Terms

1. This authorization remains in effect until I provide written notice of termination to the Originator.
2. Erroneous debits may be reversed by notifying the Financial Institution within statutory time limits.
3. Origination of these debits will comply with U.S. law and NACHA Operating Rules.
4. I represent that I am authorized to act with respect to the account identified above.

## Signature

**Signature:** {{signature(parties.payer, "payerSignature")}}
**Date:** {{signatureDate(parties.payer, "payerSignature")}}
**Printed name:** {{printedName(parties.payer, "payerPrintedName")}}
{{#if fields.payerType == "organization"}}
**Title (organization):** {{capacity(parties.payer, "payerCapacity")}}
{{/if}}
`;
const __c_ach_debit_authorization_pdf_b64 = "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtT2JsaXF1ZSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjMgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUgL0VuY29kaW5nIC9EaWZmZXJlbmNlcyBbMjQgL2JyZXZlIC9jYXJvbiAvY2lyY3VtZmxleCAvZG90YWNjZW50IC9odW5nYXJ1bWxhdXQgL29nb25layAvcmluZyAvdGlsZGUgMzkgL3F1b3Rlc2luZ2xlIDk2IC9ncmF2ZSAxMjggL2J1bGxldCAvZGFnZ2VyIC9kYWdnZXJkYmwgL2VsbGlwc2lzIC9lbWRhc2ggL2VuZGFzaCAvZmxvcmluIC9mcmFjdGlvbiAvZ3VpbHNpbmdsbGVmdCAvZ3VpbHNpbmdscmlnaHQgL21pbnVzIC9wZXJ0aG91c2FuZCAvcXVvdGVkYmxiYXNlIC9xdW90ZWRibGxlZnQgL3F1b3RlZGJscmlnaHQgL3F1b3RlbGVmdCAvcXVvdGVyaWdodCAvcXVvdGVzaW5nbGJhc2UgL3RyYWRlbWFyayAvZmkgL2ZsIC9Mc2xhc2ggL09FIC9TY2Fyb24gL1lkaWVyZXNpcyAvWmNhcm9uIC9kb3RsZXNzaSAvbHNsYXNoIC9vZSAvc2Nhcm9uIC96Y2Fyb24gMTYwIC9FdXJvIDE2NCAvY3VycmVuY3kgMTY2IC9icm9rZW5iYXIgMTY4IC9kaWVyZXNpcyAvY29weXJpZ2h0IC9vcmRmZW1pbmluZSAxNzIgL2xvZ2ljYWxub3QgLy5ub3RkZWYgL3JlZ2lzdGVyZWQgL21hY3JvbiAvZGVncmVlIC9wbHVzbWludXMgL3R3b3N1cGVyaW9yIC90aHJlZXN1cGVyaW9yIC9hY3V0ZSAvbXUgMTgzIC9wZXJpb2RjZW50ZXJlZCAvY2VkaWxsYSAvb25lc3VwZXJpb3IgL29yZG1hc2N1bGluZSAxODggL29uZXF1YXJ0ZXIgL29uZWhhbGYgL3RocmVlcXVhcnRlcnMgMTkyIC9BZ3JhdmUgL0FhY3V0ZSAvQWNpcmN1bWZsZXggL0F0aWxkZSAvQWRpZXJlc2lzIC9BcmluZyAvQUUgL0NjZWRpbGxhIC9FZ3JhdmUgL0VhY3V0ZSAvRWNpcmN1bWZsZXggL0VkaWVyZXNpcyAvSWdyYXZlIC9JYWN1dGUgL0ljaXJjdW1mbGV4IC9JZGllcmVzaXMgL0V0aCAvTnRpbGRlIC9PZ3JhdmUgL09hY3V0ZSAvT2NpcmN1bWZsZXggL090aWxkZSAvT2RpZXJlc2lzIC9tdWx0aXBseSAvT3NsYXNoIC9VZ3JhdmUgL1VhY3V0ZSAvVWNpcmN1bWZsZXggL1VkaWVyZXNpcyAvWWFjdXRlIC9UaG9ybiAvZ2VybWFuZGJscyAvYWdyYXZlIC9hYWN1dGUgL2FjaXJjdW1mbGV4IC9hdGlsZGUgL2FkaWVyZXNpcyAvYXJpbmcgL2FlIC9jY2VkaWxsYSAvZWdyYXZlIC9lYWN1dGUgL2VjaXJjdW1mbGV4IC9lZGllcmVzaXMgL2lncmF2ZSAvaWFjdXRlIC9pY2lyY3VtZmxleCAvaWRpZXJlc2lzIC9ldGggL250aWxkZSAvb2dyYXZlIC9vYWN1dGUgL29jaXJjdW1mbGV4IC9vdGlsZGUgL29kaWVyZXNpcyAvZGl2aWRlIC9vc2xhc2ggL3VncmF2ZSAvdWFjdXRlIC91Y2lyY3VtZmxleCAvdWRpZXJlc2lzIC95YWN1dGUgL3Rob3JuIC95ZGllcmVzaXNdPj4KZW5kb2JqCjYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNyAwIG9iago8PAovQkJveCBbIDAgMCAxODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMLQAYiOFolSucK48oEg6ELtzBXK5+jpzAQDJfAjFZW5kc3RyZWFtCmVuZG9iago4IDAgb2JqCjw8Ci9BUCA8PAovTiA3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA4Mi41MDUgNjYwIDI2Mi41MDUgNjcyIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvck5hbWUpIC9UVSAoTmFtZSkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyOS40OTUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMDKy1DOxNFUwNFIoSuUK58oDiqYDsTtXIJerrzMXAO9rCZllbmRzdHJlYW0KZW5kb2JqCjExIDAgb2JqCjw8Ci9BUCA8PAovTiAxMCAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMzE2LjAxOSA2NjAgNTQ1LjUxNCA2NzIgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmlnaW5hdG9yQWRkcmVzc0xpbmUxKSAvVFUgKEFkZHJlc3MpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTIgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTMgMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEyIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwULAwUDA0UihK5QrnygMKpAOxO1cgl6uvMxcAwO0IlGVuZHN0cmVhbQplbmRvYmoKMTQgMCBvYmoKPDwKL0FQIDw8Ci9OIDEzIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA3NCA2NDIgMTU0IDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JDaXR5KSAvVFUgKENpdHkpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTYgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDE1IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDAyVTA0UihK5QrnygMKpAOxO1cgl6uvMxcAwM0Ik2VuZHN0cmVhbQplbmRvYmoKMTcgMCBvYmoKPDwKL0FQIDw8Ci9OIDE2IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAxODcuNTE3IDY0MiAyMTIuNTE3IDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JTdGF0ZSkgL1RVIChTdGF0ZSkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxOSAwIG9iago8PAovQkJveCBbIDAgMCA1MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMDVQMDRSKErlCufKAwqkA7E7VyCXq68zFwDAnAiRZW5kc3RyZWFtCmVuZG9iagoyMCAwIG9iago8PAovQVAgPDwKL04gMTkgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDIzNy41MiA2NDIgMjg3LjUyIDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JaaXApIC9UVSAoWmlwKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjIxIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjIyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAyMSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFCwMFAwNFIoSuUK58oDCqQDsTtXIJerrzMXAMDtCJRlbmRzdHJlYW0KZW5kb2JqCjIzIDAgb2JqCjw8Ci9BUCA8PAovTiAyMiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMzI2LjA0MSA2NDIgNDA2LjA0MSA2NTQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmlnaW5hdG9yUGhvbmUpIC9UVSAoUGhvbmUpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMjQgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGlu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PDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMTcyLjI1NiA2MjAgMTgxLjI1NiA2MjkgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllclR5cGVfb3JnYW5pemF0aW9uKSAKICAvVFUgKE9yZ2FuaXphdGlvbiBcKG9yZ2FuaXphdGlvblwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMzUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMzYgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAzNSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwtABiI4WiVK5wrjygSDoQu3MFcrn6OnMBAMl8CMVlbmRzdHJlYW0KZW5kb2JqCjM3IDAgb2JqCjw8Ci9BUCA8PAovTiAzNiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgODIuNTA1IDU5NiAyNjIuNTA1IDYwOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVyTmFtZSkgL1RVIChOYW1lKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjM4IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjM5IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyOS40OTUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDM4IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDAystQzsTRVMDRSKErlCufKA4qmA7E7VyCXq68zFwDvawmZZW5kc3RyZWFtCmVuZG9iago0MCAwIG9iago8PAovQVAgPDwKL04gMzkgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDMxNi4wMTkgNTk2IDU0NS41MTQgNjA4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJBZGRyZXNzTGluZTEpIC9UVSAoQWRkcmVzcykgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago0MSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago0MiAwIG9iago8PAovQkJveCBbIDAgMCA4MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNDEgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQsDBQMDRSKErlCufKAwqkA7E7VyCXq68zFwDA7QiUZW5kc3RyZWFtCmVuZG9iago0MyAwIG9iago8PAovQVAgPDwKL04gNDIgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDc0IDU3OCAxNTQgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJDaXR5KSAvVFUgKENpdHkpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNDQgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDUgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQ0IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDAyVTA0UihK5QrnygMKpAOxO1cgl6uvMxcAwM0Ik2VuZHN0cmVhbQplbmRvYmoKNDYgMCBvYmoKPDwKL0FQIDw8Ci9OIDQ1IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAxODcuNTE3IDU3OCAyMTIuNTE3IDU5MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVyU3RhdGUpIC9UVSAoU3RhdGUpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNDcgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDggMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQ3IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDA1UDA0UihK5QrnygMKpAOxO1cgl6uvMxcAwJwIkWVuZHN0cmVhbQplbmRvYmoKNDkgMCBvYmoKPDwKL0FQIDw8Ci9OIDQ4IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAyMzcuNTIgNTc4IDI4Ny41MiA1OTAgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllclppcCkgL1RVIChaaXApIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNTAgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNTEgMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDUwIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwULAwUDA0UihK5QrnygMKpAOxO1cgl6uvMxcAwO0IlGVuZHN0cmVhbQplbmRvYmoKNTIgMCBvYmoKPDwKL0FQIDw8Ci9OIDUxIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAzMjYuMDQxIDU3OCA0MDYuMDQxIDU5MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVyUGhvbmUpIC9UVSAoUGhvbmUpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNTMgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNTQgMCBvYmoKPDwKL0JCb3ggWyAwIDAgOTMuOTU5IDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNTEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1MyAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFCwNNazNLVUMDRSKErlCufKAwqmA7E7VyCXq68zFwDmpQltZW5kc3RyZWFtCmVuZG9iago1NSAwIG9iago8PAovQVAgPDwKL04gNTQgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDQ0MS4wNDMgNTc4IDUzNS4wMDIgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJFbWFpbCkgL1RVIChFbWFpbCkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago1NiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago1NyAwIG9iago8PAovQkJveCBbIDAgMCAxMzAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDU2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDA0BmIjhaJUrnCuPKBIOhC7cwVyufo6cwEAyPUIwGVuZHN0cmVhbQplbmRvYmoKNTggMCBvYmoKPDwKL0FQIDw8Ci9OIDU3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA3OS4wMTMgNTM0IDIwOS4wMTMgNTQ2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJCYW5rTmFtZSkgL1RVIChCYW5rKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjU5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjYwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDkwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1OSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFCwNFAwNFIoSuUK58oDCqQDsTtXIJerrzMXAMEICJVlbmRzdHJlYW0KZW5kb2JqCjYxIDAgb2JqCjw8Ci9BUCA8PAovTiA2MCAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMjY0LjAzNSA1MzQgMzU0LjAzNSA1NDYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllclJvdXRpbmdOdW1iZXIpIC9UVSAoUm91dGluZyAjKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjYyIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjYzIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEzMS45NjUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1NiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDYyIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDA0NtSzNDOxhANzBUMjhaJUrnCuPKCCdCB25wrkcvV15gIAbPYMA2VuZHN0cmVhbQplbmRvYmoKNjQgMCBvYmoKPDwKL0FQIDw8Ci9OIDYzIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA0MTAuNTYgNTM0IDU0Mi41MjUgNTQ2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZXJBY2NvdW50TnVtYmVyKSAvVFUgKEFjY291bnQgIykgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago2NSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgNTQgNTE2IDYzIDUyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnRUeXBlX2NoZWNraW5nKSAKICAvVFUgKENoZWNraW5nIFwoY2hlY2tpbmdcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjY2IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAxMjAuNTEyIDUxNiAxMjkuNTEyIDUyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnRUeXBlX3NhdmluZ3MpIAogIC9UVSAoU2F2aW5ncyBcKHNhdmluZ3NcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjY3IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjY4IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEzMCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNjcgMCBSPj4gPj4g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IDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREZdID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nCvk0jO0VIDhIHcFAz1ThXIgaWQKISz1ILgoVaGYKxAA4EsJrmVuZHN0cmVhbQplbmRvYmoKNzYgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgNzMgMCBSIC9ZZXMgNzIgMCBSCj4+IC9OIDw8Ci9PZmYgNzEgMCBSIC9ZZXMgNzAgMCBSCj4+IC9SIDw8Ci9PZmYgNzUgMCBSIC9ZZXMgNzQgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAoNCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDQwNi41NiA1MTUgNDE2LjU2IDUyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHZvaWRlZENoZWNrQXR0YWNoZWQpIAogIC9UVSAoVm9pZGVkIGNoZWNrIGF0dGFjaGVkKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNzcgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDU0IDQ3MiA2MyA0ODEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXltZW50TW9kZV9vbmV0aW1lKSAKICAvVFUgKE9uZS10aW1lIFwob25lX3RpbWVcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjc4IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAxMjAuMDA4IDQ3MiAxMjkuMDA4IDQ4MSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheW1lbnRNb2RlX3JlY3VycmluZykgCiAgL1RVIChSZWN1cnJpbmcgXChyZWN1cnJpbmdcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjc5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjgwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA3OSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFCwMFAwNFIoSuUK58oDCqQDsTtXIJerrzMXAMDtCJRlbmRzdHJlYW0KZW5kb2JqCjgxIDAgb2JqCjw8Ci9BUCA8PAovTiA4MCAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMTU0LjUyIDQ1NCAyMzQuNTIgNDY2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob25lVGltZUFtb3VudCkgL1RVIChBbW91bnQgJCkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago4MiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago4MyAwIG9iago8PAovQkJveCBbIDAgMCA5MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgODIgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQsDRQMDRSKErlCufKAwqkA7E7VyCXq68zFwDBCAiVZW5kc3RyZWFtCmVuZG9iago4NCAwIG9iago8PAovQVAgPDwKL04gODMgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDI5Mi4wNDQgNDU0IDM4Mi4wNDQgNDY2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5bWVudERhdGUpIC9UVSAoRGViaXQgZGF0ZSkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago4NSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMTE0IDQzNiAxMjMgNDQ1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYW1vdW50TW9kZV9maXhlZCkgCiAgL1RVIChGaXhlZCAkIFwoZml4ZWRcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjg2IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjg3IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDYwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA4NiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwM1AwNFIoSuUK58oDCqQDsTtXIJerrzMXAMC3CJJlbmRzdHJlYW0KZW5kb2JqCjg4IDAgb2JqCjw8Ci9BUCA8PAovTiA4NyAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjQgMCBSIC9SZWN0IFsgMTY0LjUxMSA0MzYgMjI0LjUxMSA0NDggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChyZWN1cnJpbmdGaXhlZEFtb3VudCkgL1RVIChyZWN1cnJpbmdGaXhlZEFtb3VudCkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago4OSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMjM2LjUxMSA0MzYgMjQ1LjUxMSA0NDUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhbW91bnRNb2RlX3ZhcmlhYmxlKSAKICAvVFUgKFZhcmlhYmxlOiBtaW4gJCBcKHZhcmlhYmxlXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago5MCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago5MSAwIG9iago8PAovQkJveCBbIDAgMCA1MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgOTAgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMDVQMDRSKErlCufKAwqkA7E7VyCXq68zFwDAnAiRZW5kc3RyZWFtCmVuZG9iago5MiAwIG9iago8PAovQVAgPDwKL04gOTEgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDMxNy41MzIgNDM2IDM2Ny41MzIgNDQ4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYW1vdW50UmFuZ2VNaW4pIC9UVSAoYW1vdW50UmFuZ2VNaW4pIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKOTMgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKOTQgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkzIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDA1UDA0UihK5QrnygMKpAOxO1cgl6uvMxcAwJwIkWVuZHN0cmVhbQplbmRvYmoKOTUgMCBvYmoKPDwKL0FQIDw8Ci9OIDk0IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA0MDIuMDM5IDQzNiA0NTIuMDM5IDQ0OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFtb3VudFJhbmdlTWF4KSAvVFUgKG1heCAkKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjk2IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjk3IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDQwMi40NTggMjIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1NiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDk2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDAxMNIzMTW3hANzBSMjhaJUrnCuPKCCdCB25wrkcvV15gIAbMAMAmVuZHN0cmVhbQplbmRvYmoKOTggMCBvYmoKPDwKL0FQIDw8Ci9OIDk3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiA0MDk2IAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAxNTUuNTQyIDQwOCA1NTggNDMwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYW1vdW50U291cmNlKSAvVFUgKFZhcmlhYmxlIGFtb3VudCBzb3VyY2UpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKOTkgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDExNCAzODggMTIzIDM5NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV93ZWVrbHkpIAogIC9UVSAoV2Vla2x5IFwod2Vla2x5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDAgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDE2NC41MDIgMzg4IDE3My41MDIgMzk3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZnJlcXVlbmN5X2Jpd2Vla2x5KSAKICAvVFUgKEJpLXdrbHkgXChiaV93ZWVrbHlcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwMSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMjEzLjk5NiAzODggMjIyLjk5NiAzOTcgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChmcmVxdWVuY3lfc2VtaW1vbnRobHkpIAogIC9UVSAoU2VtaS1tbyBcKHNlbWlfbW9udGhseVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTAyIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAyNzAuOTk2IDM4OCAyNzkuOTk2IDM5NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV9tb250aGx5KSAKICAvVFUgKE1vbnRobHkgXChtb250aGx5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDMgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDMyMy41MDUgMzg4IDMzMi41MDUgMzk3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZnJlcXVlbmN5X3F1YXJ0ZXJseSkgCiAgL1RVIChRdHIgXChxdWFydGVybHlcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwNCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjQgMCBSIC9SZWN0IFsgMzU3LjAwNiAzODggMzY2LjAwNiAzOTcgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChmcmVxdWVuY3lfYW5udWFsKSAKICAvVFUgKEFubnVhbCBcKGFubnVhbFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTA1IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyA0MDYuMDIzIDM4OCA0MTUuMDIzIDM5NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV9vdGhlcikgCiAgL1RVIChPdGhlciBcKG90aGVyXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTA3IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIzNi40OTEgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1NSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEwNiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwMjbTM7E0sEQABUMjhaJUrnCuPKCCdCB25wrkcvV15gIAbT0MBWVuZHN0cmVhbQplbmRvYmoKMTA4IDAgb2JqCjw8Ci9BUCA8PAovTiAxMDcgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI0IDAgUiAvUmVjdCBbIDI5NS4wMzUgMzY4IDUzMS41MjYgMzgwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoc3RhcnREYXRlKSAvVFUgKFN0YXJ0IGRhdGUpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTA5IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyA4MiAzNDggOTEgMzU3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZW5kQ29uZGl0aW9uX3VudGlsY2FuY2VsbGVkKSAKICAvVFUgKFVudGlsIGNhbmNlbGxlZCBcKHVudGlsX2NhbmNlbGxlZFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTEwIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNCAwIFIgL1JlY3QgWyAxNjkuNTE4IDM0OCAxNzguNTE4IDM1NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVuZENvbmRpdGlvbl9lbmRkYXRlKSAKICAvVFUgKEVuZCBkYXRlIFwoZW5kX2RhdGVcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjExMSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMTIgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNzAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDExMSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwN1AwNFIoSuUK58oDCqQDsTtXIJerrzMXAMDSCJNlbmRzdHJlYW0KZW5kb2JqCjExMyAwIG9iago8PAovQVAgPDwKL04gMTEyIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAyMjYuNTQ1IDM0OCAyOTYuNTQ1IDM2MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVuZERhdGUpIC9UVSAoZW5kRGF0ZSkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMTQgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI0IDAgUiAvUmVjdCBbIDMxMi41NDUgMzQ4IDMyMS41NDUgMzU3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZW5kQ29uZGl0aW9uX2NvdW50KSAKICAvVFUgKENvdW50IFwoY291bnRcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjExNSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMTYgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDExNSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwNVAwNFIoSuUK58oDCqQDsTtXIJerrzMXAMCcCJFlbmRzdHJlYW0KZW5kb2JqCjExNyAwIG9iago8PAovQVAgPDwKL04gMTE2IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAzNTcuNTU3IDM0OCA0MDcuNTU3IDM2MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGRlYml0Q291bnQpIC9UVSAoZGViaXRDb3VudCkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMTggMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTE5IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDI0MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ4IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTE4IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDAyMVAwNFIoSuUK58oDiqQDsTtXIJerrzMXAMksCMJlbmRzdHJlYW0KZW5kb2JqCjEyMCAwIG9iago8PAovQVAgPDwKL04gMTE5IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyA4My41MDQgMzI4IDMyMy41MDQgMzQwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5bWVudE1lbW8pIC9UVSAoTWVtbykgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMjEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTIyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEzOC40OTYgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1NiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEyMSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwNLbQM7E0tYQDCwVDI4WiVK5wrjyggnQgducK5HL1deYCAG4DDAplbmRzdHJlYW0KZW5kb2JqCjEyMyAwIG9iago8PAovQVAgPDwKL04gMTIyIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNCAwIFIgL1JlY3QgWyAzOTMuMDI5IDMyOCA1MzEuNTI1IDM0MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHJlZmVyZW5jZU51bWJlcikgL1RVIChSZWZlcmVuY2UgIykgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMjQgMCBvYmoKPDwKL0Fubm90cyBbIDggMCBSIDExIDAgUiAxNCAwIFIgMTcgMCBSIDIwIDAgUiAyMyAwIFIgMjYgMCBSIDMzIDAgUiAzNCAwIFIgMzcgMCBSIAogIDQwIDAgUiA0MyAwIFIgNDYgMCBSIDQ5IDAgUiA1MiAwIFIgNTUgMCBSIDU4IDAgUiA2MSAwIFIgNjQgMCBSIDY1IDAgUiAKICA2NiAwIFIgNjkgMCBSIDc2IDAgUiA3NyAwIFIgNzggMCBSIDgxIDAgUiA4NCAwIFIgODUgMCBSIDg4IDAgUiA4OSAwIFIgCiAgOTIgMCBSIDk1IDAgUiA5OCAwIFIgOTkgMCBSIDEwMCAwIFIgMTAxIDAgUiAxMDIgMCBSIDEwMyAwIFIgMTA0IDAgUiAxMDUgMCBSIAogIDEwOCAwIFIgMTA5IDAgUiAxMTAgMCBSIDExMyAwIFIgMTE0IDAgUiAxMTcgMCBSIDEyMCAwIFIgMTIzIDAgUiBdIC9Db250ZW50cyAxMjggMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCAxMjcgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIAogIC9UcmFucyA8PAoKPj4gL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjEyNSAwIG9iago8PAovQWNyb0Zvcm0gMTI5IDAgUiAvUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDEyNyAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjEyNiAwIG9iago8PAovQXV0aG9yIChhbm9ueW1vdXMpIC9DcmVhdGlvbkRhdGUgKEQ6MjAwMDAxMDEwMDAwMDArMDAnMDAnKSAvQ3JlYXRvciAoYW5vbnltb3VzKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAwMDAxMDEwMDAwMDArMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAodW5zcGVjaWZpZWQpIC9UaXRsZSAodW50aXRsZWQpIC9UcmFwcGVkIC9GYWxzZQo+PgplbmRvYmoKMTI3IDAgb2JqCjw8Ci9Db3VudCAxIC9LaWRzIFsgMTI0IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKMTI4IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDE5NzIKPj4Kc3RyZWFtCkdhdCUkZ01ZZSkmOk86UyY4MytDImVwbDU/MVIsOzBsIUFAZ1hvKUtfQ3RPNmY/NlhYPmAhNi9xdDF0OSxkI1woUVU5VXE+XFZLTyttMDhoYCRnPWhmX3JSZCZjLUkrSVE+RlMnNkxvV1FtRS9IcytXXkNUPUViYnI4TjFPUCUrPjAjNypYdTY+OyFrIVsjcytFSS49L3FDJDlJNilScW5CajEyJTBXTk49ZElmYGZxV0BtRFU7Q0IqOGJPLDo7azEoXlRLRmVHajk2LnM4ZzpVKGtkIjM0OGRqK1Q4O2daU2QmakM8N3E8TzZabmI1ak02JUxEa0NxRV88Ty9yTFhmWVxYUyNuUz5YbCtuOlg1NWx0RjpiMEE/LkByR0s6Slg6K083SURRVF1rUFVXNCY4NT4razUzJXMmY0tzIjFmPDBuKFZTWE5Ea1E9NVJKKTheYTgmJ1EjNDVuXWMwcHJcMlBDYExEK09MdGk3VCZrKCVDMVohayY1Y1IkJ1VPQi0xUy9SMEFoX243KGouKjpiM1VHbEVyLSJARTZTOFoqJixbWko6KHA5YEAlPHVPYjo4a15hR0tYVVdALW5Cc0AoaEojaUdRKC4qUytvSF9DMEx1XXRwMnQuTjJDYDVHTyQ3Mm5kJGpSUTZOaFxRUCMrRzYkVCcnJCg8Jk1NMChsJUttaThLbkpCbUw/OTBqVG1qN2o8LUkiXElYSFFOVEU+L2lQQnFAX21LMD9LZFojOm9nXnMlVFdCZTkjMjFYWk45M29dYkM2cnFLKzlqSCdxL05QYUMncDZMQUhYNkA1JFkkTUAqKzZLPUpNLiFeKStUZmF1WzZMQF5hNkA3ZCckTUYyLTZLOihQTCVbWDQuUSE1JF9kSmNzSFx1Oz9vZG1kQ2ooV2ducCxwQTBsP1JdMDUyZU1yOl8haE8zVFlKJThXQGNjbyw+IzRuWDJlVUtEbSJjcFNnaDkrXVpAJEM7RUomTmFjJy8jN0psS1Y6Y2NgbidGai9DUyZAYV9LVlQwbm81QWE3QytPSW5HVUl0akMvKWlGNl1fYUstVmRiVyV1RyRsdChYU09qITIpZF8pU0wuPldLXytCUlAnK00qdStaMU1BX1opWEtlcFlGNyonNVc8QFtkO0BdKGRxc3RuUF40ZV4sPTh0WGpHTE5PK100aFNsUldkMTAxXTBqL00sSkMhQjZfZGI2bFIwK1o4KVknSSMuNC82T05IWy9NJkE6J0NrRWstJkFNKylscSxJWTtrZmo6YWdARCFdTms7ZSxHODRfcHRBYjJDSk9wazY+RWxWRGMrRVNHZzhzRW9EXnNpKCJeaFVJVVBFSjBXQHRCTFFqKFJAMzJDNWBvVmtpXW1GbG8yKj1DKDNVbjZHcEIqLjBRZ2hYOV9JcEQ9LTZCZE1iRlxnRHJkVVkqWz5wVkBbJzcnIjdDLS9ZSiRsJ1tRMCUoZD8mZHVJPXJMUjFjW2ZmNGo/UU1EM2A3NGlzXlYldV40TS5taUAoYHU4cSlbc1hHUEdwZ2EtWltnVGdaO3QkXzgvIUI/XlhuOm4yJkVUK2NuPV1OM3IpNWtINForLyttcEE1Sl9aJV5TTGQ2bUgwaSJZU09JWHBDSkZyXT5xSCEiP01fWnFTPTY1OSVOOTVoOTxiYmtTJnA0KWY3SmhyTGJ1ZzRgLThNVmVQPklrOiUrbmQ+KFomazhqVUdJP0tpQSFUTU9Eaj8rZis3VihCTkBrNi09XEYiL0xoOUZdUmdlL2diZExsc25qJTc5Z1YjRUBhKC4vbm9eL0BcOUNLTlw6VmROLSYpLllXWigwWE1JUls8KF0rKUpdLFVGTlZiSDc+b1txJlkhXCQqaElWZl88OVA0Iz5XYmJkLCdZSzFRK25wbTVrZWImSit1a1FwJk4/XnIsbmNrLVBsKnE9WDM0aipCY2RbcV0mOz5fPnErQWMzIjtvX2RMJ2lZIXAtKG5jZzdFLy1IP3I7WWJBaEA0OE1LNiFVVkJwPUpuPjBkaC5FTitSK0BgaVo6SWJOLS4sUlZPL0ZYKiZDZkVASyJoSjIqPCxzckhrbWtPaS4rYDdGMWhjMlFuLGhGVGJsYj48a2NuLi04PCVfJCdSOD81T2NhS3RuKkktKFwvJCdmbklmck0rTWRaTEQ1IzlqW1trMCdscWY5V2taLmNESzU8VnJEN0ZZS2xlU21SREQpJ1hAa0lpK0VYaWUwVzxCYC80LzokTlxhWlFBIzJKXCpPTHRgJUcwJ0IjVyk+TFc+JlBnNmUsKmRtW2gzRmUtW1dsVDw8XFAkbE1HPlpZZ0QiXy5SQj5FNmluKHBxPU8lKjtmbTo8Pk4mPU0/YWM1QVlSRm5tK0lyPEVZUl0tLDVEM0pTNW87OWZvbHFSalo0ZVdvZWY/SWZoOmo2I3E2IWBRMkBvQjM/MGVicy1LMV1pOSY3PCdDdGtvaj1RWV1dIj9vT2NDNiwuMmU6cUd1L05oUyhrcVluUWsjcmQkX200N3IvUSJqUD5wJEdTIyxYZGFoXVE+OXI9UzdJOmpaZkpIX100czw8TlwqR0hEO0c5L2hjQG4nXDdoVUk7TVpncTRKWCcscD8oXFNFOGxHJyo6Pj9ENDE+fj5lbmRzdHJlYW0KZW5kb2JqCjEyOSAwIG9iago8PAovREEgKC9IZWx2IDAgVGYgMCBnKSAvRFIgPDwgL0VuY29kaW5nCjw8Ci9STEFGZW5jb2RpbmcKNSAwIFIKPj4KL0ZvbnQgPDwgL0hlbHYgNiAwIFIgPj4KPj4gL0ZpZWxkcyBbIDggMCBSIDExIDAgUiAxNCAwIFIgMTcgMCBSIDIwIDAgUiAyMyAwIFIgMjYgMCBSIDMzIDAgUiAzNCAwIFIgMzcgMCBSIAogIDQwIDAgUiA0MyAwIFIgNDYgMCBSIDQ5IDAgUiA1MiAwIFIgNTUgMCBSIDU4IDAgUiA2MSAwIFIgNjQgMCBSIDY1IDAgUiAKICA2NiAwIFIgNjkgMCBSIDc2IDAgUiA3NyAwIFIgNzggMCBSIDgxIDAgUiA4NCAwIFIgODUgMCBSIDg4IDAgUiA4OSAwIFIgCiAgOTIgMCBSIDk1IDAgUiA5OCAwIFIgOTkgMCBSIDEwMCAwIFIgMTAxIDAgUiAxMDIgMCBSIDEwMyAwIFIgMTA0IDAgUiAxMDUgMCBSIAogIDEwOCAwIFIgMTA5IDAgUiAxMTAgMCBSIDExMyAwIFIgMTE0IDAgUiAxMTcgMCBSIDEyMCAwIFIgMTIzIDAgUiBdCj4+CmVuZG9iagp4cmVmCjAgMTMwCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMTEyIDAwMDAwIG4gCjAwMDAwMDAyMTkgMDAwMDAgbiAKMDAwMDAwMDMzMSAwMDAwMCBuIAowMDAwMDAwNDQ2IDAwMDAwIG4gCjAwMDAwMDE3NjggMDAwMDAgbiAKMDAwMDAwMTg2NiAwMDAwMCBuIAowMDAwMDAyMTM4IDAwMDAwIG4gCjAwMDAwMDIzNTQgMDAwMDAgbiAKMDAwMDAwMjQ1MiAwMDAwMCBuIAowMDAwMDAyNzM0IDAwMDAwIG4gCjAwMDAwMDI5NjQgMDAwMDAgbiAKMDAwMDAwMzA2MyAwMDAwMCBuIAowMDAwMDAzMzM2IDAwMDAwIG4gCjAwMDAwMDM1NDYgMDAwMDAgbiAKMDAwMDAwMzY0NSAwMDAwMCBuIAowMDAwMDAzOTE4IDAwMDAwIG4gCjAwMDAwMDQxMzkgMDAwMDAgbiAKMDAwMDAwNDIzOCAwMDAwMCBuIAowMDAwMDA0NTExIDAwMDAwIG4gCjAwMDAwMDQ3MjYgMDAwMDAgbiAKMDAwMDAwNDgyNSAwMDAwMCBuIAowMDAwMDA1MDk4IDAwMDAwIG4gCjAwMDAwMDUzMTkgMDAwMDAgbiAKMDAwMDAwNTQxOCAwMDAwMCBuIAowMDAwMDA1Njk5IDAwMDAwIG4gCjAwMDAwMDU5MjAgMDAwMDAgbiAKMDAwMDAwNjI2MiAwMDAwMCBuIAowMDAwMDA2NDk0IDAwMDAwIG4gCjAwMDAwMDY4MzYgMDAwMDAgbiAKMDAwMDAwNzA2OSAwMDAwMCBuIAowMDAwMDA3NDExIDAwMDAwIG4gCjAwMDAwMDc2NDQgMDAwMDAgbiAKMDAwMDAwODAxMiAwMDAwMCBuIAowMDAwMDA4Mzg4IDAwMDAwIG4gCjAwMDAwMDg0ODcgMDAwMDAgbiAKMDAwMDAwODc2MSAwMDAwMCBuIAowMDAwMDA4OTc0IDAwMDAwIG4gCjAwMDAwMDkwNzMgMDAwMDAgbiAKMDAwMDAwOTM1NiAwMDAwMCBuIAowMDAwMDA5NTgxIDAwMDAwIG4gCjAwMDAwMDk2ODAgMDAwMDAgbiAKMDAwMDAwOTk1MyAwMDAwMCBuIAowMDAwMDEwMTU4IDAwMDAwIG4gCjAwMDAwMTAyNTcgMDAwMDAgbiAKMDAwMDAxMDUzMCAwMDAwMCBuIAowMDAwMDEwNzQ2IDAwMDAwIG4gCjAwMDAwMTA4NDUgMDAwMDAgbiAKMDAwMDAxMTExOCAwMDAwMCBuIAowMDAwMDExMzI4IDAwMDAwIG4gCjAwMDAwMTE0MjcgMDAwMDAgbiAKMDAwMDAxMTcwMCAwMDAwMCBuIAowMDAwMDExOTE2IDAwMDAwIG4gCjAwMDAwMTIwMTUgMDAwMDAgbiAKMDAwMDAxMjI5NiAwMDAwMCBuIAowMDAwMDEyNTEyIDAwMDAwIG4gCjAwMDAwMTI2MTEgMDAwMDAgbiAKMDAwMDAxMjg4NSAwMDAwMCBuIAowMDAwMDEzMTAyIDAwMDAwIG4gCjAwMDAwMTMyMDEgMDAwMDAgbiAKMDAwMDAxMzQ3NCAwMDAwMCBuIAowMDAwMDEzNzAyIDAwMDAwIG4gCjAwMDAwMTM4MDEgMDAwMDAgbiAKMDAwMDAxNDA4OCAwMDAwMCBuIAowMDAwMDE0MzE1IDAwMDAwIG4gCjAwMDAwMTQ2NzEgMDAwMDAgbiAKMDAwMDAxNTAzNCAwMDAwMCBuIAowMDAwMDE1MTMzIDAwMDAwIG4gCjAwMDAwMTU0MDcgMDAwMDAgbiAKMDAwMDAxNTYzNCAwMDAwMCBuIAowMDAwMDE2MjM2IDAwMDAwIG4gCjAwMDAwMTY0NzAgMDAwMDAgbiAKMDAwMDAxNzA3MiAwMDAwMCBuIAowMDAwMDE3MzA3IDAwMDAwIG4gCjAwMDAwMTc5MDkgMDAwMDAgbiAKMDAwMDAxODE0NCAwMDAwMCBuIAowMDAwMDE4NTA3IDAwMDAwIG4gCjAwMDAwMTg4NjIgMDAwMDAgbiAKMDAwMDAxOTIzMSAwMDAwMCBuIAowMDAwMDE5MzMwIDAwMDAwIG4gCjAwMDAwMTk2MDMgMDAwMDAgbiAKMDAwMDAxOTgyMyAwMDAwMCBuIAowMDAwMDE5OTIyIDAwMDAwIG4gCjAwMDAwMjAxOTUgMDAwMDAgbiAKMDAwMDAyMDQxNyAwMDAwMCBuIAowMDAwMDIwNzY3IDAwMDAwIG4gCjAwMDAwMjA4NjYgMDAwMDAgbiAKMDAwMDAyMTEzOSAwMDAwMCBuIAowMDAwMDIxMzgwIDAwMDAwIG4gCjAwMDAwMjE3NTIgMDAwMDAgbiAKMDAwMDAyMTg1MSAwMDAwMCBuIAowMDAwMDIyMTI0IDAwMDAwIG4gCjAwMDAwMjIzNTMgMDAwMDAgbiAKMDAwMDAyMjQ1MiAwMDAwMCBuIAowMDAwMDIyNzI1IDAwMDAwIG4gCjAwMDAwMjI5NDUgMDAwMDAgbiAKMDAwMDAyMzA0NCAwMDAwMCBuIAowMDAwMDIzMzMxIDAwMDAwIG4gCjAwMDAwMjM1NjUgMDAwMDAgbiAKMDAwMDAyMzkxNSAwMDAwMCBuIAowMDAwMDI0MjgwIDAwMDAwIG4gCjAwMDAwMjQ2NTEgMDAwMDAgbiAKMDAwMDAyNTAxMyAwMDAwMCBuIAowMDAwMDI1Mzc1IDAwMDAwIG4gCjAwMDAwMjU3MzQgMDAwMDAgbiAKMDAwMDAyNjA5MCAwMDAwMCBuIAowMDAwMDI2MTkwIDAwMDAwIG4gCjAwMDAwMjY0NzggMDAwMDAgbiAKMDAwMDAyNjcwMCAwMDAwMCBuIAowMDAwMDI3MDc4IDAwMDAwIG4gCjAwMDAwMjc0NDUgMDAwMDAgbiAKMDAwMDAyNzU0NSAwMDAwMCBuIAowMDAwMDI3ODIwIDAwMDAwIG4gCjAwMDAwMjgwMzcgMDAwMDAgbiAKMDAwMDAyODM5NiAwMDAwMCBuIAowMDAwMDI4NDk2IDAwMDAwIG4gCjAwMDAwMjg3NzEgMDAwMDAgbiAKMDAwMDAyODk5NCAwMDAwMCBuIAowMDAwMDI5MDk0IDAwMDAwIG4gCjAwMDAwMjkzNzEgMDAwMDAgbiAKMDAwMDAyOTU4OCAwMDAwMCBuIAowMDAwMDI5Njg4IDAwMDAwIG4gCjAwMDAwMjk5NzcgMDAwMDAgbiAKMDAwMDAzMDIwNiAwMDAwMCBuIAowMDAwMDMwNzc4IDAwMDAwIG4gCjAwMDAwMzA4NjggMDAwMDAgbiAKMDAwMDAzMTEzMSAwMDAwMCBuIAowMDAwMDMxMTk0IDAwMDAwIG4gCjAwMDAwMzMyNTkgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8MWMxNzgxOThmYmRmYTUxYjI1OTk1ZDg5ZDQxMDIwNDM+PDFjMTc4MTk4ZmJkZmE1MWIyNTk5NWQ4OWQ0MTAyMDQzPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyAxMjYgMCBSCi9Sb290IDEyNSAwIFIKL1NpemUgMTMwCj4+CnN0YXJ0eHJlZgozMzc0NgolJUVPRgo=";
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

const resolver = createMemoryResolver({ contents });

/**
 * ACH Debit Authorization
 *
 * Authorization by which a payer (consumer or business) authorizes a named originator to initiate ACH debit entries against a deposit account at a named financial institution. Supports one-time and recurring debits, fixed or variable amounts, and is governed by NACHA Operating Rules and (for consumers) Regulation E.
 */
export const achDebitAuthorization = Object.assign(p.form(schema, { resolver }), {
  /** The raw form spec, exactly as authored in artifacts/banking/ach-debit-authorization/. */
  spec: schema,
});

export default achDebitAuthorization;
