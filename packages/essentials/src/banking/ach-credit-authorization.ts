// AUTO-GENERATED from artifacts/banking/ach-credit-authorization/design/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-credit-authorization

import { para, createMemoryResolver } from "@paradoc/core";

const schema = {
  "$schema": "https://schema.paradoc.dev/schema.json",
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
      "maxLength": 100,
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
      "maxLength": 200,
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
      "maxLength": 200,
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
      "maxLength": 80,
      "required": false,
      "visible": true
    },
    "addendaText": {
      "type": "text",
      "label": "Addenda / remittance description (B2B CCD+ / CTX+ context)",
      "description": "Free-form addenda text included with B2B ACH credits (CCD+ / CTX+ standard entry classes). Used by the payee's A/R system to auto-apply the credit to open receivables.",
      "maxLength": 500,
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
      "expr": "not (paymentMode == 'recurring' and endCondition == 'end_date') or not endDate or not startDate or endDate > startDate",
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
      "checksum": "sha256:f22dc448547c6c7d17e6c0b0cb7e87fc6769e95b0f258af8d5b8f8c1e494d34f"
    },
    "pdf": {
      "kind": "file",
      "mimeType": "application/pdf",
      "title": "PDF Form",
      "path": "ach-credit-authorization.pdf",
      "checksum": "sha256:ea92869947c8311643f3e777a396b8508ea3b207d2fdf029e769b6e2f8feaa13",
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
            "x": 128,
            "y": 522,
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
            "x": 410,
            "y": 522,
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
            "x": 146,
            "y": 550,
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
            "x": 505,
            "y": 550,
            "width": 53,
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

- **Name:** {{parties.originator.legalName}}{{#if parties.originator.name}} (DBA {{parties.originator.name}}){{/if}}
- **Address:** {{originatorAddress.line1}}{{#if originatorAddress.line2}}, {{originatorAddress.line2}}{{/if}}, {{originatorAddress.locality}}, {{originatorAddress.region}} {{originatorAddress.postalCode}}
- **Phone:** {{originatorPhone}}
- **Email:** {{originatorEmail}}

## Payee

- **Type:**
  - [{{#if (eq payeeType "individual")}}x{{else}} {{/if}}] Individual
  - [{{#if (eq payeeType "organization")}}x{{else}} {{/if}}] Organization
- **Name:** {{#if (eq payeeType "organization")}}{{parties.payee.legalName}}{{#if parties.payee.name}} (DBA {{parties.payee.name}}){{/if}}{{else}}{{parties.payee.name}}{{/if}}
- **Address:** {{payeeAddress.line1}}{{#if payeeAddress.line2}}, {{payeeAddress.line2}}{{/if}}, {{payeeAddress.locality}}, {{payeeAddress.region}} {{payeeAddress.postalCode}}
- **Phone:** {{payeePhone}}
- **Email:** {{payeeEmail}}

## Account

- **Bank:** {{payeeBankName}}
- **Routing/ABA #:** {{payeeRoutingNumber}}
- **Account #:** {{payeeAccountNumber}}
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
- **Credit date:** {{paymentDate}}
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
- **Credit day(s):**
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
  - [{{#if (eq endCondition "count")}}x{{else}} {{/if}}] After {{creditCount}} credits
{{/if}}

- **Memo:** {{paymentMemo}}
- **Remittance reference:** {{remittanceReference}}
- **Addenda text:** {{addendaText}}

## Terms

1. This authorization remains in effect until I provide written notice of termination to the Originator.
2. Originator may initiate ACH debit entries to recover credits sent in error (clawback), and I agree to cooperate with the recovery of any such erroneous credits.
3. Origination of these transactions will comply with U.S. law and NACHA Operating Rules.
4. I represent that I am authorized to act with respect to the account identified above.
5. I will notify the Originator in writing of any change in account information; the Originator is not liable for credits sent to a previously valid account that has since been closed or changed without notice.

## Signature

{{#with parties.payee}}
**Signature:** {{signature "payeeSignature"}}
**Date:** {{signatureDate "payeeSignature"}}
**Printed name:** {{printedName "payeePrintedName"}}
{{#if (eq ../payeeType "organization")}}
**Title (organization):** {{capacity "payeeCapacity"}}
{{/if}}
{{/with}}
`;
const __c_ach_credit_authorization_pdf_b64 = "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtT2JsaXF1ZSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjMgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUgL0VuY29kaW5nIC9EaWZmZXJlbmNlcyBbMjQgL2JyZXZlIC9jYXJvbiAvY2lyY3VtZmxleCAvZG90YWNjZW50IC9odW5nYXJ1bWxhdXQgL29nb25layAvcmluZyAvdGlsZGUgMzkgL3F1b3Rlc2luZ2xlIDk2IC9ncmF2ZSAxMjggL2J1bGxldCAvZGFnZ2VyIC9kYWdnZXJkYmwgL2VsbGlwc2lzIC9lbWRhc2ggL2VuZGFzaCAvZmxvcmluIC9mcmFjdGlvbiAvZ3VpbHNpbmdsbGVmdCAvZ3VpbHNpbmdscmlnaHQgL21pbnVzIC9wZXJ0aG91c2FuZCAvcXVvdGVkYmxiYXNlIC9xdW90ZWRibGxlZnQgL3F1b3RlZGJscmlnaHQgL3F1b3RlbGVmdCAvcXVvdGVyaWdodCAvcXVvdGVzaW5nbGJhc2UgL3RyYWRlbWFyayAvZmkgL2ZsIC9Mc2xhc2ggL09FIC9TY2Fyb24gL1lkaWVyZXNpcyAvWmNhcm9uIC9kb3RsZXNzaSAvbHNsYXNoIC9vZSAvc2Nhcm9uIC96Y2Fyb24gMTYwIC9FdXJvIDE2NCAvY3VycmVuY3kgMTY2IC9icm9rZW5iYXIgMTY4IC9kaWVyZXNpcyAvY29weXJpZ2h0IC9vcmRmZW1pbmluZSAxNzIgL2xvZ2ljYWxub3QgLy5ub3RkZWYgL3JlZ2lzdGVyZWQgL21hY3JvbiAvZGVncmVlIC9wbHVzbWludXMgL3R3b3N1cGVyaW9yIC90aHJlZXN1cGVyaW9yIC9hY3V0ZSAvbXUgMTgzIC9wZXJpb2RjZW50ZXJlZCAvY2VkaWxsYSAvb25lc3VwZXJpb3IgL29yZG1hc2N1bGluZSAxODggL29uZXF1YXJ0ZXIgL29uZWhhbGYgL3RocmVlcXVhcnRlcnMgMTkyIC9BZ3JhdmUgL0FhY3V0ZSAvQWNpcmN1bWZsZXggL0F0aWxkZSAvQWRpZXJlc2lzIC9BcmluZyAvQUUgL0NjZWRpbGxhIC9FZ3JhdmUgL0VhY3V0ZSAvRWNpcmN1bWZsZXggL0VkaWVyZXNpcyAvSWdyYXZlIC9JYWN1dGUgL0ljaXJjdW1mbGV4IC9JZGllcmVzaXMgL0V0aCAvTnRpbGRlIC9PZ3JhdmUgL09hY3V0ZSAvT2NpcmN1bWZsZXggL090aWxkZSAvT2RpZXJlc2lzIC9tdWx0aXBseSAvT3NsYXNoIC9VZ3JhdmUgL1VhY3V0ZSAvVWNpcmN1bWZsZXggL1VkaWVyZXNpcyAvWWFjdXRlIC9UaG9ybiAvZ2VybWFuZGJscyAvYWdyYXZlIC9hYWN1dGUgL2FjaXJjdW1mbGV4IC9hdGlsZGUgL2FkaWVyZXNpcyAvYXJpbmcgL2FlIC9jY2VkaWxsYSAvZWdyYXZlIC9lYWN1dGUgL2VjaXJjdW1mbGV4IC9lZGllcmVzaXMgL2lncmF2ZSAvaWFjdXRlIC9pY2lyY3VtZmxleCAvaWRpZXJlc2lzIC9ldGggL250aWxkZSAvb2dyYXZlIC9vYWN1dGUgL29jaXJjdW1mbGV4IC9vdGlsZGUgL29kaWVyZXNpcyAvZGl2aWRlIC9vc2xhc2ggL3VncmF2ZSAvdWFjdXRlIC91Y2lyY3VtZmxleCAvdWRpZXJlc2lzIC95YWN1dGUgL3Rob3JuIC95ZGllcmVzaXNdPj4KZW5kb2JqCjYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNyAwIG9iago8PAovQkJveCBbIDAgMCAxODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwtABiI4WiVK40Lv2QCgUnX2cFrkI0qXCuPKAISIM7VyCXq68zFwAZgQ6ZZW5kc3RyZWFtCmVuZG9iago4IDAgb2JqCjw8Ci9BUCA8PAovTiA3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyA4Mi41MDUgNjYwIDI2Mi41MDUgNjcyIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvck5hbWUpIAogIC9UVSAoTmFtZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyOS40OTUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2OCAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMrLUM7E0VTA0UihK5Urj0g+pUHDydVbgKsQiHc6VBxQFaXTnCuRy9XXmAgCWrxBBZW5kc3RyZWFtCmVuZG9iagoxMSAwIG9iago8PAovQVAgPDwKL04gMTAgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDMxNi4wMTkgNjYwIDU0NS41MTQgNjcyIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvckFkZHJlc3NMaW5lMSkgCiAgL1RVIChBZGRyZXNzKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEyIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEzIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULAwUDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD9cQ43ZW5kc3RyZWFtCmVuZG9iagoxNCAwIG9iago8PAovQVAgPDwKL04gMTMgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDc0IDY0MiAxNTQgNjU0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvckNpdHkpIAogIC9UVSAoQ2l0eSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxNSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxNiAwIG9iago8PAovQkJveCBbIDAgMCAyNSAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTUgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMlUwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/RcONWVuZHN0cmVhbQplbmRvYmoKMTcgMCBvYmoKPDwKL0FQIDw8Ci9OIDE2IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAxODcuNTE3IDY0MiAyMTIuNTE3IDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JTdGF0ZSkgCiAgL1RVIChTdGF0ZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxOSAwIG9iago8PAovQkJveCBbIDAgMCA1MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNVAwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/IEOMWVuZHN0cmVhbQplbmRvYmoKMjAgMCBvYmoKPDwKL0FQIDw8Ci9OIDE5IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAyMzcuNTIgNjQyIDI4Ny41MiA2NTQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChvcmlnaW5hdG9yWmlwKSAKICAvVFUgKFppcCkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoyMSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoyMiAwIG9iago8PAovQkJveCBbIDAgMCA4MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMjEgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFCwMFAwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/XEON2VuZHN0cmVhbQplbmRvYmoKMjMgMCBvYmoKPDwKL0FQIDw8Ci9OIDIyIDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAzMjYuMDQxIDY0MiA0MDYuMDQxIDY1NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9yaWdpbmF0b3JQaG9uZSkgCiAgL1RVIChQaG9uZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoyNCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoyNSAwIG9iago8PAovQkJveCBbIDAgMCA5My45NTkgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDI0IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDTWszS1VDA0UihK5Urj0g+pUHDydVbgKsSUDefKAwqCtLlzBXK5+jpzAQB5Pg/pZW5kc3RyZWFtCmVuZG9iagoyNiAwIG9iago8PAovQVAgPDwKL04gMjUgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDQ0MS4wNDMgNjQyIDUzNS4wMDIgNjU0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAob3JpZ2luYXRvckVtYWlsKSAKICAvVFUgKEVtYWlsKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjI3IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDkgOSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDE2MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGXSA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJxNUEEOgzAMu/cVfkHUlqRNXsCZfaHa2GUH2GHfXwBBUdIothzL6hISZiSMIPXmwfd1RvQyr/WJV6CEox8jIgl+PrMcQ+l4LvyGKSy4xO5yOwxkYJLIpgUfOCrEZswFmSQL6+YT1RV5F5rV3Jm2yZVZtXPqxs5Wk5h2cPm3HbrvELmmfkqW2ES7/0m0HuKkPKFzKUouuGdvePuXTH8J5z39ZW5kc3RyZWFtCmVuZG9iagoyOCAwIG9iago8PAovQkJveCBbIDAgMCA5IDkgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NCAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGXSA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJwr5DJUSFcwVHBX0LMAIhNjILsoXcEACC2BsChVIY1Lz1ABgoLcFQz0TBXKgaSRKYSw0INgoMJirkAAcFMQB2VuZHN0cmVhbQplbmRvYmoKMjkgMCBvYmoKPDwKL0JCb3ggWyAwIDAgOSA5IF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggMTY2IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREZdID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nFVQQQ7DMAi75xV+AUoySOAFPXdfqLbuskO7w74/0qpNJ2QkLGMslpAwI2EA1ewQrSDDOiN6mdf6wDNQNBy4D4gk+HrPsjelHa79hDEsuOrd6389+AEmiWxa8G7nCrEZc0EmycLa3KK6Im9CM892MlOTK7Nq55RSY6tJTNtw+k/b6L63yDX1VbLEJtr9D2LqIQ7KEzqXouSCa/YJL//N+AM82ECYZW5kc3RyZWFtCmVuZG9iagozMCAwIG9iago8PAovQkJveCBbIDAgMCA5IDkgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2OSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGXSA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJwr5DJUSFcwVHBX0DM3AmJTC3MFPUuFonQFAyC0BMKiVIU0Lj0DSwUYDnJXMNAzVSgHkkamEMJCD4KBaou5AgHXExFSZW5kc3RyZWFtCmVuZG9iagozMSAwIG9iago8PAovQkJveCBbIDAgMCA5IDkgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCAxNjQgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERl0gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnicVVBBDsIwDLv3FX5B1JSkTV6wM3xhgnHhsHHg+2SbRociR7LlWFbmxJjAGEBWAmot2DIhx3jMcscjETsO3AZkUnxiF92X0Y7wvtM1zTj7I+v/PJFDSLO4VbwQrJK4i1QU0qJia1q2cJTN6N5KV8bVbiJmXTPiVW2umTfyyx83GrmXLI37KTmLq/X8Qxh7iUOKhqFx1lJx7j7iGb+5fgEDy0BtZW5kc3RyZWFtCmVuZG9iagozMiAwIG9iago8PAovQkJveCBbIDAgMCA5IDkgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGXSA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJwr5DJUSFcwVHBX0LMwAmJTC3MgryhdwQAILYGwKFUhjUvP0FIBhoPcFQz0TBXKgaSRKYSw0INgoNpirkAAxrMRIWVuZHN0cmVhbQplbmRvYmoKMzMgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDEwNi45MSA2MjAgMTE1LjkxIDYyOSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVlVHlwZV9pbmRpdmlkdWFsKSAKICAvVFUgKEluZGl2aWR1YWwgXChpbmRpdmlkdWFsXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagozNCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgMTczLjkyNiA2MjAgMTgyLjkyNiA2MjkgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllZVR5cGVfb3JnYW5pemF0aW9uKSAKICAvVFUgKE9yZ2FuaXphdGlvbiBcKG9yZ2FuaXphdGlvblwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMzUgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMzYgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjIgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAzNSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDC0AGIjhaJUrjQu/ZAKBSdfZwWuQjSpcK48oAhIgztXIJerrzMXABmBDpllbmRzdHJlYW0KZW5kb2JqCjM3IDAgb2JqCjw8Ci9BUCA8PAovTiAzNiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgODIuNTA1IDU5NiAyNjIuNTA1IDYwOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVlTmFtZSkgCiAgL1RVIChOYW1lKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjM4IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjM5IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyOS40OTUgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2OCAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDM4IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDKy1DOxNFUwNFIoSuVK49IPqVBw8nVW4CrEIh3OlQcUBWl05wrkcvV15gIAlq8QQWVuZHN0cmVhbQplbmRvYmoKNDAgMCBvYmoKPDwKL0FQIDw8Ci9OIDM5IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAzMTYuMDE5IDU5NiA1NDUuNTE0IDYwOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVlQWRkcmVzc0xpbmUxKSAKICAvVFUgKEFkZHJlc3MpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNDEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDIgMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQxIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDBQMDRSKErlSuPSD6lQcPJ1VuAqRJUJ58oDCoCUu3MFcrn6OnMBAP1xDjdlbmRzdHJlYW0KZW5kb2JqCjQzIDAgb2JqCjw8Ci9BUCA8PAovTiA0MiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgNzQgNTc4IDE1NCA1OTAgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllZUNpdHkpIAogIC9UVSAoQ2l0eSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago0NCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago0NSAwIG9iago8PAovQkJveCBbIDAgMCAyNSAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNDQgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMlUwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/RcONWVuZHN0cmVhbQplbmRvYmoKNDYgMCBvYmoKPDwKL0FQIDw8Ci9OIDQ1IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAxODcuNTE3IDU3OCAyMTIuNTE3IDU5MCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheWVlU3RhdGUpIAogIC9UVSAoU3RhdGUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNDcgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDggMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQ3IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDVQMDRSKErlSuPSD6lQcPJ1VuAqRJUJ58oDCoCUu3MFcrn6OnMBAPyBDjFlbmRzdHJlYW0KZW5kb2JqCjQ5IDAgb2JqCjw8Ci9BUCA8PAovTiA0OCAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMjM3LjUyIDU3OCAyODcuNTIgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVaaXApIAogIC9UVSAoWmlwKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjUwIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjUxIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1MCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULAwUDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD9cQ43ZW5kc3RyZWFtCmVuZG9iago1MiAwIG9iago8PAovQVAgPDwKL04gNTEgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDMyNi4wNDEgNTc4IDQwNi4wNDEgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVQaG9uZSkgCiAgL1RVIChQaG9uZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago1MyAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago1NCAwIG9iago8PAovQkJveCBbIDAgMCA5My45NTkgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDUzIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDTWszS1VDA0UihK5Urj0g+pUHDydVbgKsSUDefKAwqCtLlzBXK5+jpzAQB5Pg/pZW5kc3RyZWFtCmVuZG9iago1NSAwIG9iago8PAovQVAgPDwKL04gNTQgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDQ0MS4wNDMgNTc4IDUzNS4wMDIgNTkwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVFbWFpbCkgCiAgL1RVIChFbWFpbCkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago1NiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago1NyAwIG9iago8PAovQkJveCBbIDAgMCAxMzAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDU2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQGYiOFolSuNC79kAoFJ19nBa5CNKlwrjygCEiDO1cgl6uvMxcAF+wOj2VuZHN0cmVhbQplbmRvYmoKNTggMCBvYmoKPDwKL0FQIDw8Ci9OIDU3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyA3OS4wMTMgNTM0IDIwOS4wMTMgNTQ2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVCYW5rTmFtZSkgCiAgL1RVIChCYW5rKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjU5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjYwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDkwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA1OSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULA0UDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD9wQ45ZW5kc3RyZWFtCmVuZG9iago2MSAwIG9iago8PAovQVAgPDwKL04gNjAgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDI2NC4wMzUgNTM0IDM1NC4wMzUgNTQ2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5ZWVSb3V0aW5nTnVtYmVyKSAKICAvVFUgKFJvdXRpbmcgIykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago2MiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago2MyAwIG9iago8PAovQkJveCBbIDAgMCAxMzEuOTY1IDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNzIgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA2MiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA0NtSzNDOxhANzBUMjhaJUrjQu/ZAKBSdfZwWuQvwqw7nygApAxrlzBXK5+jpzAQBBSBUVZW5kc3RyZWFtCmVuZG9iago2NCAwIG9iago8PAovQVAgPDwKL04gNjMgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDQxMC41NiA1MzQgNTQyLjUyNSA1NDYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXllZUFjY291bnROdW1iZXIpIAogIC9UVSAoQWNjb3VudCAjKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjY1IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyA1NCA1MTYgNjMgNTI1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudFR5cGVfY2hlY2tpbmcpIAogIC9UVSAoQ2hlY2tpbmcgXChjaGVja2luZ1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNjYgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDEyMC41MTIgNTE2IDEyOS41MTIgNTI1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudFR5cGVfc2F2aW5ncykgCiAgL1RVIChTYXZpbmdzIFwoc2F2aW5nc1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNjcgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250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QW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNzcgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDU0IDQ3MiA2MyA0ODEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXltZW50TW9kZV9vbmV0aW1lKSAKICAvVFUgKE9uZS10aW1lIFwob25lX3RpbWVcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjc4IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyAxMjAuMDA4IDQ3MiAxMjkuMDA4IDQ4MSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHBheW1lbnRNb2RlX3JlY3VycmluZykgCiAgL1RVIChSZWN1cnJpbmcgXChyZWN1cnJpbmdcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjc5IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjgwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA3OSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULAwUDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD9cQ43ZW5kc3RyZWFtCmVuZG9iago4MSAwIG9iago8PAovQVAgPDwKL04gODAgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDE1NC41MiA0NTQgMjM0LjUyIDQ2NiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKG9uZVRpbWVBbW91bnQpIAogIC9UVSAoQW1vdW50ICQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKODIgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKODMgMCBvYmoKPDwKL0JCb3ggWyAwIDAgOTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDgyIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDRQMDRSKErlSuPSD6lQcPJ1VuAqRJUJ58oDCoCUu3MFcrn6OnMBAP3BDjllbmRzdHJlYW0KZW5kb2JqCjg0IDAgb2JqCjw8Ci9BUCA8PAovTiA4MyAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMjk1LjA0MSA0NTQgMzg1LjA0MSA0NjYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChwYXltZW50RGF0ZSkgCiAgL1RVIChDcmVkaXQgZGF0ZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago4NSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgMTE0IDQzNiAxMjMgNDQ1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYW1vdW50TW9kZV9maXhlZCkgCiAgL1RVIChGaXhlZCAkIFwoZml4ZWRcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjg2IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjg3IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDYwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA4NiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAzUDA0UihK5Urj0g+pUHDydVbgKkSVCefKAwqAlLtzBXK5+jpzAQD80Q4zZW5kc3RyZWFtCmVuZG9iago4OCAwIG9iago8PAovQVAgPDwKL04gODcgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDE2NC41MTEgNDM2IDIyNC41MTEgNDQ4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocmVjdXJyaW5nRml4ZWRBbW91bnQpIAogIC9UVSAocmVjdXJyaW5nRml4ZWRBbW91bnQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKODkgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDIzNi41MTEgNDM2IDI0NS41MTEgNDQ1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYW1vdW50TW9kZV92YXJpYWJsZSkgCiAgL1RVIChWYXJpYWJsZTogbWluICQgXCh2YXJpYWJsZVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKOTAgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKOTEgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MyAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkwIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDVQMDRSKErlSuPSD6lQcPJ1VuAqRJUJ58oDCoCUu3MFcrn6OnMBAPyBDjFlbmRzdHJlYW0KZW5kb2JqCjkyIDAgb2JqCjw8Ci9BUCA8PAovTiA5MSAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMzE3LjUzMiA0MzYgMzY3LjUzMiA0NDggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhbW91bnRSYW5nZU1pbikgCiAgL1RVIChhbW91bnRSYW5nZU1pbikgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago5MyAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago5NCAwIG9iago8PAovQkJveCBbIDAgMCA1MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgOTMgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNVAwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/IEOMWVuZHN0cmVhbQplbmRvYmoKOTUgMCBvYmoKPDwKL0FQIDw8Ci9OIDk0IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyA0MDIuMDM5IDQzNiA0NTIuMDM5IDQ0OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFtb3VudFJhbmdlTWF4KSAKICAvVFUgKG1heCAkKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjk2IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjk3IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDQ3Ljk2MSAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDcwIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgOTYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMdezNDM0gANDBUMjhaJUrjQu/ZAKBSdfZwWuQrwKw7nygPIgw9y5ArlcfZ25APSlE/tlbmRzdHJlYW0KZW5kb2JqCjk4IDAgb2JqCjw8Ci9BUCA8PAovTiA5NyAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgNDkxLjU1IDQzNiA1MzkuNTExIDQ0OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFtb3VudFNvdXJjZSkgCiAgL1RVIChzb3VyY2UpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKOTkgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDExNCA0MTYgMTIzIDQyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV93ZWVrbHkpIAogIC9UVSAoV2Vla2x5IFwod2Vla2x5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDAgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDE2NC41MDIgNDE2IDE3My41MDIgNDI1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZnJlcXVlbmN5X2Jpd2Vla2x5KSAKICAvVFUgKEJpLXdrbHkgXChiaV93ZWVrbHlcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwMSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgMjEzLjk5NiA0MTYgMjIyLjk5NiA0MjUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChmcmVxdWVuY3lfc2VtaW1vbnRobHkpIAogIC9UVSAoU2VtaS1tbyBcKHNlbWlfbW9udGhseVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTAyIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyAyNzAuOTk2IDQxNiAyNzkuOTk2IDQyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV9tb250aGx5KSAKICAvVFUgKE1vbnRobHkgXChtb250aGx5XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDMgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgMzAgMCBSIC9ZZXMgMjkgMCBSCj4+IC9OIDw8Ci9PZmYgMjggMCBSIC9ZZXMgMjcgMCBSCj4+IC9SIDw8Ci9PZmYgMzIgMCBSIC9ZZXMgMzEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTI3IDAgUiAvUmVjdCBbIDMyMy41MDUgNDE2IDMzMi41MDUgNDI1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZnJlcXVlbmN5X3F1YXJ0ZXJseSkgCiAgL1RVIChRdHIgXChxdWFydGVybHlcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwNCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgMzU3LjAwNiA0MTYgMzY2LjAwNiA0MjUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChmcmVxdWVuY3lfYW5udWFsKSAKICAvVFUgKEFubnVhbCBcKGFubnVhbFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTA1IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDMwIDAgUiAvWWVzIDI5IDAgUgo+PiAvTiA8PAovT2ZmIDI4IDAgUiAvWWVzIDI3IDAgUgo+PiAvUiA8PAovT2ZmIDMyIDAgUiAvWWVzIDMxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDEyNyAwIFIgL1JlY3QgWyA0MDYuMDIzIDQxNiA0MTUuMDIzIDQyNSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGZyZXF1ZW5jeV9vdGhlcikgCiAgL1RVIChPdGhlciBcKG90aGVyXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMDYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTA3IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIzMS45OTEgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA3MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEwNiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAyNtSztDSwRAAFQyOFolSuNC79kAoFJ19nBa5C/CrDufKACkDGuXMFcrn6OnMBAEIWFRllbmRzdHJlYW0KZW5kb2JqCjEwOCAwIG9iago8PAovQVAgPDwKL04gMTA3IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAyOTkuNTM1IDM5NiA1MzEuNTI2IDQwOCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKHN0YXJ0RGF0ZSkgCiAgL1RVIChTdGFydCBkYXRlKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEwOSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgODIgMzc2IDkxIDM4NSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVuZENvbmRpdGlvbl91bnRpbGNhbmNlbGxlZCkgCiAgL1RVIChVbnRpbCBjYW5jZWxsZWQgXCh1bnRpbF9jYW5jZWxsZWRcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjExMCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgMTY5LjUxOCAzNzYgMTc4LjUxOCAzODUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbmRDb25kaXRpb25fZW5kZGF0ZSkgCiAgL1RVIChFbmQgZGF0ZSBcKGVuZF9kYXRlXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMTEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTEyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDcwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjMgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTEgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwN1AwNFIoSuVK49IPqVBw8nVW4CpElQnnygMKgJS7cwVyufo6cwEA/SEONWVuZHN0cmVhbQplbmRvYmoKMTEzIDAgb2JqCjw8Ci9BUCA8PAovTiAxMTIgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDIyNi41NDUgMzc2IDI5Ni41NDUgMzg4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZW5kRGF0ZSkgCiAgL1RVIChlbmREYXRlKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjExNCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiAzMCAwIFIgL1llcyAyOSAwIFIKPj4gL04gPDwKL09mZiAyOCAwIFIgL1llcyAyNyAwIFIKPj4gL1IgPDwKL09mZiAzMiAwIFIgL1llcyAzMSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxMjcgMCBSIC9SZWN0IFsgMzEyLjU0NSAzNzYgMzIxLjU0NSAzODUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbmRDb25kaXRpb25fY291bnQpIAogIC9UVSAoQ291bnQgXChjb3VudFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTE1IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjExNiAwIG9iago8PAovQkJveCBbIDAgMCA1MCAxMiBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYzIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTE1IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDVQMDRSKErlSuPSD6lQcPJ1VuAqRJUJ58oDCoCUu3MFcrn6OnMBAPyBDjFlbmRzdHJlYW0KZW5kb2JqCjExNyAwIG9iago8PAovQVAgPDwKL04gMTE2IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyAzNTcuNTU3IDM3NiA0MDcuNTU3IDM4OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGNyZWRpdENvdW50KSAKICAvVFUgKGNyZWRpdENvdW50KSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjExOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMTkgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMjAwIDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjQgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMjBQMDRSKErlSuPSD6lQcPJ1VuAqRJMK58oDioA0uHMFcrn6OnMBABdMDotlbmRzdHJlYW0KZW5kb2JqCjEyMCAwIG9iago8PAovQVAgPDwKL04gMTE5IDAgUgo+PiAvREEgKC9IZWx2IDkgVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDEyNyAwIFIgL1JlY3QgWyA4My41MDQgMzU2IDI4My41MDQgMzY4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAocGF5bWVudE1lbW8pIAogIC9UVSAoTWVtbykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMjEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTIyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDE4Mi40OTYgMTIgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA3MiAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEyMSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDC0MNIzsTS1hAMLBUMjhaJUrjQu/ZAKBSdfZwWuQvwqw7nygApAxrlzBXK5+jpzAQBEFhUhZW5kc3RyZWFtCmVuZG9iagoxMjMgMCBvYmoKPDwKL0FQIDw8Ci9OIDEyMiAwIFIKPj4gL0RBICgvSGVsdiA5IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxMjcgMCBSIC9SZWN0IFsgMzQ5LjAyOSAzNTYgNTMxLjUyNSAzNjggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChyZW1pdHRhbmNlUmVmZXJlbmNlKSAKICAvVFUgKFJlZmVyZW5jZSAjKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEyNCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMjUgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMzI0IDEyIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjYgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMjQgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNjLRM1AwNFIoSuVK49IPqVBw8nVW4CrEkAznygOKgTS5cwVyufo6cwEAUpkPVWVuZHN0cmVhbQplbmRvYmoKMTI2IDAgb2JqCjw8Ci9BUCA8PAovTiAxMjUgMCBSCj4+IC9EQSAoL0hlbHYgOSBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTI3IDAgUiAvUmVjdCBbIDE4Ni41NjMgMzM4IDUxMC41NjMgMzUwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWRkZW5kYVRleHQpIAogIC9UVSAoQWRkZW5kYSAvIHJlbWl0dGFuY2UgdGV4dCBcKEIyQlwpKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEyNyAwIG9iago8PAovQW5ub3RzIFsgOCAwIFIgMTEgMCBSIDE0IDAgUiAxNyAwIFIgMjAgMCBSIDIzIDAgUiAyNiAwIFIgMzMgMCBSIDM0IDAgUiAzNyAwIFIgCiAgNDAgMCBSIDQzIDAgUiA0NiAwIFIgNDkgMCBSIDUyIDAgUiA1NSAwIFIgNTggMCBSIDYxIDAgUiA2NCAwIFIgNjUgMCBSIAogIDY2IDAgUiA2OSAwIFIgNzYgMCBSIDc3IDAgUiA3OCAwIFIgODEgMCBSIDg0IDAgUiA4NSAwIFIgODggMCBSIDg5IDAgUiAKICA5MiAwIFIgOTUgMCBSIDk4IDAgUiA5OSAwIFIgMTAwIDAgUiAxMDEgMCBSIDEwMiAwIFIgMTAzIDAgUiAxMDQgMCBSIDEwNSAwIFIgCiAgMTA4IDAgUiAxMDkgMCBSIDExMCAwIFIgMTEzIDAgUiAxMTQgMCBSIDExNyAwIFIgMTIwIDAgUiAxMjMgMCBSIDEyNiAwIFIgXSAvQ29udGVudHMgMTMxIDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgMTMwIDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAKICAvVHJhbnMgPDwKCj4+IC9UeXBlIC9QYWdlCj4+CmVuZG9iagoxMjggMCBvYmoKPDwKL0Fjcm9Gb3JtIDEzMiAwIFIgL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyAxMzAgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iagoxMjkgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwNTAyMTMzNDM2LTA0JzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwNTAyMTMzNDM2LTA0JzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjEzMCAwIG9iago8PAovQ291bnQgMSAvS2lkcyBbIDEyNyAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEzMSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyMTAyCj4+CnN0cmVhbQpHYXQ9LGdNWWUpJjpNbCsmODMrQzdBR2AhPy4oK1Q5aShxL2dyPmZ0Li8mQFxcNmRhdFwuW0U9cD9PZlFraTAjMFEmPEEuVyRUY1gpOXMqL00sPVFZWWwtZDomTlg5byskWC5kJCFNNlpBY1k5Yj9kXGNELyxQcFIpdURmK1AyU1J0Jjs4c2FfQXBNdC1DJjdlRzQ+c09CT244JjNucnQraDVHZ1c8ZCInPlhvQ2xWbXNBI2smZCtSLGQ7cXVUT29SOm1pXDdYKVFVbD9MTT1hUTtYJShwRjknRWlQUHBnNChESWNVLywkY0VuLkJTOGhhSSYpTTFNIT0kLSFSYWpaQVYvO2ViX3JgUSw9LElYMUlFL1olXytbQmAwOigvYFs9LyQqaEpaYGYnbSFOWk1QLURIX2lnYC1HZ2EkP1o2aCM8VD9HaURgTHFaM1hcLE81U3AtMGVmckwjbWtqdEA/cHBBZDRoIlo1aVRfY0UlR1hJaFQzLXIrSlErKytcazA2QjA+Kz4vUlU/OjBQWDAzUFdoYnBgK0IyU0U2Ui5lNENCLmsqcjAhV1E7OWQrLFIvPSJPJiVJbzdsLyVONkdMRC1yMiZnLz05bydHZFpHZ1I/bVxDZGgjXis6cWxbKiE+Yk07b0pSUW1BX0k1OV5MNFFBXCRITWJQJ1dSUFlAMTolOWw/UEFONW86WlJGJVI1b0ZJbjtAUGdiZjI4TEZnaFJecTY2JThubVBcOmhQc0VxUSpyXWRTbkBxX0NiViJZIzpTUiZmQE08OFQqI1ZwXyQzbkkxLUIxYEBnbU4wWXAiQGxeWWZhNClQWzUqS3Q0Oi88OiZhLCpsckgoKHFgJWYpPlUqSWFwNXEmR3FsNC5bNidsOkkuZllYa0guYEA2TCVROzQuRkJmXnJrNEpybllHV0xPQmlBbVQuYzZKWlNtUm9PPTslQShOVVpROT4tO2VaU2NVRHQ4UHQ8RiMuW1dzPzMha0FmZ3RmdSFLaydwWG4kVDA1ZDxBTjkqXk1ib1QmWlBtKHNWKjg7PDFnSkVOZ2UjKGRMPlsqPk40S2ArMDBTIlNtdEhiVisscF0qIkNjPEFkQjciSmM6NSgoVURtMCEoIzJaUGo/UyVGbkoxL1Vca1pgYkI4MyVTY2k6YlxTWFpBPWkzXiVJSThYMT8xUDI9cG9TdChILGVUQV9pLT5QaSMjSVE0ZmhAayVYUF9ZaDRAXVk6Qj9LWCY6UyxTZSpzOSVjaWh0cC5bP0phWTEnP2BjYSNpYjpST2haZkJqczZhLVVdbCEycVlJUV5QazVxNV8hUW44O2twNEpiR0FXXjNUQmAoRkVUPEEwalpDNnM+XDdkWFZIRXBJKFRoLSZhVkAyXyxURmZhXmxFXW8zcT9mZ2hISipXOUJ1ZGEkMy9YUVtNI0dfRSFHISVsTkZrM1U/W1dORyZpWU1sTEl0UHUxbURKRU4pOz9JLilpSWtkQWYyRjdQaClWcXVoQ0lNUV1zaGBCalZwMj4mZWImIzVPbSw3PUFWOCg2JmQtQ2AuL1FKcW1CZC4pKEQvcltFYS83NGYvMiJJOVBYS29iRDgxUDVAVmopREVARzEyZ0ZvWF9sKlE1TDdxbVs+bTVYVV0kKXFcUyhiPlEjKmxYXm4+ST1ndW4/MFUwMzQiLSkpLykrTTFUcG9XWkEoXkVtWWkyW2BRTTE3YzooSk1BNGlFV0JhXm1xLDdTciEicEdNP0I9Z2FfWDtkQ3Q1KDhuQ1JiKzknO1JCbCI8P1AuTTxGN1ZeMUwkWE9AYEs+LUlNJTp1KHEuLkxPZl5aVlhubXRzcW5wXXVoOHVpIylVPDciRDRUQlNzQktmKiE5dV8/WURcbzk0PCouV2lGOy0iSUspPHNgODMyXUFlaTFJZGkyX2QyYGQlYWkjNlopRFJuJWJqSiRhPlEqKEtQb09GKV0oWkNYKzs2QWxcTD1rPFcjQlliUTcqKj5ESFhfYVhbYi9vKyIxKmE5WFphbD1dJGVVRCIyIXJUJVpIPEBJJlxkXzFLI1ovVkNBQ2wpYzBDZ2g6V2o4RHEpa0MlQDhCRyYzSHE1MTRiVkhHKD1WVmhWS05FbUFxYDFaWVojQ2cjQUopYU4mYTQpL1Y8R3FnaHBdI2RHP0EyJyY+TT4iKkNtNVlsVDJfS3JTPCwwWTYrbWgrX1VkJEkqbSYrJ2lGXmkiNiFtZEgrc2glU3EiIkYqVFJRZCp0Um5JLWEsTjM8M25ucj8qJi8pOzpmY1JfKT9MXG5RXCdaY1dYRkdVJ04rYydvZjohOFVwKUVTRiN1bSoiXGo/OGZUOTlWV2ldTjteYmVTU1ZfRCxIPWRUayUwR2w8PDVPXTAoNF0jNFI0JGEqKmBeUy1uUCdebkRPZF09alVnW24mVGdVOlI+X2s2Rk1XPyFXPTtJclAiRUYiMixCJWZOSmJkX24hI2kkdXMzPm4pIURnTzdVO2xZSUsvIShpNClwWG0nSCRbWU9Bb0o9aVBzXnJcdURcJ2JDUzQ/R0RCKTR1I2pYKGtpdFYlKSRQQG49WmVpJ0UnNmpVZlhdXGlJYjw4MFtsJmw/cyVbSGs7IlM0NSs+VmU+SXNmciJcXC5cY3FlVTFcRCZHQHVyM2xXVEs1LVAkcDJSMy0rQGUzMyZVSzU/J0lPW1JZRXIvL2ghYVdyZiFvUTUnMUMlOWxxL2huPEcsTj9xT0Q2SHM1Kk5eZSlqSUgiPGZdIV10ajs0Q1FLXGg3Z1gmNjlidGxPVGFlRUhrIiJEO1gwVVVLQEhyZWlgc3N+PmVuZHN0cmVhbQplbmRvYmoKMTMyIDAgb2JqCjw8Ci9EQSAoL0hlbHYgMCBUZiAwIGcpIC9EUiA8PCAvRW5jb2RpbmcKPDwKL1JMQUZlbmNvZGluZwo1IDAgUgo+PgovRm9udCA8PCAvSGVsdiA2IDAgUiA+Pgo+PiAvRmllbGRzIFsgOCAwIFIgMTEgMCBSIDE0IDAgUiAxNyAwIFIgMjAgMCBSIDIzIDAgUiAyNiAwIFIgMzMgMCBSIDM0IDAgUiAzNyAwIFIgCiAgNDAgMCBSIDQzIDAgUiA0NiAwIFIgNDkgMCBSIDUyIDAgUiA1NSAwIFIgNTggMCBSIDYxIDAgUiA2NCAwIFIgNjUgMCBSIAogIDY2IDAgUiA2OSAwIFIgNzYgMCBSIDc3IDAgUiA3OCAwIFIgODEgMCBSIDg0IDAgUiA4NSAwIFIgODggMCBSIDg5IDAgUiAKICA5MiAwIFIgOTUgMCBSIDk4IDAgUiA5OSAwIFIgMTAwIDAgUiAxMDEgMCBSIDEwMiAwIFIgMTAzIDAgUiAxMDQgMCBSIDEwNSAwIFIgCiAgMTA4IDAgUiAxMDkgMCBSIDExMCAwIFIgMTEzIDAgUiAxMTQgMCBSIDExNyAwIFIgMTIwIDAgUiAxMjMgMCBSIDEyNiAwIFIgXQo+PgplbmRvYmoKeHJlZgowIDEzMwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQ0NiAwMDAwMCBuIAowMDAwMDAxNzY4IDAwMDAwIG4gCjAwMDAwMDE4NjYgMDAwMDAgbiAKMDAwMDAwMjE1MyAwMDAwMCBuIAowMDAwMDAyNDA1IDAwMDAwIG4gCjAwMDAwMDI1MDMgMDAwMDAgbiAKMDAwMDAwMjgwMSAwMDAwMCBuIAowMDAwMDAzMDY3IDAwMDAwIG4gCjAwMDAwMDMxNjYgMDAwMDAgbiAKMDAwMDAwMzQ1NSAwMDAwMCBuIAowMDAwMDAzNzAxIDAwMDAwIG4gCjAwMDAwMDM4MDAgMDAwMDAgbiAKMDAwMDAwNDA4OSAwMDAwMCBuIAowMDAwMDA0MzQ2IDAwMDAwIG4gCjAwMDAwMDQ0NDUgMDAwMDAgbiAKMDAwMDAwNDczNCAwMDAwMCBuIAowMDAwMDA0OTg1IDAwMDAwIG4gCjAwMDAwMDUwODQgMDAwMDAgbiAKMDAwMDAwNTM3MyAwMDAwMCBuIAowMDAwMDA1NjMwIDAwMDAwIG4gCjAwMDAwMDU3MjkgMDAwMDAgbiAKMDAwMDAwNjAyNiAwMDAwMCBuIAowMDAwMDA2MjgzIDAwMDAwIG4gCjAwMDAwMDY2NDEgMDAwMDAgbiAKMDAwMDAwNjkwMCAwMDAwMCBuIAowMDAwMDA3MjYyIDAwMDAwIG4gCjAwMDAwMDc1MjYgMDAwMDAgbiAKMDAwMDAwNzg4NiAwMDAwMCBuIAowMDAwMDA4MTQ4IDAwMDAwIG4gCjAwMDAwMDg1MzQgMDAwMDAgbiAKMDAwMDAwODkyOCAwMDAwMCBuIAowMDAwMDA5MDI3IDAwMDAwIG4gCjAwMDAwMDkzMTYgMDAwMDAgbiAKMDAwMDAwOTU2NSAwMDAwMCBuIAowMDAwMDA5NjY0IDAwMDAwIG4gCjAwMDAwMDk5NjMgMDAwMDAgbiAKMDAwMDAxMDIyNCAwMDAwMCBuIAowMDAwMDEwMzIzIDAwMDAwIG4gCjAwMDAwMTA2MTIgMDAwMDAgbiAKMDAwMDAxMDg1MyAwMDAwMCBuIAowMDAwMDEwOTUyIDAwMDAwIG4gCjAwMDAwMTEyNDEgMDAwMDAgbiAKMDAwMDAxMTQ5MyAwMDAwMCBuIAowMDAwMDExNTkyIDAwMDAwIG4gCjAwMDAwMTE4ODEgMDAwMDAgbiAKMDAwMDAxMjEyNyAwMDAwMCBuIAowMDAwMDEyMjI2IDAwMDAwIG4gCjAwMDAwMTI1MTUgMDAwMDAgbiAKMDAwMDAxMjc2NyAwMDAwMCBuIAowMDAwMDEyODY2IDAwMDAwIG4gCjAwMDAwMTMxNjMgMDAwMDAgbiAKMDAwMDAxMzQxNSAwMDAwMCBuIAowMDAwMDEzNTE0IDAwMDAwIG4gCjAwMDAwMTM4MDMgMDAwMDAgbiAKMDAwMDAxNDA1NiAwMDAwMCBuIAowMDAwMDE0MTU1IDAwMDAwIG4gCjAwMDAwMTQ0NDQgMDAwMDAgbiAKMDAwMDAxNDcwOCAwMDAwMCBuIAowMDAwMDE0ODA3IDAwMDAwIG4gCjAwMDAwMTUxMTAgMDAwMDAgbiAKMDAwMDAxNTM3MyAwMDAwMCBuIAowMDAwMDE1NzQ3IDAwMDAwIG4gCjAwMDAwMTYxMjggMDAwMDAgbiAKMDAwMDAxNjIyNyAwMDAwMCBuIAowMDAwMDE2NTE2IDAwMDAwIG4gCjAwMDAwMTY3NzkgMDAwMDAgbiAKMDAwMDAxNzQwMiAwMDAwMCBuIAowMDAwMDE3NjYzIDAwMDAwIG4gCjAwMDAwMTgyODggMDAwMDAgbiAKMDAwMDAxODU1NCAwMDAwMCBuIAowMDAwMDE5MTc5IDAwMDAwIG4gCjAwMDAwMTk0NDMgMDAwMDAgbiAKMDAwMDAxOTgyNCAwMDAwMCBuIAowMDAwMDIwMTk3IDAwMDAwIG4gCjAwMDAwMjA1ODQgMDAwMDAgbiAKMDAwMDAyMDY4MyAwMDAwMCBuIAowMDAwMDIwOTcyIDAwMDAwIG4gCjAwMDAwMjEyMjggMDAwMDAgbiAKMDAwMDAyMTMyNyAwMDAwMCBuIAowMDAwMDIxNjE2IDAwMDAwIG4gCjAwMDAwMjE4NzUgMDAwMDAgbiAKMDAwMDAyMjI0MyAwMDAwMCBuIAowMDAwMDIyMzQyIDAwMDAwIG4gCjAwMDAwMjI2MzEgMDAwMDAgbiAKMDAwMDAyMjkwOCAwMDAwMCBuIAowMDAwMDIzMjk4IDAwMDAwIG4gCjAwMDAwMjMzOTcgMDAwMDAgbiAKMDAwMDAyMzY4NiAwMDAwMCBuIAowMDAwMDIzOTUxIDAwMDAwIG4gCjAwMDAwMjQwNTAgMDAwMDAgbiAKMDAwMDAyNDMzOSAwMDAwMCBuIAowMDAwMDI0NTk1IDAwMDAwIG4gCjAwMDAwMjQ2OTQgMDAwMDAgbiAKMDAwMDAyNDk5NCAwMDAwMCBuIAowMDAwMDI1MjQ4IDAwMDAwIG4gCjAwMDAwMjU2MTYgMDAwMDAgbiAKMDAwMDAyNTk5OSAwMDAwMCBuIAowMDAwMDI2Mzg4IDAwMDAwIG4gCjAwMDAwMjY3NjggMDAwMDAgbiAKMDAwMDAyNzE0OCAwMDAwMCBuIAowMDAwMDI3NTI1IDAwMDAwIG4gCjAwMDAwMjc4OTkgMDAwMDAgbiAKMDAwMDAyNzk5OSAwMDAwMCBuIAowMDAwMDI4MzAzIDAwMDAwIG4gCjAwMDAwMjg1NjEgMDAwMDAgbiAKMDAwMDAyODk1NyAwMDAwMCBuIAowMDAwMDI5MzQyIDAwMDAwIG4gCjAwMDAwMjk0NDIgMDAwMDAgbiAKMDAwMDAyOTczMyAwMDAwMCBuIAowMDAwMDI5OTg2IDAwMDAwIG4gCjAwMDAwMzAzNjMgMDAwMDAgbiAKMDAwMDAzMDQ2MyAwMDAwMCBuIAowMDAwMDMwNzU0IDAwMDAwIG4gCjAwMDAwMzEwMTUgMDAwMDAgbiAKMDAwMDAzMTExNSAwMDAwMCBuIAowMDAwMDMxNDA4IDAwMDAwIG4gCjAwMDAwMzE2NjEgMDAwMDAgbiAKMDAwMDAzMTc2MSAwMDAwMCBuIAowMDAwMDMyMDY2IDAwMDAwIG4gCjAwMDAwMzIzMzUgMDAwMDAgbiAKMDAwMDAzMjQzNSAwMDAwMCBuIAowMDAwMDMyNzMwIDAwMDAwIG4gCjAwMDAwMzMwMTMgMDAwMDAgbiAKMDAwMDAzMzU5MyAwMDAwMCBuIAowMDAwMDMzNjgzIDAwMDAwIG4gCjAwMDAwMzM5NDYgMDAwMDAgbiAKMDAwMDAzNDAwOSAwMDAwMCBuIAowMDAwMDM2MjA0IDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPGQ1YzFlYmQ3ZDM3ZDJhYTQ1NjRjZmU1M2MwZDA4OTM5PjxkNWMxZWJkN2QzN2QyYWE0NTY0Y2ZlNTNjMGQwODkzOT5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gMTI5IDAgUgovUm9vdCAxMjggMCBSCi9TaXplIDEzMwo+PgpzdGFydHhyZWYKMzY2OTkKJSVFT0YK";
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
 * ACH Credit Authorization
 *
 * Authorization by which a payee (consumer or organization) authorizes a named originator to initiate ACH credit entries to a deposit account at a named financial institution. Supports one-time and recurring credits, fixed or variable amounts, and optional B2B remittance / addenda fields. Used for vendor / accounts-payable, refunds, dividends, insurance claim payouts, government benefits, and royalty disbursements; governed by NACHA Operating Rules.
 */
export const achCreditAuthorization = Object.assign(baseForm, {
  /** Pre-populated resolver containing every layer and instruction file this artifact references. */
  resolver,
  /** The raw form spec, exactly as authored in artifacts/banking/ach-credit-authorization/. */
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

export default achCreditAuthorization;
