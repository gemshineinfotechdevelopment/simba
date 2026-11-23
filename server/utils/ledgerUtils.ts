import { AccountLedger } from '../models/AccountLedger';

export const escapeRegex = (text: string): string => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

export const cleanNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

/**
 * Robust date parser supporting DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, ISO, etc.
 */
export const parseDateToTimestamp = (dateStr: string): number => {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const clean = dateStr.trim();

  // Format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  const parsed = Date.parse(clean);
  return isNaN(parsed) ? 0 : parsed;
};

export const getParticularNetTotal = (p: any): number => {
  if (!p) return 0;
  const storedTotal = cleanNumber(p.total);

  const prodSubtotal = (p.products || []).reduce((acc: number, item: any) => {
    const a = cleanNumber(item.amount);
    const q = cleanNumber(item.quantity);
    const r = cleanNumber(item.rate);
    const u = cleanNumber(item.pktUnit || item.pktPerUnit) || 1;
    return acc + (a > 0 ? a : q * r * u);
  }, 0);

  const subtotal = prodSubtotal > 0 ? prodSubtotal : cleanNumber(p.amount);

  let discountAmt = 0;
  const discStr = String(p.discount || '0').trim();
  const discNum = cleanNumber(discStr);
  const isDiscFlat = discStr.startsWith('₹') || discStr.toLowerCase().includes('rs');
  if (discStr.includes('%') || (!isDiscFlat && discNum > 0 && discNum <= 100)) {
    discountAmt = (subtotal * discNum) / 100;
  } else {
    discountAmt = discNum;
  }

  const baseAfterDisc = Math.max(0, subtotal - discountAmt);

  let packingAmt = 0;
  const packStr = String(p.packing || '0').trim();
  const packNum = cleanNumber(packStr);
  const isPackFlat = packStr.startsWith('₹') || packStr.toLowerCase().includes('rs');
  if (packStr.includes('%') || (!isPackFlat && packNum > 0 && packNum <= 100)) {
    packingAmt = (baseAfterDisc * packNum) / 100;
  } else {
    packingAmt = packNum;
  }

  const taxAmt = cleanNumber(p.tax);
  const calculatedNet = Math.max(0, subtotal - discountAmt + packingAmt + taxAmt);

  if (storedTotal > 0) {
    return Number(storedTotal.toFixed(2));
  }

  return Number(calculatedNet.toFixed(2));
};

export const recalculateCustomerBalance = async (customerName: string): Promise<void> => {
  if (!customerName || customerName.trim() === '' || customerName.toLowerCase() === 'all') return;
  try {
    const escapedName = escapeRegex(customerName.trim());
    const entries = await AccountLedger.find({
      customerName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    }).sort({ createdAt: 1, _id: 1 });

    // Sort chronologically ascending (earliest to latest) for accurate running balance
    entries.sort((a, b) => {
      const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (timeA !== timeB) return timeA - timeB;
      const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cA - cB;
    });

    let currentBalance = 0;
    for (const entry of entries) {
      const deb = parseFloat(String(entry.debit || '0').replace(/,/g, '')) || 0;
      const cred = parseFloat(String(entry.credit || '0').replace(/,/g, '')) || 0;
      currentBalance = currentBalance + cred - deb;
      entry.balance = currentBalance.toFixed(2);
      await entry.save();
    }
  } catch (err) {
    console.error(`Failed to recalculate balance for customer ${customerName}:`, err);
  }
};

