export interface ParsedChargeValue {
  amount: number;
  isPercent: boolean;
  num: number;
  cleanNum: string;
}

/**
 * Parses a charge string (Discount, Packing, or Tax).
 * Values strictly under 100 (or containing '%') are treated as percentages unless
 * prefixed with a currency marker ('₹' or 'rs'); 3-digit+ numbers (>= 100) without '%' are flat rupees.
 */
export const parseChargeValue = (rawVal: unknown, base: number): ParsedChargeValue => {
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
 * Formats a Discount, Packing, or Tax value consistently as '%' or '₹'.
 */
export const formatChargeDisplay = (rawVal: unknown, emptyFallback = '-'): string => {
  const parsed = parseChargeValue(rawVal, 100);
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
