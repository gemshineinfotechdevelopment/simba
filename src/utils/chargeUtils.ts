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
