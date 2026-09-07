/**
 * Sample data for the Arabic letter.
 *
 * One set, sized so the schedule runs past the end of the first page. A
 * single-page right-to-left document would say nothing about pagination in a
 * right-to-left document: the questions worth measuring are whether the page
 * breaks land on the same row on both sides and whether the repeated table
 * header comes back on the right edge of the continued page.
 *
 * The amounts and quantities are Western digits, which is what
 * the `ar-SA` formatter produces and what an Arabic business letter across the Gulf
 * and the Levant is set in. See that registry for why the numbering system is
 * pinned rather than left to the runtime.
 */

import type { RuntimeParty } from "@paradoc/types";

import type { DocumentData } from "../components/document-context";
import { computeLineAmounts, type LineItemInput } from "../lib/totals";

const CURRENCY = "SAR";
const TAX_RATE_PERCENT = 15;

const sender = {
  name: "شركة الواحة للتجهيزات المكتبية",
  legalName: "شركة الواحة للتجهيزات المكتبية المحدودة",
  domicile: "SA",
  entityType: "شركة ذات مسؤولية محدودة",
  taxId: "3104857291",
};

const recipient = {
  name: "مؤسسة النيل للخدمات اللوجستية",
  legalName: "مؤسسة النيل للخدمات اللوجستية",
  domicile: "SA",
  entityType: "مؤسسة فردية",
};

/** The confirmed goods, each named the way an Arabic purchase schedule names them. */
const GOODS: readonly { description: string; unit: string; price: number }[] = [
  { description: "مكتب تنفيذي بسطح خشبي", unit: "قطعة", price: 1850 },
  { description: "كرسي مكتبي بمسند قطني", unit: "قطعة", price: 640 },
  { description: "خزانة ملفات معدنية بأربعة أدراج", unit: "قطعة", price: 720 },
  { description: "طاولة اجتماعات لثمانية أشخاص", unit: "قطعة", price: 3200 },
  { description: "لوحة عرض مغناطيسية", unit: "قطعة", price: 310 },
  { description: "ورق تصوير مقاس A4", unit: "صندوق", price: 95 },
  { description: "حبر طابعة ليزر أسود", unit: "عبوة", price: 240 },
  { description: "مجلدات أرشفة بغلاف صلب", unit: "صندوق", price: 130 },
  { description: "أقلام حبر جاف زرقاء", unit: "علبة", price: 45 },
  { description: "دباسة مكتبية متوسطة", unit: "قطعة", price: 65 },
  { description: "آلة تقطيع الورق", unit: "قطعة", price: 1450 },
  { description: "سجادة أرضية للممرات", unit: "متر", price: 180 },
  { description: "مصباح مكتبي موفر للطاقة", unit: "قطعة", price: 220 },
];

/**
 * Twenty-six rows: the schedule runs onto a second page, so the plan has a
 * break to place and a header to repeat.
 */
const ITEMS: LineItemInput[] = GOODS.flatMap((item, index) => [
  {
    description: `${item.description} — الدفعة الأولى`,
    quantity: 2 + (index % 5),
    unit: item.unit,
    unitPrice: { amount: item.price, currency: CURRENCY },
  },
  {
    description: `${item.description} — الدفعة الثانية`,
    quantity: 1 + (index % 4),
    unit: item.unit,
    unitPrice: { amount: item.price, currency: CURRENCY },
  },
]);

/** The letter's data, whose parties carry runtime ids the way the proposal's do. */
export interface ArabicLetterData extends DocumentData {
  parties: Record<string, RuntimeParty | RuntimeParty[]>;
}

const { lineItems, subtotalAmount } = computeLineAmounts(ITEMS, CURRENCY);

/** The sample letter, measured to run onto a second page. */
export const arabicLetterData: ArabicLetterData = {
  fields: {
    letterNumber: "AWH-2026-0311",
    issuedOn: "2026-09-04",
    sender,
    senderAddress: {
      line1: "طريق الملك عبدالعزيز",
      line2: "مبنى 42، الدور الثالث",
      locality: "الرياض",
      region: "منطقة الرياض",
      postalCode: "12345",
      country: "SA",
    },
    senderPhone: { number: "+966112345678", type: "work" },
    recipient,
    recipientContact: {
      name: "سعاد المنصوري",
      firstName: "سعاد",
      lastName: "المنصوري",
      title: "الأستاذة",
    },
    recipientAddress: {
      line1: "شارع الأمير سلطان",
      locality: "جدة",
      region: "منطقة مكة المكرمة",
      postalCode: "23442",
      country: "SA",
    },
    body:
      "نؤكد لكم استلام طلب الشراء المشار إليه أعلاه، ونرفق فيما يلي جدول البنود المعتمدة وأسعارها. " +
      "تسري الأسعار المذكورة لمدة ثلاثين يوماً من تاريخ هذا الخطاب، ويبدأ التسليم خلال أسبوعين من " +
      "تاريخ اعتماد الطلب. وفي حال وجود أي ملاحظة على البنود أو الكميات، نرجو إشعارنا خلال خمسة أيام عمل.",
    currency: CURRENCY,
    items: lineItems,
    subtotalAmount,
    taxRatePercent: TAX_RATE_PERCENT,
    closing: "وتفضلوا بقبول فائق الاحترام والتقدير.",
  },
  parties: {
    sender: { id: "sender-0", ...sender },
    recipient: { id: "recipient-0", ...recipient },
  },
};
