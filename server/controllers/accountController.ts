import type { Request, Response, NextFunction } from 'express';
import { AccountLedger } from '../models/AccountLedger';
import { AccountOption, type AccountOptionCategory } from '../models/AccountOption';
import { escapeRegex, recalculateCustomerBalance, parseDateToTimestamp } from '../utils/ledgerUtils';

const DEFAULT_ACCOUNT_OPTIONS: Array<{ category: AccountOptionCategory; name: string }> = [
  { category: 'BANK', name: 'HDFC Bank' },
  { category: 'BANK', name: 'State Bank of India (SBI)' },
  { category: 'BANK', name: 'ICICI Bank' },
  { category: 'BANK', name: 'Axis Bank' },
  { category: 'BANK', name: 'Karur Vysya Bank' },
  { category: 'BANK', name: 'Tamilnad Mercantile Bank' },
  { category: 'TRANSFERRED_TO', name: 'GPK Cash Counter' },
  { category: 'TRANSFERRED_TO', name: 'Main Office Cash' },
  { category: 'TRANSFERRED_TO', name: 'Managing Partner Account' },
];

export const getAccountDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerName } = req.query;
    const filter: any = {};
    if (customerName && typeof customerName === 'string' && customerName.trim() !== '' && customerName.toLowerCase() !== 'all') {
      filter.customerName = { $regex: new RegExp(`^${escapeRegex(customerName.trim())}$`, 'i') };
    }

    const accounts = await AccountLedger.find(filter).lean();

    // Sort date-wise descending (today's / newest date first, previous dates below)
    accounts.sort((a: any, b: any) => {
      const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;
      const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cB - cA;
    });

    res.status(200).json({ success: true, count: accounts.length, data: accounts });
  } catch (error) {
    next(error);
  }
};

export const addCredit = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const { customerName, companyName, creditAmount, date, paymentMode, bankName, transferredTo, reference, notes } = req.body;

    const parsedCredit = parseFloat(String(creditAmount).replace(/,/g, '')) || 0;
    if (parsedCredit <= 0) {
      res.status(400).json({ success: false, error: 'Valid credit amount greater than 0 is required' });
      return;
    }

    const finalCustomerName = (customerName || 'General').trim();
    const resolvedPaymentMode = paymentMode ? String(paymentMode).trim() : 'GPay / PhonePe / UPI';
    const resolvedBankName = bankName ? String(bankName).trim() : '';
    const resolvedTransferredTo = transferredTo ? String(transferredTo).trim() : '';
    const autoNotes =
      [resolvedPaymentMode, resolvedBankName, resolvedTransferredTo].filter(Boolean).join(' • ') ||
      'Payment / Credit received';

    const ledgerEntry = await AccountLedger.create({
      billNo: reference ? String(reference).trim() : '',
      customerName: finalCustomerName,
      companyName: companyName ? String(companyName).trim() : 'General',
      date: date || new Date().toISOString().split('T')[0],
      debit: '0.00',
      credit: parsedCredit.toFixed(2),
      balance: '0.00',
      paymentMode: resolvedPaymentMode,
      bankName: resolvedBankName,
      transferredTo: resolvedTransferredTo,
      reference: reference ? String(reference).trim() : '',
      notes: notes ? String(notes).trim() : autoNotes,
      type: 'CREDIT',
    });

    await recalculateCustomerBalance(finalCustomerName);

    res.status(201).json({
      success: true,
      message: 'Credit added successfully',
      data: ledgerEntry,
    });
  } catch (error: any) {
    console.error('[Add Credit Error]:', error);
    res.status(400).json({ success: false, error: error?.message || 'Failed to add credit' });
  }
};

export const deleteAccountEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const entry = await AccountLedger.findById(req.params.id);
    if (!entry) {
      res.status(404).json({ success: false, error: 'Account ledger entry not found' });
      return;
    }

    const customerName = entry.customerName;

    // If this entry was created from a particular bill, delete the corresponding particular bill as well
    const { Particular } = await import('../models/Particular');
    if (entry.particularId) {
      await Particular.findByIdAndDelete(entry.particularId);
    } else if (entry.billNo && entry.billNo.trim() !== '' && entry.type === 'BILL') {
      await Particular.findOneAndDelete({ billNo: entry.billNo.trim() });
    } else if (entry.type === 'BILL') {
      const matchCond: any = {
        customerName: { $regex: new RegExp(`^${escapeRegex(entry.customerName.trim())}$`, 'i') },
        date: entry.date,
      };
      if (entry.companyName && entry.companyName.trim() !== '') {
        matchCond.companyName = { $regex: new RegExp(`^${escapeRegex(entry.companyName.trim())}$`, 'i') };
      }
      await Particular.findOneAndDelete(matchCond);
    }

    await AccountLedger.findByIdAndDelete(req.params.id);

    // Recalculate running balances for this customer
    await recalculateCustomerBalance(customerName);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

export const getCreditOptions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const totalCount = await AccountOption.countDocuments();
    if (totalCount === 0) {
      await AccountOption.insertMany(DEFAULT_ACCOUNT_OPTIONS);
    }

    const category = req.query.category ? String(req.query.category).toUpperCase() : '';
    const filter: any = {};
    if (category === 'BANK' || category === 'TRANSFERRED_TO') {
      filter.category = category;
    }

    const options = await AccountOption.find(filter).sort({ createdAt: 1 }).lean();
    res.status(200).json({ success: true, count: options.length, data: options });
  } catch (error) {
    next(error);
  }
};

export const createCreditOption = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = String(req.body.category || '').toUpperCase() as AccountOptionCategory;
    const name = String(req.body.name || '').trim();

    if (category !== 'BANK' && category !== 'TRANSFERRED_TO') {
      res.status(400).json({ success: false, error: 'Valid category (BANK or TRANSFERRED_TO) is required' });
      return;
    }
    if (!name) {
      res.status(400).json({ success: false, error: 'Option name is required' });
      return;
    }

    const existing = await AccountOption.findOne({
      category,
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    });
    if (existing) {
      res.status(409).json({ success: false, error: `"${existing.name}" already exists` });
      return;
    }

    const created = await AccountOption.create({ category, name });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

export const updateCreditOption = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'Option name is required' });
      return;
    }

    const existing = await AccountOption.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Option not found' });
      return;
    }

    const duplicate = await AccountOption.findOne({
      _id: { $ne: existing._id },
      category: existing.category,
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    });
    if (duplicate) {
      res.status(409).json({ success: false, error: `"${duplicate.name}" already exists` });
      return;
    }

    existing.name = name;
    await existing.save();
    res.status(200).json({ success: true, data: existing });
  } catch (error) {
    next(error);
  }
};

export const deleteCreditOption = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deleted = await AccountOption.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Option not found' });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
