import mongoose, { Schema, Document, Types } from 'mongoose';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' | 'failed';

export interface IInvoice extends Document {
  subscription: Types.ObjectId;
  user: Types.ObjectId;

  // Số tiền: khuyến nghị dùng gross/net thay vì amount truyền thống
  // amount (deprecated): giữ tương thích, hiểu là grossAmount
  amount: number;

  currency: string;

  // Tách chi tiết để tính doanh thu chuẩn
  subtotalAmount: number;         // trước giảm giá và thuế
  discountAmount: number;         // giảm giá
  taxAmount: number;              // thuế
  providerFeeAmount: number;      // phí cổng thanh toán/Apple/Google
  platformFeeAmount: number;      // phí nền tảng (nếu hạch toán riêng)
  grossAmount: number;            // sau discount + tax (số tiền khách trả) = subtotal - discount + tax
  netAmount: number;              // doanh thu ròng = gross - providerFee - platformFee

  status: InvoiceStatus;
  periodStart: Date;
  periodEnd: Date;

  provider?: 'stripe' | 'vnpay' | 'momo' | 'apple' | 'google' | 'manual';
  externalInvoiceId?: string | null;
  externalPaymentIntentId?: string | null;

  paidAt?: Date | null;
  failedAt?: Date | null;
  failureCode?: string | null;
  failureMessage?: string | null;

  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    amount: { type: Number, required: true }, // giữ tương thích; set = grossAmount khi tạo mới
    currency: { type: String, required: true, default: 'VND' },

    subtotalAmount: { type: Number, required: true, default: 0 },
    discountAmount: { type: Number, required: true, default: 0 },
    taxAmount: { type: Number, required: true, default: 0 },
    providerFeeAmount: { type: Number, required: true, default: 0 },
    platformFeeAmount: { type: Number, required: true, default: 0 },
    grossAmount: { type: Number, required: true, default: 0 },
    netAmount: { type: Number, required: true, default: 0, index: true },

    status: {
      type: String,
      enum: ['draft', 'open', 'paid', 'void', 'uncollectible', 'failed'],
      required: true,
      index: true,
    },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true, index: true },

    provider: { type: String, enum: ['stripe', 'vnpay', 'momo', 'apple', 'google', 'manual'], default: 'manual' },
    externalInvoiceId: { type: String, default: null, sparse: true, unique: true },
    externalPaymentIntentId: { type: String, default: null, sparse: true, unique: true },

    paidAt: { type: Date, default: null, index: true },
    failedAt: { type: Date, default: null },
    failureCode: { type: String, default: null },
    failureMessage: { type: String, default: null },

    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

InvoiceSchema.index({ user: 1, createdAt: -1 });
InvoiceSchema.index({ subscription: 1, createdAt: -1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);