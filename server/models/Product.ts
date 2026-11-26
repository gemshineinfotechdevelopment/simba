import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  slNo: number;
  name: string;
  companyId?: mongoose.Types.ObjectId | string;
  companyName?: string;
  amount?: number | null;
  hsnCode?: string;
  gstPercent?: number | null;
  measurement?: string;
  code?: string;
  category?: string;
  rate?: number;
  caseCount?: string;
  pktUnit?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema(
  {
    slNo: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
    companyName: { type: String, trim: true, default: '' },
    amount: { type: Number, min: 0, default: null },
    hsnCode: { type: String, trim: true, default: '' },
    gstPercent: { type: Number, min: 0, max: 100, default: null },
    measurement: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    rate: { type: Number, default: 0 },
    caseCount: { type: String, trim: true, default: '' },
    pktUnit: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
