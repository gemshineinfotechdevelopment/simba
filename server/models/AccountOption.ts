import mongoose, { Schema, Document } from 'mongoose';

export type AccountOptionCategory = 'BANK' | 'TRANSFERRED_TO';

export interface IAccountOption extends Document {
  category: AccountOptionCategory;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountOptionSchema: Schema = new Schema(
  {
    category: {
      type: String,
      enum: ['BANK', 'TRANSFERRED_TO'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

AccountOptionSchema.index({ category: 1, name: 1 }, { unique: true });

export const AccountOption = mongoose.model<IAccountOption>('AccountOption', AccountOptionSchema);
