import mongoose, { Schema, Document, Types } from 'mongoose';

export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IRefund extends Document {
  userId: Types.ObjectId; // ref đến User
  invoiceId: Types.ObjectId; // ref đến Invoice đã thanh toán (unique)
  amount: number; // số tiền yêu cầu hoàn
  reasonByUser: string; // lý do người dùng nhập
  status: RefundStatus; // 'PENDING' (mặc định), 'APPROVED', 'REJECTED'
  adminNote?: string; // ghi chú của Admin
  processedByAdminId?: Types.ObjectId | null; // ref Admin xử lý, có thể null

  // Các trường bổ sung cho tích hợp payment provider
  currency: string;
  provider?: 'stripe' | 'vnpay' | 'momo' | 'apple' | 'google' | 'manual';
  externalRefundId?: string | null;
  refundedAt?: Date | null; // khi hoàn thành

  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema = new Schema<IRefund>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      unique: true, // Ngăn người dùng yêu cầu hoàn tiền 2 lần cho cùng 1 hóa đơn
      index: true,
    },
    amount: { type: Number, required: true },
    reasonByUser: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      required: true,
      default: 'PENDING',
      index: true,
    },
    adminNote: { type: String },
    processedByAdminId: { type: Schema.Types.ObjectId, ref: 'User', index: true },

    // Các trường bổ sung
    currency: { type: String, required: true, default: 'VND' },
    provider: { type: String, enum: ['stripe', 'vnpay', 'momo', 'apple', 'google', 'manual'], default: 'manual' },
    externalRefundId: { type: String, sparse: true, unique: true }, // Không có default, để undefined thay vì null
    refundedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

// Indexes
RefundSchema.index({ userId: 1, createdAt: -1 });
RefundSchema.index({ status: 1, refundedAt: 1 });
RefundSchema.index({ processedByAdminId: 1, createdAt: -1 });

export const Refund = mongoose.model<IRefund>('Refund', RefundSchema);