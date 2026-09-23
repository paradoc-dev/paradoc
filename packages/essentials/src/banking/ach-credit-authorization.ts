// AUTO-GENERATED from artifacts/banking/ach-credit-authorization/design/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-credit-authorization

import { p } from "@paradoc/core";
import { createMemoryResolver } from "@paradoc/resolvers/memory";

const schema = {
  "$schema": "https://schema.paradoc.dev/2026-09-22.json",
  "kind": "form",
  "name": "ach-credit-authorization",
  "version": "1.0.0",
  "title": "ACH Credit Authorization",
  "description": "Authorization by which a payee (consumer or organization) authorizes a named originator to initiate ACH credit entries to a deposit account at a named financial institution. Supports one-time and recurring credits, fixed or variable amounts, and optional B2B remittance / addenda fields. Used for vendor / accounts-payable, refunds, dividends, insurance claim payouts, government benefits, and royalty disbursements; governed by NACHA Operating Rules.",
  "code": "ACH-CREDIT-AUTH",
  "releaseDate": "2026-05-01",
  "metadata": {
    "domain": "banking"
  },
  "instructions": {
    "kind": "file",
    "path": "ach-credit-authorization.instructions.md",
    "mimeType": "text/markdown",
    "title": "Instructions for ACH Credit Authorization",
    "description": "Generated instructions derived from the artifact definition.",
    "checksum": "sha256:264416fdce078954d7712b3a3fbd38c76408e6f64ffa5ffa914c70f4d5eeef42"
  },
  "parties": {
    "originator": {
      "partyType": "organization",
      "label": "Originator (Company / Agency)",
      "description": "The company or government agency that will initiate ACH credit entries into the payee's account (vendors paying invoices, agencies disbursing benefits, insurers paying claims, etc.). The originator is identified for traceability but does not sign the authorization.",
      "min": 1,
      "max": 1
    },
    "payee": {
      "partyType": "any",
      "label": "Payee (Account Holder)",
      "description": "The individual or organization that will receive the ACH credits. Provides identification, banking details, payment schedule, and signs the authorization granting the originator permission to deposit funds into the named account.",
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
      "label": "Originator address",
      "description": "Principal business address of the originator. Used so the payee can identify the entity initiating credits and route correspondence (revocation notices, disputes).",
      "required": true,
      "visible": true
    },
    "originatorPhone": {
      "type": "phone",
      "label": "Originator phone",
      "description": "Phone number for the originator's A/P or treasury contact regarding this authorization.",
      "required": false,
      "visible": true
    },
    "originatorEmail": {
      "type": "email",
      "label": "Originator email",
      "description": "Email address for the originator's A/P or treasury contact regarding this authorization.",
      "required": false,
      "visible": true
    },
    "payeeType": {
      "type": "enum",
      "label": "Payee type",
      "description": "Selects whether the payee is a natural person ('individual') or a legal entity ('organization'). Affects which contact-info fields are required.",
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
    "payeeAddress": {
      "type": "address",
      "label": "Payee address",
      "description": "Mailing address of the payee, used for tax reporting and any non-electronic remittance correspondence.",
      "required": true,
      "visible": true
    },
    "payeePhone": {
      "type": "phone",
      "label": "Payee phone (operational / remittance contact)",
      "description": "Phone number of the payee or their A/R contact. Required when payeeType is 'organization' since the originator typically needs a phone channel for B2B remittance issues.",
      "required": "fields.payeeType == 'organization'",
      "visible": true
    },
    "payeeEmail": {
      "type": "email",
      "label": "Payee email (remittance advice)",
      "description": "Email address used by the originator to deliver remittance advice for each credit. Required when payeeType is 'organization'; recommended for individuals.",
      "required": "fields.payeeType == 'organization'",
      "visible": true
    },
    "payeeBankName": {
      "type": "text",
      "label": "Bank name",
      "description": "Name of the receiving financial institution that holds the payee's account.",
      "maxLength": 45,
      "required": true,
      "visible": true
    },
    "accountType": {
      "type": "enum",
      "label": "Account type",
      "description": "Type of demand-deposit account for ACH credit routing; maps to the NACHA standard entry class code for the receiving entry.",
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
    "payeeRoutingNumber": {
      "type": "text",
      "label": "Routing/ABA number (9 digits)",
      "description": "Nine-digit ABA routing number of the payee's bank. Must pass the Federal Reserve checksum.",
      "pattern": "^\\d{9}$",
      "required": true,
      "visible": true
    },
    "payeeAccountNumber": {
      "type": "text",
      "label": "Account number",
      "description": "Bank account number where credits will be deposited; 4-17 alphanumeric per NACHA conventions. Treated as sensitive data and typically masked in receipts.",
      "minLength": 4,
      "maxLength": 17,
      "pattern": "^[A-Za-z0-9]+$",
      "required": true,
      "visible": true
    },
    "nameOnAccount": {
      "type": "text",
      "label": "Name on account (if different from payee)",
      "description": "Literal name printed on the bank account, if different from the payee's legal name on this form. Helps avoid ACH rejects when the bank performs strict name matching.",
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
      "description": "Whether this authorization covers a single one-time credit or a recurring series. Drives which schedule fields appear below.",
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
      "description": "Dollar amount of the credit. Required for one-time payments and for fixed-amount recurring payments. For variable-amount recurring credits the amount is derived per-cycle.",
      "min": 0.01,
      "required": "fields.paymentMode == 'one_time' or (fields.paymentMode == 'recurring' and fields.amountMode == 'fixed')",
      "visible": "fields.paymentMode == 'one_time' or (fields.paymentMode == 'recurring' and fields.amountMode == 'fixed')"
    },
    "paymentMemo": {
      "type": "text",
      "label": "Memo or purpose",
      "description": "Free-form description of the purpose of the credit(s), e.g., 'Q2 commissions', 'Claim 12345 payout'. Appears on remittance advice.",
      "maxLength": 70,
      "required": false,
      "visible": true
    },
    "paymentDate": {
      "type": "date",
      "label": "Credit date (one-time)",
      "description": "Date on which a one-time credit is to be deposited. Subject to standard ACH lead time (originator typically requires 2-3 business days).",
      "required": "fields.paymentMode == 'one_time'",
      "visible": "fields.paymentMode == 'one_time'"
    },
    "amountMode": {
      "type": "enum",
      "label": "Amount mode (recurring)",
      "description": "For recurring credits, whether each cycle's amount is a fixed value or derived from an external source (e.g. invoice). Drives which amount fields are visible.",
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
      "description": "Cadence at which recurring credits occur. Drives which day-of-month / day-of-week fields are visible.",
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
      "label": "Start date (first scheduled credit)",
      "description": "Date of the first credit in a recurring series. Subsequent credits are derived from this date and the chosen frequency.",
      "required": "fields.paymentMode == 'recurring'",
      "visible": "fields.paymentMode == 'recurring'"
    },
    "amountRangeMin": {
      "type": "money",
      "label": "Minimum credit amount (variable)",
      "description": "For variable-amount recurring credits, the lowest dollar amount the payee expects in any cycle. Optional safeguard; the originator may also enforce its own limits.",
      "min": 0,
      "required": false,
      "visible": "fields.paymentMode == 'recurring' and fields.amountMode == 'variable'"
    },
    "amountRangeMax": {
      "type": "money",
      "label": "Maximum credit amount (variable)",
      "description": "For variable-amount recurring credits, the highest dollar amount the payee expects in any cycle. Optional safeguard.",
      "min": 0,
      "required": false,
      "visible": "fields.paymentMode == 'recurring' and fields.amountMode == 'variable'"
    },
    "amountSource": {
      "type": "text",
      "label": "Amount source (e.g. amount on submitted invoice)",
      "description": "Free-form description of how each cycle's credit amount will be determined (e.g. 'monthly invoice', 'percentage of revenue'). Required when amountMode is 'variable'.",
      "maxLength": 100,
      "required": "fields.paymentMode == 'recurring' and fields.amountMode == 'variable'",
      "visible": "fields.paymentMode == 'recurring' and fields.amountMode == 'variable'"
    },
    "dayOfMonth": {
      "type": "number",
      "label": "Day of month (monthly)",
      "description": "Day of each month on which monthly credits are deposited (1-31). Used only when frequency is 'monthly'.",
      "min": 1,
      "max": 31,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'monthly'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'monthly'"
    },
    "semiMonthlyDay1": {
      "type": "number",
      "label": "First credit day of month (semi-monthly)",
      "description": "First of two days per month on which semi-monthly credits are deposited (e.g. 1st). Used only when frequency is 'semi_monthly'.",
      "min": 1,
      "max": 31,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'semi_monthly'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'semi_monthly'"
    },
    "semiMonthlyDay2": {
      "type": "number",
      "label": "Second credit day of month (semi-monthly)",
      "description": "Second of two days per month for semi-monthly credits (e.g. 15th). Must differ from semiMonthlyDay1.",
      "min": 1,
      "max": 31,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'semi_monthly'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'semi_monthly'"
    },
    "dayOfWeek": {
      "type": "enum",
      "label": "Day of week (weekly or bi-weekly)",
      "description": "Day of the week on which weekly or bi-weekly credits are deposited. Used only when frequency is 'weekly' or 'bi_weekly'.",
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
      "description": "Which month of each calendar quarter the credit occurs in (first/second/third). Used only when frequency is 'quarterly'.",
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
      "description": "Day-of-month (1-31) when quarterly credits occur. Used only when frequency is 'quarterly'.",
      "min": 1,
      "max": 31,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.frequency == 'quarterly'",
      "visible": "fields.paymentMode == 'recurring' and fields.frequency == 'quarterly'"
    },
    "annualMonth": {
      "type": "enum",
      "label": "Month (annual)",
      "description": "Calendar month in which the annual credit occurs. Used only when frequency is 'annual'.",
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
      "description": "Day-of-month (1-31) when the annual credit occurs.",
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
      "description": "How the recurring authorization terminates: explicit end date, fixed number of credits, or until the payee cancels in writing.",
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
      "description": "Last date on which a credit may occur. Required when endCondition is 'end_date'; must be after startDate.",
      "required": "fields.paymentMode == 'recurring' and fields.endCondition == 'end_date'",
      "visible": "fields.paymentMode == 'recurring' and fields.endCondition == 'end_date'"
    },
    "creditCount": {
      "type": "number",
      "label": "Number of credits",
      "description": "Total number of recurring credits to be deposited before the authorization expires. Required when endCondition is 'count'.",
      "min": 1,
      "step": 1,
      "required": "fields.paymentMode == 'recurring' and fields.endCondition == 'count'",
      "visible": "fields.paymentMode == 'recurring' and fields.endCondition == 'count'"
    },
    "remittanceReference": {
      "type": "text",
      "label": "Remittance reference (invoice #, PO #, claim #, case #)",
      "description": "External reference identifying the underlying obligation being paid (invoice number, purchase order, claim number). Carried into the ACH addenda record for downstream reconciliation.",
      "maxLength": 60,
      "required": false,
      "visible": true
    },
    "addendaText": {
      "type": "text",
      "label": "Addenda / remittance description (B2B CCD+ / CTX+ context)",
      "description": "Free-form addenda text included with B2B ACH credits (CCD+ / CTX+ standard entry classes). Used by the payee's A/R system to auto-apply the credit to open receivables.",
      "maxLength": 80,
      "required": false,
      "visible": true
    }
  },
  "rules": {
    "amountRangeOrder": {
      "expr": "not (amountRangeMin and amountRangeMax) or amountRangeMax.amount >= amountRangeMin.amount",
      "message": "Maximum credit amount must be greater than or equal to minimum credit amount.",
      "severity": "error"
    },
    "endDateAfterStart": {
      "expr": "not (paymentMode == 'recurring' and endCondition == 'end_date') or not endDate or not startDate or dateDiff(startDate, endDate) > 0",
      "message": "End date must be after start date.",
      "severity": "error"
    },
    "semiMonthlyDistinct": {
      "expr": "not (paymentMode == 'recurring' and frequency == 'semi_monthly') or not (semiMonthlyDay1 and semiMonthlyDay2) or semiMonthlyDay1 != semiMonthlyDay2",
      "message": "The two semi-monthly credit days must differ.",
      "severity": "error"
    }
  },
  "layers": {
    "markdown": {
      "kind": "file",
      "mimeType": "text/markdown",
      "title": "Markdown Form",
      "path": "ach-credit-authorization.md",
      "checksum": "sha256:77d9171f2109c0bede7d14ee99badaf35686b2fdb50f50252110144dff5650e2"
    },
    "pdf": {
      "kind": "file",
      "mimeType": "application/pdf",
      "title": "PDF Form",
      "path": "ach-credit-authorization.pdf",
      "checksum": "sha256:11554e9f9b29ff3f941eace890a40fab5ac556c8f394a583b2038de02beab038",
      "signatures": {
        "payeeSignature": {
          "party": {
            "role": "payee",
            "index": 0
          },
          "type": "signature",
          "label": "Signature of Payee",
          "placement": {
            "page": 1,
            "x": 97.02,
            "y": 546,
            "width": 230,
            "height": 14
          }
        },
        "payeeDate": {
          "party": {
            "role": "payee",
            "index": 0
          },
          "type": "date_signed",
          "label": "Date",
          "placement": {
            "page": 1,
            "x": 374.53,
            "y": 546,
            "width": 90,
            "height": 14
          }
        },
        "payeePrintedName": {
          "party": {
            "role": "payee",
            "index": 0
          },
          "type": "printed_name",
          "label": "Printed name",
          "placement": {
            "page": 1,
            "x": 112.03,
            "y": 574,
            "width": 200,
            "height": 14
          }
        },
        "payeeCapacity": {
          "party": {
            "role": "payee",
            "index": 0
          },
          "type": "capacity",
          "label": "Title (organizations only)",
          "placement": {
            "page": 1,
            "x": 430.55,
            "y": 574,
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
        "payeeType_individual": "payeeType:individual",
        "payeeType_organization": "payeeType:organization",
        "payeeName": "parties.payee.name",
        "payeeAddressLine1": "payeeAddress.line1",
        "payeeCity": "payeeAddress.locality",
        "payeeState": "payeeAddress.region",
        "payeeZip": "payeeAddress.postalCode",
        "payeePhone": "payeePhone.number",
        "payeeEmail": "payeeEmail",
        "payeeBankName": "payeeBankName",
        "payeeRoutingNumber": "payeeRoutingNumber",
        "payeeAccountNumber": "payeeAccountNumber",
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
        "creditCount": "creditCount",
        "paymentMemo": "paymentMemo",
        "remittanceReference": "remittanceReference",
        "addendaText": "addendaText"
      }
    }
  },
  "defaultLayer": "pdf"
} as const;

const __c_ach_credit_authorization_instructions_md: string = `---
title: Instructions for ACH Credit Authorization
source_url: null
slug: ach-credit-authorization
timestamp: 2026-05-12T02:39:15Z
generated: true
---

# Instructions for ACH Credit Authorization

## Purpose

This form authorizes a named Originator (a company or agency) to send ACH credit deposits — money — into the Payee's bank account. It can be used for a one-time payment or for recurring payments at a fixed or variable amount.

## How to fill it out

### 1. Originator

**1.** Enter the Originator's mailing address (required), phone, and email.

### 2. Payee

**2.** Select the Payee type: **Individual** or **Organization**.

**3.** Enter the Payee's mailing address (required).

**4.** If the Payee is an **Organization**, also enter a phone and email for remittance contact. These are optional for an individual.

### 3. Bank account to receive the credits

**5.** Enter the bank name.

**6.** Select the account type: **Checking** or **Savings**.

**7.** Enter the 9-digit routing / ABA number.

**8.** Enter the account number.

**9.** If the name on the account is different from the Payee, enter the name on the account.

**10.** Check the box if a voided check or deposit slip is attached. Attaching one is recommended.

### 4. Payment mode

**11.** Select the Payment mode: **One-time** or **Recurring**.

### 5. One-time payment details

Complete steps 12–14 if **One-time** is selected.

**12.** Enter the amount in U.S. dollars.

**13.** Enter the credit date — the date the deposit should arrive.

**14.** Optionally enter a memo or purpose.

### 6. Recurring payment details

Complete steps 15–22 if **Recurring** is selected.

**15.** Select the Amount mode: **Fixed** (the same amount every time) or **Variable** (the amount changes per cycle).

**16.** If **Fixed**, enter the amount in U.S. dollars.

**17.** If **Variable**, optionally enter a minimum and maximum credit amount, and describe the amount source (for example, "the amount on the submitted invoice").

**18.** Select the Frequency: **Weekly**, **Bi-weekly**, **Semi-monthly**, **Monthly**, **Quarterly**, **Annual**, or **Other**.

**19.** Enter the Start date — the date of the first scheduled credit.

**20.** Provide the timing details for the frequency selected:
   - **Monthly** — enter the day of the month.
   - **Semi-monthly** — enter the two days of the month (first and second).
   - **Weekly** or **Bi-weekly** — enter the day of the week.

**21.** Optionally enter a memo or purpose.

### 7. Sign and submit

**22.** Sign and date the form, then return it to the Originator.

## Notes

- The Payee may revoke this authorization at any time by sending written notice to the Originator at the address provided. Allow the Originator a reasonable time (typically 10 business days) to act on the revocation before the next scheduled credit.
- Recurring credits continue until the Payee revokes the authorization, the arrangement is terminated by the Originator, or the listed account closes.
`;
const __c_ach_credit_authorization_md: string = `# ACH Credit Authorization

*I authorize the Originator named below to initiate ACH credit entries TO the account identified below.*

## Originator

- **Name:** {{parties.originator.legalName}}{{#if parties.originator.name != null}} (DBA {{parties.originator.name}}){{/if}}
- **Address:** {{fields.originatorAddress.line1}}{{#if fields.originatorAddress.line2 != null}}, {{fields.originatorAddress.line2}}{{/if}}, {{fields.originatorAddress.locality}}, {{fields.originatorAddress.region}} {{fields.originatorAddress.postalCode}}
- **Phone:** {{fields.originatorPhone}}
- **Email:** {{fields.originatorEmail}}

## Payee

- **Type:**
  - [{{#if fields.payeeType == "individual"}}x{{else}} {{/if}}] Individual
  - [{{#if fields.payeeType == "organization"}}x{{else}} {{/if}}] Organization
- **Name:** {{#if fields.payeeType == "organization"}}{{parties.payee.legalName}}{{#if parties.payee.name != null}} (DBA {{parties.payee.name}}){{/if}}{{else}}{{parties.payee.name}}{{/if}}
- **Address:** {{fields.payeeAddress.line1}}{{#if fields.payeeAddress.line2 != null}}, {{fields.payeeAddress.line2}}{{/if}}, {{fields.payeeAddress.locality}}, {{fields.payeeAddress.region}} {{fields.payeeAddress.postalCode}}
- **Phone:** {{fields.payeePhone}}
- **Email:** {{fields.payeeEmail}}

## Account

- **Bank:** {{fields.payeeBankName}}
- **Routing/ABA #:** {{fields.payeeRoutingNumber}}
- **Account #:** {{fields.payeeAccountNumber}}
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
- **Credit date:** {{fields.paymentDate}}
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
- **Credit day(s):**
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
  - [{{#if fields.endCondition == "count"}}x{{else}} {{/if}}] After {{fields.creditCount}} credits
{{/if}}

- **Memo:** {{fields.paymentMemo}}
- **Remittance reference:** {{fields.remittanceReference}}
- **Addenda text:** {{fields.addendaText}}

## Terms

1. This authorization remains in effect until I provide written notice of termination to the Originator.
2. Originator may initiate ACH debit entries to recover credits sent in error (clawback), and I agree to cooperate with the recovery of any such erroneous credits.
3. Origination of these transactions will comply with U.S. law and NACHA Operating Rules.
4. I represent that I am authorized to act with respect to the account identified above.
5. I will notify the Originator in writing of any change in account information; the Originator is not liable for credits sent to a previously valid account that has since been closed or changed without notice.

## Signature

**Signature:** {{signature(parties.payee, "payeeSignature")}}
**Date:** {{signatureDate(parties.payee, "payeeSignature")}}
**Printed name:** {{printedName(parties.payee, "payeePrintedName")}}
{{#if fields.payeeType == "organization"}}
**Title (organization):** {{capacity(parties.payee, "payeeCapacity")}}
{{/if}}
`;
const __c_ach_credit_authorization_pdf_b64 = "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtT2JsaXF1ZSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjMgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUgL0VuY29kaW5nIC9EaWZmZXJlbmNlcyBbMjQgL2JyZXZlIC9jYXJvbiAvY2lyY3VtZmxleCAvZG90YWNjZW50IC9odW5nYXJ1bWxhdXQgL29nb25layAvcmluZyAvdGlsZGUgMzkgL3F1b3Rlc2luZ2xlIDk2IC9ncmF2ZSAxMjggL2J1bGxldCAvZGFnZ2VyIC9kYWdnZXJkYmwgL2VsbGlwc2lzIC9lbWRhc2ggL2VuZGFzaCAvZmxvcmluIC9mcmFjdGlvbiAvZ3VpbHNpbmdsbGVmdCAvZ3VpbHNpbmdscmlnaHQgL21pbnVzIC9wZXJ0aG91c2FuZCAvcXVvdGVkYmxiYXNlIC9xdW90ZWRibGxlZnQgL3F1b3RlZGJscmlnaHQgL3F1b3RlbGVmdCAvcXVvdGVyaWdodCAvcXVvdGVzaW5nbGJhc2UgL3RyYWRlbWFyayAvZmkgL2ZsIC9Mc2xhc2ggL09FIC9TY2Fyb24gL1lkaWVyZXNpcyAvWmNhcm9uIC9kb3RsZXNzaSAvbHNsYXNoIC9vZSAvc2Nhcm9uIC96Y2Fyb24gMTYwIC9FdXJvIDE2NCAvY3VycmVuY3kgMTY2IC9icm9rZW5iYXIgMTY4IC9kaWVyZXNpcyAvY29weXJpZ2h0IC9vcmRmZW1pbmluZSAxNzIgL2xvZ2ljYWxub3QgLy5ub3RkZWYgL3JlZ2lzdGVyZWQgL21hY3JvbiAvZGVncmVlIC9wbHVzbWludXMgL3R3b3N1cGVyaW9yIC90aHJlZXN1cGVyaW9yIC9hY3V0ZSAvbXUgMTgzIC9wZXJpb2RjZW50ZXJlZCAvY2VkaWxsYSAvb25lc3VwZXJpb3IgL29yZG1hc2N1bGluZSAxODggL29uZXF1YXJ0ZXIgL29uZWhhbGYgL3RocmVlcXVhcnRlcnMgMTkyIC9BZ3JhdmUgL0FhY3V0ZSAvQWNpcmN1bWZsZXggL0F0aWxkZSAvQWRpZXJlc2lzIC9BcmluZyAvQUUgL0NjZWRpbGxhIC9FZ3JhdmUgL0VhY3V0ZSAvRWNpcmN1bWZsZXggL0VkaWVyZXNpcyAvSWdyYXZlIC9JYWN1dGUgL0ljaXJjdW1mbGV4IC9JZGllcmVzaXMgL0V0aCAvTnRpbGRlIC9PZ3JhdmUgL09hY3V0ZSAvT2NpcmN1bWZsZXggL090aWxkZSAvT2RpZXJlc2lzIC9tdWx0aXBseSAvT3NsYXNoIC9VZ3JhdmUgL1VhY3V0ZSAvVWNpcmN1bWZsZXggL1VkaWVyZXNpcyAvWWFjdXRlIC9UaG9ybiAvZ2VybWFuZGJscyAvYWdyYXZlIC9hYWN1dGUgL2FjaXJjdW1mbGV4IC9hdGlsZGUgL2FkaWVyZXNpcyAvYXJpbmcgL2FlIC9jY2VkaWxsYSAvZWdyYXZlIC9lYWN1dGUgL2VjaXJjdW1mbGV4IC9lZGllcmVzaXMgL2lncmF2ZSAvaWFjdXRlIC9pY2lyY3VtZmxleCAvaWRpZXJlc2lzIC9ldGggL250aWxkZSAvb2dyYXZlIC9vYWN1dGUgL29jaXJjdW1mbGV4IC9vdGlsZGUgL29kaWVyZXNpcyAvZGl2aWRlIC9vc2xhc2ggL3VncmF2ZSAvdWFjdXRlIC91Y2lyY3VtZmxleCAvdWRpZXJlc2lzIC95YWN1dGUgL3Rob3JuIC95ZGllcmVzaXNdPj4KZW5kb2JqCjYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNyAwIG9iago8PAovQkJveCBbIDAgMCAxODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMLQAYiOFolSucK48oEg6ELtzBXK5+jpzAQDJfAjFZW5kc3RyZWFtCmVuZG9iago4IDAgb2JqCjw8Ci9BUCA8PAovTiA3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyA4Mi41MDUgNjYwIDI2Mi41MDUgNjcyIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvck5hbWUpIC9UVSAoTmFtZSkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyOS40OTUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMDKy1DOxNFUwNFIoSuUK58oDiqYDsTtXIJerrzMXAO9rCZllbmRzdHJlYW0KZW5kb2JqCjExIDAgb2JqCjw8Ci9BUCA8PAovTiAxMCAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMzE2LjAxOSA2NjAgNTQ1LjUxNCA2NzIgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmlnaW5hdG9yQWRkcmVzc0xpbmUxKSAvVFUgKEFkZHJlc3MpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTIgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTMgMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEyIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwULAwUDA0UihK5QrnygMKpAOxO1cgl6uvMxcAwO0IlGVuZHN0cmVhbQplbmRvYmoKMTQgMCBvYmoKPDwKL0FQIDw8Ci9OIDEzIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyA3NCA2NDIgMTU0IDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JDaXR5KSAvVFUgKENpdHkpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTYgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDE1IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDAyVTA0UihK5QrnygMKpAOxO1cgl6uvMxcAwM0Ik2VuZHN0cmVhbQplbmRvYmoKMTcgMCBvYmoKPDwKL0FQIDw8Ci9OIDE2IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAxODcuNTE3IDY0MiAyMTIuNTE3IDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JTdGF0ZSkgL1RVIChTdGF0ZSkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxOSAwIG9iago8PAovQkJveCBbIDAgMCA1MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMDVQMDRSKErlCufKAwqkA7E7VyCXq68zFwDAnAiRZW5kc3RyZWFtCmVuZG9iagoyMCAwIG9iago8PAovQVAgPDwKL04gMTkgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDIzNy41MiA2NDIgMjg3LjUyIDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JaaXApIC9UVSAoWmlwKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjIxIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjIyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAyMSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFCwMFAwNFIoSuUK58oDCqQDsTtXIJerrzMXAMDtCJRlbmRzdHJlYW0KZW5kb2JqCjIzIDAgb2JqCjw8Ci9BUCA8PAovTiAyMiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMzI2LjA0MSA2NDIgNDA2LjA0MSA2NTQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmlnaW5hdG9yUGhvbmUpIC9UVSAoUGhvbmUpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMjQgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGlu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PDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgMTczLjkyNiA2MjAgMTgyLjkyNiA2MjkgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllZVR5cGVfb3JnYW5pemF0aW9uKSAKICAvVFUgKE9yZ2FuaXphdGlvbiBcKG9yZ2FuaXphdGlvblwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMzUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMzYgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAzNSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwtABiI4WiVK5wrjygSDoQu3MFcrn6OnMBAMl8CMVlbmRzdHJlYW0KZW5kb2JqCjM3IDAgb2JqCjw8Ci9BUCA8PAovTiAzNiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgODIuNTA1IDU5NiAyNjIuNTA1IDYwOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVlTmFtZSkgL1RVIChOYW1lKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjM4IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjM5IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyOS40OTUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDM4IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDAystQzsTRVMDRSKErlCufKA4qmA7E7VyCXq68zFwDvawmZZW5kc3RyZWFtCmVuZG9iago0MCAwIG9iago8PAovQVAgPDwKL04gMzkgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDMxNi4wMTkgNTk2IDU0NS41MTQgNjA4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVBZGRyZXNzTGluZTEpIC9UVSAoQWRkcmVzcykgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago0MSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago0MiAwIG9iago8PAovQkJveCBbIDAgMCA4MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNDEgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQsDBQMDRSKErlCufKAwqkA7E7VyCXq68zFwDA7QiUZW5kc3RyZWFtCmVuZG9iago0MyAwIG9iago8PAovQVAgPDwKL04gNDIgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDc0IDU3OCAxNTQgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVDaXR5KSAvVFUgKENpdHkpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNDQgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDUgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQ0IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDAyVTA0UihK5QrnygMKpAOxO1cgl6uvMxcAwM0Ik2VuZHN0cmVhbQplbmRvYmoKNDYgMCBvYmoKPDwKL0FQIDw8Ci9OIDQ1IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAxODcuNTE3IDU3OCAyMTIuNTE3IDU5MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVlU3RhdGUpIC9UVSAoU3RhdGUpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNDcgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDggMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQ3IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDA1UDA0UihK5QrnygMKpAOxO1cgl6uvMxcAwJwIkWVuZHN0cmVhbQplbmRvYmoKNDkgMCBvYmoKPDwKL0FQIDw8Ci9OIDQ4IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAyMzcuNTIgNTc4IDI4Ny41MiA1OTAgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllZVppcCkgL1RVIChaaXApIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNTAgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNTEgMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDUwIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwULAwUDA0UihK5QrnygMKpAOxO1cgl6uvMxcAwO0IlGVuZHN0cmVhbQplbmRvYmoKNTIgMCBvYmoKPDwKL0FQIDw8Ci9OIDUxIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAzMjYuMDQxIDU3OCA0MDYuMDQxIDU5MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVlUGhvbmUpIC9UVSAoUGhvbmUpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNTMgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNTQgMCBvYmoKPDwKL0JCb3ggWyAwIDAgOTMuOTU5IDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNTEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1MyAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFCwNNazNLVUMDRSKErlCufKAwqmA7E7VyCXq68zFwDmpQltZW5kc3RyZWFtCmVuZG9iago1NSAwIG9iago8PAovQVAgPDwKL04gNTQgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDQ0MS4wNDMgNTc4IDUzNS4wMDIgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVFbWFpbCkgL1RVIChFbWFpbCkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago1NiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago1NyAwIG9iago8PAovQkJveCBbIDAgMCAxMzAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDU2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDA0BmIjhaJUrnCuPKBIOhC7cwVyufo6cwEAyPUIwGVuZHN0cmVhbQplbmRvYmoKNTggMCBvYmoKPDwKL0FQIDw8Ci9OIDU3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyA3OS4wMTMgNTM0IDIwOS4wMTMgNTQ2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVCYW5rTmFtZSkgL1RVIChCYW5rKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjU5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjYwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDkwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1OSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFCwNFAwNFIoSuUK58oDCqQDsTtXIJerrzMXAMEICJVlbmRzdHJlYW0KZW5kb2JqCjYxIDAgb2JqCjw8Ci9BUCA8PAovTiA2MCAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMjY0LjAzNSA1MzQgMzU0LjAzNSA1NDYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllZVJvdXRpbmdOdW1iZXIpIC9UVSAoUm91dGluZyAjKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjYyIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjYzIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEzMS45NjUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1NiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDYyIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDA0NtSzNDOxhANzBUMjhaJUrnCuPKCCdCB25wrkcvV15gIAbPYMA2VuZHN0cmVhbQplbmRvYmoKNjQgMCBvYmoKPDwKL0FQIDw8Ci9OIDYzIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyA0MTAuNTYgNTM0IDU0Mi41MjUgNTQ2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVBY2NvdW50TnVtYmVyKSAvVFUgKEFjY291bnQgIykgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago2NSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgNTQgNTE2IDYzIDUyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnRUeXBlX2NoZWNraW5nKSAKICAvVFUgKENoZWNraW5nIFwoY2hlY2tpbmdcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjY2IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyAxMjAuNTEyIDUxNiAxMjkuNTEyIDUyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnRUeXBlX3NhdmluZ3MpIAogIC9UVSAoU2F2aW5ncyBcKHNhdmluZ3NcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjY3IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjY4IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEzMCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNjcgMCBSPj4gPj4g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IDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREZdID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nCvk0jO0VIDhIHcFAz1ThXIgaWQKISz1ILgoVaGYKxAA4EsJrmVuZHN0cmVhbQplbmRvYmoKNzYgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgNzMgMCBSIC9ZZXMgNzIgMCBSCj4+IC9OIDw8Ci9PZmYgNzEgMCBSIC9ZZXMgNzAgMCBSCj4+IC9SIDw8Ci9PZmYgNzUgMCBSIC9ZZXMgNzQgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAoNCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDQwNi41NiA1MTUgNDE2LjU2IDUyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHZvaWRlZENoZWNrQXR0YWNoZWQpIAogIC9UVSAoVm9pZGVkIGNoZWNrIGF0dGFjaGVkKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNzcgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDU0IDQ3MiA2MyA0ODEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXltZW50TW9kZV9vbmV0aW1lKSAKICAvVFUgKE9uZS10aW1lIFwob25lX3RpbWVcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjc4IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyAxMjAuMDA4IDQ3MiAxMjkuMDA4IDQ4MSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheW1lbnRNb2RlX3JlY3VycmluZykgCiAgL1RVIChSZWN1cnJpbmcgXChyZWN1cnJpbmdcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjc5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjgwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA3OSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFCwMFAwNFIoSuUK58oDCqQDsTtXIJerrzMXAMDtCJRlbmRzdHJlYW0KZW5kb2JqCjgxIDAgb2JqCjw8Ci9BUCA8PAovTiA4MCAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMTU0LjUyIDQ1NCAyMzQuNTIgNDY2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob25lVGltZUFtb3VudCkgL1RVIChBbW91bnQgJCkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago4MiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago4MyAwIG9iago8PAovQkJveCBbIDAgMCA5MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgODIgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQsDRQMDRSKErlCufKAwqkA7E7VyCXq68zFwDBCAiVZW5kc3RyZWFtCmVuZG9iago4NCAwIG9iago8PAovQVAgPDwKL04gODMgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDI5NS4wNDEgNDU0IDM4NS4wNDEgNDY2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5bWVudERhdGUpIC9UVSAoQ3JlZGl0IGRhdGUpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKODUgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDExNCA0MzYgMTIzIDQ0NSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFtb3VudE1vZGVfZml4ZWQpIAogIC9UVSAoRml4ZWQgJCBcKGZpeGVkXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago4NiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago4NyAwIG9iago8PAovQkJveCBbIDAgMCA2MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgODYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMDNQMDRSKErlCufKAwqkA7E7VyCXq68zFwDAtwiSZW5kc3RyZWFtCmVuZG9iago4OCAwIG9iago8PAovQVAgPDwKL04gODcgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAwIGcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDE2NC41MTEgNDM2IDIyNC41MTEgNDQ4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocmVjdXJyaW5nRml4ZWRBbW91bnQpIC9UVSAocmVjdXJyaW5nRml4ZWRBbW91bnQpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKODkgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDIzNi41MTEgNDM2IDI0NS41MTEgNDQ1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYW1vdW50TW9kZV92YXJpYWJsZSkgCiAgL1RVIChWYXJpYWJsZTogbWluICQgXCh2YXJpYWJsZVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKOTAgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKOTEgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA0NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkwIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDA1UDA0UihK5QrnygMKpAOxO1cgl6uvMxcAwJwIkWVuZHN0cmVhbQplbmRvYmoKOTIgMCBvYmoKPDwKL0FQIDw8Ci9OIDkxIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAzMTcuNTMyIDQzNiAzNjcuNTMyIDQ0OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFtb3VudFJhbmdlTWluKSAvVFUgKGFtb3VudFJhbmdlTWluKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjkzIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjk0IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDUwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA5MyAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwNVAwNFIoSuUK58oDCqQDsTtXIJerrzMXAMCcCJFlbmRzdHJlYW0KZW5kb2JqCjk1IDAgb2JqCjw8Ci9BUCA8PAovTiA5NCAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgNDAyLjAzOSA0MzYgNDUyLjAzOSA0NDggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhbW91bnRSYW5nZU1heCkgL1RVIChtYXggJCkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago5NiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago5NyAwIG9iago8PAovQkJveCBbIDAgMCA0MDIuNDU4IDIyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNTYgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA5NiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwMTDSMzE1t4QDcwUjI4WiVK5wrjyggnQgducK5HL1deYCAGzADAJlbmRzdHJlYW0KZW5kb2JqCjk4IDAgb2JqCjw8Ci9BUCA8PAovTiA5NyAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgNDA5NiAKICAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMTU1LjU0MiA0MDggNTU4IDQzMCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFtb3VudFNvdXJjZSkgL1RVIChWYXJpYWJsZSBhbW91bnQgc291cmNlKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjk5IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyAxMTQgMzg4IDEyMyAzOTcgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChmcmVxdWVuY3lfd2Vla2x5KSAKICAvVFUgKFdlZWtseSBcKHdlZWtseVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTAwIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyAxNjQuNTAyIDM4OCAxNzMuNTAyIDM5NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV9iaXdlZWtseSkgCiAgL1RVIChCaS13a2x5IFwoYmlfd2Vla2x5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDEgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDIxMy45OTYgMzg4IDIyMi45OTYgMzk3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZnJlcXVlbmN5X3NlbWltb250aGx5KSAKICAvVFUgKFNlbWktbW8gXChzZW1pX21vbnRobHlcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwMiAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgMjcwLjk5NiAzODggMjc5Ljk5NiAzOTcgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChmcmVxdWVuY3lfbW9udGhseSkgCiAgL1RVIChNb250aGx5IFwobW9udGhseVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTAzIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyAzMjMuNTA1IDM4OCAzMzIuNTA1IDM5NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV9xdWFydGVybHkpIAogIC9UVSAoUXRyIFwocXVhcnRlcmx5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDQgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDM1Ny4wMDYgMzg4IDM2Ni4wMDYgMzk3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZnJlcXVlbmN5X2FubnVhbCkgCiAgL1RVIChBbm51YWwgXChhbm51YWxcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwNSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgNDA2LjAyMyAzODggNDE1LjAyMyAzOTcgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChmcmVxdWVuY3lfb3RoZXIpIAogIC9UVSAoT3RoZXIgXChvdGhlclwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTA2IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEwNyAwIG9iago8PAovQkJveCBbIDAgMCAyMzEuOTkxIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNTUgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMDYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMDI21LO0NLBEAAVDI4WiVK5wrjyggnQgducK5HL1deYCAG0zDAVlbmRzdHJlYW0KZW5kb2JqCjEwOCAwIG9iago8PAovQVAgPDwKL04gMTA3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAyOTkuNTM1IDM2OCA1MzEuNTI2IDM4MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHN0YXJ0RGF0ZSkgL1RVIChTdGFydCBkYXRlKSAKICAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEwOSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgODIgMzQ4IDkxIDM1NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVuZENvbmRpdGlvbl91bnRpbGNhbmNlbGxlZCkgCiAgL1RVIChVbnRpbCBjYW5jZWxsZWQgXCh1bnRpbF9jYW5jZWxsZWRcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjExMCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgMTY5LjUxOCAzNDggMTc4LjUxOCAzNTcgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbmRDb25kaXRpb25fZW5kZGF0ZSkgCiAgL1RVIChFbmQgZGF0ZSBcKGVuZF9kYXRlXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMTEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTEyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDcwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTEgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMDdQMDRSKErlCufKAwqkA7E7VyCXq68zFwDA0giTZW5kc3RyZWFtCmVuZG9iagoxMTMgMCBvYmoKPDwKL0FQIDw8Ci9OIDExMiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMjI2LjU0NSAzNDggMjk2LjU0NSAzNjAgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbmREYXRlKSAvVFUgKGVuZERhdGUpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTE0IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyAzMTIuNTQ1IDM0OCAzMjEuNTQ1IDM1NyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVuZENvbmRpdGlvbl9jb3VudCkgCiAgL1RVIChDb3VudCBcKGNvdW50XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMTUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTE2IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDUwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNDcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTUgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic0w+pUHDydVbgKuQyUDBQMDVQMDRSKErlCufKAwqkA7E7VyCXq68zFwDAnAiRZW5kc3RyZWFtCmVuZG9iagoxMTcgMCBvYmoKPDwKL0FQIDw8Ci9OIDExNiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIDAgZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMzU3LjU1NyAzNDggNDA3LjU1NyAzNjAgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChjcmVkaXRDb3VudCkgL1RVIChjcmVkaXRDb3VudCkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMTggMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTE5IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIwMCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDQ4IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTE4IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNMPqVBw8nVW4CrkMlAwUDAyMFAwNFIoSuUK58oDiqQDsTtXIJerrzMXAMjACL5lbmRzdHJlYW0KZW5kb2JqCjEyMCAwIG9iago8PAovQVAgPDwKL04gMTE5IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyA4My41MDQgMzI4IDI4My41MDQgMzQwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5bWVudE1lbW8pIC9UVSAoTWVtbykgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMjEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTIyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDE4Mi40OTYgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1NiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEyMSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwtDDSM7E0tYQDCwVDI4WiVK5wrjyggnQgducK5HL1deYCAG3fDAllbmRzdHJlYW0KZW5kb2JqCjEyMyAwIG9iago8PAovQVAgPDwKL04gMTIyIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAzNDkuMDI5IDMyOCA1MzEuNTI1IDM0MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHJlbWl0dGFuY2VSZWZlcmVuY2UpIC9UVSAoUmVmZXJlbmNlICMpIAogIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTI0IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEyNSAwIG9iago8PAovQkJveCBbIDAgMCAzMjQgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA1MCAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEyNCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTD6lQcPJ1VuAq5DJQMFAwNjLRM1AwNFIoSuUK58oDiqUDsTtXIJerrzMXANrMCSNlbmRzdHJlYW0KZW5kb2JqCjEyNiAwIG9iago8PAovQVAgPDwKL04gMTI1IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgMCBnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAxODYuNTYzIDMxMCA1MTAuNTYzIDMyMiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFkZGVuZGFUZXh0KSAvVFUgKEFkZGVuZGEgLyByZW1pdHRhbmNlIHRleHQgXChCMkJcKSkgCiAgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMjcgMCBvYmoKPDwKL0Fubm90cyBbIDggMCBSIDExIDAgUiAxNCAwIFIgMTcgMCBSIDIwIDAgUiAyMyAwIFIgMjYgMCBSIDMzIDAgUiAzNCAwIFIgMzcgMCBSIAogIDQwIDAgUiA0MyAwIFIgNDYgMCBSIDQ5IDAgUiA1MiAwIFIgNTUgMCBSIDU4IDAgUiA2MSAwIFIgNjQgMCBSIDY1IDAgUiAKICA2NiAwIFIgNjkgMCBSIDc2IDAgUiA3NyAwIFIgNzggMCBSIDgxIDAgUiA4NCAwIFIgODUgMCBSIDg4IDAgUiA4OSAwIFIgCiAgOTIgMCBSIDk1IDAgUiA5OCAwIFIgOTkgMCBSIDEwMCAwIFIgMTAxIDAgUiAxMDIgMCBSIDEwMyAwIFIgMTA0IDAgUiAxMDUgMCBSIAogIDEwOCAwIFIgMTA5IDAgUiAxMTAgMCBSIDExMyAwIFIgMTE0IDAgUiAxMTcgMCBSIDEyMCAwIFIgMTIzIDAgUiAxMjYgMCBSIF0gL0NvbnRlbnRzIDEzMSAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDEzMCAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgCiAgL1RyYW5zIDw8Cgo+PiAvVHlwZSAvUGFnZQo+PgplbmRvYmoKMTI4IDAgb2JqCjw8Ci9BY3JvRm9ybSAxMzIgMCBSIC9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgMTMwIDAgUiAvVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKMTI5IDAgb2JqCjw8Ci9BdXRob3IgKGFub255bW91cykgL0NyZWF0aW9uRGF0ZSAoRDoyMDAwMDEwMTAwMDAwMCswMCcwMCcpIC9DcmVhdG9yIChhbm9ueW1vdXMpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDAwMDEwMTAwMDAwMCswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0ICh1bnNwZWNpZmllZCkgL1RpdGxlICh1bnRpdGxlZCkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iagoxMzAgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAxMjcgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iagoxMzEgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMjEwNwo+PgpzdHJlYW0KR2F0JSRnTiklLCY6TzpTQCZBM0czWG5JM0dZK05EXCFfUT5ORGolUUIwKD9pLkVGaE1KaEBBXzs4OWdRSjJiVC83OENpP0pjYTZOPzBrXUhKNUhVUFlrcFg4JkB0dTxwRSktLCI+KVA8WltlYjJuKiZCYlI8cWBmTkkpYE44Y0toaiY7OHNhX0FwTXQtNUMzNkllYXFvWFEzUCZGTTlRY1o7VV0vVUl0SiMvY1MsWyskM0daJmR0LTRkN1svLE9vUjptaVw1QT49JUcvRSZ0LGppZjlOcEs+KnVUXj1xbCI6bVVUV2YsPyNlX1B1NUNoQUJpMy4pLGNxcmFWbGI3aC11TFhqXD9iamYnbj1HVy0zSCpDYSZRbzNrcmQwJFRVUk82Q2AmLzBgdXJWVVpYSCNWaE0nN1MxIV9SOCUzLCpZWiQ7dE5sQkwjTW0sU0siVEVmZCFdKChPT0ZXKitBbScnY29xUTQoLFlqZENUJmtANVklMWghJjVoKlEmPm9zTkIwPis+YyFbaVswXjsxXVEuXzNQYC0pPWNFNlM6MDFnaDtjJWYrXGtRQis7ayxSLz5NIytvO09OQCdDOktac2tNbz0nI2NAM0g9ZTg1IytmSzhDUXNwQnMrJmtBQDM9PmJNO29KYDI/O0wmR1snJTBLVy0ncVhVPzZFIzliTEc5NS9CWiVfOiYmUmhXU1EhKkJVJV50QVYmWWcpOjBMNillJjpYbkJvbXJCYCRhbzo/RTVIXWhNTS80W0JIPk47MzZzPks9Uy9RTCZPaHUzZ0o4WU5ALS09VnBSYydGdTMhZy9eJWpeSERYYDplIVs5ZkVJJ3NGNEFIZktnOEYwQkQzN1VDZURuIkZTXixWNFssbFI1VGFhVEElOyUmclYpWTtKY2RGOmIzX2NbJVFLT0shNFxyLSoiLmcvNWpaTilvamhISkQpV2dKTzIvOGJcQitqOzlxRWpEJFl0UmI1PFBgY2xfK0U6P1ZYPz9bPGQ5cSJFYkNXTjdtRHQiR20qKVpIKEtyYklQZCVCN1QkTEQldGNhXmA7ZnNLbERaYXEsVVJUMiwwNC1YQVVfMVRmYFNgQFlHdEcsK3M3b0lYYHNvJ0g9Z19eXiInV3JDOGZYIVwrSDNrPkduX1g0I0g9Lyc9NDgpTz5WLGU5NSlBcy4ncj1kQD5vYDdvdXIvTFY2J1hiJ180PiJidTJ1Y1s9K0xWNFk2OzZjImVvZyktK2MyZ0NsbiRnT2U1JUNmYVVdUyw/R19DaSsqJEhhU0VhblRLO0lCKmJwZzlmYShDUyk5MGhBPDcuXzQ2P2tNVSJzK042czhSZUdhZGI/WVRDIklbXitWTWtJRzlTTyNqUkYwcWgvWFBIIylYYmIsTyI/TCJsZFVcWTBkcGgmQi9xZT0qXGBBaWFPZVZPK01GVEo5WzlvV2FHIkNITmtQbko7T3IuIy1OQixYQXNJKVtRUDJqRT0zcTljMCVsOjJNZ0FVRktsLilgVSJnZ1ZGWFU3KnRzTjsnKmg/UG5PSEsyPF1MMVYjLF48QXJRP0UlaGF0PShXYGFyIV5NPiNjLFhDN1tlU0FPLVRXZS1adWtpVDNzN2g/VycpS3FnJEBwZkYuSmlbaCdBQGg9RmtbIWosJCQlOlAwNy5ndSRRLi1HImFvRG1wNDtPZCZJNCItKG47cWtkWkJyWklFaXQqXFNEbzktOkYmKWR0NSFfX1EjQj1VaEVoM2skLEdPaDddJ1dSV0hNKUc0cTY3N2RLYl5jYEFHcDFOIVQ2aF1VP2VTVD0zO3NrJFlXVSgpNWU8JEVBVzxsSEgpRTk7bTVAcUgtM2IsP2FOWmpiKFMmTlQiazJcVDRnVC4yLC9nSzMsYEgsNDRJRWEpMD9RPGQiOztGbTc+cmwtPDwxRUxaIio2VURBLldKaDlNVSpdSy9OXEc9T0UsNVReWjRYPyJSQVBuSS45VkdTdG00PGAobDozWCo2WGU7XSw8KW9bV1tMQSFBKzEpa1E4V1BDLTJAcy1sT05ATlcyKmAtb0gkVktUcUZpXVM0N3JgQlhQPm0oWlkoPW8wLzQjbUZeNiRcTWk5KSM0ckk5ZjQnXUVQOV5IXi8kaUY7J2VqSChoOyhRM0hOUyZEOnFCLWM3QCdGJmJSRTJjIl5JYkFXZEtFNCgtUGAsWUxIKzA3WS90SyM0L0siSFlJMEZTKz5jQDFCPElBRSIvczEkYURxL2dLX3E2Xzo+RENXb1pTUWltbi1ET05KcVIyOm5RW1dobUI0ImYmKyooZmxQRyhYSTpMSFdbdVsjbW51NydiXjgrUGgqUk0vMEFGLGd0IjtDMFs4PGloOl1waC08PEliLC1ycTxvVzMnXSFiTG5obik7cjlkP2ljTDVYPTs0NUNqQC5raDpVJWtfK2BCOCQyR0NdM05wUVNjU2QpIlQ+VGdjMyhCZmBuRlZnUWMqWlQxRG8sLkBHW2Q4UHBYZCRwVjVcdCFiOExHX2ZocDNeIlZoLkhOOEwlXW5cRCRkLmJybTo6clBOKnVXQy9qLUFKYzxUMWdmbysyT1QkJF07NzN1T0UsXDJpK0o4MFtsKmIkPkhySGtOdG5cJFJnVlglcyVZZCxxYzloI21QVylaLDJgMSEjV3E8LXE8NVVgVzteTlo5dS40T2wrRisiQTBiZi5EOmUoQTRIRTxJb2ZlWkNkaU4ybUEhXnIiXWNQQkpIND9PTzBPUCMsQTBKNSYiJkJcdHEwZDs2KixHXDJeU0szMHMjJ2xPVGFlRUhrLiY+bUs1a1VVMHQkKlRbRFR+PmVuZHN0cmVhbQplbmRvYmoKMTMyIDAgb2JqCjw8Ci9EQSAoL0hlbHYgMCBUZiAwIGcpIC9EUiA8PCAvRW5jb2RpbmcKPDwKL1JMQUZlbmNvZGluZwo1IDAgUgo+PgovRm9udCA8PCAvSGVsdiA2IDAgUiA+Pgo+PiAvRmllbGRzIFsgOCAwIFIgMTEgMCBSIDE0IDAgUiAxNyAwIFIgMjAgMCBSIDIzIDAgUiAyNiAwIFIgMzMgMCBSIDM0IDAgUiAzNyAwIFIgCiAgNDAgMCBSIDQzIDAgUiA0NiAwIFIgNDkgMCBSIDUyIDAgUiA1NSAwIFIgNTggMCBSIDYxIDAgUiA2NCAwIFIgNjUgMCBSIAogIDY2IDAgUiA2OSAwIFIgNzYgMCBSIDc3IDAgUiA3OCAwIFIgODEgMCBSIDg0IDAgUiA4NSAwIFIgODggMCBSIDg5IDAgUiAKICA5MiAwIFIgOTUgMCBSIDk4IDAgUiA5OSAwIFIgMTAwIDAgUiAxMDEgMCBSIDEwMiAwIFIgMTAzIDAgUiAxMDQgMCBSIDEwNSAwIFIgCiAgMTA4IDAgUiAxMDkgMCBSIDExMCAwIFIgMTEzIDAgUiAxMTQgMCBSIDExNyAwIFIgMTIwIDAgUiAxMjMgMCBSIDEyNiAwIFIgXQo+PgplbmRvYmoKeHJlZgowIDEzMwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQ0NiAwMDAwMCBuIAowMDAwMDAxNzY4IDAwMDAwIG4gCjAwMDAwMDE4NjYgMDAwMDAgbiAKMDAwMDAwMjEzOCAwMDAwMCBuIAowMDAwMDAyMzU0IDAwMDAwIG4gCjAwMDAwMDI0NTIgMDAwMDAgbiAKMDAwMDAwMjczNCAwMDAwMCBuIAowMDAwMDAyOTY0IDAwMDAwIG4gCjAwMDAwMDMwNjMgMDAwMDAgbiAKMDAwMDAwMzMzNiAwMDAwMCBuIAowMDAwMDAzNTQ2IDAwMDAwIG4gCjAwMDAwMDM2NDUgMDAwMDAgbiAKMDAwMDAwMzkxOCAwMDAwMCBuIAowMDAwMDA0MTM5IDAwMDAwIG4gCjAwMDAwMDQyMzggMDAwMDAgbiAKMDAwMDAwNDUxMSAwMDAwMCBuIAowMDAwMDA0NzI2IDAwMDAwIG4gCjAwMDAwMDQ4MjUgMDAwMDAgbiAKMDAwMDAwNTA5OCAwMDAwMCBuIAowMDAwMDA1MzE5IDAwMDAwIG4gCjAwMDAwMDU0MTggMDAwMDAgbiAKMDAwMDAwNTY5OSAwMDAwMCBuIAowMDAwMDA1OTIwIDAwMDAwIG4gCjAwMDAwMDYyNjIgMDAwMDAgbiAKMDAwMDAwNjQ5NCAwMDAwMCBuIAowMDAwMDA2ODM2IDAwMDAwIG4gCjAwMDAwMDcwNjkgMDAwMDAgbiAKMDAwMDAwNzQxMSAwMDAwMCBuIAowMDAwMDA3NjQ0IDAwMDAwIG4gCjAwMDAwMDgwMTIgMDAwMDAgbiAKMDAwMDAwODM4OCAwMDAwMCBuIAowMDAwMDA4NDg3IDAwMDAwIG4gCjAwMDAwMDg3NjEgMDAwMDAgbiAKMDAwMDAwODk3NCAwMDAwMCBuIAowMDAwMDA5MDczIDAwMDAwIG4gCjAwMDAwMDkzNTYgMDAwMDAgbiAKMDAwMDAwOTU4MSAwMDAwMCBuIAowMDAwMDA5NjgwIDAwMDAwIG4gCjAwMDAwMDk5NTMgMDAwMDAgbiAKMDAwMDAxMDE1OCAwMDAwMCBuIAowMDAwMDEwMjU3IDAwMDAwIG4gCjAwMDAwMTA1MzAgMDAwMDAgbiAKMDAwMDAxMDc0NiAwMDAwMCBuIAowMDAwMDEwODQ1IDAwMDAwIG4gCjAwMDAwMTExMTggMDAwMDAgbiAKMDAwMDAxMTMyOCAwMDAwMCBuIAowMDAwMDExNDI3IDAwMDAwIG4gCjAwMDAwMTE3MDAgMDAwMDAgbiAKMDAwMDAxMTkxNiAwMDAwMCBuIAowMDAwMDEyMDE1IDAwMDAwIG4gCjAwMDAwMTIyOTYgMDAwMDAgbiAKMDAwMDAxMjUxMiAwMDAwMCBuIAowMDAwMDEyNjExIDAwMDAwIG4gCjAwMDAwMTI4ODUgMDAwMDAgbiAKMDAwMDAxMzEwMiAwMDAwMCBuIAowMDAwMDEzMjAxIDAwMDAwIG4gCjAwMDAwMTM0NzQgMDAwMDAgbiAKMDAwMDAxMzcwMiAwMDAwMCBuIAowMDAwMDEzODAxIDAwMDAwIG4gCjAwMDAwMTQwODggMDAwMDAgbiAKMDAwMDAxNDMxNSAwMDAwMCBuIAowMDAwMDE0NjcxIDAwMDAwIG4gCjAwMDAwMTUwMzQgMDAwMDAgbiAKMDAwMDAxNTEzMyAwMDAwMCBuIAowMDAwMDE1NDA3IDAwMDAwIG4gCjAwMDAwMTU2MzQgMDAwMDAgbiAKMDAwMDAxNjIzNiAwMDAwMCBuIAowMDAwMDE2NDcwIDAwMDAwIG4gCjAwMDAwMTcwNzIgMDAwMDAgbiAKMDAwMDAxNzMwNyAwMDAwMCBuIAowMDAwMDE3OTA5IDAwMDAwIG4gCjAwMDAwMTgxNDQgMDAwMDAgbiAKMDAwMDAxODUwNyAwMDAwMCBuIAowMDAwMDE4ODYyIDAwMDAwIG4gCjAwMDAwMTkyMzEgMDAwMDAgbiAKMDAwMDAxOTMzMCAwMDAwMCBuIAowMDAwMDE5NjAzIDAwMDAwIG4gCjAwMDAwMTk4MjMgMDAwMDAgbiAKMDAwMDAxOTkyMiAwMDAwMCBuIAowMDAwMDIwMTk1IDAwMDAwIG4gCjAwMDAwMjA0MTggMDAwMDAgbiAKMDAwMDAyMDc2OCAwMDAwMCBuIAowMDAwMDIwODY3IDAwMDAwIG4gCjAwMDAwMjExNDAgMDAwMDAgbiAKMDAwMDAyMTM4MSAwMDAwMCBuIAowMDAwMDIxNzUzIDAwMDAwIG4gCjAwMDAwMjE4NTIgMDAwMDAgbiAKMDAwMDAyMjEyNSAwMDAwMCBuIAowMDAwMDIyMzU0IDAwMDAwIG4gCjAwMDAwMjI0NTMgMDAwMDAgbiAKMDAwMDAyMjcyNiAwMDAwMCBuIAowMDAwMDIyOTQ2IDAwMDAwIG4gCjAwMDAwMjMwNDUgMDAwMDAgbiAKMDAwMDAyMzMzMiAwMDAwMCBuIAowMDAwMDIzNTY2IDAwMDAwIG4gCjAwMDAwMjM5MTYgMDAwMDAgbiAKMDAwMDAyNDI4MSAwMDAwMCBuIAowMDAwMDI0NjUyIDAwMDAwIG4gCjAwMDAwMjUwMTQgMDAwMDAgbiAKMDAwMDAyNTM3NiAwMDAwMCBuIAowMDAwMDI1NzM1IDAwMDAwIG4gCjAwMDAwMjYwOTEgMDAwMDAgbiAKMDAwMDAyNjE5MSAwMDAwMCBuIAowMDAwMDI2NDc5IDAwMDAwIG4gCjAwMDAwMjY3MDEgMDAwMDAgbiAKMDAwMDAyNzA3OSAwMDAwMCBuIAowMDAwMDI3NDQ2IDAwMDAwIG4gCjAwMDAwMjc1NDYgMDAwMDAgbiAKMDAwMDAyNzgyMSAwMDAwMCBuIAowMDAwMDI4MDM4IDAwMDAwIG4gCjAwMDAwMjgzOTcgMDAwMDAgbiAKMDAwMDAyODQ5NyAwMDAwMCBuIAowMDAwMDI4NzcyIDAwMDAwIG4gCjAwMDAwMjg5OTcgMDAwMDAgbiAKMDAwMDAyOTA5NyAwMDAwMCBuIAowMDAwMDI5Mzc0IDAwMDAwIG4gCjAwMDAwMjk1OTEgMDAwMDAgbiAKMDAwMDAyOTY5MSAwMDAwMCBuIAowMDAwMDI5OTgwIDAwMDAwIG4gCjAwMDAwMzAyMTMgMDAwMDAgbiAKMDAwMDAzMDMxMyAwMDAwMCBuIAowMDAwMDMwNTkyIDAwMDAwIG4gCjAwMDAwMzA4MzkgMDAwMDAgbiAKMDAwMDAzMTQxOSAwMDAwMCBuIAowMDAwMDMxNTA5IDAwMDAwIG4gCjAwMDAwMzE3NzIgMDAwMDAgbiAKMDAwMDAzMTgzNSAwMDAwMCBuIAowMDAwMDM0MDM1IDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDFjMTc4MTk4ZmJkZmE1MWIyNTk5NWQ4OWQ0MTAyMDQzPjwxYzE3ODE5OGZiZGZhNTFiMjU5OTVkODlkNDEwMjA0Mz5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gMTI5IDAgUgovUm9vdCAxMjggMCBSCi9TaXplIDEzMwo+PgpzdGFydHhyZWYKMzQ1MzAKJSVFT0YK";
const __c_ach_credit_authorization_pdf: Uint8Array = (() => {
  const bin = atob(__c_ach_credit_authorization_pdf_b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
})();

const contents: Record<string, string | Uint8Array> = {
  "ach-credit-authorization.instructions.md": __c_ach_credit_authorization_instructions_md,
  "ach-credit-authorization.md": __c_ach_credit_authorization_md,
  "ach-credit-authorization.pdf": __c_ach_credit_authorization_pdf,
};

const resolver = createMemoryResolver({ contents });

/**
 * ACH Credit Authorization
 *
 * Authorization by which a payee (consumer or organization) authorizes a named originator to initiate ACH credit entries to a deposit account at a named financial institution. Supports one-time and recurring credits, fixed or variable amounts, and optional B2B remittance / addenda fields. Used for vendor / accounts-payable, refunds, dividends, insurance claim payouts, government benefits, and royalty disbursements; governed by NACHA Operating Rules.
 */
export const achCreditAuthorization = Object.assign(p.form(schema, { resolver }), {
  /** The raw form spec, exactly as authored in artifacts/banking/ach-credit-authorization/. */
  spec: schema,
});

export default achCreditAuthorization;
