import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  slNo: number;
  name: string;
  amount?: number | null;
  hsnCode?: string;
  gstPercent?: number | null;
  measurement?: string;
  code?: string;
  category?: string;
  rate?: number;
  pktUnit?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema(
  {
    slNo: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, min: 0, default: null },
    hsnCode: { type: String, trim: true, default: '' },
    gstPercent: { type: Number, min: 0, max: 100, default: null },
    measurement: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    rate: { type: Number, default: 0 },
    pktUnit: { type: String, trim: true, default: '1' },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
