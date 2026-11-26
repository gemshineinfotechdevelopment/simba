import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product';

const parseOptionalNonNegativeNumber = (
  value: unknown,
  fieldLabel: string
): { valid: true; value: number | null | undefined } | { valid: false; error: string } => {
  if (value === undefined) return { valid: true, value: undefined };
  if (value === null || String(value).trim() === '') return { valid: true, value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { valid: false, error: `${fieldLabel} must be a valid non-negative number` };
  }
  return { valid: true, value: parsed };
};

const buildProductPayload = (
  body: Record<string, unknown>,
  isUpdate: boolean
): { valid: true; data: Record<string, unknown> } | { valid: false; error: string } => {
  const payload: Record<string, unknown> = {};

  if (!isUpdate || body.name !== undefined) {
    const trimmedName = typeof body.name === 'string' ? body.name.trim() : '';
    if (!trimmedName) {
      return { valid: false, error: 'Product name is required' };
    }
    payload.name = trimmedName;
  }

  if (body.slNo !== undefined) {
    const slNo = Number(body.slNo);
    if (!Number.isFinite(slNo) || slNo < 1) {
      return { valid: false, error: 'Serial number must be a positive number' };
    }
    payload.slNo = slNo;
  }

  const amountResult = parseOptionalNonNegativeNumber(body.amount, 'Amount');
  if (!amountResult.valid) return amountResult;

  const rateResult = parseOptionalNonNegativeNumber(body.rate, 'Rate');
  if (!rateResult.valid) return rateResult;

  if (amountResult.value !== undefined) {
    payload.amount = amountResult.value;
    // Keep rate synchronized so Performa and legacy rate consumers receive the updated price
    if (rateResult.value === undefined) {
      payload.rate = amountResult.value ?? 0;
    }
  }
  if (rateResult.value !== undefined) {
    payload.rate = rateResult.value ?? 0;
    if (amountResult.value === undefined && !isUpdate) {
      payload.amount = rateResult.value;
    }
  }

  const gstResult = parseOptionalNonNegativeNumber(body.gstPercent, 'GST %');
  if (!gstResult.valid) return gstResult;
  if (gstResult.value !== undefined) {
    if (gstResult.value !== null && gstResult.value > 100) {
      return { valid: false, error: 'GST % must be between 0 and 100' };
    }
    payload.gstPercent = gstResult.value;
  }

  if (body.hsnCode !== undefined) {
    payload.hsnCode = body.hsnCode === null ? '' : String(body.hsnCode).trim();
  }
  if (body.measurement !== undefined) {
    payload.measurement = body.measurement === null ? '' : String(body.measurement).trim();
  }
  if (body.companyName !== undefined) {
    payload.companyName = body.companyName === null ? '' : String(body.companyName).trim();
  }
  if (body.companyId !== undefined) {
    payload.companyId =
      body.companyId && mongoose.Types.ObjectId.isValid(String(body.companyId))
        ? String(body.companyId)
        : null;
  }
  if (body.code !== undefined) {
    payload.code = body.code === null ? '' : String(body.code).trim();
  }
  if (body.category !== undefined) {
    payload.category = body.category === null ? '' : String(body.category).trim();
  }
  const rawCase = body.caseCount !== undefined ? body.caseCount : body.case;
  if (rawCase !== undefined) {
    payload.caseCount = rawCase === null ? '' : String(rawCase).trim();
  }
  if (body.pktUnit !== undefined) {
    payload.pktUnit = body.pktUnit === null ? '' : String(body.pktUnit).trim();
  }

  return { valid: true, data: payload };
};

export const getProducts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const products = await Product.find().sort({ slNo: 1, createdAt: 1 });
    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const built = buildProductPayload(req.body || {}, false);
    if (!built.valid) {
      res.status(400).json({ success: false, error: built.error });
      return;
    }

    if (built.data.slNo === undefined) {
      const last = await Product.findOne().sort({ slNo: -1 }).select('slNo').lean();
      built.data.slNo = (last?.slNo || 0) + 1;
    }

    const product = await Product.create(built.data);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { companyId, companyName, products } = req.body || {};
    if (!Array.isArray(products) || products.length === 0) {
      res.status(400).json({ success: false, error: 'Please provide at least one product to upload' });
      return;
    }

    const last = await Product.findOne().sort({ slNo: -1 }).select('slNo').lean();
    let nextSlNo = (last?.slNo || 0) + 1;

    const docsToInsert: Record<string, unknown>[] = [];
    for (let i = 0; i < products.length; i += 1) {
      const rawItem = products[i] && typeof products[i] === 'object' ? products[i] : {};
      const mergedItem = {
        ...rawItem,
        companyId: rawItem.companyId ?? companyId ?? null,
        companyName: rawItem.companyName ?? companyName ?? '',
      };
      const built = buildProductPayload(mergedItem, false);
      if (!built.valid) {
        res.status(400).json({ success: false, error: `Row ${i + 1}: ${built.error}` });
        return;
      }
      if (built.data.slNo === undefined) {
        built.data.slNo = nextSlNo;
        nextSlNo += 1;
      }
      docsToInsert.push(built.data);
    }

    const created = await Product.insertMany(docsToInsert);
    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const built = buildProductPayload(req.body || {}, true);
    if (!built.valid) {
      res.status(400).json({ success: false, error: built.error });
      return;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, built.data, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
