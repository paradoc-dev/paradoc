// AUTO-GENERATED from artifacts/banking/ach-direct-deposit/design/ — do not edit by hand.
// Regenerate via: node artifacts/scripts/sync-essentials.mjs --only banking/ach-direct-deposit

import { para, createMemoryResolver } from "@paradoc/core";

const schema = {
  "$schema": "https://schema.paradoc.dev/schema.json",
  "kind": "form",
  "name": "ach-direct-deposit",
  "version": "1.0.0",
  "title": "ACH Direct Deposit Authorization",
  "description": "Authorization by which an employee authorizes their employer (directly or through a payroll service provider) to deposit net pay—in whole or split across up to four deposit accounts—via ACH credit entries to the named depository institution(s). Governed by NACHA Operating Rules and (for non-exempt employee protections) FLSA and state wage law.",
  "code": "ACH-DD-AUTH",
  "releaseDate": "2026-05-02",
  "metadata": {
    "domain": "banking"
  },
  "instructions": {
    "kind": "file",
    "path": "ach-direct-deposit.instructions.md",
    "mimeType": "text/markdown",
    "title": "Instructions for ACH Direct Deposit Authorization",
    "description": "Generated instructions derived from the artifact definition.",
    "checksum": "sha256:ae89d12d47d4e25581f102918b98fc2c7fbc1423223269405c351705da47b0bd"
  },
  "parties": {
    "employer": {
      "partyType": "organization",
      "label": "Employer (Company)",
      "description": "The employer (or its payroll service provider) that will initiate ACH credit entries depositing net pay into the employee's account(s). The employer is identified for traceability; the form does not require the employer's signature.",
      "min": 1,
      "max": 1
    },
    "employee": {
      "partyType": "person",
      "label": "Employee (Account Holder)",
      "description": "The employee whose net pay will be deposited. Identifies themselves, designates up to four destination accounts with allotment rules (fixed amount, percent, or net remainder), and signs to authorize the employer to send ACH credits to those accounts.",
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
    "employerAddress": {
      "type": "address",
      "label": "Employer address",
      "description": "Mailing address of the employer (or payroll-provider's location handling this employee's pay). Used for correspondence and record-keeping.",
      "required": false,
      "visible": true
    },
    "employerPhone": {
      "type": "phone",
      "label": "Employer phone",
      "description": "Phone number for the employer's payroll contact.",
      "required": false,
      "visible": true
    },
    "employerEmail": {
      "type": "email",
      "label": "Employer / payroll contact email",
      "description": "Email address for the employer's payroll contact, used for confirmations and follow-up.",
      "required": false,
      "visible": true
    },
    "employerPayrollProvider": {
      "type": "text",
      "label": "Payroll service provider (e.g. ADP, Paycom)",
      "description": "Name of the third-party payroll service handling ACH origination for the employer, if any. Helps the employee verify the actual originator that will appear on bank statements.",
      "maxLength": 100,
      "required": false,
      "visible": true
    },
    "employeeId": {
      "type": "text",
      "label": "Employee ID number",
      "description": "Employer-assigned employee identifier (badge number, HRIS ID). Helps payroll locate the right employee record quickly.",
      "maxLength": 50,
      "required": false,
      "visible": true
    },
    "employeeSsn": {
      "type": "text",
      "label": "Social Security number",
      "description": "Employee's nine-digit U.S. Social Security Number, formatted XXX-XX-XXXX (hyphens optional). Used by payroll to confirm identity against the employee's tax record.",
      "pattern": "^\\d{3}-?\\d{2}-?\\d{4}$",
      "required": false,
      "visible": true
    },
    "employeeAddress": {
      "type": "address",
      "label": "Employee address",
      "description": "Mailing address of the employee, used by payroll for tax-form delivery (W-2) and any non-electronic correspondence.",
      "required": true,
      "visible": true
    },
    "employeePhone": {
      "type": "phone",
      "label": "Employee phone",
      "description": "Phone number for the employee for verification or fraud-prevention contact by payroll.",
      "required": false,
      "visible": true
    },
    "employeeEmail": {
      "type": "email",
      "label": "Employee email",
      "description": "Email address for the employee, used for direct-deposit confirmation and pay-stub delivery.",
      "required": false,
      "visible": true
    },
    "actionType": {
      "type": "enum",
      "label": "Action",
      "description": "Whether this submission establishes a new direct-deposit setup, changes an existing one, or stops direct deposit entirely (reverting to paper check). Drives which account fields are required.",
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
          "value": "stop",
          "label": "Stop"
        }
      ],
      "required": true,
      "visible": true
    },
    "account1BankName": {
      "type": "text",
      "label": "Account 1 — Bank name",
      "description": "Name of the bank holding the primary deposit account (account 1).",
      "maxLength": 100,
      "required": "fields.actionType != 'stop'",
      "visible": true
    },
    "account1RoutingNumber": {
      "type": "text",
      "label": "Account 1 — Routing/ABA number",
      "description": "Nine-digit ABA routing number for the primary deposit account. Must pass the Federal Reserve checksum.",
      "pattern": "^\\d{9}$",
      "required": true,
      "visible": true
    },
    "account1AccountNumber": {
      "type": "text",
      "label": "Account 1 — Account number",
      "description": "Bank account number for the primary deposit account; 4-17 alphanumeric per NACHA conventions.",
      "minLength": 4,
      "maxLength": 17,
      "pattern": "^[A-Za-z0-9]+$",
      "required": true,
      "visible": true
    },
    "account1AccountType": {
      "type": "enum",
      "label": "Account 1 — Type",
      "description": "Demand-deposit account type for the primary deposit account (checking or savings).",
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
      "required": "fields.actionType != 'stop'",
      "visible": true
    },
    "account1AllotmentType": {
      "type": "enum",
      "label": "Account 1 — Allotment",
      "description": "How the deposit amount is determined for the primary account: a fixed dollar amount, a percent of net pay, or the remainder of net pay after other allotments. Exactly one account in the form must be designated 'net_remainder'.",
      "enum": [
        {
          "value": "fixed_amount",
          "label": "Fixed amount"
        },
        {
          "value": "percent",
          "label": "Percent"
        },
        {
          "value": "net_remainder",
          "label": "Net remainder"
        }
      ],
      "required": "fields.actionType != 'stop'",
      "visible": true
    },
    "account1Amount": {
      "type": "money",
      "label": "Account 1 — Fixed amount (USD)",
      "description": "Fixed dollar amount to deposit into the primary account each pay cycle. Required only when account1AllotmentType is 'fixed_amount'.",
      "min": 0.01,
      "required": "fields.actionType != 'stop' and fields.account1AllotmentType == 'fixed_amount'",
      "visible": "fields.actionType != 'stop' and fields.account1AllotmentType == 'fixed_amount'"
    },
    "account1Percent": {
      "type": "number",
      "label": "Account 1 — Percent of net pay",
      "description": "Whole-number percentage (1-100) of net pay to deposit into the primary account. Required only when account1AllotmentType is 'percent'. Sum across all accounts cannot exceed 100.",
      "min": 1,
      "max": 100,
      "step": 1,
      "required": "fields.actionType != 'stop' and fields.account1AllotmentType == 'percent'",
      "visible": "fields.actionType != 'stop' and fields.account1AllotmentType == 'percent'"
    },
    "account1VoidedCheckAttached": {
      "type": "boolean",
      "label": "Account 1 — Voided check attached",
      "description": "Whether a voided check or bank-issued letter has been attached to verify the routing and account numbers for the primary account. Strongly encouraged.",
      "required": false,
      "visible": true
    },
    "account2Enabled": {
      "type": "boolean",
      "label": "Add a second deposit account",
      "description": "Toggles whether a secondary deposit account is being designated. When true, account 2's fields become visible and required.",
      "required": false,
      "visible": true
    },
    "account2BankName": {
      "type": "text",
      "label": "Account 2 — Bank name",
      "description": "Name of the bank holding the secondary deposit account.",
      "maxLength": 100,
      "required": "fields.account2Enabled and fields.actionType != 'stop'",
      "visible": "fields.account2Enabled"
    },
    "account2RoutingNumber": {
      "type": "text",
      "label": "Account 2 — Routing/ABA number",
      "description": "Nine-digit ABA routing number for the secondary deposit account.",
      "pattern": "^\\d{9}$",
      "required": "fields.account2Enabled",
      "visible": "fields.account2Enabled"
    },
    "account2AccountNumber": {
      "type": "text",
      "label": "Account 2 — Account number",
      "description": "Bank account number for the secondary deposit account; 4-17 alphanumeric.",
      "minLength": 4,
      "maxLength": 17,
      "pattern": "^[A-Za-z0-9]+$",
      "required": "fields.account2Enabled",
      "visible": "fields.account2Enabled"
    },
    "account2AccountType": {
      "type": "enum",
      "label": "Account 2 — Type",
      "description": "Demand-deposit account type for the secondary account.",
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
      "required": "fields.account2Enabled and fields.actionType != 'stop'",
      "visible": "fields.account2Enabled"
    },
    "account2AllotmentType": {
      "type": "enum",
      "label": "Account 2 — Allotment",
      "description": "How the deposit amount is determined for the secondary account: fixed amount, percent, or net remainder.",
      "enum": [
        {
          "value": "fixed_amount",
          "label": "Fixed amount"
        },
        {
          "value": "percent",
          "label": "Percent"
        },
        {
          "value": "net_remainder",
          "label": "Net remainder"
        }
      ],
      "required": "fields.account2Enabled and fields.actionType != 'stop'",
      "visible": "fields.account2Enabled"
    },
    "account2Amount": {
      "type": "money",
      "label": "Account 2 — Fixed amount (USD)",
      "description": "Fixed dollar amount to deposit into the secondary account each pay cycle. Required when account2AllotmentType is 'fixed_amount'.",
      "min": 0.01,
      "required": "fields.account2Enabled and fields.actionType != 'stop' and fields.account2AllotmentType == 'fixed_amount'",
      "visible": "fields.account2Enabled and fields.account2AllotmentType == 'fixed_amount'"
    },
    "account2Percent": {
      "type": "number",
      "label": "Account 2 — Percent of net pay",
      "description": "Whole-number percentage of net pay for the secondary account. Required when account2AllotmentType is 'percent'.",
      "min": 1,
      "max": 100,
      "step": 1,
      "required": "fields.account2Enabled and fields.actionType != 'stop' and fields.account2AllotmentType == 'percent'",
      "visible": "fields.account2Enabled and fields.account2AllotmentType == 'percent'"
    },
    "account2VoidedCheckAttached": {
      "type": "boolean",
      "label": "Account 2 — Voided check attached",
      "description": "Whether a voided check or bank letter is attached for the secondary account.",
      "required": false,
      "visible": "fields.account2Enabled"
    },
    "account3Enabled": {
      "type": "boolean",
      "label": "Add a third deposit account",
      "description": "Toggles whether a third deposit account is being designated. Requires account 2 to also be enabled.",
      "required": false,
      "visible": true
    },
    "account3BankName": {
      "type": "text",
      "label": "Account 3 — Bank name",
      "description": "Name of the bank holding the third deposit account.",
      "maxLength": 100,
      "required": "fields.account3Enabled and fields.actionType != 'stop'",
      "visible": "fields.account3Enabled"
    },
    "account3RoutingNumber": {
      "type": "text",
      "label": "Account 3 — Routing/ABA number",
      "description": "Nine-digit ABA routing number for the third deposit account.",
      "pattern": "^\\d{9}$",
      "required": "fields.account3Enabled",
      "visible": "fields.account3Enabled"
    },
    "account3AccountNumber": {
      "type": "text",
      "label": "Account 3 — Account number",
      "description": "Bank account number for the third deposit account; 4-17 alphanumeric.",
      "minLength": 4,
      "maxLength": 17,
      "pattern": "^[A-Za-z0-9]+$",
      "required": "fields.account3Enabled",
      "visible": "fields.account3Enabled"
    },
    "account3AccountType": {
      "type": "enum",
      "label": "Account 3 — Type",
      "description": "Demand-deposit account type for the third account.",
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
      "required": "fields.account3Enabled and fields.actionType != 'stop'",
      "visible": "fields.account3Enabled"
    },
    "account3AllotmentType": {
      "type": "enum",
      "label": "Account 3 — Allotment",
      "description": "How the deposit amount is determined for the third account.",
      "enum": [
        {
          "value": "fixed_amount",
          "label": "Fixed amount"
        },
        {
          "value": "percent",
          "label": "Percent"
        },
        {
          "value": "net_remainder",
          "label": "Net remainder"
        }
      ],
      "required": "fields.account3Enabled and fields.actionType != 'stop'",
      "visible": "fields.account3Enabled"
    },
    "account3Amount": {
      "type": "money",
      "label": "Account 3 — Fixed amount (USD)",
      "description": "Fixed dollar amount to deposit into the third account each pay cycle. Required when account3AllotmentType is 'fixed_amount'.",
      "min": 0.01,
      "required": "fields.account3Enabled and fields.actionType != 'stop' and fields.account3AllotmentType == 'fixed_amount'",
      "visible": "fields.account3Enabled and fields.account3AllotmentType == 'fixed_amount'"
    },
    "account3Percent": {
      "type": "number",
      "label": "Account 3 — Percent of net pay",
      "description": "Whole-number percentage of net pay for the third account. Required when account3AllotmentType is 'percent'.",
      "min": 1,
      "max": 100,
      "step": 1,
      "required": "fields.account3Enabled and fields.actionType != 'stop' and fields.account3AllotmentType == 'percent'",
      "visible": "fields.account3Enabled and fields.account3AllotmentType == 'percent'"
    },
    "account3VoidedCheckAttached": {
      "type": "boolean",
      "label": "Account 3 — Voided check attached",
      "description": "Whether a voided check or bank letter is attached for the third account.",
      "required": false,
      "visible": "fields.account3Enabled"
    },
    "account4Enabled": {
      "type": "boolean",
      "label": "Add a fourth deposit account",
      "description": "Toggles whether a fourth deposit account is being designated. Requires account 3 to also be enabled.",
      "required": false,
      "visible": true
    },
    "account4BankName": {
      "type": "text",
      "label": "Account 4 — Bank name",
      "description": "Name of the bank holding the fourth deposit account.",
      "maxLength": 100,
      "required": "fields.account4Enabled and fields.actionType != 'stop'",
      "visible": "fields.account4Enabled"
    },
    "account4RoutingNumber": {
      "type": "text",
      "label": "Account 4 — Routing/ABA number",
      "description": "Nine-digit ABA routing number for the fourth deposit account.",
      "pattern": "^\\d{9}$",
      "required": "fields.account4Enabled",
      "visible": "fields.account4Enabled"
    },
    "account4AccountNumber": {
      "type": "text",
      "label": "Account 4 — Account number",
      "description": "Bank account number for the fourth deposit account; 4-17 alphanumeric.",
      "minLength": 4,
      "maxLength": 17,
      "pattern": "^[A-Za-z0-9]+$",
      "required": "fields.account4Enabled",
      "visible": "fields.account4Enabled"
    },
    "account4AccountType": {
      "type": "enum",
      "label": "Account 4 — Type",
      "description": "Demand-deposit account type for the fourth account.",
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
      "required": "fields.account4Enabled and fields.actionType != 'stop'",
      "visible": "fields.account4Enabled"
    },
    "account4AllotmentType": {
      "type": "enum",
      "label": "Account 4 — Allotment",
      "description": "How the deposit amount is determined for the fourth account.",
      "enum": [
        {
          "value": "fixed_amount",
          "label": "Fixed amount"
        },
        {
          "value": "percent",
          "label": "Percent"
        },
        {
          "value": "net_remainder",
          "label": "Net remainder"
        }
      ],
      "required": "fields.account4Enabled and fields.actionType != 'stop'",
      "visible": "fields.account4Enabled"
    },
    "account4Amount": {
      "type": "money",
      "label": "Account 4 — Fixed amount (USD)",
      "description": "Fixed dollar amount to deposit into the fourth account each pay cycle. Required when account4AllotmentType is 'fixed_amount'.",
      "min": 0.01,
      "required": "fields.account4Enabled and fields.actionType != 'stop' and fields.account4AllotmentType == 'fixed_amount'",
      "visible": "fields.account4Enabled and fields.account4AllotmentType == 'fixed_amount'"
    },
    "account4Percent": {
      "type": "number",
      "label": "Account 4 — Percent of net pay",
      "description": "Whole-number percentage of net pay for the fourth account. Required when account4AllotmentType is 'percent'.",
      "min": 1,
      "max": 100,
      "step": 1,
      "required": "fields.account4Enabled and fields.actionType != 'stop' and fields.account4AllotmentType == 'percent'",
      "visible": "fields.account4Enabled and fields.account4AllotmentType == 'percent'"
    },
    "account4VoidedCheckAttached": {
      "type": "boolean",
      "label": "Account 4 — Voided check attached",
      "description": "Whether a voided check or bank letter is attached for the fourth account.",
      "required": false,
      "visible": "fields.account4Enabled"
    }
  },
  "rules": {
    "exactlyOneNetRemainder": {
      "expr": "((account1AllotmentType == 'net_remainder') ? 1 : 0) + ((account2Enabled and account2AllotmentType == 'net_remainder') ? 1 : 0) + ((account3Enabled and account3AllotmentType == 'net_remainder') ? 1 : 0) + ((account4Enabled and account4AllotmentType == 'net_remainder') ? 1 : 0) == 1",
      "message": "Exactly one account must be designated as the net-pay remainder.",
      "severity": "error"
    },
    "percentSumWithinHundred": {
      "expr": "((account1AllotmentType == 'percent') ? account1Percent : 0) + ((account2Enabled and account2AllotmentType == 'percent') ? account2Percent : 0) + ((account3Enabled and account3AllotmentType == 'percent') ? account3Percent : 0) + ((account4Enabled and account4AllotmentType == 'percent') ? account4Percent : 0) <= 100",
      "message": "Sum of percent allotments cannot exceed 100.",
      "severity": "error"
    },
    "account3RequiresAccount2": {
      "expr": "not account3Enabled or account2Enabled",
      "message": "Enable account 2 before adding account 3.",
      "severity": "error"
    },
    "account4RequiresAccount3": {
      "expr": "not account4Enabled or account3Enabled",
      "message": "Enable account 3 before adding account 4.",
      "severity": "error"
    }
  },
  "layers": {
    "pdf": {
      "kind": "file",
      "mimeType": "application/pdf",
      "title": "PDF Form",
      "path": "ach-direct-deposit.pdf",
      "checksum": "sha256:32429c98dff3facdd2c54b21328a9ec3c9fd47a3d19bc922ed922974186a8b40",
      "bindings": {
        "employerName": "parties.employer.legalName",
        "employerPayrollProvider": "employerPayrollProvider",
        "employerAddressLine1": "employerAddress.line1",
        "employerCity": "employerAddress.locality",
        "employerState": "employerAddress.region",
        "employerZip": "employerAddress.postalCode",
        "employerPhone": "employerPhone.number",
        "employerEmail": "employerEmail",
        "employeeName": "parties.employee.name",
        "employeeId": "employeeId",
        "employeeSsn": "employeeSsn",
        "employeeAddressLine1": "employeeAddress.line1",
        "employeeCity": "employeeAddress.locality",
        "employeeState": "employeeAddress.region",
        "employeeZip": "employeeAddress.postalCode",
        "employeePhone": "employeePhone.number",
        "employeeEmail": "employeeEmail",
        "actionType_new": "actionType:new",
        "actionType_change": "actionType:change",
        "actionType_stop": "actionType:stop",
        "account1BankName": "account1BankName",
        "account1Routing": "account1RoutingNumber",
        "account1Account": "account1AccountNumber",
        "account1AccountType_checking": "account1AccountType:checking",
        "account1AccountType_savings": "account1AccountType:savings",
        "account1AllotmentType_fixedamount": "account1AllotmentType:fixed_amount",
        "account1Amount": "account1Amount.amount",
        "account1AllotmentType_percent": "account1AllotmentType:percent",
        "account1Percent": "account1Percent",
        "account1AllotmentType_netremainder": "account1AllotmentType:net_remainder",
        "account1VoidedCheck": "account1VoidedCheckAttached",
        "account2Enabled": "account2Enabled",
        "account2BankName": "account2BankName",
        "account2Routing": "account2RoutingNumber",
        "account2Account": "account2AccountNumber",
        "account2AccountType_checking": "account2AccountType:checking",
        "account2AccountType_savings": "account2AccountType:savings",
        "account2AllotmentType_fixedamount": "account2AllotmentType:fixed_amount",
        "account2Amount": "account2Amount.amount",
        "account2AllotmentType_percent": "account2AllotmentType:percent",
        "account2Percent": "account2Percent",
        "account2AllotmentType_netremainder": "account2AllotmentType:net_remainder",
        "account2VoidedCheck": "account2VoidedCheckAttached",
        "account3Enabled": "account3Enabled",
        "account3BankName": "account3BankName",
        "account3Routing": "account3RoutingNumber",
        "account3Account": "account3AccountNumber",
        "account3AccountType_checking": "account3AccountType:checking",
        "account3AccountType_savings": "account3AccountType:savings",
        "account3AllotmentType_fixedamount": "account3AllotmentType:fixed_amount",
        "account3Amount": "account3Amount.amount",
        "account3AllotmentType_percent": "account3AllotmentType:percent",
        "account3Percent": "account3Percent",
        "account3AllotmentType_netremainder": "account3AllotmentType:net_remainder",
        "account3VoidedCheck": "account3VoidedCheckAttached",
        "account4Enabled": "account4Enabled",
        "account4BankName": "account4BankName",
        "account4Routing": "account4RoutingNumber",
        "account4Account": "account4AccountNumber",
        "account4AccountType_checking": "account4AccountType:checking",
        "account4AccountType_savings": "account4AccountType:savings",
        "account4AllotmentType_fixedamount": "account4AllotmentType:fixed_amount",
        "account4Amount": "account4Amount.amount",
        "account4AllotmentType_percent": "account4AllotmentType:percent",
        "account4Percent": "account4Percent",
        "account4AllotmentType_netremainder": "account4AllotmentType:net_remainder",
        "account4VoidedCheck": "account4VoidedCheckAttached"
      },
      "signatures": {
        "employeeSignature": {
          "party": {
            "role": "employee",
            "index": 0
          },
          "type": "signature",
          "label": "Signature of Employee",
          "placement": {
            "page": 1,
            "x": 128,
            "y": 680,
            "width": 230,
            "height": 12
          }
        },
        "employeeDate": {
          "party": {
            "role": "employee",
            "index": 0
          },
          "type": "date_signed",
          "label": "Date",
          "placement": {
            "page": 1,
            "x": 410,
            "y": 680,
            "width": 90,
            "height": 12
          }
        },
        "employeePrintedName": {
          "party": {
            "role": "employee",
            "index": 0
          },
          "type": "printed_name",
          "label": "Printed name",
          "placement": {
            "page": 1,
            "x": 146,
            "y": 702,
            "width": 280,
            "height": 12
          }
        }
      }
    },
    "markdown": {
      "kind": "file",
      "mimeType": "text/markdown",
      "title": "Markdown Form",
      "path": "ach-direct-deposit.md",
      "checksum": "sha256:60bee6e0ad758de437c29364e7606a63214190170c02660c8981a4eb768eeb50"
    }
  },
  "defaultLayer": "pdf"
} as const;

const __c_ach_direct_deposit_instructions_md: string = `---
title: Instructions for ACH Direct Deposit Authorization
source_url: null
slug: ach-direct-deposit
timestamp: 2026-05-12T02:39:15Z
generated: true
---

# Instructions for ACH Direct Deposit Authorization

## Purpose

This form authorizes an employer (directly or through a payroll service) to deposit the employee's net pay into one or more bank accounts via ACH credit. Pay may be deposited to a single account or split across up to four accounts.

## How to fill it out

### 1. Action

**1.** Select the Action: **New** (set up direct deposit for the first time), **Change** (update existing direct deposit), or **Stop** (cancel direct deposit and return to paper checks).

### 2. Employer

**2.** Enter the Employer's address, phone, and payroll contact email if known. If a payroll service provider is used (for example, ADP or Paycom), enter its name.

### 3. Employee

**3.** Enter the Employee ID number assigned by the employer, if known.

**4.** Enter the Employee's Social Security number if the employer requires it for payroll matching.

**5.** Enter the Employee's mailing address (required), phone, and email.

### 4. Account 1 — primary deposit account

Complete steps 6–11 for any Action other than **Stop**. The routing and account number (steps 7–8) are required even for **Stop**, so the employer can verify what is being cancelled.

**6.** Enter the bank name.

**7.** Enter the 9-digit routing / ABA number.

**8.** Enter the account number.

**9.** Select the account type: **Checking** or **Savings**.

**10.** Select the Allotment:
   - **Fixed amount** — a specific dollar amount goes to this account each pay period.
   - **Percent** — a percentage of net pay goes to this account each pay period.
   - **Net remainder** — whatever remains of net pay after other accounts are funded goes here.

**11.** Enter the corresponding amount or percent for the chosen Allotment:
   - **Fixed amount** — enter the dollar amount.
   - **Percent** — enter the percent of net pay (a number between 1 and 100).
   - **Net remainder** — no further input needed.

**12.** Check the box if a voided check is attached. Attaching one is strongly recommended.

### 5. Additional accounts (optional, up to three more)

**13.** Check **Add a second deposit account** to enable Account 2, and repeat steps 6–12 for that account.

**14.** Similarly, enable Account 3 and Account 4 if needed and complete the same fields for each.

**Important:** At most one account in the entire form may use **Net remainder**. The total of all **Fixed amount** and **Percent** allotments cannot exceed net pay; if it does, the employer will reject the form.

### 6. Sign and submit

**15.** Sign and date the form, then return it to the employer or payroll contact.

## Notes

- Allow at least one full pay cycle for direct deposit changes to take effect. The employer may issue a paper check for the first pay period after a change while the bank is being verified ("pre-noting").
- The employee may revoke this authorization at any time by submitting a new form with the Action set to **Stop**, or by following the employer's payroll procedure.
`;
const __c_ach_direct_deposit_pdf_b64 = "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtT2JsaXF1ZSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjMgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUgL0VuY29kaW5nIC9EaWZmZXJlbmNlcyBbMjQgL2JyZXZlIC9jYXJvbiAvY2lyY3VtZmxleCAvZG90YWNjZW50IC9odW5nYXJ1bWxhdXQgL29nb25layAvcmluZyAvdGlsZGUgMzkgL3F1b3Rlc2luZ2xlIDk2IC9ncmF2ZSAxMjggL2J1bGxldCAvZGFnZ2VyIC9kYWdnZXJkYmwgL2VsbGlwc2lzIC9lbWRhc2ggL2VuZGFzaCAvZmxvcmluIC9mcmFjdGlvbiAvZ3VpbHNpbmdsbGVmdCAvZ3VpbHNpbmdscmlnaHQgL21pbnVzIC9wZXJ0aG91c2FuZCAvcXVvdGVkYmxiYXNlIC9xdW90ZWRibGxlZnQgL3F1b3RlZGJscmlnaHQgL3F1b3RlbGVmdCAvcXVvdGVyaWdodCAvcXVvdGVzaW5nbGJhc2UgL3RyYWRlbWFyayAvZmkgL2ZsIC9Mc2xhc2ggL09FIC9TY2Fyb24gL1lkaWVyZXNpcyAvWmNhcm9uIC9kb3RsZXNzaSAvbHNsYXNoIC9vZSAvc2Nhcm9uIC96Y2Fyb24gMTYwIC9FdXJvIDE2NCAvY3VycmVuY3kgMTY2IC9icm9rZW5iYXIgMTY4IC9kaWVyZXNpcyAvY29weXJpZ2h0IC9vcmRmZW1pbmluZSAxNzIgL2xvZ2ljYWxub3QgLy5ub3RkZWYgL3JlZ2lzdGVyZWQgL21hY3JvbiAvZGVncmVlIC9wbHVzbWludXMgL3R3b3N1cGVyaW9yIC90aHJlZXN1cGVyaW9yIC9hY3V0ZSAvbXUgMTgzIC9wZXJpb2RjZW50ZXJlZCAvY2VkaWxsYSAvb25lc3VwZXJpb3IgL29yZG1hc2N1bGluZSAxODggL29uZXF1YXJ0ZXIgL29uZWhhbGYgL3RocmVlcXVhcnRlcnMgMTkyIC9BZ3JhdmUgL0FhY3V0ZSAvQWNpcmN1bWZsZXggL0F0aWxkZSAvQWRpZXJlc2lzIC9BcmluZyAvQUUgL0NjZWRpbGxhIC9FZ3JhdmUgL0VhY3V0ZSAvRWNpcmN1bWZsZXggL0VkaWVyZXNpcyAvSWdyYXZlIC9JYWN1dGUgL0ljaXJjdW1mbGV4IC9JZGllcmVzaXMgL0V0aCAvTnRpbGRlIC9PZ3JhdmUgL09hY3V0ZSAvT2NpcmN1bWZsZXggL090aWxkZSAvT2RpZXJlc2lzIC9tdWx0aXBseSAvT3NsYXNoIC9VZ3JhdmUgL1VhY3V0ZSAvVWNpcmN1bWZsZXggL1VkaWVyZXNpcyAvWWFjdXRlIC9UaG9ybiAvZ2VybWFuZGJscyAvYWdyYXZlIC9hYWN1dGUgL2FjaXJjdW1mbGV4IC9hdGlsZGUgL2FkaWVyZXNpcyAvYXJpbmcgL2FlIC9jY2VkaWxsYSAvZWdyYXZlIC9lYWN1dGUgL2VjaXJjdW1mbGV4IC9lZGllcmVzaXMgL2lncmF2ZSAvaWFjdXRlIC9pY2lyY3VtZmxleCAvaWRpZXJlc2lzIC9ldGggL250aWxkZSAvb2dyYXZlIC9vYWN1dGUgL29jaXJjdW1mbGV4IC9vdGlsZGUgL29kaWVyZXNpcyAvZGl2aWRlIC9vc2xhc2ggL3VncmF2ZSAvdWFjdXRlIC91Y2lyY3VtZmxleCAvdWRpZXJlc2lzIC95YWN1dGUgL3Rob3JuIC95ZGllcmVzaXNdPj4KZW5kb2JqCjYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNyAwIG9iago8PAovQkJveCBbIDAgMCAxODAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwtABiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABk4DpdlbmRzdHJlYW0KZW5kb2JqCjggMCBvYmoKPDwKL0FQIDw8Ci9OIDcgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDc5LjU2IDY2OSAyNTkuNTYgNjgwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZW1wbG95ZXJOYW1lKSAKICAvVFUgKE5hbWUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKOSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMCAwIG9iago8PAovQkJveCBbIDAgMCAyMDYuNDQgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2NSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDkgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMjDTMzFRMAQKpHKlcemHVCg4+TorcBViyoZz5QEFQdrcuQK5XH2duQBygA/BZW5kc3RyZWFtCmVuZG9iagoxMSAwIG9iago8PAovQVAgPDwKL04gMTAgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDMzMS4zNTIgNjY5IDUzNy43OTIgNjgwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZW1wbG95ZXJQYXlyb2xsUHJvdmlkZXIpIAogIC9UVSAoUGF5cm9sbCBwcm92aWRlcikgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMyAwIG9iago8PAovQkJveCBbIDAgMCAxODAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEyIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMLQAYiAvlSuNSz+kQsHJ11mBqxBNKpwrDygC0uDOFcjl6uvMBQAZOA6XZW5kc3RyZWFtCmVuZG9iagoxNCAwIG9iago8PAovQVAgPDwKL04gMTMgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDg3LjU2OCA2NTMgMjY3LjU2OCA2NjQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbXBsb3llckFkZHJlc3NMaW5lMSkgCiAgL1RVIChBZGRyZXNzKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjE1IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjE2IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDYwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxNSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAzUDAEclK50rj0QyoUnHydFbgKUWXCufKAAiDl7lyBXK6+zlwA/IkOMWVuZHN0cmVhbQplbmRvYmoKMTcgMCBvYmoKPDwKL0FQIDw8Ci9OIDE2IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyAyOTMuNTY4IDY1MyAzNTMuNTY4IDY2NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVtcGxveWVyQ2l0eSkgCiAgL1RVIChDaXR5KSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjE4IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjE5IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDIyIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxOCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDAyUjAEclK50rj0QyoUnHydFbgKUWXCufKAAiDl7lyBXK6+zlwA++UOLWVuZHN0cmVhbQplbmRvYmoKMjAgMCBvYmoKPDwKL0FQIDw8Ci9OIDE5IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyAzODQuNDcyIDY1MyA0MDYuNDcyIDY2NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVtcGxveWVyU3RhdGUpIAogIC9UVSAoU3RhdGUpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMjEgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMjIgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTEzLjUyOCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDcwIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMjEgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNDTWMzWyMIADI6CQQlEqVxqXfkiFgpOvswJXIX6V4Vx5QAUg49y5ArlcfZ25ABhEFE1lbmRzdHJlYW0KZW5kb2JqCjIzIDAgb2JqCjw8Ci9BUCA8PAovTiAyMiAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxNTkgMCBSIC9SZWN0IFsgNDI5LjgwOCA2NTMgNTQzLjMzNiA2NjQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbXBsb3llclppcCkgCiAgL1RVIChaaXApIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMjQgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMjUgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTAwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAyNCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA0AGIgL5UrjUs/pELByddZgasQTSqcKw8oAtLgzhXI5errzAUAFrAOh2VuZHN0cmVhbQplbmRvYmoKMjYgMCBvYmoKPDwKL0FQIDw8Ci9OIDI1IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyA4MS4zNTIgNjM3IDE4MS4zNTIgNjQ4IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZW1wbG95ZXJQaG9uZSkgCiAgL1RVIChQaG9uZSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoyNyAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoyOCAwIG9iago8PAovQkJveCBbIDAgMCAzMjQuNjQ4IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjcgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAyNyAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA2MtEzM7FQMASKpHKlcemHVCg4+TorcBVikQ7nygOKgjS6cwVyufo6cwEAlPgQN2VuZHN0cmVhbQplbmRvYmoKMjkgMCBvYmoKPDwKL0FQIDw8Ci9OIDI4IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyAyMTcuNTc2IDYzNyA1NDIuMjI0IDY0OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVtcGxveWVyRW1haWwpIAogIC9UVSAoRW1haWwpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMzAgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMzEgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTgwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAzMCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDC0AGIgL5UrjUs/pELByddZgasQTSqcKw8oAtLgzhXI5errzAUAGTgOl2VuZHN0cmVhbQplbmRvYmoKMzIgMCBvYmoKPDwKL0FQIDw8Ci9OIDMxIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyA3OS41NiA2MDEgMjU5LjU2IDYxMiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVtcGxveWVlTmFtZSkgCiAgL1RVIChOYW1lKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjMzIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjM0IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDcwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAzMyAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA3UDAEclK50rj0QyoUnHydFbgKUWXCufKAAiDl7lyBXK6+zlwA/NkOM2VuZHN0cmVhbQplbmRvYmoKMzUgMCBvYmoKPDwKL0FQIDw8Ci9OIDM0IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyAyNzkuNzg0IDYwMSAzNDkuNzg0IDYxMiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGVtcGxveWVlSWQpIAogIC9UVSAoSUQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMzYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMzcgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTcwLjIxNiAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDY3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMzYgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNDfQMzI0UzAEiqRypXHph1QoOPk6K3AVYpEO58oDioI0unMFcrn6OnMBAJGeECNlbmRzdHJlYW0KZW5kb2JqCjM4IDAgb2JqCjw8Ci9BUCA8PAovTiAzNyAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxNTkgMCBSIC9SZWN0IFsgMzc4LjQ1NiA2MDEgNTQ4LjY3MiA2MTIgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbXBsb3llZVNzbikgCiAgL1RVIChTU04pIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMzkgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNDAgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTgwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAzOSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDC0AGIgL5UrjUs/pELByddZgasQTSqcKw8oAtLgzhXI5errzAUAGTgOl2VuZHN0cmVhbQplbmRvYmoKNDEgMCBvYmoKPDwKL0FQIDw8Ci9OIDQwIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyA4Ny41NjggNTg1IDI2Ny41NjggNTk2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZW1wbG95ZWVBZGRyZXNzTGluZTEpIAogIC9UVSAoQWRkcmVzcykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago0MiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago0MyAwIG9iago8PAovQkJveCBbIDAgMCA2MCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNDIgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwM1AwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAPyJDjFlbmRzdHJlYW0KZW5kb2JqCjQ0IDAgb2JqCjw8Ci9BUCA8PAovTiA0MyAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxNTkgMCBSIC9SZWN0IFsgMjkzLjU2OCA1ODUgMzUzLjU2OCA1OTYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbXBsb3llZUNpdHkpIAogIC9UVSAoQ2l0eSkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago0NSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago0NiAwIG9iago8PAovQkJveCBbIDAgMCAyMiAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNDUgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwMlIwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAPvlDi1lbmRzdHJlYW0KZW5kb2JqCjQ3IDAgb2JqCjw8Ci9BUCA8PAovTiA0NiAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxNTkgMCBSIC9SZWN0IFsgMzg0LjQ3MiA1ODUgNDA2LjQ3MiA1OTYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChlbXBsb3llZVN0YXRlKSAKICAvVFUgKFN0YXRlKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjQ4IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjQ5IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDExMy41MjggMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA3MCAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDQ4IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQ01jM1sjCAAyOgkEJRKlcal35IhYKTr7MCVyF+leFceUAFIOPcuQK5XH2duQAYRBRNZW5kc3RyZWFtCmVuZG9iago1MCAwIG9iago8PAovQVAgPDwKL04gNDkgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDQyOS44MDggNTg1IDU0My4zMzYgNTk2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoZW1wbG95ZWVaaXApIAogIC9UVSAoWmlwKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjUxIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjUyIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEwMCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNTEg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XSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDY3IC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREZdID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nCvkMlRIVzBUcFfQszACYlMLcyCvKF3BAAgtgLAoVSGNS8/QUgGGg9wVDPRMFcqBpJEphDDXg2Cg2mKuQADGMREdZW5kc3RyZWFtCmVuZG9iago2MyAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMTA1Ljk5OSA1NTEgMTEzLjk5OSA1NTkgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY3Rpb25UeXBlX25ldykgCiAgL1RVIChOZXcgXChuZXdcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjY0IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDYwIDAgUiAvWWVzIDU5IDAgUgo+PiAvTiA8PAovT2ZmIDU4IDAgUiAvWWVzIDU3IDAgUgo+PiAvUiA8PAovT2ZmIDYyIDAgUiAvWWVzIDYxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyAxNDguOTk5IDU1MSAxNTYuOTk5IDU1OSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjdGlvblR5cGVfY2hhbmdlKSAKICAvVFUgKENoYW5nZSBcKGNoYW5nZVwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNjUgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgNjAgMCBSIC9ZZXMgNTkgMCBSCj4+IC9OIDw8Ci9PZmYgNTggMCBSIC9ZZXMgNTcgMCBSCj4+IC9SIDw8Ci9PZmYgNjIgMCBSIC9ZZXMgNjEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTU5IDAgUiAvUmVjdCBbIDIwNC4wMTUgNTUxIDIxMi4wMTUgNTU5IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWN0aW9uVHlwZV9zdG9wKSAKICAvVFUgKFN0b3AgXChzdG9wXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago2NiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago2NyAwIG9iago8PAovQkJveCBbIDAgMCAxMzAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDY2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQGYiAvlSuNSz+kQsHJ11mBqxBNKpwrDygC0uDOFcjl6uvMBQAXow6NZW5kc3RyZWFtCmVuZG9iago2OCAwIG9iago8PAovQVAgPDwKL04gNjcgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDc2LjQ1NiA1MTkgMjA2LjQ1NiA1MzAgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50MUJhbmtOYW1lKSAKICAvVFUgKEJhbmspIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNjkgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNzAgMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDY5IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDBQMARyUrnSuPRDKhScfJ0VuApRZcK58oACIOXuXIFcrr7OXAD9KQ41ZW5kc3RyZWFtCmVuZG9iago3MSAwIG9iago8PAovQVAgPDwKL04gNzAgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDI1Mi45MiA1MTkgMzMyLjkyIDUzMCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQxUm91dGluZykgCiAgL1RVIChSb3V0aW5nICMpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKNzIgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKNzMgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTU3LjA4IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjkgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiA3MiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA0NdczMLdEAAsFQ6BkKlcal35IhYKTr7MCVyF+leFceUAFIOPcuQK5XH2duQBDtBUfZW5kc3RyZWFtCmVuZG9iago3NCAwIG9iago8PAovQVAgPDwKL04gNzMgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDM4MC43MiA1MTkgNTM3LjggNTMwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDFBY2NvdW50KSAKICAvVFUgKEFjY291bnQgIykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago3NSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgNTQgNTAzIDYyIDUxMSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQxQWNjb3VudFR5cGVfY2hlY2tpbmcpIAogIC9UVSAoQ2hlY2tpbmcgXChjaGVja2luZ1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKNzYgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgNjAgMCBSIC9ZZXMgNTkgMCBSCj4+IC9OIDw8Ci9PZmYgNTggMCBSIC9ZZXMgNTcgMCBSCj4+IC9SIDw8Ci9PZmYgNjIgMCBSIC9ZZXMgNjEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTU5IDAgUiAvUmVjdCBbIDEwNi4zNDQgNTAzIDExNC4zNDQgNTExIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDFBY2NvdW50VHlwZV9zYXZpbmdzKSAKICAvVFUgKFNhdmluZ3MgXChzYXZpbmdzXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago3NyAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMTYxLjggNTAzIDE2OS44IDUxMSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQxQWxsb3RtZW50VHlwZV9maXhlZGFtb3VudCkgCiAgL1RVIChGaXhlZCAkIFwoZml4ZWRfYW1vdW50XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago3OCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago3OSAwIG9iago8PAovQkJveCBbIDAgMCA1MCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgNzggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNVAwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAPw5Di9lbmRzdHJlYW0KZW5kb2JqCjgwIDAgb2JqCjw8Ci9BUCA8PAovTiA3OSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxNTkgMCBSIC9SZWN0IFsgMjA1LjAzMiA1MDMgMjU1LjAzMiA1MTQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50MUFtb3VudCkgCiAgL1RVIChhY2NvdW50MUFtb3VudCkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago4MSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMjYzLjAzMiA1MDMgMjcxLjAzMiA1MTEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50MUFsbG90bWVudFR5cGVfcGVyY2VudCkgCiAgL1RVICglIFwocGVyY2VudFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKODIgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKODMgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMzAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDgyIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDZQMARyUrnSuPRDKhScfJ0VuApRZcK58oACIOXuXIFcrr7OXAD7mQ4rZW5kc3RyZWFtCmVuZG9iago4NCAwIG9iago8PAovQVAgPDwKL04gODMgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDI4Ny4xNDQgNTAzIDMxNy4xNDQgNTE0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDFQZXJjZW50KSAKICAvVFUgKGFjY291bnQxUGVyY2VudCkgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iago4NSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAg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IDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREZdID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nCvkMlRIVzBUcFfQszACYlMLcyCvKF3BAAgtgbAoVSGNS8/QUgGGg9wVDPRMFcqBpJEphLDQg2Cg2mKuQADGsxEhZW5kc3RyZWFtCmVuZG9iago5MiAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA4OSAwIFIgL1llcyA4OCAwIFIKPj4gL04gPDwKL09mZiA4NyAwIFIgL1llcyA4NiAwIFIKPj4gL1IgPDwKL09mZiA5MSAwIFIgL1llcyA5MCAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBICg0KQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMzk4LjgyNCA1MDIgNDA3LjgyNCA1MTEgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50MVZvaWRlZENoZWNrKSAKICAvVFUgKFZvaWRlZCBjaGVjaykgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjkzIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDg5IDAgUiAvWWVzIDg4IDAgUgo+PiAvTiA8PAovT2ZmIDg3IDAgUiAvWWVzIDg2IDAgUgo+PiAvUiA8PAovT2ZmIDkxIDAgUiAvWWVzIDkwIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKDQpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyA1NCA0ODAgNjMgNDg5IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDJFbmFibGVkKSAKICAvVFUgKEFkZCBhIHNlY29uZCBkZXBvc2l0IGFjY291bnQpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iago5NCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iago5NSAwIG9iago8PAovQkJveCBbIDAgMCAxMzAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDk0IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQGYiAvlSuNSz+kQsHJ11mBqxBNKpwrDygC0uDOFcjl6uvMBQAXow6NZW5kc3RyZWFtCmVuZG9iago5NiAwIG9iago8PAovQVAgPDwKL04gOTUgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDc2LjQ1NiA0NTEgMjA2LjQ1NiA0NjIgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50MkJhbmtOYW1lKSAKICAvVFUgKEJhbmspIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKOTcgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKOTggMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDk3IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQsDBQMARyUrnSuPRDKhScfJ0VuApRZcK58oACIOXuXIFcrr7OXAD9KQ41ZW5kc3RyZWFtCmVuZG9iago5OSAwIG9iago8PAovQVAgPDwKL04gOTggMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDI1Mi45MiA0NTEgMzMyLjkyIDQ2MiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQyUm91dGluZykgCiAgL1RVIChSb3V0aW5nICMpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTAwIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEwMSAwIG9iago8PAovQkJveCBbIDAgMCAxNTcuMDggMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2OSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEwMCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA0NdczMLdEAAsFQ6BkKlcal35IhYKTr7MCVyF+leFceUAFIOPcuQK5XH2duQBDtBUfZW5kc3RyZWFtCmVuZG9iagoxMDIgMCBvYmoKPDwKL0FQIDw8Ci9OIDEwMSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxNTkgMCBSIC9SZWN0IFsgMzgwLjcyIDQ1MSA1MzcuOCA0NjIgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50MkFjY291bnQpIAogIC9UVSAoQWNjb3VudCAjKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEwMyAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgNTQgNDM1IDYyIDQ0MyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQyQWNjb3VudFR5cGVfY2hlY2tpbmcpIAogIC9UVSAoQ2hlY2tpbmcgXChjaGVja2luZ1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTA0IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDYwIDAgUiAvWWVzIDU5IDAgUgo+PiAvTiA8PAovT2ZmIDU4IDAgUiAvWWVzIDU3IDAgUgo+PiAvUiA8PAovT2ZmIDYyIDAgUiAvWWVzIDYxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyAxMDYuMzQ0IDQzNSAxMTQuMzQ0IDQ0MyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQyQWNjb3VudFR5cGVfc2F2aW5ncykgCiAgL1RVIChTYXZpbmdzIFwoc2F2aW5nc1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTA1IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDYwIDAgUiAvWWVzIDU5IDAgUgo+PiAvTiA8PAovT2ZmIDU4IDAgUiAvWWVzIDU3IDAgUgo+PiAvUiA8PAovT2ZmIDYyIDAgUiAvWWVzIDYxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyAxNjEuOCA0MzUgMTY5LjggNDQzIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDJBbGxvdG1lbnRUeXBlX2ZpeGVkYW1vdW50KSAKICAvVFUgKEZpeGVkICQgXChmaXhlZF9hbW91bnRcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEwNiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMDcgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDEwNiAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA1UDAEclK50rj0QyoUnHydFbgKUWXCufKAAiDl7lyBXK6+zlwA/DkOL2VuZHN0cmVhbQplbmRvYmoKMTA4IDAgb2JqCjw8Ci9BUCA8PAovTiAxMDcgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDIwNS4wMzIgNDM1IDI1NS4wMzIgNDQ2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDJBbW91bnQpIAogIC9UVSAoYWNjb3VudDJBbW91bnQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTA5IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDYwIDAgUiAvWWVzIDU5IDAgUgo+PiAvTiA8PAovT2ZmIDU4IDAgUiAvWWVzIDU3IDAgUgo+PiAvUiA8PAovT2ZmIDYyIDAgUiAvWWVzIDYxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyAyNjMuMDMyIDQzNSAyNzEuMDMyIDQ0MyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQyQWxsb3RtZW50VHlwZV9wZXJjZW50KSAKICAvVFUgKCUgXChwZXJjZW50XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMTAgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTExIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDMwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTAgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNlAwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAPuZDitlbmRzdHJlYW0KZW5kb2JqCjExMiAwIG9iago8PAovQVAgPDwKL04gMTExIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyAyODcuMTQ0IDQzNSAzMTcuMTQ0IDQ0NiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQyUGVyY2VudCkgCiAgL1RVIChhY2NvdW50MlBlcmNlbnQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTEzIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDYwIDAgUiAvWWVzIDU5IDAgUgo+PiAvTiA8PAovT2ZmIDU4IDAgUiAvWWVzIDU3IDAgUgo+PiAvUiA8PAovT2ZmIDYyIDAgUiAvWWVzIDYxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyAzMjUuMTQ0IDQzNSAzMzMuMTQ0IDQ0MyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQyQWxsb3RtZW50VHlwZV9uZXRyZW1haW5kZXIpIAogIC9UVSAoTmV0IHJlbWFpbmRlciBcKG5ldF9yZW1haW5kZXJcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjExNCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA4OSAwIFIgL1llcyA4OCAwIFIKPj4gL04gPDwKL09mZiA4NyAwIFIgL1llcyA4NiAwIFIKPj4gL1IgPDwKL09mZiA5MSAwIFIgL1llcyA5MCAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBICg0KQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMzk4LjgyNCA0MzQgNDA3LjgyNCA0NDMgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50MlZvaWRlZENoZWNrKSAKICAvVFUgKFZvaWRlZCBjaGVjaykgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjExNSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA4OSAwIFIgL1llcyA4OCAwIFIKPj4gL04gPDwKL09mZiA4NyAwIFIgL1llcyA4NiAwIFIKPj4gL1IgPDwKL09mZiA5MSAwIFIgL1llcyA5MCAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBICg0KQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgNTQgNDEyIDYzIDQyMSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQzRW5hYmxlZCkgCiAgL1RVIChBZGQgYSB0aGlyZCBkZXBvc2l0IGFjY291bnQpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMTYgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTE3IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDEzMCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTE2IDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDQGYiAvlSuNSz+kQsHJ11mBqxBNKpwrDygC0uDOFcjl6uvMBQAXow6NZW5kc3RyZWFtCmVuZG9iagoxMTggMCBvYmoKPDwKL0FQIDw8Ci9OIDExNyAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxNTkgMCBSIC9SZWN0IFsgNzYuNDU2IDM4MyAyMDYuNDU2IDM5NCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQzQmFua05hbWUpIAogIC9UVSAoQmFuaykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMTkgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTIwIDAgb2JqCjw8Ci9CQm94IFsgMCAwIDgwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMTkgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFCwMFAwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAP0pDjVlbmRzdHJlYW0KZW5kb2JqCjEyMSAwIG9iago8PAovQVAgPDwKL04gMTIwIDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyAyNTIuOTIgMzgzIDMzMi45MiAzOTQgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50M1JvdXRpbmcpIAogIC9UVSAoUm91dGluZyAjKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEyMiAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMjMgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTU3LjA4IDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjkgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMjIgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNDXXMzC3RAALBUOgZCpXGpd+SIWCk6+zAlchfpXhXHlABSDj3LkCuVx9nbkAQ7QVH2VuZHN0cmVhbQplbmRvYmoKMTI0IDAgb2JqCjw8Ci9BUCA8PAovTiAxMjMgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDM4MC43MiAzODMgNTM3LjggMzk0IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDNBY2NvdW50KSAKICAvVFUgKEFjY291bnQgIykgL1R5cGUgL0Fubm90IC9WICgpCj4+CmVuZG9iagoxMjUgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgNjAgMCBSIC9ZZXMgNTkgMCBSCj4+IC9OIDw8Ci9PZmYgNTggMCBSIC9ZZXMgNTcgMCBSCj4+IC9SIDw8Ci9PZmYgNjIgMCBSIC9ZZXMgNjEgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAobCkKPj4gL1AgMTU5IDAgUiAvUmVjdCBbIDU0IDM2NyA2MiAzNzUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50M0FjY291bnRUeXBlX2NoZWNraW5nKSAKICAvVFUgKENoZWNraW5nIFwoY2hlY2tpbmdcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEyNiAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMTA2LjM0NCAzNjcgMTE0LjM0NCAzNzUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50M0FjY291bnRUeXBlX3NhdmluZ3MpIAogIC9UVSAoU2F2aW5ncyBcKHNhdmluZ3NcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEyNyAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMTYxLjggMzY3IDE2OS44IDM3NSBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQzQWxsb3RtZW50VHlwZV9maXhlZGFtb3VudCkgCiAgL1RVIChGaXhlZCAkIFwoZml4ZWRfYW1vdW50XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMjggMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTI5IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDUwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMjggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNVAwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAPw5Di9lbmRzdHJlYW0KZW5kb2JqCjEzMCAwIG9iago8PAovQVAgPDwKL04gMTI5IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyAyMDUuMDMyIDM2NyAyNTUuMDMyIDM3OCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQzQW1vdW50KSAKICAvVFUgKGFjY291bnQzQW1vdW50KSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEzMSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMjYzLjAzMiAzNjcgMjcxLjAzMiAzNzUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50M0FsbG90bWVudFR5cGVfcGVyY2VudCkgCiAgL1RVICglIFwocGVyY2VudFwpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTMyIDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjEzMyAwIG9iago8PAovQkJveCBbIDAgMCAzMCAxMSBdIC9GaWx0ZXIgWyAvRmxhdGVEZWNvZGUgXSAvRm9ybVR5cGUgMSAvTGVuZ3RoIDYxIC9NYXRyaXggWyAxIDAgMCAxIDAgMCBdIC9SZXNvdXJjZXMgPDwgL1Byb2NTZXQgWy9QREYgL1RleHRdIC9Gb250IDw8L0hlbHYgMTMyIDAgUj4+ID4+IAogIC9TdWJ0eXBlIC9Gb3JtIC9UeXBlIC9YT2JqZWN0Cj4+CnN0cmVhbQp4nNOzUNCzMDFWMFQoSucyUDBQMDZQMARyUrnSuPRDKhScfJ0VuApRZcK58oACIOXuXIFcrr7OXAD7mQ4rZW5kc3RyZWFtCmVuZG9iagoxMzQgMCBvYmoKPDwKL0FQIDw8Ci9OIDEzMyAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxNTkgMCBSIC9SZWN0IFsgMjg3LjE0NCAzNjcgMzE3LjE0NCAzNzggXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50M1BlcmNlbnQpIAogIC9UVSAoYWNjb3VudDNQZXJjZW50KSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjEzNSAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMzI1LjE0NCAzNjcgMzMzLjE0NCAzNzUgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50M0FsbG90bWVudFR5cGVfbmV0cmVtYWluZGVyKSAKICAvVFUgKE5ldCByZW1haW5kZXIgXChuZXRfcmVtYWluZGVyXCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMzYgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgODkgMCBSIC9ZZXMgODggMCBSCj4+IC9OIDw8Ci9PZmYgODcgMCBSIC9ZZXMgODYgMCBSCj4+IC9SIDw8Ci9PZmYgOTEgMCBSIC9ZZXMgOTAgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAoNCkKPj4gL1AgMTU5IDAgUiAvUmVjdCBbIDM5OC44MjQgMzY2IDQwNy44MjQgMzc1IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDNWb2lkZWRDaGVjaykgCiAgL1RVIChWb2lkZWQgY2hlY2spIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxMzcgMCBvYmoKPDwKL0FQIDw8Ci9EIDw8Ci9PZmYgODkgMCBSIC9ZZXMgODggMCBSCj4+IC9OIDw8Ci9PZmYgODcgMCBSIC9ZZXMgODYgMCBSCj4+IC9SIDw8Ci9PZmYgOTEgMCBSIC9ZZXMgOTAgMCBSCj4+Cj4+IC9BUyAvT2ZmIC9CUyA8PAovUyAvUyAvVyAuNQo+PiAvRiA0IC9GVCAvQnRuIC9GZiAyIAogIC9IIC9OIC9NSyA8PAovQkMgWyAuMSAuMSAuMSBdIC9CRyBbIC44IC44NDMgMSBdIC9DQSAoNCkKPj4gL1AgMTU5IDAgUiAvUmVjdCBbIDU0IDM0NCA2MyAzNTMgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50NEVuYWJsZWQpIAogIC9UVSAoQWRkIGEgZm91cnRoIGRlcG9zaXQgYWNjb3VudCkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjEzOCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxMzkgMCBvYmoKPDwKL0JCb3ggWyAwIDAgMTMwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxMzggMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNAZiIC+VK41LP6RCwcnXWYGrEE0qnCsPKALS4M4VyOXq68wFABejDo1lbmRzdHJlYW0KZW5kb2JqCjE0MCAwIG9iago8PAovQVAgPDwKL04gMTM5IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyA3Ni40NTYgMzE1IDIwNi40NTYgMzI2IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDRCYW5rTmFtZSkgCiAgL1RVIChCYW5rKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjE0MSAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxNDIgMCBvYmoKPDwKL0JCb3ggWyAwIDAgODAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDE0MSAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwULAwUDAEclK50rj0QyoUnHydFbgKUWXCufKAAiDl7lyBXK6+zlwA/SkONWVuZHN0cmVhbQplbmRvYmoKMTQzIDAgb2JqCjw8Ci9BUCA8PAovTiAxNDIgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDI1Mi45MiAzMTUgMzMyLjkyIDMyNiBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQ0Um91dGluZykgCiAgL1RVIChSb3V0aW5nICMpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTQ0IDAgb2JqCjw8IC9CYXNlRm9udCAvSGVsdmV0aWNhIC9TdWJ0eXBlIC9UeXBlMSAvTmFtZSAvSGVsdiAvVHlwZSAvRm9udCAvRW5jb2RpbmcgNSAwIFIgPj4KZW5kb2JqCjE0NSAwIG9iago8PAovQkJveCBbIDAgMCAxNTcuMDggMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2OSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDE0NCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA0NdczMLdEAAsFQ6BkKlcal35IhYKTr7MCVyF+leFceUAFIOPcuQK5XH2duQBDtBUfZW5kc3RyZWFtCmVuZG9iagoxNDYgMCBvYmoKPDwKL0FQIDw8Ci9OIDE0NSAwIFIKPj4gL0RBICgvSGVsdiA4IFRmIC4xIC4xIC4xIHJnKSAvRFYgKCkgL0YgNCAvRlQgL1R4IC9GZiAwIAogIC9NSyA8PAovQkcgWyAuOCAuODQzIDEgXQo+PiAvTWF4TGVuIDEwMCAvUCAxNTkgMCBSIC9SZWN0IFsgMzgwLjcyIDMxNSA1MzcuOCAzMjYgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50NEFjY291bnQpIAogIC9UVSAoQWNjb3VudCAjKSAvVHlwZSAvQW5ub3QgL1YgKCkKPj4KZW5kb2JqCjE0NyAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA2MCAwIFIgL1llcyA1OSAwIFIKPj4gL04gPDwKL09mZiA1OCAwIFIgL1llcyA1NyAwIFIKPj4gL1IgPDwKL09mZiA2MiAwIFIgL1llcyA2MSAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBIChsKQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgNTQgMjk5IDYyIDMwNyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQ0QWNjb3VudFR5cGVfY2hlY2tpbmcpIAogIC9UVSAoQ2hlY2tpbmcgXChjaGVja2luZ1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTQ4IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDYwIDAgUiAvWWVzIDU5IDAgUgo+PiAvTiA8PAovT2ZmIDU4IDAgUiAvWWVzIDU3IDAgUgo+PiAvUiA8PAovT2ZmIDYyIDAgUiAvWWVzIDYxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyAxMDYuMzQ0IDI5OSAxMTQuMzQ0IDMwNyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQ0QWNjb3VudFR5cGVfc2F2aW5ncykgCiAgL1RVIChTYXZpbmdzIFwoc2F2aW5nc1wpKSAvVHlwZSAvQW5ub3QgL1YgL09mZgo+PgplbmRvYmoKMTQ5IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDYwIDAgUiAvWWVzIDU5IDAgUgo+PiAvTiA8PAovT2ZmIDU4IDAgUiAvWWVzIDU3IDAgUgo+PiAvUiA8PAovT2ZmIDYyIDAgUiAvWWVzIDYxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyAxNjEuOCAyOTkgMTY5LjggMzA3IF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDRBbGxvdG1lbnRUeXBlX2ZpeGVkYW1vdW50KSAKICAvVFUgKEZpeGVkICQgXChmaXhlZF9hbW91bnRcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjE1MCAwIG9iago8PCAvQmFzZUZvbnQgL0hlbHZldGljYSAvU3VidHlwZSAvVHlwZTEgL05hbWUgL0hlbHYgL1R5cGUgL0ZvbnQgL0VuY29kaW5nIDUgMCBSID4+CmVuZG9iagoxNTEgMCBvYmoKPDwKL0JCb3ggWyAwIDAgNTAgMTEgXSAvRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0gL0Zvcm1UeXBlIDEgL0xlbmd0aCA2MSAvTWF0cml4IFsgMSAwIDAgMSAwIDAgXSAvUmVzb3VyY2VzIDw8IC9Qcm9jU2V0IFsvUERGIC9UZXh0XSAvRm9udCA8PC9IZWx2IDE1MCAwIFI+PiA+PiAKICAvU3VidHlwZSAvRm9ybSAvVHlwZSAvWE9iamVjdAo+PgpzdHJlYW0KeJzTs1DQszAxVjBUKErnMlAwUDA1UDAEclK50rj0QyoUnHydFbgKUWXCufKAAiDl7lyBXK6+zlwA/DkOL2VuZHN0cmVhbQplbmRvYmoKMTUyIDAgb2JqCjw8Ci9BUCA8PAovTiAxNTEgMCBSCj4+IC9EQSAoL0hlbHYgOCBUZiAuMSAuMSAuMSByZykgL0RWICgpIC9GIDQgL0ZUIC9UeCAvRmYgMCAKICAvTUsgPDwKL0JHIFsgLjggLjg0MyAxIF0KPj4gL01heExlbiAxMDAgL1AgMTU5IDAgUiAvUmVjdCBbIDIwNS4wMzIgMjk5IDI1NS4wMzIgMzEwIF0gL1N1YnR5cGUgL1dpZGdldCAvVCAoYWNjb3VudDRBbW91bnQpIAogIC9UVSAoYWNjb3VudDRBbW91bnQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTUzIDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDYwIDAgUiAvWWVzIDU5IDAgUgo+PiAvTiA8PAovT2ZmIDU4IDAgUiAvWWVzIDU3IDAgUgo+PiAvUiA8PAovT2ZmIDYyIDAgUiAvWWVzIDYxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyAyNjMuMDMyIDI5OSAyNzEuMDMyIDMwNyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQ0QWxsb3RtZW50VHlwZV9wZXJjZW50KSAKICAvVFUgKCUgXChwZXJjZW50XCkpIC9UeXBlIC9Bbm5vdCAvViAvT2ZmCj4+CmVuZG9iagoxNTQgMCBvYmoKPDwgL0Jhc2VGb250IC9IZWx2ZXRpY2EgL1N1YnR5cGUgL1R5cGUxIC9OYW1lIC9IZWx2IC9UeXBlIC9Gb250IC9FbmNvZGluZyA1IDAgUiA+PgplbmRvYmoKMTU1IDAgb2JqCjw8Ci9CQm94IFsgMCAwIDMwIDExIF0gL0ZpbHRlciBbIC9GbGF0ZURlY29kZSBdIC9Gb3JtVHlwZSAxIC9MZW5ndGggNjEgL01hdHJpeCBbIDEgMCAwIDEgMCAwIF0gL1Jlc291cmNlcyA8PCAvUHJvY1NldCBbL1BERiAvVGV4dF0gL0ZvbnQgPDwvSGVsdiAxNTQgMCBSPj4gPj4gCiAgL1N1YnR5cGUgL0Zvcm0gL1R5cGUgL1hPYmplY3QKPj4Kc3RyZWFtCnic07NQ0LMwMVYwVChK5zJQMFAwNlAwBHJSudK49EMqFJx8nRW4ClFlwrnygAIg5e5cgVyuvs5cAPuZDitlbmRzdHJlYW0KZW5kb2JqCjE1NiAwIG9iago8PAovQVAgPDwKL04gMTU1IDAgUgo+PiAvREEgKC9IZWx2IDggVGYgLjEgLjEgLjEgcmcpIC9EViAoKSAvRiA0IC9GVCAvVHggL0ZmIDAgCiAgL01LIDw8Ci9CRyBbIC44IC44NDMgMSBdCj4+IC9NYXhMZW4gMTAwIC9QIDE1OSAwIFIgL1JlY3QgWyAyODcuMTQ0IDI5OSAzMTcuMTQ0IDMxMCBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQ0UGVyY2VudCkgCiAgL1RVIChhY2NvdW50NFBlcmNlbnQpIC9UeXBlIC9Bbm5vdCAvViAoKQo+PgplbmRvYmoKMTU3IDAgb2JqCjw8Ci9BUCA8PAovRCA8PAovT2ZmIDYwIDAgUiAvWWVzIDU5IDAgUgo+PiAvTiA8PAovT2ZmIDU4IDAgUiAvWWVzIDU3IDAgUgo+PiAvUiA8PAovT2ZmIDYyIDAgUiAvWWVzIDYxIDAgUgo+Pgo+PiAvQVMgL09mZiAvQlMgPDwKL1MgL1MgL1cgLjUKPj4gL0YgNCAvRlQgL0J0biAvRmYgMiAKICAvSCAvTiAvTUsgPDwKL0JDIFsgLjEgLjEgLjEgXSAvQkcgWyAuOCAuODQzIDEgXSAvQ0EgKGwpCj4+IC9QIDE1OSAwIFIgL1JlY3QgWyAzMjUuMTQ0IDI5OSAzMzMuMTQ0IDMwNyBdIC9TdWJ0eXBlIC9XaWRnZXQgL1QgKGFjY291bnQ0QWxsb3RtZW50VHlwZV9uZXRyZW1haW5kZXIpIAogIC9UVSAoTmV0IHJlbWFpbmRlciBcKG5ldF9yZW1haW5kZXJcKSkgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjE1OCAwIG9iago8PAovQVAgPDwKL0QgPDwKL09mZiA4OSAwIFIgL1llcyA4OCAwIFIKPj4gL04gPDwKL09mZiA4NyAwIFIgL1llcyA4NiAwIFIKPj4gL1IgPDwKL09mZiA5MSAwIFIgL1llcyA5MCAwIFIKPj4KPj4gL0FTIC9PZmYgL0JTIDw8Ci9TIC9TIC9XIC41Cj4+IC9GIDQgL0ZUIC9CdG4gL0ZmIDIgCiAgL0ggL04gL01LIDw8Ci9CQyBbIC4xIC4xIC4xIF0gL0JHIFsgLjggLjg0MyAxIF0gL0NBICg0KQo+PiAvUCAxNTkgMCBSIC9SZWN0IFsgMzk4LjgyNCAyOTggNDA3LjgyNCAzMDcgXSAvU3VidHlwZSAvV2lkZ2V0IC9UIChhY2NvdW50NFZvaWRlZENoZWNrKSAKICAvVFUgKFZvaWRlZCBjaGVjaykgL1R5cGUgL0Fubm90IC9WIC9PZmYKPj4KZW5kb2JqCjE1OSAwIG9iago8PAovQW5ub3RzIFsgOCAwIFIgMTEgMCBSIDE0IDAgUiAxNyAwIFIgMjAgMCBSIDIzIDAgUiAyNiAwIFIgMjkgMCBSIDMyIDAgUiAzNSAwIFIgCiAgMzggMCBSIDQxIDAgUiA0NCAwIFIgNDcgMCBSIDUwIDAgUiA1MyAwIFIgNTYgMCBSIDYzIDAgUiA2NCAwIFIgNjUgMCBSIAogIDY4IDAgUiA3MSAwIFIgNzQgMCBSIDc1IDAgUiA3NiAwIFIgNzcgMCBSIDgwIDAgUiA4MSAwIFIgODQgMCBSIDg1IDAgUiAKICA5MiAwIFIgOTMgMCBSIDk2IDAgUiA5OSAwIFIgMTAyIDAgUiAxMDMgMCBSIDEwNCAwIFIgMTA1IDAgUiAxMDggMCBSIDEwOSAwIFIgCiAgMTEyIDAgUiAxMTMgMCBSIDExNCAwIFIgMTE1IDAgUiAxMTggMCBSIDEyMSAwIFIgMTI0IDAgUiAxMjUgMCBSIDEyNiAwIFIgMTI3IDAgUiAKICAxMzAgMCBSIDEzMSAwIFIgMTM0IDAgUiAxMzUgMCBSIDEzNiAwIFIgMTM3IDAgUiAxNDAgMCBSIDE0MyAwIFIgMTQ2IDAgUiAxNDcgMCBSIAogIDE0OCAwIFIgMTQ5IDAgUiAxNTIgMCBSIDE1MyAwIFIgMTU2IDAgUiAxNTcgMCBSIDE1OCAwIFIgXSAvQ29udGVudHMgMTYzIDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgMTYyIDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAKICAvVHJhbnMgPDwKCj4+IC9UeXBlIC9QYWdlCj4+CmVuZG9iagoxNjAgMCBvYmoKPDwKL0Fjcm9Gb3JtIDE2NCAwIFIgL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyAxNjIgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iagoxNjEgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwNTAyMTE0NDAwLTA0JzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwNTAyMTE0NDAwLTA0JzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjE2MiAwIG9iago8PAovQ291bnQgMSAvS2lkcyBbIDE1OSAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjE2MyAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyMjc2Cj4+CnN0cmVhbQpHYXRVNT5BcjdTJ1JuQjMrS3U7R0xJKVltXSdRUDk+LSxOZCgzUidAXyhVYUFhJzwydFRdaTMuWU1cPGBRO10qJ0BNQzdaUkphZD8lYVhyPWwhVGFuNU9BQVZDXzFvPk5JTGJUJkxRXmZLZVVbZV0pRUFWXlY0W10kLFkzSms/MmY7TnJvTyw4T2UhSTsrWU1FXWc4ISdoWWkjLlBhMl0wWTJtJVdQc0s+M0ImLjFvVC5tOVw/X1FlOGRJaltKR2AnWSY+UHJlPDNkKkdbRWVbMT9PdXA3OTgtRiRrYlpeYjhSci1YQVYrLlQ+YTxlRVs5bTtaXFFWMXNnWlVeUkBCdEUnVFkpdEomZzU8VDNSS2lGX2hsMjt0Pk1cLDdWOj4qPGFFMik1KiJfS1lNK3RIcEA3PkFOWWpnQzpVNzQ7RFhZTDddQzJdNVdJJWZZIlI4WG9XQicyOkQvUiwhOGxuKz0sPXRDRilJPUJpT1lxWVYmOSF0QyEuKyYjZERqOHIua2tRKihAO0ZAYjcwZy9TNXBcRixZW3IpXE5RLzAjOG5VVlBlbUxXWEdebi07OEs7UllrRVdZb2QtTXQ7OGBfakIvMCFyVTEzXyo7K1RCK2RFTEZdcmxcbFhZLXUrOFpyJUxaLi1SRXMtIjJnSjBHQihxdWZJNF8jU0whXUU+JVY+P2RMISQ7bkU4NUdcXltxUjdsVyE+ZSxqKnRXSEcxIk5ZNmQiQD1kVGVWcCdVQ0tbYitaNjkxVVY2NDgxWDEsSGUrbTEtN2twZSk2NT1DKXQ6OE1nanJqZHRUVlsyZ0UhVXM+dSZxU0YscC1uV2s9bSYmLlBCPkQpb2E1IVcxWTEiIWhuNmhKS0owRUttNW8jOEZXK0tqQTBeTnBiIjwsUVY3TDIpUEgrIjMmNGZoIjI/QUglTEZiZ106WWNEZi06a3ElUGUwLDdLRW4yUTRKYDVZPj1FJmVgWEI4bCdsbzdVMT1DLV5jU21zXFUxbVk6VVEqR3JcUzVpXiNaUy5SSFU7WClWWGg7MVhfY1liWDw9aVljOCJPQTlnVSJpaDoxZkBFKkVlc2FEYmglaTQuLkZdR0dLTXFdS0poO21wbSdDLjhmI3Evb1UvRyo9a1cnYXVjbWs9NUtNcVFNMV4xRjYxWSxwPVppdUU6USIpMmVSN11ETDdaMiEldFJnWSRrMitFLV9LUXE+XU1yVzpvM0BHQUdVX2FzZFQhTmUwOlIjREFOMFtTb3NFU0ZSNDBHT2c8U0YkYExrN0I7RXBxc2RLWylGSHNCVCwhbWtEMTQiaERkdGgxMyFKOW4qRCNiXS4nOi4hN0clY3BqRDI1R0I+TDRbbnFpUD0lTmg6IWRfZDMwX0hIPGgjRylkPzBjak5bPVcpTU9PZihnTC46PypHRSJIMHFgQWQ5dDtKSk0+OnJXdF4xTjxYKnI/UjJePUckXmsjUEIrX1wzRWJdY0NBSywsbl0uUSpsJWczczYnci5yJkA7SkYjTHROcisyJSIoIWxBKDMiSEZNYSxMJkdTYVomZlBhM0F0KGgvK0Moby9HYD5KISFYZ2E+V1QnSik2R3JTPjwzSEFOQ3EpNWM9KyJfJjQnTyZkT2EiYClNbmJNc1AsOlovNFBfMkBlL3MyaDM5WVRnZmtmVy51Rj9wVyYvKCgvKE81VWJ1NFAjK1EwIkpQPFk1cSVuUUpsImssIkpQPEk/Nzp0TitLZ1k9QislL0hHZDEoNUoyO2omNWA/J1NVTzQwdUZ1MmM9VTNTQylNSy1PYzpqQm1QOmE/dHFLZCVGWVtTVEFiRithViRKUF9gQWRWJWtLWG07MkNWa1o6PWxoRnEjWT5US0UlYWJTRDVxPiJDI3M0VE8nOU9QKy1Uaz5TTS5FP1InOU9ZLi1UbUlBTS5AT08kIUw7QGxVOFs5WXRkXTsxTlhnK045XlR1YigzPT9kM1A5PWsuTzs1YFhOOzppPTFdK09fZS5MTS5rUHAzWT9xZ2NqQGpQSlBOO1hTTW9mP0tuQTxKcitHJVY2L2tQK11oMCVJPmJoVy9rIVBpWFdEQW0wJ1MuTXUtbGMvIk1IJDt1J1MuVyMtbGMib01HdEtFJ1I+L0E6XXVgRCRVayVUN2pwTDxcNTg5dSpYSUg/OWJXQ2xoVExSXWU/QyYwaFFTQ0JhYkNnaCtyR0w7Ol4hR2hLcWUobVUlND5PRytBWz4xVl5rTD1NQGk3VGknbik6cjEzb1c+PFYrYi1uPm5YXTlHcjZzPktpLTgpKyoiJm5XcTEuSl5ObT5QbHNYYFYlVz8oYylzM187ZytORzlMLUNOS3BsPXBzMFQoMklGcDlHP3BoWk9xJF5XNUE0VWArbWk9OGB0YTstOV4nRitwQUU+NGp0RyI7WTQ2RkRBb2ByXUJ1dVlbRUBoVi0kVGEhLyFIXCYtJVckOz0vWXNeOW1hOCRbN19HWGdaWz9dRUhTUDddJG1rMVVNVnNBMjdpbFQqXDpPK1ZPTXRnMUVQOltePCd0U0MtYUZRLyVdKC9xSiozTmtVaEdiXjYkY3UlU1hCZDpjK2sxQi0hYWpfZ1BsZElZU0BnQlBbPkhwMjRTS0cpYSNAcDkySCsyXVZuTCVUVV4mWSpbNT0kNGRYX1lbLEdhbVtLZEY2UDleVylncEVxPGxRX3QuPClJdW0xLywhS3NqMFtCZ2VeOVAtcGQxaDRNQUIlYnNQVC9AKGc4VUlFb0ZwRHBMRFRWYiM1JVYhLnJUXWlScVE8RDc1UTxDK0xfNCE9SDFIPWZsUEAmTm5sbiZPUV0rMyVoJUVQWz0xa0g3QlMiIWguJyE4ZS5MW2xKXjdJL2tKNmpLIyFFYV1pbGJaUClgPjh0X2ktS2glVS47bF5ZcSpQUF1SPjM6IT9jJEY/KDtkSy5BKUUsWVAtRyhjcUNjYUkzKGVTZiduL0dWXHBFRyxcbnFhUU9iTj5jLi5zKlxsZDNvKTppP28rRy5fPTtpPGBEdUE5WFdHaWpDJ3UoXU9TZjRJJ15+PmVuZHN0cmVhbQplbmRvYmoKMTY0IDAgb2JqCjw8Ci9EQSAoL0hlbHYgMCBUZiAwIGcpIC9EUiA8PCAvRW5jb2RpbmcKPDwKL1JMQUZlbmNvZGluZwo1IDAgUgo+PgovRm9udCA8PCAvSGVsdiA2IDAgUiA+Pgo+PiAvRmllbGRzIFsgOCAwIFIgMTEgMCBSIDE0IDAgUiAxNyAwIFIgMjAgMCBSIDIzIDAgUiAyNiAwIFIgMjkgMCBSIDMyIDAgUiAzNSAwIFIgCiAgMzggMCBSIDQxIDAgUiA0NCAwIFIgNDcgMCBSIDUwIDAgUiA1MyAwIFIgNTYgMCBSIDYzIDAgUiA2NCAwIFIgNjUgMCBSIAogIDY4IDAgUiA3MSAwIFIgNzQgMCBSIDc1IDAgUiA3NiAwIFIgNzcgMCBSIDgwIDAgUiA4MSAwIFIgODQgMCBSIDg1IDAgUiAKICA5MiAwIFIgOTMgMCBSIDk2IDAgUiA5OSAwIFIgMTAyIDAgUiAxMDMgMCBSIDEwNCAwIFIgMTA1IDAgUiAxMDggMCBSIDEwOSAwIFIgCiAgMTEyIDAgUiAxMTMgMCBSIDExNCAwIFIgMTE1IDAgUiAxMTggMCBSIDEyMSAwIFIgMTI0IDAgUiAxMjUgMCBSIDEyNiAwIFIgMTI3IDAgUiAKICAxMzAgMCBSIDEzMSAwIFIgMTM0IDAgUiAxMzUgMCBSIDEzNiAwIFIgMTM3IDAgUiAxNDAgMCBSIDE0MyAwIFIgMTQ2IDAgUiAxNDcgMCBSIAogIDE0OCAwIFIgMTQ5IDAgUiAxNTIgMCBSIDE1MyAwIFIgMTU2IDAgUiAxNTcgMCBSIDE1OCAwIFIgXQo+PgplbmRvYmoKeHJlZgowIDE2NQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQ0NiAwMDAwMCBuIAowMDAwMDAxNzY4IDAwMDAwIG4gCjAwMDAwMDE4NjYgMDAwMDAgbiAKMDAwMDAwMjE1MiAwMDAwMCBuIAowMDAwMDAyNDAwIDAwMDAwIG4gCjAwMDAwMDI0OTggMDAwMDAgbiAKMDAwMDAwMjc5MiAwMDAwMCBuIAowMDAwMDAzMDY4IDAwMDAwIG4gCjAwMDAwMDMxNjcgMDAwMDAgbiAKMDAwMDAwMzQ1NSAwMDAwMCBuIAowMDAwMDAzNzE4IDAwMDAwIG4gCjAwMDAwMDM4MTcgMDAwMDAgbiAKMDAwMDAwNDEwNCAwMDAwMCBuIAowMDAwMDA0MzU3IDAwMDAwIG4gCjAwMDAwMDQ0NTYgMDAwMDAgbiAKMDAwMDAwNDc0MyAwMDAwMCBuIAowMDAwMDA0OTk4IDAwMDAwIG4gCjAwMDAwMDUwOTcgMDAwMDAgbiAKMDAwMDAwNTM5OCAwMDAwMCBuIAowMDAwMDA1NjQ5IDAwMDAwIG4gCjAwMDAwMDU3NDggMDAwMDAgbiAKMDAwMDAwNjAzNiAwMDAwMCBuIAowMDAwMDA2MjkwIDAwMDAwIG4gCjAwMDAwMDYzODkgMDAwMDAgbiAKMDAwMDAwNjY4NyAwMDAwMCBuIAowMDAwMDA2OTQyIDAwMDAwIG4gCjAwMDAwMDcwNDEgMDAwMDAgbiAKMDAwMDAwNzMyOSAwMDAwMCBuIAowMDAwMDA3NTc5IDAwMDAwIG4gCjAwMDAwMDc2NzggMDAwMDAgbiAKMDAwMDAwNzk2NSAwMDAwMCBuIAowMDAwMDA4MjE0IDAwMDAwIG4gCjAwMDAwMDgzMTMgMDAwMDAgbiAKMDAwMDAwODYxMSAwMDAwMCBuIAowMDAwMDA4ODYyIDAwMDAwIG4gCjAwMDAwMDg5NjEgMDAwMDAgbiAKMDAwMDAwOTI0OSAwMDAwMCBuIAowMDAwMDA5NTEyIDAwMDAwIG4gCjAwMDAwMDk2MTEgMDAwMDAgbiAKMDAwMDAwOTg5OCAwMDAwMCBuIAowMDAwMDEwMTUxIDAwMDAwIG4gCjAwMDAwMTAyNTAgMDAwMDAgbiAKMDAwMDAxMDUzNyAwMDAwMCBuIAowMDAwMDEwNzkyIDAwMDAwIG4gCjAwMDAwMTA4OTEgMDAwMDAgbiAKMDAwMDAxMTE5MiAwMDAwMCBuIAowMDAwMDExNDQzIDAwMDAwIG4gCjAwMDAwMTE1NDIgMDAwMDAgbiAKMDAwMDAxMTgzMCAwMDAwMCBuIAowMDAwMDEyMDg0IDAwMDAwIG4gCjAwMDAwMTIxODMgMDAwMDAgbiAKMDAwMDAxMjQ4MSAwMDAwMCBuIAowMDAwMDEyNzM2IDAwMDAwIG4gCjAwMDAwMTMwOTcgMDAwMDAgbiAKMDAwMDAxMzM1NiAwMDAwMCBuIAowMDAwMDEzNzIwIDAwMDAwIG4gCjAwMDAwMTM5ODQgMDAwMDAgbiAKMDAwMDAxNDM0NyAwMDAwMCBuIAowMDAwMDE0NjA5IDAwMDAwIG4gCjAwMDAwMTQ5NzcgMDAwMDAgbiAKMDAwMDAxNTM1NCAwMDAwMCBuIAowMDAwMDE1NzI1IDAwMDAwIG4gCjAwMDAwMTU4MjQgMDAwMDAgbiAKMDAwMDAxNjExMiAwMDAwMCBuIAowMDAwMDE2MzY4IDAwMDAwIG4gCjAwMDAwMTY0NjcgMDAwMDAgbiAKMDAwMDAxNjc1NCAwMDAwMCBuIAowMDAwMDE3MDEzIDAwMDAwIG4gCjAwMDAwMTcxMTIgMDAwMDAgbiAKMDAwMDAxNzQxMSAwMDAwMCBuIAowMDAwMDE3NjY5IDAwMDAwIG4gCjAwMDAwMTgwNTEgMDAwMDAgbiAKMDAwMDAxODQ0MCAwMDAwMCBuIAowMDAwMDE4ODM2IDAwMDAwIG4gCjAwMDAwMTg5MzUgMDAwMDAgbiAKMDAwMDAxOTIyMiAwMDAwMCBuIAowMDAwMDE5NDg3IDAwMDAwIG4gCjAwMDAwMTk4NzIgMDAwMDAgbiAKMDAwMDAxOTk3MSAwMDAwMCBuIAowMDAwMDIwMjU4IDAwMDAwIG4gCjAwMDAwMjA1MjUgMDAwMDAgbiAKMDAwMDAyMDkzMyAwMDAwMCBuIAowMDAwMDIxNTQ3IDAwMDAwIG4gCjAwMDAwMjE4MDYgMDAwMDAgbiAKMDAwMDAyMjQyNCAwMDAwMCBuIAowMDAwMDIyNjg4IDAwMDAwIG4gCjAwMDAwMjMzMDUgMDAwMDAgbiAKMDAwMDAyMzU2NyAwMDAwMCBuIAowMDAwMDIzOTQxIDAwMDAwIG4gCjAwMDAwMjQzMTcgMDAwMDAgbiAKMDAwMDAyNDQxNiAwMDAwMCBuIAowMDAwMDI0NzA0IDAwMDAwIG4gCjAwMDAwMjQ5NjAgMDAwMDAgbiAKMDAwMDAyNTA1OSAwMDAwMCBuIAowMDAwMDI1MzQ2IDAwMDAwIG4gCjAwMDAwMjU2MDUgMDAwMDAgbiAKMDAwMDAyNTcwNSAwMDAwMCBuIAowMDAwMDI2MDA2IDAwMDAwIG4gCjAwMDAwMjYyNjYgMDAwMDAgbiAKMDAwMDAyNjY0OSAwMDAwMCBuIAowMDAwMDI3MDM5IDAwMDAwIG4gCjAwMDAwMjc0MzYgMDAwMDAgbiAKMDAwMDAyNzUzNiAwMDAwMCBuIAowMDAwMDI3ODI1IDAwMDAwIG4gCjAwMDAwMjgwOTIgMDAwMDAgbiAKMDAwMDAyODQ3OCAwMDAwMCBuIAowMDAwMDI4NTc4IDAwMDAwIG4gCjAwMDAwMjg4NjcgMDAwMDAgbiAKMDAwMDAyOTEzNiAwMDAwMCBuIAowMDAwMDI5NTQ1IDAwMDAwIG4gCjAwMDAwMjk5MjAgMDAwMDAgbiAKMDAwMDAzMDI5NiAwMDAwMCBuIAowMDAwMDMwMzk2IDAwMDAwIG4gCjAwMDAwMzA2ODYgMDAwMDAgbiAKMDAwMDAzMDk0NCAwMDAwMCBuIAowMDAwMDMxMDQ0IDAwMDAwIG4gCjAwMDAwMzEzMzMgMDAwMDAgbiAKMDAwMDAzMTU5NCAwMDAwMCBuIAowMDAwMDMxNjk0IDAwMDAwIG4gCjAwMDAwMzE5OTUgMDAwMDAgbiAKMDAwMDAzMjI1NSAwMDAwMCBuIAowMDAwMDMyNjM4IDAwMDAwIG4gCjAwMDAwMzMwMjggMDAwMDAgbiAKMDAwMDAzMzQyNSAwMDAwMCBuIAowMDAwMDMzNTI1IDAwMDAwIG4gCjAwMDAwMzM4MTQgMDAwMDAgbiAKMDAwMDAzNDA4MSAwMDAwMCBuIAowMDAwMDM0NDY3IDAwMDAwIG4gCjAwMDAwMzQ1NjcgMDAwMDAgbiAKMDAwMDAzNDg1NiAwMDAwMCBuIAowMDAwMDM1MTI1IDAwMDAwIG4gCjAwMDAwMzU1MzQgMDAwMDAgbiAKMDAwMDAzNTkwOSAwMDAwMCBuIAowMDAwMDM2Mjg2IDAwMDAwIG4gCjAwMDAwMzYzODYgMDAwMDAgbiAKMDAwMDAzNjY3NiAwMDAwMCBuIAowMDAwMDM2OTM0IDAwMDAwIG4gCjAwMDAwMzcwMzQgMDAwMDAgbiAKMDAwMDAzNzMyMyAwMDAwMCBuIAowMDAwMDM3NTg0IDAwMDAwIG4gCjAwMDAwMzc2ODQgMDAwMDAgbiAKMDAwMDAzNzk4NSAwMDAwMCBuIAowMDAwMDM4MjQ1IDAwMDAwIG4gCjAwMDAwMzg2MjggMDAwMDAgbiAKMDAwMDAzOTAxOCAwMDAwMCBuIAowMDAwMDM5NDE1IDAwMDAwIG4gCjAwMDAwMzk1MTUgMDAwMDAgbiAKMDAwMDAzOTgwNCAwMDAwMCBuIAowMDAwMDQwMDcxIDAwMDAwIG4gCjAwMDAwNDA0NTcgMDAwMDAgbiAKMDAwMDA0MDU1NyAwMDAwMCBuIAowMDAwMDQwODQ2IDAwMDAwIG4gCjAwMDAwNDExMTUgMDAwMDAgbiAKMDAwMDA0MTUyNCAwMDAwMCBuIAowMDAwMDQxODk5IDAwMDAwIG4gCjAwMDAwNDI2MjkgMDAwMDAgbiAKMDAwMDA0MjcxOSAwMDAwMCBuIAowMDAwMDQyOTgyIDAwMDAwIG4gCjAwMDAwNDMwNDUgMDAwMDAgbiAKMDAwMDA0NTQxNCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzw5YWMxOWUzN2YwZmQwZThmYjRkYzBhY2M0Mjg1MDMzNj48OWFjMTllMzdmMGZkMGU4ZmI0ZGMwYWNjNDI4NTAzMzY+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDE2MSAwIFIKL1Jvb3QgMTYwIDAgUgovU2l6ZSAxNjUKPj4Kc3RhcnR4cmVmCjQ2MDU5CiUlRU9GCg==";
const __c_ach_direct_deposit_pdf: Uint8Array = (() => {
  const bin = atob(__c_ach_direct_deposit_pdf_b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
})();
const __c_ach_direct_deposit_md: string = `# ACH Direct Deposit Authorization

*I authorize the Employer named below (directly or through its payroll service provider) to deposit any amounts owed to me by initiating ACH credit entries to the account(s) at the financial institution(s) identified below.*

## Employer

- **Name:** {{parties.employer.legalName}}{{#if parties.employer.name}} (DBA {{parties.employer.name}}){{/if}}
- **Payroll provider:** {{employerPayrollProvider}}
- **Address:** {{employerAddress.line1}}{{#if employerAddress.line2}}, {{employerAddress.line2}}{{/if}}, {{employerAddress.locality}}, {{employerAddress.region}} {{employerAddress.postalCode}}
- **Phone:** {{employerPhone}}
- **Email:** {{employerEmail}}

## Employee

- **Name:** {{parties.employee.name}}
- **Employee ID:** {{employeeId}}
- **SSN:** {{employeeSsn}}
- **Address:** {{employeeAddress.line1}}{{#if employeeAddress.line2}}, {{employeeAddress.line2}}{{/if}}, {{employeeAddress.locality}}, {{employeeAddress.region}} {{employeeAddress.postalCode}}
- **Phone:** {{employeePhone}}
- **Email:** {{employeeEmail}}

## Action

- [{{#if (eq actionType "new")}}x{{else}} {{/if}}] New direct deposit
- [{{#if (eq actionType "change")}}x{{else}} {{/if}}] Change existing direct deposit
- [{{#if (eq actionType "stop")}}x{{else}} {{/if}}] Stop direct deposit

## Account 1 — Primary

- **Bank:** {{account1BankName}}
- **Routing/ABA #:** {{account1RoutingNumber}}
- **Account #:** {{account1AccountNumber}}
- **Type:**
  - [{{#if (eq account1AccountType "checking")}}x{{else}} {{/if}}] Checking
  - [{{#if (eq account1AccountType "savings")}}x{{else}} {{/if}}] Savings
- **Allotment:**
  - [{{#if (eq account1AllotmentType "fixed_amount")}}x{{else}} {{/if}}] Fixed amount: \${{account1Amount.amount}} {{account1Amount.currency}}
  - [{{#if (eq account1AllotmentType "percent")}}x{{else}} {{/if}}] Percent of net pay: {{account1Percent}}%
  - [{{#if (eq account1AllotmentType "net_remainder")}}x{{else}} {{/if}}] Net pay remainder
- [{{#if account1VoidedCheckAttached}}x{{else}} {{/if}}] Voided check or deposit slip attached

{{#if account2Enabled}}
## Account 2

- **Bank:** {{account2BankName}}
- **Routing/ABA #:** {{account2RoutingNumber}}
- **Account #:** {{account2AccountNumber}}
- **Type:**
  - [{{#if (eq account2AccountType "checking")}}x{{else}} {{/if}}] Checking
  - [{{#if (eq account2AccountType "savings")}}x{{else}} {{/if}}] Savings
- **Allotment:**
  - [{{#if (eq account2AllotmentType "fixed_amount")}}x{{else}} {{/if}}] Fixed amount: \${{account2Amount.amount}} {{account2Amount.currency}}
  - [{{#if (eq account2AllotmentType "percent")}}x{{else}} {{/if}}] Percent of net pay: {{account2Percent}}%
  - [{{#if (eq account2AllotmentType "net_remainder")}}x{{else}} {{/if}}] Net pay remainder
- [{{#if account2VoidedCheckAttached}}x{{else}} {{/if}}] Voided check or deposit slip attached
{{/if}}

{{#if account3Enabled}}
## Account 3

- **Bank:** {{account3BankName}}
- **Routing/ABA #:** {{account3RoutingNumber}}
- **Account #:** {{account3AccountNumber}}
- **Type:**
  - [{{#if (eq account3AccountType "checking")}}x{{else}} {{/if}}] Checking
  - [{{#if (eq account3AccountType "savings")}}x{{else}} {{/if}}] Savings
- **Allotment:**
  - [{{#if (eq account3AllotmentType "fixed_amount")}}x{{else}} {{/if}}] Fixed amount: \${{account3Amount.amount}} {{account3Amount.currency}}
  - [{{#if (eq account3AllotmentType "percent")}}x{{else}} {{/if}}] Percent of net pay: {{account3Percent}}%
  - [{{#if (eq account3AllotmentType "net_remainder")}}x{{else}} {{/if}}] Net pay remainder
- [{{#if account3VoidedCheckAttached}}x{{else}} {{/if}}] Voided check or deposit slip attached
{{/if}}

{{#if account4Enabled}}
## Account 4

- **Bank:** {{account4BankName}}
- **Routing/ABA #:** {{account4RoutingNumber}}
- **Account #:** {{account4AccountNumber}}
- **Type:**
  - [{{#if (eq account4AccountType "checking")}}x{{else}} {{/if}}] Checking
  - [{{#if (eq account4AccountType "savings")}}x{{else}} {{/if}}] Savings
- **Allotment:**
  - [{{#if (eq account4AllotmentType "fixed_amount")}}x{{else}} {{/if}}] Fixed amount: \${{account4Amount.amount}} {{account4Amount.currency}}
  - [{{#if (eq account4AllotmentType "percent")}}x{{else}} {{/if}}] Percent of net pay: {{account4Percent}}%
  - [{{#if (eq account4AllotmentType "net_remainder")}}x{{else}} {{/if}}] Net pay remainder
- [{{#if account4VoidedCheckAttached}}x{{else}} {{/if}}] Voided check or deposit slip attached
{{/if}}

## Terms

1. This authorization remains in effect until the Employer has received written notice from me of its termination, given in such time and manner as to afford the Employer and the financial institution(s) reasonable opportunity to act on it.
2. If the Employer deposits funds into my account in error, I authorize the Employer to debit my account for the amount of the erroneous credit, not to exceed the original amount.
3. To the extent permitted by law, I have the right to refuse direct deposit or revoke this authorization at any time without fear of retaliation.
4. Origination of these ACH transactions will comply with U.S. law and the NACHA Operating Rules.
5. I represent that I am the account holder or am authorized to act with respect to the account(s) identified above.

## Signature

{{#with parties.employee}}
**Signature:** {{signature "employeeSignature"}}
**Date:** {{signatureDate "employeeSignature"}}
**Printed name:** {{printedName "employeePrintedName"}}
{{/with}}
`;

const contents: Record<string, string | Uint8Array> = {
  "ach-direct-deposit.instructions.md": __c_ach_direct_deposit_instructions_md,
  "ach-direct-deposit.pdf": __c_ach_direct_deposit_pdf,
  "ach-direct-deposit.md": __c_ach_direct_deposit_md,
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
 * ACH Direct Deposit Authorization
 *
 * Authorization by which an employee authorizes their employer (directly or through a payroll service provider) to deposit net pay—in whole or split across up to four deposit accounts—via ACH credit entries to the named depository institution(s). Governed by NACHA Operating Rules and (for non-exempt employee protections) FLSA and state wage law.
 */
export const achDirectDeposit = Object.assign(baseForm, {
  /** Pre-populated resolver containing every layer and instruction file this artifact references. */
  resolver,
  /** The raw form spec, exactly as authored in artifacts/banking/ach-direct-deposit/. */
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

export default achDirectDeposit;
