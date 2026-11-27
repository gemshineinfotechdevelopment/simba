export interface ParsedChargeValue {
  amount: number;
  isPercent: boolean;
  num: number;
  cleanNum: string;
}

const parseSingleChargeValue = (rawVal: unknown, base: number): ParsedChargeValue => {
  const rawStr = String(rawVal ?? '').trim();
  if (!rawStr) return { amount: 0, isPercent: false, num: 0, cleanNum: '' };

  const cleanNum = rawStr.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleanNum) || 0;
  if (num <= 0) return { amount: 0, isPercent: false, num: 0, cleanNum };

  const isFlat = rawStr.startsWith('₹') || rawStr.toLowerCase().includes('rs');
  const isPercent = rawStr.includes('%') || (!isFlat && num < 100);
  const amount = isPercent ? (base * num) / 100 : num;

  return { amount, isPercent, num, cleanNum };
};

/**
 * Parses a charge string (Discount, Packing, or Tax).
 * Values strictly under 100 (or containing '%') are treated as percentages unless
 * prefixed with a currency marker ('₹' or 'rs'); 3-digit+ numbers (>= 100) without '%' are flat rupees.
 * Also supports combined '+' expressions such as "18% + ₹500".
 */
export const parseChargeValue = (rawVal: unknown, base: number): ParsedChargeValue => {
  const rawStr = String(rawVal ?? '').trim();
  if (!rawStr) return { amount: 0, isPercent: false, num: 0, cleanNum: '' };

  if (rawStr.includes('+')) {
    const parts = rawStr
      .split('+')
      .map((part) => parseSingleChargeValue(part, base))
      .filter((parsed) => parsed.num > 0);
    if (parts.length === 0) return { amount: 0, isPercent: false, num: 0, cleanNum: '' };
    const totalAmount = parts.reduce((sum, p) => sum + p.amount, 0);
    return {
      amount: totalAmount,
      isPercent: false,
      num: totalAmount,
      cleanNum: String(totalAmount),
    };
  }

  return parseSingleChargeValue(rawStr, base);
};

/**
 * Formats a Discount, Packing, or Tax value consistently as '%' or '₹'.
 */
export const formatChargeDisplay = (rawVal: unknown, emptyFallback = '-'): string => {
  const rawStr = String(rawVal ?? '').trim();
  if (!rawStr) return emptyFallback;

  if (rawStr.includes('+')) {
    const formatted = rawStr
      .split('+')
      .map((part) => parseSingleChargeValue(part, 100))
      .filter((p) => p.num > 0)
      .map((p) => (p.isPercent ? `${p.cleanNum}%` : `₹${p.num.toLocaleString('en-IN')}`));
    return formatted.length > 0 ? formatted.join(' + ') : emptyFallback;
  }

  const parsed = parseSingleChargeValue(rawStr, 100);
  if (parsed.num <= 0) return emptyFallback;
  return parsed.isPercent
    ? `${parsed.cleanNum}%`
    : `₹${parsed.num.toLocaleString('en-IN')}`;
};

/**
 * Computes Discount, Packing (on post-discount base), and Tax (on taxable base) amounts and metadata.
 */
export const calculateBillCharges = (
  charges: { discount?: unknown; packing?: unknown; tax?: unknown },
  subtotal: number
) => {
  const discountParsed = parseChargeValue(charges.discount, subtotal);
  const discountAmt = discountParsed.amount;
  const baseAfterDiscount = Math.max(0, subtotal - discountAmt);

  const packingParsed = parseChargeValue(charges.packing, baseAfterDiscount);
  const packingAmt = packingParsed.amount;
  const taxableBase = Math.max(0, baseAfterDiscount + packingAmt);

  const taxParsed = parseChargeValue(charges.tax, taxableBase);
  const taxAmt = taxParsed.amount;

  return {
    discountParsed,
    packingParsed,
    taxParsed,
    discountAmt,
    packingAmt,
    taxAmt,
  };
};

const ONES_WORDS = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS_WORDS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const convertBelowHundred = (n: number): string => {
  if (n < 20) return ONES_WORDS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones > 0 ? `${TENS_WORDS[tens]} ${ONES_WORDS[ones]}` : TENS_WORDS[tens];
};

const convertIndianIntegerToWords = (num: number): string => {
  if (num === 0) return 'Zero';

  const parts: string[] = [];
  const crores = Math.floor(num / 10000000);
  if (crores > 0) {
    parts.push(`${convertIndianIntegerToWords(crores)} Crore`);
    num %= 10000000;
  }

  const lakhs = Math.floor(num / 100000);
  if (lakhs > 0) {
    parts.push(`${convertBelowHundred(lakhs)} Lakh`);
    num %= 100000;
  }

  const thousands = Math.floor(num / 1000);
  if (thousands > 0) {
    parts.push(`${convertBelowHundred(thousands)} Thousand`);
    num %= 1000;
  }

  const hundreds = Math.floor(num / 100);
  if (hundreds > 0) {
    parts.push(`${ONES_WORDS[hundreds]} Hundred`);
    num %= 100;
  }

  if (num > 0) {
    parts.push(convertBelowHundred(num));
  }

  return parts.join(' ');
};

/**
 * Formats a numeric rupee amount into Indian English words (e.g. "Rupees Sixty Eight Thousand Four Hundred Forty Only").
 */
export const formatAmountInWords = (amount: number): string => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Rupees Zero Only';
  }

  const totalPaise = Math.round(amount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const rupeeWords = `Rupees ${convertIndianIntegerToWords(rupees)}`;
  if (paise > 0) {
    return `${rupeeWords} and ${convertBelowHundred(paise)} Paise Only`;
  }
  return `${rupeeWords} Only`;
};

/**
 * Computes item count, total units/pkts, and formatted amount in words for bill footers.
 */
export const getBillSummaryMeta = (
  products: Array<{ pktUnit?: unknown; pktPerUnit?: unknown }> | undefined,
  netTotal: number
) => {
  const list = products || [];
  const totalUnits = list.reduce((sum, item) => {
    const raw = parseFloat(String(item.pktUnit ?? item.pktPerUnit ?? 0).replace(/,/g, ''));
    return sum + (Number.isFinite(raw) && raw > 0 ? raw : 0);
  }, 0);

  return {
    itemCount: list.length,
    totalUnits: Number(totalUnits.toFixed(2)),
    amountInWords: formatAmountInWords(netTotal),
  };
};
