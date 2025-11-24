import mongoose, { Schema, Document, Types } from 'mongoose';

export type RefundStatus = 'pending' | 'succeeded' | 'failed';

export interface IRefund extends Document {
  invoice: Types.ObjectId;
  user: Types.ObjectId;
  amount: number;     // số tiền hoàn
  currency: string;
  status: RefundStatus;
  reason?: string | null;

  provider?: 'stripe' | 'vnpay' | 'momo' | 'apple' | 'google' | 'manual';
  externalRefundId?: string | null;

  refundedAt?: Date | null; // khi hoàn thành
  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema = new Schema<IRefund>(
  {
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'VND' },
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], required: true, index: true },
    reason: { type: String, default: null },

    provider: { type: String, enum: ['stripe', 'vnpay', 'momo', 'apple', 'google', 'manual'], default: 'manual' },
    externalRefundId: { type: String, default: null, sparse: true, unique: true },

    refundedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

RefundSchema.index({ user: 1, refundedAt: -1 });
RefundSchema.index({ status: 1, refundedAt: 1 });

export const Refund = mongoose.model<IRefund>('Refund', RefundSchema);